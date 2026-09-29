"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { describeAnchor } from "./anchors"
import { findEditable, readEditable, type EditableElement } from "./typing"
import type {
  CursorAnchor,
  CursorKeyEvent,
  CursorPressEvent,
  CursorRecording,
  CursorSample,
  CursorTypingRun,
} from "./types"

/** Typing run in progress: which field, and its text when the run started. */
type OpenRun = { el: EditableElement; start: number; end: number; from: string; anchor?: CursorAnchor }

/** Elements inside a `data-cursor-ignore` subtree (e.g. the recorder toolbar) are never recorded. */
function isIgnored(target: EventTarget | null) {
  return target instanceof Element && target.closest("[data-cursor-ignore]") !== null
}

/** Anchor at the centre of an element (used for fields and keys, which have no click point). */
function centreAnchor(stage: HTMLElement, el: Element) {
  const rect = el.getBoundingClientRect()
  return describeAnchor(stage, el, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

/**
 * Records the real cursor over `stageRef`: every move (in stage px), each press/release with an
 * anchor on the element it hit, typing into fields (as before → after runs), and Enter presses.
 * Listens on window in the capture phase so components that stop propagation or capture the
 * pointer can't hide events from the recorder.
 */
export function useCursorRecorder(stageRef: RefObject<HTMLElement | null>) {
  const [recording, setRecording] = useState(false)
  const startedAt = useRef(0)
  const samples = useRef<CursorSample[]>([])
  const events = useRef<CursorPressEvent[]>([])
  const typing = useRef<CursorTypingRun[]>([])
  const keys = useRef<CursorKeyEvent[]>([])
  const openRun = useRef<OpenRun | null>(null)
  const stageSize = useRef({ width: 0, height: 0 })

  /** Finish the current typing run, keeping it only if the text actually changed. */
  const closeRun = useCallback(() => {
    const run = openRun.current
    openRun.current = null
    if (!run) return
    const to = readEditable(run.el)
    if (to !== run.from) {
      typing.current.push({ start: run.start, end: run.end, anchor: run.anchor, from: run.from, to })
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    const stage = stageRef.current
    if (!stage) return
    const el = stage

    const now = () => Math.round(performance.now() - startedAt.current)

    function toStage(e: PointerEvent) {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, inside }
    }

    function onMove(e: PointerEvent) {
      if (!e.isTrusted || e.pointerType !== "mouse" || isIgnored(e.target)) return
      const p = toStage(e)
      if (!p.inside) return
      samples.current.push([now(), p.x, p.y])
    }

    function onPress(e: PointerEvent) {
      if (!e.isTrusted || e.button !== 0 || isIgnored(e.target)) return
      const p = toStage(e)
      if (!p.inside) return
      if (e.type === "pointerdown") closeRun() // clicking ends any typing run
      const t = now()
      const target = e.type === "pointerdown" && e.target instanceof Element ? e.target : document.elementFromPoint(e.clientX, e.clientY)
      events.current.push({
        type: e.type === "pointerdown" ? "down" : "up",
        t,
        x: p.x,
        y: p.y,
        anchor: target ? describeAnchor(el, target, e.clientX, e.clientY) : undefined,
      })
      // Presses are also positions: guarantees the path passes exactly through each click.
      samples.current.push([t, p.x, p.y])
    }

    // Before the first change in a field, note its current text as the run's starting point.
    function onBeforeInput(e: Event) {
      const field = findEditable(e.target)
      if (!e.isTrusted || !field || !el.contains(field) || isIgnored(field)) return
      if (openRun.current?.el === field) return
      closeRun() // typing somewhere else ends the previous run
      const t = now()
      openRun.current = { el: field, start: t, end: t, from: readEditable(field), anchor: centreAnchor(el, field) }
    }

    function onInput(e: Event) {
      const run = openRun.current
      if (!e.isTrusted || !run || findEditable(e.target) !== run.el) return
      run.end = now()
    }

    // Enter usually triggers behaviour (submit, commit a rename), so it's replayed as a key.
    // Escape is reserved for stopping the recording.
    function onKeyDown(e: KeyboardEvent) {
      if (!e.isTrusted || e.key !== "Enter" || e.isComposing || isIgnored(e.target)) return
      const field = findEditable(e.target)
      if (!field || !el.contains(field)) return
      closeRun()
      keys.current.push({ t: now(), key: "Enter", anchor: centreAnchor(el, field) })
    }

    function onFocusOut(e: FocusEvent) {
      if (openRun.current && e.target === openRun.current.el) closeRun()
    }

    window.addEventListener("pointermove", onMove, true)
    window.addEventListener("pointerdown", onPress, true)
    window.addEventListener("pointerup", onPress, true)
    window.addEventListener("beforeinput", onBeforeInput, true)
    window.addEventListener("input", onInput, true)
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("focusout", onFocusOut, true)
    return () => {
      window.removeEventListener("pointermove", onMove, true)
      window.removeEventListener("pointerdown", onPress, true)
      window.removeEventListener("pointerup", onPress, true)
      window.removeEventListener("beforeinput", onBeforeInput, true)
      window.removeEventListener("input", onInput, true)
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("focusout", onFocusOut, true)
    }
  }, [recording, stageRef, closeRun])

  const start = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    stageSize.current = { width: Math.round(rect.width), height: Math.round(rect.height) }
    samples.current = []
    events.current = []
    typing.current = []
    keys.current = []
    openRun.current = null
    startedAt.current = performance.now()
    setRecording(true)
  }, [stageRef])

  /** Stops recording and returns the result, or null if nothing was captured. */
  const stop = useCallback((): CursorRecording | null => {
    closeRun()
    setRecording(false)
    const raw = samples.current
    if (raw.length < 2) return null

    // Drop an unmatched trailing "down" (e.g. recording stopped mid-drag) and rebase time to 0.
    const evs = [...events.current]
    if (evs.at(-1)?.type === "down") evs.pop()
    const t0 = Math.min(raw[0][0], ...typing.current.map((r) => r.start), ...keys.current.map((k) => k.t))
    const rebased: CursorSample[] = raw.map(([t, x, y]) => [t - t0, x, y])
    const runs = typing.current.map((r) => ({ ...r, start: r.start - t0, end: r.end - t0 }))
    const keyEvents = keys.current.map((k) => ({ ...k, t: k.t - t0 }))
    return {
      version: 1,
      stage: stageSize.current,
      duration: Math.max(rebased.at(-1)![0], ...runs.map((r) => r.end), ...keyEvents.map((k) => k.t)),
      samples: rebased,
      events: evs.map((e) => ({ ...e, t: e.t - t0 })),
      typing: runs,
      keys: keyEvents,
    }
  }, [closeRun])

  return { recording, start, stop }
}
