// Runs in the PAGE world on the GTM UI / Tag Assistant.
//
// First QoL feature ported on the modern base: TYPE-BASED FILTERS.
// A toolbar of chips (one per element type actually present, with counts) plus
// a name search. Selecting types + typing filters the list LIVE by hiding rows
// — no page reload, unlike the legacy alert()+reload flow.
//
// Robustness: all GTM-internals access goes through gtm-angular (guarded), row
// discovery is anchored on AngularJS ng-repeat (stable across UI restyles), and
// a MutationObserver keeps us in sync when GTM re-renders the list.

import {
  copyRowToNew,
  getRowElements,
  hasBuiltInVariables,
  setBuiltInVariablesCollapsed,
  toggleTagPause,
  type GtmRow,
} from '@/lib/gtm-angular'
import { pageType, type PageType } from '@/lib/gtm-selectors'
import {
  applyFilter,
  emptyState,
  facetsFromRows,
  type FilterState,
} from '@/lib/filters-engine'

// Read config passed by the content script. ES modules have
// `document.currentScript === null`, so we also look at a data attribute on
// <html> as a reliable fallback. (CSP-safe; inline scripts are blocked.)
try {
  const self = document.currentScript as HTMLScriptElement | null
  const raw = self?.dataset.qolVars ?? document.documentElement.dataset.qolVars
  if (raw) window.__QOL_VARS__ = { ...(window.__QOL_VARS__ ?? {}), ...JSON.parse(raw) }
} catch {
  /* ignore malformed config */
}

const TOOLBAR_ID = 'andromeda-filters'
const HIDDEN_CLASS = 'andromeda-row-hidden'

// Base URL for bundled type icons (img/tag, img/trigger, img/variable),
// passed in by the content script (page world can't call chrome.runtime).
const IMG_BASE =
  typeof window.__QOL_VARS__?.imgBase === 'string' ? (window.__QOL_VARS__.imgBase as string) : ''

let state: FilterState = emptyState()
let currentPage: PageType = ''
let builtInVarsCollapsed = true // default: hidden, like the original

// Remember the type selection per page-type for the session, so leaving and
// coming back to a list keeps your filter. sessionStorage = convenience, not a
// permanent setting (cleared when the tab closes).
function selectionKey(page: PageType) {
  return `amd_sel_${page}`
}
function persistSelection() {
  if (currentPage === '') return
  try {
    sessionStorage.setItem(selectionKey(currentPage), JSON.stringify([...state.selectedTypes]))
  } catch {
    /* sessionStorage may be unavailable; ignore */
  }
}
function restoreSelection(page: Exclude<PageType, ''>, available: Set<string>) {
  try {
    const raw = sessionStorage.getItem(selectionKey(page))
    if (!raw) return
    const saved = JSON.parse(raw) as string[]
    // only restore types that still exist on the page
    state.selectedTypes = new Set(saved.filter((t) => available.has(t)))
  } catch {
    /* ignore */
  }
}

// Live variable-label overrides (kept in sync via the content-script bridge).
let varLabels: Record<string, string> = {
  ...((window.__QOL_VARS__?.variableTypeLabels as Record<string, string>) ?? {}),
}
function requestVarLabels() {
  window.postMessage({ action: 'amd_get_var_labels' }, '*')
}
function saveVarLabels(labels: Record<string, string>) {
  window.postMessage({ action: 'amd_set_var_labels', payload: labels }, '*')
}
window.addEventListener('message', (ev: MessageEvent) => {
  if (ev.source !== window) return
  const data = ev.data as { action?: string; payload?: Record<string, string> } | undefined
  if (data?.action === 'amd_var_labels' && data.payload) {
    const incoming = JSON.stringify(data.payload)
    const current = JSON.stringify(varLabels)
    if (incoming === current) return // no change → do NOT re-sync (prevents a loop)
    varLabels = data.payload
    window.__QOL_VARS__ = { ...(window.__QOL_VARS__ ?? {}), variableTypeLabels: varLabels }
    if (currentPage === 'VARIABLES') sync(true)
  }
})

