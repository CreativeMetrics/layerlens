// Runs in the PAGE world on tagassistant.google.com
// Features: event search, event pin, variable search.
//
// SCROLL STRATEGY FOR PINNED EVENTS
// The Tag Assistant sidebar uses overflow-y:'overlay' (Chrome/Angular Material).
// scrollAncestor() now detects 'overlay' so it correctly finds the sidebar container
// instead of walking past it to the main page. scrollToRow() uses scrollIntoView
// + detects which ancestor actually scrolled → no dependency on knowing the
// container type in advance.

import { GCS_LABELS, decodeGcs, type ConsentSignal } from '@/lib/consent'

const ROOT_ID        = 'amd-ta-root'
const PINNED_ID      = 'amd-ta-pinned'
const VAR_ROOT_ID    = 'amd-ta-var-root'
const SGTM_WRAP_ID   = 'amd-sgtm-wrapper'
const HIDDEN_CLS     = 'amd-ta-hidden'
const VAR_HIDDEN_CLS = 'amd-ta-var-hidden'
const PIN_CLS        = 'amd-ta-pin-btn'
const PIN_ON_CLS     = 'amd-ta-pin-on'
const HIGHLIGHT      = 'amd-ta-hl'

/**
 * Pin store: key = event index string (e.g. "26"), value = display name.
 * Index-based pinning distinguishes multiple events with the same name.
 * Module-level → survives Angular SPA re-renders.
 */
const pinnedItems = new Map<string, string>()
let filterText    = ''
let varFilterText = ''

// On sGTM preview pages the container ID is in ?id=GTM-XXXXX — read it
// immediately so the badge appears as soon as the toolbar is injected,
// without waiting for a webRequest header that may never arrive.
const _urlId = new URLSearchParams(location.search).get('id') ?? ''
let gtmContainerId = _urlId.startsWith('GTM-') ? _urlId : ''

// Variable-display preference passed by the content script via dataset.
// 'default' = leave GTM's radio as-is; 'names'/'values' = auto-apply.
let varDisplayMode: 'default' | 'names' | 'values' = (() => {
  const v = document.documentElement.dataset.amdVarDisplay
  return (v === 'names' || v === 'values') ? v : 'default'
})()

// ── Selectors ────────────────────────────────────────────────────────────────

const LIST_SELECTORS = [
  '.message-list',
  '[class*="message-list"]',
  '.messages-panel',
]

const ROW_SELECTORS = [
  '.message-list__row--indented',
  '[class*="message-list__row"][class*="indented"]',
  '[class*="message-list__row--indented"]',
]

const SEP_SELECTORS = [
  '.message-list__row:not(.message-list__row--indented)',
  '[class*="message-list__row"]:not([class*="indented"])',
]

// Variables tab — confirmed selectors from real DOM inspection.
// The Angular component hides itself via aria-hidden="true" / class="ng-hide".
const VAR_TAB_SELECTOR  = 'variables-tab:not([aria-hidden="true"]):not(.ng-hide)'
// Event Data tab — same hide pattern; component name by analogy with variables-tab.
const EDV_TAB_SEL       = 'event-data-tab:not([aria-hidden="true"]):not(.ng-hide)'
const EDV_ROOT_ID       = 'amd-edv-copy-root'
const VAR_ROW_SEL       = '.gtm-debug-variable-table-row'
const VAR_NAME_SEL      = '.gtm-debug-chip'
const VAR_VALUE_SEL     = '.gtm-debug-variable-table-value'
const VAR_CARD_SEL      = '.gtm-debug-variable-pane-content'

// ── Selector helpers ──────────────────────────────────────────────────────────

function firstMatch(selectors: string[], root: ParentNode = document): HTMLElement | null {
  for (const sel of selectors) {
    const el = root.querySelector<HTMLElement>(sel)
    if (el) return el
  }
  return null
}

function allMatches(selectors: string[], root: ParentNode = document): HTMLElement[] {
  for (const sel of selectors) {
    const els = Array.from(root.querySelectorAll<HTMLElement>(sel))
    if (els.length) return els
  }
  return []
}

