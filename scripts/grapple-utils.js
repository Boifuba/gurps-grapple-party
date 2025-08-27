/**
 * GURPS Grapple Party Utilities
 * 
 * Handles automatic token scaling and positioning in hexagonal grids during GURPS combat.
 * Features intelligent token arrangement where the first token in a hex stays in place,
 * and newcomers are positioned using midpoint calculation with configurable offsets.
 * 
 * Key behaviors:
 * - Token in the center DOES NOT move; newcomer moves to midpoint + offset + radial push
 * - Uses STATIC methods for performance (singleton pattern, no concurrent states)
 * - Module is singleton and manages everything globally
 * 
 * @author GURPS Community
 * @version 1.0.0
 * @since Foundry VTT v13+
 */

/**
 * Main utility class for GURPS Grapple Party functionality
 * All methods are static to maintain single global state and prevent concurrent execution issues
 * 
 * @class GrappleUtils
 */
export class GrappleUtils {
  /**
   * Module identifier constant
   * @static
   * @constant {string}
   */
  static MODULE_ID = 'gurps-grapple-party';
  
  /**
   * Global namespace for state management
   * @static
   * @constant {string}
   */
  static NAMESPACE = 'hex-scale-face-fixed';

  /**
   * Default horizontal offset for newcomer positioning (fraction of grid)
   * Negative values move left, positive move right
   * @static
   * @constant {number}
   */
  static NEWCOMER_OFFSET_GRID_FRAC_X = -0.30;
  
  /**
   * Default vertical offset for newcomer positioning (fraction of grid)  
   * Negative values move up, positive move down
   * @static
   * @constant {number}
   */
  static NEWCOMER_OFFSET_GRID_FRAC_Y = -0.30;

  /**
   * Global state management object
   * Maintains all module state including hooks, cell occupancy, and pending operations
   * 
   * @static
   * @type {Object}
   * @property {Object} hooks - Registered Foundry hooks
   * @property {Map<string, Set<string>>} cells - Maps cell keys to sets of token IDs
   * @property {Map<string, Object>} pending - Pending token movements with metadata
   * @property {Set<string>} busy - Token IDs currently being updated
   * @property {Map<string, string>} firstInCell - Maps cell keys to first token ID in cell
   * @property {Set<string>} arrangedTokens - Token IDs that have been arranged by the module
   */
  static state = {
    hooks: {},
    cells: new Map(),
    pending: new Map(),
    busy: new Set(),
    firstInCell: new Map(),
    arrangedTokens: new Set()
  };

  // ========== Helper Methods ==========

  /**
   * Get approximate scale value from a token document
   * Checks multiple scale properties and returns their average
   * 
   * @static
   * @param {TokenDocument} tokenDoc - The token document to analyze
   * @returns {number} Average scale value, defaults to 1.0 if no scale found
   */
  static getApproximateScale(tokenDoc) {
    const values = [];
    
    if (typeof tokenDoc.scale === 'number') values.push(tokenDoc.scale);
    if (typeof tokenDoc.texture?.scaleX === 'number') values.push(tokenDoc.texture.scaleX);
    if (typeof tokenDoc.texture?.scaleY === 'number') values.push(tokenDoc.texture.scaleY);
    
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1;
  }

  /**
   * Calculate pixel size of a token at a given scale
   * 
   * @static
   * @param {TokenDocument} tokenDoc - The token document
   * @param {number} scale - Scale factor to apply
   * @returns {Object} Object with width and height in pixels
   * @property {number} w - Width in pixels
   * @property {number} h - Height in pixels
   */
  static getPixelSize(tokenDoc, scale) {
    const gridSize = canvas.grid.size;
    return {
      w: (tokenDoc.width ?? 1) * gridSize * scale,
      h: (tokenDoc.height ?? 1) * gridSize * scale
    };
  }

  /**
   * Generate grid cell key from pixel coordinates
   * 
   * @static
   * @param {number} x - X coordinate in pixels
   * @param {number} y - Y coordinate in pixels
   * @param {number} [width=1] - Token width in grid units
   * @param {number} [height=1] - Token height in grid units
   * @returns {string} Grid cell key in format "col,row"
   */
  static keyFromXY(x, y, width = 1, height = 1) {
    const gridSize = canvas.grid.size;
    const centerX = x + (width * gridSize) / 2;
    const centerY = y + (height * gridSize) / 2;
    const [col, row] = canvas.grid.getGridPositionFromPixels(centerX, centerY);
    return `${col},${row}`;
  }

