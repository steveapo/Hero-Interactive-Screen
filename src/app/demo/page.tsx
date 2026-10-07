import { HeroDemo } from "@/components/hero-screen/hero-demo"

/** The scripted end-to-end demo alone, full-screen (the homepage plays it inside the hero window). */
export default function DemoPage() {
  return (
    <main className="flex h-dvh w-full flex-col">
      <HeroDemo />
    </main>
  )
}
