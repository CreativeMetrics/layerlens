// Single source of truth for every selector that reaches into the GTM web UI.
// Each logical target lists candidate selectors in priority order; `resolve`
// returns the first that matches. When Google reworks the UI, this is the only
// file that needs touching.

export type SelectorKey = keyof typeof SELECTORS

export const SELECTORS = {
  // Page-type detection
  pageVariables: ['[data-gtm-cloak="variable-list"]'],
  pageTags: ['[data-gtm-cloak="tag-list-page"]'],
  pageTriggers: ['[data-gtm-cloak-notifier] [data-table-id="trigger-list"]'],
  // Server Side GTM: Clients (not present in Web containers)
  pageClients: [
    '[data-gtm-cloak="client-list"]',
    '[data-gtm-cloak="client-list-page"]',
    '[data-gtm-cloak-notifier] [data-table-id="client-list"]',
    '[data-table-id="client-list"]',
  ],

  // Native search box bound to ctrl.filter
  filterInput: ['.card-title-bar [data-ng-model="ctrl.filter"]', '[data-ng-model="ctrl.filter"]'],

  // List building blocks
  builtInVariableList: ['div[data-table-id="variable-list-built-in"]'],

  // Preview / Tag Assistant
  debuggerHeader: ['.debugger-header'],
  previewCard: ['.preview-card.preview-card'],

  // Container id badge in the UI
  containerPublicId: ['gtm-container-public-id'],
} as const satisfies Record<string, readonly string[]>

/** First matching element across the candidate selectors for `key`. */
export function resolve<T extends Element = HTMLElement>(
  key: SelectorKey,
  root: ParentNode = document,
): T | null {
  for (const sel of SELECTORS[key]) {
    const found = root.querySelector<T>(sel)
    if (found) return found
  }
  return null
}

/** True if any candidate selector for `key` matches. */
export function exists(key: SelectorKey, root: ParentNode = document): boolean {
  return resolve(key, root) != null
}

export type PageType = 'TAGS' | 'TRIGGERS' | 'VARIABLES' | 'CLIENTS' | ''

export function pageType(): PageType {
  if (exists('pageVariables')) return 'VARIABLES'
  if (exists('pageTags')) return 'TAGS'
  if (exists('pageTriggers')) return 'TRIGGERS'
  if (exists('pageClients')) return 'CLIENTS'
  return ''
}
