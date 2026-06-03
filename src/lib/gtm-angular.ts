// Guarded access to GTM's Angular internals. EVERY entry point that touches
// `window.angular` goes through here, wrapped in try/catch, so that a GTM UI
// change degrades a single feature gracefully instead of throwing and killing
// the whole injected script.
//
// Robustness note: the legacy code also depended on Google's minified Closure
// symbols (module$exports$...getVariableTypeIconName). We deliberately do NOT
// rely on those here — we read `data.type` / `data.typeDisplayName` straight
// from the scope and key icons off our own bundled assets.

import type { PageType } from '@/lib/gtm-selectors'
import type { GtmElementData, GtmElementScope, GtmListService, GtmRowScope } from '@/types/gtm'

// Each page type lists candidate Angular service names in priority order.
// Web containers use the first; Server Side containers may expose the element
// under a different name. We probe each candidate until we find one that
// returns a valid service from the injector.
const SERVICE_CANDIDATES: Record<Exclude<PageType, ''>, readonly string[]> = {
  TAGS:      ['tagService',      'serverTagService',      'sTagService'],
  TRIGGERS:  ['triggerService',  'serverTriggerService'],
  VARIABLES: ['variableService', 'serverVariableService'],
  CLIENTS:   ['clientService',   'serverClientService',   'sClientService'],
}

const SCOPE_KEY: Record<Exclude<PageType, ''>, keyof GtmRowScope> = {
  TAGS:      'tag',
  TRIGGERS:  'trigger',
  VARIABLES: 'variable',
  CLIENTS:   'client',
}

// GTM does NOT provide a typeDisplayName for VARIABLES (only the internal code,
// e.g. 'jsm', 'c', 'v'). These codes are stable; map the built-in ones to
// readable Italian labels. Custom-template variables come through as
// 'cvt_<container>_<n>' and are grouped under one friendly label.
const VARIABLE_TYPE_LABELS: Record<string, string> = {
  c: 'Costante',
  jsm: 'JavaScript personalizzato',
  j: 'JavaScript',
  v: 'Variabile livello dati',
  smm: 'Tabella di ricerca',
  remm: 'Tabella di ricerca regex',
  k: 'Cookie primario',
  aev: 'Variabile evento automatico',
  u: 'Componente URL',
  f: 'Referrer HTTP',
  d: 'Elemento DOM',
  e: 'Errore JavaScript',
  vis: 'Visibilità elemento',
  dbg: 'Modalità debug',
  r: 'Numero casuale',
  ctv: 'Versione contenitore',
  cid: 'ID contenitore',
  gas: 'Impostazioni Google Analytics',
  awec: 'Dati forniti dall\u2019utente',
  cl: 'Classi clic',
  ce: 'Elemento clic',
  cu: 'URL clic',
  ct: 'Testo clic',
  fct: 'Variabile modulo',
  hl: 'Frammento cronologia',
  uv: 'Variabile non definita',
}

/** Friendly label for a variable type code. User overrides (injected by the
 *  content script via window.__QOL_VARS__.variableTypeLabels) take precedence,
 *  then the built-in map; finally the raw code / a custom-template fallback. */
function variableTypeLabel(code: string): string {
  const overrides = (window.__QOL_VARS__?.variableTypeLabels ?? {}) as Record<string, string>
  if (overrides[code]) return overrides[code]
  if (VARIABLE_TYPE_LABELS[code]) return VARIABLE_TYPE_LABELS[code]
  if (code.startsWith('cvt_')) return overrides['cvt_'] ?? 'Modello personalizzato'
  return code
}

// GTM Server Side container client type codes → readable Italian labels.
// These are stable internal identifiers; the UI does NOT always set typeDisplayName
// for client types, so we maintain our own map. Add new codes here as needed.
const CLIENT_TYPE_LABELS: Record<string, string> = {
  gaaw_client:   'GA4 Client',
  gtm_client:    'GTM Client',
  node_client:   'Node.js',
  preview_client: 'Anteprima',
  flush_client:  'Flush',
  pubsub_client: 'Cloud Pub/Sub',
  sp_client:     'Stape',
}

function clientTypeLabel(code: string): string {
  return CLIENT_TYPE_LABELS[code] ?? code
}

