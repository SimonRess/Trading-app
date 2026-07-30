# Audit: Project Structure & Claude Code Usage Review

**Date:** 2026-07-28
**Type:** One-time snapshot audit, not a living doc — file/line references below will drift as the code changes. Re-run informally if this becomes stale enough to mislead.

Two independent passes over the whole repo: (1) project planning/file-structure best practices, (2) Claude-Code-specific usage best practices. Findings only — no fixes applied in this pass; each item notes suggested severity (`high` / `medium` / `low`) so they can be triaged into `docs/design/roadmap-next-versions.md` selectively rather than all at once.

---

## Part 1 — Software Architecture & Project Planning

### What's already good (worth naming, not just gaps)

- **Three-layer doc hierarchy** (PRD → ADR → design docs) is a real, consistently-followed convention, not aspirational — 22 ADRs, each with Context/Decision/Alternatives/Consequences, an up-to-date Decision Status Tracker, and design docs that get an "Implementation Status" note when code and spec diverge instead of silently rotting.
- **`src/game/` architectural boundary is enforced by tooling, not just by convention** — `.eslintrc.json`'s `no-restricted-imports` overrides make CLAUDE.md's Hard Rules 1 and 2 machine-checked, not just documented. This is the single strongest practice in the repo: the rule can't silently erode.
- **Strict TypeScript config** (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, no `any` via ESLint) is a real strict-mode setup, not just the `strict: true` flag alone.
- **Save schema versioning** (`docs/design/save-file-schema.md`, `SCHEMA_VERSION` in `save-system.ts`) is properly designed: version stamped in every save, a newer-than-supported save is refused rather than silently corrupted.
- **Co-located tests** (`foo.ts` → `foo.test.ts`) with good actual coverage of `src/game/systems/` (290 tests across 15 files) — the part of the codebase CLAUDE.md requires tests for does have them.
- **Backlog consolidation** (this session, just completed): planned work now lives in exactly one file (`docs/design/roadmap-next-versions.md`) instead of three drifting copies. Worth stating in this audit as a closed item so it isn't re-flagged later.

### Findings

1. **`src/ui/App.svelte` is a 1,953-line monolith holding nearly the entire UI.** *(high)* Every screen, popup, and building panel lives in one file. This is the direct cause of a recurring bug pattern already documented in this repo's own history: the City-view and List-view render the same data twice in separately-maintained markup blocks, and at least two past fixes (the i18n pass, the bulk-price-freeze fix) required editing both copies by hand because they're not a shared component. `docs/design/roadmap-next-versions.md` already flags this under v1.2 as an opportunity ("Consider extracting a shared `TradeTable.svelte`/`CityInfoPanel.svelte`") — recommend treating it as a required part of that version, not optional, given it's already caused two bugs. Beyond the City/List duplication specifically, splitting `App.svelte` into per-building components (`ShipyardPanel.svelte`, `ChurchPanel.svelte`, etc.) would make each change touch one small file instead of one enormous one, and make the file's own diffs reviewable.

2. **CLAUDE.md's architecture diagram doesn't match the actual code.** *(medium)* `CLAUDE.md` line 22 documents `src/game/state/` as holding "domain Svelte stores (player, fleet, cities, market, calendar)." In reality `src/game/state/` contains only `types.ts` (type definitions) — there are no Svelte stores there at all; state is held as a single object inside `LocalGameClient` and mutated via `sendAction`. This isn't a bug in the code (the actual design — a single `GameState` object behind a `GameClient` interface — is coherent and matches ADR-004/ADR-012), but the CLAUDE.md description actively misleads about where state lives, which matters a lot for a file whose stated purpose is to override default behavior and be followed exactly. Recommend fixing the diagram to describe the real shape (`state/types.ts` = types only; the actual live state lives in `LocalGameClient`, exposed as one `GameState` snapshot per read).