  /**
   * Generate grid cell key from token document
   * 
   * @static
   * @param {TokenDocument} tokenDoc - The token document
   * @returns {string} Grid cell key in format "col,row"
   */
  static keyFromDoc(tokenDoc) {
    return this.keyFromXY(
      tokenDoc.x ?? 0,
      tokenDoc.y ?? 0,
      tokenDoc.width ?? 1,
      tokenDoc.height ?? 1
    );
  }

  /**
   * Calculate center pixel coordinates from grid cell key
   * Uses multiple fallback methods for cross-version compatibility
   * 
   * @static
   * @param {string} key - Grid cell key in format "col,row"
   * @returns {Object} Center coordinates in pixels
   * @property {number} x - X coordinate of hex center
   * @property {number} y - Y coordinate of hex center
   */
  static centerFromKey(key) {
    const [col, row] = key.split(',').map(Number);
    const halfGrid = canvas.grid.size / 2;

    // Try modern API first
    if (canvas.grid.getPixelsFromGridPosition) {
      const [x, y] = canvas.grid.getPixelsFromGridPosition(col, row);
      return { x: x + halfGrid, y: y + halfGrid };
    }

    // Fallback for older versions
    if (canvas.grid.getTopLeftPoint) {
      const point = canvas.grid.getTopLeftPoint({ col, row });
      return { x: point.x + halfGrid, y: point.y + halfGrid };
    }

    // Legacy fallback
    const [x0, y0] = canvas.grid.getTopLeft(col, row);
    return { x: x0 + halfGrid, y: y0 + halfGrid };
  }

  /**
   * Calculate midpoint between two coordinate objects
   * 
   * @static
   * @param {Object} pointA - First coordinate point
   * @param {number} pointA.x - X coordinate
   * @param {number} pointA.y - Y coordinate
   * @param {Object} pointB - Second coordinate point
   * @param {number} pointB.x - X coordinate
   * @param {number} pointB.y - Y coordinate
   * @returns {Object} Midpoint coordinates
   * @property {number} x - Midpoint X coordinate
   * @property {number} y - Midpoint Y coordinate
   */
  static midpoint(pointA, pointB) {
    return {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2
    };
  }

  /**
   * Safely update a token document while preventing infinite loops
   * Manages busy state to prevent concurrent updates on the same token
   * 
   * @static
   * @async
   * @param {TokenDocument} tokenDoc - Token document to update
   * @param {Object} updateData - Update data object
   * @throws {Error} If update fails
   */
  static async updateTokenSafe(tokenDoc, updateData) {
    if (this.state.busy.has(tokenDoc.id)) return;
    
    this.state.busy.add(tokenDoc.id);
    try {
      await tokenDoc.update(updateData);
      this.state.arrangedTokens.add(tokenDoc.id);
    } finally {
      this.state.busy.delete(tokenDoc.id);
    }
  }

  /**
   * Set only the scale properties of a token
   * Checks if scale change is significant before updating
   * 
   * @static
   * @async
   * @param {TokenDocument} tokenDoc - Token document to scale
   * @param {number} scale - New scale value
   */
  static async setScaleOnly(tokenDoc, scale) {
    if (Math.abs(this.getApproximateScale(tokenDoc) - scale) <= 0.01) return;
    
    await this.updateTokenSafe(tokenDoc, {
      scale: scale,
      'texture.scaleX': scale,
      'texture.scaleY': scale
    });
  }

  /**
   * Get current pair scale setting from game settings
   * 
   * @static
   * @returns {number} Scale value for paired tokens
   */
  static getPairScale() {
    return game.settings.get(this.MODULE_ID, 'pairScale') ?? 0.4;
  }

  /**
   * Get current solo scale setting from game settings
   * 
   * @static
   * @returns {number} Scale value for solo tokens
   */
  static getSoloScale() {
    return game.settings.get(this.MODULE_ID, 'soloScale') ?? 1.0;
  }

