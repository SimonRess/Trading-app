# Decision 8: Distribution & Monetization

## Why This Matters

Distribution affects discoverability, revenue, legal obligations, and how much overhead you spend on platform compliance vs. building the game.

## Options

### Free + Open Source (GitHub + GitHub Pages)
**Pros**
- Zero friction for players
- Community contributions possible
- No legal/store compliance overhead
- Fastest to ship

**Cons**
- No direct revenue
- Anyone can fork and republish

### itch.io (Pay-What-You-Want)
**Pros**
- Standard indie game platform; easy setup
- Keeps full control; itch.io takes a configurable cut (default 10%)
- Supports free downloads with optional payments
- No review process

**Cons**
- Smaller audience than Steam
- No automatic update mechanism for desktop builds

### Steam
**Pros**
- Largest PC gaming audience
- Steamworks features: cloud saves, achievements, leaderboards
- Credibility signal

**Cons**
- $100 one-time submission fee per game
- Review process (typically 2–5 days)
- Requires a desktop wrapper (Electron/Tauri) for a web game
- Revenue split: Steam takes 30%

### Browser + Patreon / Ko-fi
**Pros**
- Game stays free and accessible; monetization is opt-in community support
- No platform dependency

**Cons**
- Unpredictable income; requires audience building

## Decision

**→ Free + open source on GitHub for v1; itch.io when a playable version exists**

Start open — share progress, get feedback, build interest. When a playable version is ready, publish on itch.io (pay-what-you-want). If the project gains real traction, evaluate a Steam release with a Tauri wrapper.
