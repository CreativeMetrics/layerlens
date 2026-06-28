/** Pure, dependency-free lints layered on top of the popup's GTM/dataLayer
 *  extraction. No DOM/chrome access, so this file is unit-testable on its own —
 *  see the self-check at the bottom (`npx tsx src/lib/datalayer-lints.ts`). */

const PII_KEYS = new Set([
  'email', 'e_mail', 'phone', 'telephone', 'first_name', 'last_name', 'full_name',
  'address1', 'address2', 'street_address', 'address', 'zip', 'postal_code',
  'codice_fiscale', 'fiscal_code', 'iban', 'ssn',
])

/** Dotted paths of keys that look like PII and hold a non-empty string value.
 *  Matches on exact key name (not substring) so `item_name` doesn't false-positive
 *  on "name". */
export function findPossiblePII(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return []
  const hits: string[] = []
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k
    if (PII_KEYS.has(k.toLowerCase()) && typeof v === 'string' && v.trim() !== '') hits.push(p)
    if (v && typeof v === 'object') hits.push(...findPossiblePII(v, p))
  }
  return hits
}

/** Keys present both at the push's root and inside `ecommerce` — the duplication
 *  pattern GA4 Gold Standard audits flag (these params should live in `ecommerce`
 *  only, not be repeated at the top level). */
export function findDuplicateRootKeys(push: unknown): string[] {
  if (!push || typeof push !== 'object') return []
  const rec = push as Record<string, unknown>
  const ecommerce = rec.ecommerce
  if (!ecommerce || typeof ecommerce !== 'object') return []
  const ecomKeys = new Set(Object.keys(ecommerce as Record<string, unknown>))
  return Object.keys(rec).filter((k) => k !== 'ecommerce' && ecomKeys.has(k))
}

// --- GA4 multiple-config / send_page_view ordering -------------------------

const INIT_EVENTS = new Set(['gtm.init', 'gtm.init_consent'])
const PAGE_LOAD_EVENTS = new Set(['gtm.js', 'gtm.dom', 'gtm.load'])

/** GTM fires Initialization triggers before Page View/DOM/Window triggers, which
 *  in turn fire before Custom Event triggers. Lower number = fires earlier.
 *  Unknown (non-`_eq` or multi-predicate) triggers are treated as mid-priority —
 *  conservative, since we can't be sure but most non-init custom setups land there. */
function eventPriority(eventName: string | undefined): number {
  if (eventName == null) return 1
  if (INIT_EVENTS.has(eventName)) return 0
  if (PAGE_LOAD_EVENTS.has(eventName)) return 1
  return 2
}

interface ResolvedTag {
  index: number
  function?: unknown
  resolved?: Record<string, unknown>
  vtp_configSettingsTable?: unknown
  vtp_configSettingsVariable?: unknown
}
interface ResolvedPredicate {
  index: number
  function?: unknown
  arg1?: unknown
}

/** A `vtp_configSettingsTable` is `["list", ["map","parameter",NAME,"parameterValue",VALUE], ...]` —
 *  real rows start at index 1. Falls back to the table on the referenced `__gtcs`
 *  macro when the tag points at one via `vtp_configSettingsVariable` instead of
 *  inlining its own table. */
function configParam(tag: ResolvedTag, macros: unknown[], paramName: string): unknown {
  let table = tag.vtp_configSettingsTable
  if (table === undefined) {
    const ref = tag.vtp_configSettingsVariable
    if (Array.isArray(ref) && ref[0] === 'macro' && typeof ref[1] === 'number') {
      const macro = macros[ref[1]] as Record<string, unknown> | undefined
      table = macro?.vtp_configSettingsTable
    }
  }
  if (!Array.isArray(table)) return undefined
  for (const row of table.slice(1)) {
    if (!Array.isArray(row)) continue
    const nameIdx = row.indexOf('parameter')
    const valIdx = row.indexOf('parameterValue')
    if (nameIdx !== -1 && valIdx !== -1 && row[nameIdx + 1] === paramName) return row[valIdx + 1]
  }
  return undefined
}

/** Event name a rule's tag fires on, when the rule has exactly one simple `_eq`
 *  predicate on the Event Name macro — the common case. Anything more exotic
 *  (multiple ANDed predicates, regex triggers) is left undefined on purpose: we'd
 *  rather skip a setup than confidently mis-order it. */
function ruleEventName(rule: unknown, predicates: ResolvedPredicate[]): string | undefined {
  if (!Array.isArray(rule)) return undefined
  const ifEntry = rule.find((e) => Array.isArray(e) && e[0] === 'if') as unknown[] | undefined
  if (!ifEntry || ifEntry.length !== 2) return undefined // exactly one predicate only
  const predicate = predicates[ifEntry[1] as number]
  if (!predicate || predicate.function !== '_eq') return undefined
  return typeof predicate.arg1 === 'string' ? predicate.arg1 : undefined
}

export interface Ga4ConfigOrderIssue {
  measurementId: string
  firstTagIndex: number
  firstEvent: string | undefined
  laterTagIndexes: number[]
}

