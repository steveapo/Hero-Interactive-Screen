/**
 * Cursor engine data model.
 *
 * A recording is captured in *stage coordinates*: px relative to the top-left of the
 * <CursorStage> element, at the stage size it was recorded at (`stage`). Playback rescales to
 * the current stage size, then re-targets every press/release onto its anchor element so clicks
 * still land on the right control when the layout differs (different viewport width, etc.).
 */

/**
 * Which element a press/release happened on, and where inside it (0–1 fractions of its rect).
 * The element is found from a *base* (by `id`, else `fp`, else the stage for `path`), then
 * `rel` child indices down from that base.
 */
export type CursorAnchor = {
  /** Value of the nearest `data-cursor-id` ancestor. Preferred: stable across layout changes. */
  id?: string
  /** What the base element is (role, label, text, …), so it's found wherever it renders. */
  fp?: AnchorFingerprint
  /** Child-index path from the `id` / `fp` base down to the element (empty / missing = the base). */
  rel?: number[]
  /** Fallback structural path from the stage (`nth-child` indices), used when nothing identifiable was found. */
  path?: number[]
  fx: number
  fy: number
}

/**
 * Identity of an element that survives re-renders, siblings coming and going, and portals:
 * its tag plus stable attributes (role, aria-label, …) or short text. `nth` tells apart
 * elements that match equally (the 1st vs 2nd "Good response" button), counted over visible
 * matches in the stage and its portals, in document order.
 */
export type AnchorFingerprint = {
  tag: string
  attrs?: Record<string, string>
  text?: string
  nth: number
  /** A top-level portal container (a direct child of <body>) with nothing identifiable about it. */
  top?: boolean
}

/** A raw cursor position sample: [timeMs, x, y]. Tuples keep the JSON compact. */
export type CursorSample = [t: number, x: number, y: number]

export type CursorPressEvent = {
  type: "down" | "up"
  t: number
  x: number
  y: number
  /** Mouse button (0 left, 1 middle, 2 right). Missing = left, as in older takes. */
  button?: number
  anchor?: CursorAnchor
}

/** Modifier keys held during a key press or wheel event. */
export type KeyModifiers = { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean }

/**
 * A wheel event over the stage: scrolling, trackpad panning, and pinch-zoom (browsers other than
 * Safari report a pinch as a wheel with `ctrl`). Replayed at the cursor's position.
 */
export type CursorWheelEvent = {
  t: number
  deltaX: number
  deltaY: number
  deltaZ?: number
  /** 0 pixels, 1 lines, 2 pages (WheelEvent.deltaMode). */
  deltaMode: number
  mods?: KeyModifiers
}

/** Safari's trackpad pinch / rotate gesture events. Replayed at the cursor's position. */
export type CursorGestureEvent = {
  t: number
  type: "gesturestart" | "gesturechange" | "gestureend"
  scale: number
  rotation: number
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
  /** Keys that trigger behaviour rather than insert text (Enter, Escape, shortcuts, …). */
  keys?: CursorKeyEvent[]
  /** Scroll positions of scrolled elements inside the stage, one sample per scroll event. */
  scrolls?: CursorScrollEvent[]
  /** Wheel input (scroll, trackpad pan, pinch / ⌘-scroll zoom). */
  wheels?: CursorWheelEvent[]
  /** Safari trackpad gestures (pinch zoom). */
  gestures?: CursorGestureEvent[]
  /**
   * Times (ms) the stage's content changed (elements added / removed, text changed), at most
   * one per 50 ms. Pauses in which the app was still changing (e.g. waiting for a reply) aren't
   * trimmed away on playback.
   */
  changes?: number[]
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
  /** Created by "Auto-zoom clicks"; regenerating replaces these and keeps hand-made ones. */
  auto?: boolean
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
  /** KeyboardEvent.key, e.g. "Enter", "Escape", "v", "ArrowLeft". */
  key: string
  /** KeyboardEvent.code, e.g. "KeyV". */
  code?: string
  mods?: KeyModifiers
  /**
   * true: pressed in a text field (anchor = the field). Otherwise the anchor is the focused
   * element, or missing when focus was on the page itself.
   */
  field?: boolean
  anchor?: CursorAnchor
}

/** The scroll offset (px) an element had at time `t`. Replayed by scrolling it to the same offset. */
export type CursorScrollEvent = {
  t: number
  /** The scrolled element itself (never an ancestor); an empty path is the stage. */
  anchor?: CursorAnchor
  top: number
  left: number
}

export type SmoothingOptions = {
  /**
   * Pauses longer than this (ms) are shortened to it. High by default so the cursor's pauses
   * play back as recorded; only long idling (stepping away mid-take) is cut.
   */
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
  /**
   * When a target moves during playback (after a drag, a pan, a panel opening), how long (ms)
   * the cursor takes to ease from its old path onto the re-aimed one. Longer is gentler.
   */
  reaimBlend: number
}

export const DEFAULT_SMOOTHING: SmoothingOptions = {
  maxIdle: 4000,
  simplifyTolerance: 6,
  clickDwell: 160,
  stiffness: 170,
  damping: 26,
  speed: 1,
  typingMsPerChar: 70,
  typingGrowth: 0.7,
  maxTypingDuration: 3500,
  reaimBlend: 220,
}

/** An instant event on the baked timeline, in current stage px. */
export type BakedEvent =
  /** `source` is the press's index in the recording's `events`; `button` its mouse button. */
  | { type: "down" | "up"; t: number; x: number; y: number; source: number; button: number }
  | ({ type: "key" } & CursorKeyEvent)

/**
 * Where a recording press was aimed at bake time (current stage px, unzoomed): its anchor's
 * resolved point, or null when it had no anchor, it couldn't be found, or it is the release of a
 * drag (which follows its press instead).
 */
export type PressTarget = { x: number; y: number } | null

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
  /** Scroll positions on the baked timeline, ascending by `t`. */
  scrolls: CursorScrollEvent[]
  /** Wheel and gesture input on the baked timeline, each ascending by `t`. */
  wheels: CursorWheelEvent[]
  gestures: CursorGestureEvent[]
  /** Resolved target per recording press (indexed like the recording's `events`), for re-aiming during playback. */
  targets: PressTarget[]
  /** Matching (recorded ms, baked ms) pairs, both ascending: converts edit times to playback times. */
  timeMap: { source: number[]; baked: number[] }
}