function injectStyleOnce() {
  if (document.getElementById('andromeda-filters-style')) return
  const style = document.createElement('style')
  style.id = 'andromeda-filters-style'
  style.textContent = `
    .${HIDDEN_CLASS} { display: none !important; }
    #${TOOLBAR_ID} {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 10px 14px; margin: 0 0 6px;
      border-bottom: 1px solid rgba(0,0,0,.07);
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    #${TOOLBAR_ID} .amd-hint { font-weight: 600; color: #3c4043; margin-right: 4px; letter-spacing: -.01em; }
    #${TOOLBAR_ID} .amd-chips { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
    #${TOOLBAR_ID} .amd-chip-search {
      flex: 0 0 150px; padding: 6px 11px; border: 1px solid rgba(0,0,0,.14);
      border-radius: 9px; font-size: 13px; outline: none; transition: border-color .12s, box-shadow .12s;
    }
    #${TOOLBAR_ID} .amd-chip-search:focus { border-color: #e5c614; box-shadow: 0 0 0 3px rgba(229,198,20,.25); }
    #${TOOLBAR_ID} .amd-builtin-toggle {
      background: #fff; border: 1px solid rgba(0,0,0,.14); border-radius: 9px;
      padding: 6px 12px; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
    }
    #${TOOLBAR_ID} .amd-builtin-toggle:hover { background: #faf6da; border-color: #e5c614; }
    #${TOOLBAR_ID} .amd-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border: 1px solid rgba(0,0,0,.14);
      border-radius: 999px; background: #fff; cursor: pointer; user-select: none;
      white-space: nowrap; font-size: 13px; color: #3c4043;
      transition: background .12s, border-color .12s, color .12s, transform .06s;
    }
    #${TOOLBAR_ID} .amd-chip:hover { border-color: #e5c614; background: #faf6da; }
    #${TOOLBAR_ID} .amd-chip:active { transform: scale(.97); }
    #${TOOLBAR_ID} .amd-chip[aria-pressed="true"] {
      background: #e5c614; border-color: #e5c614; color: #2c2c2a; font-weight: 600;
    }
    #${TOOLBAR_ID} .amd-chip[aria-pressed="true"]:hover { filter: brightness(.96); }
    #${TOOLBAR_ID} .amd-chip .amd-count {
      opacity: .7; font-variant-numeric: tabular-nums; font-size: 12px;
    }
    #${TOOLBAR_ID} .amd-visible-count {
      margin-left: auto; font-size: 12px; color: #5f6368; font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${TOOLBAR_ID} .amd-visible-count.amd-filtered { color: #2c2c2a; font-weight: 600; }
    #${TOOLBAR_ID} .amd-clear {
      background: none; border: none; color: #5f6368;
      cursor: pointer; font-size: 13px; font-weight: 500; padding: 6px 4px;
    }
    #${TOOLBAR_ID} .amd-clear:hover { color: #2c2c2a; text-decoration: underline; }
  `
  document.head.appendChild(style)

  const rowStyle = document.createElement('style')
  rowStyle.id = 'andromeda-row-style'
  rowStyle.textContent = `
    :root {
      --amd-copy-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'/%3E%3Cpath d='M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2'/%3E%3C/svg%3E");
      --amd-pause-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Crect x='6' y='4' width='4' height='16' rx='1'/%3E%3Crect x='14' y='4' width='4' height='16' rx='1'/%3E%3C/svg%3E");
      --amd-resume-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Cpath d='M8 5v14l11-7z'/%3E%3C/svg%3E");
    }
    .amd-icon-group {
      display: inline-flex !important; position: relative !important;
      align-items: center !important; gap: 2px !important;
      vertical-align: middle !important; flex-shrink: 0 !important;
      margin-left: 6px !important;
    }
    .amd-copy-element {
      appearance: none; border: none; padding: 0; outline: none;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; vertical-align: middle;
      width: 30px; height: 30px; border-radius: 8px;
      background: transparent; opacity: .25; transition: background .12s, opacity .12s;
    }
    /* show on row hover */
    [gtm-table-row]:hover .amd-copy-element,
    tr:hover .amd-copy-element { opacity: 1; }
    .amd-copy-element::before {
      content: ''; width: 17px; height: 17px; display: block;
      background-color: #5f6368; transition: background-color .12s;
      -webkit-mask: var(--amd-copy-mask) center / contain no-repeat;
      mask: var(--amd-copy-mask) center / contain no-repeat;
    }
    .amd-copy-element:hover { background: #faf6da; opacity: 1; }
    .amd-copy-element:hover::before { background-color: #2c2c2a; }
    .amd-copy-element.amd-copy-ok { background: #e6f4ea !important; opacity: 1; transition: none; }
    .amd-copy-element.amd-copy-ok::before { background-color: #137333 !important; }
    .amd-copy-element.amd-copy-err { background: #fce8e6 !important; opacity: 1; transition: none; }
    .amd-copy-element.amd-copy-err::before { background-color: #c5221f !important; }
    .amd-pause-element {
      appearance: none; border: none; padding: 0; outline: none;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; vertical-align: middle;
      width: 30px; height: 30px; border-radius: 8px;
      background: transparent; opacity: 0; transition: background .12s, opacity .12s;
    }
    /* show on row hover when not paused */
    [gtm-table-row]:hover .amd-pause-element,
    tr:hover .amd-pause-element { opacity: 1; }
    .amd-pause-element::before {
      content: ''; width: 17px; height: 17px; display: block;
      background-color: #5f6368; transition: background-color .12s;
      -webkit-mask: var(--amd-pause-mask) center / contain no-repeat;
      mask: var(--amd-pause-mask) center / contain no-repeat;
    }
    .amd-pause-element:hover { background: #faf6da; opacity: 1; }
    .amd-pause-element:hover::before { background-color: #2c2c2a; }
    /* paused state: always visible, play icon to indicate "click to resume" */
    .amd-pause-element.amd-pause-on { opacity: 1; background: #fef3e0; }
    .amd-pause-element.amd-pause-on::before {
      width: 13px; height: 13px;
      background-color: #f29900;
      -webkit-mask: var(--amd-resume-mask) center / contain no-repeat;
      mask: var(--amd-resume-mask) center / contain no-repeat;
    }
    .amd-pause-element.amd-pause-on:hover { background: #fde8a0; }
    .amd-pause-element.amd-pause-on:hover::before { background-color: #c67a00; }
    .amd-pause-element.amd-pause-ok { background: #e6f4ea !important; opacity: 1; transition: none; }
    .amd-pause-element.amd-pause-ok::before { background-color: #137333 !important; }
    .amd-pause-element.amd-pause-err { background: #fce8e6 !important; opacity: 1; transition: none; }
    .amd-pause-element.amd-pause-err::before { background-color: #c5221f !important; }
    .amd-type-icon {
      width: 20px; height: 20px; object-fit: contain; vertical-align: middle;
      margin-right: 9px; border-radius: 4px; flex-shrink: 0;
    }
    .amd-type-initial {
      display: inline-block; text-align: center; line-height: 20px;
      width: 20px; height: 20px; border-radius: 4px; background: #e5c614; color: #2c2c2a;
      font-size: 11px; font-weight: 700; font-family: system-ui, sans-serif;
      vertical-align: middle; margin-right: 9px;
      background-size: contain; background-repeat: no-repeat; background-position: center;
    }
    .amd-type-initial.amd-has-img { background-color: transparent; }
    .amd-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-modal {
      background: #fff; border-radius: 14px; width: 460px; max-width: 92vw;
      max-height: 80vh; display: flex; flex-direction: column; padding: 20px;
      box-shadow: 0 12px 40px rgba(0,0,0,.28);
    }
    .amd-modal-head { display: flex; justify-content: space-between; align-items: center; }
    .amd-modal-close { border: none; background: none; font-size: 24px; cursor: pointer; line-height: 1; color: #5f6368; border-radius: 8px; width: 32px; height: 32px; }
    .amd-modal-close:hover { background: #f1f3f4; }
    .amd-modal-help { color: #5f6368; margin: 8px 0 14px; font-size: 13px; }
    .amd-modal-rows { overflow-y: auto; display: flex; flex-direction: column; gap: 9px; }
    .amd-modal-row { display: grid; grid-template-columns: 140px 1fr; align-items: center; gap: 10px; }
    .amd-modal-row code { background: #f1f3f4; padding: 4px 7px; border-radius: 6px; font-size: 12px; overflow-wrap: anywhere; }
    .amd-modal-row input { padding: 7px 10px; border: 1px solid rgba(0,0,0,.16); border-radius: 8px; font-size: 13px; outline: none; transition: border-color .12s, box-shadow .12s; }
    .amd-modal-row input:focus { border-color: #e5c614; box-shadow: 0 0 0 3px rgba(229,198,20,.25); }
    .amd-modal-actions { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
    .amd-modal-save { padding: 8px 18px; background: #e5c614; color: #2c2c2a; font-weight: 600; border: none; border-radius: 9px; cursor: pointer; font-size: 13px; }
    .amd-modal-save:hover { filter: brightness(.96); }
    .amd-modal-msg { color: #137333; font-size: 13px; }`
  document.head.appendChild(rowStyle)
}

