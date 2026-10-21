import type { Ref } from "react"

/**
 * The simulated cursor: a macOS-style arrow whose tip sits at (0, 0) of the wrapper. The stage
 * moves the wrapper with `transform` every frame (snapped to whole device pixels) and toggles
 * `data-pressed` for the press squash. Positioning is imperative (no re-render per frame).
 * Kept crisp: no forced compositing layer (it would be resampled as a bitmap while it moves) and
 * the shadow is drawn inside the SVG, so the arrow is always rendered as vectors.
 */
export function SimulatedCursor({ ref, visible }: { ref: Ref<HTMLDivElement>; visible: boolean }) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-pressed="false"
      className="group/cursor pointer-events-none absolute left-0 top-0 z-[60]"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 22 22"
        shapeRendering="geometricPrecision"
        className="-translate-x-[3px] -translate-y-[2px] origin-[3px_2px] overflow-visible transition-[scale,opacity] duration-150 ease-out group-data-[pressed=true]/cursor:scale-[0.82]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <defs>
          <filter id="mi-cursor-shadow" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#111110" floodOpacity="0.32" />
          </filter>
        </defs>
        <path
          d="M3 2.2v15.6c0 .5.6.8 1 .4l3.7-3.6 2.4 5.5c.2.4.6.6 1 .4l2-.9c.4-.2.6-.6.4-1l-2.4-5.4h5.2c.5 0 .8-.6.4-1L4 1.8c-.4-.4-1-.1-1 .4Z"
          fill="#111110"
          stroke="white"
          strokeWidth="1.4"
          strokeLinejoin="round"
          filter="url(#mi-cursor-shadow)"
        />
      </svg>
    </div>
  )
}

/** Expanding ring at a click point (stage px), drawn into `layer` and removed when done. */
export function spawnClickRipple(layer: HTMLElement, x: number, y: number) {
  const ring = document.createElement("div")
  ring.className = "pointer-events-none absolute size-9 rounded-full border-2 border-mi-select/60 bg-mi-select/15"
  ring.style.left = `${x - 18}px`
  ring.style.top = `${y - 18}px`
  layer.appendChild(ring)
  const animation = ring.animate(
    [
      { transform: "scale(0.3)", opacity: 1 },
      { transform: "scale(1)", opacity: 0 },
    ],
    { duration: 450, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  )
  animation.onfinish = () => ring.remove()
}
