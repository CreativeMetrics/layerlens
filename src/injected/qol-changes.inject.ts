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
  deleteRow,
  getFolderMap,
  getRowElements,
  hasBuiltInVariables,
  renameElement,
  setBuiltInVariablesCollapsed,
  toggleTagPause,
  type GtmRow,
} from '@/lib/gtm-angular'
import { pageType, type PageType } from '@/lib/gtm-selectors'
import {
  applyFilter,
  emptyState,
  facetsFromRows,
  foldersFromRows,
  type FilterState,
  type FolderFacet,
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
let renameMode = false
let copiedTableRows: unknown[] = []

// Folder map: loaded once per workspace, then cached.
let folderMap: Map<string, string> = new Map()
let folderMapLoading = false
// Index (1-based, for :nth-child) of the folder column in the GTM table.
// -1 = not yet found; 0 = not present (no folder column on this page type).
let folderColumnIndex = -1
// Whether the one-time folder-page DOM scan has fired this session.
let folderPageScanned = false
let folderMapDone = false  // true after first successful (or definitively failed) attempt
let folderMapWorkspacePath = ''

// Remember the type selection per page-type for the session, so leaving and
// coming back to a list keeps your filter. sessionStorage = convenience, not a
// permanent setting (cleared when the tab closes).
function selectionKey(page: PageType) {
  return `amd_sel_${page}`
}
function persistSelection() {
  if (currentPage === '') return
  try {
    sessionStorage.setItem(selectionKey(currentPage), JSON.stringify({
      types: [...state.selectedTypes],
      folders: [...state.selectedFolders],
      pauseFilter: state.pauseFilter,
    }))
  } catch { /* sessionStorage may be unavailable; ignore */ }
}
function restoreSelection(page: Exclude<PageType, ''>, available: Set<string>) {
  try {
    const raw = sessionStorage.getItem(selectionKey(page))
    if (!raw) return
    const saved = JSON.parse(raw) as unknown
    // Support old format (plain array), new format ({types, pauseFilter}), and folder-aware format
    if (Array.isArray(saved)) {
      state.selectedTypes = new Set((saved as string[]).filter((t) => available.has(t)))
    } else if (saved && typeof saved === 'object') {
      const s = saved as { types?: string[]; folders?: string[]; pauseFilter?: string }
      if (Array.isArray(s.types)) state.selectedTypes = new Set(s.types.filter((t) => available.has(t)))
      if (Array.isArray(s.folders)) state.selectedFolders = new Set(s.folders as string[])
      if (s.pauseFilter === 'paused' || s.pauseFilter === 'active') state.pauseFilter = s.pauseFilter
    }
  } catch { /* ignore */ }
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

/** Load (or refresh when workspace changes) the folder ID→name map. */
function ensureFolderMap() {
  const match = window.location.hash.match(/accounts\/\d+\/containers\/\d+\/workspaces\/\d+/)
  const wsPath = match ? match[0] : ''
  if (wsPath !== folderMapWorkspacePath) {
    folderMap = new Map()
    folderMapWorkspacePath = wsPath
    folderMapLoading = false
    folderMapDone = false
    folderPageScanned = false
  }
  if (folderMapDone || folderMapLoading || !wsPath) return
  folderMapLoading = true
  getFolderMap()
    .then((map) => {
      folderMap = map
      folderMapLoading = false
      folderMapDone = true
      if (currentPage !== '' && map.size > 0) sync(true)
    })
    .catch(() => {
      folderMapLoading = false
      folderMapDone = true
    })
}

/**
 * Find the 1-based `td` index of the folder column by inspecting actual row
 * data instead of header cells (GTM's table doesn't use standard `thead/th`).
 *
 * Strategy: scan the first row that has a known folder name and find which
 * `td` cell contains exactly that text (skipping cells with links/buttons).
 * Also recognises cells that already contain our badge (handles re-calls).
 *
 * Returns -1 while the table isn't ready, 0 if no folder column exists.
 */
function findFolderColumnIndex(rows: GtmRow[]): number {
  if (folderColumnIndex !== -1) return folderColumnIndex

  for (const r of rows) {
    if (!r.parentFolderId) continue
    const folderName = folderMap.get(r.parentFolderId)
    if (!folderName) continue

    const tr = (r.node.matches('tr') ? r.node : r.node.querySelector<HTMLElement>('tr')) ?? r.node
    const cells = Array.from(tr.querySelectorAll<HTMLElement>('td'))
    for (let i = 0; i < cells.length; i++) {
      // Cell already contains our badge → column found
      const badge = cells[i].querySelector<HTMLElement>('.amd-folder-badge')
      if (badge?.dataset.amdFolderId === r.parentFolderId) {
        folderColumnIndex = i + 1
        return folderColumnIndex
      }
      // Cell contains the native folder name text (no interactive children)
      const text = (cells[i].textContent ?? '').trim()
      if (text === folderName && !cells[i].querySelector('a, button, input')) {
        folderColumnIndex = i + 1
        return folderColumnIndex
      }
    }
  }

  // No row with a folder found yet — keep -1 so we retry next sync.
  // Only mark as absent (0) if rows have been checked and none have folders.
  const anyFolder = rows.some((r) => r.parentFolderId && folderMap.has(r.parentFolderId))
  if (anyFolder) folderColumnIndex = 0  // rows exist with folders but no matching cell
  return folderColumnIndex
}

/** Navigate to the GTM Folders section (or a specific folder) for the current workspace. */
function navigateToFolder(folderId?: string) {
  const m = window.location.hash.match(/(#\/container\/accounts\/\d+\/containers\/\d+\/workspaces\/\d+)/)
  if (m) window.location.hash = folderId ? `${m[1]}/folders/${folderId}` : `${m[1]}/folders`
}

/**
 * Inject (or refresh) a styled folder pill.
 *
 * Target: the native GTM "Folder" column cell if present (detected once via
 * `findFolderColumnIndex()`), so the pill lives exactly where the user expects.
 * Fallback: append after the name link in the name cell.
 *
 * Clicking navigates to the Folders section. Yellow tint when the folder
 * filter is active.
 */
function addFolderBadges(rows: GtmRow[]) {
  if (folderMap.size === 0) return
  const colIdx = findFolderColumnIndex(rows) // 1-based; 0 = absent; -1 = not ready
  if (colIdx === -1) return

  for (const r of rows) {
    const tr = (r.node.matches('tr') ? r.node : r.node.querySelector<HTMLElement>('tr')) ?? r.node
    const existing = tr.querySelector<HTMLElement>('.amd-folder-badge')

    // ── No folder assigned ─────────────────────────────────────────
    if (!r.parentFolderId) {
      if (colIdx > 0) {
        const folderCell = tr.querySelector<HTMLElement>(`td:nth-child(${colIdx})`)
        if (folderCell) {
          // Already showing the placeholder — nothing to do
          if (existing?.dataset.amdFolderId === '' && folderCell.contains(existing)) continue
          existing?.remove()
          const placeholder = document.createElement('span')
          placeholder.className = 'amd-folder-badge amd-folder-none'
          placeholder.dataset.amdFolderId = ''
          placeholder.textContent = '—'
          placeholder.title = 'Nessuna cartella assegnata'
          folderCell.replaceChildren(placeholder)
        }
      } else {
        existing?.remove()
      }
      continue
    }

    // ── Has folder ─────────────────────────────────────────────────
    const folderName = folderMap.get(r.parentFolderId)
    if (!folderName) { existing?.remove(); continue }

    const isActive = state.selectedFolders.has(r.parentFolderId)

    if (existing?.dataset.amdFolderId === r.parentFolderId) {
      existing.classList.toggle('amd-folder-active', isActive)
      continue
    }
    existing?.remove()

    const badge = document.createElement('span')
    badge.className = 'amd-folder-badge' + (isActive ? ' amd-folder-active' : '')
    badge.dataset.amdFolderId = r.parentFolderId
    badge.textContent = folderName
    badge.title = 'Vai alla cartella'
    badge.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      sessionStorage.setItem('amd-open-folder', folderName)
      navigateToFolder()
    })

    if (colIdx > 0) {
      const folderCell = tr.querySelector<HTMLElement>(`td:nth-child(${colIdx})`)
      if (folderCell) { folderCell.replaceChildren(badge); continue }
    }
    // Fallback: append to name cell
    const nameCell =
      tr.querySelector<HTMLElement>(':scope > td:nth-child(2)') ??
      tr.querySelector<HTMLElement>('td:nth-child(2)')
    nameCell?.appendChild(badge)
  }
}

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
      position: relative;
    }
    /* ── filter trigger button ─────────────────────────────────── */
    #${TOOLBAR_ID} .amd-filter-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 11px; border: 1px solid rgba(0,0,0,.18); border-radius: 9px;
      background: #fff; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
      white-space: nowrap;
    }
    #${TOOLBAR_ID} .amd-filter-btn:hover { background: #faf6da; border-color: #e5c614; }
    #${TOOLBAR_ID} .amd-filter-btn.active { background: #e5c614; border-color: #e5c614; color: #2c2c2a; }
    #${TOOLBAR_ID} .amd-filter-btn .amd-filter-badge {
      background: #2c2c2a; color: #fff; border-radius: 999px;
      font-size: 11px; font-weight: 700; padding: 0 5px; min-width: 16px; text-align: center;
    }
    #${TOOLBAR_ID} .amd-filter-btn.active .amd-filter-badge { background: rgba(0,0,0,.25); color: #fff; }
    #${TOOLBAR_ID} .amd-filter-arrow { font-size: 10px; opacity: .6; }
    /* ── active type chips (inline, removable) ──────────────────── */
    #${TOOLBAR_ID} .amd-active-chips { display: flex; flex-wrap: wrap; gap: 5px; }
    #${TOOLBAR_ID} .amd-active-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 9px; border: 1px solid #e5c614; border-radius: 999px;
      background: #fffae6; color: #2c2c2a; font-size: 12px; font-weight: 500;
      white-space: nowrap; cursor: pointer;
      transition: background .1s;
    }
    #${TOOLBAR_ID} .amd-active-chip:hover { background: #fef0b0; }
    #${TOOLBAR_ID} .amd-active-chip .amd-chip-x { opacity: .5; font-size: 11px; margin-left: 1px; }
    /* ── counter + secondary buttons ───────────────────────────── */
    #${TOOLBAR_ID} .amd-visible-count {
      margin-left: auto; font-size: 12px; color: #5f6368; font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${TOOLBAR_ID} .amd-visible-count.amd-filtered { color: #2c2c2a; font-weight: 600; }
    #${TOOLBAR_ID} .amd-clear {
      background: none; border: none; color: #5f6368;
      cursor: pointer; font-size: 13px; font-weight: 500; padding: 6px 4px;
    }
    #${TOOLBAR_ID} .amd-clear:hover { color: #c5221f; text-decoration: underline; }
    #${TOOLBAR_ID} .amd-builtin-toggle {
      background: #fff; border: 1px solid rgba(0,0,0,.14); border-radius: 9px;
      padding: 6px 12px; color: #3c4043; cursor: pointer; font-size: 13px; font-weight: 500;
      transition: background .12s, border-color .12s;
    }
    #${TOOLBAR_ID} .amd-builtin-toggle:hover { background: #faf6da; border-color: #e5c614; }
    /* ── dropdown panel ─────────────────────────────────────────── */
    #${TOOLBAR_ID} .amd-dropdown {
      position: absolute; top: calc(100% + 2px); left: 14px;
      width: 360px; background: #fff; border: 1px solid rgba(0,0,0,.15);
      border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.13);
      z-index: 9000; overflow: hidden;
      display: none;
    }
    #${TOOLBAR_ID} .amd-dropdown.open { display: block; }
    .amd-dropdown-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px; border-bottom: 1px solid rgba(0,0,0,.07);
      font-weight: 600; font-size: 12px; color: #5f6368; text-transform: uppercase; letter-spacing: .06em;
    }
    .amd-dropdown-close {
      background: none; border: none; cursor: pointer; color: #5f6368;
      font-size: 16px; line-height: 1; padding: 0 2px;
    }
    .amd-dropdown-close:hover { color: #2c2c2a; }
    .amd-dropdown-search {
      width: 100%; padding: 8px 12px; border: none; border-bottom: 1px solid rgba(0,0,0,.07);
      font-size: 13px; outline: none; box-sizing: border-box;
    }
    .amd-dropdown-search:focus { background: #fffdf0; }
    .amd-dropdown-types {
      max-height: 220px; overflow-y: auto;
      padding: 4px 0;
    }
    .amd-dropdown-check {
      display: flex; align-items: center; gap: 9px;
      padding: 6px 12px; cursor: pointer; font-size: 13px; color: #3c4043;
      transition: background .1s;
    }
    .amd-dropdown-check:hover { background: #f8f9fa; }
    .amd-dropdown-check input[type="checkbox"] {
      width: 14px; height: 14px; accent-color: #e5c614; cursor: pointer; flex-shrink: 0;
    }
    .amd-dropdown-check .amd-dc-name { flex: 1; }
    .amd-dropdown-check .amd-dc-count { font-size: 12px; color: #5f6368; }
    .amd-dropdown-sep { border: none; border-top: 1px solid rgba(0,0,0,.07); margin: 4px 0; }
    .amd-dropdown-section-label {
      padding: 6px 12px 3px; font-size: 11px; font-weight: 600;
      color: #5f6368; text-transform: uppercase; letter-spacing: .06em;
    }
    .amd-dropdown-radio {
      display: flex; gap: 6px; padding: 5px 12px 8px;
    }
    .amd-dropdown-radio label {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 13px; color: #3c4043; cursor: pointer; padding: 4px 8px;
      border: 1px solid rgba(0,0,0,.14); border-radius: 9px; background: #fff;
      transition: background .1s, border-color .1s;
    }
    .amd-dropdown-radio label:hover { background: #faf6da; border-color: #e5c614; }
    .amd-dropdown-radio input[type="radio"] { accent-color: #e5c614; cursor: pointer; }
    .amd-dropdown-radio label:has(input:checked) { background: #e5c614; border-color: #e5c614; font-weight: 600; }
    .amd-dropdown-footer {
      padding: 8px 12px; border-top: 1px solid rgba(0,0,0,.07); text-align: right;
    }
    .amd-dropdown-reset {
      background: none; border: none; color: #5f6368; cursor: pointer;
      font-size: 13px; font-weight: 500; padding: 4px 6px;
    }
    .amd-dropdown-reset:hover { color: #c5221f; text-decoration: underline; }
  `
  document.head.appendChild(style)

  const rowStyle = document.createElement('style')
  rowStyle.id = 'andromeda-row-style'
  rowStyle.textContent = `
    :root {
      --amd-copy-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z'/%3E%3Cpath d='M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2'/%3E%3C/svg%3E");
      --amd-pause-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black'%3E%3Crect x='6' y='4' width='4' height='16' rx='1'/%3E%3Crect x='14' y='4' width='4' height='16' rx='1'/%3E%3C/svg%3E");
      --amd-delete-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 7h16'/%3E%3Cpath d='M10 11v6'/%3E%3Cpath d='M14 11v6'/%3E%3Cpath d='M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12'/%3E%3Cpath d='M9 7V4h6v3'/%3E%3C/svg%3E");
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
    .amd-delete-element {
      appearance: none; border: none; padding: 0; outline: none;
      display: inline-flex; align-items: center; justify-content: center;
      cursor: pointer; vertical-align: middle;
      width: 30px; height: 30px; border-radius: 8px;
      background: transparent; opacity: 0; transition: background .12s, opacity .12s;
    }
    [gtm-table-row]:hover .amd-delete-element,
    tr:hover .amd-delete-element { opacity: 1; }
    .amd-delete-element::before {
      content: ''; width: 17px; height: 17px; display: block;
      background-color: #5f6368; transition: background-color .12s;
      -webkit-mask: var(--amd-delete-mask) center / contain no-repeat;
      mask: var(--amd-delete-mask) center / contain no-repeat;
    }
    .amd-delete-element:hover { background: #fce8e6; opacity: 1; }
    .amd-delete-element:hover::before { background-color: #c5221f; }
    .amd-delete-element.amd-delete-err { background: #fce8e6 !important; opacity: 1; transition: none; }
    .amd-delete-element.amd-delete-err::before { background-color: #c5221f !important; }
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
    .amd-modal-msg { color: #137333; font-size: 13px; }
    /* ── Folder badge (inline pill in the name cell) ─────────────── */
    .amd-folder-badge {
      display: inline-flex; align-items: center;
      margin-left: 8px; padding: 1px 7px;
      background: #f1f3f4; border: 1px solid #dadce0; border-radius: 999px;
      font-size: 11px; color: #5f6368; font-weight: 500;
      white-space: nowrap; vertical-align: middle;
      font-family: system-ui, sans-serif; line-height: 1.5;
      cursor: pointer; transition: background .1s, border-color .1s;
      user-select: none;
    }
    .amd-folder-badge:not(.amd-folder-none):hover {
      background: #e8eaed; border-color: #bdc1c6;
    }
    .amd-folder-badge.amd-folder-none {
      opacity: 0.35; cursor: default; letter-spacing: .04em;
    }
    .amd-folder-badge.amd-folder-active {
      background: #e5c614; border-color: #c9ad07; color: #2c2c2a;
    }
    .amd-folder-badge.amd-folder-active:hover {
      background: #d4b412;
    }`
  document.head.appendChild(rowStyle)

  const extraStyle = document.createElement('style')
  extraStyle.id = 'amd-extra-style'
  extraStyle.textContent = `
    /* ── Bulk rename inputs ─────────────────────── */
    .amd-rename-input {
      display: block; width: calc(100% - 8px); margin: 1px 0;
      padding: 3px 7px; border: 1px solid #e5c614; border-radius: 5px;
      font: inherit; outline: none; box-sizing: border-box;
    }
    .amd-rename-input:focus { border-color: #c9ad07; box-shadow: 0 0 0 2px rgba(229,198,20,.25); }
    #${TOOLBAR_ID} .amd-rename-active {
      background: #e5c614; border-color: #c9ad07; color: #2c2c2a; font-weight: 600;
    }
    /* ── Lookup/RegEx table copy-paste ──────────── */
    #amd-table-actions { display: flex; gap: 8px; padding: 6px 0 10px; }
    #amd-table-actions button {
      padding: 5px 12px; border: 1px solid rgba(0,0,0,.14); border-radius: 8px;
      background: #fff; color: #3c4043; font-size: 13px; cursor: pointer;
      transition: background .12s, border-color .12s;
    }
    #amd-table-actions button:hover { background: #faf6da; border-color: #e5c614; }
    /* ── Toast ──────────────────────────────────── */
    .amd-toast {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #2c2c2a; color: #fff; padding: 8px 20px; border-radius: 8px;
      font: 13px/1.4 system-ui, sans-serif; z-index: 99999; pointer-events: none;
    }
    /* ── Paste confirm modal ────────────────────── */
    .amd-table-modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.38); z-index: 99998;
      display: flex; align-items: center; justify-content: center;
    }
    .amd-table-modal {
      background: #fff; border-radius: 12px; padding: 24px; max-width: 380px; width: 90%;
      box-shadow: 0 20px 60px rgba(0,0,0,.22);
      font: 14px/1.5 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-table-modal h3 { margin: 0 0 8px; font-size: 16px; color: #202124; }
    .amd-table-modal p  { margin: 0 0 20px; color: #5f6368; font-size: 13px; }
    .amd-table-modal-btns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .amd-table-modal-btns button {
      padding: 7px 16px; border-radius: 8px; cursor: pointer;
      font: 13px/1 inherit; border: 1px solid transparent;
    }
    .amd-btn-cancel  { background: #f1f3f4; border-color: #dadce0 !important; color: #3c4043; }
    .amd-btn-append  { background: #fff; border-color: #dadce0 !important; color: #1967d2; font-weight: 500; }
    .amd-btn-replace { background: #e5c614; border-color: #e5c614 !important; color: #2c2c2a; font-weight: 600; }
    .amd-table-modal-btns button:hover { filter: brightness(.95); }
    /* ── DataLayer variable creator modal ──────── */
    .amd-dlv-textarea {
      width: 100%; min-height: 72px; max-height: 140px; resize: vertical;
      padding: 8px 10px; border: 1px solid rgba(0,0,0,.16); border-radius: 8px;
      font: 12px/1.5 monospace; outline: none; box-sizing: border-box;
      transition: border-color .12s, box-shadow .12s;
    }
    .amd-dlv-textarea:focus { border-color: #e5c614; box-shadow: 0 0 0 3px rgba(229,198,20,.25); }
    .amd-dlv-sublabel { font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 4px; }
    .amd-dlv-error { color: #c5221f; font-size: 12px; margin-top: 4px; min-height: 16px; }
    .amd-dlv-listheader { display: flex; justify-content: space-between; align-items: center; margin: 12px 0 6px; }
    .amd-dlv-selectall { background: none; border: none; color: #1967d2; font-size: 12px; cursor: pointer; padding: 0; }
    .amd-dlv-list { overflow-y: auto; display: flex; flex-direction: column; gap: 5px; min-height: 40px; max-height: 260px; }
    .amd-dlv-item { display: grid; grid-template-columns: 18px 1fr 1.2fr; align-items: center; gap: 8px; }
    .amd-dlv-item code { font-size: 11px; background: #f1f3f4; padding: 3px 6px; border-radius: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amd-dlv-item input[type="text"] { padding: 5px 8px; border: 1px solid rgba(0,0,0,.16); border-radius: 7px; font-size: 12px; outline: none; transition: border-color .12s; }
    .amd-dlv-item input[type="text"]:focus { border-color: #e5c614; box-shadow: 0 0 0 2px rgba(229,198,20,.2); }
    .amd-dlv-empty { color: #80868b; font-size: 13px; font-style: italic; text-align: center; padding: 14px 0; }
    /* ── DLV wizard sections ───────────────────── */
    .amd-dlv-section { border: 1px solid #dadce0; border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
    .amd-dlv-section-head { display: flex; align-items: center; gap: 8px; padding: 9px 13px; background: #f8f9fa; cursor: pointer; user-select: none; }
    .amd-dlv-section-head:hover { background: #f1f3f4; }
    .amd-dlv-section-toggle { width: 15px; height: 15px; accent-color: #1a73e8; flex-shrink: 0; cursor: pointer; }
    .amd-dlv-section-title { font-size: 13px; font-weight: 600; color: #202124; flex: 1; }
    .amd-dlv-section-badge { background: #e8f0fe; color: #1967d2; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 10px; min-width: 18px; text-align: center; }
    .amd-dlv-section-badge.warn { background: #fce8e6; color: #c5221f; }
    .amd-dlv-section-arrow { color: #80868b; font-size: 10px; transition: transform .15s; display: inline-block; }
    .amd-dlv-section.open > .amd-dlv-section-head .amd-dlv-section-arrow { transform: rotate(180deg); }
    .amd-dlv-section-body { padding: 12px 14px; border-top: 1px solid #e0e0e0; display: none; }
    .amd-dlv-section.open > .amd-dlv-section-body { display: block; }
    .amd-dlv-field { margin-bottom: 10px; }
    .amd-dlv-field:last-child { margin-bottom: 0; }
    .amd-dlv-field > label { display: block; font-size: 12px; color: #5f6368; margin-bottom: 3px; font-weight: 500; }
    .amd-dlv-field input[type="text"], .amd-dlv-field select { width: 100%; padding: 7px 10px; border: 1px solid rgba(0,0,0,.16); border-radius: 8px; font-size: 13px; outline: none; box-sizing: border-box; transition: border-color .12s, box-shadow .12s; }
    .amd-dlv-field input[type="text"]:focus, .amd-dlv-field select:focus { border-color: #e5c614; box-shadow: 0 0 0 3px rgba(229,198,20,.25); }
    .amd-dlv-radios { display: flex; gap: 16px; align-items: center; }
    .amd-dlv-radios label { font-size: 13px; color: #202124; display: flex; align-items: center; gap: 5px; cursor: pointer; }
    .amd-dlv-note { font-size: 12px; color: #80868b; font-style: italic; margin-top: 6px; }
    .amd-dlv-section-disabled .amd-dlv-section-body { opacity: .45; pointer-events: none; }
  `
  document.head.appendChild(extraStyle)
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
        copyRowToNew(currentPage as Exclude<PageType, '' | 'FOLDERS'>, icon, (ok) => {
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

function addDeleteIcons(rows: GtmRow[]) {
  if (currentPage === '' || currentPage === 'FOLDERS') return
  for (const r of rows) {
    const tr =
      (r.node.matches('tr') ? r.node : r.node.querySelector<HTMLElement>('tr')) ?? r.node
    const lastCell =
      tr.querySelector<HTMLElement>(':scope > td:last-child') ??
      tr.querySelector<HTMLElement>('td:last-child')
    if (!lastCell) continue
    if (lastCell.querySelector('.amd-delete-element')) continue
    let group = lastCell.querySelector<HTMLElement>('.amd-icon-group')
    if (!group) {
      group = document.createElement('span')
      group.className = 'amd-icon-group'
      lastCell.appendChild(group)
    }
    const icon = document.createElement('button')
    icon.className = 'amd-delete-element qol-row-not-clickable'
    icon.title = 'Elimina'
    icon.type = 'button'
    icon.addEventListener(
      'click',
      (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        // GTM's native menu will show its own confirm dialog and handles dependency
        // errors (e.g. trigger in use by tags). No window.confirm here.
        deleteRow(currentPage as Exclude<PageType, '' | 'FOLDERS'>, icon, (ok) => {
          if (!ok) {
            icon.classList.add('amd-delete-err')
            setTimeout(() => icon.classList.remove('amd-delete-err'), 1200)
          }
        })
      },
      true,
    )
    group.appendChild(icon)
  }
}

function isServerContainer(): boolean {
  // Angular service probing is unreliable: clientService has getList on both web and sGTM;
  // serverVariableService is not injectable on either. Use DOM instead:
  // sGTM navigation always renders a Clients page link (via ng-if); web containers never do.
  return document.querySelector('a[href*="/clients"]') != null
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

  let facets: ReturnType<typeof facetsFromRows> = []
  try { facets = facetsFromRows(rows) } catch { /* ignore */ }
  let folderFacets: FolderFacet[] = []
  try { folderFacets = foldersFromRows(rows, folderMap) } catch { /* ignore */ }

  if (currentPage !== '' && state.selectedTypes.size === 0 && state.pauseFilter === 'all')
    restoreSelection(currentPage as Exclude<PageType, '' | 'FOLDERS'>, new Set(facets.map((f) => f.type)))

  const commit = () => {
    persistSelection()
    applyToDom(getRowElements(currentPage as Exclude<PageType, '' | 'FOLDERS'>))
    renderBar()
  }

  // ── dropdown ──────────────────────────────────────────────────────────────────
  const dropdown = document.createElement('div')
  dropdown.className = 'amd-dropdown'

  const ddHead = document.createElement('div')
  ddHead.className = 'amd-dropdown-head'
  ddHead.textContent = 'Filtri'
  const ddClose = document.createElement('button')
  ddClose.type = 'button'
  ddClose.className = 'amd-dropdown-close'
  ddClose.textContent = '×'
  ddClose.addEventListener('click', () => dropdown.classList.remove('open'))
  ddHead.appendChild(ddClose)
  dropdown.appendChild(ddHead)

  const ddSearch = document.createElement('input')
  ddSearch.type = 'search'
  ddSearch.className = 'amd-dropdown-search'
  ddSearch.placeholder = 'Cerca tipo…'
  dropdown.appendChild(ddSearch)

  const ddTypes = document.createElement('div')
  ddTypes.className = 'amd-dropdown-types'
  dropdown.appendChild(ddTypes)

  const renderDdTypes = (q = '') => {
    ddTypes.replaceChildren()
    const lq = q.trim().toLowerCase()
    const visible = lq ? facets.filter((f) => f.displayName.toLowerCase().includes(lq)) : facets
    for (const facet of visible) {
      const row = document.createElement('label')
      row.className = 'amd-dropdown-check'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = state.selectedTypes.has(facet.type)
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedTypes.add(facet.type)
        else state.selectedTypes.delete(facet.type)
        commit()
      })
      const name = document.createElement('span')
      name.className = 'amd-dc-name'
      name.textContent = facet.displayName
      const cnt = document.createElement('span')
      cnt.className = 'amd-dc-count'
      cnt.textContent = `${facet.count}`
      row.append(cb, name, cnt)
      ddTypes.appendChild(row)
    }
    if (!visible.length) {
      const empty = document.createElement('div')
      empty.style.cssText = 'padding:10px 12px; color:#5f6368; font-size:13px;'
      empty.textContent = 'Nessun tipo trovato'
      ddTypes.appendChild(empty)
    }
  }
  ddSearch.addEventListener('input', () => renderDdTypes(ddSearch.value))
  renderDdTypes()

  // Pause filter (TAGS only)
  if (currentPage === 'TAGS') {
    const sep = document.createElement('hr')
    sep.className = 'amd-dropdown-sep'
    dropdown.appendChild(sep)

    const pauseLabel = document.createElement('div')
    pauseLabel.className = 'amd-dropdown-section-label'
    pauseLabel.textContent = 'Stato'
    dropdown.appendChild(pauseLabel)

    const radioGroup = document.createElement('div')
    radioGroup.className = 'amd-dropdown-radio'
    const options: Array<[string, string]> = [['all', 'Tutti'], ['active', 'Solo attivi'], ['paused', 'Solo in pausa']]
    for (const [val, label] of options) {
      const lbl = document.createElement('label')
      const rb = document.createElement('input')
      rb.type = 'radio'
      rb.name = 'amd-pause-filter'
      rb.value = val
      rb.checked = state.pauseFilter === val
      rb.addEventListener('change', () => {
        if (rb.checked) {
          state.pauseFilter = val as 'all' | 'paused' | 'active'
          commit()
          radioGroup.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((r) => {
            r.closest('label')?.classList.toggle('checked', r.checked)
          })
        }
      })
      lbl.append(rb, label)
      radioGroup.appendChild(lbl)
    }
    dropdown.appendChild(radioGroup)
  }

  const ddFooter = document.createElement('div')
  ddFooter.className = 'amd-dropdown-footer'
  const ddReset = document.createElement('button')
  ddReset.type = 'button'
  ddReset.className = 'amd-dropdown-reset'
  ddReset.textContent = 'Azzera tutti i filtri'
  ddReset.addEventListener('click', () => {
    state = emptyState()
    dropdown.classList.remove('open')
    commit()
    renderDdTypes(ddSearch.value)
  })
  ddFooter.appendChild(ddReset)
  dropdown.appendChild(ddFooter)

  // ── Folder dropdown (separate button, built only when folders exist) ──────────
  let folderDropdown: HTMLDivElement | null = null
  if (folderFacets.length > 0) {
    folderDropdown = document.createElement('div')
    folderDropdown.className = 'amd-dropdown'

    const fdHead = document.createElement('div')
    fdHead.className = 'amd-dropdown-head'
    fdHead.textContent = 'Cartella'
    const fdClose = document.createElement('button')
    fdClose.type = 'button'
    fdClose.className = 'amd-dropdown-close'
    fdClose.textContent = '×'
    fdClose.addEventListener('click', () => folderDropdown!.classList.remove('open'))
    fdHead.appendChild(fdClose)
    folderDropdown.appendChild(fdHead)

    const fdList = document.createElement('div')
    fdList.className = 'amd-dropdown-types'
    for (const facet of folderFacets) {
      const row = document.createElement('label')
      row.className = 'amd-dropdown-check'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.checked = state.selectedFolders.has(facet.folderId)
      cb.addEventListener('change', () => {
        if (cb.checked) state.selectedFolders.add(facet.folderId)
        else state.selectedFolders.delete(facet.folderId)
        commit()
      })
      const name = document.createElement('span')
      name.className = 'amd-dc-name'
      name.textContent = facet.name
      const cnt = document.createElement('span')
      cnt.className = 'amd-dc-count'
      cnt.textContent = `${facet.count}`
      row.append(cb, name, cnt)
      fdList.appendChild(row)
    }
    folderDropdown.appendChild(fdList)

    const fdFooter = document.createElement('div')
    fdFooter.className = 'amd-dropdown-footer'
    const fdReset = document.createElement('button')
    fdReset.type = 'button'
    fdReset.className = 'amd-dropdown-reset'
    fdReset.textContent = 'Azzera'
    fdReset.addEventListener('click', () => {
      state.selectedFolders.clear()
      folderDropdown!.classList.remove('open')
      commit()
    })
    fdFooter.appendChild(fdReset)
    folderDropdown.appendChild(fdFooter)
  }

  // ── bar content ───────────────────────────────────────────────────────────────
  const renderBar = () => {
    // Remove all children except the dropdown (re-added at end)
    bar!.replaceChildren()

    const typeActiveCount = state.selectedTypes.size + (state.pauseFilter !== 'all' ? 1 : 0)
    const folderActiveCount = state.selectedFolders.size
    const activeCount = typeActiveCount + folderActiveCount

    // Filter trigger button ("Filtri")
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'amd-filter-btn' + (typeActiveCount > 0 ? ' active' : '')

    // SVG funnel icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 16 16')
    svg.setAttribute('width', '14')
    svg.setAttribute('height', '14')
    svg.setAttribute('fill', 'currentColor')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M1 1.5A.5.5 0 0 1 1.5 1h13a.5.5 0 0 1 .4.8L9.5 9.3V14a.5.5 0 0 1-.7.5l-3-1.5A.5.5 0 0 1 5.5 12.5V9.3L1.1 2.3A.5.5 0 0 1 1 1.5z')
    svg.appendChild(path)
    btn.appendChild(svg)

    const btnLabel = document.createTextNode(' Filtri')
    btn.appendChild(btnLabel)
    if (typeActiveCount > 0) {
      const badge = document.createElement('span')
      badge.className = 'amd-filter-badge'
      badge.textContent = String(typeActiveCount)
      btn.appendChild(badge)
    }
    const arrow = document.createElement('span')
    arrow.className = 'amd-filter-arrow'
    arrow.textContent = '▾'
    btn.appendChild(arrow)
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      folderDropdown?.classList.remove('open')
      const isOpen = dropdown.classList.toggle('open')
      if (isOpen) {
        ddSearch.value = ''
        renderDdTypes()
      }
    })
    bar!.appendChild(btn)
    bar!.appendChild(dropdown)

    // Folder filter button ("Cartella ▾") — only when folders exist
    if (folderDropdown) {
      const folderBtn = document.createElement('button')
      folderBtn.type = 'button'
      folderBtn.className = 'amd-filter-btn amd-folder-btn' + (folderActiveCount > 0 ? ' active' : '')

      // folder SVG icon
      const fSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      fSvg.setAttribute('viewBox', '0 0 16 16')
      fSvg.setAttribute('width', '14')
      fSvg.setAttribute('height', '14')
      fSvg.setAttribute('fill', 'currentColor')
      const fPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      fPath.setAttribute('d', 'M.54 3.87.5 3a2 2 0 0 1 2-2h3.19a2 2 0 0 1 1.45.63l.45.52A2 2 0 0 0 9.04 3H13.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H2.5a2 2 0 0 1-2-2V3.87z')
      fSvg.appendChild(fPath)
      folderBtn.appendChild(fSvg)

      folderBtn.appendChild(document.createTextNode(' Cartella'))
      if (folderActiveCount > 0) {
        const fBadge = document.createElement('span')
        fBadge.className = 'amd-filter-badge'
        fBadge.textContent = String(folderActiveCount)
        folderBtn.appendChild(fBadge)
      }
      const fArrow = document.createElement('span')
      fArrow.className = 'amd-filter-arrow'
      fArrow.textContent = '▾'
      folderBtn.appendChild(fArrow)
      folderBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        dropdown.classList.remove('open')
        // Position the folder dropdown below this button
        const rect = folderBtn.getBoundingClientRect()
        const barRect = bar!.getBoundingClientRect()
        folderDropdown!.style.left = `${Math.round(rect.left - barRect.left)}px`
        folderDropdown!.classList.toggle('open')
      })
      bar!.appendChild(folderBtn)
      bar!.appendChild(folderDropdown)
    }

    // Active filter chips (type + pause + folder), shown whenever any filter is on
    if (activeCount > 0) {
      const chipWrap = document.createElement('div')
      chipWrap.className = 'amd-active-chips'

      // Type chips
      for (const type of state.selectedTypes) {
        const facet = facets.find((f) => f.type === type)
        if (!facet) continue
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'amd-active-chip'
        chip.title = `Rimuovi filtro: ${facet.displayName}`
        const chipName = document.createElement('span')
        chipName.textContent = facet.displayName
        const chipX = document.createElement('span')
        chipX.className = 'amd-chip-x'
        chipX.textContent = '×'
        chip.append(chipName, chipX)
        chip.addEventListener('click', () => {
          state.selectedTypes.delete(type)
          commit()
        })
        chipWrap.appendChild(chip)
      }

      // Pause filter chip
      if (state.pauseFilter !== 'all') {
        const pauseChip = document.createElement('button')
        pauseChip.type = 'button'
        pauseChip.className = 'amd-active-chip'
        const pauseName = document.createElement('span')
        pauseName.textContent = state.pauseFilter === 'paused' ? 'Solo in pausa' : 'Solo attivi'
        const pauseX = document.createElement('span')
        pauseX.className = 'amd-chip-x'
        pauseX.textContent = '×'
        pauseChip.append(pauseName, pauseX)
        pauseChip.addEventListener('click', () => {
          state.pauseFilter = 'all'
          commit()
        })
        chipWrap.appendChild(pauseChip)
      }

      // Folder chips
      for (const fid of state.selectedFolders) {
        const folderName = folderMap.get(fid) ?? (fid === '' ? 'Senza cartella' : fid)
        const chip = document.createElement('button')
        chip.type = 'button'
        chip.className = 'amd-active-chip'
        chip.title = `Rimuovi filtro cartella: ${folderName}`
        const chipName = document.createElement('span')
        chipName.textContent = folderName
        const chipX = document.createElement('span')
        chipX.className = 'amd-chip-x'
        chipX.textContent = '×'
        chip.append(chipName, chipX)
        chip.addEventListener('click', () => {
          state.selectedFolders.delete(fid)
          commit()
        })
        chipWrap.appendChild(chip)
      }

      bar!.appendChild(chipWrap)
    }

    // Counter
    const counter = document.createElement('span')
    counter.id = 'amd-visible-count'
    counter.className = 'amd-visible-count'
    bar!.appendChild(counter)

    // Clear button (only when filters active)
    if (activeCount > 0) {
      const clear = document.createElement('button')
      clear.type = 'button'
      clear.className = 'amd-clear'
      clear.textContent = 'Azzera'
      clear.addEventListener('click', () => {
        state = emptyState()
        dropdown.classList.remove('open')
        commit()
      })
      bar!.appendChild(clear)
    }

    // Rename button (all page types)
    const renameBtn = document.createElement('button')
    renameBtn.type = 'button'
    renameBtn.id = 'amd-rename-btn'
    renameBtn.className = 'amd-builtin-toggle' + (renameMode ? ' amd-rename-active' : '')
    renameBtn.textContent = renameMode ? 'Salva nomi' : 'Rinomina…'
    renameBtn.addEventListener('click', () => {
      if (renameMode) confirmRenames()
      else enterRenameMode()
    })
    bar!.appendChild(renameBtn)
    if (renameMode) {
      const cancelBtn = document.createElement('button')
      cancelBtn.type = 'button'
      cancelBtn.id = 'amd-rename-cancel'
      cancelBtn.className = 'amd-builtin-toggle'
      cancelBtn.textContent = 'Annulla'
      cancelBtn.addEventListener('click', () => exitRenameMode())
      bar!.appendChild(cancelBtn)
    }

    // Variables-page extras
    if (currentPage === 'VARIABLES' && hasBuiltInVariables()) {
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'amd-builtin-toggle'
      const refreshLabel = () => {
        toggle.textContent = builtInVarsCollapsed ? 'Mostra variabili integrate' : 'Nascondi variabili integrate'
      }
      refreshLabel()
      setBuiltInVariablesCollapsed(builtInVarsCollapsed)
      toggle.addEventListener('click', () => {
        builtInVarsCollapsed = !builtInVarsCollapsed
        setBuiltInVariablesCollapsed(builtInVarsCollapsed)
        refreshLabel()
      })
      bar!.appendChild(toggle)
    }
    if (currentPage === 'VARIABLES') {
      const editBtn = document.createElement('button')
      editBtn.type = 'button'
      editBtn.className = 'amd-builtin-toggle'
      editBtn.textContent = 'Etichette tipi…'
      editBtn.addEventListener('click', () => openLabelEditor())
      bar!.appendChild(editBtn)

      if (!isServerContainer()) {
        const dlvBtn = document.createElement('button')
        dlvBtn.type = 'button'
        dlvBtn.className = 'amd-builtin-toggle'
        dlvBtn.textContent = 'Da push datalayer…'
        dlvBtn.title = 'Crea variabili "Variabile livello dati" da un push JSON'
        dlvBtn.addEventListener('click', () => showDlvFromPushModal())
        bar!.appendChild(dlvBtn)
      } else {
        const edvBtn = document.createElement('button')
        edvBtn.type = 'button'
        edvBtn.className = 'amd-builtin-toggle'
        edvBtn.textContent = 'Da evento server…'
        edvBtn.title = 'Crea variabili Event Data da un evento GA4 server (incolla il JSON da Tag Assistant)'
        edvBtn.addEventListener('click', () => showEventDataWizardModal())
        bar!.appendChild(edvBtn)
      }
    }

    updateVisibleCount(getRowElements(currentPage as Exclude<PageType, '' | 'FOLDERS'>))
  }

  renderBar()

  // Close dropdown on outside click
  if (!window.__amdDropdownBound) {
    window.__amdDropdownBound = true
    document.addEventListener('click', (e) => {
      const open = document.querySelector(`#${TOOLBAR_ID} .amd-dropdown.open`) as HTMLElement | null
      if (open && !open.closest(`#${TOOLBAR_ID}`)?.contains(e.target as Node)) {
        open.classList.remove('open')
      }
    }, true)
  }

  // Keep counter in sync with GTM's native search
  const nativeSearch = findNativeSearch()
  if (nativeSearch && !nativeSearch.dataset.amdBound) {
    nativeSearch.dataset.amdBound = '1'
    nativeSearch.addEventListener('input', () => {
      requestAnimationFrame(() =>
        updateVisibleCount(getRowElements(currentPage as Exclude<PageType, '' | 'FOLDERS'>)),
      )
    })
  }

  // '/' shortcut focuses GTM's native search
  if (!window.__amdSlashBound) {
    window.__amdSlashBound = true
    document.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || !!t.closest('input, textarea, [contenteditable]'))) return
      const search = findNativeSearch()
      if (search) { e.preventDefault(); e.stopPropagation(); search.focus() }
    }, true)
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
  let lastCheckedState: boolean | null = null

  // gtm-table-row-checkbox is an Angular custom element (tag name, not attribute).
  // The visual state lives on the <i> inside it via aria-checked.
  const CHECKBOX_SEL = 'gtm-table-row-checkbox'
  const ICON_SEL     = 'gtm-table-row-checkbox i'
  const ROW_SEL      = '[gtm-table-row]'

  function rowChecked(row: HTMLElement): boolean {
    const icon = row.querySelector<HTMLElement>(ICON_SEL)
    if (icon) return icon.getAttribute('aria-checked') === 'true'
    const input = row.querySelector<HTMLInputElement>(`${CHECKBOX_SEL} input[type="checkbox"]`)
    if (input) return input.checked
    return false
  }

  function clickCheckbox(row: HTMLElement) {
    // Prefer clicking the <i> (visual checkbox icon) — same target as Stape.
    const icon = row.querySelector<HTMLElement>(ICON_SEL)
    if (icon) { icon.click(); return }
    const cb = row.querySelector<HTMLElement>(CHECKBOX_SEL)
    if (cb) cb.click()
  }

  document.addEventListener(
    'click',
    (e: MouseEvent & { __amdBulk?: boolean }) => {
      if (e.__amdBulk) return // our own synthetic click — skip
      const target = e.target as HTMLElement

      // Only trigger on clicks that land inside the checkbox component
      const checkboxEl = target.closest<HTMLElement>(CHECKBOX_SEL)
      if (!checkboxEl) return
      const row = checkboxEl.closest<HTMLElement>(ROW_SEL)
      if (!row) return
      const table = row.closest<HTMLElement>('table')
      if (!table) return

      if (!e.shiftKey || !lastRow || lastRow.closest('table') !== table) {
        // Normal click: record this row and its POST-click checked state (rAF so
        // Angular has time to update aria-checked before we read it).
        requestAnimationFrame(() => {
          lastCheckedState = rowChecked(row)
        })
        lastRow = row
        return
      }

      // Shift+click: select range
      e.preventDefault()
      e.stopPropagation()

      const allRows = Array.from(table.querySelectorAll<HTMLElement>(ROW_SEL))
      const currentIdx = allRows.indexOf(row)
      const lastIdx    = allRows.indexOf(lastRow)
      if (currentIdx < 0 || lastIdx < 0) return

      // Target state: same as the last-clicked row after its toggle
      const target_ = lastCheckedState ?? true

      const start = Math.min(lastIdx, currentIdx)
      const end   = Math.max(lastIdx, currentIdx)

      // Batch in rAF chunks to stay responsive on large lists
      const batch = (from: number) => {
        const to = Math.min(from + 25, end)
        for (let i = from; i <= to; i++) {
          if (rowChecked(allRows[i]) !== target_) clickCheckbox(allRows[i])
        }
        if (to < end) requestAnimationFrame(() => batch(to + 1))
      }
      batch(start)

      lastRow = row
      lastCheckedState = target_
    },
    true,
  )
}

// ── Folder page constants ────────────────────────────────────────────────────
const FOLDER_TOOLBAR_ID = 'amd-folder-toolbar'
const FOLDER_STYLE_ID   = 'amd-folder-styles'
let folderSearchQuery   = ''

/** Stable color derived from folder name (for accent bars + stats). */
function folderColor(name: string): string {
  let h = 0
  for (const c of name) h = ((h * 31 + c.charCodeAt(0)) | 0)
  const palette = ['#4285f4','#0f9d58','#9c27b0','#f4b400','#db4437','#00bcd4','#ff5722','#607d8b']
  return palette[Math.abs(h) % palette.length]
}

/** Folder name without the "(N)" count from the h3. */
function folderCardName(card: HTMLElement): string {
  const h3 = card.querySelector('.gtm-folder-name h3')
  if (!h3) return ''
  const clone = h3.cloneNode(true) as HTMLElement
  clone.querySelectorAll('span').forEach((s) => s.remove())
  // After removing count spans the text is "Name () " — strip trailing empty parens
  return (clone.textContent ?? '').trim().replace(/\s*\(\s*\)\s*$/, '').trim()
}

function injectFolderPageStyles() {
  if (document.getElementById(FOLDER_STYLE_ID)) return
  const s = document.createElement('style')
  s.id = FOLDER_STYLE_ID
  s.textContent = `
    /* ── Folder page toolbar ─────────────────────────────── */
    #${FOLDER_TOOLBAR_ID} {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; margin-bottom: 10px;
      background: #fff; border: 1px solid rgba(0,0,0,.1);
      border-radius: 10px; font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    #${FOLDER_TOOLBAR_ID} .amd-fl-search {
      flex: 1; padding: 6px 11px; border: 1px solid rgba(0,0,0,.16);
      border-radius: 8px; font: 13px/1.4 system-ui, sans-serif;
      outline: none; transition: border-color .12s;
    }
    #${FOLDER_TOOLBAR_ID} .amd-fl-search:focus {
      border-color: #e5c614; box-shadow: 0 0 0 2px rgba(229,198,20,.2);
    }
    #${FOLDER_TOOLBAR_ID} .amd-fl-count { font-size:12px; color:#5f6368; white-space:nowrap; }
    /* ── Folder cards visual redesign ───────────────────── */
    .gtm-folder-card {
      position: relative !important;
      border-radius: 10px !important; overflow: hidden !important;
      box-shadow: 0 1px 5px rgba(0,0,0,.09) !important;
      transition: box-shadow .15s !important;
    }
    .gtm-folder-card:hover { box-shadow: 0 3px 14px rgba(0,0,0,.14) !important; }
    .gtm-folder-name {
      display: flex !important; align-items: center !important;
      background: #fafafa !important; border-bottom: 1px solid rgba(0,0,0,.06) !important;
    }
    .gtm-folder-name h3 { font-size:14px !important; font-weight:600 !important; color:#202124 !important; }
    /* ── Accent block (full-height left color strip) ────── */
    .amd-folder-accent {
      position: absolute; left: 0; top: 0; bottom: 0;
      width: 6px; flex-shrink: 0; pointer-events: none;
    }
    .gtm-folder-name h3 { margin-left: 12px !important; }
    /* ── Stats pills ─────────────────────────────────────── */
    .amd-folder-stats {
      margin-left: auto; margin-right: 10px;
      display: flex; gap: 5px; align-items: center;
    }
    .amd-folder-stat {
      display: inline-flex; align-items: center;
      padding: 2px 7px; border-radius: 999px;
      font: 500 11px/1.5 system-ui, sans-serif;
    }
    .amd-fs-tag      { background:#e8f0fe; color:#1a73e8; }
    .amd-fs-trigger  { background:#e6f4ea; color:#188038; }
    .amd-fs-variable { background:#fce8e6; color:#c5221f; }
    .amd-fs-client   { background:#fef9e7; color:#e37400; }
    /* ── Search hide ────────────────────────────────────── */
    .gtm-folder-card.amd-fl-hidden { display: none !important; }
  `
  document.head.appendChild(s)
}

function injectFolderToolbar(cards: HTMLElement[]) {
  if (document.getElementById(FOLDER_TOOLBAR_ID)) {
    applyFolderSearch(cards)
    return
  }
  const bar = document.createElement('div')
  bar.id = FOLDER_TOOLBAR_ID
  cards[0].insertAdjacentElement('beforebegin', bar)

  const input = document.createElement('input')
  input.type = 'search'
  input.className = 'amd-fl-search'
  input.placeholder = 'Cerca cartella…'
  input.value = folderSearchQuery
  input.addEventListener('input', () => {
    folderSearchQuery = input.value.trim().toLowerCase()
    applyFolderSearch(cards)
    updateFolderCount(cards)
  })
  bar.appendChild(input)

  const counter = document.createElement('span')
  counter.className = 'amd-fl-count'
  counter.id = 'amd-fl-count'
  bar.appendChild(counter)
  updateFolderCount(cards)
}

function applyFolderSearch(cards: HTMLElement[]) {
  for (const card of cards) {
    const name = folderCardName(card).toLowerCase()
    card.classList.toggle('amd-fl-hidden', !!folderSearchQuery && !name.includes(folderSearchQuery))
  }
  updateFolderCount(cards)
}

function updateFolderCount(cards: HTMLElement[]) {
  const el = document.getElementById('amd-fl-count')
  if (!el) return
  const visible = cards.filter((c) => !c.classList.contains('amd-fl-hidden')).length
  el.textContent = `${visible} di ${cards.length} cartel${visible === 1 ? 'la' : 'le'}`
}

function enhanceFolderCard(card: HTMLElement) {
  const header = card.querySelector<HTMLElement>('.gtm-folder-name')
  if (!header) return

  // Colored left accent bar spanning full card height (injected once)
  if (!card.querySelector('.amd-folder-accent')) {
    const name  = folderCardName(card)
    const color = folderColor(name || 'unfiled')
    const bar   = document.createElement('div')
    bar.className = 'amd-folder-accent'
    bar.style.background = color
    card.insertBefore(bar, card.firstChild)
  }

  // Stats pills from Angular scope (injected once; silently skipped if unavailable)
  if (!header.querySelector('.amd-folder-stats')) {
    try {
      const scope  = window.angular?.element(card).scope() as Record<string, unknown> | undefined
      const folder = scope?.['folder'] as Record<string, unknown> | undefined
      if (folder) {
        const count = (key: string) => {
          const v = folder[key]
          return Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0
        }
        const tags      = count('tagList')      || count('tags')
        const triggers  = count('triggerList')  || count('triggers')
        const variables = count('variableList') || count('variables')
        const clients   = count('clientList')   || count('clients')
        if (tags + triggers + variables + clients > 0) {
          const stats = document.createElement('div')
          stats.className = 'amd-folder-stats'
          const pill = (n: number, label: string, cls: string) => {
            if (!n) return
            const p = document.createElement('span')
            p.className = `amd-folder-stat ${cls}`
            p.textContent = `${n} ${label}`
            stats.appendChild(p)
          }
          pill(tags,      'tag',     'amd-fs-tag')
          pill(triggers,  'trigger', 'amd-fs-trigger')
          pill(variables, 'var',     'amd-fs-variable')
          pill(clients,   'client',  'amd-fs-client')
          header.appendChild(stats)
        }
      }
    } catch { /* Angular debug info disabled — skip stats */ }
  }
}

/** Folder-page handler (called by sync when page === 'FOLDERS'). */
function syncFolderPage() {
  // Do NOT call ensureFolderMap() here: folderService.getList() called from
  // the Folders page uses an empty context (triggers a 404) because the Angular
  // app state lacks workspace coordinates on that route.  The map is loaded
  // correctly from the Tags/Triggers/Variables pages where context is valid.
  if (!folderPageScanned) scanFolderPageDom()

  const page = document.querySelector('.gtm-folder-page')
  if (!page) return
  const cards = Array.from(page.querySelectorAll<HTMLElement>('.gtm-folder-card'))
  if (cards.length === 0) return

  injectFolderPageStyles()
  injectFolderToolbar(cards)
  for (const card of cards) enhanceFolderCard(card)

  // Auto-open folder card if we navigated here from a pill click
  const pendingFolder = sessionStorage.getItem('amd-open-folder')
  if (pendingFolder) {
    sessionStorage.removeItem('amd-open-folder')
    setTimeout(() => {
      const allCards = Array.from(document.querySelectorAll<HTMLElement>('.gtm-folder-card'))
      const target = allCards.find((c) => folderCardName(c) === pendingFolder)
      if (!target) return
      // Try Angular scope toggle first, fall back to DOM click
      let opened = false
      try {
        const scope = window.angular?.element(target).scope() as Record<string, unknown> | undefined
        if (scope) {
          for (const key of ['isExpanded', 'expanded', 'isOpen', 'open', 'show', 'showContent']) {
            if (key in scope && typeof scope[key] === 'boolean' && !scope[key]) {
              scope[key] = true
              ;(scope as { $apply?: () => void }).$apply?.()
              opened = true
              break
            }
          }
        }
      } catch { /* Angular debug info disabled */ }
      if (!opened) {
        // Click the unfold-more icon (expand toggle); fall back to header div
        const clickTarget =
          target.querySelector<HTMLElement>('.gtm-unfold-more-icon') ??
          target.querySelector<HTMLElement>('.gtm-folder-name') ??
          target
        clickTarget.click()
      }
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
    }, 500)
  }
}

/**
 * One-time DOM scan — retries until Angular has rendered the folder rows.
 * Looks for [gtm-table-row] elements inside the folder page, then walks up
 * the ancestor chain to map the full section structure.
 */
function scanFolderPageDom(attempt = 0) {
  const page = document.querySelector('.gtm-folder-page')
  if (!page) { if (attempt < 8) setTimeout(() => scanFolderPageDom(attempt + 1), 300); return }

  // The page always has 2 header divs; wait until Angular adds folder sections
  const allChildren = Array.from(page.children)
  const sections = allChildren.filter((el) => !el.classList.contains('gtm-folder-header'))
  if (sections.length === 0) {
    if (attempt < 12) setTimeout(() => scanFolderPageDom(attempt + 1), 300)
    return
  }

  folderPageScanned = true

  // Log the non-header sections
  const sectionInfo = sections.map((el) => ({
    tag: el.tagName,
    class: (el as HTMLElement).className,
    childCount: el.children.length,
    innerHTML200: (el as HTMLElement).innerHTML.slice(0, 200),
  }))
  console.log('[LL] folder sections found:', sectionInfo)
  console.log('[LL] first section outerHTML[:1200]:', (sections[0] as HTMLElement).outerHTML.slice(0, 1200))
}

/** Re-read rows and refresh toolbar + visibility. `rebuild` re-renders chips. */
function sync(rebuild = false) {
  const page = pageType()
  if (page === '') {
    document.getElementById(TOOLBAR_ID)?.remove()
    currentPage = ''
    return
  }
  if (page === 'FOLDERS') {
    if (page !== currentPage) { currentPage = page; rebuild = true }
    syncFolderPage()
    return
  }
  if (page !== currentPage) {
    currentPage = page
    state = emptyState() // reset when moving between tags/triggers/variables
    renameMode = false   // cancel any in-progress rename when navigating
    folderColumnIndex = -1 // re-detect folder column on page type change
    rebuild = true
  }
  // Kick off folder data load (no-op if already loaded or loading)
  ensureFolderMap()
  const rows = getRowElements(page)
  const bar = document.getElementById(TOOLBAR_ID)
  if (rows.length === 0) return
  // Rebuild when folder data has arrived but the toolbar was built before it was
  // available (no .amd-folder-btn in the bar yet, even though folders now exist).
  const folderBtnMissing = folderMap.size > 0 && !bar?.querySelector('.amd-folder-btn')
  if (rebuild || !bar || !bar.isConnected || folderBtnMissing) {
    injectStyleOnce()
    renderToolbar(rows)
  }
  // Re-assert the built-in variables collapse on every sync (GTM re-renders it).
  if (page === 'VARIABLES' && builtInVarsCollapsed) setBuiltInVariablesCollapsed(true)
  applyToDom(rows)
  addTypeIcons(rows)
  addFolderBadges(rows)
  addCopyIcons(rows)
  addPauseIcons(rows)
  addDeleteIcons(rows)
  initBulkSelection()
  injectTableCopyPasteButtons()
}

// ── Bulk Rename ───────────────────────────────────────────────────────────────

function enterRenameMode() {
  if (currentPage === '') return
  renameMode = true
  renderToolbar(getRowElements(currentPage as Exclude<PageType, '' | 'FOLDERS'>))

  for (const rowEl of document.querySelectorAll<HTMLElement>('[gtm-table-row]')) {
    if (rowEl.querySelector('.amd-rename-input')) continue
    const cell = rowEl.querySelector('td:nth-child(2)')
    if (!cell) continue
    const link = cell.querySelector('a')
    if (!link) continue

    const clone = link.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.amd-type-icon, .amd-type-initial').forEach((el) => el.remove())
    const origName = (clone.textContent ?? '').trim()

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'amd-rename-input'
    input.value = origName
    input.dataset.amdOrig = origName
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); confirmRenames() }
      if (e.key === 'Escape') exitRenameMode()
    })
    link.style.display = 'none'
    link.insertAdjacentElement('afterend', input)
  }
}

function exitRenameMode() {
  renameMode = false
  for (const input of document.querySelectorAll<HTMLInputElement>('.amd-rename-input')) {
    const link = input.previousElementSibling as HTMLElement | null
    if (link?.tagName === 'A') link.style.display = ''
    input.remove()
  }
  renderToolbar(getRowElements(currentPage as Exclude<PageType, '' | 'FOLDERS'>))
}

function confirmRenames() {
  if (currentPage === '') return
  const page = currentPage as Exclude<PageType, '' | 'FOLDERS'>

  const changes = Array.from(document.querySelectorAll<HTMLInputElement>('.amd-rename-input'))
    .map((input) => ({
      input,
      rowEl: input.closest<HTMLElement>('[gtm-table-row]'),
      newName: input.value.trim(),
      origName: input.dataset.amdOrig ?? '',
    }))
    .filter(({ rowEl, newName, origName }) => !!rowEl && !!newName && newName !== origName)

  if (changes.length === 0) { exitRenameMode(); return }

  const btn = document.getElementById('amd-rename-btn') as HTMLButtonElement | null
  if (btn) { btn.textContent = `Rinominando 0/${changes.length}…`; btn.disabled = true }
  const cancelBtn = document.getElementById('amd-rename-cancel') as HTMLButtonElement | null
  if (cancelBtn) cancelBtn.disabled = true

  let done = 0
  let failed = 0

  const onResult = (ok: boolean) => {
    if (ok) done++; else failed++
    const total = done + failed
    if (btn) btn.textContent = `Rinominando ${total}/${changes.length}…`
    if (total < changes.length) return
    if (failed > 0) {
      if (btn) {
        btn.textContent = `${failed} error${failed > 1 ? 'i' : 'e'} su ${changes.length}`
        btn.disabled = false
        btn.style.color = '#c5221f'
      }
      setTimeout(() => exitRenameMode(), 2500)
    } else {
      exitRenameMode()
    }
  }

  changes.forEach(({ rowEl, newName }, idx) => {
    setTimeout(() => {
      if (rowEl) renameElement(page, rowEl, newName, onResult)
      else onResult(false)
    }, idx * 1200)
  })
}

// ── Lookup / RegEx Table copy-paste ──────────────────────────────────────────

type TableListItem = { mapValue: Array<{ string: string }> }

function getTableAddRowBtn(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-ng-click="ctrl.addRow()"]')
}

/** Walks ctrl.instance.paramMap.map.value.listItem and returns the live array
 *  if found. maxDepth controls how many parent scopes to try. */
function tryExtractTable(
  scope: Record<string, unknown> | undefined,
  maxDepth = 6,
): TableListItem[] | null {
  let s: Record<string, unknown> | undefined = scope
  for (let i = 0; i < maxDepth && s; i++) {
    try {
      const ctrl = (s['ctrl'] ?? s['$ctrl']) as Record<string, unknown> | undefined
      if (ctrl && typeof ctrl === 'object') {
        const instance = ctrl['instance'] as Record<string, unknown> | undefined
        const paramMap = instance?.['paramMap'] as Record<string, unknown> | undefined
        const map = paramMap?.['map'] as Record<string, unknown> | undefined
        const value = map?.['value'] as Record<string, unknown> | undefined
        const listItem = value?.['listItem']
        if (Array.isArray(listItem)) return listItem as TableListItem[]
      }
    } catch { /* ignore */ }
    s = s['$parent'] as Record<string, unknown> | undefined
  }
  return null
}

/** After modifying listItem directly, trigger Angular's update cycle by clicking
 *  the DOM add-row button (which runs inside Zone.js, properly scheduling a $digest).
 *  addRow() appends one empty item — we pop it immediately so only our data remains. */
/** Click the delete button of the last visible simple-table row. */
function clickDeleteLastRow() {
  const rows = document.querySelectorAll<HTMLElement>('.simple-table-row')
  const lastRow = rows[rows.length - 1]
  if (!lastRow) return
  const btn =
    lastRow.querySelector<HTMLElement>('[data-ng-click*="deleteRow"]') ??
    lastRow.querySelector<HTMLElement>('button:last-child')
  btn?.click()
}

/** Delete all existing rows by clicking their delete buttons. */
function clickDeleteAllRows() {
  let safety = 200
  while (safety-- > 0) {
    const rows = document.querySelectorAll<HTMLElement>('.simple-table-row')
    if (rows.length === 0) break
    const lastRow = rows[rows.length - 1]
    const btn =
      lastRow.querySelector<HTMLElement>('[data-ng-click*="deleteRow"]') ??
      lastRow.querySelector<HTMLElement>('button:last-child')
    if (!btn) break
    btn.click()
  }
}

/** Paste rows by clicking addRow for each entry, then reading the fresh listItem
 *  reference and writing values on the newly added row — same pattern as Andromeda's
 *  ctrl.addRow() + immediate set, but via DOM clicks to avoid the tableHelper issue. */
function pasteRowsByClick(rowsData: Array<[string, string]>) {
  const addRowBtn = getTableAddRowBtn()
  if (!addRowBtn) return
  for (const [key, val] of rowsData) {
    addRowBtn.click()
    const currentItems = getTableListItemArray()
    if (!currentItems || currentItems.length === 0) break
    const last = currentItems[currentItems.length - 1]
    if (last?.mapValue?.[0] != null) last.mapValue[0].string = key
    if (last?.mapValue?.[1] != null) last.mapValue[1].string = val
  }
  // Final addRow + deleteRow forces a digest that commits the last row's values
  addRowBtn.click()
  clickDeleteLastRow()
}

/** Candidate DOM elements whose Angular scope might carry the table ctrl.
 *  Exported for diagnostic logging. */
function tableScopeCandidates(): Element[] {
  const btn = getTableAddRowBtn()
  if (!btn) return []
  return [
    btn,
    btn.parentElement,
    btn.closest('.blg-form-input'),
    btn.closest('.simple-table')?.parentElement ?? null,
    btn.closest('[data-ng-controller]'),
    document.querySelector('.gtm-veditor-section'),
    document.querySelector('[data-ng-form]'),
    document.querySelector('.blg-sheet-content'),
  ].filter((el): el is Element => el != null)
}

function getTableListItemArray(): TableListItem[] | null {
  if (!window.angular) return null

  // Strategy 1: DOM scope() — works when Angular debug info is enabled
  for (const el of tableScopeCandidates()) {
    try {
      const scope = window.angular.element(el).scope() as Record<string, unknown> | undefined
      const found = tryExtractTable(scope)
      if (found) return found
    } catch { /* ignore */ }
  }

  // Strategy 2: $rootScope traversal — collects ALL listItem arrays, then picks
  // the one whose length matches the visible DOM row count (disambiguates between
  // the active editor and stale scopes from previously opened variables).
  try {
    const inj = window.angular.element(document.body).injector()
    if (!inj) return null
    const rootScope = inj.get<Record<string, unknown>>('$rootScope')
    if (!rootScope) return null

    const candidates: TableListItem[][] = []

    function collect(scope: Record<string, unknown> | null | undefined, depth: number) {
      if (!scope || depth > 80) return
      const found = tryExtractTable(scope, 1)
      if (found) candidates.push(found)
      collect(scope['$$childHead'] as Record<string, unknown> | null | undefined, depth + 1)
      collect(scope['$$nextSibling'] as Record<string, unknown> | null | undefined, depth)
    }
    collect(rootScope['$$childHead'] as Record<string, unknown> | null | undefined, 0)

    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]

    // Count rows currently rendered in the DOM by GTM's simple-table component.
    const domRowCount = document.querySelectorAll('.simple-table-row').length
    const exact = candidates.filter((items) => items.length === domRowCount)
    if (exact.length === 1) return exact[0]

    // Still ambiguous — prefer the last scope found in DFS (most recently opened editor).
    return candidates[candidates.length - 1]
  } catch {
    return null
  }
}

function injectTableCopyPasteButtons() {
  const addRowBtn = getTableAddRowBtn()
  if (!addRowBtn) {
    document.getElementById('amd-table-actions')?.remove()
    return
  }
  if (document.getElementById('amd-table-actions')) return

  const actions = document.createElement('div')
  actions.id = 'amd-table-actions'

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.textContent = 'Copia tabella'
  copyBtn.title = 'Copia tutte le righe (Ctrl+C)'
  copyBtn.addEventListener('click', () => copyTable())

  const pasteBtn = document.createElement('button')
  pasteBtn.type = 'button'
  pasteBtn.textContent = 'Incolla'
  pasteBtn.title = 'Incolla righe (Ctrl+V)'
  pasteBtn.addEventListener('click', () => {
    navigator.clipboard.readText()
      .then((text) => pasteTable(text))
      .catch(() => pasteTable(''))
  })

  actions.append(copyBtn, pasteBtn)

  // Insert just before the table section that contains the add-row button
  const tableSection =
    addRowBtn.closest<HTMLElement>('.blg-form-input') ??
    addRowBtn.closest<HTMLElement>('[diff-field]') ??
    addRowBtn.parentElement
  if (tableSection) {
    tableSection.insertAdjacentElement('beforebegin', actions)
  } else {
    addRowBtn.insertAdjacentElement('beforebegin', actions)
  }

  // Keyboard shortcuts — set up once per page-world session
  if (!window.__amdTableKbBound) {
    window.__amdTableKbBound = true
    document.addEventListener('keydown', (e) => {
      if (!getTableAddRowBtn()) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copyTable() }
      else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText()
          .then((text) => pasteTable(text))
          .catch(() => pasteTable(''))
      }
    }, true)
  }
}

function copyTable() {
  const items = getTableListItemArray()
  if (!items) { showToast('Tabella non trovata'); return }
  copiedTableRows = JSON.parse(JSON.stringify(items)) as unknown[]
  // Write TSV to system clipboard so paste works across tabs and Chrome profiles
  const tsv = items.map((r) => `${r.mapValue[0]?.string ?? ''}\t${r.mapValue[1]?.string ?? ''}`).join('\n')
  navigator.clipboard.writeText(tsv).catch(() => {})
  showToast(`${items.length} rig${items.length === 1 ? 'a' : 'he'} copiata`)
}

function pasteTable(clipboardText: string) {
  const hasCopied = copiedTableRows.length > 0
  const hasText = clipboardText.trim() !== ''
  if (!hasCopied && !hasText) { showToast('Nessun dato da incollare'); return }
  if (!getTableAddRowBtn()) { showToast('Editor tabella non trovato'); return }

  // Use DOM row count (not items.length) to decide whether to show the modal —
  // more reliable since it reflects what's actually visible.
  const existingDomRows = document.querySelectorAll('.simple-table-row').length

  const doInsert = (action: 'replace' | 'append') => {
    if (action === 'replace') clickDeleteAllRows()

    if (hasCopied) {
      const fresh = JSON.parse(JSON.stringify(copiedTableRows)) as TableListItem[]
      copiedTableRows = []
      pasteRowsByClick(fresh.map((r) => [r.mapValue[0]?.string ?? '', r.mapValue[1]?.string ?? '']))
      showToast(`${fresh.length} rig${fresh.length === 1 ? 'a' : 'he'} incollata`)
    } else {
      const rowsData: Array<[string, string]> = []
      for (const line of clipboardText.split('\n')) {
        const [rawKey, rawVal = ''] = line.split('\t')
        const key = rawKey.trim()
        if (key) rowsData.push([key, rawVal.trim()])
      }
      pasteRowsByClick(rowsData)
      showToast(`${rowsData.length} rig${rowsData.length === 1 ? 'a' : 'he'} incollata`)
    }
  }

  if (existingDomRows > 0) {
    void showTablePasteModal().then((action) => {
      if (action === 'cancel') { showToast('Operazione annullata'); return }
      doInsert(action)
    })
  } else {
    doInsert('append')
  }
}

function showTablePasteModal(): Promise<'replace' | 'append' | 'cancel'> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'amd-table-modal-overlay'

    const modal = document.createElement('div')
    modal.className = 'amd-table-modal'

    const title = document.createElement('h3')
    title.textContent = 'Righe esistenti'

    const body = document.createElement('p')
    body.textContent = 'La tabella contiene già delle righe. Vuoi sostituirle o aggiungere le nuove in fondo?'

    const btns = document.createElement('div')
    btns.className = 'amd-table-modal-btns'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'amd-btn-cancel'
    cancelBtn.textContent = 'Annulla'

    const appendBtn = document.createElement('button')
    appendBtn.className = 'amd-btn-append'
    appendBtn.textContent = 'Aggiungi in fondo'

    const replaceBtn = document.createElement('button')
    replaceBtn.className = 'amd-btn-replace'
    replaceBtn.textContent = 'Sostituisci tutto'

    btns.append(cancelBtn, appendBtn, replaceBtn)
    modal.append(title, body, btns)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const cleanup = (result: 'replace' | 'append' | 'cancel') => {
      overlay.remove()
      resolve(result)
    }
    cancelBtn.addEventListener('click', () => cleanup('cancel'))
    appendBtn.addEventListener('click', () => cleanup('append'))
    replaceBtn.addEventListener('click', () => cleanup('replace'))
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup('cancel') })
  })
}

// ── DataLayer Variable creator ────────────────────────────────────────────────

/** Normalise JS/JSON push text so JSON.parse can handle it:
 *  - strips dataLayer.push( ... ) wrapper
 *  - joins JS string concatenations: "foo" + "bar" → "foobar"
 *  - quotes unquoted JS object keys (incl. dotted keys like gtm.uniqueEventId)
 *  - removes trailing commas before } or ] */
function preprocessJsPush(raw: string): string {
  let s = raw.trim()
  // Strip dataLayer.push( ... ) or window.dataLayer.push( ... ) wrapper
  const wrapMatch = s.match(/^(?:window\.)?dataLayer\.push\(\s*([\s\S]*?)\s*\)\s*;?\s*$/)
  if (wrapMatch) s = wrapMatch[1].trim()
  // Join JS string concatenations: "abc" + "def" → "abcdef"
  s = s.replace(/"\s*\+\s*"/g, '')
  // Quote unquoted JS object keys (e.g. event: → "event":, gtm.uniqueEventId: → "gtm.uniqueEventId":)
  // Only matches after { or , so already-quoted keys and string values are unaffected
  s = s.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_.$]*)\s*:/g, '$1"$2":')
  // Remove trailing commas before closing brace/bracket
  s = s.replace(/,(\s*[}\]])/g, '$1')
  return s
}

/** Extract all dot-notation paths from a dataLayer push object.
 *  Arrays are treated as leaf nodes; `event` is skipped (GTM built-in). */
function parseDataLayerPaths(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return prefix ? [prefix] : []
  }
  const paths: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!prefix && (k === 'event' || k.startsWith('gtm.'))) continue
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const nested = parseDataLayerPaths(v, path)
      paths.push(...(nested.length > 0 ? nested : [path]))
    } else {
      paths.push(path)
    }
  }
  return paths
}

// Keys to skip from sGTM event model (internal/system fields)
const EDV_SKIP_RE = /^(x-ga-|x-sst-|gtm[_.]|_ga)/

function parseEventDataKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj)
    .filter(k => !EDV_SKIP_RE.test(k))
    .sort()
}

// GA4 Measurement Protocol params that carry no event-model semantics
const MP_SKIP = new Set([
  'v', 't', 'tid', 'cid', '_p', 'dl', 'ul', 'sr', 'vp', 'dr',
  '_fv', '_nsi', '_ss', '_dbg', 'tfd', '_z', 'gtm', 'gaz', '_gaz',
  'richsstsse', 'uaa', 'uab', 'uafvl', 'uam', 'uap', 'uapv',
])

/**
 * Parses a GA4 Measurement Protocol query string (or full URL) into a flat
 * event-model object equivalent to what the sGTM GA4 client produces.
 * ep.X  → X  (event params)
 * up.X  → X  (user properties — treated same as event params for variable creation)
 * en    → event_name
 * it.N.X → items[N][X]
 */
function parseGa4MpQueryString(raw: string): Record<string, unknown> {
  // Accept a full URL: extract just the query string
  let qs = raw
  try {
    const url = new URL(raw)
    qs = url.search
  } catch { /* not a full URL — use raw as-is */ }
  if (qs.startsWith('?')) qs = qs.slice(1)

  const params = new URLSearchParams(qs)
  const result: Record<string, unknown> = {}
  const items: Record<string, Record<string, unknown>> = {}

  for (const [k, v] of params.entries()) {
    if (MP_SKIP.has(k) || k.startsWith('_')) continue
    if (k === 'en') {
      result['event_name'] = v
    } else if (k.startsWith('ep.')) {
      result[k.slice(3)] = v
    } else if (k.startsWith('up.')) {
      result[k.slice(3)] = v
    } else if (k.startsWith('it.')) {
      const parts = k.split('.')
      if (parts.length >= 3) {
        const idx = parts[1]
        const field = parts.slice(2).join('.')
        if (!items[idx]) items[idx] = {}
        ;(items[idx] as Record<string, unknown>)[field] = v
      }
    } else if (!k.startsWith('x-') && !EDV_SKIP_RE.test(k)) {
      result[k] = v
    }
  }

  const idxs = Object.keys(items)
  if (idxs.length > 0) {
    const max = Math.max(...idxs.map(Number))
    result['items'] = Array.from({ length: max + 1 }, (_, i) => items[String(i)] ?? {})
  }

  return result
}

async function createEventDataVariables(
  entries: Array<{ key: string; name: string }>,
): Promise<{ ok: number; fail: number; skipped: number }> {
  let ok = 0, fail = 0, skipped = 0
  try {
    const inj = window.angular?.element(document.body).injector()
    if (!inj) return { ok: 0, fail: entries.length, skipped: 0 }

    type EdvSvc = {
      get: (key: unknown) => Promise<{ data: Record<string, unknown> }>
      create: (ctx: unknown, p: { data: unknown }) => Promise<unknown>
      getList?: (ctx: unknown) => { $$state?: { value?: unknown[] } }
    }
    let svc: EdvSvc | null = null
    for (const n of ['serverVariableService', 'variableService']) {
      try {
        const s = inj.get<EdvSvc>(n)
        if (s && typeof s.create === 'function') { svc = s; break }
      } catch { /* try next */ }
    }
    if (!svc) return { ok: 0, fail: entries.length, skipped: 0 }

    let context: unknown
    try { context = inj.get<{ getContext?: () => unknown }>('appStateService')?.getContext?.() } catch { /* ignore */ }

    const existingNames = new Set<string>()
    let templateKey: unknown = null
    let templateParamKey = 'key'  // will be updated from the fetched template
    const list = svc.getList?.(context)?.$$state?.value ?? []
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['variable'] ?? e) as Record<string, unknown>
      const d = entry['data'] as Record<string, unknown> | undefined
      const n = d?.['name']
      if (typeof n === 'string') existingNames.add(n)
      // sGTM Event Data variable type is integer 41 (confirmed from real container)
      const t = d?.['type']
      if ((t === 41 || t === 'ewd' || t === 'event_data') && templateKey == null) templateKey = entry['key']
    }

    // Shell fallback: first variable of any type if no EDV template found
    let shellKey: unknown = null
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['variable'] ?? e) as Record<string, unknown>
      if (entry['key'] != null) { shellKey = entry['key']; break }
    }

    let templateData: Record<string, unknown> | null = null
    const fetchKey = templateKey ?? shellKey

    if (fetchKey != null) {
      try {
        const fetched = await svc.get(fetchKey)
        templateData = fetched.data
        if (templateKey != null) {
          // EDV template found: detect the param key used to store the event data key name
          const params = templateData['parameter'] as Array<Record<string, unknown>> | undefined
          if (params) {
            const pk = params.find(p => ['key', 'varName', 'name', 'keyName'].includes(String(p['key'])))
            if (pk) templateParamKey = String(pk['key'])
          }
        } else {
          // Non-EDV shell: strip type-specific fields before use
          delete templateData['variableId']
          delete templateData['fingerprint']
          delete templateData['type']
          delete templateData['vendorTemplate']
          delete templateData['formatValue']
          delete templateData['parameter']
          // sGTM-specific fields that don't belong on variables
          delete templateData['positiveConditionId']
          delete templateData['negativeConditionId']
          delete templateData['positiveTriggerId']
          delete templateData['negativeTriggerId']
          delete templateData['normalization']
        }
      } catch (e) {
        console.warn('[LayerLens] createEventDataVariables: could not fetch template', e)
      }
    }

    for (const entry of entries) {
      if (existingNames.has(entry.name)) { skipped++; continue }
      try {
        let finalName = entry.name
        while (existingNames.has(finalName)) finalName += ' - Copy'

        let varData: Record<string, unknown>
        if (templateData != null) {
          varData = JSON.parse(JSON.stringify(templateData)) as Record<string, unknown>
          varData['name'] = finalName
          if (templateKey != null) {
            // Exact EDV template: update the param that stores the event data key name
            const params = varData['parameter'] as Array<Record<string, unknown>> | undefined
            const keyParam = params?.find(p => String(p['key']) === templateParamKey)
              ?? params?.find(p => ['key', 'varName', 'name', 'keyName'].includes(String(p['key'])))
            if (keyParam) keyParam['value'] = entry.key
            else if (Array.isArray(params)) params.push({ key: templateParamKey, type: 'TEMPLATE', value: entry.key })
          } else {
            // Non-EDV shell: set type 41 (confirmed sGTM EDV type) and parameter from scratch
            varData['type'] = 41
            varData['parameter'] = [{ key: templateParamKey, type: 'TEMPLATE', value: entry.key }]
          }
        } else {
          varData = {
            name: finalName,
            type: 41,
            parameter: [{ key: templateParamKey, type: 'TEMPLATE', value: entry.key }],
          }
        }

        await svc.create(context, { data: varData })
        existingNames.add(finalName)
        ok++
      } catch (err) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err)
        console.warn('[LayerLens] createEventDataVariables: failed', entry.name, msg, err)
        fail++
      }
    }
  } catch (err) {
    console.warn('[LayerLens] createEventDataVariables: error', err)
    return { ok, fail: fail + (entries.length - ok - fail), skipped: 0 }
  }
  return { ok, fail, skipped }
}

