"use client"

import { useCallback, useState } from "react"
import { screenScale } from "@/lib/screen-scale"

/** A frame on the canvas, in canvas units: x/y is its centre relative to the canvas origin. */
export type CanvasRect = { x: number; y: number; w: number; h: number }

/**
 * An element's layout box: its offset from its offset parent and its size, in layout px. Unlike a
 * viewport rect it doesn't change while the screen is drawn scaled (see lib/screen-scale).
 */
export type LayoutBox = { left: number; top: number; width: number; height: number }

/** Screen px the pointer must travel before a press counts as a drag (so plain clicks still click). */
const DRAG_THRESHOLD = 3

/**
 * Follow a pointer press until release. `onDrag` receives the distance moved since the press, in
 * the pressed element's layout px (screen px ÷ the screen's drawn scale, see lib/screen-scale),
 * once it passes the drag threshold; `onEnd` runs on release. If a drag happened, the click that
 * the release would fire is swallowed so buttons under the pointer don't activate.
 */
export function trackDrag(
  e: React.PointerEvent,
  onDrag: (dx: number, dy: number) => void,
  onEnd?: () => void,
) {
  const startX = e.clientX
  const startY = e.clientY
  const k = screenScale(e.currentTarget as Element)
  let dragging = false

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    dragging = true
    onDrag(dx / k, dy / k)
  }

  function onUp() {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    onEnd?.()
    if (!dragging) return
    const swallowClick = (ev: MouseEvent) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener("click", swallowClick, { capture: true, once: true })
    setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }), 0)
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
}

/**
 * Callback ref that tracks an element's viewport rect and its layout box (see LayoutBox), on
 * mount, resize and window resize. `settleMs`: while the element keeps resizing (e.g. a window
 * growing frame by frame as the page scrolls), hold the update until it has been still this long,
 * instead of re-rendering on every frame of the resize (which makes the resize itself stutter).
 * Unchanged measurements never re-render.
 */
export function useMeasuredRect(settleMs = 0) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [box, setBox] = useState<LayoutBox | null>(null)
  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      let timer: ReturnType<typeof setTimeout> | undefined
      const measure = () => {
        const next = el.getBoundingClientRect()
        setRect((prev) =>
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.width === next.width &&
          prev.height === next.height
            ? prev
            : next,
        )
        const layout = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight }
        setBox((prev) =>
          prev &&
          prev.left === layout.left &&
          prev.top === layout.top &&
          prev.width === layout.width &&
          prev.height === layout.height
            ? prev
            : layout,
        )
      }
      const update = () => {
        if (settleMs <= 0) return measure()
        clearTimeout(timer)
        timer = setTimeout(measure, settleMs)
      }
      measure()
      const observer = new ResizeObserver(update)
      observer.observe(el)
      window.addEventListener("resize", update)
      return () => {
        clearTimeout(timer)
        observer.disconnect()
        window.removeEventListener("resize", update)
        setRect(null)
        setBox(null)
      }
    },
    [settleMs],
  )
  return [ref, rect, box] as const
}
