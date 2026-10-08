import { resolveAnchor, resolveAnchorElement } from "./anchors"
import { spawnClickRipple } from "./cursor"
import { dispatchDown, dispatchGesture, dispatchHover, dispatchKey, dispatchMove, dispatchUp, dispatchWheel, resetHover } from "./dispatch"
import { bakeTrack, sampleTrack } from "./smoothing"
import { readEditable, resolveField, textAtStep, typingSteps, writeEditable, type EditableElement } from "./typing"
import type { BakedTrack, CursorRecording, KeyModifiers, PressTarget, SmoothingOptions, ZoomSegment } from "./types"
import { cameraAt, IDENTITY_CAMERA, type Camera } from "./zoom"

/** A press target that moved by more than this (px) since the bake gets the track re-aimed. */
const REAIM_THRESHOLD = 1.5
/**
 * Longest playback holds (ms) for a press / key / typing target that isn't on screen yet (a
 * reply still arriving, a popover still opening) before carrying on without it.
 */
const MAX_TARGET_WAIT = 4000
/** Quiet time (ms) after the last stage resize before the track is re-baked. */
const RESIZE_REBAKE_DELAY = 150

export type PlayerElements = {
  /** The stage: coordinates are relative to it. Never transformed. */
  stage: HTMLElement
  /** Wrapper around the screen + cursor that the zoom camera transforms. */
  camera: HTMLElement
  cursor: HTMLElement
  rippleLayer: HTMLElement
}

export type PlayerHooks = {
  /** Called with each (re)baked track, e.g. to draw the editor timeline. */
  onTrack?: (track: BakedTrack) => void
  onVisibleChange: (visible: boolean) => void
  /** Playback reached the end of the track. */
  onEnd: () => void
  /** Current zoom segments; read every frame so zoom edits apply live. */
  getZooms: () => ZoomSegment[]
}

type ActiveTyping = { start: number; duration: number; field: EditableElement; from: string; to: string; applied: number }

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * Plays one recording over a freshly mounted screen: moves the cursor, fires clicks, keys and
 * typing, and drives the zoom camera. Supports play / pause and starting from any time.
 * Seeking backwards needs a fresh screen, so the stage remounts it and starts a new player
 * at the target time.
 */
export class CursorPlayer {
  track: BakedTrack | null = null
  private time = 0
  private startedAt = 0
  private playing = false
  private destroyed = false
  private frame = 0
  private nextEvent = 0
  private nextTyping = 0
  private nextScroll = 0
  private nextWheel = 0
  private nextGesture = 0
  /** Mouse button of the current press (while `pressed`). */
  private pressedButton = 0
  /** Modifier keys held with the current press (Shift-click, …). */
  private pressedMods: KeyModifiers | undefined = undefined
  /** Last point a hover move was sent at. */
  private lastHover: { clientX: number; clientY: number } | null = null
  private activeTyping: ActiveTyping[] = []
  private pressed: Element | null = null
  private camera: Camera = IDENTITY_CAMERA
  /** True while replaying up to a seek target: no click ripples. */
  private fastForwarding = false
  private observer: ResizeObserver
  /**
   * Targets of presses that have already fired (by recording press index). Re-bakes reuse them,
   * so only presses still to come are re-aimed at the layout as it is now.
   */
  private pins = new Map<number, PressTarget>()
  /** Offset from the new path back to the old one after a re-aim, faded out over `options.reaimBlend` (wall-clock ms). */
  private blend: { dx: number; dy: number; start: number } | null = null
  /**
   * Holding for a target that isn't on screen yet. `key` identifies the pending item (so each
   * gets its own wait), `settleUntil` is set once it appears, so the cursor gets there first.
   */
  private waiting: { key: string; since: number; settleUntil?: number } | null = null

  constructor(
    private recording: CursorRecording,
    private options: SmoothingOptions,
    private el: PlayerElements,
    private hooks: PlayerHooks,
  ) {
    // Anchors depend on layout: re-bake on resize, keeping the current playback time. Fired
    // presses were measured at the old size, so they're measured again too. Debounced so a
    // continuously resizing stage (e.g. a scroll-driven grow) re-bakes once it settles.
    this.observer = new ResizeObserver(() => {
      clearTimeout(this.resizeTimer)
      this.resizeTimer = setTimeout(this.rebakeForResize, RESIZE_REBAKE_DELAY)
    })
    this.observer.observe(el.stage)
  }

