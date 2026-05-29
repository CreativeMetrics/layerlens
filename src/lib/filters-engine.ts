// Pure filtering logic for the GTM list, decoupled from any DOM/UI.
//
// New model (what the user asked for): filter by the element's REAL type, then
// free-text search by name within that subset — instead of the legacy approach
// of pushing localised label strings into GTM's native search box (which broke
// on non-English GTM and couldn't express type membership).

import type { GtmRow } from '@/lib/gtm-angular'

export interface FilterState {
  /** Set of selected type codes. Empty = no type restriction (show all types). */
  selectedTypes: Set<string>
  /** Free-text query matched against the element name (case-insensitive). */
  query: string
  /** Pause visibility filter — only meaningful on the TAGS page. */
  pauseFilter: 'all' | 'paused' | 'active'
}

export function emptyState(): FilterState {
  return { selectedTypes: new Set(), query: '', pauseFilter: 'all' }
}

/** A single type entry for the chip UI: stable code, localised label, count. */
export interface TypeFacet {
  type: string
  displayName: string
  count: number
}

/** Build the list of type facets present in the current rows, sorted by label. */
export function facetsFromRows(rows: GtmRow[]): TypeFacet[] {
  const byType = new Map<string, TypeFacet>()
  for (const r of rows) {
    const f = byType.get(r.type) ?? {
      type: r.type,
      displayName: String(r.displayName ?? r.type),
      count: 0,
    }
    f.count += 1
    byType.set(r.type, f)
  }
  return [...byType.values()].sort((a, b) =>
    String(a.displayName).localeCompare(String(b.displayName), undefined, { sensitivity: 'base' }),
  )
}

/** True if a row passes the current filter state. */
export function matches(row: GtmRow, state: FilterState): boolean {
  if (state.selectedTypes.size > 0 && !state.selectedTypes.has(row.type)) return false
  const q = state.query.trim().toLowerCase()
  if (q && !row.name.toLowerCase().includes(q)) return false
  if (state.pauseFilter === 'paused' && !row.paused) return false
  if (state.pauseFilter === 'active' && row.paused) return false
  return true
}

/** Partition rows into those to show and those to hide. */
export function applyFilter(rows: GtmRow[], state: FilterState) {
  const show: GtmRow[] = []
  const hide: GtmRow[] = []
  for (const r of rows) (matches(r, state) ? show : hide).push(r)
  return { show, hide }
}
