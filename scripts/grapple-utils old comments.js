/**
 * GURPS Grapple Party Utilities — token do meio NÃO mexe; newcomer = midpoint + offset (esquerda/cima) + afastamento radial
 * STATIC: Eu usei static aqui por pura preguiça de não ter que instanciar, e deixar o método pertecendo à classe e não ao objeto criado por ele, ficou muito mais leve, isso nunca deve acontecer mas eu posso ter estados concorrentes e fritar o foundry com um monte de ojeto em looping, estranhamente esse método não triggou loops
 * 
 * STATIC STATE = Único e global 
 * 
 * O módulo é singleton, NÃO VAI HAVER DOIS RODANDO ELE GERENCIA TUDO 
 */

export class GrappleUtils {
  static MODULE_ID = 'gurps-grapple-party';
  static NAMESPACE = 'hex-scale-face-fixed';

  // DESLOCAMENTO DO NEWCOMER (fração do grid): negativo = esquerda/cima
  // mover isso para um CONSTANTS 
  static NEWCOMER_OFFSET_GRID_FRAC_X = -0.30; // ajuste livre
  static NEWCOMER_OFFSET_GRID_FRAC_Y = -0.30; // ajuste livre

  // AFASTAMENTO RADIAL a partir do centro do HEX de destino, ao longo da linha de entrada
  // (0.0 = sem afastar; 0.20 = ~20% do grid pra longe do centro)
  // mover isso para um CONSTANTS 
  static NEWCOMER_PUSH_GRID_FRAC = -0.10;

  static state = {
    hooks: {},
    cells: new Map(),        // key -> Set(tokenId)
    pending: new Map(),      // tokenId -> { oldKey, newKey, oldCenter, newCenter }
    busy: new Set(),
    firstInCell: new Map(),  // key -> tokenId (primeiro que entrou nesse hex)
    arrangedTokens: new Set()
  };

  // ---------- Helpers ----------
  static getApproximateScale(tokenDoc) {
    const v = [];
    //fugindo de typescript
    if (typeof tokenDoc.scale === 'number') v.push(tokenDoc.scale);
    if (typeof tokenDoc.texture?.scaleX === 'number') v.push(tokenDoc.texture.scaleX);
    if (typeof tokenDoc.texture?.scaleY === 'number') v.push(tokenDoc.texture.scaleY);
    return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 1;
  }

  static getPixelSize(tokenDoc, s) {
    /*
    Ele está aloprando com canvas muito grandes, o NEWCOMER_PUSH_GRID_FRAC é uma porcentagem mas eu não pq diabos parece estar exponencial e eu não sei resolver isso
      */
    const gs = canvas.grid.size;
    return { w: (tokenDoc.width ?? 1) * gs * s, h: (tokenDoc.height ?? 1) * gs * s };
  }

  static keyFromXY(x, y, w=1, h=1) {
    const gs = canvas.grid.size;
    const cx = x + (w*gs)/2, cy = y + (h*gs)/2;
    const [col, row] = canvas.grid.getGridPositionFromPixels(cx, cy);
    return `${col},${row}`;
  }
  static keyFromDoc(tokenDoc) { return this.keyFromXY(tokenDoc.x ?? 0, tokenDoc.y ?? 0, tokenDoc.width ?? 1, tokenDoc.height ?? 1); }
// Fórmula basica snippet do Size Matters, cálculo geométrico simples convertido para static
  static centerFromKey(key) {
    const [col, row] = key.split(',').map(Number);
    if (canvas.grid.getPixelsFromGridPosition) {
      const [x, y] = canvas.grid.getPixelsFromGridPosition(col, row);
      return { x: x + canvas.grid.size/2, y: y + canvas.grid.size/2 };
    }
    if (canvas.grid.getTopLeftPoint) {
      const p = canvas.grid.getTopLeftPoint({ col, row });
      return { x: p.x + canvas.grid.size/2, y: p.y + canvas.grid.size/2 };
    }
    const [x0, y0] = canvas.grid.getTopLeft(col, row);
    return { x: x0 + canvas.grid.size/2, y: y0 + canvas.grid.size/2 };
  }

  static midpoint(a, b) { return { x: (a.x + b.x)/2, y: (a.y + b.y)/2 }; }

  static async updateTokenSafe(tokenDoc, updateData) {
    if (this.state.busy.has(tokenDoc.id)) return;
    this.state.busy.add(tokenDoc.id);
    try { await tokenDoc.update(updateData); this.state.arrangedTokens.add(tokenDoc.id); }
    finally { this.state.busy.delete(tokenDoc.id); }
  }

  static async setScaleOnly(tokenDoc, s) {
    if (Math.abs(this.getApproximateScale(tokenDoc) - s) <= 0.01) return;
    await this.updateTokenSafe(tokenDoc, { scale: s, 'texture.scaleX': s, 'texture.scaleY': s });
  }

