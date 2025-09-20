[![Donate](https://img.shields.io/badge/Donate-Sponsor%20on%20GitHub-black?logo=github)](https://github.com/sponsors/Boifuba)

# GURPS Grapple Party 🎵

A Foundry VTT module for automatic token scaling and intelligent positioning during GURPS combat encounters. Designed specifically for hexagonal grids, this module eliminates the manual hassle of token management when multiple combatants occupy the same space.

🎵
I’m a grapple guy,
in a grapple fight,
hold me tighter,
make my token smaller!

Come on grapple, let’s go party,
Grapple, grapple, yeah! 🎵


## Features

### Intelligent Token Management
- **Smart Scaling**: Automatically scales tokens based on hex occupancy
- **Preserves Manual Scaling**: Only affects tokens with scale 1.0, leaving manually scaled tokens untouched  
- **First-Token Priority**: The first token in a hex stays in place; newcomers are positioned intelligently
- **Dynamic Positioning**: Uses midpoint calculation with configurable offsets for natural-looking arrangements

### Advanced Positioning Algorithm
- **Midpoint Calculation**: Newcomer tokens are positioned at the midpoint between origin and destination hex centers
- **Radial Push**: Configurable distance adjustment along the movement vector
- **Grid-Based Offsets**: Fine-tuned horizontal and vertical positioning controls
- **No Initial Disruption**: Existing tokens remain untouched when the module is activated

### Comprehensive Configuration
- **Pair Token Scale**: Adjustable scale for tokens sharing a hex (default: 0.4)
- **Center Distance**: How far to push tokens from hex center (-0.50 to +0.50)
- **Token Reset Utility**: Emergency reset all tokens to scale 1.0 with confirmation dialog

##  How It Works

### Basic Operation
1. **Solo Tokens**: When a token is alone in a hex, it uses the solo scale (default: full size)
2. **Multiple Tokens**: When 2+ tokens occupy the same hex:
   - The **first token** stays in its current position but scales to pair size
   - **Newcomer tokens** are repositioned using intelligent midpoint calculation
   - All tokens in the hex use the pair scale (default: 40% size)

### Positioning Logic
When a token enters an occupied hex, the module calculates its position using:

```
Final Position = Midpoint(Origin, Destination) + Radial Push + Grid Offsets
```

- **Midpoint**: Between the centers of origin and destination hexes
- **Radial Push**: Distance adjustment along the movement line (configurable)
- **Grid Offsets**: Fixed horizontal/vertical adjustments for fine-tuning

##  Configuration

Access settings via **Configure Settings > Module Settings > GURPS Grapple Party**

### Scale Settings
| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Solo Token Scale | 1.0 | 0.1 - 2.0 | Scale when token is alone in hex |
| Paired Token Scale | 0.4 | 0.1 - 1.0 | Scale when multiple tokens in hex |

### Positioning Settings  
| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Center Distance | -0.10 | -0.50 to +0.50 | Push distance from hex center (grid fraction) |

### Utilities
- **Reset All Tokens**: Emergency button to reset all scene tokens to scale 1.0 with confirmation dialog

### Commands 
`/gp off` Stop module
`/gp on` turn module on 


### ~~Sausage Party~~ Grappling Chain
```
Multiple fighters entering the same hex for grappling:
- First combatant: Stays in position, scales down  
- Subsequent combatants: Positioned intelligently around the hex
- When combat ends: Remaining tokens return to full scale
```

## Technical Details

### Performance Features
- **Static Architecture**: All methods are static to prevent memory leaks and concurrent state issues
- **Singleton Pattern**: Single global state management prevents conflicts
- **Smart Updates**: Only updates tokens when scale changes are significant (>0.01 difference)
- **Busy State Management**: Prevents infinite update loops

### Compatibility
- **Foundry VTT**: v13+ (tested on latest versions)
- **Grid Types**: Optimized for hexagonal grids


##  Troubleshooting

### Common Issues

**Tokens not scaling properly**
- Ensure tokens have scale 1.0 initially (module ignores manually scaled tokens)
- Check that the scene uses hexagonal grid
- Verify module is enabled and initialized

**Positioning seems off**
- Adjust "Center Distance" setting to fine-tune positioning
- Check grid size and token dimensions
- Ensure hex grid is properly aligned

**Performance issues**
- Module uses efficient static methods and smart update detection
- If issues persist, try the "Reset All Tokens" utility

### Console Commands
```javascript
// Check module state
console.log(window['hex-scale-face-fixed']);

// Manual reset (emergency) - not implemented yet
GrappleUtils.state.cells.clear();
GrappleUtils.state.arrangedTokens.clear();
```

## Looking more modules for GURPS?

- [Instant Bazaar](https://github.com/Boifuba/gurps-instant-bazaar)
- [Instant Defaults](https://github.com/Boifuba/gurps-instant-defaults)
- [Instant Counter](https://github.com/Boifuba/gurps-counter)
- [Mookinator](https://github.com/Boifuba/mookinator)
- [Size Matters](https://github.com/Boifuba/size-matters)
- [Grapple Party](https://github.com/Boifuba/gurps-grapple-party)
- [Roll Stats](https://github.com/Boifuba/gurps-rolls-stats)

### Support the Project

Consider supporting the project to help ongoing development.

<a href="https://www.buymeacoffee.com/boifuba" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40">
</a>
