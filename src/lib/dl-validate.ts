/**
 * GA4 dataLayer push validation.
 *
 * Pure, dependency-free: `validatePush(push)` takes a single dataLayer entry and
 * returns a list of issues. No DOM, no side effects — easy to test and to tune.
 *
 * Scope (per user choice): GA4 standard only (not legacy Enhanced Ecommerce / UA),
 * plus common non-ecommerce GA4 events.
 */

export type Severity = 'error' | 'warning' | 'info'

export interface Issue {
  severity: Severity
  message: string
}

type Push = Record<string, unknown>

/** GA4 ecommerce events that should carry an `ecommerce` object. */
const ECOMMERCE_EVENTS = new Set([
  'view_item',
  'view_item_list',
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'add_to_wishlist',
  'view_promotion',
  'select_promotion',
  'purchase',
  'refund',
])

/** Recommended parameters for common non-ecommerce GA4 events. */
const EVENT_PARAMS: Record<string, string[]> = {
  login: ['method'],
  sign_up: ['method'],
  search: ['search_term'],
  generate_lead: ['value', 'currency'],
  select_content: ['content_type', 'content_id'],
  share: ['method', 'content_type'],
}

/** GTM-internal events — informational only, never flagged as problems. */
const GTM_INTERNAL = /^gtm\./

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isSnakeCase = (s: string) => /^[a-z][a-z0-9_]*$/.test(s)

const ISO_4217 = /^[A-Z]{3}$/

export function validatePush(push: unknown): Issue[] {
  const issues: Issue[] = []
  if (!isObject(push)) return issues
  const p = push as Push

  const event = typeof p.event === 'string' ? p.event : undefined

  // Internal GTM push — just label it, run no further checks.
  if (event && GTM_INTERNAL.test(event)) {
    issues.push({ severity: 'info', message: 'Push interno di GTM' })
    return issues
  }

  // event presence + naming
  if (!event) {
    issues.push({ severity: 'warning', message: 'Nessuna chiave "event" nel push' })
  } else if (!isSnakeCase(event)) {
    issues.push({
      severity: 'warning',
      message: `Nome evento "${event}" non in snake_case (GA4 consiglia minuscole_con_underscore)`,
    })
  }

  // ---- ecommerce checks ----
  if (event && ECOMMERCE_EVENTS.has(event)) {
    const ec = p.ecommerce
    if (!isObject(ec)) {
      issues.push({
        severity: 'error',
        message: `Evento ecommerce "${event}" senza oggetto "ecommerce"`,
      })
    } else {
      const items = (ec as Record<string, unknown>).items
      const needsItems = event !== 'view_promotion' && event !== 'select_promotion'
      if (needsItems) {
        if (!Array.isArray(items) || items.length === 0) {
          issues.push({
            severity: 'error',
            message: 'Array "items" mancante o vuoto in "ecommerce"',
          })
        } else {
          items.forEach((it, i) => {
            if (!isObject(it)) return
            const hasId = 'item_id' in it && String(it.item_id ?? '').trim() !== ''
            const hasName = 'item_name' in it && String(it.item_name ?? '').trim() !== ''
            if (!hasId && !hasName)
              issues.push({
                severity: 'warning',
                message: `items[${i}] senza "item_id" né "item_name"`,
              })
          })
        }
      }

      // purchase / refund specifics
      if (event === 'purchase') {
        const e = ec as Record<string, unknown>
        if (!('transaction_id' in e) || String(e.transaction_id ?? '').trim() === '')
          issues.push({
            severity: 'error',
            message: '"purchase" senza "transaction_id" (rischio di acquisti duplicati)',
          })
        validateValueCurrency(e, issues)
      }
      if (event === 'refund') {
        const e = ec as Record<string, unknown>
        if (!('transaction_id' in e))
          issues.push({ severity: 'warning', message: '"refund" senza "transaction_id"' })
      }
    }
  }

  // ---- non-ecommerce GA4 events: recommended params ----
  if (event && EVENT_PARAMS[event]) {
    for (const param of EVENT_PARAMS[event]) {
      if (!(param in p) && !hasNestedParam(p, param))
        issues.push({
          severity: 'warning',
          message: `Evento "${event}": parametro consigliato "${param}" assente`,
        })
    }
    if (event === 'generate_lead') validateValueCurrency(p, issues)
  }

  return issues
}

/** value must be a number; currency must be ISO 4217 (3 uppercase letters). */
function validateValueCurrency(obj: Record<string, unknown>, issues: Issue[]) {
  if ('value' in obj) {
    if (typeof obj.value !== 'number')
      issues.push({
        severity: 'error',
        message: `"value" deve essere numerico (trovato ${typeof obj.value})`,
      })
  } else {
    issues.push({ severity: 'warning', message: '"value" assente' })
  }
  if ('currency' in obj) {
    if (typeof obj.currency !== 'string' || !ISO_4217.test(obj.currency))
      issues.push({
        severity: 'warning',
        message: `"currency" non in formato ISO 4217 (es. EUR, USD)`,
      })
  } else {
    issues.push({ severity: 'warning', message: '"currency" assente' })
  }
}

/** Some setups nest event params under an object; do a shallow look. */
function hasNestedParam(push: Record<string, unknown>, param: string): boolean {
  for (const v of Object.values(push)) if (isObject(v) && param in v) return true
  return false
}

/** Highest severity in a set of issues, for the row badge. */
export function topSeverity(issues: Issue[]): Severity | null {
  if (issues.some((i) => i.severity === 'error')) return 'error'
  if (issues.some((i) => i.severity === 'warning')) return 'warning'
  if (issues.some((i) => i.severity === 'info')) return 'info'
  return null
}
