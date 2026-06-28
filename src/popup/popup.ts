import * as storage from '@/lib/storage'
import type { GtmManualInjection, StorageSchema } from '@/lib/storage'
import {
  decodeGcs,
  gcsToConsentState,
  parseCmpCookie,
  ONETRUST_ACTIVE_GROUPS_COOKIE_RE,
  ONETRUST_GROUP_SIGNAL_MAP,
  parseOneTrustActiveGroups,
  parseOneTrustGroupsFromOptanonConsent,
  oneTrustConsentDecision,
  oneTrustGroupsToConsentState,
  genericConsentDecision,
  categoriesToConsentState,
  type CmpConsentResult,
} from '@/lib/consent'
import { parseTrackingHits, type RequestEntry } from '@/lib/tracking-hits'
import { findPossiblePII, findDuplicateRootKeys, findGa4ConfigOrderIssues } from '@/lib/datalayer-lints'

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T | null

/* ---------- toggles ---------- */
type Flag = 'qol_changes' | 'block_page_change' | 'dl_bg_capture' | 'multi_page_capture'

async function bindToggle(id: Flag) {
  const box = $(id) as HTMLInputElement | null
  if (!box) return
  box.checked = (await storage.get(id)) === 1
  box.addEventListener('change', async () => {
    const value: 0 | 1 = box.checked ? 1 : 0
    await storage.set({ [id]: value } as Partial<StorageSchema>)
    if (id === 'block_page_change') {
      // Notify ALL tabs (like the original) so already-open pages react immediately.
      const tabs = await chrome.tabs.query({})
      for (const t of tabs)
        if (t.id != null)
          chrome.tabs
            .sendMessage(t.id, { action: 'block_page_change', value: Boolean(value) })
            .catch(() => {})
    }
    if (id === 'dl_bg_capture') {
      // Notify ALL tabs so already-open pages start/stop capturing immediately.
      const tabs = await chrome.tabs.query({})
      for (const t of tabs)
        if (t.id != null)
          chrome.tabs
            .sendMessage(t.id, { code: 'SET_DL_BG_CAPTURE', data: { enabled: Boolean(value) } })
            .catch(() => {})
    }
    if (id === 'multi_page_capture' && value === 1) {
      // Start the multi-page session clean — drop whatever single-page log was
      // captured before the toggle turned accumulation on.
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id != null)
        chrome.runtime.sendMessage({ code: 'CLEAR_NETWORK_LOG', data: { tabId: tab.id } }).catch(() => {})
    }
  })
}

/* ---------- settings panel ---------- */
function bindSettings() {
  const panel = $('settings')
  $('open-settings')?.addEventListener('click', () => {
    if (panel?.hasAttribute('hidden')) panel.removeAttribute('hidden')
    else panel?.setAttribute('hidden', '')
  })
  const v = chrome.runtime.getManifest().version
  if ($('ext-version')) $('ext-version')!.textContent = v
  if ($('footer-version')) $('footer-version')!.textContent = `LayerLens v${v}`
}

/* ---------- dataLayer / containers ---------- */
interface PageMsg {
  code?: string
  data?: {
    ids?: string[]
    url?: string
    origin?: string
    dataLayer?: string
    dataLayerName?: string
    ts?: number
    timestamps?: (number | null)[]
  }
}

let containerIds: string[] = []
let dataLayerName = 'dataLayer'
let pageUrl = ''
let pageOrigin = ''
/** Estimated gtm.js size (KB) per container ID, filled in as fetches resolve. */
const containerSizes: Record<string, number> = {}

function sendToActiveTab(message: unknown) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id != null) chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {})
  })
}

function renderContainers(ids: string[]) {
  const incoming = ids.filter((id) => id.startsWith('GTM-'))
  const count = $('container-count')
  const status = $('dl-status')
  const list = $('containers')
  const noGtm = $('no-gtm')
  const inspect = $('inspect-dl') as HTMLButtonElement | null
  const exportBtn = $('gtm-export') as HTMLButtonElement | null
  if (!list || !status) return

  // A later empty emission (polling fires before GTM is ready) must not erase
  // containers we already found. Ignore empty updates once we have some.
  if (incoming.length === 0 && containerIds.length > 0) return
  containerIds = incoming
  for (const key of Object.keys(containerSizes)) delete containerSizes[key]

  list.innerHTML = ''
  if (containerIds.length === 0) {
    status.textContent = 'Nessun GTM in questa pagina'
    count?.setAttribute('hidden', '')
    exportBtn?.setAttribute('hidden', '')
    noGtm?.removeAttribute('hidden')
    if (inspect) inspect.disabled = true
    return
  }
  status.textContent =
    containerIds.length === 1 ? 'Container trovato' : 'Container trovati su questa pagina'
  if (count) {
    count.textContent = String(containerIds.length)
    count.removeAttribute('hidden')
  }
  exportBtn?.removeAttribute('hidden')
  noGtm?.setAttribute('hidden', '')
  for (const id of containerIds) {
    const item = document.createElement('div')
    item.className = 'container-item'
    item.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5l0 9l-8 4.5l-8 -4.5l0 -9l8 -4.5"/><path d="M12 12l8 -4.5"/><path d="M12 12l0 9"/><path d="M12 12l-8 -4.5"/></svg><span>${id}</span><span class="sz" data-sz="${id}"></span>`
    list.appendChild(item)
    // estimate size from gtm.js (best-effort)
    fetch(`https://www.googletagmanager.com/gtm.js?id=${id}`)
      .then((r) => r.blob())
      .then((b) => {
        const kb = Math.round(b.size / 1024)
        containerSizes[id] = kb
        const el = item.querySelector<HTMLElement>('.sz')
        if (el) el.textContent = `~${kb} KB`
      })
      .catch(() => {})
  }
  if (inspect) inspect.disabled = false
}

/** Best-effort map from GTM internal `function` identifiers to human-friendly labels.
 *  Unknown identifiers are passed through unchanged — this is not an exhaustive list. */
const GTM_TYPE_LABELS: Record<string, string> = {
  // variables
  __c: 'Constant',
  __v: 'Data Layer Variable',
  __u: 'URL',
  __jsm: 'Custom JavaScript',
  __e: 'Event Name',
  __r: 'Random Number',
  __smm: 'Lookup Table',
  __remm: 'RegEx Table',
  __aev: 'Auto-Event Variable',
  __gas: 'Google Analytics Settings',
  __f: 'Referrer',
  __ev: 'Environment Name',
  __ctv: 'Container Version Number',
  __d: 'DOM Element',
  __j: 'JavaScript Variable',
  __cid: 'Container ID',
  __cookie: '1st Party Cookie',
  __hid: 'Hit ID',
  // triggers
  __cl: 'Click',
  __lcl: 'Link Click',
  __evl: 'Element Visibility',
  __sdl: 'Scroll Depth',
  __hl: 'History Change',
  __ytl: 'YouTube Video',
  // tags
  __html: 'Custom HTML',
  __img: 'Custom Image',
  __ua: 'Universal Analytics',
  __gaawe: 'GA4 Event',
  __gaawc: 'GA4 Configuration',
  __googtag: 'Google tag (gtag config)',
  __sgtmgaaw: 'GA4 (server-side)',
  __awct: 'Google Ads Conversion Tracking',
  __flc: 'Floodlight Counter',
  __fls: 'Floodlight Sales',
  // trigger predicate operators
  _eq: 'equals',
  _neq: 'not equals',
  _cn: 'contains',
  _ncn: 'does not contain',
  _re: 'matches RegEx',
  _nre: 'does not match RegEx',
  _sw: 'starts with',
  _ew: 'ends with',
  _lt: 'less than',
  _gt: 'greater than',
  _le: 'less than or equal',
  _ge: 'greater than or equal',
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
function asRecord(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}
function labelFor(fn: unknown): string | undefined {
  return typeof fn === 'string' ? GTM_TYPE_LABELS[fn] ?? fn : undefined
}

/** Extract the `"resource": {...}` JSON blob embedded in a published gtm.js file.
 *  Uses a balanced-brace scan (string-aware) — never eval/Function, per security rules. */
function extractResourceJson(src: string): unknown | null {
  const marker = '"resource":'
  const markerIdx = src.indexOf(marker)
  if (markerIdx === -1) return null
  const braceStart = src.indexOf('{', markerIdx + marker.length)
  if (braceStart === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(src.slice(braceStart, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

const MAX_RESOLVE_DEPTH = 6

/** Recursively resolve `["macro", N]` references — GTM's compiled format for "this
 *  parameter is bound to variable N" — against the container's macros array. Mirrors
 *  the technique used by public container viewers (gtm-spy): looks up
 *  vtp_defaultValue / vtp_value / vtp_name (in that order) on the referenced macro.
 *  Non-reference values are returned unchanged (deep-copied for objects/arrays). */
function resolveValue(value: unknown, macros: unknown[], depth = 0): unknown {
  if (depth > MAX_RESOLVE_DEPTH) return value
  if (Array.isArray(value)) {
    if (value.length === 2 && value[0] === 'macro' && typeof value[1] === 'number') {
      const macro = asRecord(macros[value[1]])
      const raw = macro.vtp_defaultValue ?? macro.vtp_value ?? macro.vtp_name
      return {
        macroRef: value[1],
        macroType: labelFor(macro.function),
        value: raw !== undefined ? resolveValue(raw, macros, depth + 1) : undefined,
      }
    }
    return value.map((v) => resolveValue(v, macros, depth + 1))
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveValue(v, macros, depth + 1)
    return out
  }
  return value
}

/** Build a `resolved` companion object containing only the deep-resolved `vtp_*` keys. */
function resolveParams(rec: Record<string, unknown>, macros: unknown[]): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith('vtp_')) resolved[k] = resolveValue(v, macros)
  }
  return resolved
}

/** For GA4 Event tags (`__gaawe`), `vtp_eventName` holds the GA4 event name — which is
 *  also the recognizable suffix of the tag's GTM display name (convention:
 *  `GA4 - Event - {eventName}`, confirmed against a real GTM export 2026-06-14).
 *  Returns the literal event name when statically known, otherwise undefined
 *  (e.g. when bound to a Lookup Table whose result depends on runtime input). */
function gaaweEventName(rec: Record<string, unknown>, macros: unknown[]): string | undefined {
  const raw = rec.vtp_eventName
  if (typeof raw === 'string') return raw
  const resolved = resolveValue(raw, macros) as Record<string, unknown> | undefined
  return typeof resolved?.value === 'string' ? resolved.value : undefined
}

/** Turn a parsed `resource` object into a flatter dump with friendly type labels and
 *  resolved variable references. Indices are preserved so `predicates`/`rules`
 *  references (by array position) can still be cross-referenced against `macros`/`tags`. */
function summarizeResource(resource: unknown) {
  const r = asRecord(resource)
  const rawMacros = asArray(r.macros).map((m, index) => ({
    index,
    typeLabel: labelFor(asRecord(m).function),
    ...asRecord(m),
  }))
  const macros = rawMacros.map((m) => ({ ...m, resolved: resolveParams(m, rawMacros) }))
  const tags = asArray(r.tags).map((t, index) => {
    const rec = asRecord(t)
    const eventName = rec.function === '__gaawe' ? gaaweEventName(rec, rawMacros) : undefined
    return {
      index,
      typeLabel: labelFor(rec.function),
      ...(eventName !== undefined ? { eventName } : {}),
      ...rec,
      resolved: resolveParams(rec, rawMacros),
    }
  })
  const predicates = asArray(r.predicates).map((p, index) => {
    const rec = asRecord(p)
    return { index, label: labelFor(rec.function), ...rec, resolved: resolveValue(rec, rawMacros) }
  })
  const rules = asArray(r.rules)
  return {
    version: typeof r.version === 'string' ? r.version : undefined,
    macros,
    tags,
    predicates,
    rules,
    ga4ConfigOrderIssues: findGa4ConfigOrderIssues(tags, predicates, rules, rawMacros),
  }
}

/** Best-effort raw HTML of the page (with <script> tags intact), via the active tab. */
async function getPageSource(tabId: number): Promise<string | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.documentElement.outerHTML,
    })
    return (results[0]?.result as string | undefined) ?? null
  } catch {
    return null
  }
}

