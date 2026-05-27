// MV3 service worker. Behaviour preserved from the legacy background.js, but:
//  - the duplicated GET/SET_FILTERS_CONFIGURATION listeners are merged into one router;
//  - storage/messaging go through the typed helpers;
//  - exit_preview cookie removal now works (the `cookies` permission was added).

import { DEFAULT_FILTERS_CONFIGURATION } from '@/lib/filters-schema'
import { onRuntimeMessage } from '@/lib/messaging'
import * as storage from '@/lib/storage'
import type { RuntimeMessage } from '@/types/messages'
import type { StorageSchema } from '@/lib/storage'

// Per-worker volatile state (mirrors the legacy globals).
let blockedGtm = ''
let injectIn: { regExp: string; gtmId: string; disableGTM: boolean } | undefined
let gtmSites: StorageSchema['gtm_sites'] = []

chrome.runtime.onInstalled.addListener(async () => {
  chrome.action.setBadgeBackgroundColor({ color: '#e5c614' })
  const existing = await storage.get('filters_configuration')
  if (!existing) await storage.set({ filters_configuration: DEFAULT_FILTERS_CONFIGURATION })

  // QoL on by default on first install, so the GTM UI features are there
  // without the user having to flip the toggle first.
  const qol = await storage.get('qol_changes')
  if (qol === undefined) await storage.set({ qol_changes: 1 })

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
          responseHeaders: [{ header: 'content-security-policy', operation: 'remove' }],
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
}

chrome.tabs.onActivated.addListener(({ tabId }) => pushStatus(tabId))
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (tab.active && (info.status === 'loading' || info.status === 'complete')) pushStatus(tabId)
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

    // If the iframe's dataLayer IS the parent's dataLayer (same-origin sandbox that
    // references window.top.dataLayer), events are already there — don't forward.
    try {
      if (dl === (window.top as unknown as Record<string, unknown>)['dataLayer']) return
    } catch { /* cross-origin — proceed */ }

    for (const item of dl) {
      if (!isInternal(item) && !isArgs(item)) send(item)
    }

    const orig = Array.prototype.push.bind(dl)
    ;(dl as unknown as Record<string, unknown>)['push'] = function (...args: unknown[]): number {
      const r = orig(...args) as number
      for (const item of args) {
        if (!isInternal(item) && !isArgs(item)) send(item)
      }
      return r
    }
    Object.defineProperty(dl, '__llSandboxWrapped', { value: true, enumerable: false })
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

// ── webNavigation.onDOMContentLoaded — early GTM injection on checkout ───────
// Inject GTM at DOMContentLoaded (before Shopify's JS creates the pixel sandbox
// iframes). This way GTM's debug bootstrap runs with no sandboxed frames in the
// DOM → no SecurityError → Tag Assistant can connect.
// Uses gtm_sites (populated when the user visits the main store page) for the ID.
// The onCompleted/pixel-frame path below remains as a fallback.

chrome.webNavigation.onDOMContentLoaded.addListener(async (details) => {
  const { tabId, frameId, url } = details
  if (frameId !== 0 || !isShopifyCheckoutUrl(url)) return
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
