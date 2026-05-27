// Runs in the PAGE world of every iframe (injected by shopify-sandbox.content.ts).
// Self-exits immediately if not a Shopify pixel sandbox.
//
// DETECTION: window.analytics.subscribe is exclusive to Shopify pixel sandboxes.
//            window.google_tag_manager appears after GTM loads inside the pixel.
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
    if (!Array.isArray(win['dataLayer'])) win['dataLayer'] = []
    const dl = win['dataLayer'] as unknown[] & { __llWrapped?: boolean }
    if (dl.__llWrapped) return

    // If this iframe's dataLayer is the same reference as window.top.dataLayer,
    // events are already flowing into the parent directly — forwarding would push
    // every item twice. Bail out silently (events don't need the bridge).
    try {
      if (dl === (window.top as unknown as Record<string, unknown>)['dataLayer']) return
    } catch { /* cross-origin — can't check, proceed normally */ }

    // Forward items already in the array (pushed before this script ran).
    for (const item of dl) {
      if (!isGtmInternal(item) && !isArguments(item)) sendToTop(item)
    }

    // Wrap push for future items.
    const origPush = Array.prototype.push.bind(dl)
    ;(dl as unknown as Record<string, unknown>)['push'] = function (
      ...args: unknown[]
    ): number {
      const result = origPush(...args) as number
      for (const item of args) {
        if (!isGtmInternal(item) && !isArguments(item)) sendToTop(item)
      }
      return result
    }
    Object.defineProperty(dl, '__llWrapped', { value: true, enumerable: false })
  }

  // ── Shopify sandbox detection with retries ────────────────────────────────────

  function isShopifySandbox(): boolean {
    if (typeof win['google_tag_manager'] === 'object' && win['google_tag_manager'] !== null)
      return true
    const analytics = win['analytics'] as Record<string, unknown> | undefined
    return (
      typeof analytics === 'object' &&
      analytics !== null &&
      typeof analytics['subscribe'] === 'function'
    )
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