  private resizeTimer: ReturnType<typeof setTimeout> | undefined

  private rebakeForResize = () => {
    if (this.destroyed || !this.track) return
    this.pins.clear()
    this.blend = null
    this.track = this.bake()
    this.hooks.onTrack?.(this.track)
    this.applyCamera(this.time)
  }

  get currentTime() {
    return this.time
  }

  get isPlaying() {
    return this.playing
  }

  /**
   * Start at `at` ms. Everything before it (clicks, keys, finished typing) is replayed quickly,
   * one frame apart so the screen can re-render between steps. Then it plays or stays paused.
   */
  async start(at: number, autoplay: boolean) {
    const track = this.bake()
    this.track = track
    this.hooks.onTrack?.(track)
    const target = Math.min(Math.max(at, 0), track.duration)

    if (target > 0) {
      const due = [...track.events.map((e) => e.t), ...track.typing.map((r) => r.t)]
        .filter((t) => t <= target)
        .sort((a, b) => a - b)
      this.fastForwarding = true
      for (const t of due) {
        // Give targets that appear asynchronously (replies, popovers) the same chance to show up.
        const waitStart = performance.now()
        while (this.blockedAt(t) !== null && performance.now() - waitStart < MAX_TARGET_WAIT) {
          await nextFrame()
          if (this.destroyed) return
        }
        this.process(t)
        await nextFrame()
        if (this.destroyed) return
      }
      this.fastForwarding = false
    }

    this.time = target
    this.process(target)
    this.hooks.onVisibleChange(true)
    if (autoplay) this.play()
  }

  play() {
    if (this.playing || this.destroyed || !this.track) return
    this.playing = true
    this.startedAt = performance.now() - this.time
    this.frame = requestAnimationFrame(this.loop)
  }

  pause() {
    this.playing = false
    cancelAnimationFrame(this.frame)
  }

  /** Re-apply the camera at the current time (after zoom edits while paused). */
  refreshCamera() {
    if (this.track) this.applyCamera(this.time)
  }

  destroy() {
    this.destroyed = true
    this.pause()
    this.observer.disconnect()
    clearTimeout(this.resizeTimer)
    resetHover()
    this.el.cursor.dataset.pressed = "false"
    this.el.camera.style.transform = ""
    this.hooks.onVisibleChange(false)
  }

  private loop = (now: number) => {
    if (!this.playing || !this.track) return
    let t = Math.min(now - this.startedAt, this.track.duration)

    // Don't press / type / key into something that isn't there yet: hold the timeline just
    // before it (up to MAX_TARGET_WAIT), then give the re-aimed cursor a moment to get there.
    const blocked = this.blockedAt(t)
    const key = `${this.nextEvent}:${this.nextTyping}`
    if (blocked !== null) {
      const waiting = this.waiting?.key === key ? this.waiting : { key, since: now }
      this.waiting = waiting
      if (now - waiting.since < MAX_TARGET_WAIT) t = this.holdAt(now, Math.max(this.time, blocked - 1))
    } else if (this.waiting?.key === key) {
      this.waiting.settleUntil ??= now + this.options.reaimBlend
      if (now < this.waiting.settleUntil) t = this.holdAt(now, this.time)
      else this.waiting = null
    } else {
      this.waiting = null
    }

    this.time = t
    this.process(t)
    if (t >= this.track.duration) {
      this.playing = false
      this.hooks.onEnd()
      return
    }
    this.frame = requestAnimationFrame(this.loop)
  }

  /** Freeze the timeline at `t` for this frame (shifting the clock so it resumes from there). */
  private holdAt(now: number, t: number) {
    this.startedAt = now - t
    return t
  }