  /**
   * Get current center distance setting from game settings
   * 
   * @static
   * @returns {number} Distance from center as grid fraction
   */
  static getCenterDistance() {
    return game.settings.get(this.MODULE_ID, 'centerDistance') ?? -0.10;
  }

  // ========== Lifecycle Management ==========

  /**
   * Initialize the entire grapple system
   * Sets up clean state, bootstraps existing tokens, and registers hooks
   * 
   * @static
   */
  static initialize() {
    console.log(`${this.MODULE_ID} | Initializing GrappleUtils`);
    this.cleanup();
    this.bootstrap();
    this.registerHooks();
    ui.notifications.info("GURPS Grapple Party: Initialized successfully");
  }

  /**
   * Clean up existing state and hooks
   * Essential for preventing memory leaks and duplicate hooks in same session
   * 
   * @static
   */
  static cleanup() {
    if (window[this.NAMESPACE]?.hooks) {
      for (const [hookName, hookId] of Object.entries(window[this.NAMESPACE].hooks)) {
        Hooks.off(hookName, hookId);
      }
    }
    
    this.state.cells.clear();
    this.state.pending.clear();
    this.state.busy.clear();
    this.state.firstInCell.clear();
    this.state.arrangedTokens.clear();
    window[this.NAMESPACE] = this.state;
  }

  /**
   * Bootstrap existing tokens in the scene
   * Populates cell tracking without moving or scaling existing tokens
   * 
   * @static
   */
  static bootstrap() {
    if (!canvas.scene) return;
    
    const tokens = canvas.scene.tokens.contents.filter(tokenDoc => !tokenDoc.hidden);
    for (const tokenDoc of tokens) {
      const key = this.keyFromDoc(tokenDoc);
      this.addToCell(key, tokenDoc.id);
      // Bootstrap NEVER moves, centers, or changes scale!
    }
  }

  /**
   * Register all necessary Foundry hooks
   * Uses arrow functions to maintain proper 'this' context
   * 
   * @static
   */
  static registerHooks() {
    this.state.hooks.preUpdate = Hooks.on('preUpdateToken', (tokenDoc, changes) => 
      this.handlePreUpdateToken(tokenDoc, changes)
    );
    this.state.hooks.update = Hooks.on('updateToken', async (tokenDoc) => 
      await this.handleUpdateToken(tokenDoc)
    );
    this.state.hooks.create = Hooks.on('createToken', async (tokenDoc) => 
      await this.handleCreateToken(tokenDoc)
    );
    this.state.hooks.delete = Hooks.on('deleteToken', async (tokenDoc) => 
      await this.handleDeleteToken(tokenDoc)
    );
  }

  // ========== Cell Membership Management ==========

  /**
   * Add a token to a cell's occupancy set
   * Creates new cell if it doesn't exist and tracks first occupant
   * 
   * @static
   * @param {string} key - Grid cell key
   * @param {string} tokenId - Token ID to add
   */
  static addToCell(key, tokenId) {
    let tokenSet = this.state.cells.get(key);
    if (!tokenSet) {
      tokenSet = new Set();
      this.state.cells.set(key, tokenSet);
      this.state.firstInCell.set(key, tokenId);
    }
    tokenSet.add(tokenId);
  }

  /**
   * Remove a token from a cell's occupancy set
   * Cleans up empty cells and reassigns first-in-cell if necessary
   * 
   * @static
   * @param {string} key - Grid cell key
   * @param {string} tokenId - Token ID to remove
   */
  static removeFromCell(key, tokenId) {
    const tokenSet = this.state.cells.get(key);
    if (!tokenSet) return;

    tokenSet.delete(tokenId);
    this.state.arrangedTokens.delete(tokenId);

    if (tokenSet.size === 0) {
      // Cell is now empty
      this.state.cells.delete(key);
      this.state.firstInCell.delete(key);
    } else if (this.state.firstInCell.get(key) === tokenId) {
      // First token left, assign new first (don't move anyone's position/rotation)
      this.state.firstInCell.set(key, [...tokenSet][0]);
    }
  }

  // ========== Core Positioning Logic ==========

