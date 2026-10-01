"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { describeAnchor, describeElementAnchor, inScope } from "./anchors"
import { findEditable, readEditable, type EditableElement } from "./typing"
import type {
  CursorAnchor,
  CursorGestureEvent,
  CursorKeyEvent,
  CursorPressEvent,
  CursorRecording,
  CursorSample,
  CursorScrollEvent,
  CursorTypingRun,
  CursorWheelEvent,
  KeyModifiers,
} from "./types"

/** Typing run in progress: which field, and its text when the run started. */
type OpenRun = { el: EditableElement; start: number; end: number; from: string; anchor?: CursorAnchor }

/** Safari's trackpad gesture event (not in lib.dom). */
type GestureEvent = UIEvent & { scale: number; rotation: number; clientX: number; clientY: number }

/** Keys that only modify others: recorded as modifiers on the key they're held with. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn", "FnLock", "Hyper", "Super", "OS"])
/**
 * Keys recorded while typing in a field. Everything else there (characters, Backspace, arrows)
 * is already captured by the typing run's before → after text.
 */
const FIELD_KEYS = new Set(["Enter", "Escape", "Tab"])

/** Only the modifiers actually held, so the JSON stays compact. Undefined when none are. */
function modifiers(e: KeyboardEvent | WheelEvent): KeyModifiers | undefined {
  const mods: KeyModifiers = {}
  if (e.ctrlKey) mods.ctrl = true
  if (e.metaKey) mods.meta = true
  if (e.shiftKey) mods.shift = true
  if (e.altKey) mods.alt = true
  return Object.keys(mods).length ? mods : undefined
}

