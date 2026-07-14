# ADR-013: Open Source Licence

**Date:** 2026-07-14  
**Status:** Accepted  
**Deciders:** Simon

## Context

ADR-008 flagged the licence choice as a lock-in that must be resolved before publishing any code publicly. The licence chosen now must be compatible with future commercial distribution on itch.io and Steam (ADR-008 v2/v3 targets). A viral licence like the GPL would require any derivative work — including a commercial release — to also be open source, which conflicts with the distribution roadmap. The licence also interacts with any third-party assets brought into the project: their licences must be compatible with the project licence and with commercial redistribution.

## Decision

Use the **MIT Licence**.

MIT is permissive: anyone can use, copy, modify, and distribute the code (including commercially) with no obligation to open-source derivative works. This is fully compatible with a future itch.io or Steam release under a commercial licence, and with a mixed asset set (MIT code + commercially-licensed art assets).

A `LICENSE` file containing the MIT licence text is placed at the repository root. `package.json` lists `"license": "MIT"`.

## Alternatives Considered

- **GPL v3** — strong copyleft; any distribution (including commercial) must release source under GPL. Rejected because it would force the commercial release (itch.io, Steam) to also be open source — contradicting the distribution roadmap. Also creates friction for contributors who want to use the code in proprietary projects.

- **AGPL v3** — like GPL but also covers network use (relevant if a backend is ever added). Rejected for the same reasons as GPL, with added complexity for v3 online multiplayer.

- **Apache 2.0** — permissive like MIT, but also provides an explicit patent licence grant. Considered but not necessary: the project has no patent concerns, and MIT is simpler and more widely understood in the indie game community.

- **Source-available / custom licence** — code is readable but not freely reusable (e.g. "non-commercial use only"). Rejected because it complicates community contributions, is harder to communicate clearly, and provides no meaningful protection that MIT doesn't already offer for this project's risk profile.

- **No licence (all rights reserved)** — technically the default without a licence file. Rejected because it makes the repository legally unusable by anyone, including contributors, which contradicts the open-source community-first distribution strategy (ADR-008).

## Consequences

✅ Fully compatible with future commercial itch.io and Steam releases  
✅ Maximum contributor friendliness — no friction for anyone who wants to use or build on the code  
✅ Simple and universally understood  
✅ Compatible with the widest range of third-party dependency licences  
⚠️  Anyone can fork and republish the code, including commercially, without attribution beyond the licence header — accepted as a known trade-off of MIT  
⚠️  Provides no protection if a well-resourced party clones and commercialises the game before the original — acceptable given the project's current scale  
🔒  All third-party code dependencies must have MIT-compatible licences (MIT, BSD, Apache 2.0, ISC, CC0) — GPL dependencies are incompatible with commercial distribution  
🔒  Art assets are licensed separately from code — the MIT licence covers only source code. Each asset source must be audited for commercial redistribution rights before the itch.io release  

## Links

- Supersedes: —  
- Superseded by: —  
- Related ADRs: ADR-008 (Distribution — open source first, then itch.io; licence must support both), ADR-005 (Art style — AI-assisted art has unresolved commercial legal status; assets are outside the scope of this ADR)  
- Related design docs: —