  /**
   * Position a newcomer token in an occupied hex
   * Handles both first entry (center position) and subsequent entries (calculated position)
   * 
   * @static
   * @async
   * @param {string} key - Grid cell key
   * @param {string} newcomerTokenId - ID of the token entering the cell
   * @param {Object} [movement] - Movement data with origin and destination info
   * @param {Object} [movement.oldCenter] - Center of origin hex
   * @param {Object} [movement.newCenter] - Center of destination hex
   */
  static async positionNewcomer(key, newcomerTokenId, movement) {
    const tokenSet = this.state.cells.get(key);
    if (!tokenSet || tokenSet.size === 0) return;

    const newcomerToken = canvas.tokens.get(newcomerTokenId);
    if (!newcomerToken) return;
    
    const tokenDoc = newcomerToken.document;
    const centerNew = this.centerFromKey(key);
    const countInCell = tokenSet.size; // Already includes the newcomer

    if (countInCell === 1) {
      // First token in hex → center in hex with solo scale
      const scale = this.getSoloScale();
      const { w, h } = this.getPixelSize(tokenDoc, scale);
      
      await this.updateTokenSafe(tokenDoc, {
        x: Math.round(centerNew.x - w / 2),
        y: Math.round(centerNew.y - h / 2),
        scale: scale,
        'texture.scaleX': scale,
        'texture.scaleY': scale
      });
      return;
    }

    // Multiple tokens in hex:
    // 1) First token stays in place but gets pair scale
    const firstTokenId = this.state.firstInCell.get(key);
    if (firstTokenId && firstTokenId !== newcomerTokenId) {
      const firstTokenDoc = canvas.tokens.get(firstTokenId)?.document;
      if (firstTokenDoc) {
        await this.setScaleOnly(firstTokenDoc, this.getPairScale());
      }
    }

    // 2) Newcomer: calculate position using midpoint + offsets + radial push
    if (movement?.oldCenter && movement?.newCenter) {
      const basePosition = this.midpoint(movement.oldCenter, movement.newCenter);

      // Grid-based offsets (negative = left/up)
      const gridOffsetX = canvas.grid.size * this.NEWCOMER_OFFSET_GRID_FRAC_X;
      const gridOffsetY = canvas.grid.size * this.NEWCOMER_OFFSET_GRID_FRAC_Y;

      // Radial direction (destination center -> midpoint), normalized
      const directionX = basePosition.x - movement.newCenter.x;
      const directionY = basePosition.y - movement.newCenter.y;
      const directionLength = Math.hypot(directionX, directionY) || 1;

      // Push distance in pixels
      const pushDistance = canvas.grid.size * this.getCenterDistance();

      // Final target center
      const targetCenter = {
        x: basePosition.x + (directionX / directionLength) * pushDistance + gridOffsetX,
        y: basePosition.y + (directionY / directionLength) * pushDistance + gridOffsetY
      };

      const scale = this.getPairScale();
      const { w, h } = this.getPixelSize(tokenDoc, scale);
      
      const updateData = {
        x: Math.round(targetCenter.x - w / 2),
        y: Math.round(targetCenter.y - h / 2)
      };

      // Only update scale if it's significantly different
      if (Math.abs(this.getApproximateScale(tokenDoc) - scale) > 0.01) {
        updateData.scale = scale;
        updateData['texture.scaleX'] = scale;
        updateData['texture.scaleY'] = scale;
      }

      await this.updateTokenSafe(tokenDoc, updateData);
    } else {
      // Token created in occupied hex without movement origin: only apply scale
      await this.setScaleOnly(tokenDoc, this.getPairScale());
    }
  }

  // ========== Hook Handlers ==========

  /**
   * Handle pre-update token events to track movement
   * Calculates movement data before the actual update occurs
   * 
   * @static
   * @param {TokenDocument} tokenDoc - Token being updated
   * @param {Object} changes - Pending changes to the token
   * @listens Hooks#preUpdateToken
   */
  static handlePreUpdateToken(tokenDoc, changes) {
    if (this.state.busy.has(tokenDoc.id)) return;
    if (!('x' in changes) && !('y' in changes)) return;

    // Find current cell
    let oldKey = null;
    for (const [key, tokenSet] of this.state.cells.entries()) {
      if (tokenSet.has(tokenDoc.id)) {
        oldKey = key;
        break;
      }
    }
    if (!oldKey) oldKey = this.keyFromDoc(tokenDoc);

    // Calculate destination cell
    const newKey = this.keyFromXY(
      'x' in changes ? changes.x : tokenDoc.x,
      'y' in changes ? changes.y : tokenDoc.y,
      tokenDoc.width ?? 1,
      tokenDoc.height ?? 1
    );

    if (oldKey === newKey) return;

    const oldCenter = this.centerFromKey(oldKey);
    const newCenter = this.centerFromKey(newKey);

    // Update cell membership
    this.removeFromCell(oldKey, tokenDoc.id);
    this.addToCell(newKey, tokenDoc.id);

    // Store movement data for post-update processing
    this.state.pending.set(tokenDoc.id, { oldKey, newKey, oldCenter, newCenter });
  }

