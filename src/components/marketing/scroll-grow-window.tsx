"use client"

import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"

/**
 * Whether the window around a component has reached its full size (latched: scrolling back up
 * doesn't undo it). Outside a ScrollGrowWindow there's nothing to wait for, so it reads true.
 */
const FullyGrownContext = createContext(true)

/** True once the enclosing ScrollGrowWindow has fully grown (always true outside one). */
export function useWindowFullyGrown() {
  return useContext(FullyGrownContext)
}

/**
 * Size at the top of the page and once fully scrolled in, relative to the base size. At 1 the
 * window is exactly the title/description column, so their left edges line up.
 */
const START_SCALE = 1
const END_SCALE = 1.2
/** Growth finishes when the window's top reaches this fraction of the viewport height. */
const END_TOP = 0.08
/** Fraction of the remaining distance covered per 60fps frame (lower = softer, laggier). */
const SMOOTHING = 0.12
/** One 60fps frame (ms): SMOOTHING's unit. */
const FRAME_MS = 1000 / 60
/** What's inside may start once the scroll has covered all but this fraction of the growth. */
const READY_MARGIN = 0.04
/**
 * Narrowest the content is ever laid out (layout px). On smaller screens the window is narrower
 * than this, so the content (the Desktop Area, its windows, the canvas's bars, panels, text and
 * icons) keeps this layout and is drawn proportionally smaller instead of re-flowing and breaking.
 * Wider windows lay out at their own full width, as before.
 */
const MIN_LAYOUT_WIDTH = 1280

/**
 * Product window that grows from START_SCALE to END_SCALE of its base size as the page scrolls.
 * Base width = the parent's content width; base height = min(860px, 85vh). Growing past 100%
 * breaks out of the text column, centred, and is capped so it never touches the screen edges.
 *
 * The window itself (its border, rounding and shadow) really resizes, but what's inside doesn't
 * re-lay out as it does: the content is laid out once at the window's full width and drawn scaled
 * to the current width (a GPU transform), its height set so it fills the window exactly. The
 * interactive screen inside has thousands of elements; re-laying them all out (and re-fitting the
 * canvas) on every frame of the growth is what made it stutter. The canvas scales its camera with
 * the screen's width anyway, so the composition shows exactly as a real resize would.
 *
 * Code inside that maps pointer positions reads the current scale with `screenScale` (see
 * lib/screen-scale); at full size the content is drawn unscaled (no transform at all), except on
 * screens narrower than MIN_LAYOUT_WIDTH, where it stays scaled down to fit.
 */
