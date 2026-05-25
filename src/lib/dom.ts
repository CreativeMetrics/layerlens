// Minimal DOM helpers to replace jQuery incrementally. Not a jQuery clone —
// just the handful of operations the codebase actually uses.

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel)

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel))

/** Build an element from an HTML string (first root node). */
export function el<T extends Element = HTMLElement>(html: string): T {
  const tpl = document.createElement('template')
  tpl.innerHTML = html.trim()
  return tpl.content.firstElementChild as T
}

/** Event delegation: handle events on `selector` descendants of `root`. */
export function delegate<E extends Event = Event>(
  root: ParentNode | Document,
  type: string,
  selector: string,
  handler: (ev: E, target: HTMLElement) => void,
): void {
  ;(root as EventTarget).addEventListener(type, (ev) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(selector)
    if (target) handler(ev as E, target)
  })
}
