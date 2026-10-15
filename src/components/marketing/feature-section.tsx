import type { ReactNode } from "react"
import { ArrowRight, ChevronsUp, MapIcon } from "lucide-react"
import { FeatureClip, type FeatureClipId } from "@/components/hero-screen/live-product-demo"
import { cn } from "@/lib/utils"

/** Same fluid column as the hero: scales with the viewport, capped at 1280px. */
const COLUMN = "mx-auto w-[min(calc(100%-2*clamp(1.25rem,6vw,8rem)),80rem)]"

const LOGOS = ["moss", "apify", "E2B", "Prelude", "NCCER", "Deepnote"]

/** Shared shell for the feature cards: copy on one side, a product mockup on the other. */
const FEATURE_CARD =
  "grid items-center gap-8 rounded-[clamp(0.625rem,0.8vw,0.75rem)] border border-white/70 bg-[#f1efeb] p-[clamp(1rem,1.5vw,1.25rem)] shadow-[0_30px_80px_-30px_rgba(40,50,20,0.25)] lg:grid-cols-[1fr_2fr]"

/** Frame around the mockups: no background or padding, the screen sits straight on the card with a hairline ring and a soft shadow. */
const MOCKUP_FRAME =
  "relative overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(17,17,16,0.08),0_16px_40px_-20px_rgba(17,17,16,0.25)]"

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
            <ClipMockup clip="overview" />
          </div>

          <div className={cn(FEATURE_CARD, "lg:grid-cols-[2fr_1fr]")}>
            <FeatureCopy title="Live product on canvas" className="lg:order-2">
              Capture any element of your live product onto the canvas, pixel perfect and fully editable.
            </FeatureCopy>
            <ClipMockup clip="capture" />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * "Vibe coding gets you to 80%." headline and a feature card whose mockup is, for now, an empty
 * frame with the hero screen's background.
 */
