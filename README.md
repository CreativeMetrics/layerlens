# LayerLens — GTM Companion Extension

Chrome extension (Manifest V3) that adds quality-of-life improvements to the Google Tag Manager web UI and lets you inspect the dataLayer on any website.

## Features

- **Type filter chips** — filter tags / triggers / variables / clients by type with one click
- **Copy row** — duplicate any tag, trigger, variable or client (web & server-side containers)
- **Variable type labels** — human-readable labels for GTM variable codes
- **Block accidental navigation** — warns before leaving a GTM workspace with unsaved changes
- **dataLayer inspector** — view, inspect and export all dataLayer pushes on any page
  - Newest push shown at top
  - Live mode for real-time monitoring
  - One-click copy of any push as `dataLayer.push(…)` code
  - Export all pushes as a JSON file

## Install (unpacked — no Chrome Web Store)

1. Download **`layerlens.zip`** from the [latest Release](https://github.com/CreativeMetrics/layerlens/releases/latest)
2. Unzip it — you'll get a `layerlens/` folder
3. Open Chrome → `chrome://extensions` → enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `layerlens/` folder
5. The LayerLens icon appears in your toolbar

## Build from source

```bash
npm install
npm run build          # type-check + production build → dist/
npm run dev            # dev server with HMR
```

Requires Node 18+.

## Architecture

```
src/
├── background/        MV3 service worker
├── content/           Content scripts (message relay, page-world injection)
├── injected/          Page-world scripts (GTM Angular internals, dataLayer access)
├── popup/             Extension popup (HTML + TS + CSS)
├── lib/
│   ├── gtm-angular.ts      Guarded access to GTM's Angular internals
│   ├── gtm-selectors.ts    Single source of truth for GTM UI selectors
│   ├── filters-schema.ts   Typed filter config + validation
│   ├── storage.ts          Typed chrome.storage wrapper
│   └── messaging.ts        Typed message protocol
└── types/
    ├── gtm.d.ts            GTM internals contract
    └── messages.ts         Extension message types
```
