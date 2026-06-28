// MV3 service worker. Behaviour preserved from the legacy background.js, but:
//  - the duplicated GET/SET_FILTERS_CONFIGURATION listeners are merged into one router;
//  - storage/messaging go through the typed helpers;
//  - exit_preview cookie removal now works (the `cookies` permission was added).

import { DEFAULT_FILTERS_CONFIGURATION } from '@/lib/filters-schema'
import { onRuntimeMessage } from '@/lib/messaging'
import * as storage from '@/lib/storage'
import { CMP_COOKIE_NAME_RE, parseCmpCookie } from '@/lib/consent'
import type { CmpConsentResult } from '@/lib/consent'
import type { RuntimeMessage } from '@/types/messages'
import type { StorageSchema } from '@/lib/storage'

// ── Always-on dataLayer capture log ───────────────────────────────────────────
// Stores every dataLayer push received from content scripts via DL_BG_PUSH,
// regardless of popup state. Does NOT reset on navigation — accumulates across
// all page visits within a tab session (tagged with the source URL). Cleared on
// tab close. Cap at 500 entries per tab to bound memory usage.
const MAX_DL_LOG = 500
type DlLogEntry = { push: unknown; ts: number; url: string }
const tabDlLog = new Map<number, DlLogEntry[]>()

// Cached mirror of the 'dl_bg_capture' storage flag. DL_BG_PUSH fires once per
// dataLayer push (potentially many in a tight burst at page load), so it must
// stay fully synchronous in the common case: an onRuntimeMessage handler that
// does async work after returning `undefined` tells Chrome no response is
// coming, which lets the MV3 service worker be torn down before that work
// runs — silently dropping pushes. Reading storage on every push was exactly
// that bug. BUT: `null` here means "not yet loaded since this SW instance
// started" — a cold MV3 service worker is woken BY the very first incoming
// message (e.g. the carryover-replay DL_BG_PUSH right after a navigation),
// and at that instant this module's top-level `storage.get(...).then(...)`
// below hasn't resolved yet. If the handler read `dlBgCaptureEnabled` as a
// plain `false` default in that window, it would silently drop a push even
// though capture is genuinely enabled in storage — this was the source of the
// intermittent "select_item sometimes missing" behaviour (works when the SW
// happens to already be warm, fails right after it cold-starts). The handler
// awaits `dlBgCaptureReady` (returning a Promise, which keeps the SW alive
// for it) only on this first call per SW lifetime; every call after that is
// fully synchronous again, as before.
let dlBgCaptureEnabled: boolean | null = null
const dlBgCaptureReady = storage.get('dl_bg_capture').then((v) => { dlBgCaptureEnabled = v === 1 })

// Per-worker volatile state (mirrors the legacy globals).
let blockedGtm = ''
let injectIn: { regExp: string; gtmId: string; disableGTM: boolean } | undefined
let gtmSites: StorageSchema['gtm_sites'] = []
const gtmIdentifierByTab = new Map<number, string>()

// ── Network request log — for the "Esporta GTM" JSON ──────────────────────────
// Per-tab rolling log of observed requests. Each entry carries the URL, HTTP
// method, webRequest resource type, and a requestId (used to join the response
// status captured in onHeadersReceived). The popup enriches entries with consent
// state, firstParty flag, and initiator info (from the debugger session below).
const MAX_NETWORK_ENTRIES = 500
type NetworkLogEntry = { url: string; method: string; type: string; requestId: string; ts: number }
const networkRequests = new Map<number, NetworkLogEntry[]>()
// tabId → requestId → HTTP status code (populated in onHeadersReceived)
const networkStatuses = new Map<number, Map<string, number>>()
// tabId → timestamp of last top-level navigation start (ms since epoch)
const navStartAt = new Map<number, number>()
// tabId → cookie snapshot taken at navigation start (before any page scripts run)
type NavCookie = { name: string; domain: string; expiry?: number }
const navStartCookies = new Map<number, NavCookie[]>()

// tabId → Set-Cookie headers observed via webRequest, with the response's
// webRequest timestamp — the only reliable per-cookie "written at" signal
// available (chrome.cookies exposes no creation time). Cookies set via
// document.cookie (no HTTP header) are not covered; the popup falls back to
// 'unknown' for those. Reset on navigation start, same as navStartCookies.
const MAX_COOKIE_SET_LOG = 500
type CookieSetEntry = { name: string; domain: string; ts: number }
const cookieSetLog = new Map<number, CookieSetEntry[]>()

// tabId → IAB TCF `useractioncomplete` event timestamps observed this page
// load (see the __tcfapi hook in datalayer-checker.inject.ts). Reset on
// navigation start, same as the other per-tab logs above.
const MAX_TCF_LOG = 50
const tabTcfLog = new Map<number, number[]>()

// ── CMP consent-cookie write observation (CMP-agnostic consent marker) ──────
// chrome.cookies.onChanged fires in real time at the moment a cookie is
// written — including via document.cookie, unlike onHeadersReceived above
// which only sees Set-Cookie HTTP headers. Most CMP banners write their
// consent cookie client-side on click (no page reload), so this is the only
// way to catch the actual moment of that write. cookies.onChanged carries no
// tabId (cookies aren't tab-scoped), so this is a single global rolling log;
// the popup matches entries to the page being exported by cookie domain at
// export time. Capped by count, not reset on navigation (can't tie a cookie
// write to one specific tab/nav).
const MAX_CMP_COOKIE_WRITE_LOG = 200
type CmpCookieWriteEntry = { name: string; domain: string; ts: number; cmp: string }
const cmpCookieWriteLog: CmpCookieWriteEntry[] = []