/** Logs matching selectors at startup so future updates are trivial. */
function discoverAndLog() {
  const out: string[] = []
  const check = (label: string, list: string[]) => {
    for (const sel of list) {
      const n = document.querySelectorAll(sel).length
      if (n) out.push(`${label}: "${sel}" (${n})`)
    }
  }
  check('event list', LIST_SELECTORS)
  check('event row',  ROW_SELECTORS)
  ;[VAR_TAB_SELECTOR, VAR_ROW_SEL, VAR_NAME_SEL, VAR_VALUE_SEL].forEach(sel => {
    const n = document.querySelectorAll(sel).length
    if (n) out.push(`var: "${sel}" (${n})`)
  })
  if (out.length) {
    console.groupCollapsed('[LayerLens] Tag Assistant selector discovery')
    out.forEach(r => console.log(r))
    console.groupEnd()
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function evName(row: HTMLElement): string {
  return (
    row.querySelector<HTMLElement>('.message-list__title span[title]')
       ?.getAttribute('title')?.trim() ?? ''
  )
}

function evIndex(row: HTMLElement): string {
  return (
    row.querySelector<HTMLElement>('.message-list__index, [class*="message-list__index"]')
       ?.textContent?.trim() ?? ''
  )
}

function listContainer(): HTMLElement | null {
  const direct = firstMatch(LIST_SELECTORS)
  if (direct) return direct
  return firstMatch(ROW_SELECTORS)?.parentElement ?? null
}

function scrollAncestor(el: HTMLElement): HTMLElement {
  let p = el.parentElement
  while (p && p !== document.body) {
    const { overflowY } = getComputedStyle(p)
    // 'overlay' is a Chrome-specific deprecated value used by Angular Material
    // sidebars — identical to 'auto' in behavior but getComputedStyle returns 'overlay'.
    // Without this check scrollAncestor walks past the sidebar and lands on the
    // main page scroll container, causing the page to scroll instead of the sidebar.
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return p
    p = p.parentElement
  }
  return el.parentElement ?? document.body
}

function evRows(): HTMLElement[] { return allMatches(ROW_SELECTORS) }

/**
 * Scroll a list row into view, correctly accounting for our sticky headers.
 *
 * Root cause of ALL previous failures:
 *   scrollAncestor() only checked overflow 'auto' | 'scroll'. The Tag Assistant
 *   sidebar uses overflow-y:'overlay' (Chrome/Angular Material deprecated value).
 *   scrollAncestor skipped it and landed on the MAIN PAGE container. Every
 *   scrollTop operation scrolled the main page instead of the sidebar.
 *
 * This function does NOT depend on knowing the scroll container in advance:
 *   1. Snapshot scrollTop of every ancestor before calling scrollIntoView.
 *   2. scrollIntoView({ block:'start', behavior:'instant' }) lets the BROWSER
 *      find and scroll the correct container — it handles every overflow variant.
 *   3. Walk the snapshots; the first ancestor whose scrollTop changed is the
 *      real scroll container. Nudge it up by stickyH to clear our sticky toolbar.
 */
/** Find the real scroll container by probing: try setting scrollTop ±1 on each
 *  ancestor — if it actually changes, that element can scroll. */
function eventScrollContainer(target: HTMLElement): HTMLElement {
  let p: HTMLElement | null = target.parentElement
  while (p && p !== document.body) {
    const prev = p.scrollTop
    // Try scrolling down 1px
    p.scrollTop = prev + 1
    if (p.scrollTop !== prev) { p.scrollTop = prev; return p }
    // Try scrolling up 1px (in case already at max)
    p.scrollTop = Math.max(0, prev - 1)
    if (p.scrollTop !== prev) { p.scrollTop = prev; return p }
    p = p.parentElement
  }
  return scrollAncestor(target)
}

function scrollToRow(target: HTMLElement) {
  const root   = document.getElementById(ROOT_ID)
  const pinned = document.getElementById(PINNED_ID)
  const isSGTM = new URLSearchParams(location.search).has('gtm_auth')

  if (isSGTM) {
    // sGTM: ROOT/PINNED are outside the event-list scroll container.
    // Use getBoundingClientRect delta so we scroll to the right position
    // regardless of whether the target is currently visible or not.
    const scrollEl  = eventScrollContainer(target)
    const stickyH   = (root   && scrollEl.contains(root)   ? root.offsetHeight   : 0)
                    + (pinned && scrollEl.contains(pinned) ? pinned.offsetHeight : 0)
                    + 8
    const delta = target.getBoundingClientRect().top
                - scrollEl.getBoundingClientRect().top
                - stickyH
    scrollEl.scrollTop += delta
  } else {
    // Client-side TA: ROOT/PINNED are sticky INSIDE the scroll container.
    // Original scrollIntoView + snapshot approach — proven to work here.
    const stickyH = (root?.offsetHeight ?? 46)
                  + (pinned?.offsetHeight ?? 0)
                  + 8

    type Snap = { el: HTMLElement; before: number }
    const snaps: Snap[] = []
    let cur: HTMLElement | null = target.parentElement
    while (cur) {
      snaps.push({ el: cur, before: cur.scrollTop })
      cur = cur.parentElement as HTMLElement | null
    }

    target.scrollIntoView({ block: 'start', behavior: 'instant' })

    for (const { el, before } of snaps) {
      if (el.scrollTop !== before) {
        el.scrollTop -= stickyH
        return
      }
    }
  }
}

function pinSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>`
}

function searchSvg(size = 14) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`
}

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('amd-ta-style')) return
  const s = document.createElement('style')
  s.id = 'amd-ta-style'
  s.textContent = `
    .${HIDDEN_CLS}     { display: none !important; }
    .${VAR_HIDDEN_CLS} { display: none !important; }

    /* ── Brand badge ── */
    .amd-ta-brand {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      background: #e5c614; color: #2c2c2a;
      border-radius: 7px; padding: 4px 9px 4px 7px;
      font: 700 11px/1 system-ui, sans-serif; letter-spacing: .02em;
      white-space: nowrap; user-select: none;
    }
    .amd-ta-brand svg { flex-shrink: 0; }

    /* ── Toolbar — sticky top ── */
    #${ROOT_ID} {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-ta-searchbox {
      display: flex; align-items: center; gap: 7px; flex: 1;
      background: rgba(255,255,255,.8); border-radius: 8px; padding: 5px 10px;
      border: 1px solid rgba(229,198,20,.5);
    }
    .amd-ta-searchbox svg { flex-shrink: 0; color: #9aa0a6; }
    .amd-ta-searchbox input {
      flex: 1; border: none; background: none; outline: none;
      font: inherit; color: #202124;
    }
    .amd-ta-searchbox input::-webkit-search-cancel-button { -webkit-appearance: none; }
    #amd-ta-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }

    /* ── Pin button — LEFT of the event number, always visible when pinned ── */
    .message-list__row--indented {
      position: relative;
      padding-left: 26px !important;  /* space for the pin icon */
    }
    .${PIN_CLS} {
      display: none;
      position: absolute; left: 3px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; line-height: 0;
      color: rgba(0,0,0,.2);
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${PIN_CLS} { display: inline-flex; color: #9aa0a6; }
    .${PIN_CLS}.${PIN_ON_CLS}  { display: inline-flex !important; color: #c9ad07; }
    .${PIN_CLS}:hover          { color: #202124 !important; background: rgba(0,0,0,.07); }
    .${HIGHLIGHT}              { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Flash animation triggered by scrollToRow ── */
    @keyframes amd-ta-flash-kf {
      0%   { background-color: rgba(229,198,20,.5); }
      100% { background-color: transparent; }
    }
    .amd-ta-flash { animation: amd-ta-flash-kf 1.1s ease-out forwards !important; }

    /* ── Pinned section — sticky below toolbar ── */
    #${PINNED_ID} {
      position: sticky; top: 46px; z-index: 99;
      background: #fffdf0;
      border-bottom: 2px solid rgba(229,198,20,.5);
      padding: 0 10px 10px;
    }
    .amd-ta-pin-sep {
      display: flex; align-items: center; gap: 7px;
      padding: 10px 2px 8px;
      font-size: 11px; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; font-family: system-ui, sans-serif; color: #7a6f1a;
    }
    .amd-ta-pin-sep::before {
      content: ''; display: inline-block; width: 10px; height: 10px; flex-shrink: 0;
      background: #e5c614; border-radius: 2px;
    }

    /* ── Pinned clone cards ── */
    .amd-ta-clone {
      background: rgba(229,198,20,.13) !important;
      border-left: 3px solid #e5c614 !important;
      border-radius: 8px !important;
      box-shadow: 0 1px 4px rgba(0,0,0,.1) !important;
      margin-bottom: 10px !important;
      padding-top: 10px !important;
      padding-bottom: 10px !important;
      min-height: 44px !important;
      cursor: pointer !important;
      transition: background .12s !important;
    }
    .amd-ta-clone:last-child { margin-bottom: 0 !important; }
    .amd-ta-clone:hover      { background: rgba(229,198,20,.22) !important; }

    /* Event number: dark badge inside clone cards */
    .amd-ta-clone .message-list__index,
    .amd-ta-clone [class*="message-list__index"] {
      display: inline-flex !important; align-items: center; justify-content: center;
      background: #2c2c2a !important; color: #fff !important;
      padding: 2px 6px !important; border-radius: 4px !important;
      font-size: 11px !important; font-weight: 700 !important;
      margin-right: 6px !important; min-width: 22px !important;
      line-height: 1.4 !important; vertical-align: middle !important;
    }
    /* Event name: bold and clearly readable in clone cards */
    .amd-ta-clone .message-list__title,
    .amd-ta-clone [class*="message-list__title"] {
      font-weight: 600 !important; color: #1a1a18 !important;
    }
    .amd-ta-clone .message-list__title span[title] {
      font-size: 13px !important;
    }

    .amd-ta-clone::after {
      content: '↑ vai all\\'evento';
      display: none; position: absolute; right: 46px; top: 50%; transform: translateY(-50%);
      font-size: 10px; color: #7a6f1a; background: rgba(229,198,20,.32);
      padding: 2px 8px; border-radius: 8px; white-space: nowrap;
      pointer-events: none; font-family: system-ui, sans-serif;
    }
    .amd-ta-clone:hover::after { display: block; }
    .amd-ta-clone .${PIN_CLS}  { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 8px 4px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }

    /* ── Variables search bar ── */
    #${VAR_ROOT_ID} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${VAR_ROOT_ID} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    #${VAR_ROOT_ID} .amd-ta-searchbox { background: rgba(255,255,255,.8); border: 1px solid rgba(229,198,20,.5); }
    #amd-ta-var-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.28); padding: 2px 7px; border-radius: 10px;
    }

    /* ── Event Data copy toolbar ── */
    #${EDV_ROOT_ID} {
      display: flex; align-items: center; gap: 7px;
      padding: 7px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
      position: sticky; top: 0; z-index: 50;
    }
    #${EDV_ROOT_ID} .amd-ta-brand { font-size: 10px; padding: 3px 7px 3px 6px; }
    .amd-edv-copy-btn {
      margin-left: auto;
      display: inline-flex; align-items: center; gap: 5px;
      background: #2c2c2a; color: #fff;
      border: none; border-radius: 6px; padding: 4px 10px;
      font: 11px/1.4 system-ui, sans-serif; cursor: pointer; white-space: nowrap;
      transition: background .12s;
    }
    .amd-edv-copy-btn:hover { background: #444; }
    .amd-edv-copy-btn svg { flex-shrink: 0; }

    /* ── Tag type coloring ── */
    .gtm-debug-card.amd-tag-colored {
      border-left: 4px solid var(--amd-tag-color, #ccc) !important;
    }
    /* ── Failed tag ── */
    .gtm-debug-card.amd-tag-failed {
      background: rgba(220, 38, 38, .07) !important;
      border-left: 4px solid #dc2626 !important;
    }
    /* ── JSON formatter ── */
    .amd-json-copy {
      display: inline-block; margin: 0 0 5px;
      padding: 3px 10px; font-size: 11px; font-weight: 500; line-height: 1.5;
      background: #f1f3f4; border: 1px solid rgba(0,0,0,.14);
      border-radius: 6px; cursor: pointer; color: #3c4043;
      font-family: system-ui, sans-serif;
    }
    .amd-json-copy:hover { background: #e8eaed; }
    .amd-json-key  { color: #a626a4; }
    .amd-json-str  { color: #188038; }
    .amd-json-num  { color: #c25e00; }
    .amd-json-bool { color: #1967d2; }
    .amd-json-null { color: #80868b; font-style: italic; }

    /* ── URL param formatter ── */
    .amd-url-fmt { font-size: 12px; }
    .amd-url-fmt-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
    }
    .amd-url-fmt-base {
      color: #5f6368; font-size: 11px; font-family: monospace;
      word-break: break-all; flex: 1; min-width: 0;
    }
    .amd-url-params {
      border-collapse: collapse; width: 100%;
      border: 1px solid rgba(0,0,0,.1); border-radius: 4px; overflow: hidden;
    }
    .amd-url-params td {
      padding: 4px 10px; vertical-align: top;
      border-bottom: 1px solid rgba(0,0,0,.05); font-size: 12px;
    }
    .amd-url-params tr:last-child td { border-bottom: none; }
    .amd-url-params tr:nth-child(even) { background: rgba(0,0,0,.02); }
    .amd-url-key { color: #a626a4; font-family: monospace; width: 30%; word-break: break-word; }
    .amd-url-val { color: #032f62; font-family: monospace; word-break: break-all; }

    /* ── Consent Mode Monitor ── */
    .amd-consent-badges {
      display: flex; gap: 5px; flex-wrap: wrap; padding: 3px 0;
    }
    .amd-consent-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 7px; border-radius: 4px;
      font-size: 11px; font-weight: 500; font-family: monospace;
      white-space: nowrap;
    }
    .amd-consent-badge::before {
      content: ''; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    }
    .amd-consent-badge.amd-c-ok  { background: #e6f4ea; color: #137333; }
    .amd-consent-badge.amd-c-ok::before  { background: #137333; }
    .amd-consent-badge.amd-c-no  { background: #fce8e6; color: #c5221f; }
    .amd-consent-badge.amd-c-no::before  { background: #c5221f; }
    .amd-consent-badge.amd-c-unk { background: #f1f3f4; color: #5f6368; }
    .amd-consent-badge.amd-c-unk::before { background: #9aa0a6; }

    /* ── Variable display select ── */
    .amd-ta-var-label {
      font: 11px/1 system-ui, sans-serif;
      color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
    }
    #amd-ta-var-display {
      font: 12px/1 system-ui, sans-serif;
      border: 1px solid rgba(229,198,20,.5); border-radius: 6px;
      padding: 3px 5px; background: rgba(255,255,255,.85);
      color: #3c4043; cursor: pointer; flex-shrink: 0; outline: none;
      max-width: 80px; width: 80px;
    }
    #amd-ta-var-display:hover { border-color: rgba(229,198,20,.9); }

    /* ── sGTM Container ID badge ── */
    #amd-ta-container-id {
      display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
      padding: 3px 9px; border-radius: 5px;
      background: #e8f0fe; color: #1967d2;
      border: 1px solid #c5d8fc;
      font: 600 11px/1 monospace;
      cursor: pointer; white-space: nowrap; user-select: none;
      transition: background .12s;
    }
    #amd-ta-container-id:hover { background: #d2e3fc; }
    #amd-ta-container-id .amd-cid-label {
      font: 500 10px/1 system-ui, sans-serif;
      color: #5f6368; letter-spacing: .04em; text-transform: uppercase;
    }
  `
  document.head.appendChild(s)
}

