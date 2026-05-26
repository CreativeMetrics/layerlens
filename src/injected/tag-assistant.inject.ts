// Runs in the PAGE world on tagassistant.google.com
// Adds a search bar and event-pin feature to the GTM debug event list.
//
// Selectors are anchored on .message-list__row and .message-list__row--indented
// (confirmed from live DOM inspection). The MutationObserver + scheduled-rAF
// pattern mirrors qol-changes.inject.ts so we survive Angular re-renders.

const ROOT_ID     = 'amd-ta-root'
const PINNED_ID   = 'amd-ta-pinned'
const HIDDEN_CLS  = 'amd-ta-hidden'
const PIN_CLS     = 'amd-ta-pin-btn'
const PIN_ON_CLS  = 'amd-ta-pin-on'
const HIGHLIGHT   = 'amd-ta-hl'

/** Lowercase event names the user has pinned. Persists across page navigations
 *  within the same Tag Assistant session (module-level). */
const pinnedNames = new Set<string>()
let filterText = ''

// ── DOM helpers ──────────────────────────────────────────────────────────────

function evName(row: HTMLElement): string {
  return (
    row.querySelector<HTMLElement>('.message-list__title span[title]')
       ?.getAttribute('title')?.trim() ?? ''
  )
}

function listParent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.message-list__row')?.parentElement ?? null
}

function evRows(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('.message-list__row--indented'),
  )
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pinSvg() {
  return `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4"/><path d="M9 15l-4.5 4.5"/><path d="M14.5 4l5.5 5.5"/></svg>`
}

// ── Styles ───────────────────────────────────────────────────────────────────

function injectStyles() {
  if (document.getElementById('amd-ta-style')) return
  const s = document.createElement('style')
  s.id = 'amd-ta-style'
  s.textContent = `
    /* ── utility ── */
    .${HIDDEN_CLS} { display: none !important; }

    /* ── search toolbar ── */
    #${ROOT_ID} {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px;
      background: #fff; border-bottom: 1px solid rgba(0,0,0,.1);
      font: 13px/1.4 system-ui, Roboto, Arial, sans-serif;
    }
    .amd-ta-searchbox {
      display: flex; align-items: center; gap: 7px; flex: 1;
      background: #f1f3f4; border-radius: 8px; padding: 6px 10px;
    }
    .amd-ta-searchbox svg { flex-shrink: 0; color: #9aa0a6; }
    .amd-ta-searchbox input {
      flex: 1; border: none; background: none; outline: none;
      font: inherit; color: #202124;
    }
    .amd-ta-searchbox input::-webkit-search-cancel-button { -webkit-appearance: none; }
    #amd-ta-count { font-size: 11px; color: #5f6368; flex-shrink: 0; white-space: nowrap; }

    /* ── pin button on each event row ── */
    .message-list__row--indented { position: relative; }

    .${PIN_CLS} {
      display: none;
      position: absolute; right: 30px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 5px; color: #9aa0a6; line-height: 0;
      transition: color .12s, background .12s;
    }
    /* show on row hover or when active */
    .message-list__row--indented:hover .${PIN_CLS},
    .${PIN_CLS}.${PIN_ON_CLS} { display: inline-flex; }

    .${PIN_CLS}:hover { color: #202124; background: rgba(0,0,0,.07); }
    .${PIN_CLS}.${PIN_ON_CLS} { color: #e5c614; }

    /* subtle yellow left-bar on pinned rows in the main list */
    .${HIGHLIGHT} { box-shadow: inset 3px 0 0 #e5c614; }

    /* ── pinned section ── */
    #${PINNED_ID} {
      border-bottom: 1px solid rgba(0,0,0,.1);
      background: #fff;
    }
    .amd-ta-pin-sep {
      padding: 4px 10px 2px; font-size: 10px; font-weight: 700;
      color: #9aa0a6; text-transform: uppercase; letter-spacing: .06em;
      font-family: system-ui, sans-serif;
    }
    /* cloned rows inside the pinned section */
    .amd-ta-clone {
      background: rgba(229,198,20,.07) !important;
      box-shadow: inset 3px 0 0 #e5c614 !important;
    }
    .amd-ta-clone .${PIN_CLS} {
      display: inline-flex !important; color: #e5c614;
    }
    .amd-ta-placeholder {
      padding: 7px 10px; font-size: 13px; color: #9aa0a6;
      font-style: italic; font-family: system-ui, sans-serif;
    }
  `
  document.head.appendChild(s)
}

