// Decodes the `gcs` (Google Consent State) query parameter, present on Google
// Measurement Protocol / Ads pings whenever Consent Mode is configured.
// Format: G + one char per consent type (1=granted, 0=denied).
// Order: ad_storage, analytics_storage, ad_user_data, ad_personalization.
export const GCS_LABELS = ['ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization']

export interface ConsentSignal {
  name: string
  state: 'ok' | 'no' | 'unk'
}

export function decodeGcs(gcs: string): ConsentSignal[] | null {
  const m = gcs.match(/^[Gg](\d*)$/)
  if (!m) return null
  const flags = m[1]
  if (!flags.length) return null
  return GCS_LABELS.slice(0, flags.length).map((name, i) => ({
    name,
    state: flags[i] === '1' ? 'ok' : flags[i] === '0' ? 'no' : 'unk',
  }))
}

/** Maps a `gcs` value to a `{ad_storage, analytics_storage, ad_user_data, ad_personalization}`
 *  record of "granted"/"denied" — omits any type whose state is 'unk' or absent.
 *  Returns null if `gcs` doesn't decode to any signal. */
export function gcsToConsentState(gcs: string): Record<string, 'granted' | 'denied'> | null {
  const signals = decodeGcs(gcs)
  if (!signals) return null
  const out: Record<string, 'granted' | 'denied'> = {}
  for (const s of signals) {
    if (s.state === 'ok') out[s.name] = 'granted'
    else if (s.state === 'no') out[s.name] = 'denied'
  }
  return Object.keys(out).length > 0 ? out : null
}

// --- CMP consent cookie parsing ---------------------------------------------
// Best-effort recognition of the moment a user made a real consent choice
// (beyond whatever a CMP grants by default, e.g. strictly-necessary cookies),
// read directly from each CMP's own consent cookie. Conservative by design:
// a rule only returns a non-null result when its format is unambiguous —
// it never fabricates a timestamp it isn't reasonably sure about.

export interface CmpConsentResult {
  cmp: string
  ts: number | null
  hasRealConsent: boolean
  /** Non-essential category name (the CMP's own naming, or raw group code for
   *  OneTrust) → granted/denied, when the parser could determine it. Absent
   *  when the CMP's cookie format doesn't expose per-category state. */
  categories?: Record<string, boolean>
}

function tryDecode(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function base64UrlDecode(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    return atob(b64 + pad)
  } catch {
    return null
  }
}

/** OneTrust `OptanonConsent` cookie. Real format (URL-encoded):
 *  `...&datestamp=<Date string>&groups=C0001:1,C0002:1,...` (colon-paired) or,
 *  on some templates, a bare comma list of active groups (`,C0001,C0002,`).
 *  Handles both: any entry without a `:flag` is treated as granted. */
function parseOneTrust(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  const dsMatch = value.match(/datestamp=([^&]+)/)
  const groupsMatch = value.match(/groups=([^&]+)/)
  if (!dsMatch && !groupsMatch) return null

  let ts: number | null = null
  if (dsMatch) {
    const parsed = new Date(dsMatch[1]).getTime()
    ts = Number.isNaN(parsed) ? null : parsed
  }

  let hasRealConsent = false
  const categories: Record<string, boolean> = {}
  if (groupsMatch) {
    for (const entry of groupsMatch[1].split(',')) {
      const [code, flag] = entry.split(':')
      if (!code) continue
      const granted = flag === undefined || flag === '1'
      categories[code] = granted
      if (code !== 'C0001' && granted) hasRealConsent = true
    }
  }
  return { ts, hasRealConsent, ...(Object.keys(categories).length ? { categories } : {}) }
}

/** Cookiebot `CookieConsent` cookie. Real format (URL-encoded, JS-object-literal
 *  style, not JSON): `{stamp:'...',necessary:true,preferences:true,statistics:true,
 *  marketing:true,method:'explicit',ver:1,utc:1700000000,region:'it'}`. `utc` is
 *  unix seconds at the moment of the choice. */
