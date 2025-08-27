/**
 * GURPS Grapple Party Module
 * Main module initialization and hook management
 * 
 * Automatically scales and positions tokens when they occupy the same hex in GURPS combat.
 * Only affects tokens with scale 1.0 to preserve manually scaled tokens.
 * 
 * @author GURPS Community
 * @version 1.0.0
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
  
  // Register all module settings
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
  // Only GMs can use these commands
  if (!game.user.isGM) return true;
  
  const command = message.trim().toLowerCase();
  
  if (command === '/gp on') {
    enableModule();
    return false; // Prevent the message from appearing in chat
  }
  
  if (command === '/gp off') {
    disableModule();
    return false; // Prevent the message from appearing in chat
  }
  
  return true; // Allow other messages to proceed normally
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
 * Provides a confirmation dialog before resetting all tokens to scale 1.0
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
   * Reset all tokens in the current scene to scale 1.0
   * Shows progress notification and handles errors gracefully
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
    
    // if (tokens.length === 0) {
    //   ui.notifications.info(game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.noTokens'));
    //   return;
    // }

    try {
      ui.notifications.info(
        game.i18n.format('GURPS_GRAPPLE_PARTY.notifications.resettingTokens', {
          count: tokens.length
        })
      );

      // Reset all tokens to scale 1.0
      const updates = tokens.map(tokenDoc => ({
        _id: tokenDoc.id,
        scale: 1.0,
        'texture.scaleX': 1.0,
        'texture.scaleY': 1.0
      }));

      await canvas.scene.updateEmbeddedDocuments('Token', updates);

      // Clear internal tracking state
      GrappleUtils.state.arrangedTokens.clear();
      
      ui.notifications.info(
        game.i18n.format('GURPS_GRAPPLE_PARTY.notifications.tokensReset', {
          count: tokens.length
        })
      );

    } catch (error) {
      console.error(`${MODULE_ID} | Error resetting tokens:`, error);
      ui.notifications.error(game.i18n.localize('GURPS_GRAPPLE_PARTY.notifications.resetError'));
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