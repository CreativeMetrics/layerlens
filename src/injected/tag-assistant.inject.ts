// Runs in the PAGE world on tagassistant.google.com
// Features: event search, event pin, variable search.
//
// SCROLL STRATEGY FOR PINNED EVENTS
// The real scroll container is .message-list__scrollpane (a *child* of .message-list,
// NOT an ancestor). scrollAncestor() walks UP and misses it — it lands on the page's
// main scroll container instead. We inject the toolbar directly into .message-list__scrollpane;
// then ROOT_ID.parentElement === .message-list__scrollpane === the correct scrollEl.

const ROOT_ID        = 'amd-ta-root'
const PINNED_ID      = 'amd-ta-pinned'
const VAR_ROOT_ID    = 'amd-ta-var-root'
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
    if (overflowY === 'auto' || overflowY === 'scroll') return p
    p = p.parentElement
  }
  return el.parentElement ?? document.body
}

function evRows(): HTMLElement[] { return allMatches(ROW_SELECTORS) }

/**
 * Scroll a list row into view, correctly accounting for our sticky headers.
 *
 * Strategy: getBoundingClientRect on both the scroll container and the target
 * gives viewport-relative positions that are always accurate, even when the
 * target is above or below the visible area. The delta between them tells us
 * exactly how much to adjust scrollTop. No offsetParent chain, no scrollIntoView
 * ancestor-resolution ambiguity.
 *
 * Previous failures:
 *   v1 (getBoundingClientRect + smooth): smooth is async → got cancelled;
 *      target.click() also interrupted it; clones gave near-zero delta.
 *   v2 (offsetTop chain): offsetParent skips position:static ancestors →
 *      offset became relative to <body>, not scrollEl.
 *   v3 (scrollIntoView + scrollBy): scrollIntoView resolves to the nearest
 *      scrollable ancestor of the TARGET, which may differ from scrollEl if
 *      .message-list itself is overflow:auto; scrollBy then acts on the wrong el.
 *
 *   Now fixed: no smooth, no click(), clone filter in caller, explicit scrollEl.
 */
function scrollToRow(target: HTMLElement) {
  const root     = document.getElementById(ROOT_ID)
  const scrollEl = root?.parentElement
  if (!scrollEl) return

  const stickyH = (root.offsetHeight ?? 46)
                + (document.getElementById(PINNED_ID)?.offsetHeight ?? 0)
                + 8

  // getBoundingClientRect is always viewport-relative and accurate for
  // off-screen elements (they simply have top < 0 or top > window.innerHeight).
  // delta = distance from the container's visible top to where we want the row.
  const containerTop = scrollEl.getBoundingClientRect().top
  const targetTop    = target.getBoundingClientRect().top
  const delta        = targetTop - containerTop - stickyH

  // Instant (no behavior param) → synchronous, not cancellable.
  scrollEl.scrollTop += delta
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
  `
  document.head.appendChild(s)
}

// ── Toolbar (event list) ──────────────────────────────────────────────────────

function injectToolbar() {
  if (document.getElementById(ROOT_ID)?.isConnected) return
  document.getElementById(ROOT_ID)?.remove()

  // .message-list__scrollpane is the *real* scroll container (confirmed from DOM).
  // It is a child of .message-list, so scrollAncestor() (which walks UP) misses it
  // and ends up on the page's main scroll container — that's why every previous
  // scrollTop attempt scrolled the main page instead of the sidebar.
  //
  // Injecting the toolbar here with position:sticky;top:0 makes it stick to the
  // top of the scrollpane, and ROOT_ID.parentElement becomes the correct scrollEl.
  const scrollpane = document.querySelector<HTMLElement>('.message-list__scrollpane')
  if (!scrollpane) return

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
  scrollpane.prepend(root)

  document.getElementById('amd-ta-search-input')
    ?.addEventListener('input', (e) => {
      filterText = (e.target as HTMLInputElement).value.toLowerCase().trim()
      applyFilter(evRows())
    })
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
}

let scheduled = false
let discovered = false
const observer = new MutationObserver((muts) => {
  const ours = muts.every((m) => {
    const t = m.target as HTMLElement
    return !!t.closest?.(`#${ROOT_ID}, #${PINNED_ID}, #${VAR_ROOT_ID}, #amd-ta-style`)
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
