import type { CursorAnchor } from "./types"

/**
 * Anchors tie a press to the element it hit, so playback can re-aim at that element's
 * current position. Mark important controls with `data-cursor-id="..."` for the most robust
 * targeting; anything else falls back to a structural child-index path from the stage.
 */

const ANCHOR_ATTR = "data-cursor-id"

/** Build an anchor for a press on `target` at client point (clientX, clientY). */
export function describeAnchor(
  stage: HTMLElement,
  target: Element,
  clientX: number,
  clientY: number,
): CursorAnchor | undefined {
  if (!stage.contains(target)) return undefined

  const tagged = target.closest(`[${ANCHOR_ATTR}]`)
  const el = tagged && stage.contains(tagged) ? tagged : target
  const rect = el.getBoundingClientRect()
  const fx = rect.width ? (clientX - rect.left) / rect.width : 0.5
  const fy = rect.height ? (clientY - rect.top) / rect.height : 0.5

  if (tagged && el === tagged) {
    return { id: tagged.getAttribute(ANCHOR_ATTR) ?? undefined, fx, fy }
  }

  // Structural path: child indices from the stage down to the element.
  const path: number[] = []
  let node: Element | null = el
  while (node && node !== stage) {
    const parent: Element | null = node.parentElement
    if (!parent) return undefined
    path.unshift(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
  return { path, fx, fy }
}

/** Find the element an anchor points at, or null if it no longer exists. */
export function resolveAnchorElement(stage: HTMLElement, anchor: CursorAnchor): Element | null {
  let el: Element | null = null

  if (anchor.id) {
    el = stage.querySelector(`[${ANCHOR_ATTR}="${CSS.escape(anchor.id)}"]`)
  } else if (anchor.path) {
    el = stage
    for (const index of anchor.path) {
      el = el?.children[index] ?? null
      if (!el) break
    }
  }
  return el
}

/** Resolve an anchor to a point in current stage px, or null if its element is gone / hidden. */
export function resolveAnchor(stage: HTMLElement, anchor: CursorAnchor): { x: number; y: number } | null {
  const el = resolveAnchorElement(stage, anchor)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  const stageRect = stage.getBoundingClientRect()
  return {
    x: rect.left - stageRect.left + rect.width * anchor.fx,
    y: rect.top - stageRect.top + rect.height * anchor.fy,
  }
}
