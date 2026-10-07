"use client"

import { useState } from "react"
import { TRIP } from "@/app/copy-project/airbnb-data"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { useWindowFullyGrown } from "@/components/marketing/scroll-grow-window"
import { cn } from "@/lib/utils"
import { PORTAL_TURNS } from "./agent-script"
import {
  agentDone,
  clearSpotOf,
  COMPOSER,
  ensureSent,
  githubSync,
  mergePullRequest,
  openChat,
  panToShow,
  PORTAL_FIELD,
  PROMPT_FIELD,
  restAtHome,
  scene,
  textOf,
  typePrompt,
  zoomAtCursor,
} from "./hero-demo-v1"
import { HeroScreen, type HeroStart } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

/**
 * The end-to-end hero demo, played as four clips (see CLIPS at the bottom) that loop. One story,
 * from the live app to a merged pull request, narrated by captions (STORY below):
 *
 *   Goal: give the upcoming trip card a “Check in” badge that checks you in.
 *
 *  1. Start in Build Mode: the Portal, the live app running from the code.
 *  2. Capture the trip card to the canvas.
 *  3. Pull a Badge out of the design system's component library onto the card's frame.
 *  4. Design with it: label, variant, size, and placement in the card.
 *  5. Build the frame back into code (the visitor sends it, turn 1).
 *  6. Back in Build Mode, ask the Portal Agent to make the badge do something.
 *  7. Test it (the visitor taps the badge, turn 2; the agent adds and runs tests), then sync to
 *     GitHub and merge the pull request (turn 3). The canvas closes: goal achieved.
 *
 * The stored previous version (the variants story) lives in hero-demo-v1.tsx (/demo/v1), which
 * also holds the helpers shared by both scripts.
 *
 * Every step targets live UI (aria labels / data-cursor-id) and waits for it, so the script
 * follows the app rather than a clock. Each scene is a soft step: if something in it doesn't
 * show up, it's logged and the run carries on with the next scene instead of restarting.
 */

/** Typed by the cursor. The chat / portal prompts match the scripted turns in agent-script.ts. */
const PROMPTS = {
  search: "badge",
  label: "Check in",
  build: "Build this frame into the codebase",
  feature: "Tapping the Check in badge should check me in to the stay",
  test: "Add a test for it and run the suite",
  repo: "hero-fairbnb",
}

/** Story captions, one per chapter. */
const STORY = {
  goal: "Goal: give the upcoming trip card a “Check in” badge that checks you in.",
  portal: "1 · Start in Build Mode: your live app, running from your code",
  capture: "2 · Capture the trip card to the canvas",
  library: "3 · Pull a Badge from your design system's component library",
  design: "4 · Design with it: label, variant, size and placement",
  build: "5 · Build the frame back into code",
  feature: "6 · Back in Build Mode, make the badge do something",
  test: "7 · Test it…",
  pr: "7 · …then sync a pull request",
  merge: "7 · Merge the pull request",
  done: "Merged. The canvas closes. Goal achieved.",
}

/** The visitor's turns (three per run); the agent clicks for them after 1.75 seconds of watching. */
const TURNS = {
  build: "Your turn: send it to the Build Agent",
  tap: "Your turn: tap the badge to test it",
  merge: "Your turn: merge the pull request",
}

const TRIP_CARD = '[data-cursor-id="frame-card-upcoming-trip"]'
const CODEBASE = '[data-cursor-id="codebase-frame"]'
const LIBRARY_TOGGLE = '[data-cursor-id="sidebar-components"]'
const LIBRARY_SEARCH = 'input[aria-label="Search components"]'
const LIBRARY_BADGE = '[data-cursor-id="library-Badge"]'
/** The Badge instance dropped into the trip card, and its settings panel. */
const BADGE = '[data-frame-component]'
const COMPONENT_PANEL = '[data-cursor-id="component-settings"]'
/** The built badge on the trip card in the live app (a button once it's functional). */
const BUILT_BADGE = '[data-cursor-id="built-component"]'
const BUILT_BADGE_BUTTON = `${BUILT_BADGE} button`
const PORTAL_MESSAGES = '[data-cursor-id="portal-chat-messages"]'
const PORTAL_SCREEN = "[data-portal-screen]"

