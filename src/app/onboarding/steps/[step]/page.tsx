import Link from "next/link"
import { notFound } from "next/navigation"
import { CAPTURE_PIECES } from "@/components/canvas-onboarding/onboarding-elements"
import { cn } from "@/lib/utils"

export function generateStaticParams() {
  return CAPTURE_PIECES.map((piece) => ({ step: piece.slug }))
}

/**
 * One onboarding piece per page, at real size, to capture onto the project's canvas. The tabs at
 * the top switch between the pieces; the piece itself sits alone below them (data-capture marks it).
 */
export default async function OnboardingStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params
  const piece = CAPTURE_PIECES.find((p) => p.slug === step)
  if (!piece) notFound()

  return (
    <main className="flex min-h-dvh w-full flex-col bg-mi-canvas">
      <nav aria-label="Onboarding pieces" className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="flex gap-1 overflow-x-auto px-4 py-2">
          {CAPTURE_PIECES.map((p) => (
            <Link
              key={p.slug}
              href={`/onboarding/steps/${p.slug}`}
              aria-current={p.slug === piece.slug ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors",
                p.slug === piece.slug ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </nav>
      <div className="flex flex-1 items-start justify-center overflow-x-auto p-16">
        <div data-capture={piece.slug} className="shrink-0">
          {piece.node}
        </div>
      </div>
    </main>
  )
}
