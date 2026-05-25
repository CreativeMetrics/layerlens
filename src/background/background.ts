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
        if (!gtmSites.some((s) => s.origin === msg.data.origin)) {
          gtmSites.push({
            url: msg.data.url,
            origin: msg.data.origin,
            gtm_ids: ids,
            time: Date.now(),
            sent: false,
          })
          void storage.set({ gtm_sites: gtmSites })
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