/** The proven insertion point (from the original, working extension): the
 *  table card lives OUTSIDE the Angular-managed table region, so a sibling
 *  inserted before it survives Angular's re-renders. Inserting near the
 *  in-table controls (itemsPerPage) does NOT survive — Angular wipes it. */
function tableCard(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(
      '.gtm-container-page-content [data-gtm-cloak="variable-list"] > .card.card--table',
    ) ?? document.querySelector<HTMLElement>('.gtm-container-page-content .card.card--table')
  )
}

function applyToDom(rows: GtmRow[]) {
  const { show, hide } = applyFilter(rows, state)
  for (const r of show) r.node.classList.remove(HIDDEN_CLASS)
  for (const r of hide) r.node.classList.add(HIDDEN_CLASS)
  updateVisibleCount(rows)
}

/** Update the "X di Y visibili" counter. We count rows actually visible in the
 *  DOM (offsetParent !== null), so GTM's own native name-search — which we don't
 *  control — is reflected too, not just our type filter. */
function updateVisibleCount(rows: GtmRow[]) {
  const el = document.getElementById('amd-visible-count')
  if (!el) return
  const total = rows.length
  const visible = rows.filter((r) => r.node.offsetParent !== null).length
  if (visible === total) {
    el.textContent = `${total} element${total === 1 ? 'o' : 'i'}`
    el.classList.remove('amd-filtered')
  } else {
    el.textContent = `${visible} di ${total} visibili`
    el.classList.add('amd-filtered')
  }
}

