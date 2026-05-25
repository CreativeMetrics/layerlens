// Thin typed helpers around chrome runtime/tabs messaging.

import type { RuntimeMessage } from '@/types/messages'

export function sendRuntime<R = unknown>(message: RuntimeMessage): Promise<R> {
  return chrome.runtime.sendMessage(message)
}

export function sendToTab<R = unknown>(tabId: number, message: RuntimeMessage): Promise<R> {
  return chrome.tabs.sendMessage(tabId, message)
}

export async function sendToActiveTab<R = unknown>(message: RuntimeMessage): Promise<R | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id == null) return undefined
  return chrome.tabs.sendMessage(tab.id, message)
}

/** Register a runtime message handler. Return a value (or a Promise) to reply. */
export function onRuntimeMessage(
  handler: (
    msg: RuntimeMessage,
    sender: chrome.runtime.MessageSender,
  ) => void | unknown | Promise<unknown>,
): void {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Guard sendResponse: if the requester is already gone (e.g. popup closed),
    // calling it throws and surfaces as "Error handling response" in their log.
    const safeRespond = (value: unknown) => {
      try {
        sendResponse(value)
      } catch {
        /* requester no longer listening — ignore */
      }
    }
    let result: void | unknown | Promise<unknown>
    try {
      result = handler(msg as RuntimeMessage, sender)
    } catch {
      return false
    }
    if (result instanceof Promise) {
      result.then(safeRespond).catch(() => safeRespond(undefined))
      return true // keep the channel open for the async reply
    }
    if (result !== undefined) safeRespond(result)
    return false
  })
}
