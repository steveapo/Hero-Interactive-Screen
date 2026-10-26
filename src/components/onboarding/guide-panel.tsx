"use client"

import { ArrowRight, Check, ChevronUp, Minus, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GuideIntroPage, GuideStep } from "./steps"

/** The lime primary action (as on the website). */
const PRIMARY =
  "flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-mi-lime-deep/60 bg-mi-lime px-4 text-sm font-semibold text-mi-lime-ink shadow-[0_8px_24px_-12px_rgba(60,80,20,0.45)] transition-colors hover:bg-mi-lime-deep"

const SECONDARY =
  "flex h-10 items-center justify-center whitespace-nowrap rounded-xl px-4 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-900/5 hover:text-stone-900"

/** The guide card's small lime button (Next, Continue). */
const SMALL_PRIMARY =
  "flex h-8 items-center gap-1.5 rounded-lg border border-mi-lime-deep/60 bg-mi-lime px-3 text-[13px] font-semibold text-mi-lime-ink transition-colors animate-in fade-in duration-200 hover:bg-mi-lime-deep"

/**
 * Where the guide card sits. "bottom": docked at the bottom centre (on the canvas). "chat": over
 * the top of Build mode's chat column, so the live preview beside it stays fully in view.
 */
export type GuidePlacement = "bottom" | "chat"

const PLACEMENT: Record<GuidePlacement, string> = {
  // max-h + scroll: on short screens the card never runs past the screen's edge.
  bottom: "bottom-4 left-1/2 max-h-[calc(100%-6rem)] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 overflow-y-auto",
  // The chat column is 360px wide at the right edge, under the 50px top bar and its 40px header.
  chat: "right-2 top-[98px] max-h-[calc(100%-110px)] w-[344px] overflow-y-auto",
}

/**
 * The tour's guide: a card that stays with the visitor on the canvas and in Build mode alike. It
 * names where they are, what this step is for, and the one thing to do right now; once done, it
 * confirms and moves on (or waits for Continue). Intro pages explain a new place before its step,
 * one Next at a time. Can be tucked away into a pill.
 */
