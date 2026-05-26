// Runs in the PAGE world on tagassistant.google.com
// Adds a search bar and event-pin feature to the GTM debug event list.
//
// SELECTOR DISCOVERY STRATEGY
// Rather than hardcoding a single CSS selector (which breaks whenever Google
// renames classes), we use a three-tier approach:
//   1. BEM block selector (.message-list) — stable as long as the naming convention holds.
//   2. Fallback via parentElement traversal from a known __element selector.
//   3. Runtime discovery: at startup we scan the DOM and log candidates to the
//      console so that updating selectors is a one-line change, not a DOM safari.
//
// POSITIONING STRATEGY
// Inserting the toolbar "before" the list container (beforebegin) only works
// if the insertion point is static. In Angular SPAs the list is rebuilt on
// every route change, so "beforebegin" nodes end up in the middle.
//
// Fix: walk up to the SCROLL CONTAINER (first ancestor with overflow:auto/scroll)
// and prepend() the toolbar there. The scroll container is always present and
// unmanaged by Angular, so prepend is permanent. With position:sticky;top:0 the
// toolbar stays pinned to the top of the scroll area regardless of list rebuilds.

const ROOT_ID    = 'amd-ta-root'
const PINNED_ID  = 'amd-ta-pinned'
const HIDDEN_CLS = 'amd-ta-hidden'
const PIN_CLS    = 'amd-ta-pin-btn'
const PIN_ON_CLS = 'amd-ta-pin-on'
const HIGHLIGHT  = 'amd-ta-hl'

/** Lowercase event names the user has pinned. Module-level = survives Angular re-renders. */
const pinnedNames = new Set<string>()
let filterText = ''

// ── Selector discovery ───────────────────────────────────────────────────────

/** Candidates in priority order. First match wins. */
const LIST_SELECTORS = [
  '.message-list',                          // BEM block (most stable)
  '[class*="message-list"]',                // substring match (fallback)
  '.messages-panel',                        // alternative naming
]

const ROW_SELECTORS = [
  '.message-list__row--indented',           // confirmed from DOM inspection
  '[class*="message-list__row"][class*="indented"]',
  '[class*="message-list__row--indented"]',
]

const SEP_SELECTORS = [
  '.message-list__row:not(.message-list__row--indented)',
  '[class*="message-list__row"]:not([class*="indented"])',
]

/** Runs once at startup; logs available selectors to the console so updating
 *  them later is trivial ("search for amd-ta-discovery in DevTools"). */
function discoverAndLog() {
  const results: string[] = []

  for (const sel of LIST_SELECTORS) {
    const n = document.querySelectorAll(sel).length
    if (n) results.push(`list container: "${sel}" (${n} found)`)
  }
  for (const sel of ROW_SELECTORS) {
    const n = document.querySelectorAll(sel).length
    if (n) results.push(`event row: "${sel}" (${n} found)`)
  }
  if (results.length) {
    console.groupCollapsed('[LayerLens] Tag Assistant selector discovery')
    results.forEach(r => console.log(r))
    console.groupEnd()
  }
}

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

// ── DOM helpers ──────────────────────────────────────────────────────────────

function evName(row: HTMLElement): string {
  return (
    row.querySelector<HTMLElement>('.message-list__title span[title]')
       ?.getAttribute('title')?.trim() ?? ''
  )
}

function listContainer(): HTMLElement | null {
  const direct = firstMatch(LIST_SELECTORS)
  if (direct) return direct
  // Fallback: parent of first event row
  return firstMatch(ROW_SELECTORS)?.parentElement ?? null
}

/** Walk up to the first scrollable ancestor. This element is stable across
 *  Angular SPA route changes — a safe permanent insertion point. */
function scrollAncestor(el: HTMLElement): HTMLElement {
  let p = el.parentElement
  while (p && p !== document.body) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
    p = p.parentElement
  }
  return el.parentElement ?? document.body
}

