"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SimulatedCursor } from "./cursor"
import { createScriptRunner, resetHover, ScriptAborted, type ScriptApi, type ScriptClock } from "./script-runner"

/** A scripted demo: drives the screen through `api` and resolves when the run is over. */
export type DemoScript = (api: ScriptApi) => Promise<void>

/** Crossfade between runs: the finished screen fades out, the fresh one fades in (ms). */
const FADE_MS = 600

/** The cursor's home spot (where a run starts and loops back to): 62% across, 70% down the stage.
 * In the stage's layout px, like every script coordinate (the stage may be drawn scaled). */
function homeOf(stage: HTMLElement) {
  return { x: stage.clientWidth * 0.62, y: stage.clientHeight * 0.7 }
}

export type ScriptedStageProps = {
  /**
   * The screen. A function gets the run number (0 for the first), so a screen can open
   * differently when it follows a previous run (see `loopTransition: "cut"`).
   */
  children: ReactNode | ((iteration: number) => ReactNode)
  script: DemoScript
  /** Scales every duration in the script (2 = half speed). */
  pace?: number
  /** Wait after the screen mounts before the script starts (ms). */
  startDelay?: number
  /** Replay forever, holding `loopDelay` ms on the finished screen before the next run. */
  loop?: boolean
  loopDelay?: number
  /**
   * Between runs. "crossfade" (default): the finished screen fades out and the fresh one in.
   * "cut": the fresh screen replaces it on the spot; use it when the screen's last frame and the
   * next run's first frame match, so the loop carries straight on.
   */
  loopTransition?: "crossfade" | "cut"
  /**
   * The demo may start (default true). While false the screen sits on its opening state and the
   * cursor stays hidden; e.g. until the window the stage lives in has scrolled fully into view.
   */
  ready?: boolean
  /**
   * true: a real click, wheel or key press on the stage stops the demo and hands control to the
   * visitor. false (default): while the script plays, the screen is not interactive: the visitor's
   * mouse and keyboard never reach it, so they can't break the run (they can still scroll the
   * page). Only a visitor turn's targets (see the runner's `yourTurn`) take their click. The screen
   * becomes interactive once the script is done (see `holdLastFrame`).
   */
  interruptible?: boolean
  /** After an interruption, restart once the user has been idle this long (ms). `null` = never. */
  resumeAfterIdle?: number | null
  /**
   * Without `loop`: once the run is over, stay on its last frame as a still and hand the screen to
   * the visitor. The simulated cursor goes away and their pointer and keys reach the screen (plain
   * scroll over it still scrolls the page; pinch / ⌘-scroll zooms the canvas).
   */
  holdLastFrame?: boolean
  /**
   * Click to take over (instead of shielding the screen): while the script plays, the visitor's real
   * pointer reaches the screen (hovers show, clicks land), but their wheel and keys never do (plain
   * scroll over it scrolls the page, nothing inside it). Their first real press on the screen stops
   * the run for good (no resume; remount the stage to replay) and hands the screen to them, as at the
   * end of a `holdLastFrame` run. Throughout, a real press or click only reaches the screen when this
   * accepts its target, and real keys never reach the screen: it keeps the visitor to the clip's own action.
   */
  takeOver?: (target: Element) => boolean
  /**
   * Pause the run where it is (e.g. while the stage is scrolled out of view): the cursor stops
   * mid-glide and the script picks up exactly where it left off once this is false again.
   */
  paused?: boolean
  /** The script has started a run (after `startDelay`). */
  onStart?: () => void
  /**
   * Without `loop`: the run is over (after holding `loopDelay` ms on its last frame), or it failed.
   * E.g. to move on to the next clip of a multi-clip demo.
   */
  onFinish?: () => void
  className?: string
}

/**
 * Plays a live script over a screen (see script-runner): the simulated cursor glides, clicks and
 * types for real, so the screen responds as it would to a user. Each run starts on a freshly
 * mounted screen; between runs the screen crossfades and the cursor glides back to its start,
 * so the loop reads as one continuous cycle.
 */
