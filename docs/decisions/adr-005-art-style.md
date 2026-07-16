# ADR-005: Art Style

> Migrated from docs/05_art_style.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

Art style is one of the earliest decisions that must survive the entire project — assets produced in one style cannot be cheaply migrated to another. It determines visual identity, required skills, asset production timeline, and how faithfully the game evokes the original *Hanse – Die Expedition*.

The original's aesthetic is well-defined: SVGA (640×480) isometric city and harbour views with detailed illustrated backgrounds, hand-painted NPC portrait art, parchment and dark wood-panel UI frames, period-appropriate heraldry, and a warm earthy palette (ochres, deep reds, sea blues). The question is how closely to reproduce that aesthetic within the constraints of a solo or small team, and without the original's production budget.

## Decision

Use **pixel art** for all game-world assets, with **illustrated (higher-resolution) key scenes** for high-impact moments.

- **Pixel art:** map tiles, ships, city overview, character icons, UI chrome
- **Illustrated:** arrival screens at major cities, NPC portrait dialogs, story event screens

Pixel art handles the volume of assets needed at manageable cost; the illustrated splash screens deliver the emotional weight that the original's SVGA art achieved at key moments.

## Alternatives Considered

- **Hand-drawn / illustrated throughout (faithful to original)** — closest to the original SVGA feel; warm, distinctive, stands out in the market. Rejected because it is the most expensive and time-consuming option and is very hard to iterate on during development. Producing a full illustrated asset set would block or delay the entire game. Reserved for the high-impact moments only (see Decision above).

- **Procedural / vector art** — no dedicated artist required; scales to any resolution; fast to iterate. Rejected because procedural and vector art struggles to achieve the period warmth and personality the original has. Without significant design investment the result looks generic and undermines the historical atmosphere the game depends on.

- **AI-assisted art (primary style)** — fast to produce in quantity; can approximate illustrated or painted styles. Rejected as a primary style because quality is inconsistent and requires curation and cleanup, style consistency across many assets is difficult to maintain, and there are unresolved legal grey areas for commercial release. AI tools may assist individual asset creation or prototyping without being the defined art style.

## Consequences

✅ Pixel art authentically evokes the DOS/Amiga era the original belongs to  
✅ Scalable without quality loss via CSS `image-rendering: pixelated`  
✅ Large open-source asset communities (OpenGameArt, itch.io) provide starting points  
✅ Tools are accessible and well-documented (Aseprite, LibreSprite)  
✅ Illustrated splash screens give the game emotional impact at key moments without requiring a full illustrated asset set  
✅ Scope is manageable for a solo or small team  
⚠️  Quality pixel art still requires a dedicated pixel artist — placeholder or low-quality art will define first impressions  
⚠️  Detailed isometric environments (harbour scenes, city views) are time-consuming even in pixel art  
⚠️  Illustrated scenes and pixel art must be art-directed to feel like one cohesive style, not two separate games  
🔒  Pixel art commits the game-world renderer to sprite-sheet workflows and integer-scaled textures — not compatible with vector or resolution-independent approaches  
🔒  The illustrated scene format (dimensions, colour palette, framing) must be defined early and held consistent, as these are the most expensive assets to redo  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-003 (Rendering — PixiJS sprite batching is well-suited to pixel art sprite sheets), ADR-008 (Distribution — art style affects commercial viability and legal review for AI-assisted assets)  
- Related design docs: docs/design/asset-pipeline.md (when created)
