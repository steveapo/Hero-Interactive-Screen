/**
 * Cursor engine data model.
 *
 * A recording is captured in *stage coordinates*: px relative to the top-left of the
 * <CursorStage> element, at the stage size it was recorded at (`stage`). Playback rescales to
 * the current stage size, then re-targets every press/release onto its anchor element so clicks
 * still land on the right control when the layout differs (different viewport width, etc.).
 */

/** Which element a press/release happened on, and where inside it (0–1 fractions of its rect). */
export type CursorAnchor = {
  /** Value of the nearest `data-cursor-id` ancestor. Preferred: stable across layout changes. */
  id?: string
  /** Fallback structural path from the stage (`nth-child` indices), used when no id is found. */
  path?: number[]
  fx: number
  fy: number
}

/** A raw cursor position sample: [timeMs, x, y]. Tuples keep the JSON compact. */
export type CursorSample = [t: number, x: number, y: number]

export type CursorPressEvent = {
  type: "down" | "up"
  t: number
  x: number
  y: number
  anchor?: CursorAnchor
}

export type CursorRecording = {
  version: 1
  /** Stage size (px) at record time. */
  stage: { width: number; height: number }
  /** Total length in ms. */
  duration: number
  samples: CursorSample[]
  events: CursorPressEvent[]
  /** Text entered into fields, one run per uninterrupted stretch of typing in a field. */
  typing?: CursorTypingRun[]
  /** Keys that trigger behaviour rather than insert text (e.g. Enter to submit). */
  keys?: CursorKeyEvent[]
  /** Post-production edits made in the editor (`?edit=true`). */
  edits?: CursorEdits
}

/**
 * Editor changes, stored alongside the raw take so it can be re-edited. Times are in *recorded*
 * ms, so a zoom stays on the same moment when typing speed or other timing settings change.
 */
export type CursorEdits = {
  zooms?: ZoomSegment[]
  /** Typing speed multiplier per typing run, keyed by the run's index in `typing` (2 = twice as fast). */
  typingSpeed?: Record<string, number>
  /** Overrides for the smoothing / pacing options. */
  settings?: Partial<SmoothingOptions>
}

/** Zoom the camera in on the cursor between `start` and `end` (recorded ms), eased in and out. */
export type ZoomSegment = {
  id: string
  start: number
  end: number
  /** Zoom level at full zoom (2 = 200%). */
  scale: number
}

/**
 * A stretch of typing into one field: the text before and after. Keystroke timing is dropped on
 * purpose, so playback retypes it at a steady speed however much the user paused mid-way.
 * A run ends when the user clicks, presses a recorded key, leaves the field, or types elsewhere.
 */
export type CursorTypingRun = {
  /** Recorded time of the first / last input in the run (ms). */
  start: number
  end: number
  /** The field (anchored at its centre). */
  anchor?: CursorAnchor
  from: string
  to: string
}

export type CursorKeyEvent = {
  t: number
  key: "Enter"
  anchor?: CursorAnchor
}

export type SmoothingOptions = {
  /** Pauses longer than this (ms) are shortened to it, like ScreenStudio's idle trimming. */
  maxIdle: number
  /** Path simplification tolerance in px: wobble smaller than this is removed. */
  simplifyTolerance: number
  /** How long (ms) the cursor holds still on its target before each press. */
  clickDwell: number
  /** Spring stiffness / damping for the final cursor motion. */
  stiffness: number
  damping: number
  /** Playback speed multiplier (2 = twice as fast). Typing uses its own speed settings below. */
  speed: number
  /** Time (ms) to type a single character; longer text gets faster per character. */
  typingMsPerChar: number
  /**
   * How typing time grows with text length: duration = typingMsPerChar × chars^typingGrowth.
   * 1 = constant per-character speed; lower values speed long text up more (0.7 → 10 chars
   * ≈ 0.35 s, 100 chars ≈ 1.8 s at 70 ms/char).
   */
  typingGrowth: number
  /** Upper bound (ms) for any single typing run. */
  maxTypingDuration: number
}

export const DEFAULT_SMOOTHING: SmoothingOptions = {
  maxIdle: 600,
  simplifyTolerance: 6,
  clickDwell: 160,
  stiffness: 170,
  damping: 26,
  speed: 1,
  typingMsPerChar: 70,
  typingGrowth: 0.7,
  maxTypingDuration: 3500,
}

/** An instant event on the baked timeline, in current stage px. */
export type BakedEvent =
  | { type: "down" | "up"; t: number; x: number; y: number }
  | { type: "key"; t: number; key: string; anchor?: CursorAnchor }

/** A typing run on the baked timeline: `from` → `to` at a steady rate over `duration` ms. */
export type BakedTyping = {
  /** Index of the run in the recording's `typing` array (for per-run edits). */
  index: number
  t: number
  duration: number
  anchor?: CursorAnchor
  from: string
  to: string
}

/** The ready-to-play result: evenly spaced frames plus events on the same timeline. */
export type BakedTrack = {
  /** Frame interval in ms. */
  step: number
  /** Flat [x0, y0, x1, y1, ...] positions, one pair per `step`. */
  points: Float32Array
  duration: number
  events: BakedEvent[]
  typing: BakedTyping[]
  /** Matching (recorded ms, baked ms) pairs, both ascending: converts edit times to playback times. */
  timeMap: { source: number[]; baked: number[] }
}
