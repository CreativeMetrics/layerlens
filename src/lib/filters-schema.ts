// Schema, defaults, validation and migration for `filters_configuration`.
//
// Two things this fixes from the legacy code:
//  1. The popup Settings textarea wrote raw JSON.parse'd objects with no schema
//     check, so a malformed config could later crash the filters modal on
//     `.length` of undefined. validate()/normalize() make that impossible.
//  2. It introduces the `type`-based model (filter by the element's real GTM
//     type code) alongside the legacy text `value`, so both can coexist during
//     the migration.

export interface FilterEntry {
  /** Button label shown to the user. */
  name: string
  /** Whether the filter is active. */
  enabled: boolean
  /**
   * NEW model: the stable internal GTM type code to filter by (e.g. 'gaawe',
   * 'html'). When set, filtering is done on the element type, not on text.
   */
  type?: string
  /**
   * LEGACY model: substring pushed into GTM's native search box. Kept for
   * backward compatibility and for free-text filters.
   */
  value?: string
}

export interface DisabledBuiltIn {
  name: string
  value: string
}

export interface FilterSection {
  customFilters: FilterEntry[]
  disabledBuiltInFilters: DisabledBuiltIn[]
  /** Set once the legacy built-in/custom split has been merged. */
  legacyHandled?: boolean
}

export interface FiltersConfiguration {
  tags: FilterSection
  triggers: FilterSection
  variables: FilterSection
}

export type SectionKey = keyof FiltersConfiguration
export const SECTION_KEYS: SectionKey[] = ['tags', 'triggers', 'variables']

export function emptySection(): FilterSection {
  return { customFilters: [], disabledBuiltInFilters: [] }
}

export const DEFAULT_FILTERS_CONFIGURATION: FiltersConfiguration = {
  tags: emptySection(),
  triggers: emptySection(),
  variables: emptySection(),
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Coerce arbitrary input into a valid FiltersConfiguration, filling gaps with
 * defaults and dropping malformed entries. Never throws.
 */
export function normalize(input: unknown): FiltersConfiguration {
  const out: FiltersConfiguration = {
    tags: emptySection(),
    triggers: emptySection(),
    variables: emptySection(),
  }
  if (!isObject(input)) return out

  for (const key of SECTION_KEYS) {
    const raw = input[key]
    if (!isObject(raw)) continue
    const section = out[key]

    if (Array.isArray(raw.customFilters)) {
      section.customFilters = raw.customFilters
        .filter(isObject)
        .map((f) => ({
          name: String(f.name ?? '').trim(),
          enabled: f.enabled !== false,
          ...(typeof f.type === 'string' ? { type: f.type } : {}),
          ...(typeof f.value === 'string' ? { value: f.value } : {}),
        }))
        .filter((f) => f.name.length > 0 && (f.type != null || f.value != null))
    }

    if (Array.isArray(raw.disabledBuiltInFilters)) {
      section.disabledBuiltInFilters = raw.disabledBuiltInFilters
        .filter(isObject)
        .map((f) => ({ name: String(f.name ?? ''), value: String(f.value ?? '') }))
    }

    if (typeof raw.legacyHandled === 'boolean') section.legacyHandled = raw.legacyHandled
  }
  return out
}

export type ValidationResult =
  | { ok: true; value: FiltersConfiguration }
  | { ok: false; errors: string[] }

/**
 * Strict validation for the Settings JSON editor: reports problems instead of
 * silently fixing them, so the user gets feedback. (For internal reads, prefer
 * normalize().)
 */
export function validate(input: unknown): ValidationResult {
  const errors: string[] = []
  if (!isObject(input)) return { ok: false, errors: ['Root must be an object.'] }

  for (const key of SECTION_KEYS) {
    const raw = input[key]
    if (raw === undefined) {
      errors.push(`Missing section "${key}".`)
      continue
    }
    if (!isObject(raw)) {
      errors.push(`Section "${key}" must be an object.`)
      continue
    }
    if (!Array.isArray(raw.customFilters)) errors.push(`"${key}.customFilters" must be an array.`)
    if (!Array.isArray(raw.disabledBuiltInFilters))
      errors.push(`"${key}.disabledBuiltInFilters" must be an array.`)
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: normalize(input) }
}