// The marker is a STATE CHANGE, not "any write with hasRealConsent" (bug fixed
// 2026-06-22): some CMPs (e.g. OneTrust in implied-consent regions) write their
// cookie at page load already carrying non-essential categories as granted —
// that first write alone satisfied `hasRealConsent`, anchoring consentGrantedAt
// at page load (or, when the first write was instead the strict default, never
// logging anything and leaving consentGrantedAt null) instead of the real
// interaction. Fix: the first write observed per cookie (per SW lifetime) is
// recorded as a baseline only, never logged as a marker; a later write is
// logged only when its state actually differs from that baseline (compared via
// `categories` when the parser exposes them, e.g. OneTrust's group map —
// otherwise the coarser `hasRealConsent` flag), only after a short settle
// window (CMP scripts can rewrite their own default cookie a few times during
// init), and only once confirmed stable a moment later (discards a change that
// gets immediately reverted).
const CMP_COOKIE_SETTLE_MS = 2500
const CMP_COOKIE_CONFIRM_DELAY_MS = 1500
const MAX_CMP_COOKIE_STATE_KEYS = 200

const cmpCookieLastState = new Map<string, CmpConsentResult | null>()
const cmpCookieFirstSeenAt = new Map<string, number>()

function cmpCookieStateSignature(result: CmpConsentResult | null): string {
  if (!result) return ''
  if (result.categories) {
    return Object.keys(result.categories)
      .sort()
      .map((k) => `${k}:${result.categories![k] ? 1 : 0}`)
      .join(',')
  }
  return result.hasRealConsent ? 'real' : 'default'
}

function evictOldestIfNeeded<K, V>(map: Map<K, V>, max: number): void {
  if (map.size <= max) return
  const oldest = map.keys().next()
  if (!oldest.done) map.delete(oldest.value)
}

chrome.cookies.onChanged.addListener(({ removed, cookie }) => {
  if (removed) return
  if (!CMP_COOKIE_NAME_RE.test(cookie.name)) return
  const key = `${cookie.domain}|${cookie.name}`
  const now = Date.now()
  const result = parseCmpCookie(cookie.name, cookie.value)

  const firstSeenAt = cmpCookieFirstSeenAt.get(key)
  const hadPrev = cmpCookieLastState.has(key)
  const prevResult = cmpCookieLastState.get(key) ?? null

  cmpCookieLastState.set(key, result)
  evictOldestIfNeeded(cmpCookieLastState, MAX_CMP_COOKIE_STATE_KEYS)
  if (firstSeenAt === undefined) {
    cmpCookieFirstSeenAt.set(key, now)
    evictOldestIfNeeded(cmpCookieFirstSeenAt, MAX_CMP_COOKIE_STATE_KEYS)
  }

  if (!result) return
  if (!hadPrev) return // first observation this SW lifetime — the CMP's own default, not a choice
  if (firstSeenAt !== undefined && now - firstSeenAt < CMP_COOKIE_SETTLE_MS) return // still settling at load
  const candidateSignature = cmpCookieStateSignature(result)
  if (cmpCookieStateSignature(prevResult) === candidateSignature) return // no real change

  setTimeout(() => {
    const latest = cmpCookieLastState.get(key) ?? null
    if (cmpCookieStateSignature(latest) !== candidateSignature) return // reverted or changed again — discard
    cmpCookieWriteLog.push({
      name: cookie.name,
      domain: cookie.domain.replace(/^\./, ''),
      ts: now,
      cmp: result.cmp,
    })
    if (cmpCookieWriteLog.length > MAX_CMP_COOKIE_WRITE_LOG) cmpCookieWriteLog.shift()
  }, CMP_COOKIE_CONFIRM_DELAY_MS)
})

/** Parses the `name=value` part of a single Set-Cookie header value and its
 *  `Domain=` attribute if present. Returns null if the header doesn't even
 *  have a cookie name (malformed). */
function parseSetCookieHeader(value: string, fallbackDomain: string): { name: string; domain: string } | null {
  const firstPart = value.split(';')[0]
  const eq = firstPart.indexOf('=')
  if (eq <= 0) return null
  const name = firstPart.slice(0, eq).trim()
  if (!name) return null
  const domainMatch = value.match(/;\s*domain=([^;]+)/i)
  const domain = (domainMatch ? domainMatch[1].trim() : fallbackDomain).replace(/^\./, '')
  return { name, domain }
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.action.setBadgeBackgroundColor({ color: '#e5c614' })
  const existing = await storage.get('filters_configuration')
  if (!existing) await storage.set({ filters_configuration: DEFAULT_FILTERS_CONFIGURATION })

  // QoL on by default on first install, so the GTM UI features are there
  // without the user having to flip the toggle first.
  const qol = await storage.get('qol_changes')
  if (qol === undefined) await storage.set({ qol_changes: 1 })

  // Background dataLayer capture is opt-in (privacy: it logs every push on
  // every page, even without the popup open) — off until the user enables it.
  const dlBgCapture = await storage.get('dl_bg_capture')
  if (dlBgCapture === undefined) await storage.set({ dl_bg_capture: 0 })

  // NOTE (Club tooling, internal distribution): this strips CSP so injected GTM
  // and preview can run on CSP-strict sites. Kept intentionally for now — flagged
  // as a future candidate to scope down to only the sites the user opts into.
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2],
    addRules: [
      {
        id: 2,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          // Strip XFO together with CSP: removing CSP also removes any
          // frame-ancestors directive that was overriding X-Frame-Options,
          // which would otherwise newly expose an XFO:deny and break iframes
          // that loaded fine before. ponytail: paired strip, keep them together.
          responseHeaders: [
            { header: 'content-security-policy', operation: 'remove' },
            { header: 'x-frame-options', operation: 'remove' },
          ],
        } as chrome.declarativeNetRequest.RuleAction,
        condition: { urlFilter: '*', resourceTypes: ['main_frame', 'sub_frame'] },
      },
    ],
  })
})

