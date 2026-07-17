# Project Structure & Planning Guide

This document is the entry point for understanding how this project is organised — how decisions are documented, how design is captured, and how AI-assisted development is configured. Read this before contributing or continuing development.

---

## 1. Document Hierarchy

The project uses three layers of documentation, each answering a different question.

```
docs/
├── 00_project_structure.md   ← this file: meta-guide to the whole system
│
├── prd.md                    ← WHAT: product goals, scope, user stories, win conditions
│
├── decisions/                ← WHY: one ADR per architectural/design decision
│   ├── adr-001-*.md
│   └── ...
│
└── design/                   ← HOW: concrete specs for individual systems
    ├── city-graph.md
    ├── market-formula.md
    ├── mvp-scope.md
    └── ...
```

### Layer 1 — PRD (Product Requirements Document)

**File:** `docs/prd.md`
**Question answered:** What are we building, for whom, and what does success look like?
**Contents:** vision statement, target audience, core feature list, explicit non-goals, win/lose conditions, MVP definition, success metrics.
**Lifecycle:** Written once before development starts. Updated only when scope genuinely changes. Changes to the PRD are significant — note the date and reason.

### Layer 2 — ADR (Architecture Decision Record)

**Folder:** `docs/decisions/`
**Question answered:** Why did we choose X over Y, and what did we consciously give up?
**One file per decision.** Files are named `adr-NNN-short-topic.md` (e.g., `adr-003-rendering-approach.md`).

ADRs are **append-only** in spirit: once accepted, never edited. If a decision is reversed, a new ADR is written with status `Supersedes: ADR-NNN`. This preserves the full reasoning trail, including dead ends.

**Standard ADR template:**

```markdown
# ADR-NNN: Title

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-NNN
**Deciders:** [names or roles]

## Context
What problem or question forced this decision? What constraints existed?

## Decision
What was decided, stated plainly in one or two sentences.

## Alternatives Considered
- **Option A** — pros / cons
- **Option B** — pros / cons
- (include every option seriously considered, even if quickly rejected)

## Consequences
✅ What we gain  
⚠️  What we give up or accept as a trade-off  
🔒 What this decision locks in (makes harder to change later)

## Links
- Supersedes: —
- Superseded by: —
- Related ADRs: ADR-NNN, ADR-NNN
- Related design docs: design/filename.md
```

**Key principle:** The value of an ADR is in "Alternatives Considered" and "Consequences". A decision without those two sections is just a record of what was done — not why.

### Layer 3 — Design Docs

**Folder:** `docs/design/`
**Question answered:** Given our decisions, how exactly will this system work?
**Written before implementing a system.** Contains concrete data models, formulas, state transitions, UI flows, and edge cases.

Design docs are living documents — they are updated as the system is built and reality diverges from the plan. Major divergences should be noted with a date and reason in the doc, not silently overwritten.

**Suggested sections for a design doc:**

```markdown
# System Name

## Purpose
One paragraph: what this system does and why it exists.

## Inputs & Outputs
What state does it read? What state does it produce or modify?

## Data Model
Key types/interfaces, with field names and types.

## Core Logic / Formula
Step-by-step description of how the system works.

## Edge Cases
What happens in unusual situations?

## Open Questions
Things not yet resolved; remove when resolved.

## Related
ADR-NNN, design/other-system.md
```

---

## 2. AI-Assisted Development Setup

This project is built with AI coding assistants (primarily Claude Code). The files in this section configure AI behaviour and are as important as the docs above.

### 2.1 File Map

```
Trading-app/
├── CLAUDE.md                     ← primary AI instructions (project-wide)
├── .claude/
│   ├── settings.json             ← permissions, allowed tools, hooks
│   └── commands/                 ← custom slash commands (project skills)
│       ├── new-adr.md            ← /new-adr: scaffold a new ADR file
│       ├── new-design.md         ← /new-design: scaffold a design doc
│       └── check-conventions.md  ← /check-conventions: lint against this guide
└── src/
    └── ...
```

### 2.2 CLAUDE.md — Primary AI Instructions

