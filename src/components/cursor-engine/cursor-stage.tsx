"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SimulatedCursor } from "./cursor"
import { EditorPanel } from "./editor-panel"
import { CursorPlayer } from "./player"
import { useCursorRecorder } from "./recorder"
import { RecorderToolbar } from "./recorder-toolbar"
import {
  DEFAULT_SMOOTHING,
  type BakedTrack,
  type CursorEdits,
  type CursorRecording,
  type SmoothingOptions,
  type ZoomSegment,
} from "./types"

/** Local take (with its edits) kept between reloads while recording / editing in dev. */
const STORAGE_KEY = "cursor-engine:take"
const NO_ZOOMS: ZoomSegment[] = []

type Mode = "idle" | "playing" | "recording"

/** Dev panels are toggled with URL flags: `?record=true`, `?edit=true` (and `=false` to hide). */
type DevFlag = "record" | "edit"

/** `fallback` applies when the URL doesn't set the flag at all. */
function readFlag(flag: DevFlag, fallback = false) {
  const value = new URLSearchParams(window.location.search).get(flag)
  return value === null ? fallback : value === "true"
}

/** Write a flag to the URL without reloading, so a refresh keeps the panel open or closed. */
function writeFlag(flag: DevFlag, value: boolean) {
  const url = new URL(window.location.href)
  url.searchParams.set(flag, String(value))
  window.history.replaceState(window.history.state, "", url)
}

export type CursorStageProps = {
  children: ReactNode
  /** The recording to play. `null` renders children untouched (until one is recorded). */
  recording: CursorRecording | null
  /** Overrides for the smoothing pipeline (the recording's own edits apply on top). */
  smoothing?: Partial<SmoothingOptions>
  /** Wait before playback starts (ms). */
  startDelay?: number
  /** Replay forever, pausing `loopDelay` ms between runs. */
  loop?: boolean
  loopDelay?: number
  /** Remount children before each run so the UI starts from its initial state every time. */
  resetOnLoop?: boolean
  /** A real click, scroll or key press on the stage stops playback and hands control to the user. */
  interruptible?: boolean
  /** After an interruption, restart playback once the user has been idle this long (ms). `null` = never. */
  resumeAfterIdle?: number | null
  /**
   * Endpoint that stores the shared recording. Every saved take (and edit) is PUT here and a
   * discarded take is DELETEd, so other visitors get it as `recording`. Unset = local only.
   */
  persistUrl?: string
  /** Show the recorder when the URL has no `?record=` flag (e.g. on a dedicated recording page). */
  defaultRecorder?: boolean
  className?: string
}

/**
 * Wraps a live screen and plays a recorded cursor over it: a custom cursor follows the smoothed
 * path, presses/clicks/typing are dispatched as real events so the screen actually responds,
 * and zoom segments move a camera over the screen.
 *
 * Dev tools: `?record=true` shows the recorder, `?edit=true` the timeline editor.
 */