/** The recorder's stop shortcut (⇧Esc, see RecorderToolbar): never recorded itself. */
export function isStopShortcut(e: KeyboardEvent) {
  return e.key === "Escape" && e.shiftKey
}

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
 * Records everything a user does over `stageRef`: every move (in stage px), each press/release
 * of any mouse button with an anchor on the element it hit, typing into fields (as before → after
 * runs), key presses (Enter, Escape, shortcuts, …), wheel input (scroll, trackpad pan, pinch /
 * ⌘-scroll zoom), Safari pinch gestures, and the scroll offset of any element inside the stage.
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
  const scrolls = useRef<CursorScrollEvent[]>([])
  const wheels = useRef<CursorWheelEvent[]>([])
  const gestures = useRef<CursorGestureEvent[]>([])
  const changes = useRef<number[]>([])
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

    /**
     * Take time (ms). Events use their own `timeStamp` (when the input happened, same clock as
     * performance.now), not when the handler ran: a busy main thread delivers input late and in
     * bursts, which would otherwise show up as uneven, sped-up movement on playback.
     */
    const now = (e?: Event) => Math.round((e && e.timeStamp > 0 ? e.timeStamp : performance.now()) - startedAt.current)

    function toStage(e: { clientX: number; clientY: number }) {
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, inside }
    }

    // Every position the mouse passed through: browsers merge moves into one event per frame
    // (or fewer when busy); getCoalescedEvents() returns the ones merged away.
    function onMove(e: PointerEvent) {
      if (!e.isTrusted || e.pointerType !== "mouse" || isIgnored(e.target)) return
      const merged = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : []
      for (const m of merged.length > 0 ? merged : [e]) {
        const p = toStage(m)
        if (p.inside) samples.current.push([now(m), p.x, p.y])
      }
    }

    // Left, middle (e.g. pan) and right (context menu) buttons.
    function onPress(e: PointerEvent) {
      if (!e.isTrusted || e.button < 0 || e.button > 2 || isIgnored(e.target)) return
      const p = toStage(e)
      if (!p.inside) return
      if (e.type === "pointerdown") closeRun() // clicking ends any typing run
      const t = now(e)
      const target = e.type === "pointerdown" && e.target instanceof Element ? e.target : document.elementFromPoint(e.clientX, e.clientY)
      const press: CursorPressEvent = {
        type: e.type === "pointerdown" ? "down" : "up",
        t,
        x: p.x,
        y: p.y,
        anchor: target ? describeAnchor(el, target, e.clientX, e.clientY) : undefined,
      }
      if (e.button !== 0) press.button = e.button
      events.current.push(press)
      // Presses are also positions: guarantees the path passes exactly through each click.
      samples.current.push([t, p.x, p.y])
    }

    // Before the first change in a field, note its current text as the run's starting point.
    function onBeforeInput(e: Event) {
      const field = findEditable(e.target)
      if (!e.isTrusted || !field || !inScope(el, field) || isIgnored(field)) return
      if (openRun.current?.el === field) return
      closeRun() // typing somewhere else ends the previous run
      const t = now(e)
      openRun.current = { el: field, start: t, end: t, from: readEditable(field), anchor: centreAnchor(el, field) }
    }

    function onInput(e: Event) {
      const run = openRun.current
      if (!e.isTrusted || !run || findEditable(e.target) !== run.el) return
      run.end = now(e)
    }

    // Keys that trigger behaviour: Enter / Escape / Tab and shortcuts in a field (typed text is
    // covered by typing runs), and every key elsewhere (tool shortcuts, Escape to close, …).
    // Modifier-only presses are skipped, as is the recorder's own ⇧Esc stop shortcut.
    function onKeyDown(e: KeyboardEvent) {
      if (!e.isTrusted || e.isComposing || isIgnored(e.target) || MODIFIER_KEYS.has(e.key) || isStopShortcut(e)) return
      const base: Omit<CursorKeyEvent, "t"> = { key: e.key }
      if (e.code && e.code !== e.key) base.code = e.code
      const mods = modifiers(e)
      if (mods) base.mods = mods
      const field = findEditable(e.target)
      if (field) {
        if (!inScope(el, field)) return
        if (!FIELD_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey) return
        closeRun()
        keys.current.push({ t: now(e), ...base, field: true, anchor: centreAnchor(el, field) })
        return
      }
      // Focus on something in the stage or a portal (a button, …) or on the page itself (window shortcuts).
      const target = e.target
      const onPage = target === document.body || target === document.documentElement || target === document
      const inStage = target instanceof Element && inScope(el, target)
      if (!onPage && !inStage) return
      closeRun()
      keys.current.push({
        t: now(e),
        ...base,
        field: false,
        anchor: inStage ? describeElementAnchor(el, target as Element) : undefined,
      })
    }

    function onFocusOut(e: FocusEvent) {
      if (openRun.current && e.target === openRun.current.el) closeRun()
    }

    // Wheel: scrolling, trackpad pans, and pinch / ⌘-scroll zoom (ctrl / meta held).
    function onWheel(e: WheelEvent) {
      if (!e.isTrusted || !(e.target instanceof Node) || !inScope(el, e.target) || isIgnored(e.target)) return
      const p = toStage(e)
      if (!p.inside) return
      const t = now(e)
      const wheel: CursorWheelEvent = {
        t,
        deltaX: Math.round(e.deltaX * 100) / 100,
        deltaY: Math.round(e.deltaY * 100) / 100,
        deltaMode: e.deltaMode,
      }
      if (e.deltaZ !== 0) wheel.deltaZ = Math.round(e.deltaZ * 100) / 100
      const mods = modifiers(e)
      if (mods) wheel.mods = mods
      wheels.current.push(wheel)
      // The wheel acts at the cursor: keep the path there.
      samples.current.push([t, p.x, p.y])
    }

    // Safari trackpad pinch / rotate.
    function onGesture(e: Event) {
      if (!e.isTrusted || !(e.target instanceof Node) || !inScope(el, e.target) || isIgnored(e.target)) return
      const g = e as GestureEvent
      const t = now(e)
      gestures.current.push({
        t,
        type: e.type as CursorGestureEvent["type"],
        scale: Math.round((g.scale ?? 1) * 10000) / 10000,
        rotation: Math.round((g.rotation ?? 0) * 100) / 100,
      })
      if (typeof g.clientX === "number") {
        const p = toStage(g)
        if (p.inside) samples.current.push([t, p.x, p.y])
      }
    }

    // Scroll events don't bubble, but a capture listener on window still sees every element's.
    // Only scrolling inside the stage or its portals is recorded (not the page itself).
    function onScroll(e: Event) {
      const target = e.target
      if (!(target instanceof Element) || !inScope(el, target) || isIgnored(target)) return
      const anchor = describeElementAnchor(el, target)
      if (!anchor) return
      scrolls.current.push({
        t: now(e),
        anchor,
        top: Math.round(target.scrollTop * 10) / 10,
        left: Math.round(target.scrollLeft * 10) / 10,
      })
    }

    // Content changes (elements added / removed, text changed) in the stage and its portals: the
    // app reacting, possibly after a delay (a reply arriving). Attribute changes are left out —
    // hover and focus styling would make every moment look busy.
    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((m) => inScope(el, m.target) && !isIgnored(m.target instanceof Element ? m.target : m.target.parentElement))) return
      const t = now()
      const last = changes.current.at(-1)
      if (last === undefined || t - last >= 50) changes.current.push(t)
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })

    window.addEventListener("pointermove", onMove, true)
    window.addEventListener("pointerdown", onPress, true)
    window.addEventListener("pointerup", onPress, true)
    window.addEventListener("beforeinput", onBeforeInput, true)
    window.addEventListener("input", onInput, true)
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("focusout", onFocusOut, true)
    window.addEventListener("scroll", onScroll, { capture: true, passive: true })
    window.addEventListener("wheel", onWheel, { capture: true, passive: true })
    window.addEventListener("gesturestart", onGesture, true)
    window.addEventListener("gesturechange", onGesture, true)
    window.addEventListener("gestureend", onGesture, true)
    return () => {
      observer.disconnect()
      window.removeEventListener("pointermove", onMove, true)
      window.removeEventListener("pointerdown", onPress, true)
      window.removeEventListener("pointerup", onPress, true)
      window.removeEventListener("beforeinput", onBeforeInput, true)
      window.removeEventListener("input", onInput, true)
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("focusout", onFocusOut, true)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("wheel", onWheel, true)
      window.removeEventListener("gesturestart", onGesture, true)
      window.removeEventListener("gesturechange", onGesture, true)
      window.removeEventListener("gestureend", onGesture, true)
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
    scrolls.current = []
    wheels.current = []
    gestures.current = []
    changes.current = []
    openRun.current = null
    startedAt.current = performance.now()
    setRecording(true)
  }, [stageRef])

  /** Stops recording and returns the result, or null if nothing was captured. */
  const stop = useCallback((): CursorRecording | null => {
    closeRun()
    setRecording(false)
    const raw = [...samples.current].sort((a, b) => a[0] - b[0])
    if (raw.length < 2) return null

    // Drop an unmatched trailing "down" (e.g. recording stopped mid-drag) and rebase time to 0.
    const evs = [...events.current]
    if (evs.at(-1)?.type === "down") evs.pop()
    // Every list is pushed in time order, so its first / last entries bound it.
    const firsts = [raw[0][0], typing.current[0]?.start, keys.current[0]?.t, scrolls.current[0]?.t, wheels.current[0]?.t, gestures.current[0]?.t]
    const t0 = Math.min(...firsts.filter((t): t is number => t !== undefined))
    const rebase = <T extends { t: number }>(list: T[]) => list.map((item) => ({ ...item, t: item.t - t0 }))
    const rebased: CursorSample[] = raw.map(([t, x, y]) => [t - t0, x, y])
    const runs = typing.current.map((r) => ({ ...r, start: r.start - t0, end: r.end - t0 }))
    const keyEvents = rebase(keys.current)
    const scrollEvents = rebase(scrolls.current)
    const wheelEvents = rebase(wheels.current)
    const gestureEvents = rebase(gestures.current)
    const lasts = [rebased.at(-1)![0], ...runs.map((r) => r.end), keyEvents.at(-1)?.t, scrollEvents.at(-1)?.t, wheelEvents.at(-1)?.t, gestureEvents.at(-1)?.t]
    return {
      version: 1,
      stage: stageSize.current,
      duration: Math.max(...lasts.filter((t): t is number => t !== undefined)),
      samples: rebased,
      events: evs.map((e) => ({ ...e, t: e.t - t0 })),
      typing: runs,
      keys: keyEvents,
      scrolls: scrollEvents,
      wheels: wheelEvents,
      gestures: gestureEvents,
      // Only changes after the take starts matter (they explain waits between actions).
      changes: changes.current.map((t) => t - t0).filter((t) => t >= 0),
    }
  }, [closeRun])

  return { recording, start, stop }
}