export function GuidePanel({
  step,
  progress,
  tryIt,
  done,
  minimized,
  onMinimize,
  onSkip,
  onEnd,
  onContinue,
  offer,
  explanation = null,
  intro = null,
  placement = "bottom",
}: {
  step: GuideStep
  /** Position in the tour (1-based), of how many; `bonus`: the optional steps' own count. */
  progress: { current: number; total: number; bonus: boolean }
  tryIt: string
  /** The step was just done: its done message shows instead of the instruction. */
  done: boolean
  minimized: boolean
  onMinimize: (minimized: boolean) => void
  onSkip: () => void
  onEnd: () => void
  /** The step waits for the visitor once done (its `continueLabel`): move on. */
  onContinue?: () => void
  /** Once done, a second way on (e.g. into the GitHub bonus). */
  offer?: { label: string; onSelect: () => void } | null
  /** What's happening right now, worth explaining (see GuideStep.explain): shown instead of the step's own text. */
  explanation?: { eyebrow: string; title: string; body: string } | null
  /** An intro page to show instead of the step's action, with its Next. */
  intro?: { page: GuideIntroPage; onNext: () => void } | null
  placement?: GuidePlacement
}) {
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => onMinimize(false)}
        className={cn(
          "absolute z-[80] flex h-10 items-center gap-2.5 rounded-full bg-white pl-3 pr-3.5 text-[13px] font-medium text-mi-ink shadow-[0_12px_32px_-12px_rgba(17,17,16,0.4),0_0_0_1px_rgba(17,17,16,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-200",
          placement === "chat" ? "right-2 top-[98px]" : "bottom-4 left-1/2 -translate-x-1/2",
        )}
      >
        <span className="flex size-5 items-center justify-center rounded-full bg-mi-lime text-[11px] font-semibold tabular-nums text-mi-lime-ink">
          {progress.current}
        </span>
        {step.title}
        <span className="text-stone-400 tabular-nums">
          {progress.current}/{progress.total}
        </span>
        <ChevronUp className="size-4 text-stone-500" strokeWidth={1.75} />
      </button>
    )
  }

  const heading = intro?.page ?? explanation ?? step

  return (
    <section
      aria-label="Getting started"
      aria-live="polite"
      className={cn(
        "absolute z-[80] flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_24px_60px_-24px_rgba(17,17,16,0.45),0_0_0_1px_rgba(17,17,16,0.06)] animate-in fade-in slide-in-from-bottom-3 duration-300",
        PLACEMENT[placement],
      )}
    >
      {/* Progress: one segment per step */}
      <div className="flex items-center gap-3">
        {progress.bonus && (
          <span className="rounded-full bg-mi-lime px-2 py-0.5 text-[11px] font-semibold text-mi-lime-ink">Bonus</span>
        )}
        <div className="flex flex-1 gap-1">
          {Array.from({ length: progress.total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-300",
                i < progress.current - 1 || (i === progress.current - 1 && done)
                  ? "bg-mi-lime-deep"
                  : i === progress.current - 1
                    ? "bg-mi-ink"
                    : "bg-stone-200",
              )}
            />
          ))}
        </div>
        <span className="text-[12px] font-medium tabular-nums text-stone-400">
          {progress.current}/{progress.total}
        </span>
        <button
          type="button"
          aria-label="Minimize guide"
          onClick={() => onMinimize(true)}
          className="-mr-1 flex size-6 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-900/5 hover:text-stone-700"
        >
          <Minus className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <div key={heading.title} className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-1 duration-300">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-400">{heading.eyebrow}</p>
        <h2 className="text-[19px] font-semibold leading-6 tracking-[-0.015em] text-mi-ink">{heading.title}</h2>
        <p className="text-[13.5px] leading-5 text-stone-600">{heading.body}</p>
      </div>

      {intro ? null : done ? (
        <p className="flex items-start gap-2.5 rounded-xl bg-[#eef8dc] px-3 py-2.5 text-[13.5px] font-medium leading-5 text-[#2d4a0c] animate-in fade-in zoom-in-95 duration-200">
          <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-mi-lime-deep text-mi-lime-ink">
            <Check className="size-3" strokeWidth={3} />
          </span>
          {step.done}
        </p>
      ) : (
        <p className="flex items-start gap-2.5 rounded-xl bg-mi-canvas px-3 py-2.5 text-[13.5px] leading-5 text-stone-700">
          <span className="mt-[3px] size-2 shrink-0 animate-pulse rounded-full bg-mi-lime-deep" />
          <span>
            <span className="font-semibold text-mi-ink">Try it: </span>
            {tryIt}
          </span>
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onEnd}
          className="shrink-0 text-[12.5px] font-medium text-stone-400 transition-colors hover:text-stone-700"
        >
          End tour
        </button>
        {intro ? (
          <button type="button" onClick={intro.onNext} className={SMALL_PRIMARY}>
            {intro.page.next}
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </button>
        ) : done && onContinue ? (
          <div className="flex items-center gap-1.5">
            {offer && (
              <button
                type="button"
                onClick={offer.onSelect}
                className="flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-stone-700 transition-colors animate-in fade-in duration-200 hover:bg-stone-900/5 hover:text-stone-900"
              >
                {offer.label}
              </button>
            )}
            <button type="button" onClick={onContinue} className={SMALL_PRIMARY}>
              {step.continueLabel ?? "Continue"}
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </button>
          </div>
        ) : (
          !done && (
            <button
              type="button"
              onClick={onSkip}
              className="flex items-center gap-1 text-[12.5px] font-medium text-stone-500 transition-colors hover:text-stone-900"
            >
              Skip this step
              <ArrowRight className="size-3.5" strokeWidth={1.75} />
            </button>
          )
        )}
      </div>
    </section>
  )
}

