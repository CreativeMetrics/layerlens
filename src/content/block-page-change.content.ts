import * as storage from '@/lib/storage'
import type { RuntimeMessage } from '@/types/messages'

let attached = false
const beforeUnload = (e: BeforeUnloadEvent) => {
  e.preventDefault()
  e.returnValue = ''
}

function set(on: boolean) {
  if (on && !attached) {
    window.addEventListener('beforeunload', beforeUnload)
    attached = true
  } else if (!on && attached) {
    window.removeEventListener('beforeunload', beforeUnload)
    attached = false
  }
}

void storage.get('block_page_change').then((v) => set(v === 1))

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if ('action' in msg && msg.action === 'block_page_change') set(Boolean(msg.value))
})