function parseCookiebot(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  const utcMatch = value.match(/utc:(\d+)/)
  const categories: Record<string, boolean> = {}
  for (const k of ['necessary', 'preferences', 'statistics', 'marketing']) {
    const m = value.match(new RegExp(`${k}:(true|false)`))
    if (m) categories[k] = m[1] === 'true'
  }
  const hasRealConsent = ['preferences', 'statistics', 'marketing'].some((k) => categories[k])
  if (!utcMatch && !hasRealConsent) return null
  const utc = utcMatch ? Number(utcMatch[1]) : NaN
  return {
    ts: Number.isNaN(utc) ? null : utc * 1000,
    hasRealConsent,
    ...(Object.keys(categories).length ? { categories } : {}),
  }
}

/** iubenda `_iub_cs-*` cookie. Real format: proper JSON —
 *  `{"timestamp":"2026-06-17T08:23:45.000Z","purposes":{"1":true,"4":true,...}}`.
 *  Purpose "1" is strictly-necessary and granted by default; any other purpose
 *  set to true indicates a real choice. */
function parseIubenda(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  let obj: unknown
  try {
    obj = JSON.parse(value)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const tsStr = rec.timestamp
  const parsed = typeof tsStr === 'string' ? Date.parse(tsStr) : NaN
  const ts = Number.isNaN(parsed) ? null : parsed
  const purposes = rec.purposes
  let hasRealConsent = false
  if (purposes && typeof purposes === 'object') {
    hasRealConsent = Object.entries(purposes as Record<string, unknown>).some(
      ([k, v]) => k !== '1' && v === true,
    )
  }
  if (ts == null && !hasRealConsent) return null
  return { ts, hasRealConsent }
}

/** CookieYes `cookieyes-consent` cookie. Real format: comma-separated
 *  `key:value` pairs — `consentid:...,consent:yes,necessary:yes,functional:no,
 *  analytics:no,...,lastRenewedDate:2026-06-17T08:23:45.123Z`. Not every
 *  install includes `lastRenewedDate`; ts is null when absent. */
function parseCookieYes(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  const fields: Record<string, string> = {}
  for (const part of value.split(',')) {
    const [k, v] = part.split(':')
    if (k) fields[k.trim()] = (v ?? '').trim()
  }
  if (!('consent' in fields) && !('necessary' in fields)) return null
  const categories: Record<string, boolean> = {}
  for (const k of ['necessary', 'functional', 'analytics', 'performance', 'advertisement', 'other']) {
    if (k in fields) categories[k] = fields[k] === 'yes'
  }
  const hasRealConsent = ['functional', 'analytics', 'performance', 'advertisement', 'other'].some(
    (k) => categories[k],
  )
  const dateField = fields.lastRenewedDate ?? fields.lastRenewed ?? fields.date
  const parsed = dateField ? Date.parse(dateField) : NaN
  return {
    ts: Number.isNaN(parsed) ? null : parsed,
    hasRealConsent,
    ...(Object.keys(categories).length ? { categories } : {}),
  }
}

/** Axeptio `axeptio_cookies` / `axeptio_authorized_vendors` cookie. Real format:
 *  JSON with a `$$date` ISO timestamp of the choice plus per-vendor/category
 *  booleans, e.g. `{"$$date":"2026-06-17T08:23:45.123Z","necessary_cookies":true,
 *  "google_analytics":true}`. */
function parseAxeptio(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  let obj: unknown
  try {
    obj = JSON.parse(value)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const dateStr = rec['$$date']
  const parsed = typeof dateStr === 'string' ? Date.parse(dateStr) : NaN
  const categories: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (!k.startsWith('$$') && typeof v === 'boolean') categories[k] = v
  }
  const hasRealConsent = Object.entries(categories).some(([k, v]) => k !== 'necessary_cookies' && v)
  if (Number.isNaN(parsed) && !hasRealConsent) return null
  return {
    ts: Number.isNaN(parsed) ? null : parsed,
    hasRealConsent,
    ...(Object.keys(categories).length ? { categories } : {}),
  }
}

/** Didomi `didomi_token` cookie. A JWT — decodes the payload (no signature
 *  verification needed, we only read claims) looking for an `updated`/`iat`
 *  unix-seconds timestamp and a purposes/vendors consent-status map. Many
 *  Didomi setups keep the actual consent vector server-side or in
 *  `euconsent-v2` (binary IAB TCF, not decoded here) — this often yields
 *  no usable signal, which is expected and not treated as an error. */
function parseDidomiToken(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const parts = raw.split('.')
  if (parts.length < 2) return null
  const decoded = base64UrlDecode(parts[1])
  if (!decoded) return null
  let payload: unknown
  try {
    payload = JSON.parse(decoded)
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const rec = payload as Record<string, unknown>
  const updated = rec.updated ?? rec.iat
  const ts = typeof updated === 'number' ? updated * 1000 : null

  let hasRealConsent = false
  for (const key of ['purposes_consent_status', 'vendors_consent_status', 'purposes_li_status']) {
    const map = rec[key]
    if (map && typeof map === 'object' && Object.values(map as Record<string, unknown>).some((v) => v === true)) {
      hasRealConsent = true
      break
    }
  }
  if (ts == null && !hasRealConsent) return null
  return { ts, hasRealConsent }
}

/** Klaro's cookie name is configurable (commonly `klaro`). Value is a JSON map
 *  of service name → boolean. Klaro does not embed a timestamp by default, so
 *  this can only ever report `hasRealConsent`, never `ts`. */
function parseKlaro(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  let obj: unknown
  try {
    obj = JSON.parse(value)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const hasRealConsent = Object.entries(obj as Record<string, unknown>).some(
    ([k, v]) => k !== 'essential' && v === true,
  )
  if (!hasRealConsent) return null
  return { ts: null, hasRealConsent: true }
}

/** TrustArc's consent cookies (`notice_preferences`, `notice_gdpr_prefs`,
 *  `notice_behavior`) use a terse positional format that varies by deployment
 *  and that we don't have a confirmed spec for. Detected for CMP identification
 *  only — deliberately never reports a ts or hasRealConsent to avoid fabricating
 *  a signal we can't verify. */
function parseTrustArc(_raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  return null
}

/** Usercentrics. NOT VERIFIED against a live cookie (Usercentrics v2 keeps the
 *  authoritative consent vector in localStorage, not always in a cookie) — this
 *  is a best-effort parser for the cases where a cookie (`usercentrics_consent_status`,
 *  `uc_settings`, `uc_user_interaction`) does carry a JSON or base64-JSON payload
 *  with a timestamp-like field (`timestamp`/`updatedAt`/`consentDate`) and a
 *  `consents`/`services` map. Returns null on any format it doesn't recognise
 *  rather than guessing. */
function parseUsercentrics(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  let obj: unknown
  try {
    obj = JSON.parse(value)
  } catch {
    const decoded = base64UrlDecode(value)
    if (!decoded) return null
    try {
      obj = JSON.parse(decoded)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const tsField = rec.timestamp ?? rec.updatedAt ?? rec.consentDate
  const parsed = typeof tsField === 'string' ? Date.parse(tsField) : typeof tsField === 'number' ? tsField : NaN
  const ts = Number.isNaN(parsed) ? null : parsed
  let hasRealConsent = false
  for (const key of ['consents', 'services']) {
    const map = rec[key]
    if (map && typeof map === 'object') {
      hasRealConsent = Object.values(map as Record<string, unknown>).some((v) => v === true)
      if (hasRealConsent) break
    }
  }
  if (ts == null && !hasRealConsent) return null
  return { ts, hasRealConsent }
}

/** Complianz. Real format: one cookie PER category (`cmplz_marketing`,
 *  `cmplz_statistics`, `cmplz_statistics-anonymous`, `cmplz_preferences`,
 *  `cmplz_functional`), each holding a bare `allow`/`deny` value — no embedded
 *  timestamp in any documented version, so `ts` is always null here (the
 *  observed-write tier, not this snapshot parser, supplies timing for
 *  Complianz). Newer installs may also set `cmplz_consent_status` as a JSON
 *  map of category → allow/deny, handled the same way. */
function parseComplianz(raw: string, name: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw).trim()
  if (value === 'allow' || value === 'deny') {
    // One cookie per category (cmplz_marketing, cmplz_statistics, ...) — the
    // category name is the cookie name itself, not present in the value.
    const category = name.replace(/^cmplz_/i, '')
    return { ts: null, hasRealConsent: value === 'allow', categories: { [category]: value === 'allow' } }
  }
  try {
    const obj = JSON.parse(value)
    if (!obj || typeof obj !== 'object') return null
    const categories: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === 'allow' || v === 'deny') categories[k] = v === 'allow'
      else if (typeof v === 'boolean') categories[k] = v
    }
    const hasRealConsent = Object.values(categories).some((v) => v)
    return { ts: null, hasRealConsent, ...(Object.keys(categories).length ? { categories } : {}) }
  } catch {
    return null
  }
}

/** Cookie-Script. NOT VERIFIED against a live cookie. Real format is reported
 *  (publicly documented examples) as JSON: `{"action":"accept","categories":
 *  "[\"necessary\",\"analytics\"]",...}`, with `action` one of
 *  `accept`/`reject`/`manage`. `categories` is itself a JSON-encoded string in
 *  observed examples, not a native array — parsed defensively. No confirmed
 *  timestamp field across versions, so `ts` is left null. */
function parseCookieScript(raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  const value = tryDecode(raw)
  let obj: unknown
  try {
    obj = JSON.parse(value)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const rec = obj as Record<string, unknown>
  const action = rec.action
  if (typeof action !== 'string') return null
  let hasRealConsent = action === 'accept'
  if (!hasRealConsent && typeof rec.categories === 'string') {
    try {
      const cats = JSON.parse(rec.categories) as unknown
      if (Array.isArray(cats)) hasRealConsent = cats.some((c) => c !== 'necessary')
    } catch {
      /* categories not parseable — fall back to action only */
    }
  }
  return { ts: null, hasRealConsent }
}

/** Generic IAB TCF v2 `euconsent-v2` cookie — the binary-packed Transparency &
 *  Consent string. Decoding the full bitfield is out of scope (and risky to
 *  get subtly wrong); this rule exists only so the cookie-write registry
 *  recognises the name and tags the CMP as "TCF" for identification. Real
 *  timing for TCF-based CMPs comes from the `__tcfapi` `useractioncomplete`
 *  event (see datalayer-checker.inject.ts), not from decoding this cookie —
 *  same conservative stance as parseTrustArc. */
function parseEuConsentV2(_raw: string): Omit<CmpConsentResult, 'cmp'> | null {
  return null
}

// --- OneTrust active-groups ground truth -----------------------------------
// `OnetrustActiveGroups` / `OptanonActiveGroups` is OneTrust's own record of
// which consent groups are actually active right now — independent of
// whatever a (possibly misconfigured) gtag consent push reports. Used to
// build a ground-truth GCM-style signal map and an unambiguous accept/reject
// decision, for sites where the gtag wiring doesn't faithfully reflect the
// real banner choice (e.g. analytics_storage still reported "granted" after
// a reject-all click).

export const ONETRUST_ACTIVE_GROUPS_COOKIE_RE = /^(OnetrustActiveGroups|OptanonActiveGroups)$/i

/** Real format: a comma-separated list of group codes, typically wrapped in
 *  leading/trailing commas, e.g. `,C0001,C0002,C0004,`. Returns null if no
 *  group code is found (cookie absent or unrecognised format). */
export function parseOneTrustActiveGroups(value: string): string[] | null {
  const decoded = tryDecode(value)
  const groups = decoded
    .split(',')
    .map((g) => g.trim())
    .filter((g) => /^C\d+$/i.test(g))
  return groups.length > 0 ? groups : null
}

export type OneTrustConsentDecision = 'acceptAll' | 'rejectAll' | 'partial' | 'noChoice'

/** Default OneTrust 4-group template: C0001 strictly necessary, C0002
 *  performance, C0003 functional, C0004 targeting/advertising. Sites with
 *  custom groups beyond these 4 may be reported as 'partial' even when the
 *  user accepted everything available on that site — best-effort. */
const ONETRUST_DEFAULT_NON_ESSENTIAL = ['C0002', 'C0003', 'C0004']

export function oneTrustConsentDecision(groups: string[] | null): OneTrustConsentDecision {
  if (!groups || groups.length === 0) return 'noChoice'
  const active = new Set(groups.map((g) => g.toUpperCase()))
  const nonEssential = [...active].filter((g) => g !== 'C0001')
  if (nonEssential.length === 0) return 'rejectAll'
  const hasAll = ONETRUST_DEFAULT_NON_ESSENTIAL.every((g) => active.has(g))
  return hasAll ? 'acceptAll' : 'partial'
}

/** Maps each OneTrust group to the GCM-style signal(s) it governs. C0001 is
 *  always granted (strictly necessary, never gated behind user choice). */
export const ONETRUST_GROUP_SIGNAL_MAP: Record<string, string[]> = {
  C0001: ['security_storage'],
  C0002: ['analytics_storage'],
  C0003: ['functionality_storage', 'personalization_storage'],
  C0004: ['ad_storage', 'ad_user_data', 'ad_personalization'],
}

/** Builds a GCM-style granted/denied signal map from OneTrust's actual active
 *  groups — ground truth for consentTimeline.afterChoice. */
export function oneTrustGroupsToConsentState(groups: string[]): Record<string, 'granted' | 'denied'> {
  const active = new Set(groups.map((g) => g.toUpperCase()))
  const out: Record<string, 'granted' | 'denied'> = {}
  for (const [group, signals] of Object.entries(ONETRUST_GROUP_SIGNAL_MAP)) {
    const granted = group === 'C0001' || active.has(group)
    for (const signal of signals) out[signal] = granted ? 'granted' : 'denied'
  }
  return out
}

/** Fallback source for OneTrust active groups when the dedicated
 *  `OnetrustActiveGroups`/`OptanonActiveGroups` cookie (see
 *  ONETRUST_ACTIVE_GROUPS_COOKIE_RE above) isn't set — confirmed via live
 *  testing (viviennewestwood.com) that this is the common case, not an edge
 *  case: that cookie is tied to a less common OneTrust feature, while every
 *  OneTrust deployment sets `OptanonConsent`, whose own `groups=` parameter
 *  (same `C0001:1,C0002:0,...` format) already carries the same information.
 *  Returns null when `interactionCount` is 0 or absent — that state is
 *  OneTrust's pre-choice default, not a real user decision, and must not be
 *  read as one. */
export function parseOneTrustGroupsFromOptanonConsent(value: string): string[] | null {
  const decoded = tryDecode(value)
  const interactionMatch = decoded.match(/interactionCount=(\d+)/)
  const interactionCount = interactionMatch ? Number(interactionMatch[1]) : 0
  if (interactionCount < 1) return null
  const groupsMatch = decoded.match(/groups=([^&]+)/)
  if (!groupsMatch) return null
  const active: string[] = []
  for (const entry of groupsMatch[1].split(',')) {
    const [code, flag] = entry.split(':')
    if (!code) continue
    if (flag === undefined || flag === '1') active.push(code)
  }
  return active.length > 0 ? active : null
}

interface CmpCookieRule {
  cmp: string
  cookieName: RegExp
  parse: (value: string, name: string) => Omit<CmpConsentResult, 'cmp'> | null
}

const CMP_COOKIE_RULES: CmpCookieRule[] = [
  { cmp: 'OneTrust', cookieName: /^OptanonConsent$/i, parse: parseOneTrust },
  { cmp: 'Cookiebot', cookieName: /^CookieConsent$/i, parse: parseCookiebot },
  { cmp: 'iubenda', cookieName: /^_iub_cs-/i, parse: parseIubenda },
  { cmp: 'CookieYes', cookieName: /^cookieyes-consent$/i, parse: parseCookieYes },
  { cmp: 'Axeptio', cookieName: /^axeptio_(cookies|authorized_vendors)$/i, parse: parseAxeptio },
  { cmp: 'Didomi', cookieName: /^didomi_token$/i, parse: parseDidomiToken },
  { cmp: 'Klaro', cookieName: /^klaro(-.*)?$/i, parse: parseKlaro },
  { cmp: 'TrustArc', cookieName: /^(notice_preferences|notice_gdpr_prefs|notice_behavior)$/i, parse: parseTrustArc },
  {
    cmp: 'Usercentrics',
    cookieName: /^(usercentrics_consent_status|uc_settings|uc_user_interaction)$/i,
    parse: parseUsercentrics,
  },
  {
    cmp: 'Complianz',
    cookieName: /^cmplz_(consent_status|marketing|statistics(-anonymous)?|preferences|functional)$/i,
    parse: parseComplianz,
  },
  { cmp: 'Cookie-Script', cookieName: /^CookieScriptConsent$/i, parse: parseCookieScript },
  { cmp: 'TCF', cookieName: /^euconsent-v2$/i, parse: parseEuConsentV2 },
]

/** Combined regex of every cookie name this module recognises as a CMP
 *  consent cookie — used by background.ts as a cheap pre-filter on
 *  `chrome.cookies.onChanged` (which fires for every cookie write in the
 *  browser) before running the heavier per-CMP `parseCmpCookie` parse. */
export const CMP_COOKIE_NAME_RE = new RegExp(
  CMP_COOKIE_RULES.map((r) => r.cookieName.source).join('|'),
  'i',
)

/** Tries every known CMP cookie rule against a single cookie name/value pair.
 *  Returns null if the cookie doesn't match any known CMP or doesn't parse. */
export function parseCmpCookie(name: string, value: string): CmpConsentResult | null {
  for (const rule of CMP_COOKIE_RULES) {
    if (!rule.cookieName.test(name)) continue
    const result = rule.parse(value, name)
    if (!result) return null
    return { cmp: rule.cmp, ...result }
  }
  return null
}

// --- CMP-agnostic consent decision & signal mapping -------------------------
// OneTrust gets a dedicated ground-truth path (oneTrustConsentDecision /
// oneTrustGroupsToConsentState above) because its active-groups cookie is a
// direct record of what the CMP actually turned on. For every other CMP we
// only have the per-category booleans recovered by the parsers above
// (categories field on CmpConsentResult) — present for Cookiebot, CookieYes,
// Axeptio and Complianz, where the cookie format exposes one boolean per
// category; absent for iubenda (numeric purpose IDs, no name registry),
// Klaro and Didomi (no stable category-name convention to key off), so those
// three can only ever resolve to a binary accept/reject via hasRealConsent.

/** Category keys that are "strictly necessary" for each CMP — i.e. always
 *  granted regardless of user choice — and therefore excluded when deciding
 *  accept/reject/partial. Complianz has none: its necessary cookies aren't
 *  represented by a `cmplz_*` consent cookie at all, so every category key we
 *  do see is already non-essential. */
const CMP_ESSENTIAL_CATEGORY_KEYS: Record<string, Set<string>> = {
  Cookiebot: new Set(['necessary']),
  CookieYes: new Set(['necessary']),
  Axeptio: new Set(['necessary_cookies']),
  Complianz: new Set(),
}

/** Generic acceptAll/rejectAll/partial/noChoice decision from a per-category
 *  granted/denied map. `noChoice` when every category is essential (i.e. we
 *  observed no non-essential category at all — not the same as "all denied"). */
export function categoriesToDecision(
  categories: Record<string, boolean>,
  essentialKeys: Set<string>,
): OneTrustConsentDecision {
  const nonEssential = Object.entries(categories).filter(([k]) => !essentialKeys.has(k))
  if (nonEssential.length === 0) return 'noChoice'
  const grantedCount = nonEssential.filter(([, v]) => v).length
  if (grantedCount === 0) return 'rejectAll'
  if (grantedCount === nonEssential.length) return 'acceptAll'
  return 'partial'
}

/** CMP-agnostic fallback for `consentDecision`, used whenever OneTrust's own
 *  ground-truth groups aren't available (non-OneTrust site, or OneTrust
 *  cookie present but unparseable). Merges every result for the same CMP
 *  (Complianz spreads one category per cookie across several cookies) before
 *  deciding, then prefers the first CMP with category-level data; falls back
 *  to a plain accept/reject from `hasRealConsent` when no parser for the
 *  detected CMP(s) exposes categories (iubenda, Klaro, Didomi). */
export function genericConsentDecision(results: CmpConsentResult[]): OneTrustConsentDecision {
  if (results.length === 0) return 'noChoice'
  const byCmp = new Map<string, { categories: Record<string, boolean>; hasRealConsent: boolean }>()
  for (const r of results) {
    const entry = byCmp.get(r.cmp) ?? { categories: {}, hasRealConsent: false }
    if (r.categories) Object.assign(entry.categories, r.categories)
    entry.hasRealConsent = entry.hasRealConsent || r.hasRealConsent
    byCmp.set(r.cmp, entry)
  }
  for (const [cmp, entry] of byCmp) {
    if (Object.keys(entry.categories).length === 0) continue
    const decision = categoriesToDecision(entry.categories, CMP_ESSENTIAL_CATEGORY_KEYS[cmp] ?? new Set())
    if (decision !== 'noChoice') return decision
  }
  const anyReal = results.some((r) => r.hasRealConsent)
  return anyReal ? 'acceptAll' : 'rejectAll'
}

/** Maps each CMP's own category keys to the GCM-style signals they govern —
 *  same idea as ONETRUST_GROUP_SIGNAL_MAP, extended to the CMPs whose cookie
 *  format exposes per-category booleans. Best-effort: categories beyond this
 *  4-bucket Consent Mode model (e.g. Axeptio's per-vendor flags) are simply
 *  not mapped to a signal. */
const CMP_CATEGORY_SIGNAL_MAP: Record<string, Record<string, string[]>> = {
  Cookiebot: {
    necessary: ['security_storage'],
    preferences: ['functionality_storage', 'personalization_storage'],
    statistics: ['analytics_storage'],
    marketing: ['ad_storage', 'ad_user_data', 'ad_personalization'],
  },
  CookieYes: {
    necessary: ['security_storage'],
    functional: ['functionality_storage', 'personalization_storage'],
    analytics: ['analytics_storage'],
    performance: ['analytics_storage'],
    advertisement: ['ad_storage', 'ad_user_data', 'ad_personalization'],
  },
  Axeptio: {
    necessary_cookies: ['security_storage'],
  },
  Complianz: {
    functional: ['functionality_storage', 'personalization_storage'],
    preferences: ['functionality_storage', 'personalization_storage'],
    statistics: ['analytics_storage'],
    'statistics-anonymous': ['analytics_storage'],
    marketing: ['ad_storage', 'ad_user_data', 'ad_personalization'],
  },
}

/** Builds a GCM-style granted/denied signal map from a CMP's own categories —
 *  the non-OneTrust counterpart of oneTrustGroupsToConsentState. Returns null
 *  when the CMP has no entry in CMP_CATEGORY_SIGNAL_MAP (iubenda, Klaro,
 *  Didomi, Axeptio-only-vendor-flags) or none of its categories map to a
 *  known signal. A signal granted by any mapped category wins over a denial
 *  from another (mirrors the union semantics of oneTrustGroupsToConsentState). */
export function categoriesToConsentState(
  cmp: string,
  categories: Record<string, boolean>,
): Record<string, 'granted' | 'denied'> | null {
  const map = CMP_CATEGORY_SIGNAL_MAP[cmp]
  if (!map) return null
  const out: Record<string, 'granted' | 'denied'> = {}
  for (const [cat, granted] of Object.entries(categories)) {
    const signals = map[cat]
    if (!signals) continue
    for (const signal of signals) {
      if (granted) out[signal] = 'granted'
      else if (out[signal] !== 'granted') out[signal] = 'denied'
    }
  }
  return Object.keys(out).length > 0 ? out : null
}