interface CookieEntry {
  name: string
  domain: string
  firstParty: boolean
  expiry?: number
  ts: number              // export snapshot time (ms since epoch) — not cookie creation time
  setBeforeConsent?: boolean | 'unknown'
}

/** Cookies visible for the page's URL at the moment of the export snapshot.
 *  `ts` is the snapshot time — chrome.cookies exposes no creation timestamp.
 *  `setBeforeConsent` is enriched in exportGtmInfo after consentGrantedAt is known. */
async function getCookies(url: string): Promise<CookieEntry[]> {
  let hostname: string
  try {
    hostname = new URL(url).hostname
  } catch {
    return []
  }
  try {
    const snapshotTs = Date.now()
    const cookies = await chrome.cookies.getAll({ url })
    return cookies.map((c) => {
      const domain = c.domain.replace(/^\./, '')
      return {
        name: c.name,
        domain: c.domain,
        firstParty: hostname === domain || hostname.endsWith(`.${domain}`),
        ...(c.expirationDate != null ? { expiry: c.expirationDate } : {}),
        ts: snapshotTs,
      }
    })
  } catch {
    return []
  }
}

/** Reads name/value pairs for every cookie visible on the page, used only to
 *  detect CMP consent cookies (parseCmpCookie) — never merged into the
 *  exported `cookies[]` array, which intentionally omits raw values. */
async function getConsentCookiePairs(url: string): Promise<Array<{ name: string; value: string }>> {
  try {
    const cookies = await chrome.cookies.getAll({ url })
    return cookies.map((c) => ({ name: c.name, value: c.value }))
  } catch {
    return []
  }
}

interface NetworkEntry {
  url: string
  method: string
  resourceType?: string
  firstParty: boolean
  ts?: number             // webRequest timeStamp (ms since epoch); absent for Resource Timing fallback entries
  /** When `ts` is present: derived from ts vs consentGrantedAt (reliable).
   *  Otherwise: derived from the `gcs` query param (Google only) or 'unknown'. */
  firedBeforeConsent: boolean | 'unknown'
  consentState?: Record<string, 'granted' | 'denied'>
  /** The raw `gcs` (Google Consent State) query param, if present on the URL. */
  gcs?: string
  status?: number
  ok?: boolean
  initiator?: { type: string; url?: string; stack?: string[] }
}

/** Reads the `gcs` query param off a request URL and derives consent state at
 *  the moment that specific request fired — ground truth, no timing heuristics. */
function firedBeforeConsentFromUrl(url: string): boolean | 'unknown' {
  let gcs: string | null
  try {
    gcs = new URL(url).searchParams.get('gcs')
  } catch {
    return 'unknown'
  }
  if (!gcs) return 'unknown'
  const signals = decodeGcs(gcs)
  if (!signals) return 'unknown'
  return signals.some((s) => s.state === 'no')
}

/** Resource Timing URLs for the current page, read directly from the tab via
 *  executeScript — same proven pattern as getPageSource(). Unlike the background
 *  webRequest log, this doesn't depend on the service worker having been awake
 *  during page load: the browser records these entries regardless. */
async function getResourceTimings(tabId: number): Promise<string[]> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => performance.getEntriesByType('resource').map((e) => e.name),
    })
    return (results[0]?.result as string[] | undefined) ?? []
  } catch {
    return []
  }
}

/** A Set-Cookie header observed via webRequest, with the response's webRequest
 *  timestamp — the only reliable per-cookie "written at" signal available
 *  (chrome.cookies exposes no creation time). See background.ts cookieSetLog. */
type CookieSetEntry = { name: string; domain: string; ts: number }

interface RequestData {
  entries: RequestEntry[]
  startedAt: number | null
  navStartCookies: Array<{ name: string; domain: string; expiry?: number }> | null
  cookieSets: CookieSetEntry[]
}

/** Requests observed since the last top-level navigation, combining the background
 *  webRequest log (includes method, type, ts, status, initiator) with Resource Timing
 *  entries read live from the tab (method=GET, no ts). Deduped by URL — first occurrence wins.
 *  Also returns `startedAt` (nav start ms), `navStartCookies` (pre-page-load cookie snapshot),
 *  and `cookieSets` (Set-Cookie headers observed this page load, with timestamps). */
async function getRequestEntries(tabId: number): Promise<RequestData> {
  const byUrl = new Map<string, RequestEntry>()
  let startedAt: number | null = null
  let navStartCookies: Array<{ name: string; domain: string; expiry?: number }> | null = null
  let cookieSets: CookieSetEntry[] = []

  try {
    const res = (await chrome.runtime.sendMessage({ code: 'GET_NETWORK_LOG', data: { tabId } })) as
      | {
          requests: Array<{
            url: string
            method: string
            type?: string
            ts?: number
            status?: number
            initiator?: { type: string; url?: string; stack?: string[] }
          }>
          startedAt?: number | null
          navStartCookies?: Array<{ name: string; domain: string; expiry?: number }> | null
          cookieSets?: CookieSetEntry[]
        }
      | undefined
    if (res) {
      startedAt = res.startedAt ?? null
      navStartCookies = res.navStartCookies ?? null
      cookieSets = res.cookieSets ?? []
      for (const { url, method, type, ts, status, initiator } of res.requests) {
        if (!byUrl.has(url)) {
          byUrl.set(url, {
            url, method,
            ...(type ? { type } : {}),
            ...(ts != null ? { ts } : {}),
            ...(status != null ? { status } : {}),
            ...(initiator ? { initiator } : {}),
          })
        }
      }
    }
  } catch {
    /* background unreachable — fall back to resource timings only */
  }

  for (const url of await getResourceTimings(tabId)) {
    if (!byUrl.has(url)) byUrl.set(url, { url, method: 'GET' })
  }

  return { entries: [...byUrl.values()], startedAt, navStartCookies, cookieSets }
}

/** Server response HTML fetched without JS execution (pre-render snapshot).
 *  Uses credentials:omit so the result is the anonymous public version.
 *  Returns null on restricted URLs, non-HTTP schemes, or fetch errors. */
async function getRawHtml(url: string): Promise<string | null> {
  try {
    const { protocol } = new URL(url)
    if (protocol !== 'https:' && protocol !== 'http:') return null
    const res = await fetch(url, { cache: 'no-store', credentials: 'omit' })
    return await res.text()
  } catch {
    return null
  }
}

/** Derives the Consent Mode timeline by splitting the combined dataLayer + network
 *  observation sequence (see buildConsentObservations) at `consentGrantedAt`:
 *  `default` = the last state observed before that point, `afterChoice` = the
 *  first state observed at or after it. Also detects the CMP from known event
 *  names in dataLayer pushes. Returns null when no consent signals are found.
 *
 *  Splitting by `ts` (rather than the previous "first gcs seen = default, a later
 *  different gcs = afterChoice" heuristic) fixes a real inversion: under strict
 *  Consent Mode setups, no request fires at all before consent is granted, so the
 *  *first* gcs-bearing request already reflects the post-choice state — the old
 *  heuristic locked that in as "default", and a later, often unrelated, gcs
 *  profile (e.g. a different tag's signal set) got mislabeled "afterChoice".
 *  `consentGrantedAt` is computed once by computeConsentGrantedAt and reused here
 *  so both derivations agree on the same anchor point.
 *
 *  `oneTrustGroups` (OneTrust's own active-groups cookie, ground truth — see
 *  src/lib/consent.ts) overrides `afterChoice` when present: it reflects what
 *  the CMP actually activated, independent of whatever the site's gtag wiring
 *  reports. This fixes sites where the consent push state doesn't match the
 *  real banner choice (e.g. analytics_storage still "granted" post reject-all). */