function badgeFor(ids: string[]): string {
  const n = ids.filter((id) => id.startsWith('GTM-')).length
  return n > 10 ? '10+' : n === 0 ? '' : String(n)
}

function handleDlBgPush(
  msg: Extract<RuntimeMessage, { code: 'DL_BG_PUSH' }>,
  sender: chrome.runtime.MessageSender,
): void {
  if (!dlBgCaptureEnabled) return
  const tabId = sender.tab?.id
  // originUrl: set only on carryover-replay sends (see datalayer-checker.inject.ts's
  // sessionStorage carryover buffer) — a push that happened on the PREVIOUS page,
  // resent after navigation because the normal real-time delivery to this handler
  // may not have completed before the old page unloaded. sender.url/sender.tab.url
  // would otherwise misattribute it to the page navigated TO, not the one it
  // actually happened on.
  const url = msg.data.originUrl ?? sender.url ?? sender.tab?.url ?? ''
  if (tabId == null) return
  let log = tabDlLog.get(tabId)
  if (!log) { log = []; tabDlLog.set(tabId, log) }
  try {
    const pushes = JSON.parse(msg.data.dataLayer ?? '[]') as unknown[]
    const ts = msg.data.ts
    const isReplay = msg.data.originUrl != null
    for (const push of pushes) {
      // Carryover replays can duplicate a push that DID make it through the
      // normal real-time path before the old page unloaded — skip if an
      // identical entry (same url/ts/content) is already logged.
      if (
        isReplay &&
        log.some((e) => e.url === url && e.ts === ts && JSON.stringify(e.push) === JSON.stringify(push))
      ) {
        continue
      }
      log.push({ push, ts, url })
      if (log.length > MAX_DL_LOG) log.shift()
    }
  } catch { /* malformed payload — ignore */ }
}

