// Central message protocol. The legacy code mixed `code` and `action` keys
// inconsistently across runtime messages and window.postMessage; both are
// modelled here so the inconsistency is at least documented (and a future
// cleanup target).

import type { FiltersConfiguration, FilterSection } from '@/lib/filters-schema'

/** chrome.runtime / chrome.tabs messages. */
export type RuntimeMessage =
  | { code: 'GET_GTM_ID' }
  | { code: 'LIST_GTM_ID'; data: { ids: string[]; url: string; origin: string } }
  | { code: 'GET_FILTERS_CONFIGURATION' }
  | { code: 'SET_FILTERS_CONFIGURATION'; data: FiltersConfiguration }
  | { code: 'update_container_pause_status'; data: { gtmID: string } }
  | {
      code: 'update_injected_site'
      data: { type: 'enable' | 'disable'; regExp: string; gtmId: string; disableGTM: boolean }
    }
  | { code: 'get_inject_status' }
  | { code: 'exit_preview' }
  | { code: 'check_update'; data: null }
  | { action: 'block_page_change'; value: boolean; data?: unknown }
  | { action: 'qol_changes'; value: boolean; data?: unknown; version?: string }
  | { action: 'blocked_gtm_status'; gtmID: string; timeout: boolean }
  | { action: 'inject_gtm_status'; injectIn: string }
  | { action: 'get_filters_configuration'; type: keyof FiltersConfiguration }

/** window.postMessage messages exchanged between content script and page world. */
export type PageMessage =
  | { code: 'GET_GTM_ID' }
  | { code: 'GET_DATALAYER' }
  | { code: 'START_DL_LIVE' }
  | { code: 'STOP_DL_LIVE' }
  | { code: 'LIST_GTM_ID'; data: { ids: string[]; url: string; origin: string } }
  | { code: 'TABLE_DATALAYER'; data: { dataLayer: string; dataLayerName: string } }
  | { code: 'DATALAYER_PUSH'; data: { dataLayer: string; dataLayerName: string } }
  | { action: 'disable_qol' }
  | { action: 'blocked_gtm_status'; gtmID: string; timeout: boolean }
  | { action: 'inject_gtm_status'; injectIn: string }
  | {
      action: 'save_filters'
      settings: { type: keyof FiltersConfiguration } & FilterSection & { legacyHandled: boolean }
    }
  | { action: 'get_filters_configuration'; type: keyof FiltersConfiguration }
  | {
      action: 'filters_configuration_response'
      type: keyof FiltersConfiguration
      filters_configuration: FiltersConfiguration
    }
