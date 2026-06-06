# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install deps (Node 18+ required)
npm run dev          # dev build with HMR (loads as unpacked extension)
npm run build        # tsc --noEmit + production build → dist/
npm run typecheck    # type-check only, no emit
```

There are no tests and no linter configured.

To load the extension: Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Architecture

This is a Chrome MV3 extension built with Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/). The plugin resolves entry points declared in `src/manifest.ts` and bundles them. The `@` alias maps to `src/`.

### Execution contexts

The extension runs code in three distinct JS worlds that cannot share variables:

| Context | Files | World |
|---|---|---|
| Service worker | `src/background/background.ts` | Extension |
| Content scripts | `src/content/*.content.ts` | Isolated (DOM access, no `window.*` page globals) |
| Injected scripts | `src/injected/*.inject.ts` | PAGE (full access to `window`, `dataLayer`, GTM internals) |

Content scripts bridge to injected scripts via `window.postMessage`. The injected scripts are loaded by content scripts using the crxjs `?script&module` import pattern (e.g. `import path from '@/injected/foo.inject.ts?script&module'`), which gives back the extension-scoped URL to pass to `document.createElement('script')`.

### Message protocol

Two typed message unions in `src/types/messages.ts`:
- `RuntimeMessage` — `chrome.runtime` / `chrome.tabs` messages (background ↔ content/popup). Uses a `code` key for most messages; a legacy `action` key for some older ones.
- `PageMessage` — `window.postMessage` messages (content ↔ injected page-world). Also uses `code` / `action` keys.

Helpers in `src/lib/messaging.ts` (`sendRuntime`, `sendToTab`, `onRuntimeMessage`) wrap the raw Chrome API with typed signatures and handle the async reply pattern.

### Key library modules

- **`src/lib/storage.ts`** — typed promise wrapper over `chrome.storage.local`. `StorageSchema` is the single source of truth for all persisted keys and their types.
- **`src/lib/gtm-selectors.ts`** — all CSS selectors that reach into the GTM web UI in one place. When Google reworks the UI, this is the only file to update. Also exports `pageType()` which detects TAGS / TRIGGERS / VARIABLES / CLIENTS.
- **`src/lib/gtm-angular.ts`** — guarded access to GTM's AngularJS internals (`window.angular`). Every call is wrapped in try/catch so a GTM UI change degrades a single feature rather than crashing the injected script.
- **`src/lib/filters-engine.ts`** — pure filtering logic (no DOM): builds type facets from rows, applies type + name + pause filters.
- **`src/lib/filters-schema.ts`** — `FiltersConfiguration` type + `normalize()` (coerce any input to valid config) + `validate()` (strict, for the Settings JSON editor).

### Feature areas

- **QoL / GTM UI** (`qol-changes.content.ts` → `qol-changes.inject.ts`): runs on `tagmanager.google.com`.
  - Type-filter chip toolbar with dropdown (per-type counts, name search, pause filter, persisted per session)
  - Copy-row button (duplicate tag/trigger/variable/client — web and server containers)
  - Pause/resume tag toggle button inline on each row
  - Bulk rename mode (edit all names in-place, save in one go)
  - Shift+click bulk entity selection (range select on checkboxes)
  - Variable type labels (human-readable overrides, editable via modal)
  - Built-in variable collapse/expand toggle
  - Lookup table / RegEx copy-paste from spreadsheet (clipboard shared cross-tab via `navigator.clipboard`)
  - **Da push dataLayer wizard** — pulsante "Da push datalayer…" nella toolbar della pagina Variabili **solo su container web** (nascosto su sGTM). Incolla un push (anche con sintassi JS grezza, chiavi non quotate, wrapper `dataLayer.push()`). Modal con tre sezioni indipendenti: (1) crea variabili DataLayer (`publicId: 'v'`) per i percorsi dot-notation del push, (2) crea trigger Custom Event, (3) crea tag GA4 Event (`gaawe`). Le sezioni sono abilitabili singolarmente; il trigger creato viene passato al tag. Tutte le creazioni usano il pattern template: clona un'entità esistente dello stesso tipo, cancella i campi tipo-specifici, imposta i nuovi.
  - **Da evento server wizard** — pulsante "Da evento server…" nella toolbar della pagina Variabili **solo su container server-side** (al posto del DLV wizard). Accetta tre formati in auto-detect: (1) JSON dell'event model `{ "event_name": "purchase", ... }`, (2) query string GA4 Measurement Protocol `v=2&en=purchase&ep.currency=EUR&...`, (3) URL completo della collect request. Parser MP: `en`→`event_name`, `ep.X`→`X`, `up.X`→`X`, `it.N.X`→`items[N][X]`. La fonte più comoda è il pulsante **"Copia JSON"** iniettato nel tab Event Data del debug sGTM (vedi Tag Assistant). Crea variabili **Event Data** (`type: 41` intero — CONFERMATO su container sGTM reale 2026-06-06; tutte le variabili sGTM usano type 41). Il parameter key viene rilevato automaticamente clonando una variabile esistente (cerca `key`, `varName`, `name`, `keyName`). Nome default con prefisso `ed - `. `isServerContainer()` rilevato via **DOM**: `document.querySelector('a[href*="/clients"]') != null`. Il nav sGTM include sempre il link alla pagina Clients (via `ng-if`); nei container web non esiste. I check via Angular service sono inaffidabili: `clientService` ha `getList` su entrambi; `serverVariableService` non è iniettabile via `inj.get()` su nessuno dei due. Nessuna cache — GTM è SPA. Strip campi sGTM dal shell: `positiveConditionId`, `negativeConditionId`, `positiveTriggerId`, `negativeTriggerId`, `normalization`.
  - **Event Data copy button** — nella tab Event Data del debug sGTM (Tag Assistant), inietta un toolbar con brand + bottone "Copia JSON" (CONFERMATO su DOM reale 2026-06-06). DOM verificato: `event-data-tab` (selector confermato, usa `data-ng-if` non `aria-hidden`) → `.event-data` → `.event-data__header` + `event-data-table` → `.gtm-debug-card.gtm-event-data-table` → `table.gtm-debug-variable-table` → righe `tr.gtm-debug-variable-table-row`. Chiavi in `td.gtm-debug-table-cell:first-child > pre` (textContent). Valori in `ctui-code-mirror` / CodeMirror — NON usare `.gtm-debug-chip` (quello è della tab Variabili). Il click copia `{chiave: null, ...}` — valori null perché il wizard usa solo le chiavi. Il root viene inserito con `header.after(root)` (dopo `.event-data__header`). `EDV_SKIP_RE = /^(x-ga-|x-sst-|gtm[_.]/` filtra campi interni: `x-ga-*`, `x-sst-*`, `gtm_container`, `gtm_utm_*`, `gtm.js/click` ecc.
    - **GTM Angular internal condition format** (confermato dal sorgente GTM compilato): `customEventFilter` è sempre un **array**. Ogni condizione usa `operator` (stringa, es. `"EQUALS"`, `"REGEX"`, `"CONTAINS"`) + `type` (intero: REGEX=0, EQUALS=1, CONTAINS=4) + `arg` (array di value-object). `arg[0]` = `{ type: 4, macroReference: "_event" }` (macro ref a `{{_event}}`), `arg[1]` = `{ type: 1, string: "event_name" }`. Non usare `type: "EQUALS"` o `parameter: [...]` — quelli sono campi del formato server/REST, non del modello Angular.
    - **Tipo Angular dei trigger** (confermato via server response `typeDisplayName`): `type: 9` = **JavaScript Error** (NON Custom Event). Custom Event = `type: 4` (confermato). Il codice ricava il tipo CE dinamicamente da `d?.['typeDisplayName'] === 'Custom Event'` (il server usa sempre l'inglese internamente, indipendente dalla locale UI). Fallback: `4`.
    - **Rilevamento template CE trigger**: usare `d?.['typeDisplayName'] === 'Custom Event'` — NON `type === 9` (sarebbe JS Error) e NON `customEventFilter != null` (tutti i trigger hanno `customEventFilter: []` come default).
    - **TRIG_TYPE_FIELDS**: includere `jsErrorListener`, `clickListener`, `formListener`, `linkClickListener`, `visibilityListener`, `timerListener`, `scrollListener`, `historyListener` per strippare campi tipo-specifici dal template. Includere anche `parentFolderId` per evitare che il trigger finisca nella cartella del template.
    - **TriggerService.create** risolve con l'entità modello `{ key: { triggerId: N }, data: {...} }` — il `triggerId` è in `result.key.triggerId`, NON in `result.data.triggerId`.
    - **Dedup trigger**: se nel workspace esiste già un trigger con lo stesso nome E tipo CE corretto, riusare il suo `triggerId`. Se ha tipo sbagliato, loggare e procedere alla creazione (il server restituirà errorCode 3 "already has a trigger with this name" — l'utente deve cancellare il vecchio trigger prima).
    - **Dedup tag**: se nel workspace esiste già un tag con lo stesso nome, saltare la creazione (nome già usato da run precedente). `getList` per i tag include `name` e `vendorTemplate.key.publicId` nei dati parziali.
    - **TagService.create** chiama `handleTaggingActivityChange(key, tag)` nel `.then()`, che fa `tag.additionalChangeItems.some(...)` — lancia **TypeError** DOPO che l'HTTP POST è andato a buon fine se la risposta non include `additionalChangeItems`. Trattare errori non-HTTP come successo nel catch.
    - **`svc.getList().$$state.value`** (variabili e trigger): i list item hanno **dati parziali** — includono `name` e `type` ma NON l'array `parameter`. La dedup delle DLV deve usare il nome (`existingNames.has(entry.name)`).
    - **Tag gaawe — parametri in `vendorTemplate.param`**: per i tag vendor template (gaawe), GTM salva la configurazione effettiva in `vendorTemplate.param` usando il formato Angular value-object `{type:1, string:"..."}`. Il campo radice `parameter` (formato REST) è ignorato dalla UI e dal tag firing. Campi: `eventName` (stringa Angular), `eventSettingsTable` (LIST di MAP con `mapKey: ["parameter","parameterValue"]` e `mapValue: [nome, valore]`), `measurementIdOverride`. Non toccare `measurementIdOverride` — viene ereditato dal template.
    - **Tag gaawe — trigger assignment**: GTM Angular usa `positiveTriggerId` (array di interi) e `negativeTriggerId`, NON `firingTriggerId`/`blockingTriggerId` (formato REST). Quando si clona un template, cancellare `positiveTriggerId`, `negativeTriggerId`, `positiveConditionId`, `negativeConditionId` prima di impostare i nuovi trigger. Impostare `positiveTriggerId = [triggerId]` (numero intero, non stringa).
    - **Tag gaawe — `parameter` radice assente**: i tag gaawe creati via GTM UI non hanno il campo `parameter` a livello radice (è undefined dopo il clone). Usare `Array.isArray(data['parameter']) ? data['parameter'] : []` per inizializzare prima di chiamare `.find()` su di esso.
    - **Tag gaawe — tipi Angular model**: `type: 46` = vendor template tag, `tagFiringOption: 1` = oncePerEvent. Usare interi, non stringhe. Necessari sia nel path from-scratch (`isExactType = false, templateKey = null`) sia nel path non-gaawe shell.
    - **Formato nome tag**: `GA4 - Event - nome_evento` (placeholder e auto-fill). Nome trigger: nessun prefisso, solo il nome evento.
    - **Messaggi stato wizard**: le funzioni restituiscono `{ ok, created?: boolean }`. Il chiamante mostra "X creato" se `created === true` e "X già esistente" se `created === false`. Trigger e tag dedup restituiscono `created: false`.
    - **Trigger catch 400**: se il server ritorna 400 (nome duplicato, errorCode 3) il trigger esiste già. Controllare `existingTriggers` per restituire l'ID esistente invece di fallire. `existingTriggers` e `CE_TYPE` sono a scope di funzione (fuori dal `try`) per essere accessibili nel `catch`.
  - **Delete (trash) icon** inline on each row — calls `deleteRow()` from `gtm-angular.ts` (same 3-strategy key resolution as copy-row: table scope → $rootScope traversal → service list name match). Uses `window.confirm` before deletion, hides the row on success. CSS class `.amd-delete-element`, SVG mask `--amd-delete-mask`, red hover state.
    - **`svc.delete(key)` error pattern**: GTM's service post-processing throws a TypeError BOTH on HTTP 200 (success) and on HTTP 400 (element in use), so the catch always receives `status: undefined`. Distinguish them by checking `rowEl.isConnected` after 800ms: if row is still in DOM → deletion was rejected → show alert; if removed → success.
    - **Per-row action menus**: tag rows have a three-dot `<button>` in `td:last-child` (exclude `.qol-row-not-clickable`). Trigger/variable rows have NO per-row action menu — only `svc.delete(key)` + DOM check works for them.
  - **Folder badges** — inline colored pill on each tag/trigger/variable row showing its parent folder name. Clicking saves folder name to `sessionStorage` (`amd-open-folder`), navigates to `/folders`, and `syncFolderPage` auto-clicks `.gtm-unfold-more-icon` on the matching card after 500ms. Yellow tint when folder filter is active.
  - **Folder page redesign** — on the `/folders` route: search toolbar, per-card stats pills (tags/triggers/vars/clients counts from Angular scope), full-height colored left accent strip (6px `position:absolute`, `pointer-events:none`, clipped by `overflow:hidden` on the card) using a deterministic color per folder name. `folderCardName()` strips trailing `()` left by span removal.

#### Folder — miglioramenti da fare

- **Pill colorata** — applicare al badge nel row lo stesso colore dell'accent del folder (ora è sempre grigio). Il colore è già calcolato da `folderColor(name)`, basta passarlo al badge come `border-color` + tint di background.
- **Expand/collapse all** — bottone nella toolbar della pagina folder per espandere o collassare tutti i card. Clicca `.gtm-unfold-more-icon` su tutti i card (expand) o `.gtm-unfold-less-icon` (collapse).
- **Assegna folder dal row** — dropdown inline su ogni row per spostare tag/trigger/variabile in un folder diverso senza aprire GTM. Richiede chiamata API via Angular scope (stessa tecnica di copy-row).
- **Folder filter header** — quando il filtro per folder è attivo, mostrare il nome del folder attivo nell'header della toolbar invece del solo count badge.
- **Colore custom persistito** — color picker nel tooltip del card folder per salvare colori custom in `chrome.storage.local` invece del colore deterministico dal nome.
- **Raggruppamento visivo nella lista** — nella vista Tag/Trigger/Variabili, inserire separatori colorati tra i gruppi di folder (non solo la pill per riga). Diverso dal filter già implementato: mostra i confini del folder direttamente nella lista senza filtrare. Nessuna altra estensione lo fa. Richiede di ordinare le righe per folder e iniettare `<tr>` intestazione per gruppo.

> **Contesto community (Simo Ahava):** le folder sono nate come "una colonna ordinabile, niente di più". Le lacune principali mai risolte da Google: (1) un item in un solo folder, (2) nessun controllo accessi per folder, (3) nessuna pubblicazione selettiva per folder, (4) lista tag non filtrabile per folder — **parzialmente risolto da LayerLens con pill + filter toolbar**, (5) ricerca globale GTM non cerca dentro le folder.

- **Tag Assistant** (`qol-changes.content.ts` → `tag-assistant.inject.ts`): runs on `tagassistant.google.com` and sGTM debug URLs (detected by `?id=&gtm_auth=&gtm_preview=` params).
  - Event search + highlight with sticky toolbar
  - Event pin (pinned events stay at top, survive re-renders)
  - Variable tab search/filter
  - Variable display mode selector (names / values, auto-applied on load)
  - Tag type coloring — vendor logo + colored left border for Meta, GA4, Google Ads, Microsoft, etc.
  - Failed tag highlighting — red border on cards that contain a "failed" status
  - JSON Formatter — syntax-highlighted, collapsible JSON for sGTM request/response bodies, with copy button
  - URL Param Formatter — query string displayed as a key/value table with decoded values
  - Consent Mode monitor — reads GCM consent state (`gcd` / `dma` params from GA4 requests) and shows granted/denied badges inline
  - Container ID badge in the toolbar (web and sGTM)

- **dataLayer inspector** (`datalayer-checker.content.ts` → `datalayer-checker.inject.ts` → popup): reads `window.dataLayer`, listens for pushes, streams to popup.
  - Newest push shown at top; live mode for real-time monitoring
  - Pin any push (persists across page navigations)
  - Page history (previous visits archived, browsable)
  - Full-text search across current page or all history
  - One-click copy as `dataLayer.push(…)` code
  - Export all pushes as JSON file
  - Shopify Web Pixel events labelled with a badge

- **Container detection** (popup): detects GTM container IDs on the active tab, shows count and estimated `gtm.js` bundle size (`~N KB`).

- **Manual GTM injection** (popup + `background.ts`): inject any GTM container into pages that don't have one, via URL glob patterns. Rules stored in `chrome.storage.local`, toggled per-rule.

- **Shopify Pixel sandbox bridge** (`background.ts` + `shopify-sandbox.content.ts` + `shopify-sandbox.inject.ts`): forwards dataLayer events from the sandboxed Shopify pixel iframe to the parent frame (SYN/ACK handshake, mirrors Stape GTM Helper approach).

- **Block page change** (`block-page-change.content.ts`): warns before leaving a GTM workspace with unsaved changes.

---

### Feature roadmap (not yet implemented)

Reference implementations surveyed: Stape GTM Helper, Project Andromeda, GTMFixer, Adswerve dataLayer Inspector+. The `gtm-auditor` local project (`/Users/federico/Documents/gtm-auditor`) contains Python-based GA4 validation schemas and logic that can be ported to the extension.

#### Da implementare (priorità confermata)

- **Event name linter** — nel dataLayer inspector, mostra un badge inline sull'header di ogni push card se il nome evento è problematico: nomi riservati GA4 (`session_start`, `first_visit`, `purchase`, ecc.), lunghezza >40 caratteri, formato non snake_case, nomi UA legacy (`gtm.click`, `gtm.historyChange`, ecc.).

- **Variable Quick Edit** — su `tagmanager.google.com`, aggiunge un'icona matita accanto a ogni riferimento `{{Nome Variabile}}` nei parametri di un tag. Cliccando si naviga direttamente alla pagina di modifica di quella variabile. Richiede di leggere il nome dal DOM e costruire l'URL GTM corrispondente.

#### High value — feasible as a pure extension

| Feature | Reference | Implementation notes |
|---|---|---|
| **GA4 dataLayer push validation** | gtm-auditor | Inline severity badges (critical / warning / info) on each push in the popup. Validate: required fields (`currency`, `value`, `items`), event name length/format/reserved names, `ecommerce: null` reset before every ecommerce event, item field consistency across events. Logic already exists in `gtm-auditor/src/validator.py` + `schemas.py` — port the schemas to TS and run validation client-side. |
| **PII detector** | gtm-auditor | Scan all dataLayer push values for PII patterns (email regex, phone, names). Flag as a warning badge on the push card. Patterns already defined in `gtm-auditor/src/schemas.py` → `PII_PATTERNS`. |
| **Ecommerce null-reset warning** | gtm-auditor | In the dataLayer inspector, highlight any GA4 ecommerce event not preceded by `{ecommerce: null}`. Simple sequential scan of `currentPushes`. |
| **Pre-consent tracker detection** | gtm-auditor | Using `webRequest` (already permitted), track which known tracking pixels (GA4, Meta, TikTok, etc.) fired before the consent banner was interacted with. Show a summary in the popup. Domain list already in `gtm-auditor/src/schemas.py` → `TRACKING_DOMAINS`. |
| **Tag ID badge in GTM UI** | GTMFixer | Show the internal GTM numeric tag ID as a small grey badge on each row in the Tags list. Readable from the Angular scope via `gtm-angular.ts`. |

#### Lower priority / out of scope

| Feature | Reference | Reason |
|---|---|---|
| **Tracking Scanner** | Stape | Full audit report across web + sGTM — significant UI scope; better as a separate tab/panel. |
| **GA4 Annotations on publish** | GTMFixer | Requires GA4 API OAuth flow. |
| **QA Reminders / publish notifications** | GTMFixer | Requires persistent background listener or backend. |
| **GTM container spy** | Andromeda | Ethically sensitive; out of scope. |
| **Slack/webhook alerts** | Andromeda | Requires backend relay. |
| **Batch GTM template import/export** | Andromeda | Requires GTM API (OAuth). |

### CSP note

On install the background strips `content-security-policy` headers globally via `declarativeNetRequest` to allow injected GTM and preview to run on CSP-strict sites. This is a known intentional trade-off flagged for future scoping.
