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
      // __llTs only ever has entries for pushes that went through our wrapper —
      // anything pushed before it attached has none, so it's a suffix of `dl`,
      // not a 1:1 match. Align it to the tail and leave earlier slots as null
      // ("not determinable"), then send it already zipped to `dl`'s indices so
      // nothing downstream has to redo that alignment.
      const tsArr = (dl as unknown[] & { __llTs?: number[] }).__llTs
      const timestamps = Array.isArray(tsArr)
        ? (() => {
            const offset = Math.max(0, dl.length - tsArr.length)
            return dl.map((_, i) => (i >= offset ? tsArr[i - offset] : null))
          })()
        : undefined
      post({
        code: 'TABLE_DATALAYER',
        data: {
          dataLayer: stringifyDataLayer(dl),
          dataLayerName: name,
          ...(timestamps ? { timestamps } : {}),
        },
      })
      break
    }
    case 'START_DL_LIVE':
      startLive()
      break
    case 'STOP_DL_LIVE':
      stopLive()
      break
    case 'SET_DL_BG_CAPTURE': {
      const enabled = (data as { data?: { enabled?: boolean } }).data?.enabled
      bgCaptureEnabled = Boolean(enabled)
      if (bgCaptureEnabled) ensurePushWrapped()
      break
    }
  }
})

// Ask the content script for the current dl_bg_capture setting (it reads
// chrome.storage directly and answers with SET_DL_BG_CAPTURE) now that the
// listener above is attached to receive the reply.
post({ code: 'GET_DL_BG_CAPTURE_STATE' })

function resolveDataLayer(): { name: string; dl: unknown[] } {
  const id = listGtmIds()[0]
  const name =
    (id && window.google_tag_manager?.[id]?.dataLayer?.name) || dataLayerName() || 'dataLayer'
  const dl = (window as unknown as Record<string, unknown[]>)[name] || []
  return { name, dl }
}

// ── DL_BG_PUSH carryover buffer — survives same-origin navigation ───────────
// The path from a page-world push to background.ts's tabDlLog has two async
// hops (window.postMessage, then chrome.runtime.sendMessage from the content
// script) and neither is guaranteed to complete before the page unloads. A
// push that fires immediately before navigation (e.g. select_item on a list
// item click, right before the browser navigates to the PDP) can be added to
// the underlying array fine — a direct dataLayer read shows it — while still
// never reaching DL_BG_PUSH, making it silently missing from the export.
// sessionStorage.setItem is synchronous and lands in the same tick as the
// push itself, with no event-loop hop to lose, so buffering there first makes
// the push durable across the navigation regardless of whether the async
// messaging chain wins the race. sessionStorage carries over for same-origin
// navigations (the case this targets — list to PDP on the same site), so the
// next page's copy of this script can replay anything left over, tagged with
// its original URL/ts (`originUrl`) so background attributes it to the page
// it actually happened on rather than the page just navigated to.
const DL_CARRYOVER_KEY = '__ll_dl_carryover'
// Heavily-tracked ecommerce sites can fire dozens of dataLayer pushes (ad/analytics
// pixels, consent re-checks, etc.) in the brief window between a click and the
// resulting navigation actually unloading the page — 30 was too small and let a
// FIFO eviction silently drop the very push (e.g. select_item) this buffer exists
// to protect, before the page even unloaded. Each entry is a small JSON string, so
// raising this is cheap.
const DL_CARRYOVER_MAX = 300
type CarryoverEntry = { dataLayer: string; dataLayerName: string; ts: number; originUrl: string }

function bufferCarryover(entry: CarryoverEntry): void {
  try {
    const raw = sessionStorage.getItem(DL_CARRYOVER_KEY)
    const list: CarryoverEntry[] = raw ? JSON.parse(raw) : []
    list.push(entry)
    while (list.length > DL_CARRYOVER_MAX) list.shift()
    sessionStorage.setItem(DL_CARRYOVER_KEY, JSON.stringify(list))
  } catch {
    /* sessionStorage unavailable (privacy mode, quota) — backstop simply skipped */
  }
}