function buildConsentTimeline(
  entries: RequestEntry[],
  allPushes: unknown[],
  consentGrantedAt: number | null,
  oneTrustGroups: string[] | null,
  cmpConsentResults: CmpConsentResult[],
): Record<string, unknown> | null {
  const observations = buildConsentObservations(entries, allPushes)

  let defaultState: Record<string, string> | null = null
  let afterChoiceState: Record<string, string> | null = null
  let cmp: string | undefined

  if (consentGrantedAt != null) {
    for (const o of observations) {
      if (o.ts < consentGrantedAt) defaultState = o.state
      else { afterChoiceState = o.state; break }
    }
  } else if (observations.length > 0) {
    // No choice ever detected this session — report whatever single state was observed.
    defaultState = observations[0].state
  }

  // Ground-truth override, from strongest to weakest signal: OneTrust's own
  // active-groups cookie first (it has a dedicated, well-tested mapping);
  // otherwise the generic per-category mapping for whichever other CMP's
  // cookie we could parse (Cookiebot, CookieYes, Complianz — see
  // CMP_CATEGORY_SIGNAL_MAP in consent.ts). Both confirm a real choice was
  // made even if we never witnessed an explicit pre-choice network
  // observation, so default falls back to the typical Consent Mode default
  // (everything denied except security_storage) rather than staying absent.
  let groundTruthSignals: Record<string, string> | null = null
  if (oneTrustGroups) {
    groundTruthSignals = oneTrustGroupsToConsentState(oneTrustGroups)
  } else {
    for (const r of cmpConsentResults) {
      if (!r.categories) continue
      const mapped = categoriesToConsentState(r.cmp, r.categories)
      if (mapped) { groundTruthSignals = mapped; cmp = r.cmp; break }
    }
  }
  if (groundTruthSignals) {
    afterChoiceState = groundTruthSignals
    if (!defaultState) {
      defaultState = Object.fromEntries(
        Object.keys(groundTruthSignals).map((signal) => [signal, signal === 'security_storage' ? 'granted' : 'denied']),
      )
    }
  }

  // CMP detection from dataLayer event names
  const CMP_PATTERNS: Array<[RegExp, string]> = [
    [/cookieyes/i, 'CookieYes'],
    [/onetrust/i, 'OneTrust'],
    [/cookiebot|cookieconsent/i, 'Cookiebot'],
    [/axeptio/i, 'Axeptio'],
    [/iubenda/i, 'iubenda'],
    [/didomi/i, 'Didomi'],
    [/trustarc|truste/i, 'TrustArc'],
    [/klaro/i, 'Klaro'],
  ]
  for (const push of allPushes) {
    if (!push || typeof push !== 'object' || cmp) break
    const event = (push as Record<string, unknown>)['event']
    if (typeof event !== 'string') continue
    for (const [re, name] of CMP_PATTERNS) {
      if (re.test(event)) { cmp = name; break }
    }
  }
  if (!cmp && oneTrustGroups) cmp = 'OneTrust'

  if (!defaultState && !afterChoiceState) return null
  return {
    ...(defaultState ? { default: defaultState } : {}),
    ...(afterChoiceState ? { afterChoice: afterChoiceState } : {}),
    ...(cmp ? { cmp } : {}),
  }
}

/** Extracts the raw `gcs` (Google Consent State) query param from a request URL, if present. */
function gcsFromUrl(url: string): string | undefined {
  try {
    return new URL(url).searchParams.get('gcs') ?? undefined
  } catch {
    return undefined
  }
}

function normalizeResourceType(type: string): string {
  if (type === 'main_frame' || type === 'sub_frame') return 'document'
  if (type === 'xmlhttprequest') return 'xhr'
  if (type === 'ping') return 'fetch'
  const known = new Set(['script', 'stylesheet', 'image', 'font', 'fetch', 'websocket', 'document', 'media'])
  return known.has(type) ? type : 'other'
}

function isFirstParty(url: string): boolean {
  try {
    const reqHost = new URL(url).hostname
    const pageHost = new URL(pageOrigin).hostname
    return reqHost === pageHost || reqHost.endsWith(`.${pageHost}`) || pageHost.endsWith(`.${reqHost}`)
  } catch {
    return false
  }
}

function toNetworkLog(entries: RequestEntry[]): NetworkEntry[] {
  return entries.map(({ url, method, type, ts, status, initiator }) => {
    const gcs = gcsFromUrl(url)
    const consentState = gcs ? (gcsToConsentState(gcs) ?? undefined) : undefined
    const entry: NetworkEntry = {
      url,
      method,
      ...(type ? { resourceType: normalizeResourceType(type) } : {}),
      firstParty: isFirstParty(url),
      ...(ts != null ? { ts } : {}),
      firedBeforeConsent: firedBeforeConsentFromUrl(url),
      ...(consentState ? { consentState } : {}),
      ...(gcs ? { gcs } : {}),
      ...(status != null ? { status, ok: status >= 200 && status < 400 } : {}),
      ...(initiator ? { initiator } : {}),
    }
    return entry
  })
}

type LiveDlEntry = { push: unknown; ts: number | null }

/** Reads window.dataLayer directly from the page world (MAIN) via executeScript.
 *  Bug fix: using currentPushes would miss pushes that occurred before the user
 *  opened the dataLayer inspector tab. This reads the full current array instead.
 *  Also reads the parallel "__llTs" timestamp array maintained unconditionally by
 *  ensurePushWrapped() in datalayer-checker.inject.ts (independent of the live
 *  mode / background capture toggles), so "_ts" doesn't depend on the user having
 *  flipped one of those opt-in toggles before pushing. */
async function getTabDataLayer(tabId: number): Promise<LiveDlEntry[]> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const dl = (window as unknown as Record<string, unknown>).dataLayer
        if (!Array.isArray(dl)) return []
        const tsArr = (dl as unknown[] & { __llTs?: number[] }).__llTs
        const offset = Array.isArray(tsArr) ? Math.max(0, dl.length - tsArr.length) : dl.length
        return (dl as unknown[])
          .map((item, i) => {
            let push: unknown
            try { push = JSON.parse(JSON.stringify(item)) } catch { return null }
            const ts = Array.isArray(tsArr) && i >= offset ? tsArr[i - offset] : null
            return { push, ts }
          })
          .filter((x): x is LiveDlEntry => x !== null)
      },
      world: 'MAIN',
    })
    const result = results[0]?.result as unknown
    return Array.isArray(result) ? (result as LiveDlEntry[]) : []
  } catch {
    return []
  }
}

type BgDlEntry = { push: unknown; ts: number; url: string }

/** Fetches the always-on background dataLayer log for this tab (captured by
 *  DL_BG_PUSH regardless of whether the popup was open). */
async function getBgDataLayer(tabId: number): Promise<BgDlEntry[]> {
  try {
    const res = await chrome.runtime.sendMessage({ code: 'GET_DL_LOG', data: { tabId } }) as
      | { entries?: unknown[] }
      | undefined
    return Array.isArray(res?.entries) ? (res!.entries as BgDlEntry[]) : []
  } catch {
    return []
  }
}

/** Fetches IAB TCF `useractioncomplete` event timestamps observed for this tab
 *  this page load (see the __tcfapi hook in datalayer-checker.inject.ts) —
 *  tier-1 consent-choice marker, CMP-agnostic. */
async function getTcfLog(tabId: number): Promise<number[]> {
  try {
    const res = (await chrome.runtime.sendMessage({ code: 'GET_TCF_LOG', data: { tabId } })) as
      | { entries?: number[] }
      | undefined
    return Array.isArray(res?.entries) ? res!.entries! : []
  } catch {
    return []
  }
}

type CmpCookieWriteEntry = { name: string; domain: string; ts: number; cmp: string }

/** Fetches the global log of observed CMP consent-cookie writes (tier-2
 *  consent-choice marker — see chrome.cookies.onChanged listener in
 *  background.ts). Not tab-scoped at the source, so the caller must filter by
 *  cookie domain against the page being exported. */
async function getCmpCookieWrites(): Promise<CmpCookieWriteEntry[]> {
  try {
    const res = (await chrome.runtime.sendMessage({ code: 'GET_CMP_COOKIE_WRITES' })) as
      | { entries?: CmpCookieWriteEntry[] }
      | undefined
    return Array.isArray(res?.entries) ? res!.entries! : []
  } catch {
    return []
  }
}

/** Whether a cookie's domain (as reported by chrome.cookies, often with a
 *  leading dot) belongs to the page being exported — same-site or a
 *  subdomain relationship in either direction, mirroring isFirstParty's
 *  hostname comparison further down this file. */
function cookieDomainMatchesPage(cookieDomain: string, pageHostname: string): boolean {
  const d = cookieDomain.replace(/^\./, '')
  return d === pageHostname || pageHostname.endsWith(`.${d}`) || d.endsWith(`.${pageHostname}`)
}

interface ConsentObservation {
  ts: number
  state: Record<string, 'granted' | 'denied'>
  /** Only set for dataLayer-sourced observations — the explicit gtag command
   *  name. Network gcs observations never carry this (we can't tell from a
   *  ping alone whether it reflects a default or a post-choice state). */
  command?: 'default' | 'update'
}

/** Chronologically-sorted Consent Mode state observations, combining dataLayer
 *  `consent` commands (`default`/`update`, keyed by `_ts`) with network `gcs`
 *  query params (keyed by webRequest `ts`). Shared by consentGrantedAt detection
 *  and (the timeline's default/afterChoice split). */
function buildConsentObservations(
  entries: RequestEntry[],
  allPushes: unknown[],
): ConsentObservation[] {
  const observations: ConsentObservation[] = []

  for (const push of allPushes) {
    if (!push || typeof push !== 'object') continue
    const p = push as Record<string, unknown>
    if (p['0'] !== 'consent') continue
    const ts = p['_ts']
    if (typeof ts !== 'number') continue
    const stateObj = p['2']
    if (!stateObj || typeof stateObj !== 'object') continue
    const state: Record<string, 'granted' | 'denied'> = {}
    for (const [k, v] of Object.entries(stateObj as Record<string, unknown>)) {
      if (v === 'granted' || v === 'denied') state[k] = v
    }
    if (!Object.keys(state).length) continue
    const command = p['1'] === 'default' ? 'default' : p['1'] === 'update' ? 'update' : undefined
    observations.push({ ts, state, ...(command ? { command } : {}) })
  }

  for (const { url, ts } of entries) {
    if (ts == null) continue
    const gcs = gcsFromUrl(url)
    if (!gcs) continue
    const state = gcsToConsentState(gcs)
    if (state) observations.push({ ts, state })
  }

  return observations.sort((a, b) => a.ts - b.ts)
}

