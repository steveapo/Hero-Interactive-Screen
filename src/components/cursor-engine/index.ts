export { CursorStage, type CursorStageProps } from "./cursor-stage"
export { ScriptedStage, type DemoScript, type ScriptedStageProps } from "./scripted-stage"
export { ScriptAborted, type ScriptApi, type ScriptTarget } from "./script-runner"
export { useCursorRecorder } from "./recorder"
export { bakeTrack, sampleTrack, toBakedTime, toSourceTime } from "./smoothing"
export {
  DEFAULT_SMOOTHING,
  type CursorEdits,
  type CursorRecording,
  type SmoothingOptions,
  type ZoomSegment,
} from "./types"
