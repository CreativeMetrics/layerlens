import * as storage from '@/lib/storage'
import type { StorageSchema } from '@/lib/storage'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null

/* ---------- toggles ---------- */
type Flag = 'qol_changes' | 'block_page_change'

async function bindToggle(id: Flag) {
  const box = $(id) as HTMLInputElement | null
  if (!box) return
  box.checked = (await storage.get(id)) === 1
  box.addEventListener('change', async () => {
    const value: 0 | 1 = box.checked ? 1 : 0
    await storage.set({ [id]: value } as Partial<StorageSchema>)
    if (id === 'block_page_change') {
      // Notify ALL tabs (like the original) so already-open pages react immediately.
      const tabs = await chrome.tabs.query({})
      for (const t of tabs)
        if (t.id != null)
          chrome.tabs
            .sendMessage(t.id, { action: 'block_page_change', value: Boolean(value) })
            .catch(() => {})
    }
  })
}

/* ---------- settings panel ---------- */
function bindSettings() {
  const panel = $('settings')
  $('open-settings')?.addEventListener('click', () => {
    if (panel?.hasAttribute('hidden')) panel.removeAttribute('hidden')
    else panel?.setAttribute('hidden', '')
  })
  const v = chrome.runtime.getManifest().version
  if ($('ext-version')) $('ext-version')!.textContent = v
  if ($('footer-version')) $('footer-version')!.textContent = `LayerLens v${v}`
}

/* ---------- dataLayer / containers ---------- */
interface PageMsg {
  code?: string
  data?: { ids?: string[]; dataLayer?: string; dataLayerName?: string }
}

let containerIds: string[] = []
let dataLayerName = 'dataLayer'

function sendToActiveTab(message: unknown) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id != null) chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {})
  })
}

function renderContainers(ids: string[]) {
  const incoming = ids.filter((id) => id.startsWith('GTM-'))
  const count = $('container-count')
  const status = $('dl-status')
  const list = $('containers')
  const noGtm = $('no-gtm')
  const inspect = $('inspect-dl') as HTMLButtonElement | null
  if (!list || !status) return

  // A later empty emission (polling fires before GTM is ready) must not erase
  // containers we already found. Ignore empty updates once we have some.
  if (incoming.length === 0 && containerIds.length > 0) return
  containerIds = incoming

  list.innerHTML = ''
  if (containerIds.length === 0) {
    status.textContent = 'Nessun GTM in questa pagina'
    count?.setAttribute('hidden', '')
    noGtm?.removeAttribute('hidden')
    if (inspect) inspect.disabled = true
    return
  }
  status.textContent =
    containerIds.length === 1 ? 'Container trovato' : 'Container trovati su questa pagina'
  if (count) {
    count.textContent = String(containerIds.length)
    count.removeAttribute('hidden')
  }
  noGtm?.setAttribute('hidden', '')
  for (const id of containerIds) {
    const item = document.createElement('div')
    item.className = 'container-item'
    item.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/></svg><span>${id}</span><span class="sz" data-sz="${id}"></span>`
    list.appendChild(item)
    // estimate size from gtm.js (best-effort)
    fetch(`https://www.googletagmanager.com/gtm.js?id=${id}`)
      .then((r) => r.blob())
      .then((b) => {
        const kb = Math.round(b.size / 1024)
        const el = item.querySelector<HTMLElement>('.sz')
        if (el) el.textContent = `~${kb} KB`
      })
      .catch(() => {})
  }
  if (inspect) inspect.disabled = false
}

/* JSON syntax highlight (escaped, then colored) */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function highlight(json: string) {
  return escapeHtml(json)
    .replace(/&quot;([^&]+?)&quot;:/g, '<span class="k">"$1"</span>:')
    .replace(/: &quot;([^&]*?)&quot;/g, ': <span class="s">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="b">$1</span>')
}

function makePushNode(push: unknown, index: number): HTMLElement {
  const obj = push as Record<string, unknown>
  const hasEvent = obj && typeof obj === 'object' && typeof obj.event === 'string'
  const event = hasEvent ? (obj.event as string) : `push ${index + 1}`
  const json = JSON.stringify(push, null, 2)
  const propCount = obj && typeof obj === 'object' ? Object.keys(obj).length : 0
  const wrap = document.createElement('div')
  wrap.className = 'push' + (hasEvent ? ' has-event' : '')
  // Store searchable text as data attributes so applyFilter() never touches the DOM.
  wrap.dataset.ev = event.toLowerCase()
  wrap.dataset.json = json.toLowerCase()
  wrap.dataset.raw = json  // original JSON string — used by pin persistence
  wrap.innerHTML = `
    <div class="push-head">
      <svg class="chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6l-6 6"/></svg>
      <span class="ev">${escapeHtml(String(event))}</span>
      <span class="push-prop-count">${propCount} prop</span>
      <button class="pin-btn" title="Fissa in cima" aria-pressed="false"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg></button>
      <span class="copy"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/></svg>copia</span>
    </div>
    <pre class="push-json">${highlight(json)}</pre>`
  wrap.querySelector('.push-head')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.copy, .pin-btn')) return
    wrap.classList.toggle('open')
  })
  wrap.querySelector('.pin-btn')?.addEventListener('click', () => togglePin(wrap))
  wrap.querySelector('.copy')?.addEventListener('click', () => {
    const helper = $('clipboard-helper') as HTMLTextAreaElement | null
    if (!helper) return
    helper.value = `${dataLayerName}.push(${json});`
    helper.select()
    document.execCommand('copy')
    const c = wrap.querySelector('.copy')!
    c.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>copiato`
    setTimeout(() => (c.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/></svg>copia`), 1500)
  })
  return wrap
}