/** Determines when the user actually made a consent choice (ms since epoch),
 *  CMP-agnostic, and whether that choice predates this page load rather than
 *  happening during the captured session.
 *
 *  Deliberately does NOT search Consent Mode *state* (gcs / dataLayer consent
 *  values) for a "first granted" transition, unlike the previous heuristic —
 *  a site's own default config can already grant a signal (e.g. analytics_storage
 *  granted by default, only ads gated behind the banner), which that heuristic
 *  mistook for a real choice the moment any such request fired. The marker of
 *  choice and the Consent Mode *state* around it are two different things —
 *  state is read separately, in buildConsentTimeline, once this anchor point
 *  is known.
 *
 *  Instead, `tieredCandidates` is consulted in priority order (most reliable
 *  first) — exactly one tier is used, the first that has any candidate at
 *  all:
 *   1. IAB TCF `useractioncomplete` event timestamps (any TCF-based CMP).
 *   2. CMP consent-cookie WRITE timestamps, observed live via
 *      chrome.cookies.onChanged — real wall-clock time of the write, works
 *      for CMPs whose cookie carries no embedded timestamp of its own.
 *   3. The same cookie's own embedded timestamp, read from a one-shot
 *      snapshot at export time (existing `cmpConsentCandidates`) — used only
 *      when tier 2 missed the write (e.g. the service worker was asleep at
 *      that instant) but the cookie value is still there now.
 *   4. The first explicit `gtag('consent','update',...)` — never `default` —
 *      per Google's own convention that `update` is only ever called in
 *      response to a real user action, unlike `default` which a page pushes
 *      automatically on every load regardless of any actual choice.
 *
 *  Within the chosen tier, a candidate at or before `startedAt` means the
 *  choice predates this page load (returning visitor) — `alreadyGrantedAtLoad`,
 *  reported using `startedAt` itself as the instant (the real moment is
 *  unknown but happened no later than that). A candidate strictly after
 *  `startedAt` is a genuine in-session choice. Returns
 *  `{ consentGrantedAt: null, alreadyGrantedAtLoad: false }` only when no
 *  tier has any candidate at all — no marker of choice was observed this
 *  session. */
function computeConsentGrantedAt(
  tieredCandidates: number[][],
  startedAt: number | null,
): { consentGrantedAt: number | null; alreadyGrantedAtLoad: boolean } {
  for (const tier of tieredCandidates) {
    if (tier.length === 0) continue
    const genuine: number[] = []
    let preExisting = false
    for (const ts of tier) {
      if (startedAt != null && ts <= startedAt) preExisting = true
      else genuine.push(ts)
    }
    if (preExisting) return { consentGrantedAt: startedAt, alreadyGrantedAtLoad: true }
    if (genuine.length > 0) return { consentGrantedAt: Math.min(...genuine), alreadyGrantedAtLoad: false }
  }
  return { consentGrantedAt: null, alreadyGrantedAtLoad: false }
}

type NavCookieEntry = { name: string; domain: string; expiry?: number }

/** Formats a navStart cookie as a full CookieEntry using the page origin for firstParty. */
function formatNavCookie(
  c: NavCookieEntry,
  navTs: number,
  setBeforeConsent: boolean | 'unknown',
): CookieEntry {
  const domain = c.domain.replace(/^\./, '')
  let firstParty = false
  try {
    const h = new URL(pageOrigin).hostname
    firstParty = h === domain || h.endsWith(`.${domain}`)
  } catch { /* ignore */ }
  return {
    name: c.name,
    domain: c.domain,
    firstParty,
    ...(c.expiry != null ? { expiry: c.expiry } : {}),
    ts: navTs,
    setBeforeConsent,
  }
}

/** Splits network, cookies, dataLayer, and trackingHits into pre/post consent captures.
 *  When consentGrantedAt is null (consent never granted), only preConsent is returned. */
function buildCaptures(
  network: NetworkEntry[],
  trackingHits: ReturnType<typeof parseTrackingHits>,
  cookies: CookieEntry[],
  navCookies: NavCookieEntry[] | null,
  startedAt: number | null,
  allPushes: unknown[],
  consentGrantedAt: number | null,
  exportAt: number,
): Record<string, unknown> {
  const navTs = startedAt ?? exportAt
  const navCookieSet = new Set((navCookies ?? []).map((c) => `${c.name}|${c.domain}`))
  const preCookieEntries = (navCookies ?? []).map((c) =>
    formatNavCookie(c, navTs, consentGrantedAt == null ? true : true),
  )

  if (consentGrantedAt == null) {
    return {
      preConsent: {
        network,
        ...(preCookieEntries.length > 0 ? { cookies: preCookieEntries } : {}),
        ...(allPushes.length > 0 ? { dataLayer: allPushes } : {}),
        ...(trackingHits.length > 0 ? { trackingHits } : {}),
      },
    }
  }

  const preNetwork = network.filter((e) =>
    e.ts != null ? e.ts < consentGrantedAt : e.firedBeforeConsent !== false,
  )
  const postNetwork = network.filter((e) =>
    e.ts != null ? e.ts >= consentGrantedAt : e.firedBeforeConsent === false,
  )

  const prePushes = allPushes.filter((p) => {
    const ts = (p as Record<string, unknown>)['_ts']
    return typeof ts !== 'number' || ts < consentGrantedAt
  })
  const postPushes = allPushes.filter((p) => {
    const ts = (p as Record<string, unknown>)['_ts']
    return typeof ts === 'number' && ts >= consentGrantedAt
  })

  // post-consent cookies = newly set during this session (not present at nav start)
  const postCookieEntries = cookies.filter((c) => !navCookieSet.has(`${c.name}|${c.domain}`))

  const preHits = trackingHits.filter((h) => h.firedBeforeConsent !== false)
  const postHits = trackingHits.filter((h) => h.firedBeforeConsent === false)

  return {
    preConsent: {
      network: preNetwork,
      ...(preCookieEntries.length > 0 ? { cookies: preCookieEntries } : {}),
      ...(prePushes.length > 0 ? { dataLayer: prePushes } : {}),
      ...(preHits.length > 0 ? { trackingHits: preHits } : {}),
    },
    postConsent: {
      network: postNetwork,
      ...(postCookieEntries.length > 0 ? { cookies: postCookieEntries } : {}),
      ...(postPushes.length > 0 ? { dataLayer: postPushes } : {}),
      ...(postHits.length > 0 ? { trackingHits: postHits } : {}),
    },
  }
}

/** Download info about the GTM container(s) detected on the page as a JSON file.
 *  Includes the published gtm.js parse, enriched network log, tracking hits,
 *  cookies, consent timeline, raw/rendered HTML diff, and annotated dataLayer. */
