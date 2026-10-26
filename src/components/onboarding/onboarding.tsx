"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { HeroScreen, type GuideEvent } from "@/components/hero-screen/hero-screen"
import { ONBOARDING_AGENT_PROMPT } from "@/components/hero-screen/agent-script"
import { FinishCard, GuidePanel, WelcomeCard } from "./guide-panel"
import { Spotlight } from "./spotlight"
import { foldEvent, INITIAL_CONTEXT, STEPS, type GuideContext } from "./steps"

/** welcome → tour → done; "off": the visitor explores on their own (no guide). */
type Stage = "welcome" | "tour" | "done" | "off"

/** The default pause between a done step and the next (ms). */
const DEFAULT_HOLD_MS = 1400

/** Build mode's chat column (px): the guide card docks over it, and labels stay out of it. */
const CHAT_COLUMN_WIDTH = 360

/** The main tour's steps, and the optional (bonus) ones reached by an offer. */
const MAIN_STEPS = STEPS.filter((s) => !s.optional)
const BONUS_STEPS = STEPS.filter((s) => s.optional)

/** After this step: the next one, or the finish (the main tour ends before the bonus steps). */
function nextIndex(index: number) {
  const next = index + 1
  if (next >= STEPS.length) return STEPS.length
  return !STEPS[index].optional && STEPS[next].optional ? STEPS.length : next
}

/**
 * The onboarding: a new user's first canvas (the Codebase frame and one app frame), with a guided
 * tour over it. The tour follows what the visitor really does on the screen (GuideEvents): each step
 * spotlights the UI to use, the guide card says what to do, and the step completes once it's done.
 * The guide stays on screen in Build mode too (docked over the chat column, clear of the live app),
 * and explains Build mode the first time it opens.
 */
