import { resolveAnchor } from "./anchors"
import { typingDuration, typingSteps } from "./typing"
import type {
  BakedEvent,
  BakedTrack,
  BakedTyping,
  CursorAnchor,
  CursorRecording,
  CursorTypingRun,
  SmoothingOptions,
} from "./types"

/**
 * Turns a raw recording into a smooth, ready-to-play track for the *current* stage. The steps
 * run in this order:
 *
 *  1. Re-target: rescale to the current stage size and warp the path so each press lands on
 *     its anchor element's current position. Typing runs and keys become timeline markers.
 *  2. Trim idle: pauses longer than `maxIdle` are shortened, then `speed` is applied. Each typing
 *     run's recorded span (pauses included) is replaced by its length-based typing duration,
 *     and the cursor holds still for it.
 *  3. Simplify: Ramer–Douglas–Peucker removes hand jitter while keeping presses and pauses.
 *  4. Dwell: the cursor holds still on its target for `clickDwell` ms before each press.
 *  5. Curve: time-parameterised cubic Hermite (Catmull-Rom tangents) through the keyframes,
 *     easing to a stop at presses and pauses.
 *  6. Spring: a critically damped spring follows the curve for ScreenStudio-style motion, and is
 *     pinned onto the exact target around each press so the visual cursor matches the click.
 *
 * Re-run it whenever the stage resizes, since anchor positions depend on the layout.
 */

/** Bake resolution: 120 frames per second. */
const STEP = 1000 / 120
/** Gaps longer than this (ms) count as a deliberate pause and are kept as keyframes. */
const PAUSE_GAP = 100
/** Extra time after the last keyframe so the spring can settle. */
const TAIL = 400
/** A press and release this close together (px) are a click; further apart, a drag. */
const CLICK_RADIUS = 8
/** Presses closer together than this (ms, after idle trimming) form a double-click. */
const DOUBLE_CLICK_GAP = 400

/**
 * Non-movement moments on the timeline. The cursor stays where it is for each of them:
 * - type: a typing run starts (lasting `duration` ms on the baked timeline)
 * - hold: the end of a typing run (the cursor stays put until here)
 * - key: a key press
 */
type Mark =
  | { kind: "type"; run: CursorTypingRun; index: number; duration: number }
  | { kind: "hold" }
  | { kind: "key"; key: string; anchor?: CursorAnchor }

/** `t` is the point's time on the current timeline; `src` its recorded time (set from step 2 on). */
type Point = { t: number; src?: number; x: number; y: number; press?: "down" | "up"; mark?: Mark }
type Keyframe = Point & { stop: boolean }

export function bakeTrack(
  recording: CursorRecording,
  stage: HTMLElement,
  options: SmoothingOptions,
): BakedTrack {
  const merged = retarget(recording, stage, options)
  const timed = trimIdle(merged, options.maxIdle, options.speed)
  const simplified = simplify(timed, options.simplifyTolerance)
  const { keyframes, events, typing } = addDwell(simplified, options.clickDwell)
  return springBake(keyframes, events, typing, options)
}

/* ------------------------------ 1. Re-target ------------------------------- */

