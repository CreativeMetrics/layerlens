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
/** All pushes accumulated since the last renderDataLayer call (newest first). */
let allPushes: unknown[] = []
/** Current text filter (lowercase). Empty string = no filter active. */
let filterText = ''

// ── Pin helpers ───────────────────────────────────────────────────────────────

/** Move all pinned cards to the top, add a separator, then unpinned below. */
function sortPushes() {
  const body = $('dl-modal-body')
  if (!body) return
  body.querySelector('.pin-separator')?.remove()
  const cards = Array.from(body.querySelectorAll<HTMLElement>(':scope > .push'))
  const pinned = cards.filter((c) => c.classList.contains('pinned'))
  const unpinned = cards.filter((c) => !c.classList.contains('pinned'))
  if (pinned.length === 0) return
  // Build a DocumentFragment — appending DOM nodes to a fragment removes them
  // from their current parent, so body empties as we fill the fragment.
  const frag = document.createDocumentFragment()
  pinned.forEach((c) => frag.appendChild(c))
  const sep = document.createElement('div')
  sep.className = 'pin-separator'
  sep.innerHTML = '<span>fissati</span>'
  frag.appendChild(sep)
  unpinned.forEach((c) => frag.appendChild(c))
  body.appendChild(frag)
}

/** Toggle the pinned state of a push card and re-sort. */
function togglePin(card: HTMLElement) {
  const isPinning = !card.classList.contains('pinned')
  card.classList.toggle('pinned', isPinning)
  const btn = card.querySelector<HTMLElement>('.pin-btn')
  if (btn) {
    btn.title = isPinning ? 'Rimuovi dai fissati' : 'Fissa in cima'
    btn.setAttribute('aria-pressed', String(isPinning))
  }
  sortPushes()
  applyFilter()
}

// ── Filter helper ─────────────────────────────────────────────────────────────

/** Show/hide push cards matching the current filterText.
 *  Pinned cards are always visible regardless of the filter. */
function applyFilter() {
  const body = $('dl-modal-body')
  if (!body) return
  const cards = Array.from(body.querySelectorAll<HTMLElement>(':scope > .push'))
  let visible = 0
  for (const card of cards) {
    if (card.classList.contains('pinned')) {
      card.style.display = ''
      visible++
      continue
    }
    const matches =
      !filterText ||
      (card.dataset.ev ?? '').includes(filterText) ||
      (card.dataset.json ?? '').includes(filterText)
    card.style.display = matches ? '' : 'none'
    if (matches) visible++
  }
  // Show "X di Y" feedback only when a filter is active
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
  const body = $('dl-modal-body')
  const title = $('dl-modal-title')
  const count = $('dl-count')
  if (!view || !body || !main) return
  if (title) title.textContent = name || 'dataLayer'
  body.innerHTML = ''

  // Reset filter and pin state (pins are on DOM nodes, cleared by innerHTML = '').
  filterText = ''
  const filterInput = $('dl-filter-input') as HTMLInputElement | null
  if (filterInput) filterInput.value = ''
  const filterCount = $('dl-filter-count')
  if (filterCount) filterCount.style.display = 'none'

  let pushes: unknown[] = []
  try {
    const parsed = JSON.parse(raw)
    pushes = Array.isArray(parsed) ? parsed : []
  } catch {
    pushes = []
  }
  // Keep a flat copy, newest first, for export.
  allPushes = [...pushes].reverse()
  pushCounter = pushes.length
  if (count) count.textContent = pushes.length ? String(pushes.length) : ''

  if (pushes.length === 0) {
    body.innerHTML = `<p class="muted small">Nessun push nel dataLayer di questa pagina.</p>`
  } else {
    // Newest push (highest index in the original array) shown at the top.
    for (let i = pushes.length - 1; i >= 0; i--) {
      body.appendChild(makePushNode(pushes[i], i))
    }
  }
  main.setAttribute('hidden', '')
  view.removeAttribute('hidden')
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
    allPushes.unshift(entry) // keep newest-first in export buffer
    const node = makePushNode(entry, pushCounter++)
    node.classList.add('push-new')
    // Insert after pinned cards + separator so live pushes don't jump above pins.
    const sep = body.querySelector<HTMLElement>('.pin-separator')
    body.insertBefore(node, sep ? sep.nextSibling : body.firstChild)
    setTimeout(() => node.classList.remove('push-new'), 1200)
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

  // Reopen the dataLayer view if that's where the user left off. chrome.storage
  // .session persists across popup open/close (sessionStorage does not).
  try {
    chrome.storage?.session?.get('amd_popup_view', (r) => {
      if (r?.amd_popup_view === 'dl') sendToActiveTab({ code: 'GET_DATALAYER' })
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
  await bindToggle('qol_changes')
  await bindToggle('block_page_change')
  bindSettings()
  bindDataLayer()
}
void init()