// ── Toolbar (event list) ──────────────────────────────────────────────────────

function injectToolbar() {
  if (document.getElementById(ROOT_ID)?.isConnected) return
  document.getElementById(ROOT_ID)?.remove()

  const list = listContainer()
  if (!list) return

  const root = document.createElement('div')
  root.id = ROOT_ID
  root.innerHTML = `
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${searchSvg(14)}
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`

  const isSGTM = new URLSearchParams(location.search).has('gtm_auth')

  if (isSGTM) {
    // Clean up wrapper from a previous injection attempt if still in the DOM
    const oldWrapper = document.getElementById(SGTM_WRAP_ID)
    if (oldWrapper?.isConnected) {
      if (list.closest(`#${SGTM_WRAP_ID}`)) oldWrapper.insertAdjacentElement('afterend', list)
      oldWrapper.remove()
    }
    // On sGTM, insert the toolbar BEFORE the full-width two-column layout container
    // (.content--debugger-content-component) so it spans both the events column and
    // the details column, exactly like client-side Tag Assistant.
    const contentDiv = document.querySelector<HTMLElement>('.content--debugger-content-component')
    if (contentDiv) {
      contentDiv.insertAdjacentElement('beforebegin', root)
    } else {
      list.prepend(root)
    }
    root.style.position = 'relative'
    root.style.zIndex   = 'auto'  // let sGTM's tag-detail overlays appear on top

    // In sGTM, the right-side tag-detail panel uses a low z-index and gets buried
    // under our sticky sections (PINNED, VAR_ROOT). Override to a safe low value.
    const sgtmZFix = document.createElement('style')
    sgtmZFix.id = 'amd-sgtm-zfix'
    sgtmZFix.textContent = `
      #${ROOT_ID}    { z-index: 2 !important; }
      #${PINNED_ID}  { z-index: 2 !important; }
      #${VAR_ROOT_ID}{ z-index: 2 !important; }
    `
    document.head.appendChild(sgtmZFix)
  } else {
    scrollAncestor(list).prepend(root)
  }

  document.getElementById('amd-ta-search-input')
    ?.addEventListener('input', (e) => {
      filterText = (e.target as HTMLInputElement).value.toLowerCase().trim()
      applyFilter(evRows())
    })

  // Variable display selector
  const varLabel = document.createElement('span')
  varLabel.className = 'amd-ta-var-label'
  varLabel.textContent = 'Variabili:'

  const varSel = document.createElement('select')
  varSel.id = 'amd-ta-var-display'
  varSel.title = 'Modalità visualizzazione variabili nei dettagli tag'
  for (const [val, label] of [['default', 'Default'], ['names', 'Nomi'], ['values', 'Valori']] as const) {
    const opt = document.createElement('option')
    opt.value = val
    opt.textContent = label
    varSel.appendChild(opt)
  }
  varSel.value = varDisplayMode
  varSel.addEventListener('change', () => {
    const v = varSel.value as 'default' | 'names' | 'values'
    varDisplayMode = v
    // Clear applied markers so applyVariableDisplay re-applies with the new mode
    document.querySelectorAll<HTMLElement>('.tag-details__variable-mode[data-amd-var-set]')
      .forEach(el => { delete el.dataset.amdVarSet })
    window.postMessage({ action: 'amd_set_var_display', value: v }, '*')
    if (v !== 'default') applyVariableDisplay()
  })
  root.appendChild(varLabel)
  root.appendChild(varSel)

  updateContainerBadge()
}