function retarget(recording: CursorRecording, stage: HTMLElement, options: SmoothingOptions): Point[] {
  const rect = stage.getBoundingClientRect()
  const sx = rect.width / (recording.stage.width || rect.width)
  const sy = rect.height / (recording.stage.height || rect.height)

  // Offset (resolved − recorded) at each press. A release that ends a drag keeps the drag's
  // shape by reusing its press offset instead of snapping to whatever it was released over.
  const offsets: { t: number; dx: number; dy: number }[] = []
  let lastDown: { x: number; y: number; dx: number; dy: number } | null = null
  for (const e of recording.events) {
    const x = e.x * sx
    const y = e.y * sy
    const isDrag = e.type === "up" && lastDown && Math.hypot(x - lastDown.x, y - lastDown.y) > CLICK_RADIUS
    let dx = 0
    let dy = 0
    if (isDrag && lastDown) {
      dx = lastDown.dx
      dy = lastDown.dy
    } else if (e.anchor) {
      const resolved = resolveAnchor(stage, e.anchor)
      if (resolved) {
        dx = resolved.x - x
        dy = resolved.y - y
      }
    }
    offsets.push({ t: e.t, dx, dy })
    if (e.type === "down") lastDown = { x, y, dx, dy }
  }

  function offsetAt(t: number) {
    if (offsets.length === 0) return { dx: 0, dy: 0 }
    if (t <= offsets[0].t) return offsets[0]
    for (let i = 1; i < offsets.length; i++) {
      const b = offsets[i]
      if (t <= b.t) {
        const a = offsets[i - 1]
        const k = b.t === a.t ? 1 : (t - a.t) / (b.t - a.t)
        return { dx: a.dx + (b.dx - a.dx) * k, dy: a.dy + (b.dy - a.dy) * k }
      }
    }
    return offsets[offsets.length - 1]
  }

  const points: Point[] = recording.samples.map(([t, x, y]) => {
    const { dx, dy } = offsetAt(t)
    return { t, x: x * sx + dx, y: y * sy + dy }
  })
  recording.events.forEach((e, i) => {
    points.push({ t: e.t, x: e.x * sx + offsets[i].dx, y: e.y * sy + offsets[i].dy, press: e.type })
  })

  // Typing and keys don't move the cursor: they get their position from the points around them.
  const runs = recording.typing ?? []
  runs.forEach((run, index) => {
    // Per-run speed from the editor: 2 = twice as fast as the length-based default.
    const speed = recording.edits?.typingSpeed?.[String(index)] ?? 1
    const duration = typingDuration(typingSteps(run.from, run.to), options) / speed
    points.push({ t: run.start, x: NaN, y: NaN, mark: { kind: "type", run, index, duration } })
  })
  for (const k of recording.keys ?? []) {
    points.push({ t: k.t, x: NaN, y: NaN, mark: { kind: "key", key: k.key, anchor: k.anchor } })
  }

  // Sort by time; at the same instant: moves, then presses, then keys, then typing.
  const rank = (p: Point) => (p.mark?.kind === "type" ? 3 : p.mark ? 2 : p.press ? 1 : 0)
  points.sort((a, b) => a.t - b.t || rank(a) - rank(b))

  const cleaned = points.filter((p, i) => {
    if (p.press || p.mark) return true
    // Drop moves that duplicate a press, and any cursor wobble while typing (the cursor holds still).
    if (points[i + 1]?.t === p.t && points[i + 1]?.press) return false
    return !runs.some((run) => p.t > run.start && p.t <= run.end)
  })

  // Markers take the cursor position just before them (or just after, if nothing precedes).
  let last: Point | undefined = cleaned.find((p) => !Number.isNaN(p.x))
  for (const p of cleaned) {
    if (Number.isNaN(p.x)) {
      p.x = last?.x ?? 0
      p.y = last?.y ?? 0
    } else {
      last = p
    }
  }
  return cleaned
}

/* ------------------------------ 2. Trim idle ------------------------------- */

function trimIdle(points: Point[], maxIdle: number, speed: number): Point[] {
  const out: Point[] = []
  let t = 0
  // Recorded time the previous step ended at: a typing run "ends" at its last keystroke.
  let prevEnd = points[0]?.t ?? 0
  for (const p of points) {
    t += Math.min(Math.max(p.t - prevEnd, 0), maxIdle) / speed
    out.push({ ...p, src: p.t, t })
    prevEnd = p.t

    // Replace the run's recorded span, pauses and all, with its steady typing duration.
    // Typing time is not affected by `speed`; tune it with the typing options instead.
    if (p.mark?.kind === "type") {
      t += p.mark.duration
      out.push({ t, src: p.mark.run.end, x: p.x, y: p.y, mark: { kind: "hold" } })
      prevEnd = p.mark.run.end
    }
  }
  return out
}

/* ------------------------------ 3. Simplify -------------------------------- */