let pushCounter = 0
/** All pushes of the current page (newest first) — used for export. */
let allPushes: unknown[] = []
/** Current text filter (lowercase). Empty string = no filter active. */
let filterText = ''

// ── Page-history & pin state ──────────────────────────────────────────────────

/** Raw JSON (original formatting) of every pinned push.
 *  Stored as strings so pins survive renderDataLayer (page navigation). */
const pinnedRaws = new Set<string>()

/** Previous page visits, most recent first. */
interface PageRecord { label: string; pushes: unknown[] }
let historyPages: PageRecord[] = []
/** Current page's pushes, oldest → newest. */
let currentPushes: unknown[] = []
let visitCounter = 0
let currentPageLabel = ''

/** Whether the filter searches only the current page or the whole history. */
let searchScope: 'page' | 'all' = 'page'

/** Set to true after restoring session state so the next renderDataLayer call
 *  (which fires immediately to refresh the current page) doesn't archive the
 *  just-restored currentPushes as a brand-new history entry. */
let skipNextArchive = false

// ── Session-state persistence ─────────────────────────────────────────────────
// chrome.storage.session survives popup close/reopen within the same browser
// session, so pins and page history are preserved even though the popup is
// destroyed every time the user clicks away from it.

function saveSessionState() {
  try {
    void chrome.storage.session.set({
      ll_pins: [...pinnedRaws],
      ll_history: historyPages,
      ll_current: currentPushes,
      ll_visit: visitCounter,
      ll_page_label: currentPageLabel,
    })
  } catch { /* session storage unavailable in this context */ }
}

async function loadSessionState() {
  try {
    const r = await chrome.storage.session.get([
      'll_pins', 'll_history', 'll_current', 'll_visit', 'll_page_label',
    ])
    if (Array.isArray(r.ll_pins)) {
      for (const s of r.ll_pins as string[]) pinnedRaws.add(s)
    }
    if (Array.isArray(r.ll_history)) historyPages = r.ll_history as PageRecord[]
    if (Array.isArray(r.ll_current)) currentPushes = r.ll_current as unknown[]
    if (typeof r.ll_visit === 'number') visitCounter = r.ll_visit
    if (typeof r.ll_page_label === 'string') currentPageLabel = r.ll_page_label
    // If any state was restored, skip archiving on the very next renderDataLayer
    // so we don't double-add the current page to history when the popup reopens.
    if (currentPushes.length > 0 || historyPages.length > 0 || pinnedRaws.size > 0) {
      skipNextArchive = true
    }
  } catch { /* session storage unavailable */ }
}

// ── Core render ───────────────────────────────────────────────────────────────

/** Full rebuild of the push list from stored state.
 *  Called on page navigation, pin toggle, and scope change. */
