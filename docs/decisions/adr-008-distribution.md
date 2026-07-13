# ADR-008: Distribution & Monetisation

> Migrated from docs/08_distribution.md

**Date:** 2026-07-13  
**Status:** Accepted  
**Deciders:** Simon

## Context

Distribution determines discoverability, revenue, legal obligations, and how much time is spent on platform compliance rather than building the game. The decision must be made early enough to inform the open/closed source choice and the licensing of any third-party assets. It also interacts with the art style decision (ADR-005): AI-assisted art has unresolved legal status on commercial platforms, which matters more if the game is sold than if it is free.

The game is a web app (ADR-001), which means distribution is primarily via URL for v1 — no installer, no platform wrapper required. Desktop distribution (Steam, itch.io desktop builds) would require a Tauri or Electron wrapper and is a separate later step.

## Decision

**Free + open source on GitHub Pages for v1. itch.io (pay-what-you-want) when a playable version exists. Steam evaluated only if the project gains real traction.**

The rationale is sequenced: start open to maximise feedback and interest; add optional monetisation on itch.io once there is something worth paying for; evaluate the cost and overhead of Steam only with a proven audience.

## Alternatives Considered

- **itch.io from the start** — standard indie platform, easy setup, configurable revenue split, no review process, supports pay-what-you-want. Not chosen as the *starting* point because it adds unnecessary overhead before the game is playable. Reserved as the v2 distribution step once a playable build exists.

- **Steam** — largest PC gaming audience, Steamworks features (cloud saves, achievements, leaderboards), credibility signal. Rejected for the near term because it requires a $100 submission fee, a 2–5 day review process, a desktop wrapper (Electron/Tauri) for a web game, and Steam takes a 30% revenue cut. None of these costs are justified before the game has an audience. Remains a viable v3 option if the project gains traction.

- **Browser + Patreon / Ko-fi** — game stays free and accessible; monetisation is opt-in community support; no platform dependency. Rejected as the primary monetisation path because income is unpredictable and audience-building is a prerequisite. May be added alongside itch.io as a supplementary channel, not instead of it.

## Consequences

✅ Zero friction for players in v1 — shareable via URL, no account or install required  
✅ Community contributions possible with an open-source repository  
✅ No legal or store compliance overhead in v1 — fastest path to shipping  
✅ itch.io pay-what-you-want allows revenue without a paywall — players who value the game can support it  
✅ Open source first builds trust and visibility before asking for money  
✅ Steam remains a viable future step without requiring architectural changes — a Tauri wrapper can be added to the existing web app  
⚠️  No direct revenue in v1 — the project must be sustainable without income initially  
⚠️  Open source means anyone can fork and republish — not a legal problem, but a perception risk if a fork gains more visibility  
⚠️  itch.io has a smaller audience than Steam — discovery is harder without active promotion  
⚠️  AI-assisted art (if used) has unresolved legal status on commercial platforms — must be resolved before any paid release  
🔒  Open-source licence chosen for v1 must be compatible with future commercial distribution — a viral licence (GPL) would complicate itch.io and Steam releases; a permissive licence (MIT) or source-available approach should be evaluated  
🔒  Any third-party assets used in v1 must have licences compatible with commercial redistribution on itch.io — verify before use  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-001 (Platform — web app means URL-based distribution for v1; desktop wrapper needed for Steam), ADR-005 (Art style — AI-assisted art has unresolved commercial legal status), ADR-007 (Multiplayer — single-player open-source release is the right first step before multiplayer complexity)  
- Related design docs: —