// ── Pinned section ────────────────────────────────────────────────────────────

function updatePinnedSection() {
  if (pinnedItems.size === 0) {
    document.getElementById(PINNED_ID)?.remove()
    return
  }

  if (!document.getElementById(PINNED_ID)?.isConnected) {
    document.getElementById(PINNED_ID)?.remove()
    const toolbar = document.getElementById(ROOT_ID)
    if (!toolbar?.isConnected) return
    const section = document.createElement('div')
    section.id = PINNED_ID
    toolbar.insertAdjacentElement('afterend', section)
  }

  const section = document.getElementById(PINNED_ID)!
  section.innerHTML = `<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${pinnedItems.size})</span></div>`

  const rows = evRows()
  for (const [key, name] of pinnedItems) {
    const original = rows.find(r => evIndex(r) === key)
    if (original) {
      const clone = original.cloneNode(true) as HTMLElement
      clone.classList.add('amd-ta-clone')
      clone.removeAttribute('data-amd-pin-added')
      clone.querySelectorAll(`.${PIN_CLS}`).forEach(b => b.remove())
      attachCloneUnpin(clone, key)

      clone.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest(`.${PIN_CLS}`)) return
        e.preventDefault(); e.stopPropagation()
        // Exclude clones inside #PINNED_ID — they share the same class and
        // evIndex, so find() would return the clone itself (already visible)
        // instead of the original row in the list.
        const target = evRows()
          .filter(r => !r.closest(`#${PINNED_ID}`))
          .find(r => evIndex(r) === key)
        if (!target) return
        scrollToRow(target)
        // CSS class flash — adding a class doesn't trigger our childList observer
        // and doesn't cause layout changes that could interrupt the scroll.
        target.classList.add('amd-ta-flash')
        setTimeout(() => target.classList.remove('amd-ta-flash'), 1100)
        // The user can click the row themselves once it's highlighted.
      })

      section.appendChild(clone)
    } else {
      const ph = document.createElement('div')
      ph.className = 'amd-ta-placeholder'
      ph.textContent = `${name} — non in questa pagina`
      section.appendChild(ph)
    }
  }
}

function attachCloneUnpin(row: HTMLElement, key: string) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `${PIN_CLS} ${PIN_ON_CLS}`
  btn.title = 'Rimuovi dai fissati'
  btn.setAttribute('aria-pressed', 'true')
  btn.innerHTML = pinSvg()
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault()
    unpinByKey(key)
  })
  row.appendChild(btn)
}

function unpinByKey(key: string) {
  pinnedItems.delete(key)
  evRows()
    .filter(r => evIndex(r) === key)
    .forEach(r => {
      r.classList.remove(HIGHLIGHT)
      const b = r.querySelector<HTMLButtonElement>(`.${PIN_CLS}`)
      if (b) {
        b.classList.remove(PIN_ON_CLS)
        b.title = 'Fissa in cima'
        b.setAttribute('aria-pressed', 'false')
      }
    })
  updatePinnedSection()
}

// ── Event filter ──────────────────────────────────────────────────────────────

function applyFilter(rows: HTMLElement[]) {
  let visible = 0
  for (const row of rows) {
    const match = !filterText || evName(row).toLowerCase().includes(filterText)
    row.classList.toggle(HIDDEN_CLS, !match)
    if (match) visible++
  }

  const seps = allMatches(SEP_SELECTORS)
  for (const sep of seps) {
    if (!filterText) { sep.classList.remove(HIDDEN_CLS); continue }
    let next = sep.nextElementSibling as HTMLElement | null
    let hasVisible = false
    while (next && next.matches(ROW_SELECTORS[0])) {
      if (!next.classList.contains(HIDDEN_CLS)) { hasVisible = true; break }
      next = next.nextElementSibling as HTMLElement | null
    }
    sep.classList.toggle(HIDDEN_CLS, !hasVisible)
  }

  const countEl = document.getElementById('amd-ta-count')
  if (countEl) {
    if (filterText) {
      countEl.textContent = `${visible} / ${rows.length}`
      countEl.style.display = ''
    } else {
      countEl.style.display = 'none'
    }
  }
}

// ── Pin buttons ───────────────────────────────────────────────────────────────