/** Re-sends whatever is currently buffered, WITHOUT clearing it — used as a
 *  best-effort extra attempt on pagehide/visibilitychange, since we can't be
 *  sure the original real-time post() for the most recent push(es) was
 *  processed before the page starts unloading. Safe to call repeatedly:
 *  background dedupes carryover replays against what it already logged. */
function resendCarryoverBuffer(): void {
  try {
    const raw = sessionStorage.getItem(DL_CARRYOVER_KEY)
    if (!raw) return
    const list: CarryoverEntry[] = JSON.parse(raw)
    for (const entry of list) {
      post({
        code: 'DL_BG_PUSH',
        data: {
          dataLayer: entry.dataLayer,
          dataLayerName: entry.dataLayerName,
          ts: entry.ts,
          originUrl: entry.originUrl,
        },
      })
    }
  } catch {
    /* malformed carryover — nothing to resend */
  }
}

// Authoritative consumption point: every fresh page load (this script is
// re-injected per navigation) replays then clears whatever the PREVIOUS
// page's instance left behind. Only this call clears the buffer — the
// pagehide/visibilitychange resends below intentionally leave it intact so
// it still backstops the case where even this resend doesn't make it out
// before the document is gone.
resendCarryoverBuffer()
try {
  sessionStorage.removeItem(DL_CARRYOVER_KEY)
} catch {
  /* ignore */
}

window.addEventListener('pagehide', resendCarryoverBuffer)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') resendCarryoverBuffer()
})

// --- push interception (live mode + background capture) ---
// GTM itself (and some CMP/tag-management scripts) reassign `dataLayer.push`
// after page load — gtm.js does this once it finishes initialising, to hook in
// its own trigger-processing wrapper. A one-shot wrap installed before that
// point can be silently dropped from the chain if whatever reassigns `.push`
// doesn't call through to it, after which every later push goes uncaptured by
// us even though it's still added to the underlying array. The array can also
// not exist yet at all when this script first runs (GTM lazy init).
//
// So instead of wrapping once, a watchdog re-asserts our wrapper on a short
// interval (and immediately when a feature is turned on) whenever the array
// reference changed or `.push` is no longer the function we last installed —
// treating whatever is currently there as the new "original" so we never
// break whoever else's wrapper is in the chain. Both live mode and background
// capture share this single wrapper (checked via two independent enabled
// flags) so re-wrapping for one never knocks the other one's layer off by
// growing two competing wrap chains.
type PushFn = (...args: unknown[]) => number
type PushSub = { isEnabled: () => boolean; code: 'DATALAYER_PUSH' | 'DL_BG_PUSH' }

const pushSubs: PushSub[] = []
let watchedArr: unknown[] | null = null
let ourPushWrapper: PushFn | null = null

function ensurePushWrapped(): void {
  const { name } = resolveDataLayer()
  const arr = (window as unknown as Record<string, unknown[]>)[name]
  if (!Array.isArray(arr)) return
  if (arr === watchedArr && (arr as unknown as { push: PushFn }).push === ourPushWrapper) return

  // Parallel, always-on record of push timestamps — independent of whether
  // live mode or background capture are toggled on. Without this, "_ts" in
  // the export only ever existed when the user had flipped one of those
  // opt-in toggles before pushing, which is not the common path (open
  // inspector, export, done). Kept on the array itself (non-enumerable) so
  // it survives across ensurePushWrapped() re-wraps of the same array.
  const tagged = arr as unknown[] & { __llTs?: number[] }
  if (!Array.isArray(tagged.__llTs)) {
    // Backfill: pushes already in the array before this first attach (GTM init,
    // consent default, etc. — easily ~16 entries) have no real push-instant
    // timestamp available anymore. Stamping them with "now" (the attach instant)
    // is the best available approximation, and matters in practice: the consent
    // 'default'/'update' commands usually fire among these very first pushes, so
    // leaving them without _ts was silently starving computeConsentGrantedAt's
    // dataLayer-based detection (popup.ts) of its main signal.
    Object.defineProperty(tagged, '__llTs', {
      value: new Array(arr.length).fill(Date.now()),
      enumerable: false,
      configurable: true,
    })
  }
  const tsArr = tagged.__llTs as number[]

  const original = arr.push.bind(arr)
  const wrapper: PushFn = function (...args: unknown[]) {
    const result = original(...args)
    // Captured here, at the actual push instant, not at message-receipt time
    // downstream (background.ts / popup.ts) — avoids skew from postMessage/IPC
    // latency, matching how network[].ts captures its ts at the actual request.
    const ts = Date.now()
    for (let i = 0; i < args.length; i++) tsArr.push(ts)
    for (const sub of pushSubs) {
      if (!sub.isEnabled()) continue
      for (const entry of args) {
        try {
          const serialized = stringifyDataLayer([entry])
          post({ code: sub.code, data: { dataLayer: serialized, dataLayerName: name, ts } })
          // Synchronous backstop (see DL_BG_PUSH carryover buffer above) — only
          // for background capture, matching its opt-in/per-toggle scope.
          if (sub.code === 'DL_BG_PUSH') {
            bufferCarryover({ dataLayer: serialized, dataLayerName: name, ts, originUrl: location.href })
          }
        } catch {
          /* serialization issue — skip this entry, never break the page */
        }
      }
    }
    return result
  }
  arr.push = wrapper as unknown as typeof arr.push
  watchedArr = arr
  ourPushWrapper = wrapper
}

