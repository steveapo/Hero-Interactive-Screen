"use client"

import { cn } from "@/lib/utils"
import { CODEBASE_WIDTH } from "./codebase-frame"
import type { CanvasRect } from "./drag"

const SELECT_BLUE = "#2f6bf6"
const LABEL_GREY = "#78716c"

/** A frame corner: -1 = left/top, 1 = right/bottom. */
export type Corner = { sx: -1 | 1; sy: -1 | 1 }

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
 * A static design frame on the hero canvas: one element of the iPad Calendar (see calendar-elements).
 * The artwork is authored in cqw of the iPad screen, so it is laid out at its natural canvas size
 * inside a container as wide as the iPad, then scaled with zoom. Resizing the frame crops the
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
  zoom,
  offsetX,
  offsetY,
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
  /** The artwork paints its own shape (e.g. a carved event): the frame itself stays transparent. */
  bare?: boolean
  /** Only show the name above the frame while it is selected. */
  labelOnSelect?: boolean
  children: React.ReactNode
  selected: boolean
  onSelect: () => void
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
  /** Current canvas zoom — scales the frame; labels stay screen-sized. */
  zoom: number
  /** Screen-px offset of the canvas origin from the viewport centre (canvas pan). */
  offsetX: number
  offsetY: number
}) {
  return (
    <div
      data-cursor-id={`frame-${id}`}
      className={cn(
        "absolute -translate-x-1/2 -translate-y-1/2",
        // bare frames interlock (e.g. Intentionality in Explains' cutout): only the painted shape
        // takes the pointer, so the frame underneath stays clickable through the empty corners
        bare && "pointer-events-none",
      )}
      style={{
        left: `calc(50% + ${offsetX + rect.x * zoom}px)`,
        top: `calc(50% + ${offsetY + rect.y * zoom}px)`,
        width: rect.w * zoom,
        height: rect.h * zoom,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
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
          )}
          style={{ width: naturalSize.w, height: naturalSize.h, transform: `scale(${zoom})` }}
        >
          <div className="@container absolute left-0 top-0 h-full" style={{ width: CODEBASE_WIDTH }}>
            <div className="relative h-full" style={{ width: naturalSize.w }}>
              {children}
            </div>
          </div>
        </div>

        {/* Build Agent working: tint the frame's content */}
        {working && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#2f6bf6]/25" />}
      </div>

      {/* Build Agent working: dashed outline whose dashes march clockwise */}
      {working && (
        <svg aria-hidden="true" className="pointer-events-none absolute -inset-[5px] overflow-visible" style={{ width: "calc(100% + 10px)", height: "calc(100% + 10px)" }}>
          <rect width="100%" height="100%" rx="3" fill="none" stroke={SELECT_BLUE} strokeOpacity="0.25" strokeWidth="3" />
          <rect
            width="100%"
            height="100%"
            rx="3"
            fill="none"
            stroke={SELECT_BLUE}
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

          {showAgentButton && <BuildAgentButton onClick={onOpenAgent} />}
        </>
      )}
    </div>
  )
}

/** Lime Build Agent button off the frame's top-right corner; hover spins the star and shows "Agent". */
function BuildAgentButton({ onClick }: { onClick: () => void }) {
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
