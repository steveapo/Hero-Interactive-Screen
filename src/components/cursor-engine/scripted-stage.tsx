"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SimulatedCursor } from "./cursor"
import { createScriptRunner, resetHover, ScriptAborted, type ScriptApi } from "./script-runner"

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
   * visitor. false (default): the demo is independent of the visitor's own mouse and keyboard;
   * their input never reaches the screen, so it can't break the run (they can still scroll the page).
   */
  interruptible?: boolean
  /** After an interruption, restart once the user has been idle this long (ms). `null` = never. */
  resumeAfterIdle?: number | null
  /**
   * Let the visitor play along without breaking the run (non-interruptible stages only). Their
   * pointer hovers the whole screen; their presses and clicks work inside elements matching this
   * selector (and on the targets of a visitor turn). Elsewhere a press does nothing (native text
   * selection still works). While they're pressing, or have just clicked, the script holds
   * before its next move. Without it, the screen ignores the visitor's pointer entirely.
   */
  visitorArea?: string
  /**
   * While an element matching this selector is on the screen (e.g. a chat the script is working
   * in), the visitor's presses are held back everywhere, `visitorArea` included, except on a
   * visitor turn's targets, so they can't close it. Hovering still works.
   */
  visitorLock?: string
  /** The script has started a run (after `startDelay`). */
  onStart?: () => void
  /**
   * Without `loop`: the run is over (after holding `loopDelay` ms on its last frame), or it failed.
   * E.g. to move on to the next clip of a multi-clip demo.
   */
  onFinish?: () => void
  className?: string
}

/** After the visitor's last press, the script waits this long before its next move (ms). */
const VISITOR_SETTLE_MS = 1200

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
  visitorArea,
  visitorLock,
  onStart,
  onFinish,
  className,
}: ScriptedStageProps) {
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
  /** The visitor's mouse and keys are kept off the screen while the demo plays. */
  const shielded = playing && !interruptible
  /** Shielded, but the visitor's pointer may hover (and press inside `visitorArea`). */
  const visitorPlays = shielded && !!visitorArea
  /** The visitor is pressing on the screen, or released less than VISITOR_SETTLE_MS ago. */
  const visitorRef = useRef({ pressing: false, releasedAt: 0 })
  const scriptRef = useRef(script)
  const onStartRef = useRef(onStart)
  const onFinishRef = useRef(onFinish)
  useEffect(() => {
    scriptRef.current = script
    onStartRef.current = onStart
    onFinishRef.current = onFinish
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
      if (!content || interruptible || visitorArea) return run()
      content.style.pointerEvents = "auto"
      try {
        return run()
      } finally {
        content.style.pointerEvents = "none"
      }
    }
    const visitorBusy = () => {
      const v = visitorRef.current
      return v.pressing || performance.now() - v.releasedAt < VISITOR_SETTLE_MS
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
        const api = createScriptRunner({ stage, cursor, rippleLayer }, signal, { pace, start, live, visitorBusy })
        runner = api
        setCursorVisible(true)
        onStartRef.current?.()
        await scriptRef.current(api)
        if (!loop) {
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
        if (!signal.aborted && !loop) onFinishRef.current?.()
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
  }, [playing, ready, iteration, pace, startDelay, loop, loopDelay, loopTransition, interruptible, visitorArea])

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
   * Playing along (`visitorArea`): the visitor's pointer reaches the screen, so hovering works
   * everywhere. Captured on `window` (before the app's own listeners):
   * - Presses outside the area (and not on a visitor turn's target) never reach the app; their
   *   click's default action (submitting a form, following a link) is cancelled too. The press's
   *   own default isn't, so text can still be selected where the screen allows it.
   * - Wheel over the screen scrolls the page, as before, instead of panning the canvas.
   * - Presses are tracked so the script holds while the visitor is busy (see `visitorBusy`).
   */
  useEffect(() => {
    if (!visitorPlays || !visitorArea) return
    const stage = stageRef.current
    const area = visitorArea
    const ours = (target: EventTarget | null): target is Element => target instanceof Element && !!stage?.contains(target)
    /** The script is working in something the visitor mustn't disturb (see `visitorLock`). */
    const locked = () => !!visitorLock && !!stage?.querySelector(visitorLock)
    const allowed = (target: Element) => !locked() && !!target.closest(area)

    function onPress(e: Event) {
      if (!e.isTrusted || !ours(e.target)) return
      if (e.type === "pointerdown") visitorRef.current.pressing = true
      // Double-clicks open things (a frame into a full-screen view) that would take the screen
      // away from the script, so they're held back everywhere but a visitor turn's targets.
      const isTurn = !!e.target.closest("[data-visitor-turn]")
      if (isTurn || (allowed(e.target) && e.type !== "dblclick")) return
      e.stopPropagation()
      if (e.type === "click" || e.type === "dblclick" || e.type === "contextmenu" || e.type === "auxclick") e.preventDefault()
    }
    function onRelease(e: Event) {
      if (!e.isTrusted || !visitorRef.current.pressing) return
      visitorRef.current = { pressing: false, releasedAt: performance.now() }
    }
    function onWheel(e: Event) {
      if (e.isTrusted && ours(e.target)) e.stopPropagation()
    }
    // (Releases always go through: a drag started on the canvas may end over a panel.)
    const pressTypes = ["pointerdown", "mousedown", "click", "dblclick", "auxclick", "contextmenu"] as const
    pressTypes.forEach((type) => window.addEventListener(type, onPress, true))
    window.addEventListener("pointerup", onRelease, true)
    window.addEventListener("pointercancel", onRelease, true)
    window.addEventListener("wheel", onWheel, { capture: true, passive: true })
    return () => {
      pressTypes.forEach((type) => window.removeEventListener(type, onPress, true))
      window.removeEventListener("pointerup", onRelease, true)
      window.removeEventListener("pointercancel", onRelease, true)
      window.removeEventListener("wheel", onWheel, true)
    }
  }, [visitorPlays, visitorArea, visitorLock])

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
        style={{
          // Shielded: the visitor's pointer passes through to the stage (see `live` for the script's),
          // unless they may play along (see `visitorArea`).
          pointerEvents: shielded && !visitorPlays ? "none" : undefined,
          // Only while fading out: no lingering opacity layer over the screen otherwise.
          ...(faded ? { opacity: 0, transition: `opacity ${FADE_MS}ms ease-in-out` } : {}),
        }}
      >
        {typeof children === "function" ? children(iteration) : children}
      </div>

      {/* Overlay: never intercepts input, so synthetic events hit the screen underneath. */}
      <div ref={rippleLayerRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
        <SimulatedCursor ref={cursorRef} visible={cursorVisible && playing} />
      </div>
    </div>
  )
}