function rebuildPushList() {
  const body = $('dl-modal-body')
  const countEl = $('dl-count')
  if (!body) return
  body.innerHTML = ''

  // PINNED SECTION — re-created from pinnedRaws so pins survive page changes.
  if (pinnedRaws.size > 0) {
    let pi = -1
    for (const raw of pinnedRaws) {
      try {
        const push = JSON.parse(raw)
        const node = makePushNode(push, pi--)
        node.classList.add('pinned')
        const btn = node.querySelector<HTMLElement>('.pin-btn')
        if (btn) { btn.title = 'Rimuovi dai fissati'; btn.setAttribute('aria-pressed', 'true') }
        body.appendChild(node)
      } catch { /* skip corrupt entry */ }
    }
    const sep = document.createElement('div')
    sep.className = 'pin-separator'
    sep.innerHTML = '<span>fissati</span>'
    body.appendChild(sep)
  }

  // CURRENT PAGE — newest first, skip anything already pinned.
  const totalCurrent = currentPushes.length
  ;[...currentPushes].reverse().forEach((push, i) => {
    const raw = JSON.stringify(push, null, 2)
    if (pinnedRaws.has(raw)) return
    body.appendChild(makePushNode(push, totalCurrent - 1 - i))
  })

  // HISTORY PAGES — shown only in "all" scope mode.
  if (searchScope === 'all') {
    for (const page of historyPages) {
      const sep = document.createElement('div')
      sep.className = 'page-separator'
      sep.innerHTML = `<span>${escapeHtml(page.label)} — ${page.pushes.length} push</span>`
      body.appendChild(sep)
      ;[...page.pushes].reverse().forEach((push, i) => {
        const raw = JSON.stringify(push, null, 2)
        if (pinnedRaws.has(raw)) return
        const node = makePushNode(push, page.pushes.length - 1 - i)
        node.dataset.historyPage = page.label
        body.appendChild(node)
      })
    }
  }

  // Empty state (no pins and no page pushes visible).
  const hasPushes = body.querySelector('.push')
  if (!hasPushes) {
    const p = document.createElement('p')
    p.className = 'muted small'
    p.textContent = 'Nessun push nel dataLayer di questa pagina.'
    body.appendChild(p)
  }

  // Update total count badge.
  if (countEl) {
    const total =
      searchScope === 'all'
        ? currentPushes.length + historyPages.reduce((s, pg) => s + pg.pushes.length, 0)
        : currentPushes.length
    countEl.textContent = total ? String(total) : ''
  }

  applyFilter()
}

// ── Pin helper ────────────────────────────────────────────────────────────────

/** Toggle the pin on a push card. Pins are stored by raw JSON so they survive
 *  page navigations — on the next renderDataLayer call they reappear at the top. */
function togglePin(card: HTMLElement) {
  const raw = card.dataset.raw ?? ''
  if (!raw) return
  if (pinnedRaws.has(raw)) {
    pinnedRaws.delete(raw)
  } else {
    pinnedRaws.add(raw)
  }
  saveSessionState()
  rebuildPushList()
}

// ── Filter helper ─────────────────────────────────────────────────────────────

/** Show/hide push cards matching filterText. Pinned cards are always visible. */
function applyFilter() {
  const body = $('dl-modal-body')
  if (!body) return
  const cards = Array.from(body.querySelectorAll<HTMLElement>(':scope > .push'))
  let visible = 0
  for (const card of cards) {
    if (card.classList.contains('pinned')) { card.style.display = ''; visible++; continue }
    const matches =
      !filterText ||
      (card.dataset.ev ?? '').includes(filterText) ||
      (card.dataset.json ?? '').includes(filterText)
    card.style.display = matches ? '' : 'none'
    if (matches) visible++
  }
  const countEl = $('dl-filter-count')
  if (countEl) {
    if (filterText) {
      countEl.textContent = `${visible} di ${cards.length}`
      countEl.style.display = ''
    } else {
      countEl.style.display = 'none'
    }
  }
}

function renderDataLayer(raw: string, name: string) {
  dataLayerName = name || 'dataLayer'
  const main = $('view-main')
  const view = $('view-dl')
  const title = $('dl-modal-title')
  if (!view || !main) return
  if (title) title.textContent = name || 'dataLayer'

  let pushes: unknown[] = []
  try {
    const parsed = JSON.parse(raw)
    pushes = Array.isArray(parsed) ? parsed : []
  } catch {
    pushes = []
  }

  // Archive the previous page before replacing currentPushes.
  // skipNextArchive is true when we just restored state from session storage
  // (popup reopen) — the existing currentPushes already represent the current
  // page and must NOT be double-added to history.
  if (currentPushes.length > 0 && !skipNextArchive) {
    historyPages.unshift({ label: currentPageLabel, pushes: [...currentPushes] })
  }
  skipNextArchive = false
  visitCounter++
  currentPageLabel = `Visita ${visitCounter}`
  currentPushes = [...pushes]  // oldest → newest
  allPushes = [...pushes].reverse()
  pushCounter = pushes.length

  // Reset the text filter but keep pins and scope intact.
  filterText = ''
  const filterInput = $('dl-filter-input') as HTMLInputElement | null
  if (filterInput) filterInput.value = ''
  const filterCount = $('dl-filter-count')
  if (filterCount) filterCount.style.display = 'none'

  saveSessionState()
  main.setAttribute('hidden', '')
  view.removeAttribute('hidden')
  rebuildPushList()
}

