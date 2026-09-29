"use client"

import { useState } from "react"
import {
  ArrowUp,
  Asterisk,
  Component,
  Crosshair,
  Hammer,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { COLLABORATORS, type CanvasFrame } from "./data"

/* --------------------------------- Frames --------------------------------- */

const HANDLE_POSITIONS = [
  [0, 0],
  [50, 0],
  [100, 0],
  [0, 50],
  [100, 50],
  [0, 100],
  [50, 100],
  [100, 100],
] as const

export function FrameView({
  frame,
  selected,
  dragging,
  onPointerDown,
}: {
  frame: CanvasFrame
  selected: boolean
  dragging: boolean
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={cn("absolute touch-none select-none", dragging ? "cursor-grabbing" : "cursor-grab")}
      style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
    >
      <span
        className={cn(
          "absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap text-px-11 font-medium",
          selected ? "text-mi-select" : "text-stone-500",
        )}
      >
        {frame.kind === "portal" && <span className="size-1.5 rounded-full bg-mi-add" />}
        {frame.name}
      </span>

      <div
        className={cn(
          "absolute inset-0 overflow-hidden bg-white",
          frame.kind === "mobile" ? "rounded-[18px]" : "rounded-lg",
          "shadow-[0_0_0_0.5px_rgba(17,17,16,0.08),0_1px_2px_rgba(17,17,16,0.04),0_12px_32px_-12px_rgba(17,17,16,0.14)]",
        )}
      >
        <FramePlaceholder frame={frame} />
      </div>

      {selected && (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-[1px] ring-[1.5px] ring-mi-select" />
          {HANDLE_POSITIONS.map(([left, top]) => (
            <span
              key={`${left}-${top}`}
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-[1.5px] border-mi-select bg-white"
              style={{ left: `${left}%`, top: `${top}%` }}
            />
          ))}
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-[4px] bg-mi-select px-1.5 py-px text-px-10 font-medium tabular-nums text-white"
            style={{ top: frame.h + 8 }}
          >
            {Math.round(frame.w)} × {Math.round(frame.h)}
          </span>
        </>
      )}
    </div>
  )
}

/** Stage 1 placeholder skeletons — Stage 2 swaps these for high-fidelity sample content. */
function FramePlaceholder({ frame }: { frame: CanvasFrame }) {
  if (frame.kind === "portal") {
    return (
      <div className="pointer-events-none flex h-full flex-col">
        <div className="flex h-7 shrink-0 items-center gap-2 border-b border-stone-100 bg-stone-50 px-2.5">
          <span className="flex gap-1">
            <span className="size-2 rounded-full bg-stone-300" />
            <span className="size-2 rounded-full bg-stone-300" />
            <span className="size-2 rounded-full bg-stone-300" />
          </span>
          <span className="mx-auto flex h-4.5 items-center rounded bg-white px-3 font-mono text-[9px] text-stone-500 shadow-[0_0_0_1px_rgba(17,17,16,0.06)]">
            acme.com/checkout
          </span>
        </div>
        <SkeletonBody />
      </div>
    )
  }
  if (frame.kind === "mobile") {
    return (
      <div className="pointer-events-none flex h-full flex-col gap-2 p-3 pt-6">
        <span className="h-2 w-16 rounded-full bg-stone-800" />
        <span className="h-1.5 w-24 rounded-full bg-stone-200" />
        <span className="mt-1 h-24 rounded-lg bg-stone-100" />
        <span className="h-10 rounded-lg bg-stone-100" />
        <span className="h-10 rounded-lg bg-stone-100" />
        <span className="mt-auto h-8 rounded-lg bg-stone-900" />
      </div>
    )
  }
  return <SkeletonBody />
}

function SkeletonBody() {
  return (
    <div className="pointer-events-none grid flex-1 grid-cols-[1.4fr_1fr] gap-3 p-4">
      <div className="flex flex-col gap-2">
        <span className="h-2.5 w-32 rounded-full bg-stone-800" />
        <span className="h-1.5 w-44 rounded-full bg-stone-200" />
        <span className="mt-2 h-8 rounded-md bg-stone-100" />
        <span className="h-8 rounded-md bg-stone-100" />
        <span className="h-8 rounded-md bg-stone-100" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-stone-100 bg-stone-50 p-3">
        <span className="h-2 w-16 rounded-full bg-stone-400" />
        <span className="h-1.5 w-full rounded-full bg-stone-200" />
        <span className="h-1.5 w-3/4 rounded-full bg-stone-200" />
        <span className="mt-auto h-7 rounded-md bg-stone-900" />
      </div>
    </div>
  )
}

/* ---------------------- Code → canvas capture connector ---------------------- */

export function CaptureConnector({ from, to }: { from: CanvasFrame; to: CanvasFrame }) {
  const x1 = from.x + from.w
  const y1 = from.y + from.h / 2
  const x2 = to.x
  const y2 = to.y + to.h / 2
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <>
      <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <path
          d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
          fill="none"
          stroke="#0d7bff"
          strokeWidth={1.25}
          strokeDasharray="4 4"
          opacity={0.55}
        />
        <circle cx={x1} cy={y1} r={3} fill="#0d7bff" />
        <circle cx={x2} cy={y2} r={3} fill="#0d7bff" />
      </svg>
      <span
        className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-1 text-px-10 font-medium text-stone-700 shadow-[0_0_0_1px_rgba(13,123,255,0.25),0_4px_12px_-4px_rgba(17,17,16,0.2)]"
        style={{ left: midX, top: midY }}
      >
        <Crosshair className="size-3 text-mi-select" />
        Captured · editable
      </span>
    </>
  )
}