export interface GtmElement {
  /** Stable internal type code (e.g. 'gaawe', 'html'). Filter on this. */
  type: string
  /** Display name of the element. */
  name: string
  /** Localised type label, for display. */
  displayName: string
  /** The underlying scope, if a caller needs more. */
  raw: GtmElementScope
}

function injector() {
  try {
    return window.angular?.element(document.body).injector() ?? null
  } catch {
    return null
  }
}

/** Returns the first Angular service that looks like a valid GTM list service,
 *  trying each candidate name in order. Logs a debug hint when nothing works so
 *  developers can identify the correct name in an unfamiliar container type. */
function service(page: Exclude<PageType, ''>): GtmListService | null {
  const inj = injector()
  if (!inj) return null
  for (const name of SERVICE_CANDIDATES[page]) {
    try {
      const svc = inj.get<GtmListService>(name)
      if (svc && (typeof svc.getList === 'function' || svc.$$state != null)) {
        return svc
      }
    } catch {
      // service not registered under this name; try next
    }
  }
  console.debug(
    `[Andromeda] service not found for page=${page}. Tried: ${SERVICE_CANDIDATES[page].join(', ')}. ` +
    `Use window.angular?.element(document.body).injector() in the console to enumerate available services.`,
  )
  return null
}

/** Reads the live list of elements with their REAL type. Returns [] on any failure. */
export function getElements(page: Exclude<PageType, ''>): GtmElement[] {
  try {
    const svc = service(page)
    if (!svc) return []
    const list = (svc.getList ? svc.getList(undefined) : svc)?.$$state?.value ?? []
    const scopeKey = SCOPE_KEY[page]
    return list.map((scope) => {
      // a row scope may surface either as { tag/variable/trigger/client: {data} } or directly as {data}
      const data =
        (scope as unknown as GtmRowScope)[scopeKey]?.data ?? (scope as GtmElementScope).data
      const type =
        (data?.type as string | undefined) ?? data?.vendorTemplate?.key?.publicId ?? 'unknown'
      const displayName =
        data?.typeDisplayName != null
          ? String(data.typeDisplayName)
          : page === 'CLIENTS'
            ? clientTypeLabel(type)
            : type
      return {
        type,
        name: data?.name ?? '',
        displayName,
        raw: scope as GtmElementScope,
      }
    })
  } catch {
    return []
  }
}