export function Onboarding() {
  const [stage, setStage] = useState<Stage>("welcome")
  const [index, setIndex] = useState(0)
  /** The current step's intro page (see GuideStep.intro); past the last one: its action. */
  const [introPage, setIntroPage] = useState(0)
  const [ctx, setCtx] = useState<GuideContext>(INITIAL_CONTEXT)
  /** The current step was just done: its done message holds before the next step. */
  const [stepDone, setStepDone] = useState(false)
  const [minimized, setMinimized] = useState(false)
  /** The GitHub bonus was taken (the finish card stops offering it). */
  const [bonusTaken, setBonusTaken] = useState(false)

  // Events arrive from the screen's effects and listeners: read the latest state through refs.
  const stageRef = useRef(stage)
  const indexRef = useRef(index)
  const ctxRef = useRef(ctx)
  const advancing = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    stageRef.current = stage
    indexRef.current = index
  })
  useEffect(() => () => clearTimeout(holdTimer.current), [])

  /** Go to a step (or the finish past the last one). */
  const goTo = useCallback((next: number) => {
    clearTimeout(holdTimer.current)
    advancing.current = false
    setStepDone(false)
    setIntroPage(0)
    if (next >= STEPS.length) {
      setStage("done")
      stageRef.current = "done"
      return
    }
    setIndex(next)
    indexRef.current = next
    setStage("tour")
    stageRef.current = "tour"
  }, [])

  /** The step is done: confirm it, hold a moment, then move on (or wait for its Continue). */
  const complete = useCallback(
    (stepIndex: number) => {
      if (advancing.current) return
      advancing.current = true
      setIndex(stepIndex)
      indexRef.current = stepIndex
      setStepDone(true)
      setMinimized(false)
      if (STEPS[stepIndex].continueLabel) return
      holdTimer.current = setTimeout(() => goTo(nextIndex(stepIndex)), STEPS[stepIndex].holdMs ?? DEFAULT_HOLD_MS)
    },
    [goTo],
  )

  const onGuideEvent = useCallback(
    (event: GuideEvent) => {
      const nextCtx = foldEvent(ctxRef.current, event)
      if (nextCtx !== ctxRef.current) {
        ctxRef.current = nextCtx
        setCtx(nextCtx)
      }
      if (stageRef.current !== "tour" || advancing.current) return
      const current = indexRef.current
      // Sent in Build mode while its intro is still up: the visitor is ahead of it, skip to the action.
      if (event.type === "portal-sent" && STEPS[current].intro) setIntroPage(STEPS[current].intro!.length)
      if (STEPS[current].completes?.(event)) {
        complete(current)
        return
      }
      // A milestone reached early skips the tour ahead to it (e.g. dropped into Build mode before
      // the variants were done): the furthest one this event completes, within the same part of the tour.
      for (let i = STEPS.length - 1; i > current; i--) {
        if (!!STEPS[i].optional !== !!STEPS[current].optional) continue
        if (STEPS[i].milestone && STEPS[i].completes?.(event)) {
          complete(i)
          return
        }
      }
    },
    [complete],
  )

  // A step completed by a click (e.g. Share): watched on the whole document, before the click lands.
  useEffect(() => {
    const selector = stage === "tour" ? STEPS[index].completeOnClick : undefined
    if (!selector) return
    function onClick(e: MouseEvent) {
      if (e.target instanceof Element && e.target.closest(selector!)) complete(indexRef.current)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [stage, index, complete])

  // A step that's already done when it comes up (e.g. already back on the canvas) completes at once.
  useEffect(() => {
    if (stage !== "tour" || stepDone) return
    if (STEPS[index].alreadyDone?.(ctxRef.current)) complete(index)
  }, [stage, index, stepDone, complete])

  const step = STEPS[index]
  const touring = stage === "tour"
  // Intro pages explain Build mode while it's open, before the step's own action.
  const page = touring && !stepDone && ctx.portalOpen ? step.intro?.[introPage] : undefined
  // The step's prompt types itself in from the intro page that says so (and stays once typed).
  const promptFrom = step.intro?.findIndex((p) => p.typesPrompt) ?? -1
  const portalPrompt =
    touring && step.prompt && (promptFrom < 0 || introPage >= promptFrom || !step.intro) ? step.prompt : null
  // Nothing to point at while a done message holds (the screen is the visitor's for a moment),
  // unless the step waits for Continue: then what was made stays in the spotlight.
  const pointing = touring && (!stepDone || !!step.continueLabel)
  const targets = useMemo(
    () =>
      page
        ? [page.target]
        : touring && stepDone && step.doneTargets
          ? step.doneTargets(ctx)
          : pointing
            ? step.targets(ctx)
            : [],
    [page, touring, stepDone, pointing, step, ctx],
  )
  const dragHint = useMemo(
    () => (touring && !stepDone && !page ? (step.dragHint?.(ctx) ?? null) : null),
    [touring, stepDone, page, step, ctx],
  )
  const explanation = touring ? (step.explain?.(ctx) ?? null) : null
  const guideFocus = touring ? ((stepDone ? step.doneFocus : step.focus) ?? null) : null
  const bonus = !!step.optional
  const progress = {
    current: (bonus ? BONUS_STEPS : MAIN_STEPS).indexOf(step) + 1,
    total: (bonus ? BONUS_STEPS : MAIN_STEPS).length,
    bonus,
  }
  const offerTo = step.offer ? STEPS.findIndex((s) => s.id === step.offer!.to) : -1

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <HeroScreen
        className="h-full"
        start="canvas"
        guided
        onGuideEvent={onGuideEvent}
        guideFocus={guideFocus}
        portalPrompt={portalPrompt}
        // The canvas agent's chat opens with a suggested prompt typing itself in.
        agentPrompt={ONBOARDING_AGENT_PROMPT}
        // The Build Agent works without a cursor of its own here: the guide explains what it does.
        agentCursors={false}
        // A calm first canvas: the Codebase frame (the live app) and one of its cards.
        elementIds={["card-upcoming-trip"]}
        // The project's own components in the library (Badge, Button, …).
        componentLibrary="fairbnb"
      />

      {touring && (
        <Spotlight targets={targets} dragHint={dragHint} reservedRight={ctx.portalOpen ? CHAT_COLUMN_WIDTH : 0} />
      )}

      {touring && (
        <GuidePanel
          step={step}
          progress={progress}
          tryIt={step.tryIt(ctx)}
          done={stepDone}
          minimized={minimized}
          onMinimize={setMinimized}
          onSkip={() => goTo(nextIndex(index))}
          onEnd={() => setStage("off")}
          onContinue={step.continueLabel ? () => goTo(nextIndex(index)) : undefined}
          offer={
            step.offer && offerTo >= 0
              ? {
                  label: step.offer.label,
                  onSelect: () => {
                    setBonusTaken(true)
                    goTo(offerTo)
                  },
                }
              : null
          }
          explanation={explanation}
          intro={page ? { page, onNext: () => setIntroPage((p) => p + 1) } : null}
          placement={ctx.portalOpen ? "chat" : "bottom"}
        />
      )}

      {stage === "welcome" && <WelcomeCard steps={MAIN_STEPS} onStart={() => goTo(0)} onDismiss={() => setStage("off")} />}

      {stage === "done" && (
        // Replaying starts over from a fresh canvas.
        <FinishCard
          onReplay={() => window.location.reload()}
          onClose={() => setStage("off")}
          onGithub={
            bonusTaken
              ? undefined
              : () => {
                  setBonusTaken(true)
                  goTo(STEPS.findIndex((s) => s.optional))
                }
          }
        />
      )}
    </div>
  )
}
