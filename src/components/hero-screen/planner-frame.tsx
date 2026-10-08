"use client"

import { useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { CODEBASE_WIDTH } from "./codebase-frame"
import type { CanvasRect } from "./drag"

const SELECT_BLUE = "#2f6bf6"
const LABEL_GREY = "#78716c"
/** The Build Agent's working outline: green like its lime badge, but dark enough to read on the canvas. */
const AGENT_GREEN = "#5aa312"

/** A frame corner: -1 = left/top, 1 = right/bottom. */
export type Corner = { sx: -1 | 1; sy: -1 | 1 }

/**
 * Canvas reveal around the Portal: `"hidden"` while the Portal is open (or fading out), so only
 * the Codebase frame is on the canvas; then an entrance where the element glides in from
 * `x`/`y` screen px away (its side of the Codebase frame) after `delay` ms, over `duration` ms
 * (ENTRANCE_DURATION_MS when omitted).
 */
export type CanvasEntrance = "hidden" | { x: number; y: number; delay: number; duration?: number }

export const ENTRANCE_DURATION_MS = 1280
/**
 * Long, soft ease-out (fast start, very gradual settle) with no bounce, so elements drift into
 * place. Opacity has its own gentler curve so the fade doesn't finish before the glide gets going.
 */
const ENTRANCE_EASING = "cubic-bezier(0.16, 1, 0.3, 1)"
const ENTRANCE_FADE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)"
/** Elements start slightly smaller and grow as they arrive. */
const ENTRANCE_START_SCALE = 0.96

/**
 * Hides an element or plays its entrance. Both are done inline (style + Web Animations API) so
 * they work without any stylesheet rule. The entrance plays once, on mount: the canvas remounts
 * its elements on each reveal. Spread `style` before the element's own style.
 */
export function useCanvasEntrance<T extends HTMLElement>(entrance: CanvasEntrance | null | undefined) {
  const ref = useRef<T>(null)
  const onMount = useRef(entrance)

  useLayoutEffect(() => {
    const el = ref.current
    const e = onMount.current
    if (!el || !e || e === "hidden") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // Two animations: the glide (transform) and the fade (opacity), each on its own curve.
    // `backwards` keeps the start frame (hidden, offset) applied during the delay.
    const timing = { duration: e.duration ?? ENTRANCE_DURATION_MS, delay: e.delay, fill: "backwards" } as const
    const glide = el.animate(
      [
        { transform: `translate(${e.x}px, ${e.y}px) scale(${ENTRANCE_START_SCALE})` },
        { transform: "translate(0px, 0px) scale(1)" },
      ],
      { ...timing, easing: ENTRANCE_EASING },
    )
    const fade = el.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.5 },
        { opacity: 1, offset: 1 },
      ],
      { ...timing, easing: ENTRANCE_FADE_EASING },
    )
    return () => {
      glide.cancel()
      fade.cancel()
    }
  }, [])

  const style: React.CSSProperties | undefined = entrance === "hidden" ? { opacity: 0, pointerEvents: "none" } : undefined
  return { ref, style }
}

const CORNERS: (Corner & { cursor: string })[] = [
  { sx: -1, sy: -1, cursor: "nwse-resize" },
  { sx: 1, sy: -1, cursor: "nesw-resize" },
  { sx: -1, sy: 1, cursor: "nesw-resize" },
  { sx: 1, sy: 1, cursor: "nwse-resize" },
]

/** Radius thumbs only show once the frame is at least this big on screen (px), i.e. zoomed in enough. */
const RADIUS_THUMBS_MIN_SIZE = 80
/** Screen-px inset of a radius thumb from its corner while the radius is smaller than that. */
const RADIUS_THUMB_INSET = 12

/**
 * Round thumbs inside each corner of a selected frame: drag one diagonally inward to round all
 * four corners (see `startRadiusDrag` in hero-screen). A thumb sits at the centre of the corner
 * arc (radius × zoom from both edges), never closer to the corner than RADIUS_THUMB_INSET.
 */
export function RadiusThumbs({
  w,
  h,
  radius,
  zoom,
  onRadiusStart,
}: {
  /** Frame size in canvas units. */
  w: number
  h: number
  /** Current corner radius in canvas units. */
  radius: number
  zoom: number
  onRadiusStart: (e: React.PointerEvent, corner: Corner) => void
}) {
  const shortSide = Math.min(w, h) * zoom
  if (shortSide < RADIUS_THUMBS_MIN_SIZE) return null
  const offset = Math.min(shortSide / 2, Math.max(RADIUS_THUMB_INSET, radius * zoom))
  return (
    <>
      {CORNERS.map(({ sx, sy }) => (
        <span
          key={`radius${sx}${sy}`}
          aria-hidden="true"
          className="pointer-events-auto absolute z-10 flex size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-default items-center justify-center"
          style={{
            left: sx < 0 ? offset : `calc(100% - ${offset}px)`,
            top: sy < 0 ? offset : `calc(100% - ${offset}px)`,
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            onRadiusStart(e, { sx, sy })
          }}
        >
          <span className="size-2 rounded-full border-[1.5px] bg-white" style={{ borderColor: SELECT_BLUE }} />
        </span>
      ))}
    </>
  )
}

