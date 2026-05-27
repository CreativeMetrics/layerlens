// Bridges the page world (where window.google_tag_manager lives) and the
// extension. The injected page-world script must be loaded via an ABSOLUTE
// extension URL (chrome.runtime.getURL); a relative path resolves against the
// site origin and 404s, silently breaking the pipeline.
import injectedPath from '@/injected/datalayer-checker.inject.ts?script&module'
import type { PageMessage, RuntimeMessage } from '@/types/messages'

// Main dataLayer monitor + Shopify sandbox bridge parent listener.
// (The Shopify pixel sandbox wrapper is injected per-frame from background.ts
//  via chrome.scripting.executeScript on webNavigation.onDOMContentLoaded.)
const script = document.createElement('script')
script.type = 'module'
script.src = chrome.runtime.getURL(injectedPath)
script.dataset.andromeda = 'datalayer-checker'
;(document.head ?? document.documentElement).prepend(script)

// True only for our object-shaped protocol messages. Other extensions / the
// page itself postMessage arbitrary values (e.g. plain strings), so we must
// type-check before using the `in` operator — otherwise `'code' in "..."`
// throws a TypeError.
function isPageMessage(v: unknown): v is PageMessage & { code: string } {
  return typeof v === 'object' && v !== null && 'code' in v && Boolean((v as { code?: unknown }).code)
}

// runtime -> page
chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  window.postMessage(msg as unknown as PageMessage, '*')
})

// page -> runtime
window.addEventListener('message', (e: MessageEvent) => {
  if (e.source !== window) return
  const data = e.data as unknown
  if (!isPageMessage(data)) return
  void chrome.runtime.sendMessage(data as unknown as RuntimeMessage).catch(() => {})
})