export function ScriptedStage({
  children,
  script,
  pace = 1,
  startDelay = 600,
  loop = true,
  loopDelay = 1200,
  loopTransition = "crossfade",
  ready = true,
  interruptible = false,
  resumeAfterIdle = 8000,
  holdLastFrame = false,
  takeOver,
  paused = false,
  onStart,
  onFinish,
  className,
}: ScriptedStageProps) {
  /*
   * The run's clock (see ScriptClock): wall-clock time minus the time spent paused, so it stands
   * still while `paused`. Read through refs, so pausing never restarts the run.
   */
  const pauseRef = useRef<{ since: number | null; total: number }>({ since: null, total: 0 })
  useLayoutEffect(() => {
    const p = pauseRef.current
    if (paused && p.since === null) p.since = performance.now()
    if (!paused && p.since !== null) {
      p.total += performance.now() - p.since
      p.since = null
    }
  }, [paused])
  const clockRef = useRef<ScriptClock>({
    now: () => {
      const p = pauseRef.current
      return (p.since ?? performance.now()) - p.total
    },
    paused: () => pauseRef.current.since !== null,
  })
  const stageRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const rippleLayerRef = useRef<HTMLDivElement>(null)
  const [iteration, setIteration] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [interrupted, setInterrupted] = useState(false)
  const [cursorVisible, setCursorVisible] = useState(false)
  /** The screen is faded out (end of a run, before the fresh one mounts). */
  const [faded, setFaded] = useState(false)
  /** The run is over and the screen holds its last frame for the visitor (see `holdLastFrame`). */
  const [held, setHeld] = useState(false)
  /** The visitor's mouse and keys are kept off the screen while the demo plays (it's not interactive until it's done). */
  const takeOverMode = !!takeOver
  const shielded = playing && !interruptible && !held && !takeOverMode
  const scriptRef = useRef(script)
  const onStartRef = useRef(onStart)
  const onFinishRef = useRef(onFinish)
  const takeOverRef = useRef(takeOver)
  useEffect(() => {
    scriptRef.current = script
    onStartRef.current = onStart
    onFinishRef.current = onFinish
    takeOverRef.current = takeOver
  })

  // A fresh screen (after the crossfade) fades in. Cut loops hand over on the spot.
  const cutRef = useRef(false)
  /** Where the cursor ended the last run: the next run starts exactly there (seamless loop). */
  const endPosRef = useRef<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const content = contentRef.current
    if (iteration === 0 || !content) return
    if (cutRef.current) {
      cutRef.current = false
      return
    }
    const animation = content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "ease-out" })
    return () => animation.cancel()
  }, [iteration])

  // One run per iteration: start delay → script → hold → crossfade → next iteration.
  /** The first run waited for `ready`: it starts the moment it's given, without `startDelay`. */
  const heldRef = useRef(false)

  // Waiting for `ready`: the cursor is already on screen at its home spot, kept there as the
  // stage resizes (e.g. the window growing as the page scrolls), so the run starts right there.
  useLayoutEffect(() => {
    const stage = stageRef.current
    const cursor = cursorRef.current
    if (ready || !playing || !stage || !cursor) return
    heldRef.current = true
    const placeHome = () => {
      const home = homeOf(stage)
      const dpr = window.devicePixelRatio || 1
      // Whole device pixels, like the runner places it (fractional positions blur the arrow).
      cursor.style.transform = `translate(${Math.round(home.x * dpr) / dpr}px, ${Math.round(home.y * dpr) / dpr}px)`
    }
    placeHome()
    setCursorVisible(true)
    const observer = new ResizeObserver(placeHome)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [ready, playing])

  useEffect(() => {
    const stage = stageRef.current
    const cursor = cursorRef.current
    const rippleLayer = rippleLayerRef.current
    if (!playing || !ready || !stage || !cursor || !rippleLayer) return
    const controller = new AbortController()
    const { signal } = controller
    const sleep = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, ms)
        signal.addEventListener("abort", () => {
          clearTimeout(timer)
          reject(new ScriptAborted())
        })
      })
    const home = homeOf(stage)
    /** Shielded screens ignore the pointer; synthetic hits switch it back on for the instant they need. */
    const live = <T,>(run: () => T): T => {
      const content = contentRef.current
      if (!content || interruptible || takeOverMode) return run()
      const wasShielded = content.hasAttribute("data-script-shielded")
      content.style.pointerEvents = "auto"
      content.removeAttribute("data-script-shielded")
      try {
        return run()
      } finally {
        content.style.pointerEvents = "none"
        if (wasShielded) content.setAttribute("data-script-shielded", "")
      }
    }

    let runner: ScriptApi | null = null
    ;(async () => {
      try {
        setFaded(false)
        // A run that was held back for `ready` starts on the spot; otherwise let the screen settle.
        const held = heldRef.current
        heldRef.current = false
        if (!held) await sleep(startDelay)
        // Start where the last run left the cursor (the stage may have resized since, which
        // would move a freshly measured home), else at home. Story captions aren't shown.
        const start = endPosRef.current ?? home
        const api = createScriptRunner({ stage, cursor, rippleLayer }, signal, {
          pace,
          start,
          live,
          clock: clockRef.current,
        })
        runner = api
        setCursorVisible(true)
        onStartRef.current?.()
        await scriptRef.current(api)
        if (!loop) {
          // Hold the last frame as a still; the screen is the visitor's from here.
          if (holdLastFrame) setHeld(true)
          await sleep(loopDelay)
          onFinishRef.current?.()
          return
        }
        await sleep(loopDelay)
        if (loopTransition === "cut") {
          // The screen's last frame is the next run's first: the cursor drifts home, then swap.
          await api.moveTo(home, { duration: FADE_MS })
          endPosRef.current = api.cursor()
          resetHover()
          cutRef.current = true
          setIteration((i) => i + 1)
          return
        }
        // Crossfade: the screen fades while the cursor glides home, then a fresh screen mounts.
        setFaded(true)
        await Promise.all([api.moveTo(home, { duration: FADE_MS }), sleep(FADE_MS)])
        endPosRef.current = api.cursor()
        resetHover()
        setIteration((i) => i + 1)
      } catch (error) {
        if (!(error instanceof ScriptAborted)) console.error("[scripted-stage] demo step failed:", error)
        // A one-shot run that failed hands over as if it had finished.
        if (!signal.aborted && !loop) {
          if (holdLastFrame) setHeld(true)
          onFinishRef.current?.()
        }
        // A target never appeared, or a step failed: start over on a fresh screen.
        if (!signal.aborted && loop) {
          const last = runner as ScriptApi | null
          if (last) endPosRef.current = last.cursor()
          setFaded(true)
          await new Promise((r) => setTimeout(r, FADE_MS))
          resetHover()
          setIteration((i) => i + 1)
        }
      }
    })()

    return () => {
      controller.abort()
      resetHover()
    }
  }, [playing, ready, iteration, pace, startDelay, loop, loopDelay, loopTransition, interruptible, holdLastFrame, takeOverMode])

  /*
   * Holding the last frame (`holdLastFrame`): the visitor can play with the screen, but it mustn't
   * take over the page. Plain scroll over it scrolls the page rather than panning the canvas
   * (pinch / ⌘-scroll still zoom), and keys pressed outside any field never reach the screen's
   * shortcuts.
   */
  useEffect(() => {
    if (!held) return
    const stage = stageRef.current
    function onWheel(e: WheelEvent) {
      if (!e.isTrusted || e.ctrlKey || e.metaKey) return
      if (e.target instanceof Node && stage?.contains(e.target)) e.stopPropagation()
    }
    function onKey(e: Event) {
      if (e.isTrusted && (e.target === document.body || e.target === document.documentElement)) e.stopImmediatePropagation()
    }
    const keyTypes = ["keydown", "keypress", "keyup"] as const
    window.addEventListener("wheel", onWheel, { capture: true, passive: true })
    keyTypes.forEach((type) => window.addEventListener(type, onKey, true))
    return () => {
      window.removeEventListener("wheel", onWheel, true)
      keyTypes.forEach((type) => window.removeEventListener(type, onKey, true))
    }
  }, [held])

  /*
   * Independence from the visitor: the screen itself ignores the real pointer (pointer-events
   * off, see `live`), so their clicks, hovers and wheel land on the stage and the page just
   * scrolls. Two things still need stopping:
   * - Real presses anywhere would reach the screen's outside-click listeners on `document` and
   *   close its popovers. A `document` listener registered now (before any popover opens; React's
   *   own root listener was registered earlier, so the page's handlers still run) stops them.
   * - Real keys would type into the screen's focused field or trigger its shortcuts.
   */
  useEffect(() => {
    if (!shielded) return
    const stage = stageRef.current
    function stopPress(e: Event) {
      if (e.isTrusted) e.stopImmediatePropagation()
    }
    // While the script holds a press, the visitor's real moves / releases must not reach the
    // screen's drag tracking (window listeners), or a click would turn into a drag.
    function stopDuringPress(e: Event) {
      if (e.isTrusted && stage?.dataset.scriptPressing) e.stopImmediatePropagation()
    }
    function stopKeys(e: Event) {
      if (!e.isTrusted) return
      const target = e.target
      const ours = target instanceof Node && !!stage?.contains(target)
      if (ours) e.preventDefault()
      if (ours || target === document.body || target === document.documentElement) e.stopImmediatePropagation()
    }
    const pressTypes = ["pointerdown", "mousedown"] as const
    const keyTypes = ["keydown", "keypress", "keyup", "beforeinput"] as const
    const moveTypes = ["pointermove", "pointerup", "pointercancel", "mousemove", "mouseup", "click"] as const
    pressTypes.forEach((type) => document.addEventListener(type, stopPress))
    keyTypes.forEach((type) => window.addEventListener(type, stopKeys, true))
    moveTypes.forEach((type) => window.addEventListener(type, stopDuringPress, true))
    return () => {
      pressTypes.forEach((type) => document.removeEventListener(type, stopPress))
      keyTypes.forEach((type) => window.removeEventListener(type, stopKeys, true))
      moveTypes.forEach((type) => window.removeEventListener(type, stopDuringPress, true))
    }
  }, [shielded])

  /*
   * Click to take over (`takeOver`), while the script plays: hovers and clicks reach the screen, but
   * no scrolling or typing can happen in it before the visitor clicks.
   * - Wheel over the screen never reaches it (no canvas pan / zoom, no scrolling inside it); plain
   *   scroll scrolls the page instead.
   * - Real presses outside the stage are kept from the screen's outside-click listeners (they'd
   *   close the script's popovers), and real moves don't reach its drag tracking mid script press.
   * - The visitor's first real press on the screen stops the run for good and hands them the screen
   *   (held: as after a `holdLastFrame` run). It only resumes on a remount (the host's Replay).
   */
  useEffect(() => {
    if (!takeOverMode || !playing || held) return
    const stage = stageRef.current
    const inStage = (target: EventTarget | null) => target instanceof Node && !!stage?.contains(target)
    function onPress(e: Event) {
      if (!e.isTrusted || !inStage(e.target)) return
      setPlaying(false)
      setHeld(true)
      setCursorVisible(false)
      setFaded(false)
    }
    function onWheel(e: WheelEvent) {
      if (!e.isTrusted || !inStage(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey) return
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
      window.scrollBy(e.deltaX * unit, e.deltaY * unit)
    }
    function stopOutsidePress(e: Event) {
      if (e.isTrusted && !inStage(e.target)) e.stopImmediatePropagation()
    }
    function stopDuringPress(e: Event) {
      if (e.isTrusted && stage?.dataset.scriptPressing) e.stopImmediatePropagation()
    }
    const pressTypes = ["pointerdown", "mousedown"] as const
    const moveTypes = ["pointermove", "pointerup", "pointercancel", "mousemove", "mouseup"] as const
    window.addEventListener("pointerdown", onPress, true)
    window.addEventListener("wheel", onWheel, { capture: true, passive: false })
    pressTypes.forEach((type) => document.addEventListener(type, stopOutsidePress))
    moveTypes.forEach((type) => window.addEventListener(type, stopDuringPress, true))
    return () => {
      window.removeEventListener("pointerdown", onPress, true)
      window.removeEventListener("wheel", onWheel, true)
      pressTypes.forEach((type) => document.removeEventListener(type, stopOutsidePress))
      moveTypes.forEach((type) => window.removeEventListener(type, stopDuringPress, true))
    }
  }, [takeOverMode, playing, held])

  /*
   * Click to take over (`takeOver`), throughout (playing or handed over): a real press or click on
   * the screen whose target `takeOver` rejects never reaches it, and real keys never reach the screen
   * (nor its shortcuts, when pressed outside any field). stopPropagation, not stopImmediatePropagation:
   * the takeover listener above (also on `window`) still sees the press.
   */
  useEffect(() => {
    if (!takeOverMode) return
    const stage = stageRef.current
    const inStage = (target: EventTarget | null): target is Element =>
      target instanceof Element && !!stage?.contains(target)
    function guardPointer(e: Event) {
      if (!e.isTrusted || !inStage(e.target)) return
      if (takeOverRef.current?.(e.target)) return
      e.stopPropagation()
      e.preventDefault()
    }
    function stopKeys(e: Event) {
      if (!e.isTrusted) return
      const ours = inStage(e.target)
      if (ours) e.preventDefault()
      if (ours || e.target === document.body || e.target === document.documentElement) e.stopImmediatePropagation()
    }
    const pointerTypes = ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick", "contextmenu"] as const
    const keyTypes = ["keydown", "keypress", "keyup", "beforeinput"] as const
    pointerTypes.forEach((type) => window.addEventListener(type, guardPointer, true))
    keyTypes.forEach((type) => window.addEventListener(type, stopKeys, true))
    return () => {
      pointerTypes.forEach((type) => window.removeEventListener(type, guardPointer, true))
      keyTypes.forEach((type) => window.removeEventListener(type, stopKeys, true))
    }
  }, [takeOverMode])

  // A real click, wheel or key press stops the demo so the user can take over.
  useEffect(() => {
    if (!playing || !interruptible) return
    function onUserInput(e: Event) {
      if (!e.isTrusted) return
      const target = e.target
      if (e.type !== "keydown" && !(target instanceof Node && stageRef.current?.contains(target))) return
      setPlaying(false)
      setInterrupted(true)
      setCursorVisible(false)
      setFaded(false)
    }
    window.addEventListener("pointerdown", onUserInput, true)
    window.addEventListener("wheel", onUserInput, { capture: true, passive: true })
    window.addEventListener("keydown", onUserInput, true)
    return () => {
      window.removeEventListener("pointerdown", onUserInput, true)
      window.removeEventListener("wheel", onUserInput, true)
      window.removeEventListener("keydown", onUserInput, true)
    }
  }, [playing, interruptible])

  // Once the user has left the stage alone for `resumeAfterIdle` ms, restart the demo.
  useEffect(() => {
    if (!interrupted || resumeAfterIdle === null) return
    let timer = setTimeout(resume, resumeAfterIdle)
    function resume() {
      setInterrupted(false)
      setIteration((i) => i + 1)
      setPlaying(true)
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
  }, [interrupted, resumeAfterIdle])

  return (
    <div ref={stageRef} className={cn("relative flex w-full flex-1 flex-col overflow-hidden", className)}>
      <div
        key={iteration}
        ref={contentRef}
        className="flex w-full flex-1 flex-col"
        // Shielded: every element inside ignores the real pointer too, incl. ones that set
        // pointer-events: auto themselves (see globals.css), so nothing clicks or hovers.
        data-script-shielded={shielded ? "" : undefined}
        style={{
          // Shielded: not interactive while the script plays; the visitor's pointer passes through to
          // the stage (see `live` for the script's; a visitor turn's targets switch it back on).
          pointerEvents: shielded ? "none" : undefined,
          // Only while fading out: no lingering opacity layer over the screen otherwise.
          ...(faded ? { opacity: 0, transition: `opacity ${FADE_MS}ms ease-in-out` } : {}),
        }}
      >
        {typeof children === "function" ? children(iteration) : children}
      </div>

      {/* Overlay: never intercepts input, so synthetic events hit the screen underneath. */}
      <div ref={rippleLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
        <SimulatedCursor ref={cursorRef} visible={cursorVisible && playing && !held} />
      </div>
    </div>
  )
}
