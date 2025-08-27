# GURPS Grapple Party

A Foundry VTT module for automatic token scaling and positioning in hexagonal grids during GURPS combat.

## Features

- Automatically scales and positions tokens when they occupy the same hex
- Only affects tokens with scale 1.0 (preserves manually scaled tokens)
- Configurable scaling values for solo and paired tokens
- Adjustable vertical positioning for fine-tuning alignment
- No initial changes to existing tokens on activation

## Settings

- **Vertical Adjustment**: Fine-tune the vertical positioning of tokens (default: -10px)
- **Solo Token Scale**: Scale for tokens when alone in a hex (default: 1.0)
- **Pair Token Scale**: Scale for tokens when two occupy the same hex (default: 0.5)

## Usage

1. Install and activate the module
2. The module automatically monitors token movements
3. When two tokens with scale 1.0 enter the same hex:
   - Both tokens are scaled down to the configured pair scale
   - The original token stays in place
   - The newcomer moves halfway back toward the hex center
4. When a token is alone in a hex, it returns to solo scale

## Compatibility

- Foundry VTT v13+
- Designed for hexagonal grids
- Works with any token type

## License

MIT License


🎵
The battle’s on the grid tonight,
Tokens clash, they grip so tight.
I press the key, but what is this?
They stack like demons in the mist!

No more Shift!
No more pain!
I just want my grapple chain.

No more Shift!
No more lies!
Tokens shrink before my eyes. 🎵


🎵
I’m a grapple guy,
in a grapple fight,
hold me tighter,
make my token smaller!

Come on grapple, let’s go party,
Grapple, grapple, yeah! 🎵