  // ---------- Lifecycle ----------
  static initialize() {
    console.log(`${this.MODULE_ID} | Initializing GrappleUtils`);
    this.cleanup();
    this.bootstrap();
    this.registerHooks();
  }
// O Cleanup é necessário para remover as açoes do hook depois de terminar, para ele não ficar com muitos hooks ativos numa mesma sessão. Evita travamentos. 
  static cleanup() {
    if (window[this.NAMESPACE]?.hooks) {
      for (const [hookName, hookId] of Object.entries(window[this.NAMESPACE].hooks)) Hooks.off(hookName, hookId);
    }
    this.state.cells.clear();
    this.state.pending.clear();
    this.state.busy.clear();
    this.state.firstInCell.clear();
    this.state.arrangedTokens.clear();
    window[this.NAMESPACE] = this.state;
  }

  static bootstrap() {
    if (!canvas.scene) return;
    const tokens = canvas.scene.tokens.contents.filter(td => !td.hidden);
    for (const td of tokens) {
      const key = this.keyFromDoc(td);
      this.addToCell(key, td.id);
      // bootstrap NÃO move, NÃO recenter, NÃO muda escala caralho!
    }
  }
/* eu não sei por que eu preciso de um this aqui, o que acontece se eu passar isso como parâmetro? 
   eu vi esse jeito em um código de um outro módulo, fiz igual e deu certo. Ficou bonito.
*/
  static registerHooks() {
    this.state.hooks.preUpdate = Hooks.on('preUpdateToken', (tokenDoc, changes) => this.handlePreUpdateToken(tokenDoc, changes));
    this.state.hooks.update    = Hooks.on('updateToken', async (tokenDoc) => { await this.handleUpdateToken(tokenDoc); });
    this.state.hooks.create    = Hooks.on('createToken', async (tokenDoc) => { await this.handleCreateToken(tokenDoc); });
    this.state.hooks.delete    = Hooks.on('deleteToken', async (tokenDoc) => { await this.handleDeleteToken(tokenDoc); });
  }

  // 8====== Membership =========D~~~~~
  static addToCell(key, tokenId) {
    let set = this.state.cells.get(key);
    if (!set) { set = new Set(); this.state.cells.set(key, set); this.state.firstInCell.set(key, tokenId); }
    set.add(tokenId);
  }
  static removeFromCell(key, tokenId) {
    const set = this.state.cells.get(key);
    if (!set) return;
    set.delete(tokenId);
    this.state.arrangedTokens.delete(tokenId);
    if (set.size === 0) {
      this.state.cells.delete(key);
      //INCEL kkkkkkkk...
      this.state.firstInCell.delete(key);
    } else if (this.state.firstInCell.get(key) === tokenId) {
      // Se o "primeiro" saiu, apenas marca novo primeiro; NÃO mexe em posição/rotação de ninguém.
      this.state.firstInCell.set(key, [...set][0]);
    }
  }

  // ---------- Core ----------
  static async positionNewcomer(key, newcomerTokenId, movement) {
    const set = this.state.cells.get(key);
    if (!set || set.size === 0) return;

    const newcomerToken = canvas.tokens.get(newcomerTokenId);
    if (!newcomerToken) return;
    const doc = newcomerToken.document;

    const centerNew = this.centerFromKey(key);
    const countInCell = set.size; // já inclui o newcomer

    if (countInCell === 1) {
      // 1º no hex → centraliza no centro do HEX (apenas nessa entrada) com scale 1.0
      const s = 1.0;
      const { w, h } = this.getPixelSize(doc, s);
      await this.updateTokenSafe(doc, {
        x: Math.round(centerNew.x - w/2),
        y: Math.round(centerNew.y - h/2),
        scale: s, 'texture.scaleX': s, 'texture.scaleY': s
      });
      return;
    }

    // Já existia alguém:
    // 1) Token do meio NÃO mexe posição/rotação; só garante SCALE 0.4
    const firstId = this.state.firstInCell.get(key);
    if (firstId && firstId !== newcomerTokenId) {
      const firstDoc = canvas.tokens.get(firstId)?.document;
      if (firstDoc) await this.setScaleOnly(firstDoc, 0.4);
    }

    // 2) Newcomer: midpoint entre CENTRO do HEX de origem e CENTRO do HEX de destino,
    //    + afastamento radial (empurra para longe do centro de destino),
    //    + offsets X/Y (esquerda/cima).
    if (movement?.oldCenter && movement?.newCenter) {
      const base = this.midpoint(movement.oldCenter, movement.newCenter);

      // offsets em fração do grid
      const gx = canvas.grid.size * this.NEWCOMER_OFFSET_GRID_FRAC_X; // ← esquerda se negativo
      const gy = canvas.grid.size * this.NEWCOMER_OFFSET_GRID_FRAC_Y; // ↑ cima se negativo

      // direção radial (centroDestino -> midpoint), normalizada
      const dirX = base.x - movement.newCenter.x;
      const dirY = base.y - movement.newCenter.y;
      const len  = Math.hypot(dirX, dirY) || 1;

      // quanto empurrar em pixels
      const pushPx = canvas.grid.size * this.NEWCOMER_PUSH_GRID_FRAC;

      // centro alvo final
      const targetCenter = {
        x: base.x + (dirX / len) * pushPx + gx,
        y: base.y + (dirY / len) * pushPx + gy
      };

      const s = 0.4;
      const { w, h } = this.getPixelSize(doc, s);
      await this.updateTokenSafe(doc, {
        x: Math.round(targetCenter.x - w/2),
        y: Math.round(targetCenter.y - h/2),
        ...(Math.abs(this.getApproximateScale(doc) - s) > 0.01 ? { scale: s, 'texture.scaleX': s, 'texture.scaleY': s } : {})
      });
    } else {
      // criação em hex ocupado (sem origem): não move; só aplica 0.4
      await this.setScaleOnly(doc, 0.4);
    }
  }

