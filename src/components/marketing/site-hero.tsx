import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ScrollGrowWindow } from "./scroll-grow-window"

const NAV_LINKS = ["Product", "Enterprise", "Pricing", "About"]

/** Lime call-to-action. */
const LIME_BUTTON =
  "rounded-2xl border border-mi-lime-deep/60 bg-mi-lime/60 text-mi-lime-ink shadow-[0_8px_24px_-12px_rgba(60,80,20,0.35)] transition-colors hover:bg-mi-lime/80"

/**
 * Modeinspect marketing hero: nav, headline, intro copy, CTA, and a window below holding
 * the product demo (`children`).
 */
export function SiteHero({ children }: { children: ReactNode }) {
  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden bg-[#cdc9c5] text-mi-ink">
      {/*
        One viewport tall: green holds to about the middle of the screen, then fades to the
        warm grey page colour by ~2/3 down. A softer, brighter lime glow sits on top at the centre.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-dvh bg-[radial-gradient(ellipse_45%_50%_at_50%_0%,rgba(200,236,111,0.7)_0%,transparent_100%),linear-gradient(to_bottom,#bde07a_0%,#c2df80_38%,#c4d99c_48%,#c9d0b4_56%,#cdc9c5_66%,#cdc9c5_100%)]"
      />

      <header className="flex items-center justify-between gap-4 px-[clamp(0.75rem,1.5vw,1.25rem)] pt-2">
        <a
          href="/"
          className="rounded-[10px] border border-white/50 bg-white/40 px-[17px] py-2 text-base leading-6 shadow-[0_4px_14px_-6px_rgba(60,80,20,0.25)] backdrop-blur-md"
        >
          modeinspect
        </a>

        <nav className="hidden items-center rounded-[10px] border border-white/50 bg-white/35 p-1 shadow-[0_4px_14px_-6px_rgba(60,80,20,0.25)] backdrop-blur-md md:flex">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="rounded-[7px] px-3.5 py-[7px] text-sm leading-5 font-medium transition-colors hover:bg-white/40"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#"
            className="rounded-lg border border-white/70 bg-[#ecebe7] px-[15px] py-[5px] text-base leading-6 shadow-[0_4px_12px_-6px_rgba(60,80,20,0.3)] transition-colors hover:bg-white"
          >
            Sign in
          </a>
          <a
            href="#"
            className="rounded-lg border border-[#c3e46c] bg-[#d6f483] px-[15px] py-[5px] text-base leading-6 text-mi-lime-ink shadow-[0_4px_12px_-6px_rgba(60,80,20,0.35)] transition-colors hover:bg-[#cdef72]"
          >
            Get started
          </a>
        </div>
      </header>

      {/* Fluid column: scales with the viewport, capped at 1280px. A size container: the product
          window's height follows its width on narrow screens (see ScrollGrowWindow). */}
      <div className="@container mx-auto flex w-[min(calc(100%-2*clamp(1.25rem,6vw,8rem)),80rem)] flex-col pb-[clamp(3rem,6vw,6rem)]">
        <div className="flex flex-col items-start pt-[clamp(4rem,7vw,7rem)]">
          <h1 className="flex flex-col gap-[0.05em] text-[clamp(2.75rem,1.5rem+3.2vw,4.75rem)] leading-[1.05] tracking-[-0.03em]">
            <span className="font-medium">Design in code.</span>
            <span className="font-pixel font-black tracking-[-0.01em] text-[#56663a] [font-synthesis:none]">Skip the handoff.</span>
          </h1>

          <p className="mt-[clamp(1rem,1.5vw,1.5rem)] max-w-[46em] text-[clamp(1.0625rem,0.95rem+0.3vw,1.1875rem)] leading-[1.7] text-[#5c6252]">
            Modeinspect is a design canvas with your codebase and agents built in. It&apos;s where teams design
            high-fidelity features.
          </p>

          <a
            href="#"
            className={cn(
              LIME_BUTTON,
              "mt-[clamp(2rem,3vw,2.75rem)] px-[1.0625em] py-[0.75em] text-base font-medium",
            )}
          >
            Get started
          </a>
        </div>

        {/* Product window: the live canvas build. Grows past the column as the page scrolls. */}
        <ScrollGrowWindow className="mt-[clamp(2.5rem,5vw,4rem)] rounded-[clamp(0.625rem,0.8vw,0.75rem)] border border-white/70 bg-mi-canvas shadow-[0_30px_80px_-30px_rgba(40,50,20,0.35)]">
          {children}
        </ScrollGrowWindow>
      </div>
    </section>
  )
}
