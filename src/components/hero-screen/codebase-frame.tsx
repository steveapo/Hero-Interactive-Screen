"use client"

import { Play, ScanLine, SquareDashedMousePointer } from "lucide-react"

/** The canvas renders at this zoom — shown in the bottom-right zoom badge. */
export const CANVAS_ZOOM = 0.54

const SCREEN_WIDTH = 1440
const SCREEN_HEIGHT = 900

/** Focus colour for the Codebase frame: label, icon, border and size tag. */
const CODEBASE_GREEN = "#1fc15a"
const LABEL_GREY = "#78716c"

export function CodebaseFrame({
  selected,
  onSelect,
}: {
  selected: boolean
  onSelect: () => void
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ width: SCREEN_WIDTH * CANVAS_ZOOM, height: SCREEN_HEIGHT * CANVAS_ZOOM }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
      }}
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

      {/* Device bezel + screen (empty for now) */}
      <div className="size-full cursor-default rounded-lg bg-black p-2 shadow-[0_12px_32px_-12px_rgba(17,17,16,0.3)]">
        <div className="size-full rounded-[2px] bg-white" />
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
            {SCREEN_WIDTH} × {SCREEN_HEIGHT}
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