/**
 * A static design frame on the hero canvas: one element of the Fairbnb desktop app (see airbnb-elements).
 * The artwork is authored in cqw of the desktop screen, so it is laid out at its natural canvas size
 * inside a container as wide as the screen, then scaled with zoom. Resizing the frame crops the
 * artwork from the top-left, like a design frame does; it doesn't reflow.
 */
export function DesignFrame({
  id,
  label,
  rect,
  naturalSize,
  fill,
  radius,
  border,
  bare = false,
  repaint = null,
  labelOnSelect = false,
  children,
  selected,
  onSelect,
  onMoveStart,
  onResizeStart,
  onRadiusStart,
  showAgentButton,
  onOpenAgent,
  working = false,
  agentBusy = false,
  zoom,
  offsetX,
  offsetY,
  entrance,
}: {
  id: string
  label: string
  /** Frame position and size in canvas units. */
  rect: CanvasRect
  /** Size the artwork was authored at, in canvas units. */
  naturalSize: { w: number; h: number }
  /** Fill colour; null = transparent. */
  fill: string | null
  /** Corner radius in canvas units; null = square. */
  radius: number | null
  /** 1px border colour; null = none. */
  border: string | null
  /** The artwork paints its own shape (e.g. a card with its own shadow): the frame itself stays transparent. */
  bare?: boolean
  /** A bare frame's fill changed in the settings panel: painted over the artwork's own background. */
  repaint?: string | null
  /** Only show the name above the frame while it is selected. */
  labelOnSelect?: boolean
  children: React.ReactNode
  selected: boolean
  /** Pointer pressed on the frame (Shift adds it to / removes it from the selection). */
  onSelect: (e: React.PointerEvent) => void
  /** Pointer pressed on the frame: the canvas may start dragging it. */
  onMoveStart: (e: React.PointerEvent) => void
  /** Pointer pressed on a corner thumb. */
  onResizeStart: (e: React.PointerEvent, corner: Corner) => void
  /** Pointer pressed on a corner-radius thumb. */
  onRadiusStart: (e: React.PointerEvent, corner: Corner) => void
  /** Show the Build Agent button (single selection, input not open yet). */
  showAgentButton: boolean
  onOpenAgent: () => void
  /** The Build Agent is working on this frame: overlay + marching dashed outline. */
  working?: boolean
  /** A Build Agent is generating variants from / building this frame: a spinning agent badge. */
  agentBusy?: boolean
  /** Current canvas zoom — scales the frame; labels stay screen-sized. */
  zoom: number
  /** Screen-px offset of the canvas origin from the viewport centre (canvas pan). */
  offsetX: number
  offsetY: number
  /** Glide in when the canvas is revealed (leaving the Portal). */
  entrance?: CanvasEntrance | null
}) {
  const enter = useCanvasEntrance<HTMLDivElement>(entrance)
  return (
    <div
      ref={enter.ref}
      data-cursor-id={`frame-${id}`}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2",
        // Selected (or an agent's badge on it): above the other canvas elements, so its Build
        // Agent button and "Agent" label, which reach outside the frame, are never covered.
        // (Still below the Build Agent chat and the panels.)
        (selected || agentBusy) && "z-10",
        // bare frames interlock (e.g. Intentionality in Explains' cutout): only the painted shape
        // takes the pointer, so the frame underneath stays clickable through the empty corners
        bare && "pointer-events-none",
      )}
      style={{
        ...enter.style,
        left: `calc(50% + ${offsetX + rect.x * zoom}px)`,
        top: `calc(50% + ${offsetY + rect.y * zoom}px)`,
        width: rect.w * zoom,
        height: rect.h * zoom,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect(e)
        onMoveStart(e)
      }}
    >
      {/* Label row */}
      {(!labelOnSelect || selected) && (
        <span
          className="absolute -top-7 left-0 flex h-6 items-center whitespace-nowrap font-medium transition-colors"
          style={{ fontSize: 13, color: selected ? SELECT_BLUE : LABEL_GREY }}
        >
          {label}
        </span>
      )}

      {/* Frame: fill, radius and border as listed in the settings panel (bare: the artwork paints its own shape) */}
      <div
        className={cn(
          "relative size-full cursor-default",
          bare ? "overflow-visible" : "overflow-hidden",
          fill && !bare && "shadow-[0_12px_32px_-12px_rgba(17,17,16,0.3)]",
        )}
        style={
          bare
            ? undefined
            : {
                background: fill ?? "transparent",
                borderRadius: radius ? radius * zoom : undefined,
                boxShadow: border ? `inset 0 0 0 ${Math.max(zoom, 0.5)}px ${border}` : undefined,
              }
        }
      >
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-0 origin-top-left",
            bare && "[&_[data-anim=block]]:pointer-events-auto [&_[data-anim=fillet]]:pointer-events-auto",
            // A fill picked for a bare frame paints over the artwork's own background, fading to it.
            bare &&
              repaint &&
              "[&_[data-anim=block]]:![background-color:var(--frame-repaint)] [&_[data-anim=block]]:transition-[background-color] [&_[data-anim=block]]:duration-300 [&_[data-anim=block]]:ease-out",
          )}
          style={{
            width: naturalSize.w,
            height: naturalSize.h,
            transform: `scale(${zoom})`,
            ...(bare && repaint ? ({ "--frame-repaint": repaint } as React.CSSProperties) : {}),
          }}
        >
          <div className="@container absolute left-0 top-0 h-full" style={{ width: CODEBASE_WIDTH }}>
            <div className="relative h-full" style={{ width: naturalSize.w }}>
              {children}
            </div>
          </div>
        </div>

        {/* Build Agent working: tint the frame's content */}
        {working && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#5aa312]/15" />}
      </div>

      {/* Build Agent working on it (reading, replying, generating or building): a green dashed
          outline whose dashes march clockwise */}
      {(working || agentBusy) && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[5px] overflow-visible"
          style={{ width: "calc(100% + 10px)", height: "calc(100% + 10px)" }}
        >
          <rect width="100%" height="100%" rx="3" fill="none" stroke={AGENT_GREEN} strokeOpacity="0.25" strokeWidth="3" />
          <rect
            width="100%"
            height="100%"
            rx="3"
            fill="none"
            stroke={AGENT_GREEN}
            strokeWidth="3"
            strokeDasharray="10 6"
            className="animate-mi-march"
          />
        </svg>
      )}

      {selected && (
        <>
          <div
            className="pointer-events-none absolute -inset-px"
            style={{ border: `1px solid ${SELECT_BLUE}` }}
          />
          <span
            className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-[2px] px-1 py-px font-mono font-semibold tabular-nums text-white"
            style={{ background: SELECT_BLUE, fontSize: 10, lineHeight: "16px" }}
          >
            {Math.round(rect.w)} × {Math.round(rect.h)}
          </span>

          {/* Corner thumbs: grab to resize */}
          {CORNERS.map(({ sx, sy, cursor }) => (
            <span
              key={`${sx}${sy}`}
              aria-hidden="true"
              className="pointer-events-auto absolute z-10 flex size-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              style={{ left: sx < 0 ? 0 : "100%", top: sy < 0 ? 0 : "100%", cursor }}
              onPointerDown={(e) => {
                e.stopPropagation()
                onResizeStart(e, { sx, sy })
              }}
            >
              <span className="size-2 border bg-white" style={{ borderColor: SELECT_BLUE }} />
            </span>
          ))}

          {/* Radius thumbs: drag to round the corners (bare frames paint their own shape) */}
          {!bare && (
            <RadiusThumbs w={rect.w} h={rect.h} radius={radius ?? 0} zoom={zoom} onRadiusStart={onRadiusStart} />
          )}

          {showAgentButton && !agentBusy && <BuildAgentButton onClick={onOpenAgent} />}
        </>
      )}

      {/* A Build Agent is generating from / building this frame (chat closed): only its spinning badge */}
      {agentBusy && <BuildAgentBadge />}
    </div>
  )
}

