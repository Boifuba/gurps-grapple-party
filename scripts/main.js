/**
 * GURPS Grapple Party Module
 * Main module initialization and hook management
 * 
 * @author Your Name
 * @version 1.0.0
 */

import { GrappleUtils } from './grapple-utils.js';

/**
 * Module namespace
 * @namespace
 */
const MODULE_ID = 'gurps-grapple-party';

/**
 * Module initialization hook
 */
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing GURPS Grapple Party module`);
  
  // Register module settings if needed
  registerModuleSettings();
});

/**
 * Ready hook - module is fully loaded and ready
 */
Hooks.once('ready', () => {
  console.log(`${MODULE_ID} | GURPS Grapple Party module ready`);
  
  // Initialize the grapple system
  GrappleUtils.initialize();
});

/**
 * Register module settings
 */
function registerModuleSettings() {
  game.settings.register(MODULE_ID, 'yAdjustment', {
    name: 'Vertical Adjustment',
    hint: 'Vertical adjustment in pixels for token positioning (negative moves up, positive moves down)',
    scope: 'world',
    config: true,
    type: Number,
    default: -10,
    onChange: value => {
      console.log(`${MODULE_ID} | Y Adjustment changed to: ${value}`);
      GrappleUtils.updateYAdjustment(value);
    }
  });

  game.settings.register(MODULE_ID, 'soloScale', {
    name: 'Solo Token Scale',
    hint: 'Scale for tokens when alone in a hex',
    scope: 'world',
    config: true,
    type: Number,
    default: 1.0,
    range: {
      min: 0.1,
      max: 2.0,
      step: 0.1
    }
  });

  game.settings.register(MODULE_ID, 'pairScale', {
    name: 'Pair Token Scale',
    hint: 'Scale for tokens when two are in the same hex',
    scope: 'world',
    config: true,
    type: Number,
    default: 0.5,
    range: {
      min: 0.1,
      max: 1.0,
      step: 0.1
    }
  });
}