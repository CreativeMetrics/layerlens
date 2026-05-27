// Runs in the PAGE world (has access to window.google_tag_manager / dataLayer).
import type { PageMessage } from '@/types/messages'

function listGtmIds(): string[] {
  const ids: string[] = []
  const gtm = window.google_tag_manager
  if (gtm) for (const key of Object.keys(gtm)) if (key.startsWith('GTM')) ids.push(key)
  return ids
}

function dataLayerName(): string {
  const src = document.querySelector<HTMLScriptElement>("[src*='gtm.js']")?.src ?? ''
  if (!src) return ''
  const i = src.indexOf('&l=')
  return i > 0 ? src.slice(i + 3).split('&')[0] : 'dataLayer'
}

function stringifyDataLayer(dl: unknown[]): string {
  const out = (dl ?? []).map((push) => {
    if (!push || typeof push !== 'object') return push
    const clone: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(push)) {
      clone[k] =
        v instanceof HTMLElement ? v.outerHTML.replace(/"/g, "'").replace(/\n\s*/g, '') : v
    }
    return clone
  })
  return JSON.stringify(out)
}

function post(msg: PageMessage) {
  window.postMessage(msg, '*')
}

function emitGtmIds() {
  post({ code: 'LIST_GTM_ID', data: { ids: listGtmIds(), url: document.URL, origin: location.origin } })
}

// Same guard rationale as the content script: other actors postMessage plain
// strings, so type-check before `in`.
function hasCode(v: unknown): v is PageMessage & { code: string } {
  return typeof v === 'object' && v !== null && 'code' in v
}

// Proactively announce containers as soon as they appear (GTM may load late),
// instead of only replying to GET_GTM_ID — this removes the timing race.
let polls = 0
const poll = setInterval(() => {
  polls += 1
  const found = listGtmIds().length > 0
  if (found || polls >= 8) {
    emitGtmIds()
    clearInterval(poll)
  }
}, 600)
emitGtmIds()

window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window) return
  const data = e.data as unknown
  if (!hasCode(data)) return
  switch (data.code) {
    case 'GET_GTM_ID':
      emitGtmIds()
      break
    case 'GET_DATALAYER': {
      const { name, dl } = resolveDataLayer()
      post({ code: 'TABLE_DATALAYER', data: { dataLayer: stringifyDataLayer(dl), dataLayerName: name } })
      break
    }
    case 'START_DL_LIVE':
      startLive()
      break
    case 'STOP_DL_LIVE':
      stopLive()
      break
  }
})

function resolveDataLayer(): { name: string; dl: unknown[] } {
  const id = listGtmIds()[0]
  const name =
    (id && window.google_tag_manager?.[id]?.dataLayer?.name) || dataLayerName() || 'dataLayer'
  const dl = (window as unknown as Record<string, unknown[]>)[name] || []
  return { name, dl }
}

// --- live push monitoring (opt-in) ---
// We wrap dataLayer.push to observe NEW pushes in real time. We always call the
// original push afterwards, so the site's behaviour is unchanged. Wrapping is
// idempotent and only happens when the popup explicitly asks for it.
let liveActive = false
function startLive() {
  const { name } = resolveDataLayer()
  const arr = (window as unknown as Record<string, unknown[]>)[name]
  if (!Array.isArray(arr)) return
  liveActive = true
  const tagged = arr as unknown[] & { __amdWrapped?: boolean }
  if (tagged.__amdWrapped) return // already wrapped
  const original = arr.push.bind(arr)
  arr.push = function (...args: unknown[]) {
    const result = original(...args)
    if (liveActive) {
      for (const entry of args) {
        try {
          post({
            code: 'DATALAYER_PUSH',
            data: { dataLayer: stringifyDataLayer([entry]), dataLayerName: name },
          })
        } catch {
          /* serialization issue — skip this entry, never break the page */
        }
      }
    }
    return result
  } as typeof arr.push
  Object.defineProperty(tagged, '__amdWrapped', { value: true, enumerable: false })
}
function stopLive() {
  liveActive = false
}

