"use client"

import { useEffect, useState } from "react"
import { Check, Circle, Copy, Download, Play, Square, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { isStopShortcut } from "./recorder"
import type { CursorRecording } from "./types"

type RecorderToolbarProps = {
  mode: "idle" | "playing" | "recording"
  take: CursorRecording | null
  onRecord: () => void
  onStop: () => void
  onPlay: () => void
  onClear: () => void
  /** Hide the recorder (sets `?record=false`). */
  onClose: () => void
}

/**
 * Dev-only controls, shown by <CursorStage> when the URL has `?record=true` (hide with × or
 * `?record=false`). Record → interact with the stage → Stop (or ⇧Esc). Play previews the smoothed
 * result. Copy / Download export the JSON to paste into the recording file used in production.
 */
export function RecorderToolbar({ mode, take, onRecord, onStop, onPlay, onClear, onClose }: RecorderToolbarProps) {
  const [copied, setCopied] = useState(false)

  // ⇧Esc ends a recording without the trip to the Stop button being recorded. (Plain Escape is
  // left to the app, e.g. closing popovers, so it can be recorded like any other key.)
  useEffect(() => {
    if (mode !== "recording") return
    function onKeyDown(e: KeyboardEvent) {
      if (isStopShortcut(e)) onStop()
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [mode, onStop])

  function copyJson() {
    if (!take) return
    navigator.clipboard.writeText(JSON.stringify(take)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function downloadJson() {
    if (!take) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(take)], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = "cursor-recording.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const button =
    "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-px-12 font-medium text-stone-800 hover:bg-stone-700/5 disabled:pointer-events-none disabled:opacity-40"

  return (
    <div
      data-cursor-ignore
      className="flex items-center gap-0.5 rounded-xl border border-stone-700/10 bg-white/95 p-1 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] backdrop-blur-md"
    >
      {mode === "recording" ? (
        <button type="button" onClick={onStop} className={cn(button, "text-red-600")}>
          <Square className="size-3.5 fill-current" />
          Stop <kbd className="text-px-10 text-stone-500">⇧Esc</kbd>
        </button>
      ) : (
        <button type="button" onClick={onRecord} disabled={mode === "playing"} className={button}>
          <Circle className="size-3.5 fill-red-500 text-red-500" />
          Record
        </button>
      )}

      {mode === "playing" ? (
        <button type="button" onClick={onStop} className={button}>
          <Square className="size-3.5 fill-current" />
          Stop
        </button>
      ) : (
        <button type="button" onClick={onPlay} disabled={!take || mode === "recording"} className={button}>
          <Play className="size-3.5 fill-current" />
          Play
        </button>
      )}

      <span className="mx-1 h-4 w-px bg-stone-700/10" />

      <button type="button" onClick={copyJson} disabled={!take || mode === "recording"} className={button}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy JSON"}
      </button>
      <button
        type="button"
        aria-label="Download JSON"
        onClick={downloadJson}
        disabled={!take || mode === "recording"}
        className={button}
      >
        <Download className="size-3.5" />
      </button>
      <button
        type="button"
        aria-label="Discard take"
        onClick={onClear}
        disabled={!take || mode !== "idle"}
        className={button}
      >
        <Trash2 className="size-3.5" />
      </button>

      {take && mode === "idle" && (
        <span className="px-2 text-px-11 tabular-nums text-stone-500">
          {(take.duration / 1000).toFixed(1)}s · {take.events.filter((e) => e.type === "down").length} clicks
          {take.typing?.length ? ` · ${take.typing.length} typed` : ""}
        </span>
      )}

      <span className="mx-1 h-4 w-px bg-stone-700/10" />
      <button type="button" aria-label="Close recorder" onClick={onClose} className={button}>
        <X className="size-3.5" />
      </button>
    </div>
  )
}