// Add a type icon to the start of each row (hybrid approach):
//  • tags     → vendor icon via brandThumbnailUrl (provided by GTM)
//  • triggers → bundled img/trigger/{rawType}.png
//  • variables→ bundled img/variable/{publicId}.png
//  • fallback → a small coloured square with the type's initial
//
// Race-condition guard: Angular sometimes loads row data in two passes — the
// first pass has only a numeric type code (no typeDisplayName), so the initial
// badge would show a digit. We store the display name on a data attribute and
// re-create the badge on the next sync pass when better data arrives.
function addTypeIcons(rows: GtmRow[]) {
  if (currentPage === '') return
  for (const r of rows) {
    const tr =
      (r.node.matches('tr') ? r.node : r.node.querySelector<HTMLElement>('tr')) ?? r.node
    // The name lives in a link inside the name cell. Inserting the icon INSIDE
    // that inline container (rather than as a block sibling) keeps it on the
    // same line as the name — matching the original extension's prepend.
    const nameCell =
      tr.querySelector<HTMLElement>(':scope > td:nth-child(2)') ??
      tr.querySelector<HTMLElement>('td:nth-child(2)') ??
      tr.querySelector<HTMLElement>('td')
    if (!nameCell) continue
    const host =
      nameCell.querySelector<HTMLElement>('a') ?? // the name link
      nameCell.querySelector<HTMLElement>('.fill-cell') ??
      nameCell

    const existing = host.querySelector<HTMLElement>('.amd-type-icon')
    if (existing) {
      // Badge already present — keep it if:
      //  a) the image has successfully loaded (adding new probe would re-flash), OR
      //  b) the display name hasn't changed (data is still the same).
      // Otherwise remove and re-create: the first sync had partial data.
      if (existing.classList.contains('amd-has-img')) continue
      if (existing.dataset.amdDisplay === r.displayName) continue
      existing.remove()
    }

    const badge = initialBadge(r)
    badge.dataset.amdDisplay = r.displayName
    host.insertBefore(badge, host.firstChild)

    const url = pickIconUrl(r)
    if (url) {
      const probe = new Image()
      probe.onload = () => {
        // Guard: skip if the row was re-rendered and this badge is no longer live.
        if (!badge.isConnected) return
        badge.style.backgroundImage = `url("${url}")`
        badge.classList.add('amd-has-img')
        badge.textContent = ''
      }
      probe.src = url
    }
  }
}

// Bundled icon sets — we only attempt to load icons we actually ship, so we
// never trigger 404 network errors for missing types (they fall back to the
// initial badge instead).
const TRIGGER_ICONS = new Set([
  '1', '2', '3', '4', '6', '7', '8', '9', '10', '12', '30', '31', '32', '33',
])
const VARIABLE_ICONS = new Set([
  '0', '1', '2', '3', '4', 'aev', 'c', 'cid', 'ctv', 'd', 'dbg', 'e', 'ev', 'f',
  'gas', 'j', 'jsm', 'k', 'r', 'remm', 'smm', 'u', 'uv', 'v', 'vis',
])
// Server Side GTM: client icons (populated once asset files are added to img/client/).
const CLIENT_ICONS = new Set<string>([])

