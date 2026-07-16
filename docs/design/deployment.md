# Design: Deployment

**Status:** Draft  
**Last updated:** 2026-07-16

## Purpose

Describe how the game is built and published to the web. This is the concrete implementation of the v1 distribution decision in ADR-008 (free, on GitHub Pages).

---

## Hosting

The game is a static single-page app (ADR-001, ADR-012 — all logic runs in the browser), so it is served as static files from **GitHub Pages** off the `gh-pages` branch of `SimonRess/Trading-app`.

Live URL: `https://simonress.github.io/Trading-app/`

Because the site is served from a repository subpath (`/Trading-app/`) rather than a domain root, Vite must build with a matching `base`. This is set in `vite.config.ts`:

```ts
base: process.env.NODE_ENV === 'production' ? '/Trading-app/' : '/'
```

Development (`npm run dev`) uses `/` so local URLs stay clean; production builds use `/Trading-app/` so asset paths resolve on Pages.

---

## Build

```bash
npm run build      # vite build → dist/
```

The build output in `dist/` is fully self-contained static files (HTML, one JS bundle, one CSS bundle). No server, database, or runtime environment is required — consistent with the "logic in the frontend" architecture (ADR-004, ADR-012).

---

## Automated deploy (CI)

`.github/workflows/deploy.yml` runs on every push to `main`:

1. Checkout, set up Node 20, `npm ci`
2. `npm run build` with `NODE_ENV=production`
3. Publish `dist/` to the `gh-pages` branch (via `peaceiris/actions-gh-pages`)

GitHub Pages then serves the updated `gh-pages` branch. A push to `main` is live in ~1–2 minutes.

A separate workflow, `.github/workflows/ci.yml`, runs `typecheck`, `lint`, and `test` on every branch and PR. CI must pass before merging to `main`; a failing lint or test blocks the deploy path.

---

## Manual deploy (fallback)

```bash
npm run deploy     # npm run build && gh-pages -d dist
```

Publishes the local `dist/` directly to the `gh-pages` branch without going through `main`. Useful for a one-off deploy from a feature branch, but the CI-on-`main` path is the norm.

---

## One-time repository setup

These are configured once in the GitHub repo, not in code:

- **Settings → Pages → Source:** Deploy from a branch → `gh-pages` / root
- The repository must be **public** for GitHub Pages on a free account (there is nothing sensitive in the repo — no secrets, tokens, or credentials; the only token reference is the CI-injected `GITHUB_TOKEN`).

---

## Player-side caching note

The app auto-saves to `localStorage` under `hanse_save_v1` (see `save-file-schema.md`). After a new deploy, players may need a hard refresh to pick up the new bundle. A stale save is loaded on startup by design; the `schemaVersion` field guards against loading an incompatible save (ADR-011).

---

## Open Questions

- Should a custom domain be added later (affects `base` and Pages config)?
- When itch.io distribution begins (ADR-008, v2 step), the same `dist/` output can be zipped and uploaded — no build change needed, but the `base` path may need to become relative (`./`) for itch's hosting.

## Related

- ADR-008 (Distribution — GitHub Pages for v1, itch.io later)
- ADR-001 (Platform — web app, URL distribution)
- ADR-011 (Save file format — `schemaVersion` guards stale saves after deploy)
- ADR-012 (Game client abstraction — all logic in the browser, so a static host is sufficient)
- `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `vite.config.ts`