function simplify(points: Point[], tolerance: number): Keyframe[] {
  if (points.length <= 2) return points.map((p) => ({ ...p, stop: true }))

  // Keyframes that must survive: ends, presses, typing/key markers, and either side of a pause.
  const keep = points.map((p, i) => {
    if (i === 0 || i === points.length - 1 || p.press || p.mark) return true
    return points[i + 1].t - p.t > PAUSE_GAP || p.t - points[i - 1].t > PAUSE_GAP
  })

  const kept = new Set<number>()
  let start = 0
  for (let i = 1; i < points.length; i++) {
    if (!keep[i]) continue
    rdp(points, start, i, tolerance, kept)
    start = i
  }

  return points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => keep[i] || kept.has(i))
    // The cursor eases to a full stop at every must-keep point: presses, pauses and the ends.
    .map(({ p, i }) => ({ ...p, stop: keep[i] }))
}

function rdp(points: Point[], first: number, last: number, tolerance: number, kept: Set<number>) {
  kept.add(first)
  kept.add(last)
  const a = points[first]
  const b = points[last]
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  let maxDist = 0
  let index = -1
  for (let i = first + 1; i < last; i++) {
    const p = points[i]
    const dist = len
      ? Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len
      : Math.hypot(p.x - a.x, p.y - a.y)
    if (dist > maxDist) {
      maxDist = dist
      index = i
    }
  }
  if (index !== -1 && maxDist > tolerance) {
    rdp(points, first, index, tolerance, kept)
    rdp(points, index, last, tolerance, kept)
  }
}

/* -------------------------------- 4. Dwell --------------------------------- */

function addDwell(keyframes: Keyframe[], dwell: number) {
  const out: Keyframe[] = []
  const events: BakedEvent[] = []
  const typing: BakedTyping[] = []
  let shift = 0
  let lastDown: Keyframe | null = null
  for (const k of keyframes) {
    // The second click of a double-click follows immediately: no dwell, or it would be too slow.
    const isDoubleClick =
      lastDown && k.t - lastDown.t < DOUBLE_CLICK_GAP && Math.hypot(k.x - lastDown.x, k.y - lastDown.y) < CLICK_RADIUS
    if (k.press === "down" && dwell > 0 && !isDoubleClick) {
      out.push({ t: k.t + shift, src: k.src, x: k.x, y: k.y, stop: true }) // arrive and hold
      shift += dwell
    }
    if (k.press === "down") lastDown = k
    const t = k.t + shift
    out.push({ ...k, t })
    if (k.press) events.push({ type: k.press, t, x: k.x, y: k.y })
    if (k.mark?.kind === "key") events.push({ type: "key", t, key: k.mark.key, anchor: k.mark.anchor })
    if (k.mark?.kind === "type") {
      const { run, index, duration } = k.mark
      typing.push({ index, t, duration, anchor: run.anchor, from: run.from, to: run.to })
    }
  }
  return { keyframes: out, events, typing }
}

/* --------------------------- 5. Curve + 6. Spring --------------------------- */