async function createDlvVariables(
  entries: Array<{ path: string; name: string }>,
): Promise<{ ok: number; fail: number; skipped: number }> {
  let ok = 0
  let fail = 0
  let skipped = 0
  try {
    const inj = window.angular?.element(document.body).injector()
    if (!inj) return { ok: 0, fail: entries.length, skipped: 0 }

    type DlvSvc = {
      get: (key: unknown) => Promise<{ data: Record<string, unknown> }>
      create: (ctx: unknown, p: { data: unknown }) => Promise<unknown>
      getList?: (ctx: unknown) => { $$state?: { value?: unknown[] } }
    }
    let svc: DlvSvc | null = null
    for (const n of ['variableService', 'serverVariableService']) {
      try {
        const s = inj.get<DlvSvc>(n)
        if (s && typeof s.create === 'function') { svc = s; break }
      } catch { /* try next */ }
    }
    if (!svc) return { ok: 0, fail: entries.length, skipped: 0 }

    let context: unknown
    try { context = inj.get<{ getContext?: () => unknown }>('appStateService')?.getContext?.() } catch { /* ignore */ }

    const existingNames = new Set<string>()
    const existingDlPaths = new Set<string>()
    let templateKey: unknown = null
    const list = svc.getList?.(context)?.$$state?.value ?? []
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['variable'] ?? e) as Record<string, unknown>
      const d = entry['data'] as Record<string, unknown> | undefined
      const n = d?.['name']
      if (typeof n === 'string') existingNames.add(n)
      const params = d?.['parameter'] as Array<Record<string, unknown>> | undefined
      // DL Variable: check both Angular internal format (vendorTemplate) and REST API format (type)
      const vendorPublicId = ((d?.['vendorTemplate'] as Record<string, unknown> | undefined)?.['key'] as Record<string, unknown> | undefined)?.['publicId']
      const isDlv = vendorPublicId === 'v' || d?.['type'] === 'v'
      if (isDlv) {
        const pathParam = params?.find((p) => p['key'] === 'name')
        if (typeof pathParam?.['value'] === 'string') existingDlPaths.add(pathParam['value'])
        if (templateKey == null) templateKey = entry['key']
      }
      // Track any variable key as shell fallback (used only when no DL variable exists)
      if (entry['key'] != null && !(templateKey != null)) {
        // store as fallbackKey only if no dlv template yet — use first entry seen
      }
    }

    // Also track a generic fallback key (first variable of any type) for workspaces with no DL var
    let shellKey: unknown = null
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['variable'] ?? e) as Record<string, unknown>
      if (entry['key'] != null) { shellKey = entry['key']; break }
    }

    // Fetch the full data of the template variable so the payload has all GTM-required fields
    let templateData: Record<string, unknown> | null = null
    const fetchKey = templateKey ?? shellKey
    if (fetchKey != null) {
      try {
        const fetched = await svc.get(fetchKey)
        templateData = fetched.data
        // If we used a non-DL shell, strip type-specific fields before using it as base
        if (templateKey == null) {
          delete templateData['variableId']
          delete templateData['fingerprint']
          delete templateData['type']
          delete templateData['vendorTemplate']
          delete templateData['formatValue']
          delete templateData['parameter']
        }
      } catch (e) {
        console.warn('[LayerLens] createDlvVariables: could not fetch template variable', e)
      }
    }

    for (const entry of entries) {
      // Skip if a variable with this exact name already exists (list data doesn't include
      // the full parameter array, so path-based dedup is not reliable here)
      if (existingNames.has(entry.name)) { skipped++; continue }
      try {
        let finalName = entry.name
        while (existingNames.has(finalName)) finalName += ' - Copy'

        let varData: Record<string, unknown>
        if (templateData != null) {
          varData = JSON.parse(JSON.stringify(templateData)) as Record<string, unknown>
          varData['name'] = finalName
          if (templateKey != null) {
            // Exact DL variable template: update path parameter in place
            const params = varData['parameter'] as Array<Record<string, unknown>> | undefined
            const nameParam = params?.find((p) => p['key'] === 'name')
            if (nameParam) nameParam['value'] = entry.path
            else params?.push({ key: 'name', type: 'TEMPLATE', value: entry.path })
          } else {
            // Non-DL shell: type-specific fields already stripped, add DL fields
            varData['type'] = 'v'
            varData['parameter'] = [
              { key: 'name', type: 'TEMPLATE', value: entry.path },
              { key: 'dataLayerVersion', type: 'INTEGER', value: '2' },
            ]
          }
        } else {
          // No variables at all in workspace — minimal from-scratch (requires workspace IDs in ctx)
          varData = {
            name: finalName,
            type: 'v',
            parameter: [
              { key: 'name', type: 'TEMPLATE', value: entry.path },
              { key: 'dataLayerVersion', type: 'INTEGER', value: '2' },
            ],
          }
        }

        await svc.create(context, { data: varData })
        existingNames.add(finalName)
        ok++
      } catch (err) {
        const msg = err instanceof Error ? err.message : JSON.stringify(err)
        console.warn('[LayerLens] createDlvVariables: failed to create', entry.name, msg, err)
        fail++
      }
    }
  } catch (err) {
    console.warn('[LayerLens] createDlvVariables: error', err)
    return { ok, fail: fail + (entries.length - ok - fail), skipped: 0 }
  }
  return { ok, fail, skipped }
}