/** Append live pushes to the top of the list as they happen. */
function appendLivePush(raw: string) {
  const body = $('dl-modal-body')
  const count = $('dl-count')
  if (!body || $('view-dl')?.hasAttribute('hidden')) return
  let entries: unknown[] = []
  try {
    const parsed = JSON.parse(raw)
    entries = Array.isArray(parsed) ? parsed : []
  } catch {
    return
  }
  body.querySelector('.muted')?.remove()
  for (const entry of entries) {
    currentPushes.push(entry)            // accumulate for page history
    allPushes.unshift(entry)             // keep newest-first in export buffer
    const rawStr = JSON.stringify(entry, null, 2)
    if (!pinnedRaws.has(rawStr)) {
      const node = makePushNode(entry, pushCounter)
      node.classList.add('push-new')
      // Insert after pinned cards + separator so live pushes don't jump above pins.
      const sep = body.querySelector<HTMLElement>('.pin-separator')
      body.insertBefore(node, sep ? sep.nextSibling : body.firstChild)
      setTimeout(() => node.classList.remove('push-new'), 1200)
    }
    pushCounter++
  }
  if (count) count.textContent = String(pushCounter)
  if (filterText) applyFilter()
}

/** Download all accumulated pushes as a JSON file. */
function exportDataLayer() {
  if (allPushes.length === 0) return
  // Export in chronological order (oldest first), regardless of display order.
  const ordered = [...allPushes].reverse()
  const json = JSON.stringify(ordered, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dataLayerName}-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function rememberView(view: 'dl' | 'main') {
  try {
    chrome.storage?.session?.set({ amd_popup_view: view })
  } catch {
    /* ignore */
  }
}

function bindDataLayer() {
  $('inspect-dl')?.addEventListener('click', () => {
    rememberView('dl')
    sendToActiveTab({ code: 'GET_DATALAYER' })
  })
  $('dl-back')?.addEventListener('click', () => {
    stopLiveIfOn()
    rememberView('main')
    $('view-dl')?.setAttribute('hidden', '')
    $('view-main')?.removeAttribute('hidden')
  })
  $('dl-export')?.addEventListener('click', exportDataLayer)

  const filterInput = $('dl-filter-input') as HTMLInputElement | null
  filterInput?.addEventListener('input', () => {
    filterText = (filterInput.value ?? '').toLowerCase().trim()
    applyFilter()
  })

  // Scope toggle: "Pagina" (current page only) vs "Storico" (all history).
  function setScopeActive(scope: 'page' | 'all') {
    searchScope = scope
    $('scope-page')?.classList.toggle('scope-active', scope === 'page')
    $('scope-all')?.classList.toggle('scope-active', scope === 'all')
    rebuildPushList()
  }
  $('scope-page')?.addEventListener('click', () => setScopeActive('page'))
  $('scope-all')?.addEventListener('click', () => setScopeActive('all'))

  const liveBox = $('dl-live') as HTMLInputElement | null
  liveBox?.addEventListener('change', () => {
    if (liveBox.checked) sendToActiveTab({ code: 'START_DL_LIVE' })
    else sendToActiveTab({ code: 'STOP_DL_LIVE' })
  })

  chrome.runtime.onMessage.addListener((msg: PageMsg) => {
    if (msg.code === 'LIST_GTM_ID' && msg.data?.ids) renderContainers(msg.data.ids)
    if (msg.code === 'TABLE_DATALAYER' && msg.data)
      renderDataLayer(msg.data.dataLayer ?? '[]', msg.data.dataLayerName ?? 'dataLayer')
    if (msg.code === 'DATALAYER_PUSH' && msg.data) appendLivePush(msg.data.dataLayer ?? '[]')
  })

  // Ask the active tab for its containers on open.
  sendToActiveTab({ code: 'GET_GTM_ID' })

  // Reopen the dataLayer view if that's where the user left off.
  // If we restored session state, show the cached view immediately (fast), then
  // also request a fresh snapshot — renderDataLayer will update it when it arrives.
  try {
    chrome.storage?.session?.get('amd_popup_view', (r) => {
      if (r?.amd_popup_view !== 'dl') return
      const hasCache = currentPushes.length > 0 || historyPages.length > 0 || pinnedRaws.size > 0
      if (hasCache) {
        const main = $('view-main')
        const view = $('view-dl')
        const title = $('dl-modal-title')
        if (main && view) {
          if (title) title.textContent = dataLayerName
          main.setAttribute('hidden', '')
          view.removeAttribute('hidden')
          rebuildPushList()
        }
      }
      sendToActiveTab({ code: 'GET_DATALAYER' })
    })
  } catch {
    /* ignore */
  }
}

function stopLiveIfOn() {
  const liveBox = $('dl-live') as HTMLInputElement | null
  if (liveBox?.checked) {
    liveBox.checked = false
    sendToActiveTab({ code: 'STOP_DL_LIVE' })
  }
}

/* ---------- init ---------- */
async function init() {
  // Load persisted session state first so pins and history are ready before
  // bindDataLayer sets up listeners and potentially triggers renderDataLayer.
  await loadSessionState()
  await bindToggle('qol_changes')
  await bindToggle('block_page_change')
  bindSettings()
  bindDataLayer()
}
void init()