onRuntimeMessage((msg: RuntimeMessage, sender) => {
  if ('code' in msg) {
    switch (msg.code) {
      case 'GET_FILTERS_CONFIGURATION':
        return storage
          .get('filters_configuration')
          .then((c) => ({ filters_configuration: c ?? DEFAULT_FILTERS_CONFIGURATION }))

      case 'SET_FILTERS_CONFIGURATION':
        return storage.set({ filters_configuration: msg.data }).then(() => ({ success: true }))

      case 'LIST_GTM_ID': {
        const ids = msg.data.ids.filter((id) => id.startsWith('GTM-'))
        const tabId = sender.tab?.id
        chrome.action.setBadgeText({ text: badgeFor(msg.data.ids), ...(tabId != null ? { tabId } : {}) })
        if (ids.length > 0) {
          // Have valid IDs — always update (overwrite stale/empty entries).
          const existingIdx = gtmSites.findIndex((s) => s.origin === msg.data.origin)
          if (existingIdx >= 0) {
            gtmSites[existingIdx] = {
              ...gtmSites[existingIdx],
              gtm_ids: ids,
              time: Date.now(),
            }
          } else {
            gtmSites.push({
              url: msg.data.url,
              origin: msg.data.origin,
              gtm_ids: ids,
              time: Date.now(),
              sent: false,
            })
          }
          void storage.set({ gtm_sites: gtmSites })
        } else if (!gtmSites.some((s) => s.origin === msg.data.origin)) {
          // No valid IDs on this page — track in-memory to avoid duplicates,
          // but do NOT write to storage (would corrupt a valid existing entry).
          gtmSites.push({
            url: msg.data.url,
            origin: msg.data.origin,
            gtm_ids: [],
            time: Date.now(),
            sent: false,
          })
        }
        return
      }

      case 'update_container_pause_status':
        blockedGtm = msg.data.gtmID
        return

      case 'update_injected_site':
        injectIn =
          msg.data.type === 'disable'
            ? undefined
            : { regExp: msg.data.regExp, gtmId: msg.data.gtmId, disableGTM: msg.data.disableGTM }
        return

      case 'get_inject_status':
        return { injectIn: JSON.stringify(injectIn) }

      case 'exit_preview':
        void chrome.cookies.remove({ url: 'https://www.googletagmanager.com/', name: 'gtm_preview' })
        void chrome.cookies.remove({ url: 'https://www.googletagmanager.com/', name: 'gtm_debug' })
        void chrome.cookies.remove({ url: 'https://www.googletagmanager.com/', name: 'gtm_auth' })
        return

      case 'DL_BG_PUSH': {
        // Content script forwards dataLayer pushes here when the user has opted in
        // via the "dl_bg_capture" toggle. Re-checked here (not just in the page-world
        // wrapper) so a stale/racing inject script can never log against the user's
        // wishes. If the in-memory cache hasn't loaded yet (this SW instance just
        // cold-started, possibly woken BY this very message), await the in-flight
        // storage read once — returning a Promise keeps the SW alive for it — instead
        // of racing it and silently dropping the push. Every later call this SW
        // lifetime takes the synchronous path, same as before.
        if (dlBgCaptureEnabled === null) {
          return dlBgCaptureReady.then(() => handleDlBgPush(msg, sender))
        }
        handleDlBgPush(msg, sender)
        return
      }

      case 'GET_DL_LOG': {
        return { entries: tabDlLog.get(msg.data.tabId) ?? [] }
      }

      case 'GET_NETWORK_LOG': {
        const tid = msg.data.tabId
        const reqs = networkRequests.get(tid) ?? []
        const statuses = networkStatuses.get(tid) ?? new Map<string, number>()
        const initiators = debugInitiators.get(tid) ?? new Map<string, object>()
        const requests = reqs.map(({ url, method, type, requestId, ts }) => {
          const entry: Record<string, unknown> = { url, method, type, ts }
          const status = statuses.get(requestId)
          if (status != null) entry['status'] = status
          const initiator = initiators.get(url)
          if (initiator) entry['initiator'] = initiator
          return entry
        })
        return {
          requests,
          startedAt: navStartAt.get(tid) ?? null,
          navStartCookies: navStartCookies.get(tid) ?? null,
          cookieSets: cookieSetLog.get(tid) ?? [],
        }
      }

      case 'TCF_USER_ACTION': {
        const tabId = sender.tab?.id
        if (tabId == null) return
        let log = tabTcfLog.get(tabId)
        if (!log) { log = []; tabTcfLog.set(tabId, log) }
        log.push(msg.data.ts)
        if (log.length > MAX_TCF_LOG) log.shift()
        return
      }

      case 'GET_TCF_LOG': {
        return { entries: tabTcfLog.get(msg.data.tabId) ?? [] }
      }

      case 'GET_CMP_COOKIE_WRITES': {
        return { entries: cmpCookieWriteLog }
      }

      case 'CLEAR_NETWORK_LOG': {
        const tid = msg.data.tabId
        networkRequests.delete(tid)
        networkStatuses.delete(tid)
        cookieSetLog.delete(tid)
        tabTcfLog.delete(tid)
        debugInitiators.set(tid, new Map())
        navStartAt.set(tid, Date.now())
        return
      }
    }
  }

  if ('action' in msg && msg.action === 'get_filters_configuration') {
    const tabId = sender.tab?.id
    void storage.get('filters_configuration').then((c) => {
      if (tabId != null)
        void chrome.tabs.sendMessage(tabId, {
          action: 'filters_configuration_response',
          type: msg.type,
          filters_configuration: c ?? DEFAULT_FILTERS_CONFIGURATION,
        })
    })
    return
  }
})

// Push current pause/inject status to the active tab on activation/navigation.
function pushStatus(tabId: number): void {
  void chrome.tabs.sendMessage(tabId, { code: 'GET_GTM_ID' }).catch(() => {})
  void chrome.tabs
    .sendMessage(tabId, { action: 'blocked_gtm_status', gtmID: blockedGtm, timeout: false })
    .catch(() => {})
  void chrome.tabs
    .sendMessage(tabId, { action: 'inject_gtm_status', injectIn: JSON.stringify(injectIn) })
    .catch(() => {})
  const containerId = gtmIdentifierByTab.get(tabId)
  if (containerId) {
    void chrome.tabs
      .sendMessage(tabId, { code: 'GTM_IDENTIFIER', data: { containerId } })
      .catch(() => {})
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => pushStatus(tabId))
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && (info.status === 'loading' || info.status === 'complete')) pushStatus(tabId)
})
chrome.tabs.onRemoved.addListener((tabId) => {
  gtmIdentifierByTab.delete(tabId)
  networkRequests.delete(tabId)
  networkStatuses.delete(tabId)
  debugInitiators.delete(tabId)
  navStartAt.delete(tabId)
  navStartCookies.delete(tabId)
  cookieSetLog.delete(tabId)
  tabDlLog.delete(tabId)
  tabTcfLog.delete(tabId)
  if (debugAttachedTabs.has(tabId)) {
    chrome.debugger.detach({ tabId }).catch(() => {})
    debugAttachedTabs.delete(tabId)
  }
})