async function getGA4ConfigTags(): Promise<Array<{ name: string; key: unknown }>> {
  try {
    const inj = window.angular?.element(document.body).injector()
    if (!inj) return []
    type Svc = { getList?: (ctx: unknown) => { $$state?: { value?: unknown[] } } }
    let svc: Svc | null = null
    for (const n of ['tagService', 'serverTagService', 'sTagService']) {
      try { const s = inj.get<Svc>(n); if (s) { svc = s; break } } catch { /* try next */ }
    }
    if (!svc) return []
    let ctx: unknown
    try { ctx = inj.get<{ getContext?: () => unknown }>('appStateService')?.getContext?.() } catch { /* ignore */ }
    const list = svc.getList?.(ctx)?.$$state?.value ?? []
    const out: Array<{ name: string; key: unknown }> = []
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['tag'] ?? e) as Record<string, unknown>
      const d = entry['data'] as Record<string, unknown> | undefined
      const pid = ((d?.['vendorTemplate'] as Record<string, unknown> | undefined)?.['key'] as Record<string, unknown> | undefined)?.['publicId']
      if (pid === 'gaawc') out.push({ name: String(d?.['name'] ?? ''), key: entry['key'] })
    }
    return out
  } catch { return [] }
}

// Fields specific to trigger types — stripped when converting a base trigger to custom event
const TRIG_TYPE_FIELDS = ['customEventFilter', 'filter', 'autoEventFilter', 'checkValidation',
  'waitForTags', 'waitForTagsTimeout', 'interval', 'intervalStartTimer',
  'scrollThreshold', 'scrollUnit', 'visibilitySelector', 'visibilityMaxOnScreenTime',
  'visibilityMinOnScreenTime', 'horizontalScrollPercentageList', 'verticalScrollPercentageList',
  'limit', 'typeDisplayName', 'triggerId', 'fingerprint',
  'jsErrorListener',   // JavaScript Error trigger field
  'clickListener', 'formListener', 'linkClickListener',  // click/form trigger fields
  'visibilityListener', 'timerListener', 'scrollListener', 'historyListener']

