/**
 * GURPS Grapple Party Module
 * Main module initialization and hook management
 * 
 * Automatically scales and positions tokens when they occupy the same hex in GURPS combat.
 * 
 * @author GURPS Community
 * @version 1.0.2 (Corrected & Complete)
 * @since Foundry VTT v13+
 */

import { GrappleUtils } from './grapple-utils.js';

/**
 * Module namespace identifier
 * @constant {string}
 */
const MODULE_ID = 'gurps-grapple-party';

/**
 * Module initialization hook - registers settings and prepares the module
 * @listens Hooks#init
 */
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing GURPS Grapple Party module`);
  
  
  registerModuleSettings();
});

/**
 * Ready hook - module is fully loaded and canvas is available
 * @listens Hooks#ready
 */
Hooks.once('ready', () => {
  console.log(`${MODULE_ID} | GURPS Grapple Party module ready`);
  
  // Initialize the grapple system if enabled
  if (game.settings.get(MODULE_ID, 'moduleEnabled')) {
    GrappleUtils.initialize();
  }
});

/**
 * Handle chat commands for module control
 * @listens Hooks#chatMessage
 */
Hooks.on('chatMessage', (log, message, data) => {
  
  if (!game.user.isGM) return true;
  
  const command = message.trim().toLowerCase();
  
  if (command === '/gp on') {
    enableModule();
    return false; 
  }
  
  if (command === '/gp off') {
    disableModule();
    return false; 
  }
  
  return true; 
});

/**
 * Register all module settings in the game settings menu
 * Includes positioning, scaling, and utility settings
 * 
 * @function registerModuleSettings
 */
function registerModuleSettings() {

  // Module enabled/disabled toggle (hidden from menu, controlled via chat)
  game.settings.register(MODULE_ID, 'moduleEnabled', {
    scope: 'world',
    config: false,
    type: Boolean,
    default: true
  });

  // Paired token scale setting - now configurable
  game.settings.register(MODULE_ID, 'pairScale', {
    name: 'GURPS_GRAPPLE_PARTY.settings.pairScale.name',
    hint: 'GURPS_GRAPPLE_PARTY.settings.pairScale.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 0.4,
    range: {
      min: 0.1,
      max: 1.0,
      step: 0.05
    }
  });

  // Center distance setting - how much to push tokens away from hex center
  game.settings.register(MODULE_ID, 'centerDistance', {
    name: 'GURPS_GRAPPLE_PARTY.settings.centerDistance.name',
    hint: 'GURPS_GRAPPLE_PARTY.settings.centerDistance.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: -0.10,
    range: {
      min: -0.50,
      max: 0.50,
      step: 0.05
    }
  });

  // Maximum scale threshold - tokens larger than this are ignored
  game.settings.register(MODULE_ID, 'maxIgnoredScale', {
    name: 'GURPS_GRAPPLE_PARTY.settings.maxIgnoredScale.name',
    hint: 'GURPS_GRAPPLE_PARTY.settings.maxIgnoredScale.hint',
    scope: 'world',
    config: true,
    type: Number,
    default: 1.5,
    range: {
      min: 1.0,
      max: 5.0,
      step: 0.1
    }
  });

  // Button visibility setting - controls if the scene control button is shown
  game.settings.register(MODULE_ID, 'showSceneButton', {
    name: 'GURPS_GRAPPLE_PARTY.settings.showSceneButton.name',
    hint: 'GURPS_GRAPPLE_PARTY.settings.showSceneButton.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  // Token reset utility setting - shows a button to reset all tokens
  game.settings.registerMenu(MODULE_ID, 'resetTokensMenu', {
    name: 'GURPS_GRAPPLE_PARTY.settings.resetTokensMenu.name',
    hint: 'GURPS_GRAPPLE_PARTY.settings.resetTokensMenu.hint',
    label: 'GURPS_GRAPPLE_PARTY.settings.resetTokensMenu.label',
    icon: 'fas fa-undo-alt',
    type: TokenResetDialog,
    restricted: true
  });
}

/**
 * Enable the grapple module
 * Updates settings and initializes the system
 * 
 * @async
 * @function enableModule
 */
async function enableModule() {
  try {
    await game.settings.set(MODULE_ID, 'moduleEnabled', true);
    GrappleUtils.initialize();
    ui.notifications.info(game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.moduleEnabled') || 'GURPS Grapple Party: Módulo ativado');
    console.log(`${MODULE_ID} | Module enabled via chat command`);
  } catch (error) {
    console.error(`${MODULE_ID} | Error enabling module:`, error);
    ui.notifications.error('Erro ao ativar o módulo');
  }
}

/**
 * Disable the grapple module
 * Updates settings and cleans up the system
 * 
 * @async
 * @function disableModule
 */
async function disableModule() {
  try {
    await game.settings.set(MODULE_ID, 'moduleEnabled', false);
    GrappleUtils.cleanup();
    ui.notifications.info(game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.moduleDisabled') || 'GURPS Grapple Party: Módulo desativado');
    console.log(`${MODULE_ID} | Module disabled via chat command`);
  } catch (error) {
    console.error(`${MODULE_ID} | Error disabling module:`, error);
    ui.notifications.error('Erro ao desativar o módulo');
  }
}

/**
 * Dialog class for token reset functionality
 * Provides a confirmation dialog before resetting all tokens to their original scale.
 * 
 * @extends {FormApplication}
 */
class TokenResetDialog extends FormApplication {
  /**
   * Default options for the dialog
   * @static
   * @returns {Object} Default dialog options
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'gurps-grapple-party-reset',
      title: game.i18n.localize('GURPS_GRAPPLE_PARTY.dialog.resetTokens.title'),
      template: `modules/${MODULE_ID}/templates/dialog-confirm.html`,
      width: 400,
      height: 'auto',
      classes: ['gurps-grapple-party-reset']
    });
  }

  /**
   * Prepare data for the dialog template
   * @returns {Object} Template data
   */
  getData() {
    return {};
  }

  /**
   * Handle form submission - not used in this confirmation dialog
   * @param {Event} event - The form submission event
   * @param {Object} formData - Form data
   */
  async _updateObject(event, formData) {
    // This method is required but not used for confirmation dialogs
  }

  /**
   * Reset all tokens in the current scene to their original scale.
   * Shows progress notification and handles errors gracefully.
   * 
   * @async
   * @function resetAllTokens
   */
  async resetAllTokens() {
    if (!canvas.scene) {
      ui.notifications.warn(game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.noScene'));
      return;
    }

    const tokens = canvas.scene.tokens.contents.filter(tokenDoc => !tokenDoc.hidden);
    
    if (tokens.length === 0) {
      ui.notifications.info(game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.noTokens'));
      return;
    }

    try {
      ui.notifications.info(
        game.i18n.format('GURPS_GRAPPLE_PARTY.notifications.resettingTokens', {
          count: tokens.length
        })
      );

      // ======================================================================
      // ======================= INÍCIO DA CORREÇÃO ===========================
      // ======================================================================
      // Reset all tokens to their original scale values.
      // Uses getSoloScale to ensure there's always a valid fallback (the token's current scale)
      // if the original scale was never stored. This prevents resetting to 1.
      const updates = tokens.map(tokenDoc => {
        const resetScale = GrappleUtils.getSoloScale(tokenDoc);
        return {
          _id: tokenDoc.id,
          scale: resetScale,
          'texture.scaleX': resetScale,
          'texture.scaleY': resetScale
        };
      });
      // ======================================================================
      // ======================== FIM DA CORREÇÃO =============================
      // ======================================================================

      await canvas.scene.updateEmbeddedDocuments('Token', updates);

      ui.notifications.info(
        game.i18n.format('GURPS_GRAPPLE_PARTY.notifications.tokensReset', {
          count: tokens.length
        })
      );

    } catch (error) {
      console.error(`${MODULE_ID} | Error resetting tokens:`, error);
      ui.notifications.error(
        game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.resetError') || 
        'Erro ao redefinir tokens'
      );
    }
  }

  /**
   * Activate listeners for the dialog
   * @param {jQuery} html - The rendered dialog HTML
   */
  activateListeners(html) {
    super.activateListeners(html);
    
    html.find('[data-button="reset"]').click(async (event) => {
      event.preventDefault();
      await this.resetAllTokens();
      this.close();
    });

    html.find('[data-button="cancel"]').click((event) => {
      event.preventDefault();
      this.close();
    });
  }
}

    // Add scene control button
    Hooks.on("getSceneControlButtons", (controls) => {
      const tokenControls = controls.tokens;

      if (tokenControls && tokenControls.tools) {
        tokenControls.tools["gurps-grapple-party"] = {
          name: "gurps-grapple-party",
          title: "GURPS Grapple Party",
          icon: "fas fa-hands",
          button: true,
          onClick: () => {
            const isEnabled = game.settings.get(MODULE_ID, 'moduleEnabled');
            if (isEnabled) {
              disableModule();
            } else {
              enableModule();
            }
          },
          visible: game.settings.get(MODULE_ID, 'showSceneButton')
        };
      }
    });
  