// Runs in the ISOLATED world of every iframe on every page (all_frames: true).
// Injects the shopify-sandbox.inject.ts script into the iframe's PAGE world.
// The inject script self-exits immediately if the iframe is not a Shopify pixel sandbox.
//
// Why all_frames without URL filtering?
// The Shopify pixel sandbox iframe URL varies by store architecture:
//   - <store>.myshopify.com/custom/web-pixel-<id>
//   - checkout.shopify.com/custom/web-pixel-<id>
//   - Potentially served from a CDN or blank (blob:) URL
// Rather than pattern-matching URLs (brittle), we let the inject script detect
// the sandbox by its contents (window.analytics.subscribe / google_tag_manager).

import sandboxInjectedPath from '@/injected/shopify-sandbox.inject.ts?script&module'

// Only run in sub-frames. In the main frame this is a no-op.
if (window !== window.top) {
  const script = document.createElement('script')
  script.type = 'module'
  script.src = chrome.runtime.getURL(sandboxInjectedPath)
  ;(document.head ?? document.documentElement).appendChild(script)
}