async function createCustomEventTrigger(p: {
  name: string; eventName: string; matchType: 'EQUALS' | 'CONTAINS' | 'MATCH_REGEX'
}): Promise<{ ok: boolean; created?: boolean; triggerId?: number }> {
  const existingTriggers = new Map<string, { key: unknown; type: unknown }>()
  let CE_TYPE = 4
  try {
    const inj = window.angular?.element(document.body).injector()
    if (!inj) return { ok: false }
    type TrigSvc = {
      get: (k: unknown) => Promise<{ data: Record<string, unknown> }>
      create: (ctx: unknown, payload: { data: unknown }) => Promise<Record<string, unknown>>
      getList?: (ctx: unknown) => { $$state?: { value?: unknown[] } }
    }
    let svc: TrigSvc | null = null
    for (const n of ['triggerService', 'serverTriggerService']) {
      try { const s = inj.get<TrigSvc>(n); if (s && typeof s.create === 'function') { svc = s; break } } catch { /* try next */ }
    }
    if (!svc) return { ok: false }
    let ctx: unknown
    try { ctx = inj.get<{ getContext?: () => unknown }>('appStateService')?.getContext?.() } catch { /* ignore */ }

    const list = svc.getList?.(ctx)?.$$state?.value ?? []

    // Scan list: find CE template (typeDisplayName === 'Custom Event', stored in English
    // internally regardless of UI locale — confirmed by server returning English typeDisplayName),
    // collect names and workspace IDs.
    let templateKey: unknown = null
    let ceType: number | null = null
    const wsFields: Record<string, unknown> = {}
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['trigger'] ?? e) as Record<string, unknown>
      const d = entry['data'] as Record<string, unknown> | undefined
      if (d?.['name'] != null) existingTriggers.set(String(d['name']), { key: entry['key'], type: d['type'] })
      // Custom Event triggers are identified by typeDisplayName (English, locale-invariant)
      if (d?.['typeDisplayName'] === 'Custom Event' && templateKey == null) {
        templateKey = entry['key']
        ceType = d['type'] as number
      }
      if (Object.keys(wsFields).length === 0) {
        for (const k of ['accountId', 'containerId', 'workspaceId']) {
          if (d?.[k] != null) wsFields[k] = d[k]
        }
      }
    }
    // Fallback CE type if no CE trigger exists in workspace yet.
    // GTM Angular internal type integers: JS Error = 9 (confirmed). Custom Event = 4.
    CE_TYPE = ceType ?? 4
    console.log('[LayerLens] trigger: ceType discovered:', ceType, '→ using:', CE_TYPE, 'templateKey found:', templateKey != null)

    // Reuse an existing CE trigger with the same name (correct CE type only)
    const existing = existingTriggers.get(p.name)
    if (existing != null) {
      if (existing.type === CE_TYPE) {
        const existingTriggerId = (existing.key as Record<string, unknown> | undefined)?.['triggerId'] as number | undefined
        console.log('[LayerLens] trigger: reusing existing CE trigger, id:', existingTriggerId)
        return { ok: true, created: false, triggerId: existingTriggerId }
      }
      console.log('[LayerLens] trigger: found existing with wrong type:', existing.type, '(CE_TYPE=', CE_TYPE, ') — will create new but name conflicts; user should delete old trigger')
    }

    // GTM Angular internal condition format (from GTM compiled source):
    //   operator (string) + type (integer) + arg (value-object array)
    // newMacroReference("_event") = { type: 4, macroReference: "_event" }
    // newString(value) = { type: 1, string: value }
    const OPERATOR_TO_INT: Record<string, number> = { EQUALS: 1, CONTAINS: 4, REGEX: 0 }
    const operator = p.matchType === 'MATCH_REGEX' ? 'REGEX' : p.matchType
    const condition = {
      operator,
      type: OPERATOR_TO_INT[operator] ?? 1,
      arg: [
        { type: 4, macroReference: '_event' },
        { type: 1, string: p.eventName },
      ],
    }

    let data: Record<string, unknown>
    if (templateKey != null) {
      const fetched = await svc.get(templateKey)
      data = JSON.parse(JSON.stringify(fetched.data)) as Record<string, unknown>
      for (const k of TRIG_TYPE_FIELDS) delete data[k]
      delete data['parentFolderId']
      data['name'] = p.name
      data['type'] = CE_TYPE
      data['customEventFilter'] = [condition]
    } else {
      data = { ...wsFields, name: p.name, type: CE_TYPE, customEventFilter: [condition] }
    }

    console.log('[LayerLens] trigger create data:', JSON.stringify(data))
    const result = await svc.create(ctx, { data })
    console.log('[LayerLens] trigger create result:', JSON.stringify(result))
    // TriggerService.create resolves with the entity model: { key: { triggerId: N }, data: {...} }
    const triggerId = ((result?.['key'] as Record<string, unknown> | undefined)?.['triggerId']
      ?? (result?.['data'] as Record<string, unknown> | undefined)?.['triggerId']
      ?? result?.['triggerId']) as number | undefined
    return { ok: true, created: true, triggerId }
  } catch (err) {
    // 400 likely = duplicate name (errorCode 3): trigger was created in a previous run
    // but may not have been in the list snapshot yet. Try to return its ID from the list.
    const httpStatus = (err as Record<string, unknown> | undefined)?.['status']
    if (typeof httpStatus === 'number' && httpStatus >= 400) {
      const existing = existingTriggers.get(p.name)
      if (existing?.type === CE_TYPE) {
        const existingTriggerId = (existing.key as Record<string, unknown> | undefined)?.['triggerId'] as number | undefined
        console.log('[LayerLens] trigger: 400 on create, reusing existing from list, id:', existingTriggerId)
        return { ok: true, created: false, triggerId: existingTriggerId }
      }
    }
    console.warn('[LayerLens] createCustomEventTrigger error', err)
    return { ok: false }
  }
}