function pickIconUrl(r: GtmRow): string {
  if (currentPage === 'TAGS' && r.brandThumbnailUrl) return r.brandThumbnailUrl
  if (!IMG_BASE) return ''
  if (currentPage === 'TRIGGERS' && r.rawType && TRIGGER_ICONS.has(r.rawType))
    return `${IMG_BASE}trigger/${r.rawType}.png`
  if (currentPage === 'VARIABLES' && r.publicId && VARIABLE_ICONS.has(r.publicId))
    return `${IMG_BASE}variable/${r.publicId}.png`
  // Server Side Clients: use img/client/{rawType}.png when assets are available.
  if (currentPage === 'CLIENTS' && r.rawType && CLIENT_ICONS.has(r.rawType))
    return `${IMG_BASE}client/${r.rawType}.png`
  return ''
}

// Page-type fallback initials used when a displayName starts with a digit
// (numeric internal type codes from partially-loaded Angular data).
const PAGE_INITIAL: Partial<Record<PageType, string>> = {
  TAGS: 'T', TRIGGERS: 'T', VARIABLES: 'V', CLIENTS: 'C',
}

function initialBadge(r: GtmRow): HTMLElement {
  const i = document.createElement('span')
  i.className = 'amd-type-icon amd-type-initial'
  const first = (r.displayName || '?').trim().charAt(0).toUpperCase()
  // Numeric first character → data is still partial; use a page-type fallback
  // so the badge never shows a meaningless digit to the user.
  i.textContent = /^\d/.test(first) ? (PAGE_INITIAL[currentPage] ?? '?') : first
  i.title = r.displayName
  return i
}

// Add a "duplicate" icon to each row's last cell (same position as the original
// extension). Clicking it copies the element into a new one with a unique name.
function addCopyIcons(rows: GtmRow[]) {
  if (currentPage === '') return
  for (const r of rows) {
    // [gtm-table-row] may BE the <tr> or wrap one; find the actual row element.
    const tr =
      (r.node.matches('tr') ? r.node : r.node.querySelector<HTMLElement>('tr')) ?? r.node
    const lastCell =
      tr.querySelector<HTMLElement>(':scope > td:last-child') ??
      tr.querySelector<HTMLElement>('td:last-child')
    if (!lastCell) continue
    if (lastCell.querySelector('.amd-copy-element')) continue
    let group = lastCell.querySelector<HTMLElement>('.amd-icon-group')
    if (!group) {
      group = document.createElement('span')
      group.className = 'amd-icon-group'
      lastCell.appendChild(group)
    }
    const icon = document.createElement('button')
    icon.className = 'amd-copy-element qol-row-not-clickable'
    icon.title = 'Duplica'
    icon.type = 'button'
    icon.addEventListener(
      'click',
      (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        copyRowToNew(currentPage as Exclude<PageType, ''>, icon, (ok) => {
          icon.classList.add(ok ? 'amd-copy-ok' : 'amd-copy-err')
          setTimeout(() => icon.classList.remove('amd-copy-ok', 'amd-copy-err'), 1200)
        })
      },
      true,
    )
    group.appendChild(icon)
  }
}

// Add a "pause/resume" icon to each tag row's last cell.
// - When the tag is NOT paused: icon is hover-only (opacity 0 → 1), shows pause bars.
// - When the tag IS paused: icon is always visible (orange), shows play triangle.
// Only active on the TAGS page — pause doesn't apply to triggers/variables/clients.
function addPauseIcons(rows: GtmRow[]) {
  if (currentPage !== 'TAGS') return
  for (const r of rows) {
    const tr =
      (r.node.matches('tr') ? r.node : r.node.querySelector<HTMLElement>('tr')) ?? r.node
    const lastCell =
      tr.querySelector<HTMLElement>(':scope > td:last-child') ??
      tr.querySelector<HTMLElement>('td:last-child')
    if (!lastCell) continue

    let group = lastCell.querySelector<HTMLElement>('.amd-icon-group')
    if (!group) {
      group = document.createElement('span')
      group.className = 'amd-icon-group'
      lastCell.appendChild(group)
    }

    let icon = group.querySelector<HTMLButtonElement>('.amd-pause-element')
    if (!icon) {
      icon = document.createElement('button')
      icon.className = 'amd-pause-element qol-row-not-clickable'
      icon.type = 'button'
      icon.addEventListener(
        'click',
        (ev) => {
          ev.preventDefault()
          ev.stopPropagation()
          const rowEl = (icon!.closest('[gtm-table-row]') ?? icon!.closest('tr')) as HTMLElement | null
          if (!rowEl) return
          toggleTagPause(rowEl, (ok) => {
            icon!.classList.add(ok ? 'amd-pause-ok' : 'amd-pause-err')
            setTimeout(() => icon!.classList.remove('amd-pause-ok', 'amd-pause-err'), 1200)
          })
        },
        true,
      )
      group.appendChild(icon)
    }

    const isPaused = r.paused === true
    icon.classList.toggle('amd-pause-on', isPaused)
    icon.title = isPaused ? 'Riprendi' : 'Metti in pausa'

    // Hide GTM's native pause badge — redundant with our play/resume icon.
    const nativePauseBadge = lastCell.querySelector<HTMLElement>('.pause-circle-filled-icon')
    if (nativePauseBadge) nativePauseBadge.style.display = isPaused ? 'none' : ''
  }
}