/** The trip card in the live app. */
const liveTripCard = (api: ScriptApi) => () =>
  Array.from(api.stage.querySelectorAll('[data-portal-screen] [data-anim="block"]')).find((el) =>
    el.textContent?.includes(TRIP.title),
  )

/** The Portal's send button. */
const portalSend = (api: ScriptApi) => () =>
  api.stage.querySelector(PORTAL_FIELD)?.closest("form")?.querySelector('button[type="submit"]')

/** "Worked for …" line of the Portal turn scripted for `prompt` (shows once its reply is done). */
const workedFor = (prompt: string) => PORTAL_TURNS.find((t) => t.prompt === prompt)?.workedFor ?? "Worked for"

/** Ask the Portal Agent in the open chat and wait for its reply to finish. */
async function askPortal(api: ScriptApi, prompt: string) {
  await api.click(PORTAL_FIELD)
  await api.type(prompt, { into: PORTAL_FIELD })
  await api.wait(250)
  await api.click(portalSend(api))
  await api.until(() => textOf(api, PORTAL_MESSAGES).includes(workedFor(prompt)), 15000)
}

/** Zoom in on the trip card (the badge is small next to the whole set), with room on the left for
 * the library and on the right for the settings panel / Build Agent chat. */
async function focusTripCard(api: ScriptApi) {
  await panToShow(api, [TRIP_CARD], { fx: 0.55, fy: 0.5 })
  await api.moveTo(TRIP_CARD, { fx: 0.5, fy: 0.45 })
  await api.wheel(0, -80, { mods: { ctrl: true }, duration: 700 })
  await api.wait(200)
  await panToShow(api, [TRIP_CARD], { fx: 0.56, fy: 0.5 })
}

/* ---------------------------------- Clips ---------------------------------- */
/*
 * The story is played as four clips, each a separate run on a fresh screen that opens in the state
 * the previous clip left it in (see HeroStart), so any clip can be played on its own:
 *   1. Live app to canvas (chapters 1–2)       starts in the Portal
 *   2. Design system (chapters 3–4)           starts on the canvas
 *   3. Build to code (chapter 5)              starts with the badge designed into the trip card
 *   4. Make it work and ship (chapters 6–7)   starts with the badge built into the code
 */

/** Clip 1: start in Build Mode and capture the trip card to the canvas. */
export const liveAppClip: DemoScript = async (api) => {
  /* 1. Start in Build Mode --------------------------------------------------------- */
  await scene(api, "build mode", async () => {
    // The screen opens in the Portal. If the live app is still loading, let it load and play its
    // intro; otherwise move straight away.
    api.caption(STORY.goal)
    await api.find(PORTAL_SCREEN)
    const loading = '[role="status"][aria-label="Loading preview"]'
    if (api.exists(loading)) {
      await api.until(() => !api.exists(loading), 10000)
      await api.wait(1800) // the app's intro
    }
    api.caption(STORY.portal)
    await api.moveTo(liveTripCard(api), { ...clearSpotOf(liveTripCard(api)()), duration: 900 })
    await api.wait(1400)
  })

  /* 2. Capture the element ----------------------------------------------------------- */
  await scene(api, "capture", async () => {
    api.caption(STORY.capture)
    await api.click('button[aria-label="Capture a selection to the canvas (⌘S)"]')
    await api.wait(300)
    // Aim at the card itself, clear of its title, dates and numeral, so Area capture outlines and
    // takes the whole card rather than one of its children.
    const spot = clearSpotOf(liveTripCard(api)())
    await api.moveTo(liveTripCard(api), spot)
    await api.wait(300)
    await api.click(liveTripCard(api), spot)
    await api.wait(900)
    await api.click('button[aria-label="Exit area capture"]')
    await api.wait(250)
  })

  await scene(api, "back to canvas", async () => {
    if (api.exists('button[aria-label="Back to canvas"]')) await api.click('button[aria-label="Back to canvas"]')
    await api.until(() => !api.exists(PORTAL_SCREEN), 4000)
    await api.wait(2300) // the canvas sweeps in around the Codebase frame
  })
}

