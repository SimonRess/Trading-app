# Decision 5: Art Style

## Why This Matters

Art style determines the visual identity of the game, the skills required on the team, the asset production timeline, and how faithfully it evokes the original.

## The Original's Aesthetic

- SVGA (640×480) isometric city/harbor views with detailed illustrated backgrounds
- Hand-painted portrait art for NPCs (merchants, nobles, bankers, pirates)
- Parchment and dark wood-panel UI frames
- Period-appropriate heraldry and typography
- Warm, earthy color palette (ochres, deep reds, sea blues)

## Options

### Pixel Art
**Pros**
- Evokes nostalgia and the DOS/Amiga era authentically
- Scalable with CSS `image-rendering: pixelated`
- Large open-source asset communities (OpenGameArt, itch.io)
- Tools are accessible (Aseprite, LibreSprite)
- Manageable scope for a small team

**Cons**
- Requires a dedicated pixel artist for quality results
- Detailed isometric environments are time-consuming

### Hand-Drawn / Illustrated (faithful to original)
**Pros**
- Closest to the original SVGA illustrated feel
- Warm and distinctive; stands out in the market

**Cons**
- Most expensive and time-consuming option
- Hard to iterate on during development

### Procedural / Vector Art
**Pros**
- No artist required; scales to any resolution
- Fast to iterate

**Cons**
- Very difficult to achieve the period warmth and personality of the original
- Generic-looking without significant design investment

### AI-Assisted Art
**Pros**
- Fast to produce in quantity
- Can approximate illustrated or painted styles

**Cons**
- Quality is inconsistent; requires curation and cleanup
- Legal grey areas for commercial release
- Style consistency across many assets is difficult to maintain

## Decision

**→ Pixel art for game world assets; illustrated key scenes for impact moments**

- Pixel art for: map tiles, ships, city overview, character icons, UI chrome
- Illustrated (higher-res) art for: arrival screens at major cities, character portrait dialogs, story event screens

This is achievable scope for a solo/small team, authentically evokes the original era, and the illustrated "splash screens" add the emotional punch the original's SVGA art delivered.