// ── Network request log ────────────────────────────────────────────────────
// Observes every request per tab (read-only — no webRequestBlocking needed).
// Reset on each top-level navigation so an export reflects only the current
// page load, matching the "incognito / consent reset" capture flow.

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return
    let log = networkRequests.get(details.tabId)
    if (!log) {
      log = []
      networkRequests.set(details.tabId, log)
    }
    log.push({ url: details.url, method: details.method, type: details.type, requestId: details.requestId, ts: details.timeStamp })
    if (log.length > MAX_NETWORK_ENTRIES) log.shift()
  },
  { urls: ['<all_urls>'] },
)

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return
  const { tabId, url } = details
  void storage.get('multi_page_capture').then((multiPage) => {
    // In multi-page mode, keep accumulating: don't wipe the log, and keep the
    // FIRST page's navStartAt/navStartCookies as the session baseline instead
    // of overwriting them on every page so setBeforeConsent analysis still
    // spans the whole session.
    if (multiPage === 1 && navStartAt.has(tabId)) return
    if (multiPage !== 1) {
      networkRequests.delete(tabId)
      networkStatuses.delete(tabId)
      cookieSetLog.delete(tabId)
      tabTcfLog.delete(tabId)
      debugInitiators.set(tabId, new Map())
    }
    navStartAt.set(tabId, Date.now())
    // Capture cookies present before any page scripts run — used for setBeforeConsent analysis.
    void chrome.cookies.getAll({ url }).then((cookies) => {
      navStartCookies.set(tabId, cookies.map((c) => ({
        name: c.name,
        domain: c.domain,
        ...(c.expirationDate != null ? { expiry: c.expirationDate } : {}),
      })))
    }).catch(() => {})
  })
  // Gated by the same opt-in toggle as DL_BG_PUSH (dl_bg_capture): chrome.debugger.attach
  // triggers Chrome's "started debugging this browser" banner, so it must not run by default.
  void storage.get('dl_bg_capture').then((v) => {
    if (v === 1) void attachDebugger(tabId)
  })
})

// ── x-gtm-identifier — sGTM container badge ───────────────────────────────────
// sGTM servers return this response header on every request. Capturing it here
// (service-worker context, bypasses CORS) lets us show the container ID as a
// badge in the Tag Assistant debug view without any page-world hacks.

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return
    const { tabId } = details

    // Capture HTTP status for the network log
    let statuses = networkStatuses.get(tabId)
    if (!statuses) { statuses = new Map(); networkStatuses.set(tabId, statuses) }
    statuses.set(details.requestId, details.statusCode)

    // Set-Cookie headers — the only reliable "written at" signal for cookies
    // (see cookieSetLog comment above), used by the popup to compute
    // cookies[].setBeforeConsent precisely instead of 'unknown'.
    let requestDomain = ''
    try { requestDomain = new URL(details.url).hostname } catch { /* ignore */ }
    const setCookieHeaders = details.responseHeaders?.filter((h) => h.name.toLowerCase() === 'set-cookie') ?? []
    if (setCookieHeaders.length > 0) {
      let log = cookieSetLog.get(tabId)
      if (!log) { log = []; cookieSetLog.set(tabId, log) }
      for (const h of setCookieHeaders) {
        if (!h.value) continue
        const parsed = parseSetCookieHeader(h.value, requestDomain)
        if (!parsed) continue
        log.push({ ...parsed, ts: details.timeStamp })
      }
      if (log.length > MAX_COOKIE_SET_LOG) log.splice(0, log.length - MAX_COOKIE_SET_LOG)
    }

    // sGTM container badge from x-gtm-identifier response header
    const header = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'x-gtm-identifier',
    )
    if (!header?.value) return
    const containerId = header.value
    gtmIdentifierByTab.set(tabId, containerId)
    void chrome.tabs
      .sendMessage(tabId, { code: 'GTM_IDENTIFIER', data: { containerId } })
      .catch(() => {})
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders'],
)

// ── chrome.debugger — per-request initiator capture ───────────────────────────
// Attaches the Chrome DevTools Protocol to each tab on navigation start to
// capture Network.requestWillBeSent events, which carry the initiator (the
// script URL or parser position that triggered each request). Detaches after
// the page finishes loading. Fails silently when DevTools is already open.
// Note: the browser shows a "DevTools is connected" banner while attached —
// gated by the dl_bg_capture toggle (off by default) for exactly this reason.

const debugAttachedTabs = new Set<number>()
const debugInitiators = new Map<number, Map<string, { type: string; url?: string; stack?: string[] }>>()

async function attachDebugger(tabId: number): Promise<void> {
  if (debugAttachedTabs.has(tabId)) {
    try { await chrome.debugger.detach({ tabId }) } catch { /* ignore */ }
    debugAttachedTabs.delete(tabId)
  }
  try {
    await chrome.debugger.attach({ tabId }, '1.3')
    debugAttachedTabs.add(tabId)
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {})
  } catch {
    // Another DevTools session is already attached — skip silently.
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  const tabId = source.tabId
  if (tabId == null) return
  if (method !== 'Network.requestWillBeSent') return
  const p = params as {
    request: { url: string }
    initiator: { type: string; url?: string; stack?: { callFrames: Array<{ url: string }> } }
  }
  const initiators = debugInitiators.get(tabId)
  if (!initiators) return
  const { type, url, stack } = p.initiator
  initiators.set(p.request.url, {
    type,
    ...(url ? { url } : {}),
    ...(stack?.callFrames?.length ? { stack: stack.callFrames.map((f) => f.url).filter(Boolean) } : {}),
  })
})

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId != null) debugAttachedTabs.delete(source.tabId)
})