// ── Toolbar ──────────────────────────────────────────────────────────────────

function injectToolbar() {
  if (document.getElementById(ROOT_ID)) return
  const parent = listParent()
  if (!parent) return

  const root = document.createElement('div')
  root.id = ROOT_ID
  root.innerHTML = `
    <div class="amd-ta-searchbox">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <input type="search" id="amd-ta-search-input" placeholder="Cerca eventi…" autocomplete="off" spellcheck="false" />
      <span id="amd-ta-count" style="display:none"></span>
    </div>`
  parent.insertAdjacentElement('beforebegin', root)

  document.getElementById('amd-ta-search-input')
    ?.addEventListener('input', (e) => {
      filterText = (e.target as HTMLInputElement).value.toLowerCase().trim()
      applyFilter(evRows())
    })
}

// ── Pinned section ───────────────────────────────────────────────────────────

/** Rebuild the clone cards inside #amd-ta-pinned.
 *  Mutations here are INSIDE the section, so the observer's `ours` guard
 *  absorbs them and prevents a sync loop. */
function updatePinnedSection() {
  if (pinnedNames.size === 0) {
    document.getElementById(PINNED_ID)?.remove()
    return
  }

  // Ensure the container exists (inserted once, before the list parent).
  let section = document.getElementById(PINNED_ID)
  if (!section) {
    section = document.createElement('div')
    section.id = PINNED_ID
    const toolbar = document.getElementById(ROOT_ID)
    if (toolbar) {
      toolbar.insertAdjacentElement('afterend', section)
    } else {
      listParent()?.insertAdjacentElement('beforebegin', section)
    }
  }
  if (!section.isConnected) return

  // Rebuild content.
  section.innerHTML = `<div class="amd-ta-pin-sep">Fissati</div>`
  const rows = evRows()

  for (const name of pinnedNames) {
    // Show the most-recent occurrence of this event name on the current page.
    const original = [...rows].reverse().find(r => evName(r).toLowerCase() === name)

    if (original) {
      const clone = original.cloneNode(true) as HTMLElement
      clone.classList.add('amd-ta-clone')
      clone.removeAttribute('data-amd-pin-added')
      // Remove stale pin buttons from the clone and add a fresh unpin one.
      clone.querySelectorAll(`.${PIN_CLS}`).forEach(b => b.remove())
      attachCloneUnpin(clone, name)
      section.appendChild(clone)
    } else {
      // Event not visible on this page — show a placeholder.
      const ph = document.createElement('div')
      ph.className = 'amd-ta-placeholder'
      ph.textContent = `${name} (non in questa pagina)`
      section.appendChild(ph)
    }
  }
}

function attachCloneUnpin(row: HTMLElement, name: string) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `${PIN_CLS} ${PIN_ON_CLS}`
  btn.title = 'Rimuovi dai fissati'
  btn.setAttribute('aria-pressed', 'true')
  btn.innerHTML = pinSvg()
  btn.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault()
    unpin(name)
  })
  row.appendChild(btn)
}

function unpin(name: string) {
  pinnedNames.delete(name)
  // Update original rows in the main list.
  evRows()
    .filter(r => evName(r).toLowerCase() === name)
    .forEach(r => {
      r.classList.remove(HIGHLIGHT)
      const b = r.querySelector<HTMLButtonElement>(`.${PIN_CLS}`)
      if (b) { b.classList.remove(PIN_ON_CLS); b.title = 'Fissa in cima'; b.setAttribute('aria-pressed', 'false') }
    })
  updatePinnedSection()
}