function renderToolbar(rows: GtmRow[]) {
  const card = tableCard()
  if (!card) return

  let bar = document.getElementById(TOOLBAR_ID)
  if (!bar || !bar.isConnected) {
    bar = document.createElement('div')
    bar.id = TOOLBAR_ID
    card.insertAdjacentElement('beforebegin', bar)
  }
  bar.replaceChildren()

  // Name search is intentionally delegated to GTM's native search box (it works
  // in any language and composes with our type filter: a row shows only if it
  // passes BOTH). Our toolbar handles ONLY the type dimension.
  const hint = document.createElement('span')
  hint.className = 'amd-hint'
  hint.textContent = 'Filtra per tipo:'
  bar.appendChild(hint)

  // type chips, populated from the types actually present
  let facets: ReturnType<typeof facetsFromRows> = []
  try {
    facets = facetsFromRows(rows)
  } catch (err) {
    console.warn('[Andromeda QoL] facet build failed', err)
  }

  // Restore a saved selection for this page (only types still present).
  if (currentPage !== '' && state.selectedTypes.size === 0)
    restoreSelection(
      currentPage as Exclude<PageType, ''>,
      new Set(facets.map((f) => f.type)),
    )

  // Many types? Chips wrap onto multiple lines (the bar already flex-wraps) and
  // a search-as-you-type box narrows the chip set itself, so a container with
  // dozens of variable types stays manageable.
  const chipWrap = document.createElement('div')
  chipWrap.className = 'amd-chips'
  bar.appendChild(chipWrap)

  const renderChips = (textFilter = '') => {
    chipWrap.replaceChildren()
    const q = textFilter.trim().toLowerCase()
    const visible = q ? facets.filter((f) => f.displayName.toLowerCase().includes(q)) : facets
    for (const facet of visible) {
      const chip = document.createElement('button')
      chip.type = 'button'
      chip.className = 'amd-chip'
      chip.setAttribute('aria-pressed', String(state.selectedTypes.has(facet.type)))
      chip.title = facet.type
      const label = document.createElement('span')
      label.className = 'amd-label'
      label.textContent = facet.displayName
      const count = document.createElement('span')
      count.className = 'amd-count'
      count.textContent = `(${facet.count})` // count per type in parentheses
      chip.append(label, document.createTextNode(' '), count)
      chip.addEventListener('click', () => {
        if (state.selectedTypes.has(facet.type)) state.selectedTypes.delete(facet.type)
        else state.selectedTypes.add(facet.type)
        chip.setAttribute('aria-pressed', String(state.selectedTypes.has(facet.type)))
        persistSelection()
        applyToDom(getRowElements(currentPage as Exclude<PageType, ''>))
      })
      chipWrap.appendChild(chip)
    }
  }

  // When there are many types, offer a quick filter for the chips themselves.
  if (facets.length > 12) {
    const chipSearch = document.createElement('input')
    chipSearch.type = 'search'
    chipSearch.className = 'amd-chip-search'
    chipSearch.placeholder = 'filtra tipi…'
    chipSearch.addEventListener('input', () => renderChips(chipSearch.value))
    bar.insertBefore(chipSearch, chipWrap)
  }
  renderChips()

  // Live "X di Y visibili" counter.
  const counter = document.createElement('span')
  counter.id = 'amd-visible-count'
  counter.className = 'amd-visible-count'
  bar.appendChild(counter)

  // clear all
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className = 'amd-clear'
  clear.textContent = 'Azzera filtri'
  clear.addEventListener('click', () => {
    state = emptyState()
    persistSelection() // clears the saved selection too
    sync(true)
  })
  bar.appendChild(clear)

  // Keep the counter in sync with GTM's own native name-search box, which hides
  // rows independently of us. Debounced via rAF to avoid thrashing while typing.
  const nativeSearch = findNativeSearch()
  if (nativeSearch && !nativeSearch.dataset.amdBound) {
    nativeSearch.dataset.amdBound = '1'
    nativeSearch.addEventListener('input', () => {
      requestAnimationFrame(() =>
        updateVisibleCount(getRowElements(currentPage as Exclude<PageType, ''>)),
      )
    })
  }

  // Built-in variables collapse toggle (VARIABLES page only).
  if (currentPage === 'VARIABLES' && hasBuiltInVariables()) {
    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'amd-builtin-toggle'
    const refreshLabel = () => {
      toggle.textContent = builtInVarsCollapsed
        ? 'Mostra variabili integrate'
        : 'Nascondi variabili integrate'
    }
    refreshLabel()
    setBuiltInVariablesCollapsed(builtInVarsCollapsed) // apply current state
    toggle.addEventListener('click', () => {
      builtInVarsCollapsed = !builtInVarsCollapsed
      setBuiltInVariablesCollapsed(builtInVarsCollapsed)
      refreshLabel()
    })
    bar.appendChild(toggle)
  }

  // Variable type-label editor (VARIABLES page only) — lives next to the filters,
  // inside GTM, as requested. Lets the user name the type codes (e.g. cvt_…).
  if (currentPage === 'VARIABLES') {
    const editBtn = document.createElement('button')
    editBtn.type = 'button'
    editBtn.className = 'amd-builtin-toggle'
    editBtn.textContent = 'Etichette tipi…'
    editBtn.addEventListener('click', () => openLabelEditor())
    bar.appendChild(editBtn)
  }

  // Keyboard shortcut: '/' focuses GTM's native name-search (like GitHub),
  // unless the user is already typing in a field. Capture phase so we win over
  // GTM's own key handlers. e.key is '/' regardless of which physical keys
  // produce it (Shift+7 on IT layouts still yields '/').
  if (!window.__amdSlashBound) {
    window.__amdSlashBound = true
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
        const t = e.target as HTMLElement | null
        const typing =
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable ||
            !!t.closest('input, textarea, [contenteditable]'))
        if (typing) return
        const search = findNativeSearch()
        if (search) {
          e.preventDefault()
          e.stopPropagation()
          search.focus()
        }
      },
      true,
    )
  }
}