// React immediately to the dl_bg_capture toggle for tabs already open — otherwise
// turning it on/off would only take effect on the next navigation.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('dl_bg_capture' in changes)) return
  const enabled = changes.dl_bg_capture.newValue === 1
  dlBgCaptureEnabled = enabled
  void chrome.tabs.query({}).then((tabs) => {
    for (const t of tabs) {
      if (t.id == null) continue
      if (enabled) {
        void attachDebugger(t.id)
      } else if (debugAttachedTabs.has(t.id)) {
        chrome.debugger.detach({ tabId: t.id }).catch(() => {})
        debugAttachedTabs.delete(t.id)
      }
    }
  })
})

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return
  // Keep debugger alive briefly so late-firing scripts are also captured.
  setTimeout(() => {
    const tabId = details.tabId
    if (!debugAttachedTabs.has(tabId)) return
    chrome.debugger.detach({ tabId }).catch(() => {})
    debugAttachedTabs.delete(tabId)
  }, 4000)
})

// ── Shopify Pixel Sandbox bridge — background side ────────────────────────────
// Mirrors Stape GTM Helper's "Shopify Sandbox dataLayer" feature.
//
// APPROACH (same as Stape background.js functions N, d, yt, wt):
//  • webNavigation.onCompleted fires after all resources — GTM + Shopify APIs ready.
//  • Main checkout frame  → inject shopifyParentBridgeEnsure() (= Stape's yt)
//  • Pixel sandbox iframe → inject shopifyPixelSandboxWrapper()  (= Stape's wt)
//  • injectImmediately:true runs the function synchronously; falls back without it.
//  • SYN/ACK handshake: the two sides synchronise so no events are lost regardless
//    of which side loads first. Buffer pre-ACK events, flush on ACK.
//
// The content script (shopify-sandbox.content.ts, all_frames:true) and the
// direct contentWindow.dataLayer wrapping in datalayer-checker.inject.ts both run
// alongside this as complementary fallbacks.

// ── URL helpers ───────────────────────────────────────────────────────────────

function isShopifyMainUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      u.hostname.endsWith('.myshopify.com') ||
      u.hostname === 'checkout.shopify.com' ||
      /\/checkouts\//.test(u.pathname) ||
      /\/(cart|collections|products)(\/|$)/.test(u.pathname)
    )
  } catch {
    return false
  }
}

function isShopifyPixelFrameUrl(url: string): boolean {
  try {
    return /\/custom\/web-pixel-/.test(new URL(url).pathname)
  } catch {
    return false
  }
}

// ── executeScript helper (= Stape's d() function) ────────────────────────────
// Tries injectImmediately:true + world:MAIN first; falls back without those flags
// for older Chrome versions or frames where immediate injection isn't supported.

async function execInMain(tabId: number, frameId: number, func: () => void): Promise<void> {
  try {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func,
        injectImmediately: true,
        world: 'MAIN',
      })
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        func,
      })
    }
  } catch {
    // Tab navigated away or access denied — harmless.
  }
}

// ── Parent bridge (= Stape's yt) — injected into checkout main frame ──────────
// If datalayer-checker.inject.ts content-script injection already set this up,
// we just re-ping pixel iframes with SYN to complete the handshake.

function shopifyParentBridgeEnsure(): void {
  const SYN = '__ll_sandbox_syn__'
  const ACK = '__ll_sandbox_ack__'
  const MSG = '__ll_shopify_sandbox__'
  const win = window as unknown as Record<string, unknown>

  const IFRAME_SEL = '#web-pixels-manager-sandbox-container iframe[src*="/custom/web-pixel-"]'

  function synPixelIframes(): void {
    document.querySelectorAll<HTMLIFrameElement>(IFRAME_SEL)
      .forEach((f) => f.contentWindow?.postMessage({ type: SYN }, '*'))
  }

  if (win['__llShopifyParentBridge']) {
    // Already installed by content-script injection — just resend SYN so the
    // sandbox wrapper can complete its handshake if it loaded after us.
    synPixelIframes()
    return
  }
  win['__llShopifyParentBridge'] = true

  let ready = false
  const buf: unknown[] = []

  function pushDL(payload: unknown): void {
    if (!Array.isArray(win['dataLayer'])) win['dataLayer'] = []
    ;(win['dataLayer'] as unknown[]).push(payload)
  }
  function flush(): void { while (buf.length) pushDL(buf.shift()) }

  window.addEventListener('message', (e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return
    const d = e.data as Record<string, unknown>

    if (d['type'] === SYN || d['type'] === ACK) {
      if (d['type'] === SYN && e.source) {
        ;(e.source as Window).postMessage({ type: ACK }, e.origin === 'null' ? '*' : e.origin)
      }
      if (!ready) { ready = true; flush() }
      return
    }

    if (d['type'] === MSG) {
      const p = d['payload']
      if (p && typeof p === 'object') ready ? pushDL(p) : buf.push(p)
    }
  })

  synPixelIframes()
}

// ── Sandbox wrapper (= Stape's wt) — injected into pixel sandbox iframes ──────
// Wraps window.dataLayer.push and forwards events to window.top via postMessage.
// Buffers events until parent replies with ACK so nothing is lost.