/** Clip 2: pull a Badge from the component library and design with it. */
export const designSystemClip: DemoScript = async (api) => {
  /* 3. Pull a component from the library ---------------------------------------------- */
  await scene(api, "component library", async () => {
    api.caption(STORY.library)
    await focusTripCard(api)
    await api.click(LIBRARY_TOGGLE)
    await api.find(LIBRARY_SEARCH)
    await api.wait(300)
    await api.click(LIBRARY_SEARCH)
    await api.type(PROMPTS.search, { into: LIBRARY_SEARCH })
    await api.wait(450)
    // Drag the Badge out of the library and drop it on the card.
    await api.drag(LIBRARY_BADGE, TRIP_CARD, { from: { fx: 0.5, fy: 0.65 }, to: { fx: 0.55, fy: 0.4 }, duration: 1300 })
    await api.find(BADGE, 4000)
    await api.wait(600)
    // Close the library; the badge stays selected, its settings on the right.
    await api.click(LIBRARY_TOGGLE)
    await api.wait(300)
  })

  /* 4. Design with it -------------------------------------------------------------------- */
  await scene(api, "design", async () => {
    api.caption(STORY.design)
    await api.find(COMPONENT_PANEL)
    const labelField = `${COMPONENT_PANEL} input[aria-label="Badge text"]`
    await api.click(labelField)
    await api.type(PROMPTS.label, { into: labelField, replace: true })
    await api.wait(350)
    // A red close to the old brand pink for the badge.
    await api.click(`${COMPONENT_PANEL} button[aria-label="Red"]`)
    await api.wait(400)
    await api.click(`${COMPONENT_PANEL} button[aria-label="Large"]`)
    await api.wait(450)
    // Place it in the card's top-right corner, inset by the card's own padding (1.6cqw of the
    // screen ≈ 4.5% of the card's width).
    const card = api.boxOf(TRIP_CARD)
    const badge = api.boxOf(BADGE)
    if (card && badge) {
      const inset = card.width * 0.045
      const to = { x: card.right - inset - badge.width / 2, y: card.top + inset + badge.height / 2 }
      await api.drag(BADGE, to, { duration: 1000 })
    }
    await api.wait(500)
    // A closer look at the result.
    await zoomAtCursor(api, "[data-hero-canvas]")
    await api.wait(300)
  })
}

/** Clip 3: build the trip card's frame, badge and all, back into code. */
export const buildToCodeClip: DemoScript = async (api) => {
  /* 5. Build back to code ----------------------------------------------------------------- */
  await scene(api, "build to code", async () => {
    api.caption(STORY.build)
    await focusTripCard(api)
    await typePrompt(api, TRIP_CARD, PROMPTS.build)
    await api.wait(200)
    await api.yourTurn(`${COMPOSER} button[type="submit"]`, { prompt: TURNS.build })
    await ensureSent(api, TRIP_CARD, PROMPTS.build)
    // The chat closes while it builds (the trip card's badge spins); reopen it to read the summary.
    await agentDone(api, 20000)
    await api.wait(400)
    await openChat(api, TRIP_CARD)
    await api.wait(2400)
    if (api.exists(PROMPT_FIELD)) await api.press("Escape", { on: PROMPT_FIELD })
    await api.wait(300)
  })
}