// ── Filter ───────────────────────────────────────────────────────────────────

function applyFilter(rows: HTMLElement[]) {
  let visible = 0
  for (const row of rows) {
    const match = !filterText || evName(row).toLowerCase().includes(filterText)
    row.classList.toggle(HIDDEN_CLS, !match)
    if (match) visible++
  }

  // Hide page-separator rows when all their events are filtered out.
  const parent = listParent()
  if (parent) {
    const seps = Array.from(
      parent.querySelectorAll<HTMLElement>('.message-list__row:not(.message-list__row--indented)'),
    )
    for (const sep of seps) {
      if (!filterText) { sep.classList.remove(HIDDEN_CLS); continue }
      let next = sep.nextElementSibling as HTMLElement | null
      let hasVisible = false
      while (next) {
        if (!next.classList.contains('message-list__row--indented')) break
        if (!next.classList.contains(HIDDEN_CLS)) { hasVisible = true; break }
        next = next.nextElementSibling as HTMLElement | null
      }
      sep.classList.toggle(HIDDEN_CLS, !hasVisible)
    }
  }

  const countEl = document.getElementById('amd-ta-count')
  if (countEl) {
    if (filterText) {
      countEl.textContent = `${visible} / ${rows.length}`
      countEl.style.display = ''
    } else {
      countEl.style.display = 'none'
    }
  }
}

// ── Pin buttons ──────────────────────────────────────────────────────────────

function addPinButtons(rows: HTMLElement[]) {
  for (const row of rows) {
    if (row.dataset.amdPinAdded) continue
    row.dataset.amdPinAdded = '1'

    const name = evName(row).toLowerCase()
    const pinned = pinnedNames.has(name)
    if (pinned) row.classList.add(HIGHLIGHT)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = `${PIN_CLS}${pinned ? ` ${PIN_ON_CLS}` : ''}`
    btn.title = pinned ? 'Rimuovi dai fissati' : 'Fissa in cima'
    btn.setAttribute('aria-pressed', String(pinned))
    btn.innerHTML = pinSvg()
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); e.preventDefault()
      const nowPinned = !pinnedNames.has(name)
      if (nowPinned) {
        pinnedNames.add(name)
      } else {
        pinnedNames.delete(name)
      }
      // Sync all rows with the same event name.
      evRows()
        .filter(r => evName(r).toLowerCase() === name)
        .forEach(r => {
          r.classList.toggle(HIGHLIGHT, nowPinned)
          const b = r.querySelector<HTMLButtonElement>(`.${PIN_CLS}`)
          if (b) {
            b.classList.toggle(PIN_ON_CLS, nowPinned)
            b.title = nowPinned ? 'Rimuovi dai fissati' : 'Fissa in cima'
            b.setAttribute('aria-pressed', String(nowPinned))
          }
        })
      updatePinnedSection()
    })
    row.appendChild(btn)
  }
}

// ── Main sync ────────────────────────────────────────────────────────────────

/** Idempotent: safe to call on every Angular re-render.
 *  All DOM insertions are one-shot (guarded by id/dataset checks). */
function sync() {
  if (!document.querySelector('.message-list__row')) return
  injectStyles()
  injectToolbar()
  const rows = evRows()
  if (rows.length === 0) return
  addPinButtons(rows)
  applyFilter(rows)
  // Re-sync the pinned section after pin buttons are added.
  // Wrapped in rAF so mutations happen INSIDE #amd-ta-pinned (ours-guarded).
  requestAnimationFrame(updatePinnedSection)
}

let scheduled = false
const observer = new MutationObserver((muts) => {
  // Ignore mutations that originate inside our own injected nodes.
  const ours = muts.every((m) => {
    const t = m.target as HTMLElement
    return !!t.closest?.(`#${ROOT_ID}, #${PINNED_ID}, #amd-ta-style`)
  })
  if (ours || scheduled) return
  scheduled = true
  requestAnimationFrame(() => { scheduled = false; sync() })
})
observer.observe(document.body, { childList: true, subtree: true })

sync()