function shopifyPixelSandboxWrapper(): void {
  const MSG = '__ll_shopify_sandbox__'
  const SYN = '__ll_sandbox_syn__'
  const ACK = '__ll_sandbox_ack__'
  const win = window as unknown as Record<string, unknown>
  if (win['__llSandboxInstalled']) return
  win['__llSandboxInstalled'] = true

  let ack = false
  const buf: Array<Record<string, unknown>> = []

  function send(payload: unknown): void {
    const msg = { type: MSG, payload }
    if (ack) { try { ;(window.top as Window).postMessage(msg, '*') } catch { /* ignore */ } }
    else buf.push(msg)
  }
  function flush(): void {
    while (buf.length) {
      try { ;(window.top as Window).postMessage(buf.shift(), '*') } catch { /* ignore */ }
    }
  }

  function isInternal(item: unknown): boolean {
    if (typeof item !== 'object' || item === null) return false
    const ev = (item as Record<string, unknown>)['event']
    return ev === 'gtm.js' || ev === 'gtm.dom' || ev === 'gtm.load'
  }
  function isArgs(v: unknown): boolean {
    if (!v || typeof v !== 'object') return false
    return (
      Object.prototype.toString.call(v) === '[object Arguments]' ||
      Object.prototype.hasOwnProperty.call(v, 'callee')
    )
  }

  function installWrapper(): void {
    const dl = win['dataLayer'] as (unknown[] & { __llSandboxWrapped?: boolean }) | undefined
    if (!Array.isArray(dl) || dl.__llSandboxWrapped) return

    try {
      if (dl === (window.top as unknown as Record<string, unknown>)['dataLayer']) return
    } catch { /* cross-origin — proceed */ }

    Object.defineProperty(dl, '__llSandboxWrapped', { value: true, enumerable: false })

    for (const item of dl) {
      if (!isInternal(item) && !isArgs(item) && typeof item !== 'function') send(item)
    }

    // Stape GTM Helper pattern: capture current push, try to forward, always call original.
    const origPush = (dl as unknown as Record<string, unknown>)['push'] as ((...a: unknown[]) => number) | undefined
    ;(dl as unknown as Record<string, unknown>)['push'] = function (this: unknown): number {
      const args = Array.from(arguments) as unknown[]
      try {
        for (const item of args) {
          if (!isInternal(item) && !isArgs(item) && typeof item !== 'function') send(item)
        }
      } catch { /* ignore */ }
      return origPush ? origPush.apply(dl, args) : (Array.prototype.push.apply(dl, args) as number)
    }
  }

  // Listen for ACK/SYN from parent
  window.addEventListener('message', (e: MessageEvent) => {
    try { if (e.source !== (window.top as Window)) return } catch { /* ignore */ }
    if (!e.data || typeof e.data !== 'object') return
    const d = e.data as Record<string, unknown>
    if (d['type'] === SYN || d['type'] === ACK) {
      if (d['type'] === SYN)
        try { ;(window.top as Window).postMessage({ type: ACK }, '*') } catch { /* ignore */ }
      if (!ack) { ack = true; flush() }
    }
  })

  // Initiate handshake — parent replies with ACK
  try { ;(window.top as Window).postMessage({ type: SYN }, '*') } catch { /* ignore */ }

  // Poll for dataLayer — GTM creates it asynchronously after the pixel loads
  if (Array.isArray(win['dataLayer'])) {
    installWrapper()
  } else {
    let ms = 0
    const iv = setInterval(() => {
      ms += 250
      if (Array.isArray(win['dataLayer'])) { clearInterval(iv); installWrapper() }
      else if (ms >= 15_000) clearInterval(iv)
    }, 250)
  }
}

// ── Fetch GTM ID from store homepage (fallback when gtm_sites is empty) ──────
// Performs a background fetch of the store's root URL and parses the first
// GTM container ID found in the HTML. Runs in the service-worker context so
// CORS and page-CSP restrictions are irrelevant.

async function getGtmIdFromStorePage(origin: string): Promise<string | null> {
  try {
    const ac = new AbortController()
    const tid = setTimeout(() => ac.abort(), 5000)
    try {
      const res = await fetch(origin + '/', { signal: ac.signal })
      if (!res.ok) return null
      const html = await res.text()
      return html.match(/['"](GTM-[A-Z0-9]+)['"]/)?.[1] ?? null
    } finally {
      clearTimeout(tid)
    }
  } catch {
    return null
  }
}

// ── Shopify checkout: auto-inject GTM from pixel sandbox ─────────────────────
// When a pixel sandbox loads on a checkout page, read the GTM container running
// inside it and inject the same container into the main frame (if absent).
// This lets GTM Tag Assistant see the pixel events forwarded by the bridge.
// Runs ONLY on checkout URLs — never on regular store pages.

function isShopifyCheckoutUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return /\/checkouts\//.test(u.pathname) || u.hostname === 'checkout.shopify.com'
  } catch {
    return false
  }
}

async function getGtmIdFromPixelFrame(tabId: number, frameId: number): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: (): string | null => {
        const gtm = (window as unknown as Record<string, unknown>)['google_tag_manager'] as
          | Record<string, unknown>
          | undefined
        if (!gtm) return null
        return Object.keys(gtm).find((k) => k.startsWith('GTM-')) ?? null
      },
      world: 'MAIN',
    })
    return (results[0]?.result as string | null | undefined) ?? null
  } catch {
    return null
  }
}