  /** Time of the next press / key / typing run due by `t` whose target isn't in the page yet, or null. */
  private blockedAt(t: number): number | null {
    const track = this.track
    if (!track) return null
    let blocked: number | null = null
    const e = track.events[this.nextEvent]
    if (e && e.t <= t) {
      const anchor = e.type === "key" ? e.anchor : e.type === "down" ? this.recording.events[e.source]?.anchor : undefined
      if (anchor && !resolveAnchorElement(this.el.stage, anchor)) blocked = e.t
    }
    const run = track.typing[this.nextTyping]
    if (run && run.t <= t && run.anchor && !resolveAnchorElement(this.el.stage, run.anchor)) {
      blocked = Math.min(blocked ?? run.t, run.t)
    }
    return blocked
  }

  /** Bake with the camera neutralised, so anchors are measured in unzoomed layout. */
  private bake() {
    const previous = this.el.camera.style.transform
    this.el.camera.style.transform = "none"
    try {
      return bakeTrack(this.recording, this.el.stage, this.options, this.pins)
    } finally {
      this.el.camera.style.transform = previous
    }
  }

  /**
   * The screen changes as it's played (an element gets dragged, a panel opens next to it), so a
   * target measured at bake time can be stale. Measure the next press's target now; if it moved
   * (or only just appeared), re-bake so the cursor heads to where it actually is, easing from
   * the old path onto the new one.
   */
  private reaimIfMoved(t: number) {
    const track = this.track
    if (!track) return
    let next = this.nextEvent
    while (next < track.events.length && track.events[next].type !== "down") next++
    const e = track.events[next]
    if (!e || e.type !== "down" || e.source < 0) return
    const anchor = this.recording.events[e.source]?.anchor
    if (!anchor) return
    const live = resolveAnchor(this.el.stage, anchor)
    if (!live) return
    // Measured through the zoom camera: convert back to unzoomed stage px, like the bake.
    const { scale, x: cx, y: cy } = this.camera
    const now = { x: (live.x - cx) / scale, y: (live.y - cy) / scale }
    const baked = track.targets[e.source]
    if (baked && Math.hypot(now.x - baked.x, now.y - baked.y) <= REAIM_THRESHOLD) return

    const before = this.cursorAt(t)
    this.track = this.bake()
    const after = sampleTrack(this.track, t)
    this.blend = { dx: before.x - after.x, dy: before.y - after.y, start: performance.now() }
    this.hooks.onTrack?.(this.track)
  }

  /**
   * Visible cursor position at t: the track, plus what's left of a re-aim blend. The blend runs
   * on the wall clock, so it completes even while the timeline is held waiting for a target.
   */
  private cursorAt(t: number) {
    const p = sampleTrack(this.track!, t)
    const blend = this.blend
    if (!blend) return p
    const duration = Math.max(this.options.reaimBlend, 1)
    const k = Math.min(Math.max((performance.now() - blend.start) / duration, 0), 1)
    if (k >= 1) {
      this.blend = null
      return p
    }
    const w = 1 - k * k * (3 - 2 * k)
    return { x: p.x + blend.dx * w, y: p.y + blend.dy * w }
  }

  /** Stage px → viewport px, through the zoom camera. */
  private toClient(x: number, y: number) {
    const rect = this.el.stage.getBoundingClientRect()
    const { scale, x: cx, y: cy } = this.camera
    return { clientX: rect.left + cx + x * scale, clientY: rect.top + cy + y * scale }
  }

  private applyCamera(t: number) {
    if (!this.track) return
    const { width, height } = this.el.stage.getBoundingClientRect()
    this.camera = cameraAt(this.track, this.hooks.getZooms(), t, width, height)
    const { scale, x, y } = this.camera
    this.el.camera.style.transform = scale === 1 ? "" : `translate(${x}px, ${y}px) scale(${scale})`
  }

  /** Type active runs up to time t: a steady number of characters per ms, pauses ignored. */
  private advanceTyping(t: number) {
    this.activeTyping = this.activeTyping.filter((run) => {
      const steps = typingSteps(run.from, run.to)
      const progress = run.duration > 0 ? Math.min(1, (t - run.start) / run.duration) : 1
      const step = Math.floor(progress * steps)
      if (step !== run.applied) {
        writeEditable(run.field, textAtStep(run.from, run.to, step))
        run.applied = step
      }
      return step < steps
    })
  }