async function exportGtmInfo() {
  if (containerIds.length === 0) return
  const btn = $('gtm-export') as HTMLButtonElement | null
  if (btn) btn.disabled = true
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tab?.id ?? null

    // Collect raw request data (entries + nav-start metadata from background).
    const { entries: requestEntries, startedAt, navStartCookies: navCookies, cookieSets } =
      tabId != null
        ? await getRequestEntries(tabId)
        : { entries: [], startedAt: null, navStartCookies: null, cookieSets: [] }

    // Read window.dataLayer directly from the page (authoritative for current page).
    // Also fetch the always-on background log (captures pushes across all pages even
    // when the popup was never opened), the IAB TCF user-action log, and the global
    // CMP cookie-write log (all three are consent-choice-marker sources — see
    // computeConsentGrantedAt below).
    const [liveDataLayerEntries, bgLog, tcfLog, cmpCookieWrites] = await Promise.all([
      tabId != null ? getTabDataLayer(tabId) : Promise.resolve([]),
      tabId != null ? getBgDataLayer(tabId) : Promise.resolve([]),
      tabId != null ? getTcfLog(tabId) : Promise.resolve([]),
      getCmpCookieWrites(),
    ])

    const [containers, renderedHtml, rawHtml, rawCookies] = await Promise.all([
      Promise.all(
        containerIds.map(async (id) => {
          const base = { id, sizeKB: containerSizes[id] ?? null }
          try {
            const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${id}`)
            const text = await res.text()
            const resource = extractResourceJson(text)
            if (!resource) {
              return { ...base, container: null, parseError: 'resource non trovato nel gtm.js' }
            }
            return { ...base, container: summarizeResource(resource) }
          } catch (e) {
            return { ...base, container: null, parseError: String(e) }
          }
        }),
      ),
      tabId != null ? getPageSource(tabId) : Promise.resolve(null),
      pageUrl ? getRawHtml(pageUrl) : Promise.resolve(null),
      pageUrl ? getCookies(pageUrl) : Promise.resolve([]),
    ])

    // CMP consent cookies (OneTrust, Cookiebot, iubenda, ...) — read separately
    // from getCookies() since they need the raw cookie value (never exposed in
    // the exported cookies[] array) to recover the real consent timestamp.
    const consentCookiePairs = pageUrl ? await getConsentCookiePairs(pageUrl) : []
    const cmpConsentResults = consentCookiePairs
      .map((c) => parseCmpCookie(c.name, c.value))
      .filter((r): r is NonNullable<typeof r> => r != null)
    const cmpConsentCandidates = cmpConsentResults
      .filter((r) => r.hasRealConsent && r.ts != null)
      .map((r) => r.ts as number)
    const detectedCmpFromCookie = cmpConsentResults.find((r) => r.hasRealConsent)?.cmp

    // OneTrust active-groups cookie — ground truth for the real banner choice
    // (ad/analytics groups actually turned on), independent of whatever the
    // site's gtag consent push reports. See src/lib/consent.ts. Falls back to
    // OptanonConsent's own `groups=` parameter when the dedicated cookie isn't
    // set — confirmed live (viviennewestwood.com) that most real OneTrust
    // deployments only ever set OptanonConsent, not OnetrustActiveGroups.
    const activeGroupsCookie = consentCookiePairs.find((c) => ONETRUST_ACTIVE_GROUPS_COOKIE_RE.test(c.name))
    const optanonConsentCookie = consentCookiePairs.find((c) => c.name === 'OptanonConsent')
    const oneTrustGroups =
      (activeGroupsCookie ? parseOneTrustActiveGroups(activeGroupsCookie.value) : null) ??
      (optanonConsentCookie ? parseOneTrustGroupsFromOptanonConsent(optanonConsentCookie.value) : null)
    // OneTrust's active-groups cookie is ground truth when present; for every
    // other CMP fall back to the generic per-category (or, lacking that,
    // binary hasRealConsent) decision built from the same cookie scan.
    const consentDecision = oneTrustGroups
      ? oneTrustConsentDecision(oneTrustGroups)
      : genericConsentDecision(cmpConsentResults)

    const exportAt = Date.now()

    // Build dataLayer export — previous pages oldest→newest, then current page.
    // Background log (DL_BG_PUSH) is the primary source for previous pages: it
    // captures pushes regardless of popup state. historyPages (popup session) fills
    // the gap for any pages the background didn't cover (e.g. visited before inject).
    // Current page always uses liveDataLayer (authoritative full window.dataLayer).

    // Previous pages from background (everything except current URL).
    const bgPrevEntries = bgLog.filter((e) => e.url !== pageUrl)

    const bgHistoryDataLayer = bgPrevEntries.map((e) => {
      const meta: Record<string, unknown> = { _page: e.url, _ts: e.ts }
      if (e.push && typeof e.push === 'object' && !Array.isArray(e.push)) {
        return { ...(e.push as Record<string, unknown>), ...meta }
      }
      return { _rawPush: e.push, ...meta }
    })

    // Popup session history — fills any gap the background log left for a page.
    // Dedup is per-push (by url + content), NOT "skip the whole page if the bg
    // log has any entry for that URL": the bg wrap installs a beat after the
    // popup's own initial dump, so for a given visit the bg log can easily have
    // *fewer* pushes than historyPages — the old all-or-nothing skip silently
    // dropped every push historyPages had that the (incomplete) bg log lacked.
    const seenBgKeys = new Set(bgPrevEntries.map((e) => `${e.url}|${JSON.stringify(e.push)}`))
    const historyDataLayer = [...historyPages].reverse().flatMap((p) => {
      return p.pushes
        .map((push, i) => ({ push, i }))
        .filter(({ push }) => !seenBgKeys.has(`${p.url ?? ''}|${JSON.stringify(push)}`))
        .map(({ push, i }) => {
          const meta: Record<string, unknown> = { _page: p.url ?? p.label }
          if (p.timestamps?.[i] != null) meta['_ts'] = p.timestamps![i]
          if (push && typeof push === 'object' && !Array.isArray(push)) {
            return { ...(push as Record<string, unknown>), ...meta }
          }
          return { _rawPush: push, ...meta }
        })
    })

    // Current-page timestamps come straight from getTabDataLayer's read of the
    // page's own "__llTs" tracking (see ensurePushWrapped in
    // datalayer-checker.inject.ts) — already 1:1 aligned to each push, and
    // recorded unconditionally (not only when live mode / background capture
    // are toggled on), so "_ts" no longer depends on the user having flipped
    // one of those opt-in toggles before pushing.
    const currentDataLayer = liveDataLayerEntries.map(({ push, ts }) => {
      const meta: Record<string, unknown> = { _page: pageUrl }
      if (ts != null) meta['_ts'] = ts
      if (push && typeof push === 'object' && !Array.isArray(push)) {
        return { ...(push as Record<string, unknown>), ...meta }
      }
      return { _rawPush: push, ...meta }
    })

    // allPushes is used for consent analysis and the captures split.
    // Order: popup-only history (oldest) → bg history → current page.
    const allPushes = [...historyDataLayer, ...bgHistoryDataLayer, ...currentDataLayer]

    // Initial network + tracking (gcs-based firedBeforeConsent as fallback).
    let network = toNetworkLog(requestEntries)
    let trackingHits = parseTrackingHits(requestEntries)

    // Determine when the user actually made a consent choice (ms since epoch) —
    // used both to recompute firedBeforeConsent reliably for timestamped entries,
    // and to split the consentTimeline below. Must run before buildConsentTimeline.
    // Tier 2: cookie WRITES observed live (background.ts chrome.cookies.onChanged),
    // filtered to cookies belonging to the page being exported.
    let pageHostname = ''
    try { pageHostname = new URL(pageOrigin).hostname } catch { /* ignore */ }
    const cookieWriteCandidates = cmpCookieWrites
      .filter((w) => cookieDomainMatchesPage(w.domain, pageHostname))
      .map((w) => w.ts)
    // Tier 4: the first explicit gtag('consent','update',...) — never 'default' —
    // per Google's convention that `update` only ever fires in response to a
    // real user action (buildConsentObservations already labels the command).
    const gtagUpdateCandidates = buildConsentObservations(requestEntries, allPushes)
      .filter((o) => o.command === 'update')
      .map((o) => o.ts)
    const { consentGrantedAt, alreadyGrantedAtLoad } = computeConsentGrantedAt(
      [tcfLog, cookieWriteCandidates, cmpConsentCandidates, gtagUpdateCandidates],
      startedAt,
    )

    let consentTimeline = buildConsentTimeline(
      requestEntries, allPushes, consentGrantedAt, oneTrustGroups, cmpConsentResults,
    )
    if (detectedCmpFromCookie) {
      consentTimeline = consentTimeline?.cmp
        ? consentTimeline
        : { ...(consentTimeline ?? {}), cmp: detectedCmpFromCookie }
    }

    // Override gcs-based firedBeforeConsent with ts-based value where possible.
    // When consent was never granted this session, everything that fired is
    // "before consent" by definition — true for all of it, ts or no ts.
    if (consentGrantedAt != null) {
      network = network.map((e) =>
        e.ts != null ? { ...e, firedBeforeConsent: e.ts < consentGrantedAt } : e,
      )
      trackingHits = trackingHits.map((h) =>
        h.ts != null ? { ...h, firedBeforeConsent: h.ts < consentGrantedAt } : h,
      )
    } else {
      network = network.map((e) => ({ ...e, firedBeforeConsent: true }))
      trackingHits = trackingHits.map((h) => ({ ...h, firedBeforeConsent: true }))
    }

    // Enrich export-time cookies with setBeforeConsent.
    // - Cookies already present at nav start unambiguously predate any in-session
    //   consent choice → true (previously mismarked 'unknown').
    // - New cookies when consent was never granted this session → true (everything
    //   that happened, happened before any consent).
    // - New cookies when consent was granted: look up the Set-Cookie header ts
    //   from cookieSets (background webRequest capture) and compare to
    //   consentGrantedAt — reliable boolean. Falls back to 'unknown' only for
    //   cookies set via document.cookie (no HTTP header observed), where the
    //   write time is genuinely not determinable.
    const stripDotDomain = (d: string) => d.replace(/^\./, '')
    const navCookieSet = new Set((navCookies ?? []).map((c) => `${c.name}|${c.domain}`))
    const cookieSetTsByKey = new Map<string, number>()
    for (const cs of cookieSets) {
      const key = `${cs.name}|${stripDotDomain(cs.domain)}`
      const existing = cookieSetTsByKey.get(key)
      if (existing == null || cs.ts < existing) cookieSetTsByKey.set(key, cs.ts)
    }
    const cookies = rawCookies.map((c) => {
      const isNew = !navCookieSet.has(`${c.name}|${c.domain}`)
      let setBeforeConsent: boolean | 'unknown'
      if (!isNew || consentGrantedAt == null) {
        setBeforeConsent = true
      } else {
        const setTs = cookieSetTsByKey.get(`${c.name}|${stripDotDomain(c.domain)}`)
        setBeforeConsent = setTs != null ? setTs < consentGrantedAt : 'unknown'
      }
      return { ...c, setBeforeConsent }
    })

    // capture metadata
    const hasConsentSignals =
      allPushes.some((p) => (p as Record<string, unknown>)['0'] === 'consent') ||
      requestEntries.some((e) => gcsFromUrl(e.url) != null)
    const captureMode =
      consentGrantedAt != null ? 'split'
      : hasConsentSignals ? 'preConsent'
      : 'singleSnapshot'
    const capture: Record<string, unknown> = {
      startedAt: startedAt ?? null,
      consentGrantedAt,
      mode: captureMode,
      consentDecision,
      ...(alreadyGrantedAtLoad ? { consentAlreadyGrantedAtLoad: true } : {}),
    }

    // Reliable per-push firedBeforeConsent, additive alongside _page/_ts — same
    // ts < consentGrantedAt rule as network/trackingHits above, including the
    // "true for everything" rule when consent was never granted this session.
    // _beforeConsent is a separate, strictly-boolean additive field (no 'unknown'):
    // true when _ts < consentGrantedAt, OR unconditionally true when consentDecision
    // is 'rejectAll'/'noChoice' — the user never gave a real, ground-truth consent,
    // so nothing should count as "after consent" even if a misconfigured site's
    // own gtag push reported consentGrantedAt as non-null. This makes the dataLayer
    // export self-sufficient for the deny-all/accept-all audit without relying on
    // a (possibly buggy) site-reported consent state.
    const dataLayerExport = allPushes.map((p) => {
      if (!p || typeof p !== 'object') return p
      const rec = p as Record<string, unknown>
      const ts = rec['_ts']
      const firedBeforeConsent: boolean | 'unknown' =
        consentGrantedAt == null ? true
        : typeof ts === 'number' ? ts < consentGrantedAt
        : 'unknown'
      const beforeConsent: boolean =
        consentDecision === 'rejectAll' || consentDecision === 'noChoice' ? true
        // No timestamp evidence of when an accept/partial choice happened (rare:
        // OneTrust groups parsed fine but no gtag/gcs/cookie-ts signal anchored
        // consentGrantedAt) — conservative default, same reasoning as above.
        : consentGrantedAt == null ? true
        : typeof ts === 'number' ? ts < consentGrantedAt
        : false
      const possiblePII = findPossiblePII(rec)
      const duplicateRootKeys = findDuplicateRootKeys(rec)
      return {
        ...rec,
        _firedBeforeConsent: firedBeforeConsent,
        _beforeConsent: beforeConsent,
        ...(possiblePII.length > 0 ? { _possiblePII: possiblePII } : {}),
        ...(duplicateRootKeys.length > 0 ? { _duplicateRootKeys: duplicateRootKeys } : {}),
      }
    })

    const captures = buildCaptures(
      network, trackingHits, cookies, navCookies, startedAt,
      dataLayerExport, consentGrantedAt, exportAt,
    )

    const data: Record<string, unknown> = {
      url: pageUrl,
      origin: pageOrigin,
      exportedAt: new Date().toISOString(),
      dataLayerName,
      note:
        'macros = variabili, tags = tag, predicates/rules = condizioni e logica dei trigger. ' +
        'Estratto dal gtm.js pubblicato: i nomi assegnati in GTM di solito non sono presenti, ' +
        'solo tipi interni (function) e parametri (vtp_*). Il campo "resolved" di ogni ' +
        'macro/tag/predicate risolve i riferimenti {macro: N} ai valori configurati. ' +
        'renderedHtml = HTML del DOM dopo l\'esecuzione JS. rawHtml = risposta server anonima ' +
        '(senza cookie, no-store). pageSource = alias di renderedHtml. ' +
        'network[].ts: timestamp webRequest ms; firedBeforeConsent = ts < consentGrantedAt quando ' +
        'disponibile, true se il consenso non è mai stato concesso, altrimenti da gcs; initiator ' +
        'da chrome.debugger (assente se DevTools aperto). ' +
        'trackingHits: hit GA4/Ads/Meta/Bing/TikTok con IDs, ts e firedBeforeConsent (stessa regola). ' +
        'cookies[].ts: ora snapshot export; setBeforeConsent true/false affidabile (cookie pre-esistenti ' +
        'al nav, o nuovi con Set-Cookie osservato via webRequest confrontato a consentGrantedAt); ' +
        '\'unknown\' solo per cookie scritti via document.cookie (nessun header HTTP osservabile). ' +
        'capture: {startedAt, consentGrantedAt, mode} — rilevato da gcs+dataLayer con _ts. ' +
        'consentDecision: scelta utente ("acceptAll"/"rejectAll"/"partial"/"noChoice"). Ground truth ' +
        'dai gruppi attivi OneTrust (OnetrustActiveGroups/OptanonActiveGroups) quando disponibili; ' +
        'altrimenti dalle categorie del cookie CMP rilevato (Cookiebot, CookieYes, Complianz — ' +
        'acceptAll/rejectAll/partial dal numero di categorie non-essenziali concesse). Per CMP senza ' +
        'categorie note nel cookie (iubenda, Klaro, Didomi) resta un binario acceptAll/rejectAll da ' +
        'hasRealConsent, senza "partial". "noChoice" se nessun cookie di consenso è stato trovato. ' +
        'consentAlreadyGrantedAtLoad: true se il consenso risultava già concesso al load ' +
        '(cookie CMP preesistente) — la cattura non ha una vera fase pre-consenso. ' +
        'captures: {preConsent, postConsent} split al consentGrantedAt. ' +
        'consentTimeline: stato consenso da gcs + push dataLayer; se i gruppi OneTrust o le categorie ' +
        'di un\'altra CMP nota sono disponibili, afterChoice è ricalcolato da quelli (ground truth) ' +
        'invece che dal gtag della pagina. ' +
        'dataLayer: push con _page (URL), _ts (ms, solo push live o da storico) e ' +
        '_firedBeforeConsent (stessa regola di network[].firedBeforeConsent, \'unknown\' se _ts assente) e ' +
        '_beforeConsent (booleano, mai \'unknown\': true se _ts < consentGrantedAt, sempre true se ' +
        'consentDecision è "rejectAll"/"noChoice" anche con consentGrantedAt non-null da gtag, ' +
        'altrimenti false — pensato per l\'audit deny-all/accept-all senza dipendere dal container). ' +
        'dataLayer[]._possiblePII: dotted path delle chiavi (email, phone, first_name, address, ecc.) ' +
        'con un valore stringa non vuoto — presente solo se trovata almeno una corrispondenza. ' +
        'dataLayer[]._duplicateRootKeys: chiavi presenti sia alla radice del push sia dentro ' +
        '"ecommerce" — anomalia Gold Standard, presente solo se trovata almeno una duplicazione. ' +
        'containers[].container.ga4ConfigOrderIssues: Measurement ID per cui il primo tag gtag config ' +
        '(in ordine di firing GTM: Initialization prima di Page View/DOM/Load, prima di Custom Event) ' +
        'ha send_page_view=false e nessun tag GA4 Event dedicato invia "page_view" — su quel Measurement ' +
        'ID il page_view non viene mai inviato, anche se un tag config successivo sullo stesso ID non ' +
        'ha l\'override (in gtag.js solo la prima config() per ID innesca il page_view implicito).',
      capture,
      containers,
      pageSource: renderedHtml,
      renderedHtml,
      ...(rawHtml != null ? { rawHtml } : {}),
      network,
      ...(trackingHits.length > 0 ? { trackingHits } : {}),
      ...(cookies.length > 0 ? { cookies } : {}),
      ...(consentTimeline ? { consentTimeline } : {}),
      ...(dataLayerExport.length > 0 ? { dataLayer: dataLayerExport } : {}),
      captures,
    }

    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gtm-rilevato-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } finally {
    if (btn) btn.disabled = false
  }
}

/* JSON syntax highlight (escaped, then colored) */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function highlight(json: string) {
  return escapeHtml(json)
    .replace(/&quot;([^&]+?)&quot;:/g, '<span class="k">"$1"</span>:')
    .replace(/: &quot;([^&]*?)&quot;/g, ': <span class="s">"$1"</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="b">$1</span>')
}

function makePushNode(push: unknown, index: number): HTMLElement {
  const obj = push as Record<string, unknown>
  const hasEvent = obj && typeof obj === 'object' && typeof obj.event === 'string'
  const isShopify = obj?._shopify === true
  const rawEventName = hasEvent ? (obj.event as string) : `push ${index + 1}`
  // For Shopify events, show the short name (after "shopify:") in the header.
  const event = isShopify && rawEventName.startsWith('shopify:')
    ? rawEventName.slice('shopify:'.length)
    : rawEventName
  const json = JSON.stringify(push, null, 2)
  const propCount = obj && typeof obj === 'object' ? Object.keys(obj).length : 0
  const wrap = document.createElement('div')
  wrap.className = 'push' + (hasEvent ? ' has-event' : '') + (isShopify ? ' shopify-push' : '')
  // Store searchable text as data attributes so applyFilter() never touches the DOM.
  wrap.dataset.ev = event.toLowerCase()
  wrap.dataset.json = json.toLowerCase()
  wrap.dataset.raw = json  // original JSON string — used by pin persistence
  const shopifyBadge = isShopify
    ? `<span class="shopify-badge" title="Evento Shopify Web Pixel">Shopify</span>`
    : ''
  wrap.innerHTML = `
    <div class="push-head">
      <svg class="chev" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6l-6 6"/></svg>
      ${shopifyBadge}<span class="ev">${escapeHtml(String(event))}</span>
      <span class="push-prop-count">${propCount} prop</span>
      <button class="pin-btn" title="Fissa in cima" aria-pressed="false"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg></button>
      <span class="copy"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/></svg>copia</span>
    </div>
    <pre class="push-json">${highlight(json)}</pre>`
  wrap.querySelector('.push-head')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.copy, .pin-btn')) return
    wrap.classList.toggle('open')
  })
  wrap.querySelector('.pin-btn')?.addEventListener('click', () => togglePin(wrap))
  wrap.querySelector('.copy')?.addEventListener('click', () => {
    const helper = $('clipboard-helper') as HTMLTextAreaElement | null
    if (!helper) return
    helper.value = `${dataLayerName}.push(${json});`
    helper.select()
    document.execCommand('copy')
    const c = wrap.querySelector('.copy')!
    c.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>copiato`
    setTimeout(() => (c.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M16 8v-2a2 2 0 0 0 -2 -2h-8a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/></svg>copia`), 1500)
  })
  return wrap
}

let pushCounter = 0
/** Current text filter (lowercase). Empty string = no filter active. */
let filterText = ''

// ── Page-history & pin state ──────────────────────────────────────────────────

/** Raw JSON (original formatting) of every pinned push.
 *  Stored as strings so pins survive renderDataLayer (page navigation). */
const pinnedRaws = new Set<string>()

/** Previous page visits, most recent first. */
interface PageRecord { label: string; url?: string; pushes: unknown[]; timestamps?: (number | undefined)[] }
let historyPages: PageRecord[] = []
/** Current page's pushes, oldest → newest. */
let currentPushes: unknown[] = []
/** Timestamps (Date.now()) parallel to currentPushes. undefined for pushes from the initial dump. */
let currentPushTimestamps: (number | undefined)[] = []
let visitCounter = 0
let currentPageLabel = ''

/** Whether the filter searches only the current page or the whole history. */
let searchScope: 'page' | 'all' = 'page'


// ── Session-state persistence ─────────────────────────────────────────────────
// chrome.storage.session survives popup close/reopen within the same browser
// session, so pins and page history are preserved even though the popup is
// destroyed every time the user clicks away from it.

function saveSessionState() {
  try {
    void chrome.storage.session.set({
      ll_pins: [...pinnedRaws],
      ll_history: historyPages,
      ll_current: currentPushes,
      ll_ts: currentPushTimestamps,
      ll_visit: visitCounter,
      ll_page_label: currentPageLabel,
    })
  } catch { /* session storage unavailable in this context */ }
}

async function loadSessionState() {
  try {
    const r = await chrome.storage.session.get([
      'll_pins', 'll_history', 'll_current', 'll_ts', 'll_visit', 'll_page_label',
    ])
    if (Array.isArray(r.ll_pins)) {
      for (const s of r.ll_pins as string[]) pinnedRaws.add(s)
    }
    if (Array.isArray(r.ll_history)) historyPages = r.ll_history as PageRecord[]
    if (typeof r.ll_visit === 'number') visitCounter = r.ll_visit
    if (typeof r.ll_page_label === 'string') currentPageLabel = r.ll_page_label
    // Move the restored currentPushes straight into historyPages.
    // Rationale: the popup is ephemeral — it closed when the user navigated.
    // The "current" page from the last session is now a *past* visit.
    // Archiving it here means renderDataLayer (called immediately after to
    // refresh the new page) will find currentPushes empty and won't try to
    // double-archive, while history already contains the previous visit.
    const restoredCurrent = Array.isArray(r.ll_current) ? r.ll_current as unknown[] : []
    const restoredTs = Array.isArray(r.ll_ts) ? r.ll_ts as (number | undefined)[] : []
    if (restoredCurrent.length > 0) {
      historyPages.unshift({
        label: currentPageLabel,
        pushes: restoredCurrent,
        ...(restoredTs.length > 0 ? { timestamps: restoredTs } : {}),
      })
      // currentPushes stays [] — renderDataLayer will populate it for the new page
    }
  } catch { /* session storage unavailable */ }
}

// ── Core render ───────────────────────────────────────────────────────────────

/** Full rebuild of the push list from stored state.
 *  Called on page navigation, pin toggle, and scope change. */
function rebuildPushList() {
  const body = $('dl-modal-body')
  const countEl = $('dl-count')
  if (!body) return
  body.innerHTML = ''

  // PINNED SECTION — re-created from pinnedRaws so pins survive page changes.
  if (pinnedRaws.size > 0) {
    let pi = -1
    for (const raw of pinnedRaws) {
      try {
        const push = JSON.parse(raw)
        const node = makePushNode(push, pi--)
        node.classList.add('pinned')
        const btn = node.querySelector<HTMLElement>('.pin-btn')
        if (btn) { btn.title = 'Rimuovi dai fissati'; btn.setAttribute('aria-pressed', 'true') }
        body.appendChild(node)
      } catch { /* skip corrupt entry */ }
    }
    const sep = document.createElement('div')
    sep.className = 'pin-separator'
    sep.innerHTML = '<span>fissati</span>'
    body.appendChild(sep)
  }

  // CURRENT PAGE — newest first, skip anything already pinned.
  const totalCurrent = currentPushes.length
  ;[...currentPushes].reverse().forEach((push, i) => {
    const raw = JSON.stringify(push, null, 2)
    if (pinnedRaws.has(raw)) return
    body.appendChild(makePushNode(push, totalCurrent - 1 - i))
  })

  // HISTORY PAGES — shown only in "all" scope mode.
  if (searchScope === 'all') {
    for (const page of historyPages) {
      const sep = document.createElement('div')
      sep.className = 'page-separator'
      sep.innerHTML = `<span>${escapeHtml(page.label)} — ${page.pushes.length} push</span>`
      body.appendChild(sep)
      ;[...page.pushes].reverse().forEach((push, i) => {
        const raw = JSON.stringify(push, null, 2)
        if (pinnedRaws.has(raw)) return
        const node = makePushNode(push, page.pushes.length - 1 - i)
        node.dataset.historyPage = page.label
        body.appendChild(node)
      })
    }
  }

  // Empty state (no pins and no page pushes visible).
  const hasPushes = body.querySelector('.push')
  if (!hasPushes) {
    const p = document.createElement('p')
    p.className = 'muted small'
    p.textContent = 'Nessun push nel dataLayer di questa pagina.'
    body.appendChild(p)
  }

  // Update total count badge.
  if (countEl) {
    const total =
      searchScope === 'all'
        ? currentPushes.length + historyPages.reduce((s, pg) => s + pg.pushes.length, 0)
        : currentPushes.length
    countEl.textContent = total ? String(total) : ''
  }

  applyFilter()
}

// ── Pin helper ────────────────────────────────────────────────────────────────

/** Toggle the pin on a push card. Pins are stored by raw JSON so they survive
 *  page navigations — on the next renderDataLayer call they reappear at the top. */
function togglePin(card: HTMLElement) {
  const raw = card.dataset.raw ?? ''
  if (!raw) return
  if (pinnedRaws.has(raw)) {
    pinnedRaws.delete(raw)
  } else {
    pinnedRaws.add(raw)
  }
  saveSessionState()
  rebuildPushList()
}

// ── Filter helper ─────────────────────────────────────────────────────────────

/** Show/hide push cards matching filterText. Pinned cards are always visible.
 *  Also hides page-separators whose cards are all filtered out. */
function applyFilter() {
  const body = $('dl-modal-body')
  if (!body) return
  // Use .push (not :scope > .push) to be consistent with both current and
  // history cards, all of which are direct children of body.
  const cards = Array.from(body.querySelectorAll<HTMLElement>('.push'))
  let visible = 0
  for (const card of cards) {
    if (card.classList.contains('pinned')) { card.style.display = ''; visible++; continue }
    const matches =
      !filterText ||
      (card.dataset.ev ?? '').includes(filterText) ||
      (card.dataset.json ?? '').includes(filterText)
    card.style.display = matches ? '' : 'none'
    if (matches) visible++
  }
  // Hide page-separators that have no visible cards below them.
  const seps = Array.from(body.querySelectorAll<HTMLElement>('.page-separator'))
  for (const sep of seps) {
    if (!filterText) { sep.style.display = ''; continue }
    let sibling = sep.nextElementSibling as HTMLElement | null
    let hasVisible = false
    while (sibling && !sibling.classList.contains('page-separator')) {
      if (sibling.classList.contains('push') && sibling.style.display !== 'none') {
        hasVisible = true; break
      }
      sibling = sibling.nextElementSibling as HTMLElement | null
    }
    sep.style.display = hasVisible ? '' : 'none'
  }
  const countEl = $('dl-filter-count')
  if (countEl) {
    if (filterText) {
      countEl.textContent = `${visible} di ${cards.length}`
      countEl.style.display = ''
    } else {
      countEl.style.display = 'none'
    }
  }
}

function renderDataLayer(raw: string, name: string, timestamps?: (number | null)[]) {
  dataLayerName = name || 'dataLayer'
  const main = $('view-main')
  const view = $('view-dl')
  const title = $('dl-modal-title')
  if (!view || !main) return
  if (title) title.textContent = name || 'dataLayer'

  let pushes: unknown[] = []
  try {
    const parsed = JSON.parse(raw)
    pushes = Array.isArray(parsed) ? parsed : []
  } catch {
    pushes = []
  }

  // Archive the previous page before replacing currentPushes.
  // On popup reopen, currentPushes is already [] (moved to historyPages
  // by loadSessionState), so this branch is a no-op — no double-archiving.
  if (currentPushes.length > 0) {
    historyPages.unshift({
      label: currentPageLabel,
      url: pageUrl,
      pushes: [...currentPushes],
      ...(currentPushTimestamps.some((t) => t != null) ? { timestamps: [...currentPushTimestamps] } : {}),
    })
  }
  visitCounter++
  currentPageLabel = `Visita ${visitCounter}`
  currentPushes = [...pushes]  // oldest → newest
  // Real push-time timestamps from the page-world wrapper (see ensurePushWrapped
  // in datalayer-checker.inject.ts) when available; undefined for any push that
  // predates the wrapper attaching (kept consistent with the "_ts" field).
  currentPushTimestamps = pushes.map((_, i) => timestamps?.[i] ?? undefined)
  pushCounter = pushes.length

  // Reset the text filter but keep pins and scope intact.
  filterText = ''
  const filterInput = $('dl-filter-input') as HTMLInputElement | null
  if (filterInput) filterInput.value = ''
  const filterCount = $('dl-filter-count')
  if (filterCount) filterCount.style.display = 'none'

  saveSessionState()
  main.setAttribute('hidden', '')
  view.removeAttribute('hidden')
  rebuildPushList()
}

/** Append live pushes to the top of the list as they happen. */
function appendLivePush(raw: string, ts: number) {
  const body = $('dl-modal-body')
  const count = $('dl-count')
  if (!body || $('view-dl')?.hasAttribute('hidden')) return
  let entries: unknown[] = []
  try {
    const parsed = JSON.parse(raw)
    entries = Array.isArray(parsed) ? parsed : []
  } catch {
    return
  }
  body.querySelector('.muted')?.remove()
  for (const entry of entries) {
    currentPushes.push(entry)
    currentPushTimestamps.push(ts)   // captured in the page-world wrapper at the actual push instant
    const rawStr = JSON.stringify(entry, null, 2)
    if (!pinnedRaws.has(rawStr)) {
      const node = makePushNode(entry, pushCounter)
      node.classList.add('push-new')
      // Insert after pinned cards + separator so live pushes don't jump above pins.
      const sep = body.querySelector<HTMLElement>('.pin-separator')
      body.insertBefore(node, sep ? sep.nextSibling : body.firstChild)
      setTimeout(() => node.classList.remove('push-new'), 1200)
    }
    pushCounter++
  }
  if (count) count.textContent = String(pushCounter)
  saveSessionState()
  if (filterText) applyFilter()
}

/** Adds "_ts" (the real push-time timestamp, captured in the page-world wrapper —
 *  see ensurePushWrapped in datalayer-checker.inject.ts) to a push for export.
 *  Only for plain-object pushes with a known ts; everything else is returned
 *  untouched — no other field is ever added, renamed, or removed. */
function withExportTs(push: unknown, ts: number | undefined): unknown {
  if (ts == null || !push || typeof push !== 'object' || Array.isArray(push)) return push
  return { ...(push as Record<string, unknown>), _ts: ts }
}

/** Download all accumulated pushes as a JSON file — current page plus the full
 *  page-visit history, in chronological order (oldest visit first). Also merges
 *  in the always-on background log (DL_BG_PUSH, populated when "Monitoraggio
 *  avanzato per l'export" is on) for previous pages: `historyPages` is fed by
 *  live DATALAYER_PUSH messages that only reach this popup while it happens to
 *  be open, which has the exact same navigation-unload race DL_BG_PUSH had
 *  before its carryover-buffer fix — a push firing right before a click-driven
 *  navigation (e.g. select_item) can lose that race and never reach
 *  historyPages at all. bgLog is the channel proven to survive it, so any push
 *  it has that historyPages doesn't (deduped by url+content) is added in. */
async function exportDataLayer() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const tabId = tab?.id ?? null
  const bgLog = tabId != null ? await getBgDataLayer(tabId) : []

  const bgPrevEntries = bgLog.filter((e) => e.url !== pageUrl)
  const seenHistoryKeys = new Set(
    historyPages.flatMap((p) => p.pushes.map((push) => `${p.url ?? p.label}|${JSON.stringify(push)}`)),
  )
  const bgOnlyEntries = bgPrevEntries
    .filter((e) => !seenHistoryKeys.has(`${e.url}|${JSON.stringify(e.push)}`))
    .map((e) => {
      const withTs = withExportTs(e.push, e.ts)
      if (withTs && typeof withTs === 'object' && !Array.isArray(withTs)) {
        return { ...(withTs as Record<string, unknown>), _page: e.url }
      }
      return withTs
    })

  const ordered = [
    ...bgOnlyEntries,
    ...[...historyPages]
      .reverse()
      .flatMap((page) => page.pushes.map((push, i) => withExportTs(push, page.timestamps?.[i]))),
    ...currentPushes.map((push, i) => withExportTs(push, currentPushTimestamps[i])),
  ]
  if (ordered.length === 0) return
  const json = JSON.stringify(ordered, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${dataLayerName}-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function rememberView(view: 'dl' | 'main') {
  try {
    chrome.storage?.session?.set({ amd_popup_view: view })
  } catch {
    /* ignore */
  }
}

function bindDataLayer() {
  $('inspect-dl')?.addEventListener('click', () => {
    rememberView('dl')
    sendToActiveTab({ code: 'GET_DATALAYER' })
  })
  $('dl-back')?.addEventListener('click', () => {
    stopLiveIfOn()
    rememberView('main')
    $('view-dl')?.setAttribute('hidden', '')
    $('view-main')?.removeAttribute('hidden')
  })
  $('dl-export')?.addEventListener('click', () => void exportDataLayer())
  $('gtm-export')?.addEventListener('click', () => void exportGtmInfo())

  const filterInput = $('dl-filter-input') as HTMLInputElement | null
  filterInput?.addEventListener('input', () => {
    filterText = (filterInput.value ?? '').toLowerCase().trim()
    applyFilter()
  })

  // Scope toggle: "Pagina" (current page only) vs "Storico" (all history).
  function setScopeActive(scope: 'page' | 'all') {
    searchScope = scope
    $('scope-page')?.classList.toggle('scope-active', scope === 'page')
    $('scope-all')?.classList.toggle('scope-active', scope === 'all')
    rebuildPushList()
  }
  $('scope-page')?.addEventListener('click', () => setScopeActive('page'))
  $('scope-all')?.addEventListener('click', () => setScopeActive('all'))

  const liveBox = $('dl-live') as HTMLInputElement | null
  liveBox?.addEventListener('change', () => {
    if (liveBox.checked) sendToActiveTab({ code: 'START_DL_LIVE' })
    else sendToActiveTab({ code: 'STOP_DL_LIVE' })
  })

  chrome.runtime.onMessage.addListener((msg: PageMsg) => {
    if (msg.code === 'LIST_GTM_ID' && msg.data?.ids) {
      pageUrl = msg.data.url ?? pageUrl
      pageOrigin = msg.data.origin ?? pageOrigin
      renderContainers(msg.data.ids)
    }
    if (msg.code === 'TABLE_DATALAYER' && msg.data)
      renderDataLayer(msg.data.dataLayer ?? '[]', msg.data.dataLayerName ?? 'dataLayer', msg.data.timestamps)
    if (msg.code === 'DATALAYER_PUSH' && msg.data)
      appendLivePush(msg.data.dataLayer ?? '[]', msg.data.ts ?? Date.now())
  })

  // Ask the active tab for its containers on open.
  sendToActiveTab({ code: 'GET_GTM_ID' })

  // Reopen the dataLayer view if that's where the user left off.
  // If we restored session state, show the cached view immediately (fast), then
  // also request a fresh snapshot — renderDataLayer will update it when it arrives.
  try {
    chrome.storage?.session?.get('amd_popup_view', (r) => {
      if (r?.amd_popup_view !== 'dl') return
      const hasCache = currentPushes.length > 0 || historyPages.length > 0 || pinnedRaws.size > 0
      if (hasCache) {
        const main = $('view-main')
        const view = $('view-dl')
        const title = $('dl-modal-title')
        if (main && view) {
          if (title) title.textContent = dataLayerName
          main.setAttribute('hidden', '')
          view.removeAttribute('hidden')
          rebuildPushList()
        }
      }
      sendToActiveTab({ code: 'GET_DATALAYER' })
    })
  } catch {
    /* ignore */
  }
}

function stopLiveIfOn() {
  const liveBox = $('dl-live') as HTMLInputElement | null
  if (liveBox?.checked) {
    liveBox.checked = false
    sendToActiveTab({ code: 'STOP_DL_LIVE' })
  }
}

/* ---------- manual GTM injection ---------- */

/** Convert a glob-style pattern to a RegExp string.
 *  Supports: * (any chars), ? (single char). Matches against the full URL. */
function patternToRegExp(pattern: string): string {
  const escaped = pattern
    .trim()
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape regex special chars (except * and ?)
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return escaped
}

function renderInjList(injections: GtmManualInjection[]) {
  const list = $('inj-list')
  if (!list) return
  list.innerHTML = ''
  if (injections.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'inj-empty'
    empty.textContent = 'Nessuna regola configurata'
    list.appendChild(empty)
    return
  }
  for (const inj of injections) {
    const item = document.createElement('div')
    item.className = 'inj-list-item'
    item.dataset.id = inj.id

    const info = document.createElement('div')
    info.className = 'inj-item-info'
    const gtmSpan = document.createElement('div')
    gtmSpan.className = 'inj-item-gtm'
    gtmSpan.textContent = inj.gtmId
    const patSpan = document.createElement('div')
    patSpan.className = 'inj-item-pattern'
    patSpan.textContent = inj.pattern
    patSpan.title = inj.pattern
    info.appendChild(gtmSpan)
    info.appendChild(patSpan)

    const toggleLabel = document.createElement('label')
    toggleLabel.className = 'inj-toggle'
    const toggleInput = document.createElement('input')
    toggleInput.type = 'checkbox'
    toggleInput.checked = inj.enabled
    const track = document.createElement('span')
    track.className = 'inj-toggle-track'
    toggleLabel.appendChild(toggleInput)
    toggleLabel.appendChild(track)
    toggleInput.addEventListener('change', async () => {
      const all = (await storage.get('gtm_manual_injections')) ?? []
      const idx = all.findIndex((x) => x.id === inj.id)
      if (idx >= 0) { all[idx].enabled = toggleInput.checked; await storage.set({ gtm_manual_injections: all }) }
    })

    const delBtn = document.createElement('button')
    delBtn.className = 'inj-del'
    delBtn.title = 'Elimina'
    delBtn.textContent = '×'
    delBtn.addEventListener('click', async () => {
      const all = (await storage.get('gtm_manual_injections')) ?? []
      await storage.set({ gtm_manual_injections: all.filter((x) => x.id !== inj.id) })
      item.remove()
      const remaining = list.querySelectorAll('.inj-list-item')
      if (remaining.length === 0) renderInjList([])
    })

    item.appendChild(info)
    item.appendChild(toggleLabel)
    item.appendChild(delBtn)
    list.appendChild(item)
  }
}

async function bindInjection() {
  const injections = (await storage.get('gtm_manual_injections')) ?? []
  renderInjList(injections)

  $('inj-add')?.addEventListener('click', async () => {
    const gtmInput = $('inj-gtm-id') as HTMLInputElement | null
    const patInput = $('inj-pattern') as HTMLInputElement | null
    if (!gtmInput || !patInput) return

    const gtmId = gtmInput.value.trim().toUpperCase()
    const pattern = patInput.value.trim()
    if (!gtmId.match(/^GTM-[A-Z0-9]+$/) || !pattern) {
      gtmInput.style.borderColor = gtmId.match(/^GTM-[A-Z0-9]+$/) ? '' : '#c5221f'
      patInput.style.borderColor = pattern ? '' : '#c5221f'
      return
    }
    gtmInput.style.borderColor = ''
    patInput.style.borderColor = ''

    const newEntry: GtmManualInjection = {
      id: String(Date.now()),
      gtmId,
      pattern,
      regExp: patternToRegExp(pattern),
      enabled: true,
    }
    const all = (await storage.get('gtm_manual_injections')) ?? []
    all.push(newEntry)
    await storage.set({ gtm_manual_injections: all })
    gtmInput.value = ''
    patInput.value = ''
    renderInjList(all)
  })
}

/* ---------- init ---------- */
async function init() {
  // Load persisted session state first so pins and history are ready before
  // bindDataLayer sets up listeners and potentially triggers renderDataLayer.
  await loadSessionState()
  await bindToggle('qol_changes')
  await bindToggle('block_page_change')
  await bindToggle('dl_bg_capture')
  await bindToggle('multi_page_capture')
  bindSettings()
  bindDataLayer()
  await bindInjection()
}
void init()