async function injectGtmIntoMainFrame(tabId: number, gtmId: string): Promise<void> {
  // Identical to Stape GTM Helper's injection (no frame patching needed —
  // the SecurityError from bootstrap:61 is cosmetic and does not block
  // Tag Assistant from connecting, as confirmed by Stape's own implementation).
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: (id: string) => {
        const win = window as unknown as Record<string, unknown>
        // Idempotent: skip if GTM already present or already injected by LayerLens.
        if (win['__llCheckoutGtmInjected']) return
        const existing = win['google_tag_manager'] as Record<string, unknown> | undefined
        if (existing && Object.keys(existing).some((k) => k.startsWith('GTM-'))) return
        win['__llCheckoutGtmInjected'] = true
        if (!Array.isArray(win['dataLayer'])) win['dataLayer'] = []
        ;(win['dataLayer'] as unknown[]).push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
        const s = document.createElement('script')
        s.async = true
        s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
        ;(document.head ?? document.documentElement).appendChild(s)
      },
      args: [gtmId],
      injectImmediately: true,
      world: 'MAIN',
    })
  } catch {
    /* tab navigated away or access denied — harmless */
  }
}

// ── Manual GTM injection (user-configured from popup) ────────────────────────
// Completely separate from the Shopify-specific auto-injection above.
// Checks user-saved rules in storage and injects the specified GTM container
// into any matching main frame. Idempotent: skips if GTM is already present.

async function injectGtmManual(tabId: number, gtmId: string): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: (id: string) => {
        const win = window as unknown as Record<string, unknown>
        if (win['__llManualGtmInjected']) return
        const existing = win['google_tag_manager'] as Record<string, unknown> | undefined
        if (existing && Object.keys(existing).some((k) => k.startsWith('GTM-'))) return
        win['__llManualGtmInjected'] = true
        if (!Array.isArray(win['dataLayer'])) win['dataLayer'] = []
        ;(win['dataLayer'] as unknown[]).push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
        const s = document.createElement('script')
        s.async = true
        s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
        ;(document.head ?? document.documentElement).appendChild(s)
      },
      args: [gtmId],
      injectImmediately: true,
      world: 'MAIN',
    })
  } catch { /* tab navigated away or access denied — harmless */ }
}

// ── webNavigation.onDOMContentLoaded — early GTM injection on checkout ───────
// Inject GTM at DOMContentLoaded (before Shopify's JS creates the pixel sandbox
// iframes). This way GTM's debug bootstrap runs with no sandboxed frames in the
// DOM → no SecurityError → Tag Assistant can connect.
// Uses gtm_sites (populated when the user visits the main store page) for the ID.
// The onCompleted/pixel-frame path below remains as a fallback.

chrome.webNavigation.onDOMContentLoaded.addListener(async (details) => {
  const { tabId, frameId, url } = details
  if (frameId !== 0) return

  // ── Manual GTM injection (user rules, non-Shopify) ─────────────────────────
  const manualInjections = await storage.get('gtm_manual_injections')
  if (manualInjections?.length) {
    for (const cfg of manualInjections) {
      if (!cfg.enabled) continue
      try {
        if (new RegExp(cfg.regExp, 'i').test(url)) {
          await injectGtmManual(tabId, cfg.gtmId)
          break // first matching rule wins
        }
      } catch { /* invalid regex — skip */ }
    }
  }

  // ── Shopify checkout: inject GTM from cached ID ────────────────────────────
  if (!isShopifyCheckoutUrl(url)) return
  try {
    const origin = new URL(url).origin

    // 1. Try cached GTM ID from a previous visit to the main store pages.
    const sites = await storage.get('gtm_sites')
    let gtmId = (sites ?? []).find((s) => s.origin === origin)?.gtm_ids?.find((id) => id.startsWith('GTM-'))

    // 2. Fallback: fetch the store homepage and parse the GTM snippet from HTML.
    //    Runs in the service-worker context → no CSP / CORS restrictions.
    if (!gtmId) gtmId = (await getGtmIdFromStorePage(origin)) ?? undefined

    if (gtmId) await injectGtmIntoMainFrame(tabId, gtmId)
  } catch { /* ignore */ }
})

// ── webNavigation.onCompleted listener ───────────────────────────────────────
// Registered synchronously at service-worker top level (required for MV3).
// onCompleted ensures GTM and Shopify APIs are loaded for sandbox injection.

chrome.webNavigation.onCompleted.addListener(async (details) => {
  const { tabId, frameId, url } = details

  if (frameId === 0) {
    // Main checkout/storefront frame: ensure parent bridge listener is in place.
    if (isShopifyMainUrl(url)) {
      await execInMain(tabId, frameId, shopifyParentBridgeEnsure)
    }
  } else {
    // Sub-frame: inject sandbox wrapper into pixel sandbox iframes.
    if (isShopifyPixelFrameUrl(url)) {
      await execInMain(tabId, frameId, shopifyPixelSandboxWrapper)

      // Auto-inject GTM into the main checkout frame when there is none.
      // Only on checkout pages — not on carts, collections, or product pages.
      const tab = await chrome.tabs.get(tabId).catch(() => null)
      if (tab?.url && isShopifyCheckoutUrl(tab.url)) {
        let gtmId = await getGtmIdFromPixelFrame(tabId, frameId)
        if (!gtmId) {
          // GTM initialises asynchronously — retry once after 1 s.
          await new Promise<void>((resolve) => setTimeout(resolve, 1000))
          gtmId = await getGtmIdFromPixelFrame(tabId, frameId)
        }
        if (gtmId) await injectGtmIntoMainFrame(tabId, gtmId)
      }
    }
  }
})
