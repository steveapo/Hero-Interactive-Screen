"use client"

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { MousePointer2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GuideTarget } from "./steps"

/** A spotlighted element's cut-out, in px from the spotlight's top-left. */
type Hole = {
  x: number
  y: number
  w: number
  h: number
  pad: number
  radius: number
  label?: string
  labelAlign: "center" | "start" | "end"
}

type Point = { x: number; y: number }

/** The drag ghost's size (px). */
const GHOST = { w: 72, h: 48 }

/** Gap between a cut-out and its label (px). */
const LABEL_GAP = 12

/**
 * Spotlight over the screen: everything is dimmed except the targets, which get a breathing lime
 * ring; the first target with a label gets it pinned beside it. Optionally a ghost card loops along
 * the drag to make. Purely visual (it never takes a click), and the dim lifts while the pointer is
 * held down, so drags and longer presses happen on an undimmed screen.
 *
 * Targets are found by selector and re-measured every frame, so the cut-outs follow the canvas as
 * it pans and zooms, and frames as they're dragged.
 */
export function Spotlight({
  targets,
  dragHint = null,
  reservedRight = 0,
}: {
  targets: GuideTarget[]
  dragHint?: { from: string; to: string } | null
  /** Width along the right edge kept clear of labels (e.g. where the guide card is docked), px. */
  reservedRight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const maskId = `guide-mask-${useId().replace(/:/g, "")}`
  const [holes, setHoles] = useState<Hole[]>([])
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    let frame = 0
    function measure() {
      const root = ref.current
      if (root) {
        const base = root.getBoundingClientRect()
        const next: Hole[] = []
        for (const t of targets) {
          const unless = t.unless === undefined ? [] : Array.isArray(t.unless) ? t.unless : [t.unless]
          if (unless.some((selector) => document.querySelector(selector))) continue
          const found = t.all ? Array.from(document.querySelectorAll(t.selector)) : [document.querySelector(t.selector)]
          found.forEach((el, i) => {
            if (!el) return
            const r = el.getBoundingClientRect()
            if (r.width === 0 && r.height === 0) return
            next.push({
              x: Math.round(r.left - base.left),
              y: Math.round(r.top - base.top),
              w: Math.round(r.width),
              h: Math.round(r.height),
              pad: t.padding ?? 6,
              radius: t.radius ?? 10,
              // Several matches: the label goes on the first one only.
              label: i === 0 ? t.label : undefined,
              labelAlign: t.labelAlign ?? "center",
            })
          })
        }
        setHoles((prev) => (sameHoles(prev, next) ? prev : next))
        setSize((prev) =>
          prev.w === Math.round(base.width) && prev.h === Math.round(base.height)
            ? prev
            : { w: Math.round(base.width), h: Math.round(base.height) },
        )

        const from = dragHint && document.querySelector(dragHint.from)?.getBoundingClientRect()
        const to = dragHint && document.querySelector(dragHint.to)?.getBoundingClientRect()
        const nextDrag =
          from && to
            ? {
                from: { x: Math.round(from.left + from.width / 2 - base.left), y: Math.round(from.top + from.height / 2 - base.top) },
                to: { x: Math.round(to.left + to.width / 2 - base.left), y: Math.round(to.top + to.height / 2 - base.top) },
              }
            : null
        setDrag((prev) =>
          prev && nextDrag && samePoint(prev.from, nextDrag.from) && samePoint(prev.to, nextDrag.to)
            ? prev
            : prev === nextDrag
              ? prev
              : nextDrag,
        )
      }
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [targets, dragHint])

  // The dim lifts while the pointer is held (a drag, a long press), and comes back on release.
  useEffect(() => {
    const down = () => setPressed(true)
    const up = () => setPressed(false)
    window.addEventListener("pointerdown", down, true)
    window.addEventListener("pointerup", up, true)
    window.addEventListener("pointercancel", up, true)
    return () => {
      window.removeEventListener("pointerdown", down, true)
      window.removeEventListener("pointerup", up, true)
      window.removeEventListener("pointercancel", up, true)
    }
  }, [])

  const labelled = holes.find((h) => h.label)

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[70]">
      {holes.length > 0 && size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          className="absolute inset-0 animate-in fade-in duration-300"
          // Quick clicks don't flicker it: the dim only lifts once the press has lasted a moment.
          style={{ opacity: pressed ? 0 : 1, transition: `opacity 220ms ease-out ${pressed ? "160ms" : "0ms"}` }}
        >
          <defs>
            <mask id={maskId}>
              <rect width={size.w} height={size.h} fill="white" />
              {holes.map((h, i) => (
                <rect
                  key={i}
                  x={h.x - h.pad}
                  y={h.y - h.pad}
                  width={h.w + h.pad * 2}
                  height={h.h + h.pad * 2}
                  rx={Math.min(h.radius, (h.h + h.pad * 2) / 2)}
                  fill="black"
                />
              ))}
            </mask>
          </defs>
          <rect width={size.w} height={size.h} fill="rgba(17, 17, 16, 0.42)" mask={`url(#${maskId})`} />
        </svg>
      )}

      {holes.map((h, i) => (
        <div
          key={i}
          className="absolute border-2 border-mi-lime animate-mi-guide-pulse"
          style={{
            left: h.x - h.pad,
            top: h.y - h.pad,
            width: h.w + h.pad * 2,
            height: h.h + h.pad * 2,
            borderRadius: Math.min(h.radius, (h.h + h.pad * 2) / 2),
          }}
        />
      ))}

      {labelled && size.w > 0 && (
        <HoleLabel hole={labelled} width={size.w - reservedRight} fullWidth={size.w} height={size.h} />
      )}

      {/* While the visitor drags (or holds), the hint steps aside. */}
      {drag && !pressed && <DragGhost from={drag.from} to={drag.to} />}
    </div>
  )
}

