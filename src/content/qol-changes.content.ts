// Quality-of-Life changes for the GTM web UI.
//
// SCAFFOLD STATE: orchestration shell. The full QoL port lands here next, on:
//   @/lib/gtm-angular   (guarded internals access)
//   @/lib/gtm-selectors (centralised selectors)
//   @/lib/filters-schema (new type-based filters)
import qolInjectedPath from '@/injected/qol-changes.inject.ts?script&module'
import * as storage from '@/lib/storage'

const GTM_UI = 'tagmanager.google.com'
const TAG_ASSISTANT = 'tagassistant.google.com'

async function boot() {
  const enabled = (await storage.get('qol_changes')) === 1
  const host = location.hostname
  if (!enabled) return
  if (host !== GTM_UI && host !== TAG_ASSISTANT) return

  // Pass user config into the page world (the injected script can't read
  // chrome.storage). Use a data-attribute (NOT an inline <script>, which the
  // extension's CSP blocks). The injected module reads it on startup.
  const labels = (await storage.get('variable_type_labels')) ?? {}

  const s = document.createElement('script')
  s.type = 'module'
  s.src = chrome.runtime.getURL(qolInjectedPath) // ABSOLUTE extension URL (see datalayer note)
  const qolVars = JSON.stringify({
    variableTypeLabels: labels,
    imgBase: chrome.runtime.getURL('img/'),
  })
  s.dataset.qolVars = qolVars
  // ES modules have `document.currentScript === null`, so the injected module
  // can't read its own <script data-*>. Also stash the config on <html> so the
  // module can always find it.
  document.documentElement.dataset.qolVars = qolVars
  ;(document.head ?? document.documentElement).appendChild(s)

  // Storage bridge for the in-page variable-labels editor (page world can't
  // touch chrome.storage). It posts requests; we read/write and post back.
  window.addEventListener('message', async (ev: MessageEvent) => {
    if (ev.source !== window) return
    const data = ev.data as { action?: string; payload?: Record<string, string> } | undefined
    if (!data || typeof data.action !== 'string') return

    if (data.action === 'amd_get_var_labels') {
      const labels = (await storage.get('variable_type_labels')) ?? {}
      window.postMessage({ action: 'amd_var_labels', payload: labels }, '*')
    } else if (data.action === 'amd_set_var_labels' && data.payload) {
      await storage.set({ variable_type_labels: data.payload })
      window.postMessage({ action: 'amd_var_labels', payload: data.payload }, '*')
    }
  })
}

void boot()