function addPinButtons(rows: HTMLElement[]) {
  for (const row of rows) {
    if (row.dataset.amdPinAdded) continue
    row.dataset.amdPinAdded = '1'

    const key    = evIndex(row)
    const name   = evName(row)
    const pinned = pinnedItems.has(key)
    if (pinned) row.classList.add(HIGHLIGHT)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `${PIN_CLS}${pinned ? ` ${PIN_ON_CLS}` : ''}`
    btn.title = pinned ? 'Rimuovi dai fissati' : 'Fissa in cima'
    btn.setAttribute('aria-pressed', String(pinned))
    btn.innerHTML = pinSvg()

    btn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault()
      const nowPinned = !pinnedItems.has(key)
      if (nowPinned) {
        pinnedItems.set(key, name)
        row.classList.add(HIGHLIGHT)
        btn.classList.add(PIN_ON_CLS)
        btn.title = 'Rimuovi dai fissati'
        btn.setAttribute('aria-pressed', 'true')
      } else {
        unpinByKey(key)
        return
      }
      updatePinnedSection()
    })

    row.appendChild(btn)
  }
}

// ── Variables search ──────────────────────────────────────────────────────────

/** Returns the <variables-tab> element only when the Variables tab is selected. */
function varTabEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(VAR_TAB_SELECTOR)
}

function injectVarSearch() {
  const tab = varTabEl()

  // Tab hidden or not present → remove search bar if it exists
  if (!tab) {
    document.getElementById(VAR_ROOT_ID)?.remove()
    return
  }

  // Already injected and connected → just re-apply the current filter
  if (document.getElementById(VAR_ROOT_ID)?.isConnected) {
    applyVarFilter(tab)
    return
  }

  document.getElementById(VAR_ROOT_ID)?.remove()

  // Inject before the variable table, inside the card container
  const card = tab.querySelector<HTMLElement>(VAR_CARD_SEL)
  if (!card) return

  const root = document.createElement('div')
  root.id = VAR_ROOT_ID
  root.innerHTML = `
    <div class="amd-ta-brand">
      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#2c2c2a"/>
        <circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/>
        <circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/>
      </svg>
      LayerLens
    </div>
    <div class="amd-ta-searchbox">
      ${searchSvg(13)}
      <input type="search" id="amd-ta-var-input"
             placeholder="Cerca variabile o valore…"
             autocomplete="off" spellcheck="false" />
      <span id="amd-ta-var-count" style="display:none"></span>
    </div>`

  // Prepend to the card so it sits above the table
  card.prepend(root)

  // Restore any existing filter text (user switched tabs and came back)
  const input = root.querySelector<HTMLInputElement>('#amd-ta-var-input')!
  if (varFilterText) input.value = varFilterText

  input.addEventListener('input', (e) => {
    varFilterText = (e.target as HTMLInputElement).value.toLowerCase().trim()
    const t = varTabEl()
    if (t) applyVarFilter(t)
  })

  applyVarFilter(tab)
}

function applyVarFilter(tab: HTMLElement) {
  const rows = Array.from(tab.querySelectorAll<HTMLElement>(VAR_ROW_SEL))
  let visible = 0
  for (const row of rows) {
    const name  = row.querySelector(VAR_NAME_SEL)?.textContent?.toLowerCase()  ?? ''
    const value = row.querySelector(VAR_VALUE_SEL)?.textContent?.toLowerCase() ?? ''
    const match = !varFilterText || name.includes(varFilterText) || value.includes(varFilterText)
    row.classList.toggle(VAR_HIDDEN_CLS, !match)
    if (match) visible++
  }
  const countEl = document.getElementById('amd-ta-var-count')
  if (countEl) {
    if (varFilterText && rows.length > 0) {
      countEl.textContent = `${visible} / ${rows.length}`
      countEl.style.display = ''
    } else {
      countEl.style.display = 'none'
    }
  }
}

// ── Event Data copy button ────────────────────────────────────────────────────

const CLIP_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M7 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/></svg>`

function injectEventDataCopyBtn() {
  const tab = document.querySelector<HTMLElement>(EDV_TAB_SEL)
  if (!tab) {
    document.getElementById(EDV_ROOT_ID)?.remove()
    return
  }
  if (document.getElementById(EDV_ROOT_ID)?.isConnected) return
  document.getElementById(EDV_ROOT_ID)?.remove()

  // Event Data tab structure: event-data-tab > .event-data > .event-data__header + event-data-table
  const eventDataDiv = tab.querySelector<HTMLElement>('.event-data')
  if (!eventDataDiv) return
  const header = eventDataDiv.querySelector<HTMLElement>('.event-data__header')
  if (!header) return

  const root = document.createElement('div')
  root.id = EDV_ROOT_ID

  const brand = document.createElement('div')
  brand.className = 'amd-ta-brand'
  brand.innerHTML = `<svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#2c2c2a"/><circle cx="10" cy="10" r="5" fill="none" stroke="#e5c614" stroke-width="2"/><circle cx="12.8" cy="7.2" r="1.6" fill="#e5c614"/></svg>LayerLens`

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.className = 'amd-edv-copy-btn'
  copyBtn.title = 'Copia tutti i campi evento come JSON — incollalo nel wizard "Da evento server" in GTM'

  const setNormal = () => { copyBtn.innerHTML = CLIP_SVG + ' Copia JSON' }
  setNormal()

  copyBtn.addEventListener('click', () => {
    const rows = Array.from(tab.querySelectorAll<HTMLElement>(VAR_ROW_SEL))
    // Keys are in td.gtm-debug-table-cell:first-child > pre; values are CodeMirror-rendered
    // so we use null — the wizard only needs the key names anyway
    const obj: Record<string, null> = {}
    for (const row of rows) {
      const key = row.querySelector<HTMLElement>('td.gtm-debug-table-cell:first-child pre')?.textContent?.trim()
      if (key) obj[key] = null
    }
    if (Object.keys(obj).length === 0) {
      copyBtn.textContent = 'Nessun campo'
      setTimeout(setNormal, 1500)
      return
    }
    void navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
      .then(() => { copyBtn.textContent = '✓ Copiato!'; setTimeout(setNormal, 1500) })
      .catch(() => { copyBtn.textContent = 'Errore'; setTimeout(setNormal, 1500) })
  })

  root.append(brand, copyBtn)
  header.after(root)
}

// ── Tag Type Coloring & Failed Tag Highlighting ──────────────────────────────

const TAG_TYPE_RULES: Array<{ re: RegExp; color: string }> = [
  { re: /Google Tag|Google Analytics 4|Google Analytics|GA4/i, color: '#EEA849' },
  { re: /Google Ads/i,                                          color: '#4285F4' },
  { re: /Facebook|Meta Pixel|Meta Conv/i,                       color: '#1877F2' },
  { re: /TikTok/i,                                              color: '#010101' },
  { re: /LinkedIn/i,                                            color: '#0A66C2' },
  { re: /Pinterest/i,                                           color: '#E60023' },
  { re: /Microsoft Ads|Bing Ads/i,                              color: '#00809D' },
  { re: /Snapchat/i,                                            color: '#FFFC00' },
  { re: /Klaviyo/i,                                             color: '#3D8D4E' },
  { re: /Twitter|X Ads/i,                                       color: '#1DA1F2' },
]