function springBake(
  keyframes: Keyframe[],
  events: BakedEvent[],
  typing: BakedTyping[],
  options: SmoothingOptions,
): BakedTrack {
  const n = keyframes.length
  // Velocity tangents (px/ms); zero at stops so the cursor eases in and out.
  const tangents = keyframes.map((k, i) => {
    if (k.stop || i === 0 || i === n - 1) return { x: 0, y: 0 }
    const prev = keyframes[i - 1]
    const next = keyframes[i + 1]
    const dt = next.t - prev.t || 1
    return { x: (next.x - prev.x) / dt, y: (next.y - prev.y) / dt }
  })

  let seg = 0
  function target(t: number) {
    while (seg < n - 2 && t > keyframes[seg + 1].t) seg++
    const a = keyframes[seg]
    const b = keyframes[Math.min(seg + 1, n - 1)]
    const h = b.t - a.t
    if (h <= 0 || t <= a.t) return a
    if (t >= b.t) return b
    const u = (t - a.t) / h
    const u2 = u * u
    const u3 = u2 * u
    const h00 = 2 * u3 - 3 * u2 + 1
    const h10 = u3 - 2 * u2 + u
    const h01 = -2 * u3 + 3 * u2
    const h11 = u3 - u2
    const ma = tangents[seg]
    const mb = tangents[Math.min(seg + 1, n - 1)]
    return {
      x: h00 * a.x + h10 * h * ma.x + h01 * b.x + h11 * h * mb.x,
      y: h00 * a.y + h10 * h * ma.y + h01 * b.y + h11 * h * mb.y,
    }
  }

  // Pin weight: 0 = pure spring, 1 = exactly on target. Ramps up over the dwell before a press
  // and back down after it, so the visible cursor sits precisely where the click is dispatched.
  const downs = events.filter((e) => e.type === "down")
  const pinWindow = Math.max(options.clickDwell, STEP)
  function pinWeight(t: number) {
    let w = 0
    for (const e of downs) {
      const d = t - e.t
      if (d < -pinWindow || d > pinWindow) continue
      const k = 1 - Math.abs(d) / pinWindow
      w = Math.max(w, k * k * (3 - 2 * k))
    }
    return w
  }

  const duration = (keyframes[n - 1]?.t ?? 0) + TAIL
  const frames = Math.ceil(duration / STEP) + 1
  const points = new Float32Array(frames * 2)
  const start = keyframes[0] ?? { x: 0, y: 0 }
  let x = start.x
  let y = start.y
  let vx = 0
  let vy = 0
  const dt = STEP / 1000
  for (let f = 0; f < frames; f++) {
    const t = f * STEP
    const goal = target(t)
    // Semi-implicit Euler spring (mass 1).
    vx += (options.stiffness * (goal.x - x) - options.damping * vx) * dt
    vy += (options.stiffness * (goal.y - y) - options.damping * vy) * dt
    x += vx * dt
    y += vy * dt
    const w = pinWeight(t)
    points[f * 2] = x + (goal.x - x) * w
    points[f * 2 + 1] = y + (goal.y - y) * w
  }

  // Recorded ↔ baked time pairs from the keyframes (both ascending), for placing edits.
  const timeMap = { source: keyframes.map((k) => k.src ?? 0), baked: keyframes.map((k) => k.t) }

  return { step: STEP, points, duration, events, typing, timeMap }
}

/** Recorded time (ms) → time on the baked timeline. */
export function toBakedTime(track: BakedTrack, source: number) {
  return mapTime(track.timeMap.source, track.timeMap.baked, source)
}

/** Baked timeline time (ms) → recorded time. */
export function toSourceTime(track: BakedTrack, baked: number) {
  return mapTime(track.timeMap.baked, track.timeMap.source, baked)
}

/** Piecewise-linear lookup; extrapolates at 1:1 beyond either end. */
function mapTime(from: number[], to: number[], value: number) {
  const n = from.length
  if (n === 0) return value
  if (value <= from[0]) return to[0] + (value - from[0])
  for (let i = 1; i < n; i++) {
    if (value <= from[i]) {
      const span = from[i] - from[i - 1]
      // Flat spans (e.g. the pre-click dwell, where recorded time stands still) map to their start.
      return span === 0 ? to[i - 1] : to[i - 1] + ((value - from[i - 1]) / span) * (to[i] - to[i - 1])
    }
  }
  return to[n - 1] + (value - from[n - 1])
}

/** Position on a baked track at time t (ms), linearly interpolated between frames. */
export function sampleTrack(track: BakedTrack, t: number) {
  const last = track.points.length / 2 - 1
  const f = Math.min(Math.max(t / track.step, 0), last)
  const i = Math.floor(f)
  const j = Math.min(i + 1, last)
  const k = f - i
  const p = track.points
  return {
    x: p[i * 2] + (p[j * 2] - p[i * 2]) * k,
    y: p[i * 2 + 1] + (p[j * 2 + 1] - p[i * 2 + 1]) * k,
  }
}
