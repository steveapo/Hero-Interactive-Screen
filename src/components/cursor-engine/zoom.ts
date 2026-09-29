import { sampleTrack, toBakedTime } from "./smoothing"
import type { BakedTrack, ZoomSegment } from "./types"

/**
 * The zoom camera: a scale + translate applied to the whole screen (cursor included). During a
 * zoom segment it eases in, follows the cursor, and eases back out, clamped so the edges of the
 * screen never come into view.
 */

/** Ease-in / ease-out time at each end of a zoom segment (ms). */
const ZOOM_RAMP = 600
/** The camera follows the cursor's average position over ±this window (ms), so it glides. */
const FOLLOW_WINDOW = 450
const FOLLOW_SAMPLES = 9

export type Camera = { scale: number; x: number; y: number }

export const IDENTITY_CAMERA: Camera = { scale: 1, x: 0, y: 0 }

function easeInOutCubic(k: number) {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
}

/** Zoom level at baked time t: 1 outside segments, eased up to each segment's scale inside. */
export function zoomLevelAt(track: BakedTrack, zooms: ZoomSegment[], t: number) {
  let level = 1
  for (const zoom of zooms) {
    const start = toBakedTime(track, zoom.start)
    const end = toBakedTime(track, zoom.end)
    if (t <= start || t >= end) continue
    const ramp = Math.min(ZOOM_RAMP, (end - start) / 2)
    const k = Math.min(1, (t - start) / ramp, (end - t) / ramp)
    level = Math.max(level, 1 + (zoom.scale - 1) * easeInOutCubic(k))
  }
  return level
}

/** Camera at baked time t for a stage of `width` × `height` px. */
export function cameraAt(track: BakedTrack, zooms: ZoomSegment[], t: number, width: number, height: number): Camera {
  const scale = zoomLevelAt(track, zooms, t)
  if (scale <= 1.0001) return IDENTITY_CAMERA

  // Focus on the cursor's smoothed position (moving average), so the camera doesn't jitter.
  let fx = 0
  let fy = 0
  for (let i = 0; i < FOLLOW_SAMPLES; i++) {
    const p = sampleTrack(track, t - FOLLOW_WINDOW + (2 * FOLLOW_WINDOW * i) / (FOLLOW_SAMPLES - 1))
    fx += p.x / FOLLOW_SAMPLES
    fy += p.y / FOLLOW_SAMPLES
  }

  // Centre the focus point, then clamp so the scaled screen always covers the stage.
  const x = Math.min(0, Math.max(width - width * scale, width / 2 - fx * scale))
  const y = Math.min(0, Math.max(height - height * scale, height / 2 - fy * scale))
  return { scale, x, y }
}