function colorTagCards() {
  const cards = document.querySelectorAll<HTMLElement>('.gtm-debug-card')
  for (const card of cards) {
    // Already colored/failed → permanent, skip
    if (card.classList.contains('amd-tag-colored') || card.classList.contains('amd-tag-failed')) continue
    // Explicitly marked as no known vendor → skip
    if (card.dataset.amdCard === 'skip') continue

    const typeText = (
      card.querySelector('.gtm-debug-card__subtitle, .gtm-debug-card__description, [class*="subtitle"], [class*="type-name"]')
        ?.textContent?.trim() ?? ''
    )
    const cardText = card.textContent ?? ''

    // Angular hasn't rendered the type text yet → don't permanently skip, retry next sync
    if (!typeText && !cardText.trim()) continue

    const isFailed =
      /\bfailed\b/i.test(cardText) ||
      !!card.querySelector('[class*="failed"], [class*="exception"]')
    if (isFailed) {
      card.classList.add('amd-tag-failed')
      continue
    }

    // Match against typeText first, then full cardText as fallback
    let matched = false
    for (const { re, color } of TAG_TYPE_RULES) {
      if (re.test(typeText) || re.test(cardText)) {
        card.style.setProperty('--amd-tag-color', color)
        card.classList.add('amd-tag-colored')
        matched = true
        break
      }
    }
    // Only skip permanently when the subtitle is already loaded but no vendor matched.
    // If typeText is empty the subtitle hasn't rendered yet → retry on next sync.
    if (!matched && typeText) card.dataset.amdCard = 'skip'
  }
}

// ── JSON Auto-formatter ───────────────────────────────────────────────────────

function syntaxHighlight(json: string): string {
  const safe = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return safe.replace(
    /("(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = 'amd-json-num'
      if (match.startsWith('"')) {
        cls = match.endsWith(':') ? 'amd-json-key' : 'amd-json-str'
      } else if (match === 'true' || match === 'false') {
        cls = 'amd-json-bool'
      } else if (match === 'null') {
        cls = 'amd-json-null'
      }
      return `<span class="${cls}">${match}</span>`
    },
  )
}

// Selectors for HTTP body cells — covers both client-side and server-side Tag Assistant.
// sGTM "HTTP Outgoing" uses different component names than client-side.
const JSON_CELL_SEL = [
  '.gtm-debug-table-cell--http-body pre',  // client-side Tag Assistant (inline body cell)
  'pre[data-ng-bind*="getBody"]',           // sGTM modal: Angular binding ctrl.getBody()
  'http-url-details pre',                   // sGTM HTTP Outgoing custom element (URL — skipped if not JSON)
  '[class*="http-body"] pre',               // wildcard fallback
  '[class*="outgoing-request"] pre',
  '[class*="outgoing-http"] pre',
  '[class*="request-body"] pre',
].join(', ')

function formatJsonCells() {
  const cells = document.querySelectorAll<HTMLElement>(JSON_CELL_SEL)
  for (const pre of cells) {
    if (pre.dataset.amdJsonSkip) continue
    if (pre.classList.contains('amd-json-fmt') && pre.children.length > 0) continue
    const raw = pre.textContent?.trim() ?? ''
    if (raw.length > 200_000) continue
    if (!raw.startsWith('{') && !raw.startsWith('[')) continue
    try {
      const parsed = JSON.parse(raw)
      const pretty = JSON.stringify(parsed, null, 2)
      let btn = pre.parentElement?.querySelector<HTMLButtonElement>(':scope > .amd-json-copy')
      if (!btn) {
        btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'amd-json-copy'
        pre.insertAdjacentElement('beforebegin', btn)
      }
      const capturedPretty = pretty
      btn.textContent = 'Copia JSON'
      btn.onclick = (e: MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(capturedPretty).then(() => {
          btn!.textContent = '✓ Copiato'
          setTimeout(() => { btn!.textContent = 'Copia JSON' }, 1500)
        }).catch(() => {
          btn!.textContent = '✗ Errore'
          setTimeout(() => { btn!.textContent = 'Copia JSON' }, 1500)
        })
      }
      pre.innerHTML = syntaxHighlight(pretty)
      pre.classList.add('amd-json-fmt')
      pre.style.whiteSpace = 'pre-wrap'
      pre.style.wordBreak = 'break-all'
    } catch {
      pre.dataset.amdJsonSkip = '1'
    }
  }
}

// ── Consent Mode Monitor ─────────────────────────────────────────────────────

/**
 * Decodes gtm_session_consent_mode pipe-separated format used in the
 * Properties > Event Settings Variable JSON (e.g. "denied|denied|granted").
 * Order matches GCS_LABELS: ad_storage | analytics_storage | ad_user_data | ad_personalization.
 */
function decodeConsentMode(raw: string): ConsentSignal[] | null {
  const parts = raw.trim().split('|').filter(Boolean)
  if (!parts.length) return null
  return parts.slice(0, GCS_LABELS.length).map((val, i) => ({
    name: GCS_LABELS[i],
    state: val.trim() === 'granted' ? 'ok' : val.trim() === 'denied' ? 'no' : 'unk',
  }))
}

function makeConsentBadges(signals: ConsentSignal[]): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'amd-consent-badges'
  for (const s of signals) {
    const b = document.createElement('span')
    b.className = `amd-consent-badge amd-c-${s.state}`
    b.textContent = s.name
    b.title = s.state === 'ok' ? 'granted' : s.state === 'no' ? 'denied' : 'unknown'
    wrap.appendChild(b)
  }
  return wrap
}

// ── Consent: tag-details Properties section (client-side TA) ─────────────────

/**
 * Injects consent badges in the Properties section of the tag-details sheet.
 *
 * DOM structure (confirmed via debug):
 *   tag-details                          ← Angular component for the tag detail sheet
 *     div.gtm-sheet-card
 *       div.gtm-debug-pane-header        ← "Properties" section label
 *       table.tag-details__properties-table
 *         td[class*="property-cell"]     ← each property row
 *           div[class*="property-name"]  ← param name (may contain "gcs")
 *           div[class*="property-value"] ← param value
 *       gtag-hits-ng                     ← "Hits sent" section (fallback source)
 *
 * We try to read gcs from (in order):
 *   1. td[class*="property-cell"] in the Properties table
 *   2. span.param-chip inside gtag-hits-ng
 *   3. Any td/cell with text "gcs" in the whole tag-details component
 *
 * Badge is injected immediately after the "Properties" pane header.
 */
