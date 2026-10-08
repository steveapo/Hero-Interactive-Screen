"use client"

import { Play, ScanLine, SquareDashedMousePointer } from "lucide-react"
import { AirbnbScreen } from "@/app/copy-project/airbnb-screen"

/** The canvas opens at this zoom; the user can then zoom between the hero's min/max. */
export const CANVAS_ZOOM = 0.3

/** The Codebase frame's opening animation plays at this rate (1 = the app's own pace). */
const CODEBASE_INTRO_SPEED = 0.6

/**
 * Canvas-unit size of the Codebase frame: the desktop preview resolution (1440×900).
 * Its centre is the canvas origin at load.
 */
export const CODEBASE_WIDTH = 1440
export const CODEBASE_HEIGHT = 900

/** Focus colour for the Codebase frame: label, icon, border and size tag. */
const CODEBASE_GREEN = "#1fc15a"
const LABEL_GREY = "#78716c"

export function CodebaseFrame({
  selected,
  onSelect,
  onMoveStart,
  onOpen,
  covered = false,
  zoom,
  offsetX,
  offsetY,
  appear,
}: {
  /**
   * Load-in: "hidden" keeps the frame invisible and its live app unmounted; "in" fades the frame
   * in and mounts the app, so the app's own opening animation plays from that moment.
   * Omitted: the frame is simply there.
   */
  appear?: "hidden" | "in"
  selected: boolean
  onSelect: () => void
  /** Double-click: open the frame in the Portal View. */
  onOpen: () => void
  /**
   * The Portal covers the whole screen: the live app isn't laid out or painted (it keeps its
   * state and its intro's timeline), so it costs nothing while the hero window resizes under it.
   */
  covered?: boolean
  /** Pointer pressed on the frame: the canvas may start dragging it. */
  onMoveStart: (e: React.PointerEvent) => void
  /** Current canvas zoom — scales the frame; labels stay screen-sized. */
  zoom: number
  /** Screen-px offset of the frame's centre from the viewport centre (canvas pan + frame position). */
  offsetX: number
  offsetY: number
}) {
  return (
    <div
      data-cursor-id="codebase-frame"
      className={
        appear === "in"
          ? "absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in duration-700 motion-reduce:animate-none"
          : "absolute -translate-x-1/2 -translate-y-1/2"
      }
      style={{
        left: `calc(50% + ${offsetX}px)`,
        top: `calc(50% + ${offsetY}px)`,
        width: CODEBASE_WIDTH * zoom,
        height: CODEBASE_HEIGHT * zoom,
        visibility: appear === "hidden" ? "hidden" : undefined,
      }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
        onMoveStart(e)
      }}
      onDoubleClick={onOpen}
    >
      {/* Label row */}
      <div className="absolute inset-x-0 -top-7 flex h-6 items-center justify-between">
        <span
          className="flex items-center gap-1.5 font-medium transition-colors"
          style={{ fontSize: 13, color: selected ? CODEBASE_GREEN : LABEL_GREY }}
        >
          <CodebaseIcon />
          Codebase
        </span>
        {selected && (
          <div className="flex items-center gap-0.5 text-stone-600">
            <FrameAction label="Capture selection">
              <SquareDashedMousePointer className="size-3.5" strokeWidth={1.5} />
            </FrameAction>
            <FrameAction label="Capture page">
              <ScanLine className="size-3.5" strokeWidth={1.5} />
            </FrameAction>
            <span className="mx-1 h-3.5 w-px bg-stone-300" />
            <FrameAction label="Open preview">
              <Play className="size-3.5 fill-current" strokeWidth={1.5} />
            </FrameAction>
          </div>
        )}
      </div>

      {/*
        The desktop viewport: the live, functional Fairbnb app. It is authored in cqw units, so
        the screen is a size container and the app scales with zoom.
      */}
      <div className="size-full cursor-default overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(17,17,16,0.12),0_12px_32px_-12px_rgba(17,17,16,0.3)]">
        <div
          className="@container size-full overflow-hidden bg-white"
          style={covered ? { contentVisibility: "hidden" } : undefined}
        >
          {appear !== "hidden" && <AirbnbScreen introSpeed={CODEBASE_INTRO_SPEED} />}
        </div>
      </div>

      {selected && (
        <>
          <div
            className="pointer-events-none absolute -inset-px"
            style={{ border: `1px solid ${CODEBASE_GREEN}` }}
          />
          <span
            className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-[2px] px-1 py-px font-mono font-semibold tabular-nums text-white"
            style={{ background: CODEBASE_GREEN, fontSize: 10, lineHeight: "16px" }}
          >
            {CODEBASE_WIDTH} × {CODEBASE_HEIGHT}
          </span>
        </>
      )}
    </div>
  )
}

/** Frame toolbar button: green icon on a light-green tile + tooltip above on hover/focus. */
function FrameAction({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="group relative flex size-6 items-center justify-center rounded-[5px] transition-colors hover:bg-[#1fc15a]/15 hover:text-[#1fc15a] focus-visible:bg-[#1fc15a]/15 focus-visible:text-[#1fc15a] focus-visible:outline-none"
    >
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-stone-200 px-2 py-1 text-[13px] leading-4 text-stone-800 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {label}
      </span>
    </button>
  )
}

function CodebaseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.08 1H1.92C1.41 1 1 1.41 1 1.92v10.15c0 .51.41.92.92.92h10.15c.51 0 .92-.41.92-.92V1.92C13 1.41 12.59 1 12.08 1Z" />
      <path d="M1 3.5h12" />
      <path d="m4.13 6.75 1.5 1.5-1.5 1.5" />
      <path d="M7.88 8.25h2" />
    </svg>
  )
}
