/**
 * On-screen scale of content that an ancestor draws scaled (a CSS transform) instead of laying
 * it out at its displayed size: the hero window lays the interactive screen out once at its full
 * size and scales it while it grows / shrinks with the page scroll (see ScrollGrowWindow).
 *
 * Code inside that converts between screen px (pointer clientX / getBoundingClientRect) and
 * layout px (styles, offsetLeft, canvas math) divides screen distances by `screenScale(el)`.
 * Outside a scaled host (or at full size) it's exactly 1, so the conversion is a no-op there.
 */

/** Marks the element whose transform scales its content (the scale is registered below). */
export const SCREEN_SCALE_ATTR = "data-screen-scale-host"

const scales = new WeakMap<Element, number>()

/** Registers the current scale of a scaling host (called by the host as it animates). */
export function setScreenScale(host: Element, scale: number) {
  scales.set(host, scale)
}

/** The on-screen scale of `el`'s layout px: < 1 while its host draws it smaller, else 1. */
export function screenScale(el: Element | null | undefined): number {
  const host = el?.closest(`[${SCREEN_SCALE_ATTR}]`)
  return (host && scales.get(host)) || 1
}
