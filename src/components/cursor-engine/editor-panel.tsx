"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { Check, Copy, Pause, Play, RotateCcw, Trash2, X, ZoomIn } from "lucide-react"
import { cn } from "@/lib/utils"
import { toBakedTime, toSourceTime } from "./smoothing"
import type { BakedTrack, CursorEdits, CursorRecording, SmoothingOptions, ZoomSegment } from "./types"

type EditorPanelProps = {
  /** The take being edited (with its current edits). */
  recording: CursorRecording | null
  /** The baked track currently playing: the timeline is drawn in its time. */
  track: BakedTrack | null
  /** Effective pacing options (defaults + stage overrides + edits). */
  options: SmoothingOptions
  getTime: () => number
  isPlaying: () => boolean
  onPlay: () => void
  onPause: () => void
  /** Jump to `t` ms on the baked timeline (the screen resets and fast-forwards). */
  onSeek: (t: number, autoplay: boolean) => void
  /** `rebake` = the change affects timing, so playback must restart from the current time. */
  onEditsChange: (edits: CursorEdits, rebake: boolean) => void
  /** Hide the editor (sets `?edit=false`). */
  onClose: () => void
}

type Selection = { kind: "zoom"; id: string } | { kind: "typing"; index: number } | null

type ZoomDrag = {
  id: string
  handle: "move" | "start" | "end"
  pointerX: number
  /** Segment edges on the baked timeline when the drag started. */
  start: number
  end: number
}

const MIN_ZOOM_LENGTH = 400
const NEW_ZOOM_LENGTH = 2000
const TYPING_SPEEDS = [0.5, 0.75, 1, 1.5, 2, 3]
const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2]

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

/**
 * Post-production editor, shown by <CursorStage> when the URL has `?edit=true` (hide with × or
 * `?edit=false`). A timeline of the take with:
 * - Zoom lane: add a zoom at the playhead, drag to move, drag its edges to trim, set its level.
 * - Typing lane: select a run to change its typing speed.
 * - Clicks lane: where presses and keys happen.
 * - Global pacing: playback speed, typing pace, cursor smoothing.
 * Edits are saved with the take; "Copy JSON" exports the take with its edits.
 */