// Fields specific to a tag type — stripped when converting a base tag to GA4 Event
const TAG_TYPE_FIELDS = ['parameter', 'vendorTemplate', 'tagId', 'fingerprint',
  'firingTriggerId', 'blockingTriggerId', 'setupTag', 'teardownTag',
  'monitoringMetadata', 'monitoringMetadataTagNameKey']

async function createGA4EventTag(p: {
  name: string; eventName: string
  triggerIds: number[]
  eventParams: Array<{ name: string; value: string }>
}): Promise<{ ok: boolean; created?: boolean }> {
  try {
    const inj = window.angular?.element(document.body).injector()
    if (!inj) return { ok: false }
    type TagSvc = {
      get: (k: unknown) => Promise<{ data: Record<string, unknown> }>
      create: (ctx: unknown, payload: { data: unknown }) => Promise<unknown>
      getList?: (ctx: unknown) => { $$state?: { value?: unknown[] } }
    }
    let svc: TagSvc | null = null
    for (const n of ['tagService', 'serverTagService', 'sTagService']) {
      try { const s = inj.get<TagSvc>(n); if (s && typeof s.create === 'function') { svc = s; break } } catch { /* try next */ }
    }
    if (!svc) return { ok: false }
    let ctx: unknown
    try { ctx = inj.get<{ getContext?: () => unknown }>('appStateService')?.getContext?.() } catch { /* ignore */ }

    const list = svc.getList?.(ctx)?.$$state?.value ?? []
    // Prefer GA4 Event tag template; fall back to any tag for the structural shell
    let templateKey: unknown = null
    let isExactType = false
    const existingTagNames = new Set<string>()
    for (const e of list) {
      const entry = ((e as Record<string, unknown>)['tag'] ?? e) as Record<string, unknown>
      const d = entry['data'] as Record<string, unknown> | undefined
      if (d?.['name'] != null) existingTagNames.add(String(d['name']))
      const pid = ((d?.['vendorTemplate'] as Record<string, unknown> | undefined)?.['key'] as Record<string, unknown> | undefined)?.['publicId']
      if (pid === 'gaawe' && !isExactType) { templateKey = entry['key']; isExactType = true }
    }
    if (!templateKey && list.length > 0) {
      const entry = ((list[0] as Record<string, unknown>)['tag'] ?? list[0]) as Record<string, unknown>
      templateKey = entry['key']
    }

    // Dedup: tag with same name already exists (e.g. from a previous successful run)
    if (existingTagNames.has(p.name)) {
      console.log('[LayerLens] tag: name already exists, skipping creation:', p.name)
      return { ok: true, created: false }
    }
    console.log('[LayerLens] tag: isExactType:', isExactType, 'templateKey found:', templateKey != null)

    let data: Record<string, unknown>
    if (isExactType && templateKey != null) {
      // Copy-row pattern (same as copyRowToNew): get full data, clone it, change only
      // what we need — do NOT strip tagId/fingerprint/vendorTemplate, the server handles them
      const fetched = await svc.get(templateKey)
      data = JSON.parse(JSON.stringify(fetched.data)) as Record<string, unknown>
    } else if (templateKey != null) {
      // Non-gaawe shell: strip type-specific fields, rebuild vendorTemplate and params
      const fetched = await svc.get(templateKey)
      data = JSON.parse(JSON.stringify(fetched.data)) as Record<string, unknown>
      for (const k of TAG_TYPE_FIELDS) delete data[k]
      data['type'] = 46            // vendor template tag type in Angular model
      data['tagFiringOption'] = 1  // oncePerEvent as Angular integer
      data['vendorTemplate'] = { key: { publicId: 'gaawe' } }
      data['parameter'] = []
    } else {
      // From scratch: type 46 = vendor template tag, tagFiringOption 1 = oncePerEvent
      data = { type: 46, tagFiringOption: 1, vendorTemplate: { key: { publicId: 'gaawe' } }, parameter: [] }
    }

    data['name'] = p.name
    // GTM Angular model uses positiveTriggerId/negativeTriggerId (integer arrays), not
    // firingTriggerId/blockingTriggerId (REST API string arrays). Clear both formats.
    delete data['firingTriggerId']
    delete data['blockingTriggerId']
    delete data['positiveTriggerId']
    delete data['negativeTriggerId']
    delete data['positiveConditionId']
    delete data['negativeConditionId']

    // For gaawe (vendor template) tags, the actual config lives in vendorTemplate.param
    // (Angular internal value-object format), NOT in the root parameter array.
    // GTM ignores the root parameter array for display and tag firing.
    const angStr = (s: string) => ({
      type: 1, string: s, listItem: [] as unknown[], mapKey: [] as unknown[],
      mapValue: [] as unknown[], templateToken: [] as unknown[], escaping: [] as unknown[],
    })
    const vt = data['vendorTemplate'] as Record<string, unknown> | undefined
    const vtParam: Array<Record<string, unknown>> = Array.isArray(vt?.['param'])
      ? (vt!['param'] as Array<Record<string, unknown>>)
      : []
    if (vt && !Array.isArray(vt['param'])) vt['param'] = vtParam

    // Set event name in vendorTemplate.param
    const vtEn = vtParam.find((x) => x['key'] === 'eventName')
    if (vtEn) vtEn['value'] = angStr(p.eventName)
    else vtParam.push({ key: 'eventName', value: angStr(p.eventName) })

    // Set event parameters as eventSettingsTable in vendorTemplate.param
    const newListItems = p.eventParams.map((ep) => ({
      type: 3, listItem: [] as unknown[], templateToken: [] as unknown[], escaping: [] as unknown[],
      mapKey: [angStr('parameter'), angStr('parameterValue')],
      mapValue: [angStr(ep.name), angStr(ep.value)],
    }))
    const newEst = { type: 2, listItem: newListItems, mapKey: [] as unknown[], mapValue: [] as unknown[], templateToken: [] as unknown[], escaping: [] as unknown[] }
    const vtEst = vtParam.find((x) => x['key'] === 'eventSettingsTable')
    if (vtEst) vtEst['value'] = newEst
    else if (p.eventParams.length > 0) vtParam.push({ key: 'eventSettingsTable', value: newEst })

    // Use positiveTriggerId (Angular model integer array) — firingTriggerId is the REST format
    if (p.triggerIds.length > 0) data['positiveTriggerId'] = p.triggerIds

    console.log('[LayerLens] createGA4EventTag full payload:', JSON.stringify(data))
    await svc.create(ctx, { data })
    return { ok: true, created: true }
  } catch (err) {
    // TagService.create calls handleTaggingActivityChange in .then(), which accesses
    // tag.additionalChangeItems.some() — this throws a TypeError when the server
    // response omits that field. The HTTP POST itself succeeded, so treat non-HTTP
    // errors as success.
    const httpStatus = (err as Record<string, unknown> | undefined)?.['status']
    if (typeof httpStatus === 'number' && httpStatus >= 400) {
      console.warn('[LayerLens] createGA4EventTag HTTP error:', httpStatus, JSON.stringify((err as Record<string, unknown>)?.['data']))
      return { ok: false }
    }
    // Non-HTTP error (TypeError from post-create callback) — HTTP POST likely succeeded
    console.log('[LayerLens] createGA4EventTag non-HTTP error (likely success):', (err as Error)?.message)
    return { ok: true, created: true }
  }
}

