import { Graphics } from 'pixi.js';

// Shared procedural pixel-art helper (ADR-005 commits to pixel art long-term;
// no asset pipeline or artist exists yet — see map-view.md "Visual Design").
// Drawn as a grid of filled Graphics rects rather than a smooth circle/
// triangle: PixiJS Graphics fills are vector (always crisp-edged rectangles
// regardless of scale), so a deliberately blocky pixel-grid pattern reads as
// pixel art without needing a texture/sprite-sheet pipeline. Swapping in real
// sprite-sheet assets later only touches call sites, not this helper.
export function drawPixelSprite(pattern: string[], pixelSize: number, color: number): Graphics {
  return drawPixelSpriteInto(new Graphics(), pattern, pixelSize, color);
}

export function drawPixelSpriteInto(g: Graphics, pattern: string[], pixelSize: number, color: number): Graphics {
  g.clear();
  const width = Math.max(...pattern.map(row => row.length));
  const offsetX = (width * pixelSize) / 2;
  const offsetY = (pattern.length * pixelSize) / 2;

  for (let y = 0; y < pattern.length; y++) {
    const row = pattern[y] ?? '';
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '#') {
        g.rect(x * pixelSize - offsetX, y * pixelSize - offsetY, pixelSize, pixelSize);
      }
    }
  }

  g.fill({ color });
  return g;
}
