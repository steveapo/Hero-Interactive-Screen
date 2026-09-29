import { CursorStage } from "@/components/cursor-engine"
import { HeroScreen } from "@/components/hero-screen/hero-screen"
import { heroRecording } from "@/components/hero-screen/hero-recording"

export default function Home() {
  return (
    <main className="flex w-full flex-1 flex-col">
      <CursorStage recording={heroRecording}>
        <HeroScreen />
      </CursorStage>
    </main>
  )
}
