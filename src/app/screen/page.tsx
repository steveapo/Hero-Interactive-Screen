import { HeroScreen } from "@/components/hero-screen/hero-screen"

/**
 * The interactive screen alone, full-screen. The cursor recorder is detached from it; the
 * recording files (cursor-engine, lib/recording-store, /api/recording) stay in the repo, unused here.
 */
export default function ScreenPage() {
  return (
    <main className="flex h-dvh w-full flex-col">
      <HeroScreen className="h-auto min-h-0 flex-1" />
    </main>
  )
}
