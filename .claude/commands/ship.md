Ship the current set of changes: verify, document, commit, push, and deploy.

Follow these steps in order. Do not skip a step; if one fails, stop and fix the
underlying issue rather than bypassing it (no `--no-verify`, no force-push).

1. **Run `/check-conventions`** against the working diff. Report any violations;
   fix them (or ask the developer how to proceed) before continuing.
2. **Run the full check suite**: `npm run typecheck && npm run lint && npm test -- --run && npm run build`.
   All four must pass clean.
3. **Update docs in the same change**, per `docs/00_project_structure.md` §5:
   - New idea not yet committed to a version? → `docs/design/roadmap-next-versions.md`.
   - Behaviour/data/infra change? → a `CHANGELOG.md` entry (Added/Changed/Fixed/Removed).
   - A design decision with real trade-offs? → a new or superseding ADR in `docs/decisions/`.
   - A system's behavior changed? → update the matching `docs/design/*.md`.
   - Version bump in `package.json` if this is a real release (sized per CHANGELOG.md's
     MAJOR.MINOR.PATCH policy), not for pure doc/process changes.
4. **Commit** with a clear message explaining *why*, not just what. Use the
   project's existing commit-message conventions (see recent `git log`).
5. **Push** to the current feature branch: `git push -u origin <branch>`.
6. **Check the PR status** (if one exists for this branch) — still open, not
   already merged. If merged, this is fresh work: restart the branch from the
   latest default branch per the branch-restart procedure, don't stack on
   merged history.
7. **Deploy**, if this is a player-facing change ready for release:
   `NODE_ENV=production npx gh-pages -d dist -m "Deploy <version>: <summary>"`.
8. **Report back**: summarize what shipped, note any deliberate scope
   boundaries, and flag anything found along the way that wasn't part of the
   original ask (new bugs, doc drift, etc.) rather than silently fixing or
   ignoring it.

Skip step 7 (deploy) if the change is docs/process-only and has no effect on
the running app. Skip the version bump in step 3 for the same reason.