/** Clip 4: make the badge work in Build Mode, test it, then sync and merge the pull request. */
export const shipClip: DemoScript = async (api) => {
  /* 6. Functionality, in Build Mode ----------------------------------------------------- */
  await scene(api, "functionality in build mode", async () => {
    api.caption(STORY.feature)
    await panToShow(api, [CODEBASE], { fx: 0.45, fy: 0.5 })
    await api.click(CODEBASE, { fx: 0.5, fy: 0.35 })
    await api.wait(350)
    await api.click('[data-cursor-id="open-build-mode"]')
    await api.find(PORTAL_SCREEN)
    // The built badge swaps in on the trip card after the app's intro.
    await api.find(BUILT_BADGE, 9000)
    await api.wait(400)
    await api.moveTo(BUILT_BADGE, { fx: 0.5, fy: 2.2, duration: 800 })
    await api.wait(900)
    await api.click('button[aria-label="New agent"]')
    await api.wait(300)
    await askPortal(api, PROMPTS.feature)
    await api.wait(600)
  })

  /* 7. Test + PR ------------------------------------------------------------------------- */
  await scene(api, "test", async () => {
    api.caption(STORY.test)
    // The visitor taps the badge in the live app: the stay is checked in. Tap again to undo.
    await api.find(BUILT_BADGE_BUTTON, 4000)
    await api.yourTurn(BUILT_BADGE_BUTTON, { prompt: TURNS.tap })
    await api.wait(1500)
    await api.click(BUILT_BADGE_BUTTON)
    await api.wait(700)
    // Then the agent adds a test and runs the suite.
    await askPortal(api, PROMPTS.test)
    const results = '[data-cursor-id="portal-test-results"]'
    await api.find(results, 4000)
    await api.moveTo(results, { fx: 0.7, fy: 0.5, duration: 700 })
    await api.wait(1800)
    await api.click('button[aria-label="Back to canvas"]')
    await api.until(() => !api.exists(PORTAL_SCREEN), 4000)
    await api.wait(900)
  })

  await scene(api, "github sync", async () => {
    api.caption(STORY.pr)
    await githubSync(api, PROMPTS.repo)
  })

  await scene(api, "merge", async () => {
    api.caption(STORY.merge)
    await mergePullRequest(api, TURNS.merge)
    api.caption(STORY.done)
    await restAtHome(api)
  })
}

/**
 * The demo's tempo: every cursor move, hold and wait (and a visitor turn's patience) takes this
 * share of its scripted time, i.e. the run plays about 15% faster. Typing keeps its own rhythm.
 */
const DEMO_PACE = 0.85

type Clip = {
  title: string
  /** The core aspect of the product the clip shows, in the hint box above the clip switcher. */
  aspect: string
  script: DemoScript
  /** The state the clip's fresh screen opens in. */
  start: HeroStart
  /**
   * Roughly how long the clip plays (ms, at DEMO_PACE): only drives its progress bar. The scripts
   * follow the app rather than a clock, so the real length varies a little; the bar waits full
   * until the clip ends.
   */
  duration: number
}

const CLIPS: Clip[] = [
  { title: "From your live app to the canvas", aspect: "Build Mode", script: liveAppClip, start: "portal", duration: 11000 },
  { title: "Design with your design system", aspect: "Design system", script: designSystemClip, start: "canvas", duration: 16000 },
  { title: "Build it into code", aspect: "Build Agent", script: buildToCodeClip, start: "designed", duration: 24000 },
  { title: "Make it work, test it and ship it", aspect: "Portal Agent & GitHub", script: shipClip, start: "built", duration: 46000 },
]

/**
 * The hero canvas playing the story as four clips (CLIPS). Each clip plays once on a fresh screen,
 * then the next starts; after the last (the canvas closed, leaving its plain colour) the first
 * opens the Portal out of it, and around it goes. The pill at the bottom shows which clip is
 * playing and how far along it is; the visitor can pick any clip (or restart the current one).
 * On the homepage the first clip waits until its window has scrolled in and grown to full size.
 */
