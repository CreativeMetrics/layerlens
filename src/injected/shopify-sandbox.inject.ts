// Runs in the PAGE world of every iframe (injected by shopify-sandbox.content.ts).
// Self-exits immediately if not a Shopify pixel sandbox.
//
// DETECTION: window.analytics.subscribe is set by Shopify's pixel sandbox runtime.
//            window.google_tag_manager (fallback) is used only when location.origin
//            === 'null' (sandboxed iframe without allow-same-origin = Shopify sandbox)
//            to avoid activating the bridge in regular cross-origin iframes with GTM.
//
// PROTOCOL: Uses a SYN/ACK handshake with the parent-side listener
//           (datalayer-checker.inject.ts) so no events are lost regardless of
//           which side starts first. Mirrors Stape GTM Helper's mechanism.

;(function () {
  // ── Quick exit if not inside an iframe ───────────────────────────────────────
  try { if (window === window.top) return } catch { /* sandboxed — we ARE in an iframe */ }

  // ── Idempotency ──────────────────────────────────────────────────────────────
  const win = window as unknown as Record<string, unknown>
  if (win['__llSandboxInstalled']) return
  win['__llSandboxInstalled'] = true

  // ── Tag Master interference fix ───────────────────────────────────────────────
  // Tag Master's page-script.js runs at document_start (before us) and does
  // `window.dataLayer = window.dataLayer || []`, creating an empty dataLayer with
  // a broken push wrapper. Shopify's pixel runtime detects the non-native push and
  // skips its initialization — window.analytics.subscribe is never set up, so
  // pixels like Elevar can't subscribe to checkout_started and never push events.
  // Fix: if Tag Master pre-created an empty dataLayer, delete it so Shopify's
  // runtime can recreate it cleanly. We run as an ES module (deferred) so by the
  // time we execute Tag Master has already run but Shopify's runtime hasn't yet.
  // Guard: only in Shopify pixel sandbox iframes. Two valid cases:
  // 1. Pixel sandbox URL contains /custom/web-pixel- (accessible when allow-same-origin is set)
  // 2. location is inaccessible → sandboxed without allow-same-origin (also Shopify)
  let inShopifyPixelSandbox = false
  try { inShopifyPixelSandbox = /\/custom\/web-pixel-/i.test(location.pathname) } catch { inShopifyPixelSandbox = true }
  if (inShopifyPixelSandbox && win['__tagMaster'] && Array.isArray(win['dataLayer']) && (win['dataLayer'] as unknown[]).length === 0) {
    try { delete (win as Record<string, unknown>)['dataLayer'] } catch { /* ignore */ }
  }

  const MSG_TYPE = '__ll_shopify_sandbox__'
  const SYN_TYPE = '__ll_sandbox_syn__'
  const ACK_TYPE = '__ll_sandbox_ack__'

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function isGtmInternal(item: unknown): boolean {
    if (typeof item !== 'object' || item === null) return false
    const ev = (item as Record<string, unknown>)['event']
    return ev === 'gtm.js' || ev === 'gtm.dom' || ev === 'gtm.load'
  }

  /** Arguments objects (gtag command-queue items) contain function references
   *  (callee, Symbol.iterator) that cannot be structured-cloned. Skip them. */
  function isArguments(v: unknown): boolean {
    if (!v || typeof v !== 'object') return false
    return (
      Object.prototype.toString.call(v) === '[object Arguments]' ||
      Object.prototype.hasOwnProperty.call(v, 'callee')
    )
  }

  // ── SYN/ACK handshake ─────────────────────────────────────────────────────────
  // Buffer events until the parent replies with ACK so nothing is lost if the
  // parent bridge listener isn't ready yet.

  let ackReceived = false
  const preAckBuffer: Array<Record<string, unknown>> = []

  function flushBuffer(): void {
    while (preAckBuffer.length > 0) {
      const msg = preAckBuffer.shift()!
      try { ;(window.top as Window).postMessage(msg, '*') } catch { /* ignore */ }
    }
  }

  function sendToTop(payload: unknown): void {
    const msg = { type: MSG_TYPE, payload }
    if (ackReceived) {
      try { ;(window.top as Window).postMessage(msg, '*') } catch { /* ignore */ }
    } else {
      preAckBuffer.push(msg)
    }
  }

  // Listen for ACK (or SYN from parent — reply with ACK back).
  window.addEventListener('message', (e: MessageEvent) => {
    try { if (e.source !== (window.top as Window)) return } catch { /* ignore */ }
    if (!e.data || typeof e.data !== 'object') return
    const d = e.data as Record<string, unknown>
    if (d['type'] === SYN_TYPE || d['type'] === ACK_TYPE) {
      if (d['type'] === SYN_TYPE) {
        try { ;(window.top as Window).postMessage({ type: ACK_TYPE }, '*') } catch { /* ignore */ }
      }
      if (!ackReceived) { ackReceived = true; flushBuffer() }
    }
  })

  // Initiate the handshake — parent replies with ACK.
  try { ;(window.top as Window).postMessage({ type: SYN_TYPE }, '*') } catch { /* ignore */ }

  // ── dataLayer wrapper ─────────────────────────────────────────────────────────

  function installWrapper(): void {
    // Do NOT create dataLayer early — premature creation lets other extensions
    // (e.g. Tag Master) wrap it with broken wrappers before GTM initialises.
    if (!Array.isArray(win['dataLayer'])) return
    const dl = win['dataLayer'] as unknown[] & { __llWrapped?: boolean }
    if (dl.__llWrapped) return

    // If this iframe's dataLayer is the same reference as window.top.dataLayer,
    // events are already flowing into the parent directly — forwarding would push
    // every item twice. Bail out silently.
    try {
      if (dl === (window.top as unknown as Record<string, unknown>)['dataLayer']) return
    } catch { /* cross-origin — proceed normally */ }

    Object.defineProperty(dl, '__llWrapped', { value: true, enumerable: false })

    // Forward items already in the array.
    for (const item of dl) {
      if (!isGtmInternal(item) && !isArguments(item) && typeof item !== 'function') sendToTop(item)
    }

    // Wrap push using the Stape GTM Helper pattern: capture the current push (which
    // may already be wrapped by Tag Master, GTM, etc.), then in try/finally ensure
    // the original chain is ALWAYS called even if our forwarding fails. This prevents
    // our wrapper from breaking other extensions' push wrappers.
    const origPush = (dl as unknown as Record<string, unknown>)['push'] as ((...a: unknown[]) => number) | undefined
    ;(dl as unknown as Record<string, unknown>)['push'] = function (this: unknown): number {
      const args = Array.from(arguments) as unknown[]
      try {
        for (const item of args) {
          if (!isGtmInternal(item) && !isArguments(item) && typeof item !== 'function') sendToTop(item)
        }
      } catch { /* forwarding error — ignore, original push still runs below */ }
      return origPush ? origPush.apply(dl, args) : (Array.prototype.push.apply(dl, args) as number)
    }
  }

  // ── Shopify sandbox detection with retries ────────────────────────────────────

  function isShopifySandbox(): boolean {
    // Primary: window.analytics.subscribe is set by Shopify's pixel sandbox runtime.
    const analytics = win['analytics'] as Record<string, unknown> | undefined
    if (
      typeof analytics === 'object' &&
      analytics !== null &&
      typeof analytics['subscribe'] === 'function'
    ) return true

    // Fallback: google_tag_manager is set when GTM loads inside the pixel (e.g. Elevar).
    // Guard: URL contains /custom/web-pixel- (Shopify pixel sandbox, both with and without
    // allow-same-origin) OR location throws (sandboxed without allow-same-origin).
    // This prevents false positives in regular cross-origin iframes that happen to have GTM.
    if (typeof win['google_tag_manager'] === 'object' && win['google_tag_manager'] !== null) {
      try { return /\/custom\/web-pixel-/i.test(location.pathname) } catch { return true }
    }
    return false
  }

  if (isShopifySandbox()) {
    installWrapper()
  } else {
    const DELAYS = [100, 300, 700, 1500, 3000, 5000, 8000, 12000, 15000]
    let attempt = 0
    const retry = (): void => {
      if (win['__llWrapped']) return
      if (isShopifySandbox()) { installWrapper(); return }
      if (++attempt < DELAYS.length) setTimeout(retry, DELAYS[attempt])
    }
    setTimeout(retry, DELAYS[0])
  }
})()
