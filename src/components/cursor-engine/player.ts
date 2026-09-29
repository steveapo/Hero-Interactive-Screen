import { spawnClickRipple } from "./cursor"
import { dispatchDown, dispatchKey, dispatchMove, dispatchUp } from "./dispatch"
import { bakeTrack, sampleTrack } from "./smoothing"
import { readEditable, resolveField, textAtStep, typingSteps, writeEditable, type EditableElement } from "./typing"
import type { BakedTrack, CursorRecording, SmoothingOptions, ZoomSegment } from "./types"
import { cameraAt, IDENTITY_CAMERA, type Camera } from "./zoom"

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
  private activeTyping: ActiveTyping[] = []
  private pressed: Element | null = null
  private camera: Camera = IDENTITY_CAMERA
  /** True while replaying up to a seek target: no click ripples. */
  private fastForwarding = false
  private observer: ResizeObserver

  constructor(
    private recording: CursorRecording,
    private options: SmoothingOptions,
    private el: PlayerElements,
    private hooks: PlayerHooks,
  ) {
    // Anchors depend on layout: re-bake on resize, keeping the current playback time.
    this.observer = new ResizeObserver(() => {
      if (!this.track) return
      this.track = this.bake()
      this.hooks.onTrack?.(this.track)
      this.applyCamera(this.time)
    })
    this.observer.observe(el.stage)
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
    this.el.cursor.dataset.pressed = "false"
    this.el.camera.style.transform = ""
    this.hooks.onVisibleChange(false)
  }

  private loop = (now: number) => {
    if (!this.playing || !this.track) return
    const t = Math.min(now - this.startedAt, this.track.duration)
    this.time = t
    this.process(t)
    if (t >= this.track.duration) {
      this.playing = false
      this.hooks.onEnd()
      return
    }
    this.frame = requestAnimationFrame(this.loop)
  }

  /** Bake with the camera neutralised, so anchors are measured in unzoomed layout. */
  private bake() {
    const previous = this.el.camera.style.transform
    this.el.camera.style.transform = "none"
    try {
      return bakeTrack(this.recording, this.el.stage, this.options)
    } finally {
      this.el.camera.style.transform = previous
    }
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
    const track = this.track
    if (!track) return
    const p = sampleTrack(track, t)
    this.el.cursor.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`
    this.applyCamera(t)

    // Finish typing that is due before later events (e.g. Enter) fire.
    this.advanceTyping(t)

    // Fire every press/release/key whose time has come, presses at their exact target point.
    while (this.nextEvent < track.events.length && track.events[this.nextEvent].t <= t) {
      const e = track.events[this.nextEvent++]
      if (e.type === "key") {
        const field = resolveField(this.el.stage, e.anchor)
        if (field) dispatchKey(field, e.key)
        continue
      }
      const point = this.toClient(e.x, e.y)
      if (e.type === "down") {
        this.pressed = dispatchDown(point)
        this.el.cursor.dataset.pressed = "true"
        if (!this.fastForwarding) spawnClickRipple(this.el.rippleLayer, e.x, e.y)
      } else {
        dispatchUp(this.pressed, point)
        this.pressed = null
        this.el.cursor.dataset.pressed = "false"
      }
    }
    if (this.pressed) dispatchMove(this.pressed, this.toClient(p.x, p.y))

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