  /** Bring the screen to time t: cursor, camera, and every event due by then. */
  private process(t: number) {
    // Re-aim at the layout as it is now (not mid-drag: the dragged element follows the cursor).
    // Runs before the camera update, so it measures under the transform currently applied.
    if (!this.pressed) this.reaimIfMoved(t)
    const track = this.track
    if (!track) return
    const p = this.cursorAt(t)
    this.el.cursor.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    this.applyCamera(t)

    // Finish typing that is due before later events (e.g. Enter) fire.
    this.advanceTyping(t)

    // Scroll first, so presses due in the same frame hit what is under the cursor after scrolling.
    // Only the latest due position per element matters, so earlier ones are skipped.
    const latest = new Map<Element, { top: number; left: number }>()
    while (this.nextScroll < track.scrolls.length && track.scrolls[this.nextScroll].t <= t) {
      const s = track.scrolls[this.nextScroll++]
      const target = s.anchor ? resolveAnchorElement(this.el.stage, s.anchor) : null
      if (target) latest.set(target, { top: s.top, left: s.left })
    }
    for (const [target, { top, left }] of latest) target.scrollTo({ top, left, behavior: "instant" })

    // Hover: move over whatever is under the cursor (only when it actually moved, like a mouse).
    const client = this.toClient(p.x, p.y)
    if (!this.pressed && (client.clientX !== this.lastHover?.clientX || client.clientY !== this.lastHover?.clientY)) {
      dispatchHover(client)
      this.lastHover = client
    }

    // Wheel (pan, pinch / ⌘-scroll zoom) and Safari gestures, at the cursor, in recorded order.
    while (this.nextWheel < track.wheels.length && track.wheels[this.nextWheel].t <= t) {
      dispatchWheel(client, track.wheels[this.nextWheel++])
    }
    while (this.nextGesture < track.gestures.length && track.gestures[this.nextGesture].t <= t) {
      dispatchGesture(client, track.gestures[this.nextGesture++])
    }

    // Fire every press/release/key whose time has come, presses at their exact target point.
    while (this.nextEvent < track.events.length && track.events[this.nextEvent].t <= t) {
      const e = track.events[this.nextEvent++]
      if (e.type === "key") {
        // In a field: the field (older takes have no `field` flag; they only recorded field keys).
        // Otherwise the element that had focus, or the page itself.
        const target =
          e.field !== false
            ? resolveField(this.el.stage, e.anchor)
            : ((e.anchor ? resolveAnchorElement(this.el.stage, e.anchor) : null) ?? document.body)
        if (target) dispatchKey(target, e.key, e.code, e.mods)
        continue
      }
      const point = this.toClient(e.x, e.y)
      const mods = e.source >= 0 ? this.recording.events[e.source]?.mods : undefined
      // Keep where this press was aimed, so later re-bakes don't move presses already made.
      if (e.source >= 0) this.pins.set(e.source, track.targets[e.source] ?? null)
      if (e.type === "down") {
        this.pressed = dispatchDown(point, e.button, mods)
        this.pressedButton = e.button
        this.pressedMods = mods
        this.el.cursor.dataset.pressed = "true"
        if (!this.fastForwarding) spawnClickRipple(this.el.rippleLayer, e.x, e.y)
      } else {
        dispatchUp(this.pressed, point, e.button, mods)
        this.pressed = null
        this.el.cursor.dataset.pressed = "false"
      }
    }
    if (this.pressed) dispatchMove(this.pressed, client, this.pressedButton, this.pressedMods)

    // Start typing runs that are due (after presses, which usually focus their field).
    while (this.nextTyping < track.typing.length && track.typing[this.nextTyping].t <= t) {
      const run = track.typing[this.nextTyping++]
      const field = resolveField(this.el.stage, run.anchor)
      if (!field) continue
      field.focus({ preventScroll: true })
      // Start from the field's actual text, so playback stays consistent even if it differs.
      this.activeTyping.push({ start: run.t, duration: run.duration, field, from: readEditable(field), to: run.to, applied: -1 })
    }
    this.advanceTyping(t)
  }
}
