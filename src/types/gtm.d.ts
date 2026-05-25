// Typed contract for the GTM web UI internals we depend on.
// These shapes are intentionally documented in ONE place so that when Google
// changes the UI, the blast radius is contained and visible in the type system.

/** Stable internal type code, e.g. 'gaawe' (GA4 event), 'html', 'flc'. NOT localised. */
export type GtmTypeCode = string

export interface GtmElementData {
  /** Internal, language-independent type code. The thing we filter on. */
  type?: GtmTypeCode
  /** Display name of the element (user-given). */
  name: string
  /** Localised type label, e.g. "Custom HTML" / "HTML personalizzato". For display only. */
  typeDisplayName?: string
  /** Custom-template thumbnail, when present. */
  brandThumbnailUrl?: string
  /** For variables: the vendor template id, used as the type key. */
  vendorTemplate?: { key?: { publicId?: string } }
  [k: string]: unknown
}

export interface GtmElementScope {
  data: GtmElementData
}

/** Row scope as returned by angular.element(row).scope(). */
export interface GtmRowScope {
  tag?: GtmElementScope
  variable?: GtmElementScope
  trigger?: GtmElementScope
  /** Server Side GTM only. */
  client?: GtmElementScope
}

/** Angular service ($$state holds the resolved list). */
export interface GtmListService {
  getList?: (context: unknown) => { $$state?: { value?: GtmElementScope[] } }
  $$state?: { value?: GtmElementScope[] }
}

export interface AngularInjector {
  get<T = unknown>(name: string): T
}

export interface AngularElement {
  scope(): GtmRowScope | undefined
  injector(): AngularInjector | undefined
}

export interface AngularStatic {
  (selector: unknown): AngularElement
  element(node: unknown): AngularElement
  reloadWithDebugInfo?: () => void
}

declare global {
  interface Window {
    angular?: AngularStatic
    google_tag_manager?: Record<string, { dataLayer?: { name?: string } }>
    dataLayer?: unknown[]
    /** Variables injected by the content script for the page-world QoL bundle. */
    __QOL_VARS__?: Record<string, unknown>
  }
}

export {}
