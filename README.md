# Project Andromeda for GTM — v5.1 (modernised scaffold)

Vite + TypeScript + MV3 (via `@crxjs/vite-plugin`). Internal distribution (unpacked).

## Commands
- `npm run dev` — dev server with HMR (load `dist/` unpacked while running)
- `npm run build` — type-check + production build into `dist/`
- `npm run typecheck` — types only

## Load unpacked
1. `npm run build`
2. chrome://extensions → Developer mode → Load unpacked → select `dist/`

## Architecture
- `src/manifest.ts` — typed manifest (source of truth)
- `src/background/` — MV3 service worker
- `src/content/` — content scripts (inject page-world scripts, relay messages)
- `src/injected/` — PAGE-world scripts (GTM internals / dataLayer access)
- `src/popup/` — extension popup
- `src/lib/` — foundation:
  - `gtm-angular.ts` — guarded access to GTM's Angular internals
  - `gtm-selectors.ts` — single source of truth for GTM UI selectors (with fallbacks)
  - `filters-schema.ts` — typed filters config + validation + new type-based model
  - `storage.ts` / `messaging.ts` — typed wrappers
  - `dom.ts` — minimal jQuery replacement
- `src/types/` — `gtm.d.ts` (GTM internals contract), `messages.ts` (message protocol)

## Migration status
Scaffold ports: background, block-page-change, datalayer-checker (incl. page script).
Next phase: full QoL port (filters redesign, bulk actions, rename, pause, inject,
preview tweaks), de-jQuery of the popup, FontAwesome → inline SVG, UI restyle.