  // ---------- Hooks ----------
  static handlePreUpdateToken(tokenDoc, changes) {
    if (this.state.busy.has(tokenDoc.id)) return;
    if (!('x' in changes) && !('y' in changes)) return;

    // hex origem
    let oldKey = null;
    for (const [key, set] of this.state.cells.entries()) {
      if (set.has(tokenDoc.id)) { oldKey = key; break; }
    }
    if (!oldKey) oldKey = this.keyFromDoc(tokenDoc);

    // hex destino
    const newKey = this.keyFromXY(
      'x' in changes ? changes.x : tokenDoc.x,
      'y' in changes ? changes.y : tokenDoc.y,
      tokenDoc.width ?? 1,
      tokenDoc.height ?? 1
    );
    if (oldKey === newKey) return;

    const oldCenter = this.centerFromKey(oldKey);
    const newCenter = this.centerFromKey(newKey);

    // membership
    this.removeFromCell(oldKey, tokenDoc.id);
    this.addToCell(newKey, tokenDoc.id);

    this.state.pending.set(tokenDoc.id, { oldKey, newKey, oldCenter, newCenter });
  }

  static async handleUpdateToken(tokenDoc) {
    if (this.state.busy.has(tokenDoc.id)) return;
    const mv = this.state.pending.get(tokenDoc.id);
    if (!mv) return;
    this.state.pending.delete(tokenDoc.id);

    // ORIGEM: se sobrou 1 → cresce pra 1.0 (apenas escala). Se 2+ → não mexe.
    const oldSet = this.state.cells.get(mv.oldKey);
    if (oldSet && oldSet.size === 1) {
      const onlyId = [...oldSet][0];
      const onlyDoc = canvas.tokens.get(onlyId)?.document;
      if (onlyDoc) await this.setScaleOnly(onlyDoc, 1.0);
    }

    // DESTINO: processa newcomer
    await this.positionNewcomer(mv.newKey, tokenDoc.id, mv);
  }

  static async handleCreateToken(tokenDoc) {
    const key = this.keyFromDoc(tokenDoc);
    this.addToCell(key, tokenDoc.id);

    const set = this.state.cells.get(key);
    if (set?.size === 1) {
      // 1º no hex → centraliza e 1.0
      const center = this.centerFromKey(key);
      const s = 1.0;
      const { w, h } = this.getPixelSize(tokenDoc, s);
      await this.updateTokenSafe(tokenDoc, {
        x: Math.round(center.x - w/2),
        y: Math.round(center.y - h/2),
        scale: s, 'texture.scaleX': s, 'texture.scaleY': s
      });
    } else {
      // hex ocupado, sem origem: não move; só 0.4
      await this.setScaleOnly(tokenDoc, 0.4);
    }
  }

  static async handleDeleteToken(tokenDoc) {
    let key = null;
    for (const [cellKey, set] of this.state.cells.entries()) {
      if (set.has(tokenDoc.id)) { key = cellKey; break; }
    }
    if (!key) return;

    this.removeFromCell(key, tokenDoc.id);

    // Se sobrou 1 no hex, cresce pra 1.0 (sem mover)
    const remaining = this.state.cells.get(key);
    if (remaining && remaining.size === 1) {
      const onlyId = [...remaining][0];
      const onlyDoc = canvas.tokens.get(onlyId)?.document;
      if (onlyDoc) await this.setScaleOnly(onlyDoc, 1.0);
    }
  }

  static updateYAdjustment(_value) {
    console.log(`${this.MODULE_ID} | updateYAdjustment method is deprecated and should be removed`);
  }
}
