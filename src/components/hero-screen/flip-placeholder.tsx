"use client"

import { useId, useLayoutEffect, useRef } from "react"

/** How long a placeholder's dashed outline takes to draw round (ms). */
export const PLACEHOLDER_DRAW_MS = 500
/** Its fade out, centred on the moment its element lands on it (ms). */
const PLACEHOLDER_FADE_MS = 450

/**
 * The "flip" load-in's placeholder for a canvas element: a flat dashed outline at the element's
 * place on the canvas, drawn round (from its top-left corner, clockwise) at `appearAt`, before the
 * element comes up onto it; it fades away as the element lands on it at `landAt` (ms after `play`).
 *
 * Mounted (hidden) well ahead of time; nothing shows until `play`. Positioned like the canvas
 * frames (screen px from the canvas centre), so it stays put under the element if the canvas pans.
 *
 * The element comes in only after the outline has been drawn all the way round: callers start it
 * at least PLACEHOLDER_DRAW_MS after `appearAt`.
 */
export function FlipPlaceholder({
  left,
  top,
  width,
  height,
  radius,
  play,
  appearAt,
  landAt,
}: {
  /** Top-left, in screen px from the canvas centre. */
  left: number
  top: number
  width: number
  height: number
  /** Corner radius (screen px). */
  radius: number
  play: boolean
  appearAt: number
  landAt: number
}) {
  const ref = useRef<SVGSVGElement>(null)
  // A plain id (React's ids may hold characters that don't survive inside url(#…)).
  const maskId = `flip-placeholder-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`

  useLayoutEffect(() => {
    const svg = ref.current
    const reveal = svg?.querySelector<SVGRectElement>("[data-reveal]")
    if (!play || !svg || !reveal) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const fadeStart = Math.max(appearAt + PLACEHOLDER_DRAW_MS, landAt - PLACEHOLDER_FADE_MS / 2)
    const end = fadeStart + PLACEHOLDER_FADE_MS
    // Shown from appearAt (base style hidden), held, then gone as the element lands.
    const show = svg.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 0, offset: appearAt / end },
        { opacity: 1, offset: Math.min(1, (appearAt + 1) / end) },
        { opacity: 1, offset: fadeStart / end },
        { opacity: 0, offset: 1 },
      ],
      { duration: end, easing: "linear" },
    )
    // The dashes are revealed round the outline by a solid stroke drawing in the mask.
    const draw = reveal.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: PLACEHOLDER_DRAW_MS,
      delay: appearAt,
      easing: "cubic-bezier(0.45, 0, 0.25, 1)",
      fill: "backwards",
    })
    return () => {
      show.cancel()
      draw.cancel()
    }
    // Plays once, when the load-in reaches the elements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play])

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute overflow-visible"
      style={{
        left: `calc(50% + ${left}px)`,
        top: `calc(50% + ${top}px)`,
        width,
        height,
        opacity: 0,
      }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-8} y={-8} width={width + 16} height={height + 16}>
          <rect
            data-reveal=""
            width={width}
            height={height}
            rx={radius}
            fill="none"
            stroke="white"
            strokeWidth={6}
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={0}
          />
        </mask>
      </defs>
      <rect
        width={width}
        height={height}
        rx={radius}
        fill="none"
        stroke="rgba(120,113,108,0.7)"
        strokeWidth={1}
        strokeDasharray="5 4"
        mask={`url(#${maskId})`}
      />
    </svg>
  )
}