function formatConsentBadges() {
  const tagDetails = document.querySelectorAll<HTMLElement>('tag-details')

  for (const tagDetail of tagDetails) {
    if (tagDetail.dataset.amdConsentDone) continue

    let signals: ConsentSignal[] | null = null

    // ── 0. gtm_session_consent_mode in Event Settings Variable JSON ───────
    // Visible in Properties table as part of the JSON value block.
    // Format: "granted|denied|..." pipe-separated, order = GCS_LABELS.
    if (!signals) {
      const propsTable = tagDetail.querySelector<HTMLElement>(
        'table[class*="properties-table"], .tag-details__properties-table',
      )
      if (propsTable) {
        const text = propsTable.textContent ?? ''
        const m = text.match(/gtm_session_consent_mode\s*:\s*"([^"]+)"/)
        if (m) signals = decodeConsentMode(m[1])
      }
    }

    // ── 1. gcs in Properties table cells (standalone row) ─────────────────
    if (!signals) {
      const propCells = tagDetail.querySelectorAll<HTMLElement>('td[class*="property-cell"]')
      for (const cell of propCells) {
        if (cell.dataset.amdGcsRead) continue
        const nameEl = cell.querySelector<HTMLElement>('[class*="property-name"]')
        const nameText = nameEl?.textContent?.trim() ?? cell.textContent?.trim() ?? ''
        if (!/^\s*gcs\s*$/i.test(nameText)) continue
        cell.dataset.amdGcsRead = '1'
        const valEl = cell.querySelector<HTMLElement>('[class*="property-value"]')
        const val = valEl?.textContent?.trim() ?? cell.nextElementSibling?.textContent?.trim() ?? ''
        if (/^G\d+/i.test(val)) { signals = decodeGcs(val); break }
      }
    }

    // ── 2. param-chip spans inside gtag-hits-ng ───────────────────────────
    if (!signals) {
      const hitsEl = tagDetail.querySelector<HTMLElement>('gtag-hits-ng')
      if (hitsEl) {
        const chips = hitsEl.querySelectorAll<HTMLElement>('span.param-chip, [class*="param-chip"]')
        for (const chip of chips) {
          if (chip.dataset.amdGcsRead) continue
          if (chip.textContent?.trim() !== 'gcs') continue
          chip.dataset.amdGcsRead = '1'
          const valueTd = chip.closest('td')?.nextElementSibling as HTMLElement | null
          const val = valueTd?.textContent?.trim() ?? ''
          if (/^G\d+/i.test(val)) { signals = decodeGcs(val); break }
        }
      }
    }

    // ── 3. Broad fallback: any td/cell with text "gcs" ────────────────────
    if (!signals) {
      const allCells = tagDetail.querySelectorAll<HTMLElement>(
        'td, [class*="table-cell"], [class*="TableCell"]',
      )
      for (const cell of allCells) {
        if (cell.dataset.amdGcsRead) continue
        if (!/^\s*gcs\s*$/.test(cell.textContent ?? '')) continue
        cell.dataset.amdGcsRead = '1'
        const valueCell = cell.nextElementSibling as HTMLElement | null
        const val = valueCell?.textContent?.trim() ?? ''
        if (/^G\d+/i.test(val)) { signals = decodeGcs(val); break }
      }
    }

    if (!signals) continue

    tagDetail.dataset.amdConsentDone = '1'

    // Build badge row
    const wrap = makeConsentBadges(signals)
    wrap.style.cssText = 'padding:4px 14px 7px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;'
    const label = document.createElement('span')
    label.textContent = 'Consent:'
    label.style.cssText = 'font:600 10px/1 system-ui,sans-serif; color:#5f6368; text-transform:uppercase; letter-spacing:.06em; flex-shrink:0;'
    wrap.prepend(label)

    // Inject immediately after the "Properties" pane header
    const propsHeader = [...tagDetail.querySelectorAll<HTMLElement>('[class*="pane-header"]')]
      .find(el => /^\s*properties\s*$/i.test(el.textContent ?? ''))

    if (propsHeader) {
      const parent = propsHeader.parentElement!
      parent.classList.add('amd-consent-host')
      propsHeader.insertAdjacentElement('afterend', wrap)
    } else {
      // Fallback: top of sheet card
      const target = tagDetail.querySelector<HTMLElement>('.gtm-sheet-card, .sheet-content') ?? tagDetail
      target.classList.add('amd-consent-host')
      target.prepend(wrap)
    }
  }
}

// ── URL parameter formatter ───────────────────────────────────────────────────

// Targets the URL cell adjacent to the method cell in http-url-details (sGTM)
// and in the HTTP Request Details modal. Parses query params into a table.
const URL_CELL_SEL = '.gtm-debug-table-cell--query-param + .gtm-debug-table-cell pre'

function formatUrlCells() {
  const cells = document.querySelectorAll<HTMLElement>(URL_CELL_SEL)
  for (const pre of cells) {
    if (pre.dataset.amdUrlFmt) continue
    const raw = pre.textContent?.trim() ?? ''
    if (!raw.startsWith('http')) continue

    const qIdx = raw.indexOf('?')
    if (qIdx === -1) { pre.dataset.amdUrlFmt = 'skip'; continue }

    try {
      const url = new URL(raw)
      const params = [...url.searchParams.entries()]
      if (params.length === 0) { pre.dataset.amdUrlFmt = 'skip'; continue }

      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      const container = document.createElement('div')
      container.className = 'amd-url-fmt'

      // Header: base URL + copy button
      const hdr = document.createElement('div')
      hdr.className = 'amd-url-fmt-header'
      const base = document.createElement('span')
      base.className = 'amd-url-fmt-base'
      base.textContent = url.origin + url.pathname
      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'amd-json-copy'
      copyBtn.textContent = 'Copia URL'
      copyBtn.onclick = (e: MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(raw).then(() => {
          copyBtn.textContent = '✓ Copiato'
          setTimeout(() => { copyBtn.textContent = 'Copia URL' }, 1500)
        }).catch(() => {
          copyBtn.textContent = '✗ Errore'
          setTimeout(() => { copyBtn.textContent = 'Copia URL' }, 1500)
        })
      }
      hdr.appendChild(base)
      hdr.appendChild(copyBtn)
      container.appendChild(hdr)

      // Parameters table
      const table = document.createElement('table')
      table.className = 'amd-url-params'
      for (const [key, value] of params) {
        const tr = document.createElement('tr')
        let decoded = value
        try { decoded = decodeURIComponent(value) } catch { /* keep raw */ }
        tr.innerHTML = `<td class="amd-url-key">${esc(key)}</td><td class="amd-url-val">${esc(decoded)}</td>`
        table.appendChild(tr)

        // Consent Mode Monitor: decode gcs inline
        if (key === 'gcs') {
          const signals = decodeGcs(value)
          if (signals) {
            const consentRow = document.createElement('tr')
            const td = document.createElement('td')
            td.colSpan = 2
            td.style.padding = '2px 10px 6px'
            td.appendChild(makeConsentBadges(signals))
            consentRow.appendChild(td)
            table.appendChild(consentRow)
          }
        }
      }
      container.appendChild(table)

      pre.insertAdjacentElement('beforebegin', container)
      pre.style.display = 'none'
      pre.dataset.amdUrlFmt = '1'
    } catch {
      pre.dataset.amdUrlFmt = 'skip'
    }
  }
}

// ── sGTM Container ID badge ───────────────────────────────────────────────────

