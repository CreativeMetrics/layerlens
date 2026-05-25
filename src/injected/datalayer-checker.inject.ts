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
