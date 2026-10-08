import type { ReactNode } from "react"
import { ChevronDown, Code2, Globe, GitBranch, Hash, MousePointer2, Redo2, Undo2 } from "lucide-react"
import { LiveProductDemo } from "@/components/hero-screen/live-product-demo"
import { cn } from "@/lib/utils"

/** Same fluid column as the hero: scales with the viewport, capped at 1280px. */
const COLUMN = "mx-auto w-[min(calc(100%-2*clamp(1.25rem,6vw,8rem)),80rem)]"

const LOGOS = ["moss", "apify", "E2B", "Prelude", "NCCER", "Deepnote"]

/** Shared shell for the feature cards: copy on one side, a product mockup on the other. */
const FEATURE_CARD =
  "grid items-center gap-8 rounded-[clamp(0.625rem,0.8vw,0.75rem)] border border-white/70 bg-[#f1efeb] p-[clamp(1rem,1.5vw,1.25rem)] shadow-[0_30px_80px_-30px_rgba(40,50,20,0.25)] lg:grid-cols-[1fr_2fr]"

/**
 * Below the hero: a "Loved by" logo strip, the "Canvas and code, unified." headline, and a
 * feature card with a product mockup.
 */
export function FeatureSection() {
  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden bg-[#cdc9c5] text-mi-ink">
      {/* Soft lime glow behind the headline, on the left. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[10%] top-[20%] -z-10 h-[50%] w-[60%] bg-[radial-gradient(ellipse_at_center,rgba(200,236,111,0.35)_0%,transparent_70%)]"
      />

      {/* Logo strip */}
      <div className="border-y border-black/10 py-[clamp(2.5rem,4vw,3.5rem)]">
        <div className={cn(COLUMN, "flex flex-col items-center gap-[clamp(1.5rem,3vw,2.5rem)]")}>
          <p className="font-mono text-xs tracking-[0.35em] text-stone-600 uppercase">Loved by design engineers at</p>
          <ul className="flex w-full flex-wrap items-center justify-center gap-x-[clamp(2rem,5vw,4.5rem)] gap-y-4 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            {LOGOS.map((name) => (
              <li key={name} className="text-[clamp(1.125rem,1rem+0.5vw,1.5rem)] font-semibold tracking-tight text-stone-500">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={cn(COLUMN, "flex flex-col pb-[clamp(3rem,6vw,6rem)] pt-[clamp(4rem,7vw,7rem)]")}>
        <h2 className="flex flex-col gap-[0.05em] text-[clamp(2.25rem,1.25rem+2.6vw,3.75rem)] leading-[1.05] tracking-[-0.03em]">
          <span className="font-medium">Canvas and code, unified.</span>
          <span className="font-pixel font-black tracking-[-0.01em] text-stone-700 [font-synthesis:none]">
            One place for everything.
          </span>
        </h2>
        <p className="mt-[clamp(1rem,1.5vw,1.5rem)] max-w-[40em] text-[clamp(1.0625rem,0.95rem+0.3vw,1.25rem)] leading-[1.6] text-[#5c6252]">
          Your codebase, the canvas, and coding agents, integrated.
          <br />
          Code to canvas in one click, canvas to code in one shot.
        </p>

        {/* Feature cards */}
        <div className="mt-[clamp(2.5rem,5vw,4rem)] flex flex-col gap-[clamp(3rem,7vw,6rem)]">
          <div className={FEATURE_CARD}>
            <FeatureCopy title="Everything in one place">
              Your codebase, the canvas, and coding agents, integrated out of the box. No MCP servers, no localhost,
              no devops glue.
            </FeatureCopy>
            <ProductMockup />
          </div>

          <div className={cn(FEATURE_CARD, "lg:grid-cols-[2fr_1fr]")}>
            <FeatureCopy title="Live product on canvas" className="lg:order-2">
              Capture any element of your live product onto the canvas, pixel perfect and fully editable.
            </FeatureCopy>
            <LiveProductMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

/** A static snapshot of the canvas: a frame selected, its settings panel and the inspector beside it. */
function ProductMockup() {
  return (
    <div
      aria-hidden="true"
      className="relative overflow-hidden rounded-xl border border-black/80 bg-[radial-gradient(ellipse_at_80%_10%,#6b6966_0%,#2b2a28_45%,#151514_100%)] p-[clamp(0.75rem,2vw,1.75rem)] pb-0"
    >
      <div className="flex h-[clamp(18rem,30vw,26rem)] overflow-hidden rounded-t-lg bg-stone-100 text-[11px] text-stone-700">
        {/* Canvas */}
        <div className="relative min-w-0 flex-[3] bg-gradient-to-b from-[#d9ec9f] from-0% via-[#eef5d6] via-[18%] to-white to-[18.1%]">
          {/* Tool bar */}
          <div className="absolute left-1/2 top-1.5 flex -translate-x-1/2 gap-1 rounded-md bg-white/90 p-0.5 shadow-sm">
            <span className="flex size-4 items-center justify-center rounded bg-mi-select text-white">
              <MousePointer2 className="size-2.5" />
            </span>
            <Hash className="size-4 p-0.5 text-stone-500" />
          </div>

          {/* Selected frame: its settings panel */}
          <div className="absolute inset-y-0 left-[16%] right-[6%] top-[14%] flex flex-col rounded-t-md bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-end gap-2 border-b border-stone-100 px-2 py-1.5 text-stone-500">
              <Undo2 className="size-3" />
              <Redo2 className="size-3" />
              <Globe className="size-3" />
              <GitBranch className="size-3" />
              <Code2 className="size-3" />
              <span className="rounded bg-mi-lime px-2 py-0.5 font-medium text-mi-lime-ink">Share</span>
              <span className="flex size-4 items-center justify-center rounded-full bg-mi-ink text-[8px] text-white">M</span>
            </div>
            <div className="mx-[8%] flex flex-1 flex-col gap-2 border-x border-t border-mi-select/60 px-2 pt-2">
              <p className="flex items-center gap-1 font-medium text-stone-900">
                <Hash className="size-3 text-stone-400" /> Frame
              </p>
              <MockSection title="Position">
                <MockField label="X" value="523px" />
                <MockField label="Y" value="127px" />
              </MockSection>
              <MockSection title="Size">
                <MockField label="W" value="400px" />
                <MockField label="H" value="300px" />
              </MockSection>
              <MockSection title="Layout">
                <div className="col-span-2 grid grid-cols-4 gap-1">
                  <span className="h-3.5 rounded bg-mi-select" />
                  <span className="h-3.5 rounded bg-stone-100" />
                  <span className="h-3.5 rounded bg-stone-100" />
                  <span className="h-3.5 rounded bg-stone-100" />
                </div>
                <MockField label="Clip" value="0" />
                <MockField label="Gap" value="0" />
              </MockSection>
              <MockSection title="Appearance">
                <MockField label="Opacity" value="100" />
                <MockField label="Radius" value="none" />
              </MockSection>
            </div>
          </div>

          <span className="absolute bottom-[38%] left-[9%] flex size-4 items-center justify-center rounded-full bg-mi-lime text-[10px] font-bold text-mi-lime-ink">
            ✳
          </span>
        </div>

        {/* Inspector */}
        <div className="hidden min-w-0 flex-1 flex-col gap-2 border-l border-stone-200 bg-white p-2 text-[9px] sm:flex">
          <div className="flex justify-end">
            <span className="rounded bg-mi-lime px-1.5 py-0.5 font-medium text-mi-lime-ink">Share</span>
          </div>
          <p className="font-medium text-stone-900"># div</p>
          {["Position", "Size", "Layout", "Appearance", "Fill", "Border"].map((title) => (
            <div key={title} className="flex flex-col gap-1">
              <p className="font-medium text-stone-800">{title}</p>
              <div className="grid grid-cols-2 gap-1">
                <span className="h-2.5 rounded-sm bg-stone-100" />
                <span className="h-2.5 rounded-sm bg-stone-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeatureCopy({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-2 px-[clamp(0.5rem,2vw,2rem)] py-4", className)}>
      <h3 className="text-xl font-medium">{title}</h3>
      <p className="text-[clamp(1.0625rem,0.95rem+0.4vw,1.375rem)] leading-[1.45] text-stone-500">{children}</p>
    </div>
  )
}

/**
 * The "Live product on canvas" showcase: the scripted demo (capture in Build Mode → canvas →
 * component → Canvas Agent → use it in the codebase) in the same dark frame as the other mockup.
 */
function LiveProductMockup() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-black/80 bg-[radial-gradient(ellipse_at_80%_10%,#6b6966_0%,#2b2a28_45%,#151514_100%)] p-[clamp(0.75rem,1.5vw,1rem)]">
      <LiveProductDemo />
    </div>
  )
}

function MockSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-stone-100 pt-1.5">
      <p className="flex items-center gap-1 font-medium text-stone-900">
        <ChevronDown className="size-2.5 text-stone-400" /> {title}
      </p>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </div>
  )
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-center justify-between rounded bg-stone-50 px-1.5 py-1 tabular-nums">
      <span className="text-stone-400">{label}</span>
      <span>{value}</span>
    </span>
  )
}