export function CursorStage({
  children,
  recording,
  smoothing,
  startDelay = 800,
  loop = true,
  loopDelay = 1500,
  resetOnLoop = true,
  interruptible = true,
  resumeAfterIdle = 8000,
  persistUrl,
  defaultRecorder = false,
  className,
}: CursorStageProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const rippleLayerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<CursorPlayer | null>(null)
  /** Where the next player starts, and whether it plays straight away. Consumed on start. */
  const seekRef = useRef({ at: 0, autoplay: true })

  const [recorderEnabled, setRecorderEnabled] = useState(false)
  const [editorEnabled, setEditorEnabled] = useState(false)
  const [take, setTake] = useState<CursorRecording | null>(null)
  const [mode, setMode] = useState<Mode>("playing")
  const [interrupted, setInterrupted] = useState(false)
  const [iteration, setIteration] = useState(0)
  const [cursorVisible, setCursorVisible] = useState(false)
  const [track, setTrack] = useState<BakedTrack | null>(null)
  const recorder = useCursorRecorder(stageRef)

  /** The local take (recorded / edited in dev) wins over the shipped recording. */
  const source = take ?? recording
  const edits = source?.edits
  const zooms = edits?.zooms ?? NO_ZOOMS
  const zoomsRef = useRef(zooms)

  // Only changes that affect timing restart playback; zoom edits apply live (see below).
  const bakeSource = useMemo(() => source, [source?.stage, source?.samples, source?.events, source?.typing, source?.keys, edits?.typingSpeed])
  const optionsKey = JSON.stringify({ ...DEFAULT_SMOOTHING, ...smoothing, ...edits?.settings })
  const options = useMemo(() => JSON.parse(optionsKey) as SmoothingOptions, [optionsKey])

  useEffect(() => {
    zoomsRef.current = zooms
    playerRef.current?.refreshCamera()
  }, [zooms])

  // Dev flags from the URL. Either panel restores the last local take.
  useEffect(() => {
    const record = readFlag("record", defaultRecorder)
    const edit = readFlag("edit")
    setRecorderEnabled(record)
    setEditorEnabled(edit)
    if (!record && !edit) return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setTake(JSON.parse(saved) as CursorRecording)
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    if (edit) {
      seekRef.current = { at: 0, autoplay: false } // the editor opens paused at the start
      setMode("playing")
    } else {
      setMode("idle")
    }
  }, [])

  /* -------------------------------- Playback -------------------------------- */

  useEffect(() => {
    const stage = stageRef.current
    const camera = cameraRef.current
    const cursor = cursorRef.current
    const rippleLayer = rippleLayerRef.current
    if (mode !== "playing" || !bakeSource || !stage || !camera || !cursor || !rippleLayer) return

    let loopTimer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    const player: CursorPlayer = new CursorPlayer(bakeSource, options, { stage, camera, cursor, rippleLayer }, {
      onTrack: setTrack,
      onVisibleChange: setCursorVisible,
      getZooms: () => zoomsRef.current,
      onEnd: () => {
        if (editorEnabled || !loop) return // the editor stays paused on the last frame
        if (resetOnLoop) setCursorVisible(false)
        loopTimer = setTimeout(() => (resetOnLoop ? setIteration((i) => i + 1) : player.start(0, true)), loopDelay)
      },
    })
    playerRef.current = player

    // Let freshly (re)mounted children lay out before resolving anchors.
    const startTimer = setTimeout(
      () => {
        frame = requestAnimationFrame(() => {
          const { at, autoplay } = seekRef.current
          seekRef.current = { at: 0, autoplay: !editorEnabled }
          player.start(at, autoplay)
        })
      },
      editorEnabled ? 0 : startDelay,
    )

    return () => {
      clearTimeout(startTimer)
      clearTimeout(loopTimer)
      cancelAnimationFrame(frame)
      player.destroy()
      if (playerRef.current === player) playerRef.current = null
    }
  }, [mode, bakeSource, options, iteration, editorEnabled, startDelay, loop, loopDelay, resetOnLoop])

  /** Restart from `at` ms on a fresh screen (the player fast-forwards to it). */
  const seek = useCallback((at: number, autoplay: boolean) => {
    seekRef.current = { at, autoplay }
    setIteration((i) => i + 1)
    setMode("playing")
  }, [])

  /* ------------------------- Interrupt and resume -------------------------- */

  // A real click, scroll or key press stops the demo so the user can take over.
  useEffect(() => {
    if (mode !== "playing" || !interruptible || recorderEnabled || editorEnabled) return
    function onUserInput(e: Event) {
      if (!e.isTrusted) return
      const target = e.target
      if (e.type !== "keydown" && !(target instanceof Node && stageRef.current?.contains(target))) return
      setMode("idle")
      setInterrupted(true)
    }
    window.addEventListener("pointerdown", onUserInput, true)
    window.addEventListener("wheel", onUserInput, { capture: true, passive: true })
    window.addEventListener("keydown", onUserInput, true)
    return () => {
      window.removeEventListener("pointerdown", onUserInput, true)
      window.removeEventListener("wheel", onUserInput, true)
      window.removeEventListener("keydown", onUserInput, true)
    }
  }, [mode, interruptible, recorderEnabled, editorEnabled])

  // Once the user has left the stage alone for `resumeAfterIdle` ms, restart the demo.
  useEffect(() => {
    if (!interrupted || resumeAfterIdle === null) return
    let timer = setTimeout(resume, resumeAfterIdle)
    function resume() {
      setInterrupted(false)
      if (resetOnLoop) setIteration((i) => i + 1)
      setMode("playing")
    }
    function onActivity(e: Event) {
      if (!e.isTrusted) return
      clearTimeout(timer)
      timer = setTimeout(resume, resumeAfterIdle ?? 0)
    }
    const events = ["pointermove", "pointerdown", "wheel", "keydown"] as const
    events.forEach((type) => window.addEventListener(type, onActivity, { capture: true, passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach((type) => window.removeEventListener(type, onActivity, true))
    }
  }, [interrupted, resumeAfterIdle, resetOnLoop])

  /* -------------------------------- Recorder -------------------------------- */

  /** Pending upload to `persistUrl`: edits arrive in bursts (sliders), so only the last one is sent. */
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const saveTake = useCallback(
    (next: CursorRecording | null) => {
      setTake(next)
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      else window.localStorage.removeItem(STORAGE_KEY)

      if (!persistUrl) return
      clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        const request = next
          ? fetch(persistUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) })
          : fetch(persistUrl, { method: "DELETE" })
        request
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
          })
          .catch((err) => console.error("[cursor-engine] failed to store the recording:", err))
      }, 400)
    },
    [persistUrl],
  )

  const startRecording = useCallback(() => {
    setIteration((i) => i + 1) // record from the screen's initial state, as playback starts from it
    setMode("recording")
    recorder.start()
  }, [recorder])

  const stopRecorderAction = useCallback(() => {
    if (mode === "recording") {
      const result = recorder.stop()
      if (result) saveTake(result)
    }
    if (editorEnabled) seek(0, false) // hand the new take straight to the editor
    else setMode("idle")
  }, [mode, recorder, saveTake, editorEnabled, seek])

  const closeRecorder = useCallback(() => {
    if (mode === "recording") recorder.stop()
    writeFlag("record", false)
    setRecorderEnabled(false)
    seek(0, !editorEnabled)
  }, [mode, recorder, editorEnabled, seek])

  /* --------------------------------- Editor --------------------------------- */

  const getTime = useCallback(() => playerRef.current?.currentTime ?? 0, [])
  const isPlaying = useCallback(() => playerRef.current?.isPlaying ?? false, [])

  const playEditor = useCallback(() => {
    const player = playerRef.current
    if (!player?.track) return
    if (player.currentTime >= player.track.duration - 1) seek(0, true) // replay from the start
    else player.play()
  }, [seek])

  const pauseEditor = useCallback(() => playerRef.current?.pause(), [])

  const changeEdits = useCallback(
    (next: CursorEdits, rebake: boolean) => {
      if (!source) return
      saveTake({ ...source, edits: next })
      // Timing changed: rebuild the screen at the current moment, paused.
      if (rebake) seek(playerRef.current?.currentTime ?? 0, false)
    },
    [source, saveTake, seek],
  )

  const closeEditor = useCallback(() => {
    writeFlag("edit", false)
    setEditorEnabled(false)
    if (recorderEnabled) setMode("idle")
    else seek(0, true)
  }, [recorderEnabled, seek])

  return (
    <div ref={stageRef} className={cn("relative flex w-full flex-1 flex-col overflow-hidden", className)}>
      {/* Camera: the zoom transforms the screen and the cursor together. */}
      <div ref={cameraRef} className="relative flex w-full flex-1 origin-top-left flex-col">
        <div key={iteration} className="contents">
          {children}
        </div>

        {/* Overlay: never intercepts input, so synthetic events hit the screen underneath. */}
        <div ref={rippleLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
          <SimulatedCursor ref={cursorRef} visible={cursorVisible && mode === "playing"} />
        </div>
      </div>

      {(recorderEnabled || editorEnabled) && (
        <div
          data-cursor-ignore
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 *:pointer-events-auto"
        >
          {recorderEnabled && (
            <RecorderToolbar
              mode={mode === "recording" ? "recording" : editorEnabled ? "idle" : mode}
              take={take}
              onRecord={startRecording}
              onStop={stopRecorderAction}
              onPlay={() => seek(0, true)}
              onClear={() => saveTake(null)}
              onClose={closeRecorder}
            />
          )}
          {editorEnabled && mode !== "recording" && (
            <EditorPanel
              recording={source}
              track={source ? track : null}
              options={options}
              getTime={getTime}
              isPlaying={isPlaying}
              onPlay={playEditor}
              onPause={pauseEditor}
              onSeek={seek}
              onEditsChange={changeEdits}
              onClose={closeEditor}
            />
          )}
        </div>
      )}
    </div>
  )
}
