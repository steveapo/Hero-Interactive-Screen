"use client"

import { screenScale } from "@/lib/screen-scale"
import { spawnClickRipple } from "./cursor"
import { dispatchDown, dispatchHover, dispatchKey, dispatchMove, dispatchUp, dispatchWheel, resetHover } from "./dispatch"
import { findEditable, readEditable, writeEditable } from "./typing"
import type { KeyModifiers } from "./types"

/**
 * Live script runner: drives the simulated cursor over a live screen step by step. Unlike a
 * recording, every target is found and measured at the moment it's needed (waiting for it to
 * appear), so the script survives layout differences and UI that only shows up mid-run (a reply,
 * a popover). Input goes through the same synthetic dispatch as recording playback, so the screen
 * reacts exactly as it does to a user.
 */

/** Thrown into a running script when it's stopped (interrupted, unmounted, or a target never showed up). */
export class ScriptAborted extends Error {
  constructor(reason = "aborted") {
    super(reason)
    this.name = "ScriptAborted"
  }
}

/** An element, a CSS selector (inside the stage or its portals), or a function finding one. */
export type ScriptTarget = string | Element | (() => Element | null | undefined)

/** Where to aim inside a target: fractions of its box (default its centre) plus a px offset. */
export type Aim = { fx?: number; fy?: number; dx?: number; dy?: number }

export type ScriptApi = {
  stage: HTMLElement
  /** Pause (scaled by the pace). */
  wait: (ms: number) => Promise<void>
  /** Wait until the target exists and is visible; throws ScriptAborted after `timeout` ms. */
  find: (target: ScriptTarget, timeout?: number) => Promise<Element>
  /** Whether the target is on screen right now. */
  exists: (target: ScriptTarget) => boolean
  /** Poll until `check()` is true (every 100ms); throws ScriptAborted after `timeout` ms. */
  until: (check: () => boolean, timeout?: number) => Promise<void>
  /** Glide the cursor to a target (or a stage point), hovering along the way. */
  moveTo: (target: ScriptTarget | { x: number; y: number }, options?: Aim & { duration?: number }) => Promise<void>
  /** Move to the target and click it. */
  click: (target: ScriptTarget, options?: Aim & { mods?: KeyModifiers; duration?: number }) => Promise<void>
  /** Type into the focused field (or `into`), character by character. `replace` clears it first. */
  type: (text: string, options?: { into?: ScriptTarget; replace?: boolean; msPerChar?: number }) => Promise<void>
  /** Key press on the focused element (or `on`). */
  press: (key: string, options?: { on?: ScriptTarget; mods?: KeyModifiers }) => Promise<void>
  /** Wheel at the cursor over `duration` ms: pans canvases, scrolls lists. Positive dy = content moves up. */
  wheel: (dx: number, dy: number, options?: { duration?: number; mods?: KeyModifiers }) => Promise<void>
  /** Smoothly scroll a scrollable element to `top`. */
  scroll: (target: ScriptTarget, top: number, duration?: number) => Promise<void>
  /** Current cursor position, in stage px. */
  cursor: () => { x: number; y: number }
  /** The target's box relative to the stage (stage px). */
  boxOf: (target: ScriptTarget) => DOMRect | null
  /** The screen element at a stage point, as synthetic input would hit it (null off screen). */
  elementAt: (point: { x: number; y: number }) => Element | null
  /** Move to the target and double-click it. */
  doubleClick: (target: ScriptTarget, options?: Aim & { duration?: number }) => Promise<void>
  /**
   * Press on `from`, glide (held) to `to` (a target or a stage point), release there: drags
   * things around (a library component onto a frame, a layer to a new spot).
   */
  drag: (
    from: ScriptTarget,
    to: ScriptTarget | { x: number; y: number },
    options?: { from?: Aim; to?: Aim; duration?: number },
  ) => Promise<void>
  /** The run was stopped (as opposed to a step timing out). */
  aborted: () => boolean
  /** Show a story caption over the screen (null hides it). */
  caption: (text: string | null) => void
  /**
   * Hand one step to the visitor: the target (or each of several choices) is highlighted, with a
   * `prompt` tag above, and only those take the visitor's real pointer (the rest of the screen
   * stays shielded). Resolves with the choice they click. If they don't react within `timeout` ms
   * while they're actually watching (page focused and visible, a choice on screen), the agent's
   * cursor comes back and clicks choice `fallback` (default 0). Either way the run carries on.
   */
  yourTurn: (
    targets: ScriptTarget | ScriptTarget[],
    options: { prompt: string; timeout?: number; fallback?: number } & Aim,
  ) => Promise<{ index: number; byVisitor: boolean }>
}