/** Locate GTM's native name-search input (selectors vary across GTM versions). */
function findNativeSearch(): HTMLInputElement | null {
  const root = document.querySelector('.gtm-container-page-content') ?? document
  return (
    root.querySelector<HTMLInputElement>('input[type="search"]') ??
    root.querySelector<HTMLInputElement>('input[aria-label*="erca"]') ??
    root.querySelector<HTMLInputElement>('input[placeholder*="erca"]') ??
    root.querySelector<HTMLInputElement>('input[aria-label*="earch"]') ??
    root.querySelector<HTMLInputElement>('input[placeholder*="earch"]')
  )
}

/** A small in-page panel to map variable type codes to readable labels. */
function openLabelEditor() {
  document.getElementById('amd-label-editor')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'amd-label-editor'
  overlay.className = 'amd-modal-overlay'

  const panel = document.createElement('div')
  panel.className = 'amd-modal'
  panel.innerHTML = `
    <div class="amd-modal-head">
      <strong>Etichette tipi di variabili</strong>
      <button type="button" class="amd-modal-close" title="Chiudi">×</button>
    </div>
    <p class="amd-modal-help">Assegna un nome leggibile a ciascun codice tipo. Lascia vuoto per usare il predefinito.</p>
    <div class="amd-modal-rows"></div>
    <div class="amd-modal-actions">
      <button type="button" class="amd-modal-save">Salva</button>
      <span class="amd-modal-msg"></span>
    </div>`
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const rowsBox = panel.querySelector('.amd-modal-rows')!

  // Build one editor row per distinct REAL code present, plus any code already
  // overridden in storage. We show the code and its current effective label.
  const rows = getRowElements('VARIABLES')
  const labelByCode = new Map<string, string>()
  for (const r of rows) if (!labelByCode.has(r.code)) labelByCode.set(r.code, r.displayName)
  for (const k of Object.keys(varLabels)) if (!labelByCode.has(k)) labelByCode.set(k, varLabels[k])

  const inputs = new Map<string, HTMLInputElement>()
  for (const [code, currentLabel] of labelByCode) {
    const row = document.createElement('label')
    row.className = 'amd-modal-row'
    const codeSpan = document.createElement('code')
    codeSpan.textContent = code
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = currentLabel || '(predefinito)'
    input.value = varLabels[code] ?? ''
    inputs.set(code, input)
    row.append(codeSpan, input)
    rowsBox.appendChild(row)
  }

  const close = () => overlay.remove()
  panel.querySelector('.amd-modal-close')!.addEventListener('click', close)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })
  panel.querySelector('.amd-modal-save')!.addEventListener('click', () => {
    const next: Record<string, string> = { ...varLabels }
    for (const [code, input] of inputs) {
      const v = input.value.trim()
      if (v) next[code] = v
      else delete next[code]
    }
    saveVarLabels(next)
    const msg = panel.querySelector('.amd-modal-msg')!
    msg.textContent = 'Salvato ✓'
    setTimeout(close, 600)
  })
}