/* ------------------------------ Agent composer ----------------------------- */

type ComposerMode = "explore" | "build"

export function AgentButton({ frame, onClick }: { frame: CanvasFrame; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Ask the agent about this frame"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex size-8 items-center justify-center rounded-full bg-[#d4fb8e] text-stone-800 shadow-[0_0_0_4px_rgba(200,255,124,0.35),0_0_18px_5px_rgba(200,255,124,0.5),0_4px_12px_-2px_rgba(90,122,24,0.28)] transition-[filter] hover:brightness-95"
      style={{ left: frame.x + frame.w + 10, top: frame.y - 6 }}
    >
      <Asterisk className="size-4" strokeWidth={2.75} />
    </button>
  )
}

export function Composer({ frame, onClose }: { frame: CanvasFrame; onClose: () => void }) {
  const [mode, setMode] = useState<ComposerMode>("explore")
  const [prompt, setPrompt] = useState("")

  return (
    <div
      className="absolute z-30 flex flex-col gap-2 rounded-2xl border-[1.5px] border-mi-select/40 bg-white p-2.5 shadow-[0_10px_32px_-10px_rgba(17,17,16,0.24),0_2px_8px_rgba(17,17,16,0.08)] animate-in fade-in slide-in-from-top-1 duration-200"
      style={{ left: frame.x, top: frame.y + frame.h + 30, width: Math.max(frame.w, 372) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Context: what the agent sees */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="flex h-6 items-center gap-1 rounded-md bg-mi-token/10 pl-1.5 pr-1 text-px-11 font-medium text-mi-token">
          <Component className="size-3" />
          {frame.component}
          <X className="size-3 opacity-60" />
        </span>
        <span className="flex h-6 items-center gap-1 rounded-md bg-stone-100 px-1.5 font-mono text-px-10 text-stone-600">
          {frame.source}
        </span>
        <button
          type="button"
          className="flex h-6 items-center gap-1 rounded-md border border-dashed border-stone-300 px-1.5 text-px-11 text-stone-500 hover:border-stone-400 hover:text-stone-700"
        >
          <Plus className="size-3" />
          Add context
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto flex size-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <textarea
        rows={2}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          mode === "explore"
            ? "Explore 3 directions for a tighter order summary…"
            : "Make Pay the primary action and use space-6 padding…"
        }
        className="block w-full resize-none border-0 bg-transparent px-0.5 text-px-13 leading-snug text-stone-800 placeholder:text-stone-400 focus:outline-none"
      />

      <div className="flex items-center justify-between">
        <div className="inline-flex items-center rounded-full bg-stone-100 p-0.5">
          {(
            [
              ["explore", "Explore", Sparkles],
              ["build", "Build", Hammer],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex h-6 items-center gap-1 rounded-full px-2.5 text-px-11 font-semibold transition-colors",
                mode === value ? "bg-mi-select text-white" : "text-stone-500 hover:text-stone-800",
              )}
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-px-10 text-stone-400">
            {mode === "explore" ? "Variations on canvas" : "Writes a scoped diff"}
          </span>
          <button
            type="button"
            aria-label="Send"
            className="flex size-7 items-center justify-center rounded-full bg-mi-select text-white hover:brightness-110"
          >
            <ArrowUp className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Collaboration ------------------------------ */

export function CollaboratorCursor({ x, y }: { x: number; y: number }) {
  const tereza = COLLABORATORS[0]
  return (
    <div className="pointer-events-none absolute z-30" style={{ left: x, top: y }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M1 1l5.5 13 1.8-5.2L13.5 7z" fill={tereza.color} stroke="white" strokeWidth={1.25} strokeLinejoin="round" />
      </svg>
      <span
        className="ml-3 -mt-0.5 inline-block rounded-full px-2 py-0.5 text-px-11 font-medium text-white"
        style={{ background: tereza.color }}
      >
        {tereza.name}
      </span>
    </div>
  )
}

export function CommentPin({ frame }: { frame: CanvasFrame }) {
  const [open, setOpen] = useState(false)
  const martin = COLLABORATORS[1]

  return (
    <div
      className="absolute z-30"
      style={{ left: frame.x + frame.w - 12, top: frame.y + 36 }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open comment thread"
        className="flex size-7 items-center justify-center rounded-full rounded-bl-none border-2 border-white text-px-11 font-semibold text-white shadow-[0_4px_12px_-4px_rgba(17,17,16,0.35)]"
        style={{ background: martin.color }}
      >
        {martin.initial}
      </button>
      {open && (
        <div className="absolute left-9 top-0 w-56 rounded-xl border border-stone-200 bg-white p-2.5 shadow-[0_12px_32px_-12px_rgba(17,17,16,0.3)] animate-in fade-in zoom-in-95 duration-150">
          <p className="text-px-11 font-semibold text-stone-900">
            {martin.name} <span className="font-normal text-stone-400">· 2m</span>
          </p>
          <p className="mt-0.5 text-px-11 leading-snug text-stone-600">
            Can Pay use our solid Button? Checked it on the live preview.
          </p>
          <p className="mt-2 text-px-11 font-semibold text-stone-900">
            Tereza <span className="font-normal text-stone-400">· now</span>
          </p>
          <p className="mt-0.5 text-px-11 leading-snug text-stone-600">Done, it&apos;s in the diff.</p>
        </div>
      )}
    </div>
  )
}