void dataLayerName // reserved for future use (custom dataLayer name display)

// ── Shopify Pixel Sandbox bridge — parent side ────────────────────────────────
// Listens for '__ll_shopify_sandbox__' postMessages sent by the sandbox wrapper
// injected via background.ts (executeScript) or shopify-sandbox.content.ts.
// Uses SYN/ACK handshake so no events are lost if injection races the listener.
// Deduplication by event_id guards against the same payload arriving twice.
;(function () {
  const win = window as unknown as Record<string, unknown>
  if (win['__llShopifyParentBridge']) return
  win['__llShopifyParentBridge'] = true

  const MSG_TYPE = '__ll_shopify_sandbox__'
  const SYN_TYPE = '__ll_sandbox_syn__'
  const ACK_TYPE = '__ll_sandbox_ack__'

  function pushToParentDL(payload: unknown): void {
    if (!Array.isArray(win['dataLayer'])) win['dataLayer'] = []
    const dl = win['dataLayer'] as unknown[]
    const pid = (payload as Record<string, unknown>)?.['event_id']
    if (pid && typeof pid === 'string') {
      // Skip if an item with this event_id is already in the parent dataLayer
      // (Elevar pixels may push to window.top.dataLayer directly AND via the bridge).
      if (dl.some(
        (item) => typeof item === 'object' && item !== null &&
          (item as Record<string, unknown>)['event_id'] === pid
      )) return
      if (win['__llSeenIds'] === undefined) win['__llSeenIds'] = new Set<string>()
      ;(win['__llSeenIds'] as Set<string>).add(pid)
      setTimeout(() => (win['__llSeenIds'] as Set<string>).delete(pid), 5000)
    }
    dl.push(payload)
  }

  let bridgeReady = false
  const bridgeBuffer: unknown[] = []

  function flushBridgeBuffer(): void {
    while (bridgeBuffer.length > 0) pushToParentDL(bridgeBuffer.shift())
  }

  window.addEventListener(
    'message',
    (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return
      const d = e.data as Record<string, unknown>

      // Handshake: sandbox sends SYN → we reply ACK; or sandbox replies ACK to our SYN.
      if (d['type'] === SYN_TYPE || d['type'] === ACK_TYPE) {
        if (d['type'] === SYN_TYPE && e.source) {
          ;(e.source as Window).postMessage(
            { type: ACK_TYPE },
            e.origin === 'null' ? '*' : e.origin,
          )
        }
        if (!bridgeReady) { bridgeReady = true; flushBridgeBuffer() }
        return
      }

      if (d['type'] === MSG_TYPE) {
        const payload = d['payload']
        if (!payload || typeof payload !== 'object') return
        // Dedup by event_id (set by Elevar / custom pixel pushes).
        const pid = (payload as Record<string, unknown>)['event_id']
        if (pid && typeof pid === 'string') {
          if (win['__llSeenIds'] === undefined) win['__llSeenIds'] = new Set<string>()
          const seen = win['__llSeenIds'] as Set<string>
          if (seen.has(pid)) return
          seen.add(pid)
          setTimeout(() => seen.delete(pid), 5000)
        }
        if (bridgeReady) pushToParentDL(payload)
        else bridgeBuffer.push(payload)
      }
    },
    { passive: true },
  )

  // Initiate handshake with pixel iframes already in the DOM, and retry
  // periodically so iframes loaded after this script also get the SYN.
  function synWithPixelIframes(): void {
    document
      .querySelectorAll<HTMLIFrameElement>(
        '#web-pixels-manager-sandbox-container iframe[src*="/custom/web-pixel-"]',
      )
      .forEach((iframe) => iframe.contentWindow?.postMessage({ type: SYN_TYPE }, '*'))
  }
  synWithPixelIframes()
  setTimeout(synWithPixelIframes, 1000)
  setTimeout(synWithPixelIframes, 3000)
})()