export function EditorPanel({
  recording,
  track,
  options,
  getTime,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onEditsChange,
  onClose,
}: EditorPanelProps) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const [selected, setSelected] = useState<Selection>(null)
  const [copied, setCopied] = useState(false)
  const laneRef = useRef<HTMLDivElement>(null)
  const scrubWasPlaying = useRef(false)
  const zoomDrag = useRef<ZoomDrag | null>(null)

  // Follow the player's clock for the playhead (the player runs outside React).
  useEffect(() => {
    let frame = 0
    const tick = () => {
      setTime(getTime())
      setPlaying(isPlaying())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [getTime, isPlaying])

  if (!recording) {
    return (
      <Panel onClose={onClose}>
        <p className="px-1 py-2 text-px-12 text-stone-600">
          No take to edit yet. Record one with <code className="rounded bg-stone-100 px-1">?record=true</code>.
        </p>
      </Panel>
    )
  }

  const edits = recording.edits ?? {}
  const zooms = edits.zooms ?? []
  const duration = track?.duration ?? recording.duration
  const pct = (t: number) => `${(Math.min(Math.max(t, 0), duration) / duration) * 100}%`
  const playhead = scrub ?? time

  /** Pointer x → baked time. */
  function timeAt(clientX: number) {
    const rect = laneRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(Math.max(((clientX - rect.left) / rect.width) * duration, 0), duration)
  }

  function msPerPx() {
    const width = laneRef.current?.getBoundingClientRect().width ?? 1
    return duration / width
  }

  /* --------------------------------- Scrub --------------------------------- */

  function startScrub(e: ReactPointerEvent<HTMLDivElement>) {
    scrubWasPlaying.current = playing
    onPause()
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrub(timeAt(e.clientX))
    setSelected(null)
  }

  function moveScrub(e: ReactPointerEvent<HTMLDivElement>) {
    if (scrub !== null) setScrub(timeAt(e.clientX))
  }

  function endScrub() {
    if (scrub === null) return
    onSeek(scrub, scrubWasPlaying.current)
    setScrub(null)
  }

  /* --------------------------------- Zooms --------------------------------- */

  function setZooms(next: ZoomSegment[]) {
    onEditsChange({ ...edits, zooms: next }, false)
  }

  function addZoom() {
    if (!track) return
    let start = time
    let end = Math.min(duration, start + NEW_ZOOM_LENGTH)
    if (end - start < NEW_ZOOM_LENGTH) start = Math.max(0, end - NEW_ZOOM_LENGTH)
    const zoom: ZoomSegment = {
      id: Math.random().toString(36).slice(2, 10),
      start: toSourceTime(track, start),
      end: toSourceTime(track, end),
      scale: 2,
    }
    setZooms([...zooms, zoom])
    setSelected({ kind: "zoom", id: zoom.id })
  }

  function startZoomDrag(e: ReactPointerEvent<HTMLElement>, zoom: ZoomSegment, handle: ZoomDrag["handle"]) {
    if (!track) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    zoomDrag.current = {
      id: zoom.id,
      handle,
      pointerX: e.clientX,
      start: toBakedTime(track, zoom.start),
      end: toBakedTime(track, zoom.end),
    }
    setSelected({ kind: "zoom", id: zoom.id })
  }

  function moveZoomDrag(e: ReactPointerEvent<HTMLElement>) {
    const drag = zoomDrag.current
    if (!drag || !track) return
    const dt = (e.clientX - drag.pointerX) * msPerPx()
    let start = drag.start
    let end = drag.end
    if (drag.handle === "move") {
      const shift = Math.min(Math.max(dt, -drag.start), duration - drag.end)
      start += shift
      end += shift
    } else if (drag.handle === "start") {
      start = Math.min(Math.max(drag.start + dt, 0), drag.end - MIN_ZOOM_LENGTH)
    } else {
      end = Math.max(Math.min(drag.end + dt, duration), drag.start + MIN_ZOOM_LENGTH)
    }
    setZooms(
      zooms.map((z) =>
        z.id === drag.id ? { ...z, start: toSourceTime(track, start), end: toSourceTime(track, end) } : z,
      ),
    )
  }

  function endZoomDrag() {
    zoomDrag.current = null
  }

  /* ------------------------------ Pacing edits ------------------------------ */

  function setTypingSpeed(index: number, speed: number) {
    const typingSpeed = { ...edits.typingSpeed }
    if (speed === 1) delete typingSpeed[String(index)]
    else typingSpeed[String(index)] = speed
    onEditsChange({ ...edits, typingSpeed }, true)
  }

  function setSetting<K extends keyof SmoothingOptions>(key: K, value: SmoothingOptions[K]) {
    onEditsChange({ ...edits, settings: { ...edits.settings, [key]: value } }, true)
  }

  function copyJson() {
    navigator.clipboard.writeText(JSON.stringify(recording)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const selectedZoom = selected?.kind === "zoom" ? zooms.find((z) => z.id === selected.id) : undefined
  const selectedRun = selected?.kind === "typing" ? track?.typing.find((r) => r.index === selected.index) : undefined
  const clicks = track?.events.filter((e) => e.type === "down") ?? []
  const keys = track?.events.filter((e) => e.type === "key") ?? []
  const ticks = Array.from({ length: Math.floor(duration / 1000) + 1 }, (_, i) => i * 1000)

  const iconButton =
    "flex h-7 items-center gap-1.5 rounded-md px-2 text-px-12 font-medium text-stone-800 hover:bg-stone-700/5 disabled:pointer-events-none disabled:opacity-40"

  return (
    <Panel onClose={onClose}>
      {/* Transport + actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={playing ? onPause : onPlay}
          disabled={!track}
          className="flex size-7 items-center justify-center rounded-md bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40"
        >
          {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current" />}
        </button>
        <span className="w-24 px-2 text-px-11 tabular-nums text-stone-600">
          {seconds(playhead)} / {seconds(duration)}
        </span>
        <button type="button" onClick={addZoom} disabled={!track} className={iconButton}>
          <ZoomIn className="size-3.5" />
          Add zoom
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onEditsChange({}, true)} className={iconButton}>
            <RotateCcw className="size-3.5" />
            Reset edits
          </button>
          <button type="button" onClick={copyJson} className={iconButton}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="grid grid-cols-[56px_1fr] gap-x-2 gap-y-1 text-px-10 text-stone-500">
        <span />
        <div
          ref={laneRef}
          className="relative h-4 cursor-ew-resize touch-none border-b border-stone-700/10"
          onPointerDown={startScrub}
          onPointerMove={moveScrub}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
        >
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 -translate-x-1/2 tabular-nums" style={{ left: pct(t) }}>
              {t / 1000}s
            </span>
          ))}
        </div>

        <span className="self-center">Zoom</span>
        <Lane playhead={pct(playhead)}>
          {track &&
            zooms.map((zoom) => {
              const start = toBakedTime(track, zoom.start)
              const end = toBakedTime(track, zoom.end)
              const isSelected = selectedZoom?.id === zoom.id
              return (
                <div
                  key={zoom.id}
                  className={cn(
                    "absolute inset-y-1 flex cursor-grab touch-none items-center justify-center rounded-md border text-px-10 font-medium active:cursor-grabbing",
                    isSelected
                      ? "border-mi-select bg-mi-select/20 text-mi-select"
                      : "border-mi-select/40 bg-mi-select/10 text-mi-select/80",
                  )}
                  style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
                  onPointerDown={(e) => startZoomDrag(e, zoom, "move")}
                  onPointerMove={moveZoomDrag}
                  onPointerUp={endZoomDrag}
                  onPointerCancel={endZoomDrag}
                >
                  {/* Edge handles: moves/ups bubble to the segment's handlers above. */}
                  <span
                    className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize rounded-l-md bg-mi-select/40"
                    onPointerDown={(e) => startZoomDrag(e, zoom, "start")}
                  />
                  <span className="pointer-events-none truncate px-2">{zoom.scale.toFixed(1)}×</span>
                  <span
                    className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize rounded-r-md bg-mi-select/40"
                    onPointerDown={(e) => startZoomDrag(e, zoom, "end")}
                  />
                </div>
              )
            })}
        </Lane>

        <span className="self-center">Typing</span>
        <Lane playhead={pct(playhead)}>
          {track?.typing.map((run) => (
            <button
              key={run.index}
              type="button"
              title={run.to}
              onClick={() => setSelected({ kind: "typing", index: run.index })}
              className={cn(
                "absolute inset-y-1 min-w-1.5 truncate rounded-md border px-1.5 text-left text-px-10 font-medium",
                selectedRun?.index === run.index
                  ? "border-mi-token bg-mi-token/20 text-mi-token"
                  : "border-mi-token/40 bg-mi-token/10 text-mi-token/80",
              )}
              style={{ left: pct(run.t), width: `calc(${pct(run.t + run.duration)} - ${pct(run.t)})` }}
            >
              {run.to}
            </button>
          ))}
        </Lane>

        <span className="self-center">Clicks</span>
        <Lane playhead={pct(playhead)}>
          {clicks.map((e, i) => (
            <span
              key={`c${i}`}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-800"
              style={{ left: pct(e.t) }}
            />
          ))}
          {keys.map((e, i) => (
            <span
              key={`k${i}`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-px-11 font-semibold text-stone-800"
              style={{ left: pct(e.t) }}
            >
              ↵
            </span>
          ))}
        </Lane>
      </div>

      {/* Inspector + global pacing */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-stone-700/10 pt-2 text-px-12 text-stone-700">
        {selectedZoom ? (
          <div className="flex items-center gap-3">
            <span className="font-medium text-stone-900">Zoom</span>
            <label className="flex items-center gap-2">
              Level
              <input
                type="range"
                min={1.25}
                max={3}
                step={0.05}
                value={selectedZoom.scale}
                onChange={(e) =>
                  setZooms(zooms.map((z) => (z.id === selectedZoom.id ? { ...z, scale: Number(e.target.value) } : z)))
                }
                className="w-28 accent-mi-select"
              />
              <span className="w-9 tabular-nums">{selectedZoom.scale.toFixed(2)}×</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setZooms(zooms.filter((z) => z.id !== selectedZoom.id))
                setSelected(null)
              }}
              className={cn(iconButton, "text-red-600 hover:bg-red-50")}
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          </div>
        ) : selectedRun ? (
          <div className="flex min-w-0 items-center gap-3">
            <span className="max-w-[180px] truncate font-medium text-stone-900" title={selectedRun.to}>
              “{selectedRun.to}”
            </span>
            <span className="flex items-center gap-0.5">
              {TYPING_SPEEDS.map((speed) => {
                const current = edits.typingSpeed?.[String(selectedRun.index)] ?? 1
                return (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setTypingSpeed(selectedRun.index, speed)}
                    className={cn(
                      "h-6 rounded-md px-1.5 text-px-11 tabular-nums",
                      current === speed ? "bg-mi-token text-white" : "hover:bg-stone-700/5",
                    )}
                  >
                    {speed}×
                  </button>
                )
              })}
            </span>
            <span className="tabular-nums text-stone-500">{seconds(selectedRun.duration)}</span>
          </div>
        ) : (
          <span className="text-stone-500">Select a zoom or typing block to edit it.</span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-1">
            Speed
            {PLAYBACK_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => setSetting("speed", speed)}
                className={cn(
                  "h-6 rounded-md px-1.5 text-px-11 tabular-nums",
                  options.speed === speed ? "bg-stone-900 text-white" : "hover:bg-stone-700/5",
                )}
              >
                {speed}×
              </button>
            ))}
          </span>
          <label className="flex items-center gap-2" title="Time per character (long text still speeds up)">
            Typing pace
            <input
              type="range"
              min={20}
              max={140}
              step={5}
              value={options.typingMsPerChar}
              onChange={(e) => setSetting("typingMsPerChar", Number(e.target.value))}
              className="w-24 accent-mi-token"
            />
            <span className="w-14 tabular-nums">{options.typingMsPerChar}ms/ch</span>
          </label>
          <label className="flex items-center gap-2" title="Higher removes more hand wobble">
            Smoothing
            <input
              type="range"
              min={0}
              max={24}
              step={1}
              value={options.simplifyTolerance}
              onChange={(e) => setSetting("simplifyTolerance", Number(e.target.value))}
              className="w-20 accent-stone-800"
            />
          </label>
        </div>
      </div>
    </Panel>
  )
}

function Panel({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      data-cursor-ignore
      className="relative flex w-full max-w-[1100px] flex-col gap-2 rounded-xl border border-stone-700/10 bg-white/95 p-3 pr-10 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] backdrop-blur-md"
    >
      <button
        type="button"
        aria-label="Close editor"
        onClick={onClose}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md text-stone-600 hover:bg-stone-700/5"
      >
        <X className="size-3.5" />
      </button>
      {children}
    </div>
  )
}

/** A timeline row with the playhead drawn through it. */
function Lane({ children, playhead }: { children: ReactNode; playhead: string }) {
  return (
    <div className="relative h-7 rounded-md bg-stone-100">
      {children}
      <span className="pointer-events-none absolute inset-y-0 w-px bg-red-500" style={{ left: playhead }} />
    </div>
  )
}