3. **No test coverage strategy for `src/ui/` or `src/render/`.** *(medium)* CLAUDE.md requires unit tests for `src/game/`, and that's honored (290 tests). But there is no stated policy — and no actual coverage — for the UI or PixiJS render layers, which is exactly where this session's two real bugs were found (the bulk-price button reactivity bug, the City-view label-overlap bug). Both were caught by manual/Playwright verification, not by an automated test that would catch a regression next time. Given Svelte reactivity gaps have now caused two separate real bugs, worth at minimum documenting a stated policy (e.g. "reactivity-sensitive UI logic gets a component test; everything else is manually verified") rather than leaving it implicit.

4. **Unused dependency: `howler` (audio library) is installed but has zero references in `src/`.** *(low)* `package.json` lists `howler` as a dependency, but `grep -r howler src` returns nothing — Audio/music is a v2 roadmap item, not yet built. An unused dependency adds bundle-size risk (tree-shaking should handle it since it's unused, but it's still an untracked liability — e.g. it'll be silently outdated by the time audio actually gets built) and is confusing to a future contributor wondering why it's there. Either remove it until the audio feature actually starts, or add a one-line comment/CHANGELOG note explaining it's pre-installed for a planned feature.

5. **10 stale local feature branches, 8 of which are already merged into `main` and never deleted.** *(low)* `git branch` lists `claude/document-ui-polish`, `claude/fix-shipcard-travel-time`, `claude/fix-travel-time-and-storms`, `claude/legend-speed-ship-fixes`, `claude/map-perf-shiptypes-saveui-pixelart`, `claude/map-view`, `claude/risk-durability-map-mobile`, `claude/ship-hull-flip`, `claude/shipyard-buy-repair`, `claude/ui-polish-icons-fold` — 8 of these 10 are fully merged into `main` and exist identically on `origin`. Harmless today, but it's exactly the kind of clutter that makes `git branch` and the GitHub branch list stop being useful navigation aids. Recommend a periodic `git branch --merged main | grep claude/ | xargs git branch -d` (and the matching `git push origin --delete`) after each PR merges — or an explicit note in the workflow that branch cleanup is a manual step nobody currently owns.

6. **CI (`ci.yml`) never runs `npm run build`.** *(medium)* `ci.yml` runs typecheck, lint, and test on every push — but not `build`. `deploy.yml` runs `build` only on `main`, after merge. That means a build-only failure (e.g. a Vite/Rollup error that `tsc --noEmit` wouldn't catch — dynamic imports, asset resolution, the dead-CSS warnings seen this session) can pass CI and only surface at deploy time on `main`, or not at all if warnings aren't treated as errors. Recommend adding a `build` step to `ci.yml` so every PR is deploy-verified before merge, not just after.

7. **Inconsistent project name across files.** *(low)* `package.json`'s `name` is `hanse-trading-game`; `docs/prd.md`'s title is "Product Requirements Document — Hanse: Die Expedition"; `CLAUDE.md` calls it "Hanse Trading Game." Cosmetic, but worth picking one canonical name (probably "Hanse: Die Expedition" per the PRD, since that's the actual game title) and using it consistently in `package.json`, `index.html`'s `<title>`, and doc headers.

8. **No `CONTRIBUTING.md`.** *(low, likely fine for a solo/AI-assisted project)* `00_project_structure.md` functions as a de facto contribution guide already (it says as much: "Read this before contributing"), so this may be a non-issue — flagging only because it's a common gap-check, not because there's clear evidence it's needed here.

---

## Part 2 — Claude Code Usage Review

### What's already good

- **`CLAUDE.md` is genuinely load-bearing, not boilerplate** — it states real architectural hard rules, concrete conventions, and an explicit doc-sync workflow, and (per Part 1's finding #2 aside) is mostly accurate and consistently followed across this session's work.
- **ESLint encodes CLAUDE.md's hard rules as lint errors** (see Part 1 #1's finding above) — this is the best possible pattern for AI-assisted development specifically: it means a rule doesn't rely on the agent remembering prose instructions on every single file edit, it gets caught mechanically even if an edit slips past intent.
- **A `PostToolUse` hook runs `npm run typecheck` after every Edit/Write** (`.claude/settings.json`) — fast, tight feedback loop that catches type errors immediately rather than batching them to the end of a task. This is a strong pattern other Claude Code projects should copy.
- **Custom slash commands** (`/new-adr`, `/new-design`, `/convert-to-adr`, `/check-conventions`) directly encode this project's own doc templates and workflow, so creating a new ADR or design doc is repeatable and consistent rather than reconstructed from memory each time — genuinely good use of the commands feature for a project with strong doc conventions.
- **Scoped permissions allowlist** in `.claude/settings.json` (specific `npm run` scripts, safe `git` read/write commands) plus an explicit deny-list (`git push --force*`, `git reset --hard*`, `rm -rf *`) is a sensible default-safe configuration matching the project's actual command surface, not an overbroad `Bash(*)` grant.

### Findings

9. **`/check-conventions` isn't wired into CI or a hook — it's a manual, easy-to-forget step.** *(medium)* The command exists and is well-designed (checks all 8 of CLAUDE.md's hard rules against a diff), but nothing in this session's workflow actually invoked it before any of the commits made today. Its value depends entirely on remembering to run it. Given the `PostToolUse` hook already runs typecheck automatically, consider either (a) documenting explicitly in CLAUDE.md or `00_project_structure.md` that `/check-conventions` is a required pre-commit step, or (b) turning at least the mechanically-checkable subset of its 8 checks (architecture-boundary imports, `any` usage, `export default`, kebab-case filenames) into ESLint rules like the two that already exist — since 3 of those 4 are things ESLint is already fully capable of enforcing but currently doesn't (only the `src/game/`↔`src/ui/`/`src/render/` boundary and `no-explicit-any`/`no-default-export` are actually linted; file-naming and comment-style are not).

10. **No `.claude/agents/` — every task in this session ran as one long single-context conversation rather than delegating to subagents.** *(low, situational)* For a project this size, that's probably fine and even preferable (the CLAUDE.md architecture is simple enough to hold in context, and the work has mostly been small sequential changes). Flagging only because if the project grows toward the bigger roadmap items (stores & agents, hotseat multiplayer — both flagged in the roadmap as needing their own ADR/design doc before implementation), a dedicated `Explore`-style subagent pass for those specifically would help keep the main conversation's context from being consumed by broad codebase reconnaissance before the real design work starts.

11. **No repo-local skill for the project's own recurring high-effort workflow: full ship-and-deploy.** *(low)* Nearly every completed task this session followed the identical multi-step sequence — run full check suite, update CHANGELOG + version + relevant design doc, commit, push, check PR status, `gh-pages` deploy, report back. That sequence is currently reconstructed from CLAUDE.md prose plus session memory each time rather than being a single invokable skill/command (unlike `/new-adr`/`/new-design`, which *are* captured as commands). A `/ship` command encoding "run checks → remind to update CHANGELOG/version/design docs → commit → push → deploy" would reduce the chance of a step being skipped under context pressure, and is a natural complement to the existing `/check-conventions`.

12. **`.claude/settings.json`'s `PostToolUse` hook only runs `npm run typecheck`, not `lint`.** *(low)* Given lint violations (like the 5 ESLint errors hit during this session's i18n work) are only caught at the very end of a task via the full check suite rather than incrementally like typecheck errors are, a fast `eslint --cache` pass could plausibly be added to the same hook without materially slowing down the edit loop, catching violations (including the `no-restricted-imports` architecture-boundary rule from finding #9) at edit-time instead of batch-time.

---

## Suggested triage

Not all of the above should become new roadmap items — most are process/tooling fixes that don't belong in `docs/design/roadmap-next-versions.md` (which is scoped to player-facing game features). Recommended handling:

- **Do directly, small and mechanical:** #4 (drop unused `howler` dep or document it), #5 (branch cleanup), #6 (add build to CI), #7 (pick one project name), #12 (add lint to the hook).
- **Fold into the already-planned v1.2 `TradeTable`/`CityInfoPanel` extraction:** #1 — don't treat as a separate initiative, just don't let v1.2 skip it.
- **Doc fix, no code change:** #2 (correct CLAUDE.md's architecture diagram).
- **Worth a short discussion before deciding:** #3 (UI/render test policy), #9 (formalize `/check-conventions` or expand ESLint), #10, #11 (new `/ship` command) — these are genuine process choices, not obviously-correct fixes, and should be confirmed rather than auto-applied.