export type RunnerElements = { stage: HTMLElement; cursor: HTMLElement; rippleLayer: HTMLElement }

/** Default wait for a target to appear. */
const FIND_TIMEOUT = 8000
/** Cursor glide: duration grows with distance, within these bounds (ms). */
const MOVE_MIN_MS = 260
const MOVE_MAX_MS = 900
const MOVE_MS_PER_PX = 0.55
/** Sideways bow of the cursor path, as a fraction of its length. */
const MOVE_ARC = 0.08
/** Hold on the target before pressing, and between press and release (ms). */
const CLICK_DWELL_MS = 110
const CLICK_HOLD_MS = 80
/** Typing rhythm: base ms per character, ± jitter, extra after spaces / punctuation. */
const TYPE_MS = 42
const TYPE_JITTER = 0.45
const TYPE_PAUSE_MS = 70
/** The simulated cursor stays inside the stage: min gap at the top / left, and how far the arrow
 * (with its shadow) reaches right of and below its tip (px). */
const CURSOR_EDGE = 3
const CURSOR_REACH_X = 20
const CURSOR_REACH_Y = 24
/** Before a press, the target may have moved this far from the cursor before it glides back (px). */
const REAIM_PX = 3
/** That corrective glide's duration (ms). */
const REAIM_MS = 220
/** How long a visitor turn waits (while they're watching) before the agent chooses (ms). */
const YOUR_TURN_MS = 1750
/** After the stage or window resizes, how long the resting cursor keeps following its anchor (ms). */
const RESIZE_FOLLOW_MS = 700
/** The simulated cursor steps back / returns around a visitor turn (ms). */
const YOUR_TURN_FADE_MS = 220

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3)

/**
 * `pace` scales every duration (2 = everything takes twice as long). The cursor keeps its
 * position between runs (pass `start`), so a loop can glide straight into the next run.
 */
