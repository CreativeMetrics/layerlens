// Quality-of-Life changes for the GTM web UI and Tag Assistant debug interface.
//
// tagmanager.google.com  → injects qol-changes.inject.ts
//   (type filters, copy icons, built-in var toggle, label editor)
//
// tagassistant.google.com → injects tag-assistant.inject.ts
//   (event search across pages, pin events to top)

import qolInjectedPath from '@/injected/qol-changes.inject.ts?script&module'
import taInjectedPath  from '@/injected/tag-assistant.inject.ts?script&module'
import * as storage from '@/lib/storage'

const GTM_UI = 'tagmanager.google.com'
const TAG_ASSISTANT = 'tagassistant.google.com'

function injectScript(absoluteUrl: string, dataAttrs?: Record<string, string>) {
  const s = document.createElement('script')
  s.type = 'module'
  s.src = absoluteUrl
  if (dataAttrs) Object.assign(s.dataset, dataAttrs)
  ;(document.head ?? document.documentElement).appendChild(s)
}

async function boot() {
  const enabled = (await storage.get('qol_changes')) === 1
  if (!enabled) return

  const host = location.hostname

  if (host === GTM_UI) {
    const labels = (await storage.get('variable_type_labels')) ?? {}
    const qolVars = JSON.stringify({
      variableTypeLabels: labels,
      imgBase: chrome.runtime.getURL('img/'),
    })
    // Also stash on <html> so the ES-module injected script can find it
    // (document.currentScript is null in ES modules).
    document.documentElement.dataset.qolVars = qolVars
    injectScript(chrome.runtime.getURL(qolInjectedPath), { qolVars })

    // Storage bridge for the in-page variable-labels editor.
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
    return
  }

  if (host === TAG_ASSISTANT) {
    injectScript(chrome.runtime.getURL(taInjectedPath))
    return
  }
}

void boot()