export function LastMileSection() {
  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden bg-[#cdc9c5] text-mi-ink">
      <div className={cn(COLUMN, "flex flex-col pb-[clamp(3rem,6vw,6rem)] pt-[clamp(2rem,4vw,4rem)]")}>
        <h2 className="flex flex-col gap-[0.05em] text-[clamp(2.25rem,1.25rem+2.6vw,3.75rem)] leading-[1.05] tracking-[-0.03em]">
          <span className="font-medium">Vibe coding gets you to 80%.</span>
          <span className="font-pixel font-black tracking-[-0.01em] text-stone-700 [font-synthesis:none]">
            Modeinspect is the last 20%.
          </span>
        </h2>
        <p className="mt-[clamp(1rem,1.5vw,1.5rem)] max-w-[28em] text-[clamp(1.0625rem,0.95rem+0.3vw,1.25rem)] leading-[1.6] text-[#5c6252]">
          Visual controls, your components and tokens 1:1, and canvas to code in one shot.
        </p>

        <div className="mt-[clamp(2.5rem,5vw,4rem)] flex flex-col gap-[clamp(3rem,7vw,6rem)]">
          <div className={FEATURE_CARD}>
            <FeatureCopy title="Controls, not prompts">
              A padding change shouldn&apos;t take a paragraph. Edit anything, on canvas or in code, with the visual
              controls you already know.
            </FeatureCopy>
            <ClipMockup clip="visual-edits" />
          </div>

          <div className={cn(FEATURE_CARD, "lg:grid-cols-[2fr_1fr]")}>
            <FeatureCopy title="Canvas to code in one shot" className="lg:order-2">
              Your changes build back as clean, scoped diffs with your design system enforced.
            </FeatureCopy>
            <ClipMockup clip="build" />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * "Share the real thing. Not a localhost." headline and two feature cards whose mockups are, for
 * now, empty frames with the hero screen's background.
 */
export function ShareSection() {
  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden bg-[#cdc9c5] text-mi-ink">
      <div className={cn(COLUMN, "flex flex-col pb-[clamp(3rem,6vw,6rem)] pt-[clamp(2rem,4vw,4rem)]")}>
        <h2 className="flex flex-col gap-[0.05em] text-[clamp(2.25rem,1.25rem+2.6vw,3.75rem)] leading-[1.05] tracking-[-0.03em]">
          <span className="font-medium">Share the real thing.</span>
          <span className="font-pixel font-black tracking-[-0.01em] text-stone-700 [font-synthesis:none]">
            Not a localhost.
          </span>
        </h2>
        <p className="mt-[clamp(1rem,1.5vw,1.5rem)] max-w-[28em] text-[clamp(1.0625rem,0.95rem+0.3vw,1.25rem)] leading-[1.6] text-[#5c6252]">
          Users, stakeholders, and colleagues open the live change and comment on it. The PR is one click away.
        </p>

        <div className="mt-[clamp(2.5rem,5vw,4rem)] flex flex-col gap-[clamp(3rem,7vw,6rem)]">
          <div className={FEATURE_CARD}>
            <FeatureCopy title="Test the real thing">
              Click through real components and live data, across every breakpoint. Not a simulation.
            </FeatureCopy>
            <ClipMockup clip="test" />
          </div>

          <div className={cn(FEATURE_CARD, "lg:grid-cols-[2fr_1fr]")}>
            <FeatureCopy title="Collaborate and ship" className="lg:order-2">
              No localhost to share, no branches to wrangle. Send a link, get comments, open the PR in one click.
            </FeatureCopy>
            <ClipMockup clip="share" />
          </div>
        </div>
      </div>
    </section>
  )
}

/** Light card surface shared by the proof section's cards (same look as the feature cards). */
const SURFACE =
  "rounded-[clamp(0.625rem,0.8vw,0.75rem)] border border-white/70 bg-[#f1efeb] shadow-[0_30px_80px_-30px_rgba(40,50,20,0.25)]"

const STATS = [
  { value: "22", unit: "days", label: "saved on delivery cycle" },
  { value: "0", unit: null, label: "Engineering handoffs" },
  { value: "95", unit: "%", label: "of UI from existing components" },
]

const TESTIMONIALS: { logo: ReactNode; name: string; role: string; quote: string }[] = [
  {
    logo: <span className="rounded-full border border-stone-500 px-1.5 text-[10px] font-semibold tracking-wide text-stone-600 uppercase">kiwi.com</span>,
    name: "Martin MJ Jancik",
    role: "Product Design Manager at Kiwi.com",
    quote:
      "Modeinspect integrates seamlessly with our codebase and design system, which is exactly what we have been looking for in AI design tools. It enables iteration on top of an already complex product.",
  },
  {
    logo: (
      <span className="flex items-center gap-1.5 font-semibold text-stone-600">
        <MapIcon className="size-4" /> moss
      </span>
    ),
    name: "Tereza Reznickova",
    role: "Principal Product Manager at Moss",
    quote:
      "Modeinspect is the first AI tool that respects our design system 1:1. It allows us to create production-like prototypes, which makes our whole team faster.",
  },
  {
    logo: <span className="text-lg font-black tracking-tight text-stone-600">NCCER</span>,
    name: "Christian Bistany",
    role: "UX Designer at NCCER",
    quote:
      "The biggest value add was being able to make changes in real time, using our design system, and immediately pushing the changes to code for senior devs to review and merge.",
  },
]

/**
 * "Production-grade isn't a tagline." headline, a stats + Prelude story card, three customer
 * quotes, and a closing "Try it on your codebase." call to action.
 */
export function ProofSection() {
  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden bg-[#cdc9c5] text-mi-ink">
      <div className={cn(COLUMN, "flex flex-col pb-[clamp(4rem,8vw,8rem)] pt-[clamp(2rem,4vw,4rem)]")}>
        <h2 className="max-w-[14em] text-[clamp(2.25rem,1.25rem+2.6vw,3.75rem)] leading-[1.15] tracking-[-0.03em]">
          <span className="font-medium">Production-grade isn&apos;t a tagline. </span>
          <span className="font-pixel font-black tracking-[-0.01em] text-stone-700 [font-synthesis:none]">
            It&apos;s the metric.
          </span>
        </h2>
        <p className="mt-[clamp(1rem,1.5vw,1.5rem)] max-w-[28em] text-[clamp(1.0625rem,0.95rem+0.3vw,1.25rem)] leading-[1.6] text-[#5c6252]">
          Four teams that merged design and engineering in the same loop.
        </p>

        {/* Stats + featured story */}
        <div className={cn(SURFACE, "mt-[clamp(2.5rem,5vw,4rem)] overflow-hidden")}>
          <dl className="grid divide-y divide-black/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 p-[clamp(1.25rem,2.5vw,2rem)]">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="flex items-baseline gap-1 text-[clamp(2.5rem,2rem+1.5vw,3.5rem)] leading-none tracking-[-0.03em]">
                  {stat.value}
                  {stat.unit && <span className="text-[0.5em] text-stone-500">{stat.unit}</span>}
                </dd>
                <p aria-hidden="true" className="max-w-[12em] text-sm leading-[1.7] text-stone-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>

          <div className="grid items-center gap-10 border-t border-black/10 p-[clamp(1.5rem,4vw,3.5rem)] lg:grid-cols-2 lg:gap-0">
            <div className="flex flex-col items-start gap-6 lg:pr-[clamp(2rem,4vw,3.5rem)]">
              <p className="flex items-center gap-2 font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md bg-mi-ink text-white">
                  <ChevronsUp className="size-3.5" />
                </span>
                Prelude
              </p>
              <h3 className="max-w-[13em] text-[clamp(1.5rem,1.1rem+1.2vw,2.125rem)] leading-[1.5] tracking-[-0.02em]">
                How Prelude became an AI-native design team that ships its own PRs.
              </h3>
              <a
                href="#"
                className="flex items-center gap-2 rounded-full bg-mi-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
              >
                Read story <ArrowRight className="size-3.5" />
              </a>
            </div>

            <figure className="flex flex-col gap-6 lg:border-l lg:border-black/10 lg:py-4 lg:pl-[clamp(2rem,4vw,3.5rem)]">
              <Person name="Quentin Le Bras" role="Chief Product & Design Officer at Prelude" />
              <blockquote className="text-sm leading-[1.7] text-stone-500">
                &ldquo;My designers explore on our actual codebase, with real data, and open the PR themselves. We go
                from idea to a merged PR without a handoff in between - that&apos;s a superpower, not a workflow.&rdquo;
              </blockquote>
            </figure>
          </div>
        </div>

        {/* Customer quotes */}
        <div className="mt-[clamp(1rem,2vw,1.5rem)] grid gap-[clamp(1rem,2vw,1.5rem)] md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className={cn(SURFACE, "flex flex-col gap-6 p-[clamp(1.25rem,2.5vw,2rem)]")}>
              <div className="flex h-6 items-center">{t.logo}</div>
              <Person name={t.name} role={t.role} />
              <blockquote className="text-sm leading-[1.7] text-stone-500">&ldquo;{t.quote}&rdquo;</blockquote>
            </figure>
          ))}
        </div>

        {/* Call to action */}
        <div
          className={cn(
            SURFACE,
            "mt-[clamp(4rem,9vw,8rem)] flex flex-col items-start justify-between gap-6 p-[clamp(1.5rem,3vw,2.5rem)] sm:flex-row sm:items-center",
          )}
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-[clamp(1.75rem,1.3rem+1.2vw,2.5rem)] leading-[1.1] font-medium tracking-[-0.03em]">
              Try it on your codebase.
            </h2>
            <p className="text-sm text-stone-500">Free on Hobby. No credit card required.</p>
          </div>
          <a
            href="#"
            className="rounded-lg border border-mi-lime-deep/60 bg-mi-lime/60 px-5 py-2.5 text-base font-medium text-mi-lime-ink shadow-[0_8px_24px_-12px_rgba(60,80,20,0.35)] transition-colors hover:bg-mi-lime/80"
          >
            Get started
          </a>
        </div>
      </div>
    </section>
  )
}

/** Avatar (initials placeholder), name and role. */
function Person({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .filter((part) => /^[A-Z]/.test(part))
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white bg-stone-300 text-sm font-medium text-stone-600 shadow-sm">
        {initials}
      </span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-mi-ink">{name}</span>
        <span className="text-xs text-stone-500">{role}</span>
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
 * A feature card's clip (see FeatureClip): plays once when scrolled into view, stops on its key
 * moment and holds it as a still, straight on the card (no frame background).
 */
function ClipMockup({ clip }: { clip: FeatureClipId }) {
  return (
    <div className={MOCKUP_FRAME}>
      <FeatureClip clip={clip} />
    </div>
  )
}