/** One loop of the drag hint (ms), and its curve. */
const DRAG_LOOP_MS = 2600
const DRAG_EASING = "cubic-bezier(0.45, 0, 0.2, 1)"

/**
 * The drag hint: a ghost card with a cursor, carried from `from` to `to` (centres, px), fading in at
 * the start and out at the end, on a loop. Animated with concrete positions (restarted when they
 * move), and invisible until the animation runs, so it never sits anywhere else.
 */
function DragGhost({ from, to }: { from: Point; to: Point }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const at = (p: Point, scale: number) => `translate(${p.x - GHOST.w / 2}px, ${p.y - GHOST.h / 2}px) scale(${scale})`
    const animation = el.animate(
      [
        { offset: 0, opacity: 0, transform: at(from, 1) },
        { offset: 0.12, opacity: 1, transform: at(from, 0.96) },
        { offset: 0.72, opacity: 1, transform: at(to, 0.9) },
        { offset: 0.88, opacity: 0, transform: at(to, 0.9) },
        { offset: 1, opacity: 0, transform: at(to, 0.9) },
      ],
      { duration: DRAG_LOOP_MS, easing: DRAG_EASING, iterations: Infinity },
    )
    return () => animation.cancel()
  }, [from.x, from.y, to.x, to.y])

  return (
    <div ref={ref} className="absolute left-0 top-0 opacity-0" style={{ width: GHOST.w, height: GHOST.h }}>
      <div className="size-full rounded-lg border-2 border-dashed border-mi-lime-deep bg-white/80 shadow-[0_10px_24px_-10px_rgba(17,17,16,0.45)]" />
      <MousePointer2
        className="absolute -bottom-3 -right-2 size-6 fill-mi-ink text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
        strokeWidth={1.5}
      />
    </div>
  )
}

/**
 * The instruction pinned to a cut-out. Centred (default): below it when there's room, else above;
 * a cut-out that fills most of the screen (e.g. the whole live app) gets it inside, along its top
 * edge; kept left of `width` (the area right of it is reserved). "start" / "end": just above the
 * cut-out, flush with its left / right edge (anywhere on screen, `fullWidth`), e.g. a chat composer.
 */
function HoleLabel({ hole, width, fullWidth, height }: { hole: Hole; width: number; fullWidth: number; height: number }) {
  const className =
    "absolute flex h-8 items-center whitespace-nowrap rounded-full bg-mi-lime px-3.5 text-[13px] font-semibold text-mi-lime-ink shadow-[0_8px_20px_-8px_rgba(22,33,10,0.55)] animate-in fade-in zoom-in-95 duration-200"
  if (hole.labelAlign !== "center") {
    const top = Math.max(8, hole.y - hole.pad - LABEL_GAP - 32)
    return hole.labelAlign === "start" ? (
      <div className={className} style={{ left: Math.max(8, hole.x - hole.pad), top }}>
        {hole.label}
      </div>
    ) : (
      <div className={className} style={{ right: Math.max(8, fullWidth - (hole.x + hole.w + hole.pad)), top }}>
        {hole.label}
      </div>
    )
  }
  const inside = hole.h > height * 0.5
  const below = hole.y + hole.h + hole.pad + LABEL_GAP + 34 < height
  const top = inside
    ? hole.y + LABEL_GAP + 4
    : below
      ? hole.y + hole.h + hole.pad + LABEL_GAP
      : hole.y - hole.pad - LABEL_GAP - 32
  const centre = Math.min(Math.max(hole.x + Math.min(hole.w, width - hole.x) / 2, 110), width - 110)
  return (
    <div className={cn(className, "-translate-x-1/2")} style={{ left: centre, top: Math.max(8, top) }}>
      {hole.label}
    </div>
  )
}

function samePoint(a: Point, b: Point) {
  return a.x === b.x && a.y === b.y
}

function sameHoles(a: Hole[], b: Hole[]) {
  return (
    a.length === b.length &&
    a.every(
      (h, i) =>
        h.x === b[i].x &&
        h.y === b[i].y &&
        h.w === b[i].w &&
        h.h === b[i].h &&
        h.pad === b[i].pad &&
        h.radius === b[i].radius &&
        h.label === b[i].label &&
        h.labelAlign === b[i].labelAlign,
    )
  )
}