export function createScriptRunner(
  els: RunnerElements,
  signal: AbortSignal,
  {
    pace = 1,
    start = { x: 0, y: 0 },
    live = (run) => run(),
    onCaption = () => {},
    visitorBusy = () => false,
  }: {
    pace?: number
    start?: { x: number; y: number }
    /**
     * Runs a synthetic dispatch. A stage that shields the screen from the real mouse (pointer
     * events off) switches them on just for the call, so `elementFromPoint` finds the screen.
     */
    live?: <T>(run: () => T) => T
    /** Shows / hides a story caption (see ScriptApi.caption). */
    onCaption?: (text: string | null) => void
    /** The visitor is interacting with the screen: hold before the next move / press / key. */
    visitorBusy?: () => boolean
  } = {},
): ScriptApi {
  const { stage, cursor: cursorEl, rippleLayer } = els
  let pos = { ...start }
  /**
   * The field the script last clicked or typed into. A real click elsewhere on the page can take
   * focus away; typing and keys still go to this field, so the run carries on unaffected.
   */
  let lastField: Element | null = null
  // Deterministic jitter, so every run types and bows the same way.
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  let arcSide = 1

  const check = () => {
    if (signal.aborted) throw new ScriptAborted()
  }

  const stageRect = () => stage.getBoundingClientRect()
  /**
   * Stage coordinates (the cursor's position, aims, boxes) are the stage's own layout px. The
   * stage may be drawn scaled (the hero window scales the screen while it grows), so screen px
   * from rects / pointer events are divided by this, and stage points multiplied by it.
   */
  const scale = () => screenScale(stage)
  const toClient = (p: { x: number; y: number }) => {
    const r = stageRect()
    const k = scale()
    return { clientX: r.left + p.x * k, clientY: r.top + p.y * k }
  }
  /** Points outside the viewport can't be hit (elementFromPoint returns nothing there). */
  const onScreen = (p: { x: number; y: number }) => {
    const { clientX, clientY } = toClient(p)
    return clientX >= 0 && clientY >= 0 && clientX < window.innerWidth && clientY < window.innerHeight
  }
  /** Hold (as long as it takes) while the visitor has scrolled the cursor's spot out of view. */
  async function whileOffscreen() {
    while (!onScreen(pos)) {
      check()
      await new Promise((r) => setTimeout(r, 150))
    }
    check()
  }

  /** Hold while the visitor is pressing on the screen or has just clicked (they go first). */
  async function whileVisitorBusy() {
    while (visitorBusy()) {
      check()
      await new Promise((r) => setTimeout(r, 100))
    }
    check()
  }

  function place(p: { x: number; y: number }) {
    // Kept inside the screen: the whole arrow (it hangs right of and below its tip) stays within
    // the stage, even when a bowed glide between targets near an edge would swing it past.
    const w = stage.clientWidth
    const h = stage.clientHeight
    const clamped = {
      x: Math.min(Math.max(p.x, CURSOR_EDGE), Math.max(CURSOR_EDGE, w - CURSOR_REACH_X)),
      y: Math.min(Math.max(p.y, CURSOR_EDGE), Math.max(CURSOR_EDGE, h - CURSOR_REACH_Y)),
    }
    pos = clamped
    // Snapped to whole device pixels: at fractional positions the arrow is resampled and blurs.
    const dpr = window.devicePixelRatio || 1
    const x = Math.round(clamped.x * dpr) / dpr
    const y = Math.round(clamped.y * dpr) / dpr
    cursorEl.style.transform = `translate(${x}px, ${y}px)`
  }
  place(pos)

  /**
   * The element the cursor last went to (and where on it). When the stage resizes (the window
   * grows or shrinks as the page scrolls, or the browser window is resized, which moves
   * everything on the screen), the resting cursor is put back on the same spot of that element
   * instead of being left where it was. A move to a plain point anchors to the stage itself at
   * the same fraction of its size, so that spot scales with the stage too.
   *
   * The screen re-lays itself out over the next frames (state updates, the canvas refitting its
   * camera), so after a resize the cursor keeps following its anchor for RESIZE_FOLLOW_MS rather
   * than measuring once, and lands where the element ends up.
   */
  let anchor: { el: Element; aim: Aim } | null = null
  /** A glide is in progress (it re-measures its target every frame by itself). */
  let moving = false
  let followUntil = 0
  let following = false
  function followStep() {
    if (signal.aborted) {
      following = false
      return
    }
    if (!moving && anchor && anchor.el.isConnected) place(pointIn(anchor.el, anchor.aim))
    if (performance.now() < followUntil) requestAnimationFrame(followStep)
    else following = false
  }
  function followAnchor() {
    followUntil = performance.now() + RESIZE_FOLLOW_MS
    if (following) return
    following = true
    requestAnimationFrame(followStep)
  }
  /** Anchor for a move to a stage point: the stage, at that point's fraction of its size. */
  function stageAnchor(p: { x: number; y: number }): { el: Element; aim: Aim } {
    return { el: stage, aim: { fx: p.x / (stage.clientWidth || 1), fy: p.y / (stage.clientHeight || 1) } }
  }
  const resizeObserver = new ResizeObserver(followAnchor)
  resizeObserver.observe(stage)
  window.addEventListener("resize", followAnchor)
  signal.addEventListener(
    "abort",
    () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", followAnchor)
    },
    { once: true },
  )

  function resolve(target: ScriptTarget): Element | null {
    if (typeof target === "string") {
      const inStage = stage.querySelector(target)
      if (inStage && inStage.getClientRects().length > 0) return inStage
      // Portalled UI (dialogs rendered into <body>).
      const anywhere = Array.from(document.querySelectorAll(target)).find((el) => el.getClientRects().length > 0)
      return anywhere ?? null
    }
    const el = typeof target === "function" ? target() : target
    return el && el.isConnected && el.getClientRects().length > 0 ? el : null
  }

  function wait(ms: number) {
    return pause(ms * pace)
  }

  /** A pause in real time, not scaled by the pace (typing keeps its own rhythm). */
  function pause(ms: number) {
    return new Promise<void>((resolveWait, reject) => {
      if (signal.aborted) return reject(new ScriptAborted())
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort)
        resolveWait()
      }, ms)
      function onAbort() {
        clearTimeout(timer)
        reject(new ScriptAborted())
      }
      signal.addEventListener("abort", onAbort, { once: true })
    })
  }

  /** Real-time pause (not scaled), for frame pacing. */
  function frame() {
    return new Promise<void>((resolveFrame, reject) => {
      if (signal.aborted) return reject(new ScriptAborted())
      requestAnimationFrame(() => (signal.aborted ? reject(new ScriptAborted()) : resolveFrame()))
    })
  }

  async function until(condition: () => boolean, timeout = FIND_TIMEOUT) {
    const started = performance.now()
    while (!condition()) {
      check()
      if (performance.now() - started > timeout) throw new ScriptAborted("timed out waiting")
      await new Promise((r) => setTimeout(r, 100))
    }
    check()
  }

  async function find(target: ScriptTarget, timeout = FIND_TIMEOUT) {
    let found: Element | null = null
    await until(() => (found = resolve(target)) !== null, timeout)
    return found as unknown as Element
  }

  function pointIn(el: Element, aim: Aim = {}) {
    const r = el.getBoundingClientRect()
    const s = stageRect()
    const k = scale()
    return {
      x: (r.left - s.left + r.width * (aim.fx ?? 0.5)) / k + (aim.dx ?? 0),
      y: (r.top - s.top + r.height * (aim.fy ?? 0.5)) / k + (aim.dy ?? 0),
    }
  }

  async function moveTo(target: ScriptTarget | { x: number; y: number }, options: Aim & { duration?: number } = {}) {
    const isPoint = typeof target === "object" && target !== null && "x" in target && !(target instanceof Element)
    const el = isPoint ? null : await find(target as ScriptTarget)
    await whileVisitorBusy()
    // Re-measured every frame: the target may still be moving (a panel gliding in).
    const goal = () => (isPoint ? (target as { x: number; y: number }) : pointIn(el!, options))
    // Once there, the cursor stays on this element (or this spot of the stage) if the stage
    // resizes (see `followAnchor`).
    anchor = el ? { el, aim: options } : stageAnchor(target as { x: number; y: number })
    const from = { ...pos }
    const first = goal()
    const distance = Math.hypot(first.x - from.x, first.y - from.y)
    if (distance < 1) return
    moving = true
    try {
      await glide(from, goal, distance, options.duration)
    } finally {
      moving = false
    }
  }

  async function glide(
    from: { x: number; y: number },
    goal: () => { x: number; y: number },
    distance: number,
    durationMs?: number,
    /** Runs each frame instead of hovering (e.g. to send drag moves while pressed). */
    onStep?: () => void,
  ) {
    const duration = (durationMs ?? Math.min(MOVE_MAX_MS, Math.max(MOVE_MIN_MS, MOVE_MIN_MS + distance * MOVE_MS_PER_PX))) * pace
    arcSide = -arcSide
    const bow = distance * MOVE_ARC * arcSide * (0.6 + random() * 0.4)
    const started = performance.now()
    for (;;) {
      await frame()
      const k = Math.min(1, (performance.now() - started) / duration)
      const e = easeInOut(k)
      const to = goal()
      // Quadratic bow: perpendicular offset that peaks mid-way and vanishes at both ends.
      const dx = to.x - from.x
      const dy = to.y - from.y
      const len = Math.hypot(dx, dy) || 1
      const lift = bow * 4 * e * (1 - e)
      place({ x: from.x + dx * e + (-dy / len) * lift, y: from.y + dy * e + (dx / len) * lift })
      if (onScreen(pos)) {
        if (onStep) onStep()
        else live(() => dispatchHover(toClient(pos)))
      }
      if (k >= 1) break
    }
  }

  async function click(target: ScriptTarget, options: Aim & { mods?: KeyModifiers; duration?: number } = {}) {
    await moveTo(target, options)
    await wait(CLICK_DWELL_MS)
    await reaim(target, options)
    await press0(options.mods)
  }

  /**
   * Right before pressing: wait out the visitor (busy, or scrolled away), then re-measure the
   * target. If it has moved since the cursor got there (the page scrolled and the window resized,
   * a panel shifted), glide the short way back onto it, so the press never lands beside it.
   */
  async function reaim(target: ScriptTarget, options: Aim) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await whileVisitorBusy()
      await whileOffscreen()
      const el = resolve(target)
      if (!el) return
      const to = pointIn(el, options)
      const distance = Math.hypot(to.x - pos.x, to.y - pos.y)
      if (distance <= REAIM_PX) return
      anchor = { el, aim: options }
      moving = true
      try {
        await glide({ ...pos }, () => pointIn(el, options), distance, REAIM_MS)
      } finally {
        moving = false
      }
    }
  }

  /** Press + release at the cursor. While held, the stage keeps the visitor's real moves out (see ScriptedStage). */
  async function press0(mods?: KeyModifiers, hold = CLICK_HOLD_MS) {
    await whileVisitorBusy()
    await whileOffscreen()
    const point = toClient(pos)
    cursorEl.dataset.pressed = "true"
    stage.dataset.scriptPressing = "true"
    try {
      const pressed = live(() => dispatchDown(point, 0, mods))
      const field = findEditable(pressed)
      if (field) lastField = field
      spawnClickRipple(rippleLayer, pos.x, pos.y)
      await wait(hold)
      live(() => dispatchUp(pressed, toClient(pos), 0, mods))
    } finally {
      delete stage.dataset.scriptPressing
      cursorEl.dataset.pressed = "false"
    }
  }

  async function doubleClick(target: ScriptTarget, options: Aim & { duration?: number } = {}) {
    await moveTo(target, options)
    await wait(CLICK_DWELL_MS)
    await reaim(target, options)
    await press0(undefined, 60)
    await wait(70)
    await press0(undefined, 60)
  }

  async function drag(
    from: ScriptTarget,
    to: ScriptTarget | { x: number; y: number },
    options: { from?: Aim; to?: Aim; duration?: number } = {},
  ) {
    const fromAim = options.from ?? {}
    const toAim = options.to ?? {}
    await moveTo(from, fromAim)
    await wait(CLICK_DWELL_MS)
    await reaim(from, fromAim)
    await whileVisitorBusy()
    await whileOffscreen()
    const isPoint = typeof to === "object" && to !== null && "x" in to && !(to instanceof Element)
    const toEl = isPoint ? null : await find(to as ScriptTarget)
    const goal = () => (isPoint ? (to as { x: number; y: number }) : pointIn(toEl!, toAim))
    cursorEl.dataset.pressed = "true"
    stage.dataset.scriptPressing = "true"
    try {
      const pressed = live(() => dispatchDown(toClient(pos), 0))
      spawnClickRipple(rippleLayer, pos.x, pos.y)
      await wait(CLICK_HOLD_MS)
      const start = { ...pos }
      const first = goal()
      const distance = Math.hypot(first.x - start.x, first.y - start.y)
      moving = true
      try {
        await glide(start, goal, distance, options.duration, () => {
          if (pressed) live(() => dispatchMove(pressed, toClient(pos), 0))
        })
      } finally {
        moving = false
      }
      anchor = toEl ? { el: toEl, aim: toAim } : stageAnchor(to as { x: number; y: number })
      await wait(CLICK_HOLD_MS)
      live(() => dispatchUp(pressed, toClient(pos), 0))
    } finally {
      delete stage.dataset.scriptPressing
      cursorEl.dataset.pressed = "false"
    }
  }

  /** The field typing / keys go to: the focused one if it's ours, else the one last used. */
  function currentField() {
    const focused = findEditable(document.activeElement)
    if (focused && (stage.contains(focused) || focused === lastField)) return focused
    return lastField?.isConnected ? findEditable(lastField) : null
  }

  async function type(text: string, options: { into?: ScriptTarget; replace?: boolean; msPerChar?: number } = {}) {
    const field = options.into ? findEditable(await find(options.into)) : currentField()
    if (!field) throw new ScriptAborted("no field to type into")
    lastField = field
    // Show the caret, unless the visitor is using a field elsewhere on the page (never steal it).
    const active = document.activeElement
    const fieldElsewhere = active && active !== document.body && !stage.contains(active) && active !== field
    if (field instanceof HTMLElement && !fieldElsewhere) field.focus({ preventScroll: true })
    let value = options.replace ? "" : readEditable(field)
    if (options.replace) writeEditable(field, "")
    const base = options.msPerChar ?? TYPE_MS
    for (const char of text) {
      await whileVisitorBusy()
      value += char
      writeEditable(field, value)
      const jitter = 1 + (random() * 2 - 1) * TYPE_JITTER
      // Real time: the pace speeds up the cursor's moves and waits, never the typing.
      await pause(base * jitter + (/[\s,.?!]/.test(char) ? TYPE_PAUSE_MS * random() : 0))
    }
  }

  async function press(key: string, options: { on?: ScriptTarget; mods?: KeyModifiers } = {}) {
    const target = options.on ? await find(options.on) : (currentField() ?? document.activeElement ?? document.body)
    await whileVisitorBusy()
    dispatchKey(target, key, undefined, options.mods)
    await wait(60)
  }

  async function wheel(dx: number, dy: number, options: { duration?: number; mods?: KeyModifiers } = {}) {
    await whileVisitorBusy()
    await whileOffscreen()
    const duration = (options.duration ?? 600) * pace
    const started = performance.now()
    let sentX = 0
    let sentY = 0
    for (;;) {
      await frame()
      const k = Math.min(1, (performance.now() - started) / duration)
      const e = easeOut(k)
      const stepX = dx * e - sentX
      const stepY = dy * e - sentY
      sentX += stepX
      sentY += stepY
      if ((stepX !== 0 || stepY !== 0) && onScreen(pos)) {
        live(() => dispatchWheel(toClient(pos), { t: 0, deltaX: stepX, deltaY: stepY, deltaMode: 0, mods: options.mods }))
      }
      if (k >= 1) break
    }
  }

  async function scroll(target: ScriptTarget, top: number, duration = 700) {
    const el = await find(target)
    const from = el.scrollTop
    const started = performance.now()
    for (;;) {
      await frame()
      const k = Math.min(1, (performance.now() - started) / (duration * pace))
      el.scrollTop = from + (top - from) * easeInOut(k)
      if (k >= 1) break
    }
  }

  function boxOf(target: ScriptTarget) {
    const el = resolve(target)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const s = stageRect()
    const k = scale()
    return new DOMRect((r.left - s.left) / k, (r.top - s.top) / k, r.width / k, r.height / k)
  }

  /** The screen element at a stage point, as synthetic input would hit it. */
  function elementAt(p: { x: number; y: number }) {
    if (!onScreen(p)) return null
    const { clientX, clientY } = toClient(p)
    return live(() => document.elementFromPoint(clientX, clientY))
  }

  async function yourTurn(
    targets: ScriptTarget | ScriptTarget[],
    options: { prompt: string; timeout?: number; fallback?: number } & Aim,
  ): Promise<{ index: number; byVisitor: boolean }> {
    const list = Array.isArray(targets) ? targets : [targets]
    const fallback = Math.min(Math.max(0, options.fallback ?? 0), list.length - 1)
    await find(list[fallback])
    const choices = list
      .map((target, index) => ({ index, el: resolve(target) }))
      .filter((c): c is { index: number; el: HTMLElement } => c.el instanceof HTMLElement)
    if (choices.length === 0) {
      await click(list[fallback], options)
      return { index: fallback, byVisitor: false }
    }

    // The agent's cursor steps back so the visitor's own pointer is the one on screen.
    cursorEl.style.transition = `opacity ${YOUR_TURN_FADE_MS}ms ease-out`
    cursorEl.style.opacity = "0"

    // Highlight: a pulsing lime ring around each choice and one prompt tag above them all.
    const rings = choices.map(() => {
      const ring = document.createElement("div")
      ring.className =
        "pointer-events-none absolute rounded-xl border-2 border-mi-lime-deep shadow-[0_0_0_6px_rgba(194,236,102,0.35)] animate-pulse"
      return ring
    })
    const tag = document.createElement("div")
    tag.className =
      "pointer-events-none absolute flex max-w-[calc(100%-16px)] items-center gap-1.5 whitespace-nowrap rounded-full bg-mi-lime px-3 py-1 text-[12px] font-semibold text-mi-lime-ink shadow-[0_6px_16px_-4px_rgba(90,122,24,0.45)] animate-in fade-in duration-300"
    tag.textContent = options.prompt
    rippleLayer.append(...rings, tag)

    // Only the choices take the real pointer (a descendant with pointer-events: auto receives
    // events even though the shielded screen around it has them off). The turn ends on the click
    // itself, so the whole press (down, up, click) reaches the choice before it's shielded again.
    const state: { chosen: { index: number; clientX: number; clientY: number } | null } = { chosen: null }
    const listeners = choices.map(({ index, el }) => {
      const previousPointer = el.style.pointerEvents
      el.style.pointerEvents = "auto"
      // Lets the stage pass the visitor's presses through here, wherever it is on the screen.
      el.setAttribute("data-visitor-turn", "")
      const onClick = (e: MouseEvent) => {
        if (!e.isTrusted || state.chosen) return
        state.chosen = { index, clientX: e.clientX, clientY: e.clientY }
      }
      el.addEventListener("click", onClick, true)
      return () => {
        el.removeEventListener("click", onClick, true)
        el.removeAttribute("data-visitor-turn")
        el.style.pointerEvents = previousPointer
      }
    })

    /** The visitor is watching: the tab is visible and a choice is on screen. */
    const watching = (boxes: DOMRect[]) =>
      document.visibilityState === "visible" &&
      boxes.some((b) => onScreen({ x: b.left + b.width / 2, y: b.top + b.height / 2 }))

    try {
      let waited = 0
      let last = performance.now()
      while (!state.chosen && waited < (options.timeout ?? YOUR_TURN_MS) * pace) {
        await frame()
        const now = performance.now()
        const boxes = choices.map(({ el }) => (el.isConnected ? boxOf(el) : null))
        if (boxes.every((b) => b === null)) break // the choices went away: nothing left to click
        const shown = boxes.filter((b): b is DOMRect => b !== null)
        // The countdown only runs while they can actually see it.
        if (watching(shown)) waited += now - last
        last = now
        const pad = 6
        boxes.forEach((box, i) => {
          rings[i].style.display = box ? "" : "none"
          if (!box) return
          Object.assign(rings[i].style, {
            left: `${box.left - pad}px`,
            top: `${box.top - pad}px`,
            width: `${box.width + pad * 2}px`,
            height: `${box.height + pad * 2}px`,
          })
        })
        const left = Math.min(...shown.map((b) => b.left))
        const right = Math.max(...shown.map((b) => b.right))
        const top = Math.min(...shown.map((b) => b.top))
        const bottom = Math.max(...shown.map((b) => b.bottom))
        // Keep the tag inside the stage: centred over the choices but clamped to the sides, and
        // below them instead when there's no room above.
        const stageWidth = stage.clientWidth
        const edge = 8
        const halfWidth = tag.offsetWidth / 2
        const x = Math.min(Math.max((left + right) / 2, edge + halfWidth), stageWidth - edge - halfWidth)
        const above = top - pad - 8 - tag.offsetHeight >= edge
        Object.assign(tag.style, {
          left: `${x}px`,
          top: above ? `${top - pad - 8}px` : `${bottom + pad + 8}px`,
          translate: above ? "-50% -100%" : "-50% 0",
        })
      }
    } finally {
      listeners.forEach((remove) => remove())
      rings.forEach((ring) => ring.remove())
      tag.remove()
      if (state.chosen) {
        // Pick up where the visitor clicked, so the cursor carries on from there.
        const s = stageRect()
        const k = scale()
        place({ x: (state.chosen.clientX - s.left) / k, y: (state.chosen.clientY - s.top) / k })
      }
      cursorEl.style.opacity = "1"
    }

    check()
    if (state.chosen) return { index: state.chosen.index, byVisitor: true }
    // They didn't react: the agent makes the choice.
    if (resolve(list[fallback])) await click(list[fallback], options)
    return { index: fallback, byVisitor: false }
  }

  return {
    stage,
    wait,
    find,
    exists: (target) => resolve(target) !== null,
    until,
    moveTo,
    click,
    doubleClick,
    drag,
    type,
    press,
    wheel,
    scroll,
    cursor: () => ({ ...pos }),
    boxOf,
    elementAt,
    aborted: () => signal.aborted,
    caption: (text) => {
      if (!signal.aborted) onCaption(text)
    },
    yourTurn,
  }
}

export { resetHover }