function updateContainerBadge() {
  if (!gtmContainerId) return
  const root = document.getElementById(ROOT_ID)
  if (!root?.isConnected) return

  let badge = document.getElementById('amd-ta-container-id') as HTMLButtonElement | null
  if (!badge) {
    badge = document.createElement('button')
    badge.id = 'amd-ta-container-id'
    badge.type = 'button'
    badge.title = 'ID container sGTM — clicca per copiare'
    root.appendChild(badge)
  }

  const label = document.createElement('span')
  label.className = 'amd-cid-label'
  label.textContent = 'sGTM'
  badge.replaceChildren(label, document.createTextNode(' ' + gtmContainerId))

  badge.onclick = () => {
    navigator.clipboard.writeText(gtmContainerId).then(() => {
      badge!.replaceChildren(label.cloneNode(true), document.createTextNode(' ✓ Copiato'))
      setTimeout(() => updateContainerBadge(), 1500)
    }).catch(() => {})
  }
}

// Receive GTM_IDENTIFIER relayed from the content script (sGTM preview pages).
window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window) return
  const d = e.data as { code?: string; data?: { containerId?: string } } | null
  if (!d || typeof d !== 'object') return
  if (d.code === 'GTM_IDENTIFIER' && typeof d.data?.containerId === 'string') {
    gtmContainerId = d.data.containerId
    updateContainerBadge()
  }
})

// On tagassistant.google.com the container ID is NOT in the page URL and there
// are no direct requests to the sGTM server from this tab.  Instead, Tag
// Assistant polls a get_memo endpoint whose JSON response contains
// REQUEST_SUMMARY messages with the sGTM request headers — including
// x-gtm-identifier.  We intercept that XHR to extract the ID.
if (location.hostname === 'tagassistant.google.com') {
  const _origOpen = XMLHttpRequest.prototype.open
  const _origSend = XMLHttpRequest.prototype.send

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(XMLHttpRequest.prototype as any).open = function(
    method: string, url: string | URL, ...rest: unknown[]
  ) {
    ;(this as any)._amdUrl = String(url)
    return (_origOpen as (...a: unknown[]) => unknown).apply(this, [method, url, ...rest])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(XMLHttpRequest.prototype as any).send = function(...args: unknown[]) {
    const url: string = (this as any)._amdUrl ?? ''
    if (url.includes('get_memo?id=')) {
      this.addEventListener('load', function(this: XMLHttpRequest) {
        try {
          let text = this.responseText
          // Strip Google's JSONP protection prefix `)]}'` + optional newline
          if (text.startsWith(")]}'")) text = text.slice(4)
          if (!text.trim()) return
          const data = JSON.parse(text) as Record<string, unknown>
          for (const key of Object.keys(data)) {
            const messages = data[key]
            if (!Array.isArray(messages)) continue
            for (const msg of messages as Record<string, unknown>[]) {
              if (msg['messageType'] === 'REQUEST_SUMMARY') {
                const headers = (msg['request'] as Record<string, unknown> | null)?.['headers']
                const id = (headers as Record<string, string> | null)?.['x-gtm-identifier']
                if (typeof id === 'string' && id) {
                  gtmContainerId = id
                  updateContainerBadge()
                  // Restore originals — no need to keep intercepting once we have the ID.
                  XMLHttpRequest.prototype.open = _origOpen
                  ;(XMLHttpRequest.prototype as any).send = _origSend
                  return
                }
              }
            }
          }
        } catch { /* ignore parse errors */ }
      })
    }
    return (_origSend as (...a: unknown[]) => unknown).apply(this, args)
  }
}

// ── Auto-expand "Show More" in tag detail sheets ──────────────────────────────

/**
 * When a tag detail sheet opens, GTM collapses extra properties behind a
 * "Show More" toggle. This clicks it automatically on first appearance.
 *
 * The dataset flag prevents double-clicking before Angular processes the first
 * click. It is cleared whenever the element shows "Show Less" (i.e. Angular
 * recycled the node for a new detail sheet that starts collapsed).
 */
function autoExpandShowMore() {
  const els = document.querySelectorAll<HTMLElement>('.tag-details__show-more')
  for (const el of els) {
    const text = el.textContent?.toLowerCase() ?? ''
    const isShowMore = text.includes('show more') || text.includes('mostra di più')
    if (!isShowMore) {
      // "Show Less" / empty — reset flag so the next tag detail auto-expands
      delete el.dataset.amdAutoExpanded
      continue
    }
    if (el.dataset.amdAutoExpanded) continue
    el.dataset.amdAutoExpanded = '1'
    el.click()
  }
}

// ── Auto-apply variable display mode in tag detail sheets ─────────────────────

/**
 * When varDisplayMode is 'names' or 'values', automatically sets the
 * corresponding radio button in the tag detail variable-mode section.
 * The dataset marker prevents re-dispatching on every sync() call.
 * It is cleared when the user changes the select (so all open sheets update).
 */
function applyVariableDisplay() {
  if (varDisplayMode === 'default') return
  const modes = document.querySelectorAll<HTMLElement>('.tag-details__variable-mode')
  for (const mode of modes) {
    if (mode.dataset.amdVarSet === varDisplayMode) continue
    const input = mode.querySelector<HTMLInputElement>(`form input[value="${varDisplayMode}"]`)
    if (!input) continue
    if (!input.checked) {
      const otherVal = varDisplayMode === 'values' ? 'names' : 'values'
      const other = mode.querySelector<HTMLInputElement>(`form input[value="${otherVal}"]`)
      if (other) other.checked = false
      input.checked = true
      input.dispatchEvent(new Event('click', { bubbles: true }))
    }
    mode.dataset.amdVarSet = varDisplayMode
  }
}

// ── Main sync ─────────────────────────────────────────────────────────────────


/** Idempotent: safe on every Angular re-render. */
function sync() {
  injectStyles()

  // Event list panel
  if (firstMatch(ROW_SELECTORS)) {
    injectToolbar()
    const rows = evRows()
    addPinButtons(rows)
    applyFilter(rows)
    requestAnimationFrame(updatePinnedSection)
  }

  // Variables tab panel (independent injection point)
  injectVarSearch()

  // Event Data tab copy button (sGTM)
  injectEventDataCopyBtn()

  // Tag detail enhancements
  autoExpandShowMore()
  applyVariableDisplay()

  // Tag type coloring + failed highlighting + JSON formatter + URL param formatter
  colorTagCards()
  formatJsonCells()
  formatUrlCells()
  formatConsentBadges()
}

let scheduled = false
let discovered = false
const observer = new MutationObserver((muts) => {
  const ours = muts.every((m) => {
    const t = m.target as HTMLElement
    return !!t.closest?.(`#${ROOT_ID}, #${PINNED_ID}, #${VAR_ROOT_ID}, #${EDV_ROOT_ID}, #amd-ta-style, .amd-json-copy, .amd-url-fmt, .amd-gcs-val, .amd-consent-host`)
  })
  if (ours || scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    if (!discovered && firstMatch(ROW_SELECTORS)) {
      discovered = true
      discoverAndLog()
    }
    sync()
  })
})
observer.observe(document.body, { childList: true, subtree: true })
sync()