export function ScrollGrowWindow({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  /** Reached full size (or as far as the page can scroll): what's inside may start. Latched. */
  const [fullyGrown, setFullyGrown] = useState(false)

  // Layout effect: the scaled layout is in place before the first client paint.
  useLayoutEffect(() => {
    const el = ref.current
    const contentEl = contentRef.current
    if (!el || !contentEl) return
    const node = el
    const content = contentEl

    let frame = 0
    /** When the last frame was drawn (for frame-rate-independent easing); 0 = not animating. */
    let lastFrameAt = 0
    /** Scale currently rendered; eases toward the scroll-derived target each frame. */
    let current = START_SCALE
    let grown = false
    /** The window's content width at full growth (px): the content is laid out at this width. */
    let fullWidth = 0

    /** The window's content box (inside its border), fractional px. */
    function contentBox() {
      const rect = node.getBoundingClientRect()
      return {
        width: rect.width - (node.offsetWidth - node.clientWidth),
        height: rect.height - (node.offsetHeight - node.clientHeight),
      }
    }

    /**
     * Measure the full-growth width (the window briefly set to full size, within this frame). The
     * content is laid out at least MIN_LAYOUT_WIDTH wide; below that it's drawn scaled down.
     */
    function measureFull() {
      node.style.setProperty("--grow", String(END_SCALE))
      fullWidth = Math.max(MIN_LAYOUT_WIDTH, contentBox().width)
      node.style.setProperty("--grow", current.toFixed(4))
    }

    /**
     * Fit the content to the window's current size: laid out at the full width, scaled down to
     * the current one, as tall as fills the window at that scale. While it animates, the content
     * is its own GPU layer, so each frame only re-composites it (no re-layout, no repaint); once
     * it settles the layer goes and it's painted crisp at its resting scale.
     */
    function fitContent(animating: boolean) {
      const box = contentBox()
      if (!fullWidth || !box.width) return
      let scale = Math.min(1, box.width / fullWidth)
      if (scale > 0.9999) scale = 1
      content.style.flex = "none"
      content.style.width = `${fullWidth}px`
      content.style.height = `${box.height / scale}px`
      content.style.transform = scale === 1 ? "" : `scale(${scale})`
      content.style.willChange = animating && scale < 1 ? "transform" : ""
      setScreenScale(content, scale)
    }

    /**
     * The scroll has brought the window (practically) to full size, or the page can't scroll any
     * further toward it (short pages / tall viewports). Judged on the scroll-derived target, not
     * the rendered size: that eases in behind the scroll, and waiting for it would hold the demo
     * back for most of a second after the visitor arrives.
     */
    function checkGrown(target: number) {
      if (grown) return
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const atFull = target >= END_SCALE - (END_SCALE - START_SCALE) * READY_MARGIN
      const cannotGrowFurther = window.scrollY >= maxScroll - 2
      if (atFull || cannotGrowFurther) {
        grown = true
        setFullyGrown(true)
      }
    }

    function targetScale() {
      const viewport = window.innerHeight
      // Top of the window in the page; its own size changes don't move it.
      const docTop = node.getBoundingClientRect().top + window.scrollY
      const distance = Math.max(1, docTop - viewport * END_TOP)
      const progress = Math.min(1, Math.max(0, window.scrollY / distance))
      // Ease in-out so growth starts and settles gently.
      const eased = progress * progress * (3 - 2 * progress)
      return START_SCALE + (END_SCALE - START_SCALE) * eased
    }

    function tick(now: number) {
      frame = 0
      const target = targetScale()
      // Glide toward the target: smooths out stepped wheel scrolling. Scaled by the real time
      // since the last frame (SMOOTHING is per 60fps frame), so a slow or dropped frame catches
      // up by the right amount instead of stuttering, and 120Hz screens glide just as fast.
      const frames = lastFrameAt ? Math.min(4, (now - lastFrameAt) / FRAME_MS) : 1
      lastFrameAt = now
      current += (target - current) * (1 - Math.pow(1 - SMOOTHING, frames))
      if (Math.abs(target - current) < 0.0005) current = target
      // Never render smaller than the starting (column-width) size.
      current = Math.min(END_SCALE, Math.max(START_SCALE, current))
      // Layout reads (scrollHeight in checkGrown) before the size is written.
      checkGrown(target)
      node.style.setProperty("--grow", current.toFixed(4))
      const settled = current === target
      fitContent(!settled)
      if (!settled) frame = requestAnimationFrame(tick)
      else lastFrameAt = 0
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    // Until the window has visibly reached its full size, every wheel / trackpad scroll over it
    // (vertical or horizontal) goes to the page, not the canvas inside, so the canvas never
    // hijacks page scrolling. Captured here, before the canvas's own listener. ⌘/Ctrl + scroll
    // (canvas zoom) is left alone since it doesn't scroll the page. The scripted demo's own
    // (synthetic, untrusted) wheel events always reach the canvas, so it can pan the camera.
    function onWheel(e: WheelEvent) {
      if (!e.isTrusted) return
      if (e.ctrlKey || e.metaKey) return
      const fullyGrown = current >= END_SCALE - 0.001
      if (!fullyGrown) e.stopPropagation()
    }

    // The full width follows the column (the viewport's width), not the window's own growth.
    function onResize() {
      measureFull()
      fitContent(false)
      schedule()
    }
    const column = node.parentElement
    let columnWidth = column?.clientWidth ?? 0
    const columnObserver = new ResizeObserver(() => {
      const width = column?.clientWidth ?? 0
      if (width === columnWidth) return // its height follows the window's growth: ignore that
      columnWidth = width
      onResize()
    })
    if (column) columnObserver.observe(column)

    // Start at the right size if the page loads already scrolled.
    current = targetScale()
    measureFull()
    node.style.setProperty("--grow", current.toFixed(4))
    fitContent(false)
    checkGrown(current)
    // No scroll anchoring while the window resizes: the browser would nudge the scroll position
    // to keep the content below it in place, which changes the window's target size, which moves
    // the content again: the two fight and the growth jitters.
    const root = document.documentElement
    const previousAnchor = root.style.overflowAnchor
    root.style.overflowAnchor = "none"
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", onResize)
    node.addEventListener("wheel", onWheel, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(frame)
      columnObserver.disconnect()
      root.style.overflowAnchor = previousAnchor
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", onResize)
      node.removeEventListener("wheel", onWheel, true)
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{ "--grow": START_SCALE } as CSSProperties}
      className={cn(
        "flex flex-col self-center overflow-hidden",
        "w-[calc(100%*var(--grow))] max-w-[calc(100vw-2*clamp(0.75rem,2vw,2rem))]",
        // Height: min(860px, 85vh), and on narrow screens no taller than 68% of the column's width
        // (cqw: the parent column is a size container), so the scaled-down desktop keeps a desktop
        // shape rather than turning into a tall strip. At full-size columns the 68% never binds.
        "h-[calc(min(860px,85vh,68cqw)*var(--grow))] max-h-[94vh] min-h-[min(520px,calc(68cqw*var(--grow)))]",
        className,
      )}
    >
      {/* Fills the window until measured (server render), then laid out at full width and scaled.
          The attribute is SCREEN_SCALE_ATTR: code inside reads the scale through it. */}
      <div ref={contentRef} data-screen-scale-host="" className="flex min-h-0 flex-1 origin-top-left flex-col">
        <FullyGrownContext.Provider value={fullyGrown}>{children}</FullyGrownContext.Provider>
      </div>
    </div>
  )
}