/** Distinct types present in the current list, with counts. Powers the type filter UI. */
export function getTypesPresent(page: Exclude<PageType, ''>) {
  const counts = new Map<string, { type: string; displayName: string; count: number }>()
  for (const eln of getElements(page)) {
    const entry = counts.get(eln.type) ?? { type: eln.type, displayName: eln.displayName, count: 0 }
    entry.count += 1
    counts.set(eln.type, entry)
  }
  return [...counts.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/** Guarded angular.element(node).scope(). */
export function rowScope(node: Element): GtmRowScope | undefined {
  try {
    return window.angular?.element(node).scope()
  } catch {
    return undefined
  }
}

export interface GtmRow {
  /** The DOM node for the list row (to show/hide). */
  node: HTMLElement
  /** Grouping/filtering key (currently the display label). */
  type: string
  /** Raw type code (e.g. 'jsm', 'cvt_…'); used by the label editor. */
  code: string
  name: string
  displayName: string
  /** Vendor icon URL provided by GTM (tags); '' if absent. */
  brandThumbnailUrl?: string
  /** Raw numeric/string type (triggers use a numeric id for the icon file). */
  rawType?: string
  /** Variable publicId ('jsm', 'aev'...) for the icon file. */
  publicId?: string
  /** Whether the element is currently paused (tags only). */
  paused?: boolean
}

// Proven anchors (from the original, working extension): the list lives under
// `.gtm-container-page-content [gtm-table] table`, one row per `[gtm-table-row]`.
// The element data comes from the Angular service list, matched to rows by
// order — more reliable than reading each <tr>'s scope.
function appContext(): unknown {
  try {
    return injector()?.get<{ getContext?: () => unknown }>('appStateService')?.getContext?.() ?? undefined
  } catch {
    return undefined
  }
}

/** The visible name shown in a list row (used to match the row to its data).
 *  IMPORTANT: we clone the link before reading textContent so that our own
 *  injected type-icon badge (amd-type-icon / amd-type-initial) is excluded.
 *  Without this, the name would be prefixed with the badge's initial letter
 *  (e.g. "G GA4" instead of "GA4"), breaking any name-based comparison against
 *  the entity name stored in the Angular scope or service list. */
function rowName(node: HTMLElement): string {
  const cell = node.querySelector('td:nth-child(2)') ?? node
  const link = cell.querySelector('a')
  if (!link) return (cell.textContent ?? '').trim()
  // Strip our injected badge elements from the clone, then read textContent.
  const clone = link.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.amd-type-icon, .amd-type-initial').forEach((el) => el.remove())
  return (clone.textContent ?? '').trim()
}

export function getRowElements(page: Exclude<PageType, ''>): GtmRow[] {
  try {
    const scopeKey = SCOPE_KEY[page]
    // Variables have TWO tables: built-in (variable-list-built-in) and the
    // user-defined one. The service list only contains user variables, so we
    // must read the USER table, not the built-in one.
    let table: Element | null = null
    if (page === 'VARIABLES') {
      table =
        document.querySelector(
          '.gtm-container-page-content [data-gtm-cloak="variable-list"] > .card.card--table [gtm-table] table',
        ) ??
        document.querySelector(
          '.gtm-container-page-content [data-gtm-cloak="variable-list"] [gtm-table]:not([data-table-id="variable-list-built-in"]) table',
        )
    }
    table =
      table ??
      document.querySelector('.gtm-container-page-content [gtm-table]:last-of-type table') ??
      document.querySelector('.gtm-container-page-content [gtm-table] table')
    if (!table) return []
    const nodes = Array.from(table.querySelectorAll<HTMLElement>('[gtm-table-row]'))
    if (nodes.length === 0) return []

    // Pull the data list (with real types) from the service and index it BY NAME.
    // Matching by name (unique per container) is robust to the display order
    // differing from the service list order — matching by position was wrong.
    const svc = service(page)
    const list = (svc?.getList ? svc.getList(appContext()) : svc)?.$$state?.value ?? []
    const byName = new Map<string, GtmElementData>()
    list.forEach((entry, i) => {
      const data =
        (entry as unknown as GtmRowScope)[scopeKey]?.data ?? (entry as GtmElementScope).data
      if (data?.name != null) byName.set(String(data.name), data)
      // keep an index fallback too
      ;(byName as Map<string, GtmElementData>).set(`#${i}`, data as GtmElementData)
    })

    const rows = nodes.map((node, i) => {
      const name = rowName(node)
      const data =
        byName.get(name) ?? byName.get(`#${i}`) ?? rowScope(node)?.[scopeKey]?.data

      // For VARIABLES the real, distinctive type code is in
      // vendorTemplate.key.publicId ('jsm','c','v','cvt_…'); data.type is a
      // non-distinctive numeric index. Prefer publicId. Tags/triggers instead
      // carry a localised typeDisplayName which we use directly.
      const publicId = data?.vendorTemplate?.key?.publicId
      const code = String(
        data?.typeDisplayName ??
          (page === 'VARIABLES'
            ? (publicId ?? (data?.type as string | undefined) ?? '')
            : ((data?.type as string | undefined) ?? publicId ?? '')),
      )

      let displayName: string
      if (data?.typeDisplayName != null) displayName = String(data.typeDisplayName)
      else if (page === 'VARIABLES' && code) displayName = variableTypeLabel(code)
      else if (page === 'CLIENTS' && code) displayName = clientTypeLabel(code)
      else displayName = code || 'Sconosciuto'

      const type = displayName // grouping/filtering key
      const resolved = data != null && code !== ''
      return {
        node,
        type,
        code,
        name: name || (data?.name == null ? '' : String(data.name)),
        displayName,
        resolved,
        // Raw fields used to pick a type icon (hybrid approach):
        brandThumbnailUrl: (data?.brandThumbnailUrl as string | undefined) ?? '',
        rawType: data?.type == null ? '' : String(data.type),
        publicId: publicId ?? '',
        paused: data?.paused === true,
      }
    })
    // Drop rows whose data isn't loaded yet (avoids a transient "Sconosciuto"
    // chip while GTM is still populating the service list).
    const anyResolved = rows.some((r) => r.resolved)
    return anyResolved ? rows.filter((r) => r.resolved).map(({ resolved, ...r }) => r) : []
  } catch {
    return []
  }
}

export function reloadWithDebugInfo(): boolean {
  try {
    window.angular?.reloadWithDebugInfo?.()
    return true
  } catch {
    return false
  }
}

/** Collapse/expand the built-in variables table (like the original extension). */
export function setBuiltInVariablesCollapsed(collapsed: boolean): boolean {
  try {
    const box = document.querySelector<HTMLElement>('div[data-table-id="variable-list-built-in"]')
    if (!box) return false
    const table = box.querySelector<HTMLElement>(':scope > table')
    if (collapsed) {
      box.setAttribute('style', 'height: 56px !important; overflow: hidden !important;')
      if (table) table.style.display = 'none'
    } else {
      box.setAttribute('style', '')
      if (table) table.style.display = 'table'
    }
    return true
  } catch {
    return false
  }
}

export function hasBuiltInVariables(): boolean {
  return !!document.querySelector('div[data-table-id="variable-list-built-in"]')
}

/** Traverse the AngularJS scope tree from $rootScope to find an entity's key by
 *  name-matching. Works even when AngularJS debug info is DISABLED (production
 *  mode) — in that case, angular.element(node).scope() returns undefined because
 *  the DOM↔scope link is not stored, but the scope tree itself ($rootScope →
 *  $$childHead → $$nextSibling) always exists and is traversable. */
function findKeyViaRootScope(page: Exclude<PageType, ''>, entityName: string): unknown {
  if (!entityName) return undefined
  try {
    const inj = injector()
    if (!inj) return undefined
    // $rootScope is always accessible via the injector, even without debug info.
    const rootScope = inj.get<Record<string, unknown>>('$rootScope')
    if (!rootScope) return undefined
    const scopeKey = SCOPE_KEY[page]

    /** True if `entity` (scope[scopeKey]) contains the target name. Checks
     *  multiple paths because the structure can differ across GTM page types:
     *  - entity.data.name  (standard: triggerService, variableService)
     *  - entity.name       (some pages expose the name directly on the scope item) */
    function entityMatchesName(entity: unknown): boolean {
      if (!entity || typeof entity !== 'object') return false
      const e = entity as Record<string, unknown>
      const data = e['data'] as Record<string, unknown> | undefined
      if (typeof data?.['name'] === 'string' && data['name'] === entityName) return true
      if (typeof e['name'] === 'string' && e['name'] === entityName) return true
      return false
    }

    function search(scope: Record<string, unknown> | null | undefined, depth: number): unknown {
      if (!scope || depth > 60) return undefined
      const entity = scope[scopeKey]
      if (entity != null && entityMatchesName(entity)) {
        const key = (entity as Record<string, unknown>)['key']
        if (key != null) return key
      }
      const fromChild = search(
        scope['$$childHead'] as Record<string, unknown> | null | undefined,
        depth + 1,
      )
      if (fromChild != null) return fromChild
      // Siblings are at the same depth level — don't increment depth for siblings.
      return search(scope['$$nextSibling'] as Record<string, unknown> | null | undefined, depth)
    }

    return search(rootScope['$$childHead'] as Record<string, unknown> | null | undefined, 0)
  } catch {
    return undefined
  }
}

/** Duplicate the element of a given row into a new one with a unique name.
 *
 *  Strategy (in order):
 *  1. Angular service approach — resolves the entity key via three sub-strategies
 *     (table scope → $rootScope traversal → name match via getList), then calls
 *     svc.get() + svc.create(). Works for Web and Server Side containers.
 *  2. Native GTM menu fallback — if Angular services are unavailable, simulates a
 *     click on the row's three-dot action menu and selects the "Copia/Copy" item.
 *
 *  Returns true if the copy was successfully initiated (async result may still fail). */
export function copyRowToNew(
  page: Exclude<PageType, ''>,
  clickedEl: Element,
  onResult?: (ok: boolean) => void,
): boolean {
  const rowEl = (clickedEl.closest('[gtm-table-row]') ?? clickedEl.closest('tr')) as HTMLElement | null
  const singular = SCOPE_KEY[page]

  // ── PATH 1: Angular service ───────────────────────────────────────────────
  try {
    const inj = injector()
    if (inj) {
      // IMPORTANT: use appContext() (guarded) rather than inj.get('appStateService')
      // directly. In Server Side GTM, appStateService may not be registered and an
      // unguarded inj.get() would throw, aborting the entire Path 1 via the outer catch.
      const context = appContext()

      // Probe service name candidates — the first one that returns a valid service wins.
      // NOTE: getList / get / create live on the PROTOTYPE of these services (not as own
      // properties), so Object.keys() won't see them, but svc.getList etc. work fine.
      const svc = service(page) as {
        get: (key: unknown) => Promise<{ data: GtmElementData }>
        getList: (ctx: unknown) => { $$state?: { value?: GtmElementScope[] } }
        create: (ctx: unknown, payload: { data: GtmElementData }) => unknown
      } | null

      if (svc) {
        let key: unknown

        // KEY STRATEGY 1: table scope (tableCtrl.getItems / .items / .internalItems).
        // Works when AngularJS debug info is enabled (angular.element().scope() returns scope).
        try {
          const table =
            document.querySelector('.gtm-container-page-content [gtm-table]:last-of-type table') ??
            document.querySelector('.gtm-container-page-content [gtm-table] table')
          const tableScope = table
            ? (window.angular?.element(table).scope() as
                | {
                    tableCtrl?: {
                      getItems?: () => Array<{ key?: unknown; data?: GtmElementData }>
                      items?: Array<{ key?: unknown; data?: GtmElementData }>
                      internalItems?: Array<{ key?: unknown; data?: GtmElementData }>
                    }
                  }
                | undefined)
            : undefined
          const ctrl = tableScope?.tableCtrl
          const items = ctrl?.getItems?.() ?? ctrl?.items ?? ctrl?.internalItems
          if (items && rowEl) {
            const allRows = table ? Array.from(table.querySelectorAll('[gtm-table-row]')) : []
            const idx = allRows.indexOf(rowEl)
            if (idx >= 0 && items[idx]) key = items[idx].key
          }
        } catch {
          /* table-scope path unavailable */
        }

        // KEY STRATEGY 2: traverse the $rootScope scope tree by name.
        // In Server Side GTM, AngularJS runs in production mode (debug info disabled),
        // so angular.element(node).scope() returns undefined. But the scope tree from
        // $rootScope always exists: each ng-repeat row creates a child scope with the
        // entity as scope[scopeKey] = { key, data }. We find it by matching the name.
        if (!key && rowEl) {
          key = findKeyViaRootScope(page, rowName(rowEl))
          if (key != null) {
            console.debug(
              `[Andromeda QoL] copy: key resolved via $rootScope traversal for "${rowName(rowEl)}"`,
            )
          }
        }

        // KEY STRATEGY 3: name match via svc.getList (works when the list is already
        // cached; in Server Side GTM, getList may return an unresolved promise → empty).
        if (!key) {
          const name = rowEl ? rowName(rowEl) : ''
          const list = svc.getList(context)?.$$state?.value ?? []
          const entryFor = (e: GtmElementScope) =>
            ((e as unknown as GtmRowScope)[singular] ?? e) as { key?: unknown; data?: GtmElementData }
          const match = name ? list.find((e) => entryFor(e).data?.name === name) : undefined
          key = match ? entryFor(match).key : undefined
        }

        if (key) {
          void svc
            .get(key)
            .then((fetched) => {
              // For name-collision detection, prefer the service list; fall back to
              // reading row names from the DOM (reliable even without scope access).
              const svcList = svc.getList(context)?.$$state?.value ?? []
              const existing: (string | undefined)[] =
                svcList.length > 0
                  ? svcList.map(
                      (e) =>
                        (((e as unknown as GtmRowScope)[singular] ?? e) as { data?: GtmElementData })
                          .data?.name,
                    )
                  : Array.from(
                      document.querySelectorAll<HTMLElement>(
                        '.gtm-container-page-content [gtm-table-row]',
                      ),
                    ).map(rowName)
              let newName = fetched.data.name
              while (existing.indexOf(newName) >= 0) newName += ' - Copy'
              fetched.data.name = newName
              return svc.create(context, { data: fetched.data })
            })
            .then(() => onResult?.(true))
            .catch((err) => {
              console.warn('[Andromeda QoL] copy: service error', err)
              onResult?.(false)
            })
          return true
        }

        // Service found but key not resolved — log for diagnostics.
        console.debug(
          `[Andromeda QoL] copy: service found for page=${page} but could not resolve key for ` +
          `"${rowEl ? rowName(rowEl) : '?'}". Falling through to menu fallback.`,
        )
      } else {
        console.debug(
          `[Andromeda QoL] copy: no service found for page=${page}. Tried: ${SERVICE_CANDIDATES[page].join(', ')}.`,
        )
      }
    } else {
      console.debug('[Andromeda QoL] copy: window.angular not available — skipping Angular service path.')
    }
  } catch (err) {
    console.warn('[Andromeda QoL] copy: Angular path exception', err)
  }

  // ── PATH 2: Native GTM action-menu fallback ───────────────────────────────
  // Used when Angular services are absent (e.g. Server Side containers built on
  // Angular 2+) or when the service key cannot be resolved.
  // copyViaActionMenu handles the onResult callback itself (including async retries).
  if (rowEl && copyViaActionMenu(rowEl, onResult)) {
    return true
  }

  console.warn(
    `[Andromeda QoL] copy: could not duplicate "${rowEl ? rowName(rowEl) : '?'}" on page ${page}. ` +
    `Neither the Angular service path nor the native menu fallback succeeded. ` +
    `Open the browser console and check window.angular to diagnose.`,
  )
  onResult?.(false)
  return false
}

// ── Native menu fallback helpers ─────────────────────────────────────────────

/** Keywords used to identify the "copy/duplicate" action in GTM's menus.
 *  Covers English and Italian GTM UI languages. */
const COPY_MENU_KEYWORDS = ['copia', 'copy', 'duplica', 'duplicate', 'clone']

/** Simulates opening GTM's own three-dot action menu for a row and clicking the
 *  copy/duplicate option.
 *
 *  Returns true if a menu toggle was found and clicked (result delivered via onResult,
 *  possibly asynchronously after Angular Material's animation).
 *  Returns false if no toggle is found — caller should fall through to its own error path. */
function copyViaActionMenu(rowEl: HTMLElement, onResult?: (ok: boolean) => void): boolean {
  try {
    // GTM renders a per-row action menu toggle (three dots) in various ways.
    // Web containers use AngularJS directives; Server Side containers may use
    // Angular Material buttons (mat-icon-button / mat-mdc-icon-button).
    const menuToggle =
      rowEl.querySelector<HTMLElement>('[data-action-menu-toggle]') ??
      rowEl.querySelector<HTMLElement>('button[aria-label*="zioni"]') ?? // "Azioni"
      rowEl.querySelector<HTMLElement>('button[aria-label*="ction"]') ?? // "Actions"
      rowEl.querySelector<HTMLElement>('button[aria-haspopup="menu"]') ??
      rowEl.querySelector<HTMLElement>('button[aria-haspopup="true"]') ??
      rowEl.querySelector<HTMLElement>('.icon-btn-more, .more-actions') ??
      rowEl.querySelector<HTMLElement>('[aria-label*="altro"]') ??
      rowEl.querySelector<HTMLElement>('[aria-label*="more"]') ??
      rowEl.querySelector<HTMLElement>('[aria-label*="option"]') ??
      // Angular Material icon buttons (web + server-side GTM).
      rowEl.querySelector<HTMLElement>('button.mat-icon-button') ??
      rowEl.querySelector<HTMLElement>('button.mat-mdc-icon-button') ??
      // Last resort: any button nested inside the last cell of the row.
      rowEl.querySelector<HTMLElement>('td:last-child button')

    if (!menuToggle) {
      console.debug(
        '[Andromeda QoL] copyViaActionMenu: no menu toggle found in row. ' +
        'Row HTML (first 300 chars):', rowEl.outerHTML.slice(0, 300),
      )
      return false
    }

    menuToggle.click()

    // Retry chain for async menu rendering.
    // AngularJS menus appear synchronously (0 ms); Angular Material CDK overlays
    // animate in and may take up to ~300 ms before the panel is in the DOM.
    const delays = [0, 80, 200, 350]
    let attempt = 0

    function tryNext() {
      const delay = delays[attempt++]
      if (delay === 0) {
        // Run immediately (no setTimeout overhead for the synchronous case).
        if (clickCopyItem()) { onResult?.(true); return }
        tryNext()
      } else if (attempt <= delays.length) {
        setTimeout(() => {
          if (clickCopyItem()) {
            onResult?.(true)
          } else if (attempt < delays.length) {
            tryNext()
          } else {
            console.debug('[Andromeda QoL] clickCopyItem: no copy menu item found after all retries.')
            onResult?.(false)
          }
        }, delay)
      }
    }

    tryNext()
    return true // toggle was found and clicked; result delivered via onResult
  } catch (err) {
    console.debug('[Andromeda QoL] copyViaActionMenu error', err)
    return false
  }
}

function clickCopyItem(): boolean {
  try {
    // GTM's dropdown menus use various selectors across UI versions.
    // The CDK overlay container (Angular Material) renders panels outside the
    // normal DOM flow, so we must search the whole document.
    const menuPanel =
      document.querySelector<HTMLElement>('[role="menu"]:not([hidden])') ??
      // Angular Material 14 and below
      document.querySelector<HTMLElement>('.mat-menu-panel:not([hidden])') ??
      // Angular Material 15+ (MDC-based)
      document.querySelector<HTMLElement>('.mat-mdc-menu-panel:not([hidden])') ??
      // CDK overlay container (catches both versions)
      document.querySelector<HTMLElement>('.cdk-overlay-container [role="menu"]') ??
      document.querySelector<HTMLElement>('.dropdown-menu:not(.ng-hide)') ??
      document.querySelector<HTMLElement>('[data-action-menu]')

    if (!menuPanel) return false

    const items = Array.from(
      menuPanel.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="option"], .mat-menu-item, .mat-mdc-menu-item, button, a',
      ),
    )
    const copyItem = items.find((el) => {
      const text = (el.textContent ?? '').trim().toLowerCase()
      return COPY_MENU_KEYWORDS.some((kw) => text.includes(kw))
    })
    if (!copyItem) return false

    copyItem.click()
    return true
  } catch {
    return false
  }
}