export function HeroDemo({ className }: { className?: string }) {
  const ready = useWindowFullyGrown()
  const [clipIndex, setClipIndex] = useState(0)
  /** Bumped every time a clip (re)starts: keys a fresh stage and screen. */
  const [take, setTake] = useState(0)
  /** The current clip follows the last one finishing (clip 1 then opens out of the closed canvas). */
  const [afterFinale, setAfterFinale] = useState(false)
  /** The current clip's script has started (its progress bar runs from here). */
  const [started, setStarted] = useState(false)
  const clip = CLIPS[clipIndex]

  function playClip(index: number, fromFinale = false) {
    setClipIndex(index)
    setTake((t) => t + 1)
    setAfterFinale(fromFinale)
    setStarted(false)
  }

  return (
    // A mock Safari window around the stage: the cursor lives in the stage, so it never strays
    // onto the browser chrome.
    <SafariChrome url="app.modeinspect.com/hero-interactive-screen" className={className}>
      {/* A fresh clip fades in over the canvas colour, except clip 1 after the finale: the closed
          canvas's colour is its first frame, so it cuts straight over. */}
      <div
        key={take}
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-mi-canvas",
          take > 0 && !afterFinale && "animate-in fade-in duration-500",
        )}
      >
        {/* The visitor can hover the whole screen and click on the canvas while the demo plays; the
            script holds while they do. While a Build Agent chat is open, the canvas doesn't take
            their clicks (a click there would close it), apart from a visitor turn's targets. */}
        <ScriptedStage
          script={clip.script}
          className="min-h-0"
          pace={DEMO_PACE}
          loop={false}
          loopDelay={Math.round(900 * DEMO_PACE)}
          ready={ready}
          visitorArea="[data-hero-canvas]"
          visitorLock={COMPOSER}
          onStart={() => setStarted(true)}
          onFinish={() => playClip((clipIndex + 1) % CLIPS.length, clipIndex === CLIPS.length - 1)}
        >
          {/* Fills the stage instead of the full viewport. */}
          <HeroScreen className="h-auto min-h-0 flex-1" start={clip.start} reopened={clipIndex === 0 && afterFinale} />
        </ScriptedStage>
      </div>

      <ClipTabs active={clipIndex} started={started} onSelect={(index) => playClip(index)} />
    </SafariChrome>
  )
}

/**
 * The clip switcher: a dark pill of dots, one per clip. The playing clip's dot stretches into a
 * bar that fills as it plays. Clicking a dot plays that clip from its start. A small hint box
 * above the pill names the core aspect of the product the playing clip shows.
 */
function ClipTabs({ active, started, onSelect }: { active: number; started: boolean; onSelect: (index: number) => void }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {/* Re-keyed per clip so it fades in each time the clip changes. */}
      <div
        key={active}
        aria-live="polite"
        className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#2a2a2a]/90 px-2.5 py-1 text-px-11 font-medium text-[#f4f4f5] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md animate-in fade-in duration-300"
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-mi-lime" />
        {CLIPS[active].aspect}
      </div>
      <ClipDots active={active} started={started} onSelect={onSelect} />
    </div>
  )
}

function ClipDots({ active, started, onSelect }: { active: number; started: boolean; onSelect: (index: number) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Demo clips"
      className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#2a2a2a]/90 px-4 py-3 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md"
    >
      {CLIPS.map((c, i) => {
        const selected = i === active
        return (
          <button
            key={c.title}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={`${i + 1}. ${c.title}`}
            title={c.title}
            onClick={() => onSelect(i)}
            className="group flex h-6 items-center rounded-full px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <span
              className={cn(
                "relative block h-2 overflow-hidden rounded-full bg-[#7a7a7a] transition-[width,background-color] duration-300",
                selected ? "w-12" : "w-2 group-hover:bg-[#a3a3a3]",
              )}
            >
              {selected && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[#f4f4f5] ease-linear"
                  style={{
                    width: started ? "100%" : "0%",
                    transitionProperty: "width",
                    transitionDuration: started ? `${c.duration}ms` : "0ms",
                  }}
                />
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