/** The Build Agent button's badge, spinning: an agent is busy with this frame. */
export function BuildAgentBadge() {
  return (
    <span
      data-agent-busy
      aria-label="Build Agent working"
      className="pointer-events-none absolute left-full top-0 ml-2.5 flex size-[26px] items-center justify-center rounded-full bg-mi-lime text-stone-900 shadow-[0_4px_12px_-2px_rgba(90,122,24,0.28)] animate-in zoom-in-75 fade-in duration-200"
    >
      <AgentStar className="size-[13px] animate-spin [animation-duration:2.4s]" />
    </span>
  )
}

/** Lime Build Agent button off the frame's (or selection's) top-right corner; hover spins the star and shows "Agent". */
export function BuildAgentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Build Agent"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="group pointer-events-auto absolute left-full top-0 ml-2.5 flex items-center"
    >
      <span className="flex size-[26px] items-center justify-center rounded-full bg-mi-lime text-stone-900 shadow-[0_4px_12px_-2px_rgba(90,122,24,0.28)] transition-colors group-hover:bg-mi-lime-deep">
        <AgentStar className="size-[13px] transition-transform duration-500 ease-out group-hover:rotate-180" />
      </span>
      <span className="pointer-events-none absolute left-full ml-1.5 -translate-x-1 whitespace-nowrap rounded-full bg-stone-200 px-2.5 py-1 text-[13px] font-medium leading-4 text-stone-800 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
        Agent
      </span>
    </button>
  )
}

/** Build Agent mark: a five-armed star with rounded arms, slightly tilted. */
export function AgentStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M7 7 12.42 7.96M7 7 9.58 2.14M7 7 3.18 3.04M7 7 2.06 9.41M7 7 7.77 12.45" />
    </svg>
  )
}

/** Same glyph as the toolbar's Frame tool. */
export function FrameGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 1v12M10 1v12M1 4h12M1 10h12" />
    </svg>
  )
}
