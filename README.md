# GURPS Grapple Party 🎵

A sophisticated Foundry VTT module for automatic token scaling and intelligent positioning during GURPS combat encounters. Designed specifically for hexagonal grids, this module eliminates the manual hassle of token management when multiple combatants occupy the same space.

> *🎵 "No more Shift! No more pain! I just want my grapple chain." 🎵*

## ✨ Features

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
- **Solo Token Scale**: Scale for tokens alone in a hex (default: 1.0) 
- **Center Distance**: How far to push tokens from hex center (-0.50 to +0.50)
- **Token Reset Utility**: Emergency reset all tokens to scale 1.0 with confirmation dialog

## 🎮 How It Works

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

## ⚙️ Configuration

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

## 🔧 Installation

### Method 1: Manifest URL
1. Open Foundry VTT
2. Go to **Add-on Modules**
3. Click **Install Module**  
4. Paste manifest URL: `[Your manifest URL here]`
5. Click **Install**

### Method 2: Manual Installation
1. Download the module files
2. Extract to `Data/modules/gurps-grapple-party/`
3. Restart Foundry VTT
4. Enable in **Manage Modules**

## 🎯 Usage Examples

### Combat Scenario
```
Turn 1: Orc moves to hex (5,3) → Scales to 1.0, centers in hex
Turn 2: Hero moves to hex (5,3) → Orc stays put at 0.4 scale, Hero positioned via midpoint calculation
Turn 3: Orc moves away → Hero returns to 1.0 scale, stays in place
```

### Grappling Chain
```
Multiple fighters entering the same hex for grappling:
- First combatant: Stays in position, scales down  
- Subsequent combatants: Positioned intelligently around the hex
- When combat ends: Remaining tokens return to full scale
```

## 🔍 Technical Details

### Performance Features
- **Static Architecture**: All methods are static to prevent memory leaks and concurrent state issues
- **Singleton Pattern**: Single global state management prevents conflicts
- **Smart Updates**: Only updates tokens when scale changes are significant (>0.01 difference)
- **Busy State Management**: Prevents infinite update loops

### Compatibility
- **Foundry VTT**: v13+ (tested on latest versions)
- **Grid Types**: Optimized for hexagonal grids
- **Token Types**: Works with all standard token types
- **Other Modules**: Designed to be compatible with popular GURPS modules

### API Compatibility
The module uses multiple fallback methods for grid calculations to ensure compatibility across Foundry VTT versions:
- Modern: `canvas.grid.getPixelsFromGridPosition()`
- Standard: `canvas.grid.getTopLeftPoint()`  
- Legacy: `canvas.grid.getTopLeft()`

## 🐛 Troubleshooting

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

// Manual reset (emergency)
GrappleUtils.state.cells.clear();
GrappleUtils.state.arrangedTokens.clear();
```

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup
```bash
git clone [repository-url]
cd gurps-grapple-party
# Edit files in your favorite editor
# Test in Foundry VTT development instance
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎵 Credits & Inspiration

*Inspired by the epic battles and grappling encounters that make GURPS combat memorable. Because nobody should have to manually resize and reposition tokens during intense combat!*

> 🎵 *"Come on grapple, let's go party, Grapple, grapple, yeah!"* 🎵

---

**Version**: 1.0.0  
**Author**: GURPS Community  
**Foundry Compatibility**: v13+  
**Last Updated**: 2025

### Special Thanks
- The Foundry VTT community for inspiration and feedback
- GURPS players everywhere who know the struggle of token management
- The original "Grapple Party" song that inspired our module name 🎵