function showDlvFromPushModal() {
  document.getElementById('amd-dlv-modal')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'amd-modal-overlay'
  overlay.id = 'amd-dlv-modal'

  const panel = document.createElement('div')
  panel.className = 'amd-modal'
  panel.style.cssText = 'width:min(720px,94vw);max-height:90vh;display:flex;flex-direction:column;'

  // ── Header ──────────────────────────────────────────────────────────────────
  const head = document.createElement('div')
  head.className = 'amd-modal-head'
  const titleEl = document.createElement('h3')
  titleEl.textContent = 'Da push dataLayer'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'; closeBtn.className = 'amd-modal-close'; closeBtn.title = 'Chiudi'; closeBtn.textContent = '×'
  head.append(titleEl, closeBtn)

  // ── Textarea ─────────────────────────────────────────────────────────────────
  const textareaWrap = document.createElement('div')
  textareaWrap.style.paddingBottom = '10px'
  const textarea = document.createElement('textarea')
  textarea.className = 'amd-dlv-textarea'
  textarea.placeholder = 'dataLayer.push({ event: "...", ecommerce: { ... } })'
  const errorEl = document.createElement('div')
  errorEl.className = 'amd-dlv-error'
  textareaWrap.append(textarea, errorEl)

  // ── Sections wrapper (scrollable) ────────────────────────────────────────────
  const sectionsWrap = document.createElement('div')
  sectionsWrap.style.cssText = 'flex:1;overflow-y:auto;padding:2px 0 6px;'

  // ── Section builder ──────────────────────────────────────────────────────────
  function makeSection(title: string, enabledByDefault: boolean, openByDefault: boolean) {
    const sec = document.createElement('div')
    sec.className = 'amd-dlv-section' + (openByDefault ? ' open' : '')

    const secHead = document.createElement('div')
    secHead.className = 'amd-dlv-section-head'

    const toggle = document.createElement('input')
    toggle.type = 'checkbox'; toggle.className = 'amd-dlv-section-toggle'; toggle.checked = enabledByDefault
    toggle.addEventListener('click', (e) => e.stopPropagation())
    toggle.addEventListener('change', () => sec.classList.toggle('amd-dlv-section-disabled', !toggle.checked))

    const titleSpan = document.createElement('span')
    titleSpan.className = 'amd-dlv-section-title'; titleSpan.textContent = title

    const badge = document.createElement('span')
    badge.className = 'amd-dlv-section-badge'; badge.style.display = 'none'

    const arrow = document.createElement('span')
    arrow.className = 'amd-dlv-section-arrow'; arrow.textContent = '▼'

    secHead.append(toggle, titleSpan, badge, arrow)
    secHead.addEventListener('click', (e) => { if (e.target === toggle) return; sec.classList.toggle('open') })

    const body = document.createElement('div')
    body.className = 'amd-dlv-section-body'
    sec.append(secHead, body)
    if (!enabledByDefault) sec.classList.add('amd-dlv-section-disabled')

    return {
      el: sec, body, toggle,
      isEnabled: () => toggle.checked,
      setBadge(text: string, warn = false) {
        badge.textContent = text; badge.style.display = text ? '' : 'none'
        badge.className = 'amd-dlv-section-badge' + (warn ? ' warn' : '')
      },
    }
  }

  // ── Section: Variabili ───────────────────────────────────────────────────────
  const varSec = makeSection('Variabili livello dati', true, true)

  const varListHead = document.createElement('div')
  varListHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'
  const varListLabel = document.createElement('div')
  varListLabel.className = 'amd-dlv-sublabel'; varListLabel.style.marginBottom = '0'; varListLabel.textContent = 'Percorsi estratti:'
  const varSelectAll = document.createElement('button')
  varSelectAll.type = 'button'; varSelectAll.className = 'amd-dlv-selectall'; varSelectAll.textContent = 'Deseleziona tutti'
  varListHead.append(varListLabel, varSelectAll)

  const varListEl = document.createElement('div')
  varListEl.className = 'amd-dlv-list'
  const varEmptyEl = document.createElement('div')
  varEmptyEl.className = 'amd-dlv-empty'; varEmptyEl.textContent = 'Incolla un push per visualizzare i percorsi.'
  varListEl.appendChild(varEmptyEl)
  varSec.body.append(varListHead, varListEl)

  type VarEntry = { path: string; nameInput: HTMLInputElement; checkbox: HTMLInputElement }
  let varEntries: VarEntry[] = []
  let allVarsSelected = true

  // updateCreateBtn declared early, assigned after all sections exist
  let updateCreateBtn: () => void = () => {}

  const updateVarSection = () => {
    const n = varEntries.filter((e) => e.checkbox.checked).length
    varSec.setBadge(varEntries.length > 0 ? String(n) : '')
    updateCreateBtn()
  }

  const renderVarPaths = (paths: string[]) => {
    varListEl.innerHTML = ''; varEntries = []; allVarsSelected = true
    varSelectAll.textContent = 'Deseleziona tutti'
    if (paths.length === 0) {
      const msg = document.createElement('div'); msg.className = 'amd-dlv-empty'; msg.textContent = 'Nessun percorso trovato.'
      varListEl.appendChild(msg); updateVarSection(); return
    }
    for (const path of paths) {
      const item = document.createElement('div'); item.className = 'amd-dlv-item'
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true
      cb.addEventListener('change', updateVarSection)
      const code = document.createElement('code'); code.textContent = path
      const ni = document.createElement('input'); ni.type = 'text'; ni.value = `dlv - ${path}`
      item.append(cb, code, ni); varListEl.appendChild(item)
      varEntries.push({ path, nameInput: ni, checkbox: cb })
    }
    updateVarSection()
  }

  varSelectAll.addEventListener('click', () => {
    allVarsSelected = !allVarsSelected
    varEntries.forEach((e) => { e.checkbox.checked = allVarsSelected })
    varSelectAll.textContent = allVarsSelected ? 'Deseleziona tutti' : 'Seleziona tutti'
    updateVarSection()
  })

  // ── Section: Trigger ─────────────────────────────────────────────────────────
  const trigSec = makeSection('Trigger evento personalizzato', true, true)

  const trigNameField = document.createElement('div'); trigNameField.className = 'amd-dlv-field'
  const trigNameLabel = document.createElement('label'); trigNameLabel.textContent = 'Nome trigger:'
  const trigNameInput = document.createElement('input'); trigNameInput.type = 'text'; trigNameInput.placeholder = 'nome_evento'
  trigNameField.append(trigNameLabel, trigNameInput)

  const trigMatchField = document.createElement('div'); trigMatchField.className = 'amd-dlv-field'
  const trigMatchLabel = document.createElement('label'); trigMatchLabel.textContent = 'Tipo di corrispondenza:'
  const trigRadioWrap = document.createElement('div'); trigRadioWrap.className = 'amd-dlv-radios'
  const matchTypes: Array<['EQUALS' | 'CONTAINS' | 'MATCH_REGEX', string]> = [['EQUALS', 'Uguale a'], ['CONTAINS', 'Contiene'], ['MATCH_REGEX', 'Regex']]
  const matchRadios: HTMLInputElement[] = []
  for (const [val, label] of matchTypes) {
    const r = document.createElement('input'); r.type = 'radio'; r.name = 'amd-dlv-match'; r.value = val; if (val === 'EQUALS') r.checked = true
    const lEl = document.createElement('label'); lEl.append(r, document.createTextNode(' ' + label))
    trigRadioWrap.appendChild(lEl); matchRadios.push(r)
  }
  trigMatchField.append(trigMatchLabel, trigRadioWrap)
  trigSec.body.append(trigNameField, trigMatchField)
  trigNameInput.addEventListener('input', () => updateCreateBtn())

  // ── Section: Tag GA4 Event ───────────────────────────────────────────────────
  const ga4Sec = makeSection('Tag GA4 Event', false, false)

  const ga4NameField = document.createElement('div'); ga4NameField.className = 'amd-dlv-field'
  const ga4NameLabel = document.createElement('label'); ga4NameLabel.textContent = 'Nome tag:'
  const ga4NameInput = document.createElement('input'); ga4NameInput.type = 'text'; ga4NameInput.placeholder = 'GA4 - Event - nome_evento'
  ga4NameField.append(ga4NameLabel, ga4NameInput)

  const ga4EventField = document.createElement('div'); ga4EventField.className = 'amd-dlv-field'
  const ga4EventLabel = document.createElement('label'); ga4EventLabel.textContent = 'Nome evento GA4:'
  const ga4EventInput = document.createElement('input'); ga4EventInput.type = 'text'
  ga4EventField.append(ga4EventLabel, ga4EventInput)

  const ga4TrigField = document.createElement('div'); ga4TrigField.className = 'amd-dlv-field'
  const ga4TrigLabel = document.createElement('label')
  ga4TrigLabel.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:pointer;font-weight:400!important;'
  const ga4TrigCb = document.createElement('input'); ga4TrigCb.type = 'checkbox'; ga4TrigCb.checked = true
  ga4TrigLabel.append(ga4TrigCb, document.createTextNode('Usa il trigger creato sopra come firing trigger'))
  ga4TrigField.appendChild(ga4TrigLabel)

  const ga4Note = document.createElement('div'); ga4Note.className = 'amd-dlv-note'
  ga4Note.textContent = 'I parametri evento verranno aggiunti automaticamente dalle variabili selezionate.'

  ga4Sec.body.append(ga4NameField, ga4EventField, ga4TrigField, ga4Note)
  ga4NameInput.addEventListener('input', () => updateCreateBtn())

  sectionsWrap.append(varSec.el, trigSec.el, ga4Sec.el)

  // ── Actions ──────────────────────────────────────────────────────────────────
  const actionsEl = document.createElement('div'); actionsEl.className = 'amd-modal-actions'
  const statusEl = document.createElement('span'); statusEl.className = 'amd-modal-msg'
  const createBtn = document.createElement('button')
  createBtn.type = 'button'; createBtn.className = 'amd-modal-save'; createBtn.textContent = 'Crea selezione'; createBtn.disabled = true
  actionsEl.append(statusEl, createBtn)

  panel.append(head, textareaWrap, sectionsWrap, actionsEl)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const close = () => overlay.remove()
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  // Assign real updateCreateBtn now that createBtn and inputs exist
  updateCreateBtn = () => {
    const varOk = varSec.isEnabled() && varEntries.filter((e) => e.checkbox.checked).length > 0
    const trigOk = trigSec.isEnabled() && !!trigNameInput.value.trim()
    const ga4Ok = ga4Sec.isEnabled() && !!ga4NameInput.value.trim()
    createBtn.disabled = !varOk && !trigOk && !ga4Ok
  }
  varSec.toggle.addEventListener('change', updateCreateBtn)
  trigSec.toggle.addEventListener('change', updateCreateBtn)
  ga4Sec.toggle.addEventListener('change', updateCreateBtn)

  // ── JSON parse ────────────────────────────────────────────────────────────────
  let currentEvent = ''
  let debounce: ReturnType<typeof setTimeout> | null = null
  textarea.addEventListener('input', () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      const raw = textarea.value.trim()
      errorEl.textContent = ''
      if (!raw) {
        varListEl.innerHTML = ''; varListEl.appendChild(varEmptyEl); varEntries = []; currentEvent = ''
        trigNameInput.value = ''; ga4EventInput.value = ''; ga4NameInput.value = ''
        updateVarSection(); return
      }
      try {
        const parsed = JSON.parse(preprocessJsPush(raw)) as Record<string, unknown>
        currentEvent = typeof parsed['event'] === 'string' ? parsed['event'] : ''
        renderVarPaths(parseDataLayerPaths(parsed))
        // Auto-fill trigger and GA4 names (respects manual edits)
        if (currentEvent) {
          if (!trigNameInput.value || trigNameInput.value === currentEvent) trigNameInput.value = currentEvent
          if (!ga4EventInput.value) ga4EventInput.value = currentEvent
          if (!ga4NameInput.value || ga4NameInput.value.startsWith('GA4 - ')) ga4NameInput.value = `GA4 - Event - ${currentEvent}`
        }
        updateCreateBtn()
      } catch {
        errorEl.textContent = 'Sintassi non valida — controlla l\'oggetto push.'
        varListEl.innerHTML = ''; varEntries = []; currentEvent = ''
        updateVarSection()
      }
    }, 280)
  })

  // ── Create ────────────────────────────────────────────────────────────────────
  createBtn.addEventListener('click', () => {
    createBtn.disabled = true; statusEl.textContent = ''; statusEl.style.color = '#137333'

    const steps: Array<() => Promise<string>> = []

    if (varSec.isEnabled()) {
      const toCreate = varEntries.filter((e) => e.checkbox.checked && e.nameInput.value.trim())
      if (toCreate.length > 0) {
        steps.push(async () => {
          const { ok, fail, skipped } = await createDlvVariables(toCreate.map((e) => ({ path: e.path, name: e.nameInput.value.trim() })))
          if (ok === 0 && fail > 0) throw new Error('Variabili: creazione fallita')
          const parts = []
          if (ok > 0) parts.push(`${ok} variabl${ok === 1 ? 'e' : 'i'} create`)
          if (skipped > 0) parts.push(`${skipped} già esistenti`)
          if (fail > 0) parts.push(`${fail} fallite`)
          return parts.join(', ') || 'Nessuna variabile da creare'
        })
      }
    }

    let createdTriggerId: number | undefined
    if (trigSec.isEnabled() && trigNameInput.value.trim()) {
      const matchType = (matchRadios.find((r) => r.checked)?.value ?? 'EQUALS') as 'EQUALS' | 'CONTAINS' | 'MATCH_REGEX'
      const evName = currentEvent || trigNameInput.value.trim()
      steps.push(async () => {
        const res = await createCustomEventTrigger({ name: trigNameInput.value.trim(), eventName: evName, matchType })
        if (!res.ok) throw new Error('Trigger: creazione fallita')
        createdTriggerId = res.triggerId
        return res.created ? 'Trigger creato' : 'Trigger già esistente'
      })
    }

    if (ga4Sec.isEnabled() && ga4NameInput.value.trim()) {
      steps.push(async () => {
        const eventParams: Array<{ name: string; value: string }> = []
        if (varSec.isEnabled()) {
          for (const e of varEntries) {
            if (!e.checkbox.checked) continue
            const segs = e.path.split('.')
            eventParams.push({ name: segs[segs.length - 1], value: `{{${e.nameInput.value.trim()}}}` })
          }
        }
        const trigIds = ga4TrigCb.checked && createdTriggerId != null ? [createdTriggerId] : []
        const res = await createGA4EventTag({
          name: ga4NameInput.value.trim(),
          eventName: ga4EventInput.value.trim() || currentEvent,
          triggerIds: trigIds,
          eventParams,
        })
        if (!res.ok) throw new Error('Tag GA4: creazione fallita. Controlla la console per dettagli.')
        return res.created ? 'Tag GA4 creato' : 'Tag GA4 già esistente'
      })
    }

    void (async () => {
      const results: string[] = []
      try {
        for (const step of steps) results.push(await step())
        statusEl.textContent = results.join(' · ')
        setTimeout(close, 1800)
      } catch (err) {
        statusEl.style.color = '#c5221f'
        statusEl.textContent = err instanceof Error ? err.message : 'Errore durante la creazione'
        createBtn.disabled = false
      }
    })()
  })
}