// ── Rename helper ─────────────────────────────────────────────────────────────

/** Rename a single entity (tag/trigger/variable/client) to `newName`.
 *  Uses the same three key-resolution strategies as copyRowToNew.
 *  Returns true if the operation was initiated; result comes via onResult. */
export function renameElement(
  page: Exclude<PageType, ''>,
  rowEl: HTMLElement,
  newName: string,
  onResult?: (ok: boolean) => void,
): boolean {
  try {
    const inj = injector()
    if (!inj) { onResult?.(false); return false }

    const svc = service(page) as {
      get: (key: unknown) => Promise<{ data: GtmElementData }>
      getList: (ctx: unknown) => { $$state?: { value?: GtmElementScope[] } }
      update: (entity: unknown) => Promise<unknown>
    } | null
    if (!svc) { onResult?.(false); return false }

    const singular = SCOPE_KEY[page]
    let key: unknown

    // Strategy 1: table scope via tableCtrl
    try {
      const table =
        document.querySelector('.gtm-container-page-content [gtm-table]:last-of-type table') ??
        document.querySelector('.gtm-container-page-content [gtm-table] table')
      const tableScope = table
        ? (window.angular?.element(table).scope() as {
            tableCtrl?: {
              getItems?: () => Array<{ key?: unknown }>
              items?: Array<{ key?: unknown }>
              internalItems?: Array<{ key?: unknown }>
            }
          } | undefined)
        : undefined
      const ctrl = tableScope?.tableCtrl
      const items = ctrl?.getItems?.() ?? ctrl?.items ?? ctrl?.internalItems
      if (items) {
        const allRows = table ? Array.from(table.querySelectorAll('[gtm-table-row]')) : []
        const idx = allRows.indexOf(rowEl)
        if (idx >= 0 && items[idx]) key = items[idx].key
      }
    } catch { /* ignore */ }

    // Strategy 2: $rootScope traversal
    if (!key) key = findKeyViaRootScope(page, rowName(rowEl))

    // Strategy 3: getList name match
    if (!key) {
      const name = rowName(rowEl)
      const list = svc.getList(appContext())?.$$state?.value ?? []
      const match = name
        ? list.find((e) => {
            const entry = ((e as unknown as GtmRowScope)[singular] ?? e) as { data?: GtmElementData }
            return entry.data?.name === name
          })
        : undefined
      if (match) {
        const entry = ((match as unknown as GtmRowScope)[singular] ?? match) as { key?: unknown }
        key = entry.key
      }
    }

    if (!key) { onResult?.(false); return false }

    void svc.get(key)
      .then((fetched) => {
        fetched.data.name = newName
        return svc.update(fetched)
      })
      .then(() => onResult?.(true))
      .catch((err) => {
        console.warn('[LayerLens] rename: service error', err)
        onResult?.(false)
      })

    return true
  } catch (err) {
    console.warn('[LayerLens] rename error', err)
    onResult?.(false)
    return false
  }
}

