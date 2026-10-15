"use client"

import { useLayoutEffect, useRef, useState } from "react"

const SELECT_BLUE = "#2f6bf6"
const MARGIN_GREY = "#8a8784"

/**
 * Selection chrome for a layer inside a frame's artwork (the trip card's nights numeral, found by
 * its `data-layer`): a thin blue outline with square corner handles and, when it has a top margin,
 * the margin drawn as in the screenshot design: a dashed grey line where the margin starts, joined
 * to the layer's top edge by a dashed blue line down the middle.
 *
 * It lives in the artwork's scaled container, so it's laid out in artwork units; line widths and
 * handle sizes are divided by `zoom` to stay the same on screen. The parent must be positioned
 * (the layer's offsets are read against it).
 */
export function LayerSelectionOverlay({ layer, marginTop, zoom }: { layer: string; marginTop: number; zoom: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  // Re-measured whenever the margin changes (the layer moves down as it grows).
  useLayoutEffect(() => {
    const el = ref.current?.parentElement?.querySelector<HTMLElement>(`[data-layer="${layer}"]`)
    if (!el) return
    setBox({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight })
  }, [layer, marginTop])

  const line = 1 / zoom
  const handle = 7 / zoom
  const dash = { borderStyle: "dashed" as const }

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {box && (
        <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
          {/* Outline */}
          <div className="absolute inset-0" style={{ boxShadow: `0 0 0 ${line}px ${SELECT_BLUE}` }} />

          {/* Corner handles */}
          {(["0% 0%", "100% 0%", "0% 100%", "100% 100%"] as const).map((corner) => {
            const [x, y] = corner.split(" ")
            return (
              <span
                key={corner}
                className="absolute -translate-x-1/2 -translate-y-1/2 bg-white"
                style={{
                  left: x,
                  top: y,
                  width: handle,
                  height: handle,
                  boxShadow: `inset 0 0 0 ${line}px ${SELECT_BLUE}`,
                }}
              />
            )
          })}

          {marginTop > 0 && (
            <>
              {/* Where the margin starts: a dashed grey line across the layer's width */}
              <div
                className="absolute inset-x-0"
                style={{ top: -marginTop, borderTopWidth: line, borderColor: MARGIN_GREY, ...dash }}
              />
              {/* The margin itself: a dashed blue line from there down to the layer's top edge */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: -marginTop, height: marginTop, borderLeftWidth: line, borderColor: SELECT_BLUE, ...dash }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