// ─────────────────────────────────────────────────────────────────────────────

function showEventDataWizardModal() {
  document.getElementById('amd-edv-modal')?.remove()

  const overlay = document.createElement('div')
  overlay.className = 'amd-modal-overlay'
  overlay.id = 'amd-edv-modal'

  const panel = document.createElement('div')
  panel.className = 'amd-modal'
  panel.style.cssText = 'width:min(640px,94vw);max-height:90vh;display:flex;flex-direction:column;'

  // ── Header ───────────────────────────────────────────────────────────────────
  const head = document.createElement('div')
  head.className = 'amd-modal-head'
  const titleEl = document.createElement('h3')
  titleEl.textContent = 'Da evento GA4 server'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'; closeBtn.className = 'amd-modal-close'; closeBtn.title = 'Chiudi'; closeBtn.textContent = '×'
  head.append(titleEl, closeBtn)

  // ── Description ──────────────────────────────────────────────────────────────
  const descEl = document.createElement('p')
  descEl.className = 'amd-dlv-note'
  descEl.style.cssText = 'margin:0 0 8px;padding:0;font-style:normal;'
  descEl.textContent = 'Incolla il JSON dell\'event model oppure la query string della request MP in arrivo (da Tag Assistant → Incoming HTTP Request, copia il body o l\'URL). Verrà creata una variabile Event Data per ogni campo selezionato.'

  // ── Textarea ─────────────────────────────────────────────────────────────────
  const textareaWrap = document.createElement('div')
  textareaWrap.style.paddingBottom = '10px'
  const textarea = document.createElement('textarea')
  textarea.className = 'amd-dlv-textarea'
  textarea.placeholder = 'JSON: { "event_name": "purchase", "currency": "EUR", "value": 99.99 }\n\noppure query string MP:\nv=2&en=purchase&ep.currency=EUR&ep.value=99.99&ep.transaction_id=TXN123\n\noppure URL completo:\nhttps://example.com/g/collect?v=2&en=purchase&ep.currency=EUR'
  const errorEl = document.createElement('div')
  errorEl.className = 'amd-dlv-error'
  textareaWrap.append(textarea, errorEl)

  // ── Key list (scrollable) ─────────────────────────────────────────────────────
  const listWrap = document.createElement('div')
  listWrap.style.cssText = 'flex:1;overflow-y:auto;padding:2px 0 6px;'

  const listHead = document.createElement('div')
  listHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;'
  const listLabel = document.createElement('div')
  listLabel.className = 'amd-dlv-sublabel'; listLabel.style.marginBottom = '0'; listLabel.textContent = 'Campi evento:'
  const selectAllBtn = document.createElement('button')
  selectAllBtn.type = 'button'; selectAllBtn.className = 'amd-dlv-selectall'; selectAllBtn.textContent = 'Deseleziona tutti'
  listHead.append(listLabel, selectAllBtn)

  const listEl = document.createElement('div')
  listEl.className = 'amd-dlv-list'
  const emptyEl = document.createElement('div')
  emptyEl.className = 'amd-dlv-empty'; emptyEl.textContent = 'Incolla un evento JSON per visualizzare i campi.'
  listEl.appendChild(emptyEl)
  listWrap.append(listHead, listEl)

  // ── Actions ───────────────────────────────────────────────────────────────────
  const actionsEl = document.createElement('div'); actionsEl.className = 'amd-modal-actions'
  const statusEl = document.createElement('span'); statusEl.className = 'amd-modal-msg'
  const createBtn = document.createElement('button')
  createBtn.type = 'button'; createBtn.className = 'amd-modal-save'; createBtn.textContent = 'Crea variabili'; createBtn.disabled = true
  actionsEl.append(statusEl, createBtn)

  panel.append(head, descEl, textareaWrap, listWrap, actionsEl)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const close = () => overlay.remove()
  closeBtn.addEventListener('click', close)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })

  type EdvEntry = { key: string; nameInput: HTMLInputElement; checkbox: HTMLInputElement }
  let entries: EdvEntry[] = []
  let allSelected = true

  const updateBtn = () => {
    createBtn.disabled = entries.filter(e => e.checkbox.checked && e.nameInput.value.trim()).length === 0
  }

  const renderKeys = (keys: string[]) => {
    listEl.innerHTML = ''; entries = []; allSelected = true
    selectAllBtn.textContent = 'Deseleziona tutti'
    if (keys.length === 0) {
      const msg = document.createElement('div'); msg.className = 'amd-dlv-empty'; msg.textContent = 'Nessun campo trovato.'
      listEl.appendChild(msg); updateBtn(); return
    }
    for (const key of keys) {
      const item = document.createElement('div'); item.className = 'amd-dlv-item'
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true
      cb.addEventListener('change', updateBtn)
      const code = document.createElement('code'); code.textContent = key
      const ni = document.createElement('input'); ni.type = 'text'; ni.value = 'ed - ' + key
      item.append(cb, code, ni); listEl.appendChild(item)
      entries.push({ key, nameInput: ni, checkbox: cb })
    }
    updateBtn()
  }

  selectAllBtn.addEventListener('click', () => {
    allSelected = !allSelected
    entries.forEach(e => { e.checkbox.checked = allSelected })
    selectAllBtn.textContent = allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'
    updateBtn()
  })

  // ── JSON parse ────────────────────────────────────────────────────────────────
  let debounce: ReturnType<typeof setTimeout> | null = null
  textarea.addEventListener('input', () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      const raw = textarea.value.trim()
      errorEl.textContent = ''
      if (!raw) {
        listEl.innerHTML = ''; listEl.appendChild(emptyEl); entries = []; updateBtn(); return
      }
      try {
        let obj: Record<string, unknown>
        if (raw.startsWith('{')) {
          // JSON mode
          const parsed = JSON.parse(raw) as Record<string, unknown>
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
          obj = parsed
        } else {
          // GA4 Measurement Protocol query string or full URL
          obj = parseGa4MpQueryString(raw)
          if (Object.keys(obj).length === 0) throw new Error('empty')
        }
        renderKeys(parseEventDataKeys(obj))
      } catch {
        errorEl.textContent = 'Formato non riconosciuto — incolla un JSON oppure una query string MP (v=2&en=...&ep.X=...).'
        listEl.innerHTML = ''; entries = []; updateBtn()
      }
    }, 280)
  })

  // ── Create ────────────────────────────────────────────────────────────────────
  createBtn.addEventListener('click', () => {
    createBtn.disabled = true; statusEl.textContent = ''; statusEl.style.color = '#137333'
    const toCreate = entries.filter(e => e.checkbox.checked && e.nameInput.value.trim())
    void (async () => {
      try {
        const { ok, fail, skipped } = await createEventDataVariables(
          toCreate.map(e => ({ key: e.key, name: e.nameInput.value.trim() }))
        )
        if (ok === 0 && fail > 0) throw new Error('Creazione fallita — verifica la console per dettagli.')
        const parts: string[] = []
        if (ok > 0) parts.push(`${ok} variabl${ok === 1 ? 'e' : 'i'} create`)
        if (skipped > 0) parts.push(`${skipped} già esistenti`)
        if (fail > 0) parts.push(`${fail} fallite`)
        statusEl.textContent = parts.join(', ') || 'Nessuna variabile da creare'
        setTimeout(close, 1800)
      } catch (err) {
        statusEl.style.color = '#c5221f'
        statusEl.textContent = err instanceof Error ? err.message : 'Errore durante la creazione'
        createBtn.disabled = false
      }
    })()
  })
}

// ─────────────────────────────────────────────────────────────────────────────

function showToast(msg: string) {
  document.querySelector('.amd-toast')?.remove()
  const toast = document.createElement('div')
  toast.className = 'amd-toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2500)
}

// Keep in sync with GTM's own re-renders (debounced). Ignore mutations that
// originate inside our own toolbar/editor to avoid a feedback loop.
let scheduled = false
const observer = new MutationObserver((mutations) => {
  const ours = mutations.every((m) => {
    const t = m.target as HTMLElement
    return t.closest?.(`#${TOOLBAR_ID}, #amd-label-editor, #andromeda-filters-style, #amd-table-actions, .amd-table-modal-overlay, .amd-toast, #amd-dlv-modal, #amd-edv-modal`)
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
    __amdDropdownBound?: boolean
    __amdTableKbBound?: boolean
    __amdFolderScanned?: boolean
  }
}
window.QOL ??= {}