// ── Pause/resume helpers ──────────────────────────────────────────────────────

/** Toggle the paused state of a tag row using the Angular tagService directly.
 *  Mirrors the original extension's toggleTagPauseState:
 *    tagService.get(key) → toggle data.paused → tagService.update(entity)
 *
 *  Returns true if the operation was initiated (result delivered via onResult). */
export function toggleTagPause(rowEl: HTMLElement, onResult?: (ok: boolean) => void): boolean {
  try {
    const inj = injector()
    if (!inj) {
      console.debug('[Andromeda QoL] toggleTagPause: angular injector not available')
      onResult?.(false)
      return false
    }

    const svc = service('TAGS') as {
      get: (key: unknown) => Promise<{ data: GtmElementData }>
      getList: (ctx: unknown) => { $$state?: { value?: GtmElementScope[] } }
      update: (entity: unknown) => Promise<unknown>
    } | null

    if (!svc) {
      console.debug('[Andromeda QoL] toggleTagPause: tagService not found')
      onResult?.(false)
      return false
    }

    // Key resolution — same 3 strategies as copyRowToNew
    let key: unknown

    // Strategy 1: direct row scope (works when Angular debug info is enabled)
    try {
      const scope = window.angular?.element(rowEl).scope()
      const tagEntry = (scope?.['tag'] ?? scope?.tag) as { key?: unknown } | undefined
      if (tagEntry?.key != null) key = tagEntry.key
    } catch { /* ignore */ }

    // Strategy 2: table scope via tableCtrl
    if (!key) {
      try {
        const table =
          document.querySelector('.gtm-container-page-content [gtm-table]:last-of-type table') ??
          document.querySelector('.gtm-container-page-content [gtm-table] table')
        const tableScope = table
          ? (window.angular?.element(table).scope() as
              | { tableCtrl?: { getItems?: () => Array<{ key?: unknown }>; items?: Array<{ key?: unknown }>; internalItems?: Array<{ key?: unknown }> } }
              | undefined)
          : undefined
        const ctrl = tableScope?.tableCtrl
        const items = ctrl?.getItems?.() ?? ctrl?.items ?? ctrl?.internalItems
        if (items) {
          const allRows = table ? Array.from(table.querySelectorAll('[gtm-table-row]')) : []
          const idx = allRows.indexOf(rowEl)
          if (idx >= 0 && items[idx]) key = items[idx].key
        }
      } catch { /* ignore */ }
    }

    // Strategy 3: $rootScope traversal (Server Side GTM — no debug info)
    if (!key) key = findKeyViaRootScope('TAGS', rowName(rowEl))

    // Strategy 4: getList name match
    if (!key) {
      const name = rowName(rowEl)
      const context = appContext()
      const list = svc.getList(context)?.$$state?.value ?? []
      const match = name
        ? list.find((e) => {
            const entry = ((e as unknown as GtmRowScope).tag ?? e) as { data?: GtmElementData }
            return entry.data?.name === name
          })
        : undefined
      if (match) {
        const entry = (match as unknown as GtmRowScope).tag ?? (match as unknown as { key?: unknown })
        key = (entry as { key?: unknown }).key ?? undefined
      }
    }

    if (!key) {
      console.debug('[Andromeda QoL] toggleTagPause: could not resolve key for', rowName(rowEl))
      onResult?.(false)
      return false
    }

    // Clone the key (like the original) to avoid mutating the live scope object
    const keyClone = Object.assign({}, key as Record<string, unknown>)

    void svc.get(keyClone)
      .then((fetched) => {
        // Mirror the original: truthy check, delete vs set true
        if ((fetched.data as Record<string, unknown>)['paused']) {
          delete (fetched.data as Record<string, unknown>)['paused']
        } else {
          ;(fetched.data as Record<string, unknown>)['paused'] = true
        }
        return svc.update(fetched)
      })
      .then(() => onResult?.(true))
      .catch((err) => {
        console.warn('[Andromeda QoL] toggleTagPause: service error', err)
        onResult?.(false)
      })

    return true
  } catch (err) {
    console.warn('[Andromeda QoL] toggleTagPause error', err)
    onResult?.(false)
    return false
  }
}
