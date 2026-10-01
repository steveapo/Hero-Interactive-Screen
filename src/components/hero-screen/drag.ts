"use client"

import { useCallback, useState } from "react"

/** A frame on the canvas, in canvas units: x/y is its centre relative to the canvas origin. */
export type CanvasRect = { x: number; y: number; w: number; h: number }

/** Screen px the pointer must travel before a press counts as a drag (so plain clicks still click). */
const DRAG_THRESHOLD = 3

/**
 * Follow a pointer press until release. `onDrag` receives the screen-px distance moved since the
 * press, once it passes the drag threshold; `onEnd` runs on release. If a drag happened, the click
 * that the release would fire is swallowed so buttons under the pointer don't activate.
 */
export function trackDrag(
  e: React.PointerEvent,
  onDrag: (dx: number, dy: number) => void,
  onEnd?: () => void,
) {
  const startX = e.clientX
  const startY = e.clientY
  let dragging = false

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    dragging = true
    onDrag(dx, dy)
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

/** Callback ref that tracks an element's viewport rect (on mount, resize and window resize). */
export function useMeasuredRect() {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const update = () => setRect(el.getBoundingClientRect())
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
      setRect(null)
    }
  }, [])
  return [ref, rect] as const
}