`CLAUDE.md` is the single most important file for AI-assisted development. Claude Code reads it at the start of every session. It must be kept accurate and concise — verbose CLAUDE.md files are ignored.

**What belongs in CLAUDE.md:**

```markdown
# CLAUDE.md

## Project
Brief description: what the project is, what stack it uses, what it is NOT.

## Architecture
- Where game logic lives (src/game/) and what it must NOT import
- Where UI lives (src/ui/) and what renderer it uses
- Where the renderer lives (src/render/)

## Code Conventions
- Language: TypeScript strict mode
- Formatter: Prettier (run before committing)
- No default exports (use named exports everywhere)
- File naming: kebab-case for all files
- No `any` types; use `unknown` and narrow
- Pure functions for all game logic (no side effects in src/game/)

## State Management
- All game state lives in Svelte stores under src/game/state/
- Game logic functions: (state, action) => newState — never mutate in place
- UI state (active screen, open dialog) is NOT persisted to save files

## Testing
- Game logic functions must have unit tests (Vitest)
- Run tests with: npm test
- Tests live next to the source file: foo.ts → foo.test.ts

## Key Commands
- npm run dev       → start dev server
- npm test          → run unit tests
- npm run build     → production build
- npm run typecheck → tsc --noEmit

## What NOT to do
- Do not import UI or PixiJS code from src/game/
- Do not mutate state objects; always return new state
- Do not add comments explaining what code does; only add comments for non-obvious WHY
- Do not create files in /tmp; use the project scratchpad
```

### 2.3 .claude/settings.json — Permissions & Hooks

Controls which tools Claude can use without asking, and defines event hooks (shell commands that run on AI events).

**Template:**

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(npm test*)",
      "Bash(git status)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Read(**)",
      "Edit(**)",
      "Write(src/**)",
      "Write(docs/**)"
    ],
    "deny": [
      "Bash(git push --force*)",
      "Bash(rm -rf *)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npm run typecheck 2>&1 | tail -5"
          }
        ]
      }
    ]
  }
}
```

### 2.4 Custom Slash Commands (Project Skills)

Stored in `.claude/commands/`. Each file is a Markdown prompt that becomes a `/command-name` slash command in Claude Code.

**Example — `.claude/commands/new-adr.md`:**

```markdown
Create a new Architecture Decision Record for the decision: $ARGUMENTS

1. Find the highest existing ADR number in docs/decisions/ and increment it.
2. Create docs/decisions/adr-NNN-<slug>.md using the standard template from
   docs/00_project_structure.md section 1 (Layer 2).
3. Set Status to "Proposed" and Date to today.
4. Leave Alternatives Considered and Consequences as scaffold headings
   for the user to fill in.
5. Report the file path created.
```

**Example — `.claude/commands/new-design.md`:**

```markdown
Create a new design doc for the system: $ARGUMENTS

1. Create docs/design/<slug>.md using the design doc template from
   docs/00_project_structure.md section 1 (Layer 3).
2. Pre-fill the Purpose section with a one-sentence placeholder.
3. Add a Related section linking to any ADRs that govern this system
   (search docs/decisions/ for relevant titles).
