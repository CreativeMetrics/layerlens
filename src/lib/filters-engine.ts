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
  /** Set of selected folder IDs. Empty = no folder restriction. '' = items with no folder. */
  selectedFolders: Set<string>
  /** Free-text query matched against the element name (case-insensitive). */
  query: string
  /** Pause visibility filter — only meaningful on the TAGS page. */
  pauseFilter: 'all' | 'paused' | 'active'
}

export function emptyState(): FilterState {
  return { selectedTypes: new Set(), selectedFolders: new Set(), query: '', pauseFilter: 'all' }
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
  if (state.selectedFolders.size > 0 && !state.selectedFolders.has(row.parentFolderId)) return false
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

/** A single folder entry for the folder-filter UI: stable id, name, count. */
export interface FolderFacet {
  folderId: string  // '' for items with no folder
  name: string
  count: number
}

/**
 * Build the list of folder facets from the current rows and the folder name map.
 * Only includes folders that have at least one item.
 * Appends a "Senza cartella" entry when the container has a mix of items with and
 * without a folder (filtering by "no folder" is useful only when some items DO have one).
 */
export function foldersFromRows(rows: GtmRow[], folderMap: Map<string, string>): FolderFacet[] {
  if (folderMap.size === 0) return []
  const byFolder = new Map<string, FolderFacet>()
  let noFolderCount = 0
  for (const r of rows) {
    if (!r.parentFolderId) { noFolderCount++; continue }
    const name = folderMap.get(r.parentFolderId) ?? `Cartella ${r.parentFolderId}`
    const f = byFolder.get(r.parentFolderId) ?? { folderId: r.parentFolderId, name, count: 0 }
    f.count++
    byFolder.set(r.parentFolderId, f)
  }
  const result = [...byFolder.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
  if (noFolderCount > 0 && result.length > 0) {
    result.push({ folderId: '', name: 'Senza cartella', count: noFolderCount })
  }
  return result
}