function evRows(): HTMLElement[] {
  return allMatches(ROW_SELECTORS)
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pinSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>`
}

// ── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('amd-ta-style')) return
  const s = document.createElement('style')
  s.id = 'amd-ta-style'
  s.textContent = `
    .${HIDDEN_CLS} { display: none !important; }

    /* ── Toolbar ── sticky top, brand-tinted so it's clearly "LayerLens" */
    #${ROOT_ID} {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px;
      background: #fffdf0;
      border-bottom: 2px solid #e5c614;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-ta-searchbox {
      display: flex; align-items: center; gap: 7px; flex: 1;
      background: rgba(255,255,255,.75); border-radius: 8px; padding: 6px 10px;
      border: 1px solid rgba(229,198,20,.45);
    }
    .amd-ta-searchbox svg { flex-shrink: 0; color: #9aa0a6; }
    .amd-ta-searchbox input {
      flex: 1; border: none; background: none; outline: none;
      font: inherit; color: #202124;
    }
    .amd-ta-searchbox input::-webkit-search-cancel-button { -webkit-appearance: none; }
    #amd-ta-count {
      font-size: 11px; color: #7a6f1a; flex-shrink: 0; white-space: nowrap;
      background: rgba(229,198,20,.25); padding: 2px 7px; border-radius: 10px;
    }

    /* ── Pin button on each event row ── */
    .message-list__row--indented { position: relative; }
    .${PIN_CLS} {
      display: none;
      position: absolute; right: 30px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; color: #9aa0a6; line-height: 0;
      transition: color .12s, background .12s;
    }
    .message-list__row--indented:hover .${PIN_CLS},
    .${PIN_CLS}.${PIN_ON_CLS} { display: inline-flex; }
    .${PIN_CLS}:hover { color: #202124; background: rgba(0,0,0,.07); }
    .${PIN_CLS}.${PIN_ON_CLS} { color: #c9ad07; }
    .${HIGHLIGHT} { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── Pinned section — sticky below toolbar, clearly branded ── */
    #${PINNED_ID} {
      position: sticky; top: 45px; z-index: 99;
      background: #fffdf0;
      border-bottom: 2px solid rgba(229,198,20,.5);
    }
    .amd-ta-pin-sep {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 10px 4px;
      font-size: 10px; font-weight: 700; letter-spacing: .07em;
      text-transform: uppercase; font-family: system-ui, sans-serif;
      color: #7a6f1a;
    }
    /* small pin icon before the label */
    .amd-ta-pin-sep::before {
      content: '';
      display: inline-block; width: 10px; height: 10px; flex-shrink: 0;
      background: #e5c614; border-radius: 2px;
    }

    /* cloned pinned rows */
    .amd-ta-clone {
      background: rgba(229,198,20,.13) !important;
      border-left: 3px solid #e5c614 !important;
      box-shadow: none !important;
    }
    .amd-ta-clone:hover { background: rgba(229,198,20,.2) !important; }
    .amd-ta-clone .${PIN_CLS} { display: inline-flex !important; color: #c9ad07; }
    .amd-ta-placeholder {
      padding: 7px 12px; font-size: 12px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `
  document.head.appendChild(s)
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function injectToolbar() {
  // Re-inject if disconnected (Angular may have rebuilt the scroll container).
  if (document.getElementById(ROOT_ID)?.isConnected) return
  document.getElementById(ROOT_ID)?.remove()

  const list = listContainer()
  if (!list) return
  const scroll = scrollAncestor(list)

  const root = document.createElement('div')
  root.id = ROOT_ID
  root.innerHTML = `
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`
  // prepend inside the scroll container so sticky:top works correctly
  scroll.prepend(root)

  document.getElementById('amd-ta-search-input')
    ?.addEventListener('input', (e) => {
      filterText = (e.target as HTMLInputElement).value.toLowerCase().trim()
      applyFilter(evRows())
    })
}

// ── Pinned section ───────────────────────────────────────────────────────────

function updatePinnedSection() {
  if (pinnedNames.size === 0) {
    document.getElementById(PINNED_ID)?.remove()
    return
  }

  // Re-create if disconnected (e.g. after Angular re-render).
  if (!document.getElementById(PINNED_ID)?.isConnected) {
    document.getElementById(PINNED_ID)?.remove()
    const toolbar = document.getElementById(ROOT_ID)
    if (!toolbar?.isConnected) return  // toolbar not ready yet

    const section = document.createElement('div')
    section.id = PINNED_ID
    toolbar.insertAdjacentElement('afterend', section)
  }

  const section = document.getElementById(PINNED_ID)!
  section.innerHTML = `<div class="amd-ta-pin-sep">Fissati&nbsp;<span style="font-weight:400;opacity:.7">(${pinnedNames.size})</span></div>`

  const rows = evRows()
  for (const name of pinnedNames) {
    const original = [...rows].reverse().find(r => evName(r).toLowerCase() === name)
    if (original) {
      const clone = original.cloneNode(true) as HTMLElement
      clone.classList.add('amd-ta-clone')
      clone.removeAttribute('data-amd-pin-added')
      clone.querySelectorAll(`.${PIN_CLS}`).forEach(b => b.remove())
      attachCloneUnpin(clone, name)
      section.appendChild(clone)
    } else {
      const ph = document.createElement('div')
      ph.className = 'amd-ta-placeholder'
      ph.textContent = `${name} — non in questa pagina`
      section.appendChild(ph)
    }
  }
}

function attachCloneUnpin(row: HTMLElement, name: string) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `${PIN_CLS} ${PIN_ON_CLS}`
  btn.title = 'Rimuovi dai fissati'
  btn.setAttribute('aria-pressed', 'true')
  btn.innerHTML = pinSvg()
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault()
    unpinByName(name)
  })
  row.appendChild(btn)
}

function unpinByName(name: string) {
  pinnedNames.delete(name)
  evRows()
    .filter(r => evName(r).toLowerCase() === name)
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

// ── Filter ───────────────────────────────────────────────────────────────────

function applyFilter(rows: HTMLElement[]) {
  let visible = 0
  for (const row of rows) {
    const match = !filterText || evName(row).toLowerCase().includes(filterText)
    row.classList.toggle(HIDDEN_CLS, !match)
    if (match) visible++
  }

  // Hide page-separator rows whose events are all filtered out.
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

// ── Pin buttons ──────────────────────────────────────────────────────────────

function addPinButtons(rows: HTMLElement[]) {
  for (const row of rows) {
    if (row.dataset.amdPinAdded) continue
    row.dataset.amdPinAdded = '1'

    const name = evName(row).toLowerCase()
    const pinned = pinnedNames.has(name)
    if (pinned) row.classList.add(HIGHLIGHT)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `${PIN_CLS}${pinned ? ` ${PIN_ON_CLS}` : ''}`
    btn.title = pinned ? 'Rimuovi dai fissati' : 'Fissa in cima'
    btn.setAttribute('aria-pressed', String(pinned))
    btn.innerHTML = pinSvg()

    btn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault()
      const nowPinned = !pinnedNames.has(name)
      if (nowPinned) { pinnedNames.add(name) } else { pinnedNames.delete(name) }
      // Sync ALL rows with the same event name (they may appear in multiple pages).
      evRows()
        .filter(r => evName(r).toLowerCase() === name)
        .forEach(r => {
          r.classList.toggle(HIGHLIGHT, nowPinned)
          const b = r.querySelector<HTMLButtonElement>(`.${PIN_CLS}`)
          if (b) {
            b.classList.toggle(PIN_ON_CLS, nowPinned)
            b.title = nowPinned ? 'Rimuovi dai fissati' : 'Fissa in cima'
            b.setAttribute('aria-pressed', String(nowPinned))
          }
        })
      updatePinnedSection()
    })

    row.appendChild(btn)
  }
}

// ── Main sync ────────────────────────────────────────────────────────────────

/** Idempotent: safe on every Angular re-render.
 *  The toolbar re-injects itself if disconnected (SPA route change). */
function sync() {
  if (!firstMatch(ROW_SELECTORS)) return
  injectStyles()
  injectToolbar()
  const rows = evRows()
  addPinButtons(rows)
  applyFilter(rows)
  // Update pinned section in the next frame so clones come from fresh rows.
  requestAnimationFrame(updatePinnedSection)
}

let scheduled = false
let discovered = false
const observer = new MutationObserver((muts) => {
  // Ignore mutations that originate inside our own injected nodes.
  const ours = muts.every((m) => {
    const t = m.target as HTMLElement
    return !!t.closest?.(`#${ROOT_ID}, #${PINNED_ID}, #amd-ta-style`)
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