4. Report the file path created.
```

### 2.5 Code Style Conventions (enforced by tooling)

| Concern | Rule | Enforced by |
|---------|------|-------------|
| Formatting | Prettier defaults (2-space indent, single quotes, trailing commas) | `prettier --check` |
| Types | TypeScript strict mode; no `any` | `tsc --strict` |
| Exports | Named exports only; no `export default` | ESLint rule |
| File names | kebab-case | ESLint / manual |
| Test files | Co-located: `foo.ts` → `foo.test.ts` | Convention |
| Comments | Only for non-obvious WHY; never explain WHAT | Code review |
| State | Immutable updates only in game logic | Convention + tests |

### 2.6 AI Memory & Context Strategy

Claude Code has no persistent memory between sessions by default. The solution is to keep context in files:

| What | Where |
|------|-------|
| Project-wide instructions | `CLAUDE.md` |
| Architectural decisions | `docs/decisions/` |
| System designs | `docs/design/` |
| Current task / open questions | `docs/design/<system>.md` → "Open Questions" section |
| Recurring commands | `.claude/commands/` |
| In-progress work notes | Git branch name + commit messages |

**Rule:** If a decision, constraint, or convention matters across sessions, it must be in a file — not assumed from conversation history.

---

## 3. Decision Status Tracker

A living index of decisions and their status. Update this table whenever an ADR is added or changed.

| # | Topic | Status | File |
|---|-------|--------|------|
| 001 | Platform target | Accepted | decisions/adr-001-platform.md |
| 002 | Language & framework | Accepted | decisions/adr-002-language-framework.md |
| 003 | Rendering approach | Accepted | decisions/adr-003-rendering.md |
| 004 | Architecture & state | Accepted | decisions/adr-004-architecture.md |
| 005 | Art style | Accepted | decisions/adr-005-art-style.md |
| 006 | Turn-based vs real-time | Accepted | decisions/adr-006-turn-vs-realtime.md |
| 007 | Multiplayer scope | Accepted | decisions/adr-007-multiplayer.md |
| 008 | Distribution & monetisation | Accepted | decisions/adr-008-distribution.md |
| 009 | Market price formula | Accepted | decisions/adr-009-market-price-formula.md |
| 010 | Combat mechanic detail | Accepted | decisions/adr-010-combat.md |
| 011 | Save file format & versioning | Accepted | decisions/adr-011-save-file-format.md |
| 012 | Game client abstraction | Accepted | decisions/adr-012-game-client-abstraction.md |
| 013 | Open source licence | Accepted | decisions/adr-013-open-source-licence.md |
| 014 | Net-worth valuation | Accepted | decisions/adr-014-net-worth-valuation.md |

---

## 4. Design Doc Status Tracker

| System | Status | File |
|--------|--------|------|
| Technology stack reference | Accepted | design/tech-stack.md |
| Game mechanics (overview) | Draft | 10_game_mechanics.md |
| City graph & routes | Draft | design/city-graph.md |
| Market formula | Draft | design/market-formula.md |
| Starting scenario | Draft | design/starting-scenario.md |
| Save file schema | Draft | design/save-file-schema.md |
| Turn resolution order | Draft (implemented, see status table) | design/turn-resolution-order.md |
| Event probability table | Draft | design/event-table.md |
| Ship stats & costs | Draft | design/ship-stats.md |
| Deployment | Draft | design/deployment.md |
| Map view | Draft | design/map-view.md |
| Political milestones | **Missing** | — |
| Combat system detail | **Missing** | — |
| MVP scope | Draft | design/mvp-scope.md |
---

## 5. Contribution Workflow

1. **New feature or system?** → Write or update the design doc first (`docs/design/`).
2. **New architectural choice?** → Write an ADR (`docs/decisions/`). Do this before writing code.
3. **Reversing a decision?** → Write a new superseding ADR; do not edit the old one.
4. **Code change?** → CLAUDE.md constraints apply. Run `npm test` and `npm run typecheck` before committing.
5. **Session handoff?** → Ensure open questions are captured in the relevant design doc's "Open Questions" section, not just in chat history.

### Keeping docs in line with the app (required)

The planning files must always describe the app as it actually is. Whenever a change alters behaviour, data, or infrastructure, update the docs **in the same change** as the code — never leave it for later. Concretely:

| What changed | Update |
|--------------|--------|
| Any behaviour/data/infra change | Add a `CHANGELOG.md` entry (Added / Changed / Fixed / Removed) |
| A design decision with real trade-offs | Write or supersede an **ADR**, and link it from the changelog entry |
| How a system works | Update the matching `docs/design/*.md` (and its "Implementation Status" note if the code diverges from the ideal spec) |
| A new decision or design doc | Add a row to the trackers in §3 / §4 above |

If code and a doc disagree, that is a bug in the docs — fix the doc (or, if the code is wrong, fix the code and note it). The `/check-conventions` command reviews a diff against this guide.

**`CHANGELOG.md`** (repo root) is the running, human-readable record of *what* changed; ADRs and design docs hold the *why* and *how*. Every meaningful change touches the changelog.
