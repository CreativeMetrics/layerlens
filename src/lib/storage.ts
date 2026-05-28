// Typed, promise-based wrapper over chrome.storage.local.
// Replaces dozens of ad-hoc callback-style get/set calls scattered across the
// legacy code and gives every key a single declared type.

import type { FiltersConfiguration } from '@/lib/filters-schema'

export interface GtmManualInjection {
  id: string
  gtmId: string
  /** Human-readable pattern as typed by the user (e.g. "*.example.com"). */
  pattern: string
  /** Compiled RegExp string for matching against full URLs. */
  regExp: string
  enabled: boolean
}

export interface StorageSchema {
  filters_configuration: FiltersConfiguration
  gtm_sites: Array<{ url: string; origin: string; gtm_ids: string[]; time: number; sent: boolean }>
  block_page_change: 0 | 1
  qol_changes: 0 | 1
  last_gtm_reload: number
  default_variable_display: 'default' | 'names' | 'values'
  /** User overrides for variable type labels (code -> label), merged over defaults. */
  variable_type_labels: Record<string, string>
  new_version_available: string | null
  ext_version: string
  /** Manual GTM injection rules configured from the popup. */
  gtm_manual_injections: GtmManualInjection[]
}

export async function get<K extends keyof StorageSchema>(
  key: K,
): Promise<StorageSchema[K] | undefined>
export async function get<K extends keyof StorageSchema>(
  keys: K[],
): Promise<Partial<Pick<StorageSchema, K>>>
export async function get(keys: keyof StorageSchema | (keyof StorageSchema)[]) {
  const single = !Array.isArray(keys)
  const result = await chrome.storage.local.get(single ? [keys] : keys)
  return single ? (result as Record<string, unknown>)[keys as string] : result
}

export async function set(values: Partial<StorageSchema>): Promise<void> {
  await chrome.storage.local.set(values)
}

export async function remove(keys: keyof StorageSchema | (keyof StorageSchema)[]): Promise<void> {
  await chrome.storage.local.remove(keys as string | string[])
}
