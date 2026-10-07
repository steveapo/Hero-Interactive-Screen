import { HeroDemoV1 } from "@/components/hero-screen/hero-demo-v1"

/** The stored v1 demo (variants story), full-screen. The current demo plays on / and /demo. */
export default function DemoV1Page() {
  return (
    <main className="flex h-dvh w-full flex-col">
      <HeroDemoV1 />
    </main>
  )
}
