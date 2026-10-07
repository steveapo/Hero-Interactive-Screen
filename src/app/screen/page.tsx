import { CursorStage } from "@/components/cursor-engine"
import { HeroScreen } from "@/components/hero-screen/hero-screen"
import { readRecording } from "@/lib/recording-store"

/**
 * The interactive screen alone, full-screen, for recording the cursor demo. The recorder is open
 * by default (hide it with × or `?record=false`); `?edit=true` opens the timeline editor.
 * Every take is saved to the server and plays on the homepage (`/`).
 */
export default async function ScreenPage() {
  const recording = await readRecording()
  return (
    <main className="flex h-dvh w-full flex-col">
      <CursorStage recording={recording} persistUrl="/api/recording" defaultRecorder>
        <HeroScreen className="h-auto min-h-0 flex-1" />
      </CursorStage>
    </main>
  )
}