/** A centred card over a dimmed screen (the tour's welcome and its finish). Blocks the screen behind. */
function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-[80] flex items-center justify-center bg-[rgba(17,17,16,0.42)] p-4 backdrop-blur-[2px] animate-in fade-in duration-300 sm:p-6">
      {/* max-h-full + scroll: short laptop screens keep every button reachable. */}
      <div className="flex max-h-full w-full max-w-[460px] flex-col gap-6 overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_40px_100px_-30px_rgba(17,17,16,0.6)] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-500 sm:p-8">
        {children}
      </div>
    </div>
  )
}

/** The tour's opening: what this place is and what the next few minutes hold. */
export function WelcomeCard({ steps, onStart, onDismiss }: { steps: GuideStep[]; onStart: () => void; onDismiss: () => void }) {
  return (
    <CenterCard>
      <div className="flex flex-col gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-mi-lime text-mi-lime-ink">
          <Sparkles className="size-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-mi-ink">Welcome to Modeinspect</h1>
        <p className="text-[15px] leading-6 text-stone-600">
          This canvas is wired to a live app. In {steps.length} short steps you&apos;ll redesign a card, build it into the
          code and share it. About three minutes.
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-3 text-[14px] text-stone-700">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-mi-canvas text-[12px] font-semibold tabular-nums text-stone-500">
              {i + 1}
            </span>
            {step.title}
          </li>
        ))}
      </ol>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onDismiss} className={SECONDARY}>
          Explore on my own
        </button>
        <button type="button" onClick={onStart} className={PRIMARY}>
          Start the tour
          <ArrowRight className="size-4" strokeWidth={2} />
        </button>
      </div>
    </CenterCard>
  )
}

/**
 * The tour's end: the loop is done; the real value starts with their own codebase. Visitors who
 * skipped the GitHub bonus can still take it from here (`onGithub`).
 */
export function FinishCard({
  onReplay,
  onClose,
  onGithub,
}: {
  onReplay: () => void
  onClose: () => void
  onGithub?: () => void
}) {
  return (
    <CenterCard>
      <div className="flex flex-col gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-mi-lime text-mi-lime-ink">
          <Check className="size-5" strokeWidth={2.5} />
        </span>
        <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] text-mi-ink">
          You&apos;re now{" "}
          <span className="bg-[linear-gradient(transparent_55%,var(--color-mi-lime)_55%)]">designing in code</span>
        </h1>
        <p className="text-[15px] leading-6 text-stone-600">
          You restyled a frame, iterated with AI, dropped a real component into a variant, built it into a live
          app, captured it back and shared it.
        </p>
        <p className="text-[15px] leading-6 text-stone-600">
          The real value starts when Modeinspect knows <span className="font-semibold text-mi-ink">your product</span>:
          connect your codebase to work with your own components, design system and screens.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {/* The two ways on: a narrower Start a draft beside the primary Connect your codebase.
            Placeholder links for now: they lead into the real product. */}
        <div className="flex flex-col gap-2 min-[400px]:flex-row">
          <a
            href="#"
            className="flex h-10 flex-[2] items-center justify-center whitespace-nowrap rounded-xl border border-stone-900/10 bg-white px-4 text-sm font-semibold text-mi-ink transition-colors hover:bg-stone-900/5"
          >
            Start a draft
          </a>
          <a href="#" className={cn(PRIMARY, "flex-[3]")}>
            Connect your codebase
            <ArrowRight className="size-4" strokeWidth={2} />
          </a>
        </div>
        {onGithub && (
          <button
            type="button"
            onClick={onGithub}
            className="flex items-center justify-between gap-3 rounded-xl bg-mi-canvas px-4 py-3 text-left text-[14px] text-stone-700 transition-colors hover:bg-stone-200/70"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-mi-ink">Bonus: GitHub sync</span>
              <span>See how your changes reach the repo (30 sec)</span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-stone-500" strokeWidth={2} />
          </button>
        )}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onReplay} className={SECONDARY}>
            Replay the tour
          </button>
          <button type="button" onClick={onClose} className={SECONDARY}>
            Keep exploring
          </button>
        </div>
      </div>
    </CenterCard>
  )
}