// ── Shift+click bulk selection ────────────────────────────────────────────────

function initBulkSelection() {
  if (window.__amdBulkBound) return
  window.__amdBulkBound = true

  let lastRow: HTMLElement | null = null

  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      const checkboxArea = (e.target as HTMLElement).closest<HTMLElement>('[gtm-table-row-checkbox]')
      if (!checkboxArea) return
      const row = checkboxArea.closest<HTMLElement>('[gtm-table-row]')
      if (!row) return
      const table = row.closest<HTMLElement>('table')
      if (!table) return

      if (!e.shiftKey || !lastRow || lastRow.closest('table') !== table) {
        lastRow = row
        return
      }

      e.preventDefault() // prevent text selection on shift+click

      const allRows = Array.from(table.querySelectorAll<HTMLElement>('[gtm-table-row]'))
      const currentIdx = allRows.indexOf(row)
      const lastIdx = allRows.indexOf(lastRow)
      if (currentIdx < 0 || lastIdx < 0) return

      const start = Math.min(lastIdx, currentIdx)
      const end   = Math.max(lastIdx, currentIdx)

      const cb = checkboxArea.querySelector<HTMLInputElement>('input[type="checkbox"]')
      const targetChecked = cb ? !cb.checked : true

      for (let i = start; i <= end; i++) {
        if (allRows[i] === row) continue // let the natural click handle the clicked row
        const area = allRows[i].querySelector<HTMLElement>('[gtm-table-row-checkbox]')
        if (!area) continue
        const input = area.querySelector<HTMLInputElement>('input[type="checkbox"]')
        const isChecked =
          input ? input.checked
          : area.getAttribute('aria-checked') === 'true' ||
            area.classList.contains('mat-checkbox-checked')
        if (isChecked !== targetChecked) area.click()
      }

      lastRow = row
    },
    true,
  )
}

/** Re-read rows and refresh toolbar + visibility. `rebuild` re-renders chips. */
function sync(rebuild = false) {
  const page = pageType()
  if (page === '') {
    document.getElementById(TOOLBAR_ID)?.remove()
    currentPage = ''
    return
  }
  if (page !== currentPage) {
    currentPage = page
    state = emptyState() // reset when moving between tags/triggers/variables
    rebuild = true
  }
  const rows = getRowElements(page)
  const bar = document.getElementById(TOOLBAR_ID)
  if (rows.length === 0) return
  if (rebuild || !bar || !bar.isConnected) {
    injectStyleOnce()
    renderToolbar(rows)
  }
  // Re-assert the built-in variables collapse on every sync (GTM re-renders it).
  if (page === 'VARIABLES' && builtInVarsCollapsed) setBuiltInVariablesCollapsed(true)
  applyToDom(rows)
  addTypeIcons(rows)
  addCopyIcons(rows)
  addPauseIcons(rows)
  initBulkSelection()
}

// Keep in sync with GTM's own re-renders (debounced). Ignore mutations that
// originate inside our own toolbar/editor to avoid a feedback loop.
let scheduled = false
const observer = new MutationObserver((mutations) => {
  const ours = mutations.every((m) => {
    const t = m.target as HTMLElement
    return t.closest?.(`#${TOOLBAR_ID}, #amd-label-editor, #andromeda-filters-style`)
  })
  if (ours || scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    sync()
  })
})
observer.observe(document.body, { childList: true, subtree: true })

sync(true)
requestVarLabels() // one-time load of saved labels; updates re-render only if changed

declare global {
  interface Window {
    QOL?: Record<string, unknown>
    __amdSlashBound?: boolean
    __amdBulkBound?: boolean
  }
}
window.QOL ??= {}