/** Flags Measurement IDs where the chronologically-first `gtag config` call has
 *  `send_page_view: false` and no dedicated GA4 Event tag sends `page_view`.
 *  In gtag.js only the FIRST `config()` call per Measurement ID triggers the
 *  implicit page_view; later `config()` calls to the same ID are parameter
 *  updates and don't restore it, even without their own `send_page_view`
 *  override — a real GTM setup can silently lose page_view this way. */
export function findGa4ConfigOrderIssues(
  tags: ResolvedTag[],
  predicates: ResolvedPredicate[],
  rules: unknown[],
  macros: unknown[],
): Ga4ConfigOrderIssue[] {
  const hasDedicatedPageView = tags.some(
    (t) =>
      t.function === '__gaawe' &&
      (t.resolved?.vtp_eventName as { value?: unknown } | undefined)?.value === 'page_view',
  )
  if (hasDedicatedPageView) return []

  const byMeasurementId = new Map<string, { tag: ResolvedTag; event: string | undefined }[]>()
  for (const tag of tags) {
    if (tag.function !== '__googtag') continue
    const measurementId = (tag.resolved?.vtp_tagId as { value?: unknown } | undefined)?.value
    if (typeof measurementId !== 'string') continue
    const rule = rules.find((r) => {
      const addEntry = Array.isArray(r)
        ? (r as unknown[]).find((e) => Array.isArray(e) && e[0] === 'add')
        : undefined
      return Array.isArray(addEntry) && (addEntry as unknown[]).includes(tag.index)
    })
    const event = ruleEventName(rule, predicates)
    const list = byMeasurementId.get(measurementId) ?? []
    list.push({ tag, event })
    byMeasurementId.set(measurementId, list)
  }

  const issues: Ga4ConfigOrderIssue[] = []
  for (const [measurementId, entries] of byMeasurementId) {
    if (entries.length < 2) continue
    const minPriority = Math.min(...entries.map((e) => eventPriority(e.event)))
    const firstCandidates = entries.filter((e) => eventPriority(e.event) === minPriority)
    if (firstCandidates.length !== 1) continue // tied priority — order is ambiguous, don't guess
    const [first] = firstCandidates
    const sendPageView = configParam(first.tag, macros, 'send_page_view')
    if (sendPageView !== false && sendPageView !== 'false') continue
    issues.push({
      measurementId,
      firstTagIndex: first.tag.index,
      firstEvent: first.event,
      laterTagIndexes: entries.filter((e) => e !== first).map((e) => e.tag.index),
    })
  }
  return issues
}

// --- self-check: `npx tsx src/lib/datalayer-lints.ts` -----------------------
// Reads `process` via `globalThis` (not the bare identifier) so this file needs
// no @types/node just for a script that only ever runs under Node.
const selfCheckArgv1 = (globalThis as { process?: { argv?: string[] } }).process?.argv?.[1]
if (selfCheckArgv1?.includes('datalayer-lints')) {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg)
  }

  assert(
    findPossiblePII({ user: { email: 'a@b.com', first_name: '' } }).join() === 'user.email',
    'PII: flags filled email, ignores empty first_name',
  )
  assert(
    findPossiblePII({ items: [{ item_name: 'Shoe' }] }).length === 0,
    'PII: item_name must not false-positive on "name"',
  )
  assert(
    findDuplicateRootKeys({ value: 1, ecommerce: { value: 1, items: [] } }).join() === 'value',
    'duplicate root keys: detects value duplicated into ecommerce',
  )
  assert(
    findDuplicateRootKeys({ ecommerce: { value: 1 } }).length === 0,
    'duplicate root keys: no false positive when root key absent',
  )

  const macros = [{}, { function: '__c', vtp_value: 'G-AAA' }]
  const tags: ResolvedTag[] = [
    {
      index: 0,
      function: '__googtag',
      resolved: { vtp_tagId: { value: 'G-AAA' } },
      vtp_configSettingsTable: ['list', ['map', 'parameter', 'send_page_view', 'parameterValue', 'false']],
    },
    {
      index: 1,
      function: '__googtag',
      resolved: { vtp_tagId: { value: 'G-AAA' } },
      vtp_configSettingsTable: ['list'],
    },
  ]
  const predicates: ResolvedPredicate[] = [
    { index: 0, function: '_eq', arg1: 'gtm.init' },
    { index: 1, function: '_eq', arg1: 'wib_page_view' },
  ]
  const rules = [
    [['if', 0], ['add', 0]],
    [['if', 1], ['add', 1]],
  ]
  const issues = findGa4ConfigOrderIssues(tags, predicates, rules, macros)
  assert(
    issues.length === 1 && issues[0].measurementId === 'G-AAA',
    'order: flags suppressed page_view across two config tags on the same Measurement ID',
  )

  const tagsWithDedicatedPageView: ResolvedTag[] = [
    ...tags,
    { index: 2, function: '__gaawe', resolved: { vtp_eventName: { value: 'page_view' } } },
  ]
  assert(
    findGa4ConfigOrderIssues(tagsWithDedicatedPageView, predicates, rules, macros).length === 0,
    'order: suppressed when a dedicated page_view event tag exists',
  )

  console.log('datalayer-lints self-check: all assertions passed')
}
