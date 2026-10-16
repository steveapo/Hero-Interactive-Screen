"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/** How far outside the visible area content starts mounting, so it's ready as it pans in. */
const PRELOAD_MARGIN = "200px"

/**
 * Renders an empty box (filling its parent) until the box first comes into view, then mounts
 * `children` and keeps them mounted. The intersection is clipped by every scrolling / clipping
 * ancestor (the canvas window included), so content far out on the canvas, and the images it
 * loads, cost nothing until the camera pans near it.
 */
export function MountWhenVisible({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      },
      { rootMargin: PRELOAD_MARGIN },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div ref={ref} className="size-full">
      {visible ? children : null}
    </div>
  )
}