ensurePushWrapped()
setInterval(ensurePushWrapped, 500)

let liveActive = false
pushSubs.push({ isEnabled: () => liveActive, code: 'DATALAYER_PUSH' })
function startLive() {
  liveActive = true
  ensurePushWrapped()
}
function stopLive() {
  liveActive = false
}

void dataLayerName // reserved for future use (custom dataLayer name display)

// ── Background capture (opt-in via the "dl_bg_capture" toggle) ────────────────
// Off by default; forwards every push to the background service worker via
// DL_BG_PUSH (used for export accuracy — real timestamps even for pages
// visited before the popup was opened). Shares the watchdog wrap above.
let bgCaptureEnabled = false
pushSubs.push({ isEnabled: () => bgCaptureEnabled, code: 'DL_BG_PUSH' })

// ── IAB TCF (Transparency & Consent Framework) — user action marker ─────────
// CMP-agnostic signal: any CMP built on IAB TCF v2 (OneTrust, Cookiebot,
// Didomi, Usercentrics, etc. when configured for TCF) exposes window.__tcfapi.
// addEventListener fires with eventStatus 'useractioncomplete' the instant the
// user finishes interacting with the consent banner — independent of whatever
// Google Consent Mode signals the site separately (and sometimes incorrectly)
// wires up. The TCF spec doesn't guarantee a timestamp field on tcData, so we
// stamp with Date.now() at the instant our callback runs, same reasoning as
// the push wrapper's own ts capture (synchronous with the real event, no
// retrospective estimate). 'tcloaded' (fires for a returning visitor with an
// already-stored choice, no new action) is deliberately NOT forwarded — only
// 'useractioncomplete' represents a real marker for this session.
let tcfHooked = false
function hookTcf(): boolean {
  if (tcfHooked) return true
  const win = window as unknown as Record<string, unknown>
  const tcfapi = win['__tcfapi'] as
    | ((command: string, version: number, callback: (tcData: unknown, success: boolean) => void) => void)
    | undefined
  if (typeof tcfapi !== 'function') return false
  try {
    tcfapi('addEventListener', 2, (tcData, success) => {
      if (!success || !tcData || typeof tcData !== 'object') return
      if ((tcData as Record<string, unknown>)['eventStatus'] !== 'useractioncomplete') return
      post({ code: 'TCF_USER_ACTION', data: { ts: Date.now() } })
    })
    tcfHooked = true
  } catch {
    /* __tcfapi present but malformed — leave tcfHooked false, will retry */
  }
  return tcfHooked
}

if (!hookTcf()) {
  // __tcfapi loads asynchronously with the CMP script — poll briefly (same
  // pattern as the GTM-id poll above) until it's available, then stop; once
  // addEventListener is registered it keeps firing on its own for every
  // future state change, no further polling needed.
  let tcfPolls = 0
  const tcfPoll = setInterval(() => {
    tcfPolls += 1
    if (hookTcf() || tcfPolls >= 40) clearInterval(tcfPoll)
  }, 500)
}

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