  /**
   * Handle post-update token events to execute positioning
   * Processes stored movement data and updates token positions/scales
   * 
   * @static
   * @async
   * @param {TokenDocument} tokenDoc - Token that was updated
   * @listens Hooks#updateToken
   */
  static async handleUpdateToken(tokenDoc) {
    if (this.state.busy.has(tokenDoc.id)) return;
    
    const movementData = this.state.pending.get(tokenDoc.id);
    if (!movementData) return;
    this.state.pending.delete(tokenDoc.id);

    // Handle origin cell: if only 1 token remains, scale it to solo scale
    const oldCellSet = this.state.cells.get(movementData.oldKey);
    if (oldCellSet && oldCellSet.size === 1) {
      const remainingTokenId = [...oldCellSet][0];
      const remainingTokenDoc = canvas.tokens.get(remainingTokenId)?.document;
      if (remainingTokenDoc) {
        await this.setScaleOnly(remainingTokenDoc, this.getSoloScale());
      }
    }

    // Handle destination cell: position the newcomer
    await this.positionNewcomer(movementData.newKey, tokenDoc.id, movementData);
  }

  /**
   * Handle token creation events
   * Positions newly created tokens based on cell occupancy
   * 
   * @static
   * @async
   * @param {TokenDocument} tokenDoc - Newly created token
   * @listens Hooks#createToken
   */
  static async handleCreateToken(tokenDoc) {
    const key = this.keyFromDoc(tokenDoc);
    this.addToCell(key, tokenDoc.id);

    const tokenSet = this.state.cells.get(key);
    if (tokenSet?.size === 1) {
      // First token in hex → center and apply solo scale
      const center = this.centerFromKey(key);
      const scale = this.getSoloScale();
      const { w, h } = this.getPixelSize(tokenDoc, scale);
      
      await this.updateTokenSafe(tokenDoc, {
        x: Math.round(center.x - w / 2),
        y: Math.round(center.y - h / 2),
        scale: scale,
        'texture.scaleX': scale,
        'texture.scaleY': scale
      });
    } else {
      // Created in occupied hex: just apply pair scale, don't move
      await this.setScaleOnly(tokenDoc, this.getPairScale());
    }
  }

  /**
   * Handle token deletion events
   * Cleans up cell membership and rescales remaining tokens if needed
   * 
   * @static
   * @async
   * @param {TokenDocument} tokenDoc - Deleted token
   * @listens Hooks#deleteToken
   */
  static async handleDeleteToken(tokenDoc) {
    let key = null;
    for (const [cellKey, tokenSet] of this.state.cells.entries()) {
      if (tokenSet.has(tokenDoc.id)) {
        key = cellKey;
        break;
      }
    }
    if (!key) return;

    this.removeFromCell(key, tokenDoc.id);

    // If only 1 token remains in hex, scale it to solo scale (don't move)
    const remainingSet = this.state.cells.get(key);
    if (remainingSet && remainingSet.size === 1) {
      const remainingTokenId = [...remainingSet][0];
      const remainingTokenDoc = canvas.tokens.get(remainingTokenId)?.document;
      if (remainingTokenDoc) {
        await this.setScaleOnly(remainingTokenDoc, this.getSoloScale());
      }
    }
  }

  /**
   * Legacy method for Y adjustment updates (deprecated)
   * Kept for backward compatibility but functionality removed
   * 
   * @static
   * @deprecated
   * @param {number} _value - Unused parameter
   */
  static updateYAdjustment(_value) {
    console.log(`${this.MODULE_ID} | updateYAdjustment method is deprecated and should be removed`);
  }
}