"use client"

import { TRIP } from "@/app/copy-project/airbnb-data"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { useWindowFullyGrown } from "@/components/marketing/scroll-grow-window"
import { screenScale } from "@/lib/screen-scale"
import { PORTAL_TURNS } from "./agent-script"
import { HeroScreen } from "./hero-screen"
import { SafariChrome } from "./safari-chrome"

/**
 * STORED VERSION (v1) of the end-to-end hero demo, kept as it was before the "library component"
 * story replaced it on the homepage (see hero-demo.tsx). It plays at /demo/v1. The helpers below
 * are shared with the current script.
 *
 * About 2 minutes, then it loops straight back into the start. It tells one story, narrated by
 * captions (STORY below):
 *
 *   Goal: ship a more playful trip card, and make the search button easy to spot.
 *
 *  1. Portal Agent: a new chat asks for the search-button change (the visitor sends it, turn 1);
 *     the live app picks it up. The trip card is captured to the canvas to rework.        ~20s
 *  2. Build Agent chat: sweat a detail (the Search button); the visitor rates it (turn 2). ~13s
 *  3. Build Agent variants of the trip card, built progressively on the canvas.         ~27s
 *     The visitor sends the prompt (turn 3).
 *  4. "Choose where to build": the visitor picks any of the four variants (turn 4); the agent
 *     builds that one into the codebase.                                               ~10s
 *  5. Portal: the live app shows the picked card in place of the old one.               ~11s
 *  6. Diff review of the change.                                                        ~9s
 *  7. GitHub: create the repo, sync (branch + pull request); the visitor merges (turn 5). ~20s
 *  8. The PR is merged, so the canvas closes: goal achieved.                            ~4s
 *
 * Visitor turns (TURNS) hand one click, sometimes a choice, to whoever is watching: the choices
 * are highlighted and only they take their pointer. If they're watching (tab visible, choice on
 * screen) but don't react within 1.75 seconds, the agent chooses for them.
 *
 * Every step targets live UI (aria labels / data-cursor-id) and waits for it, so the script
 * follows the app rather than a clock. Each scene is a soft step: if something in it doesn't
 * show up, it's logged and the run carries on with the next scene instead of restarting.
 * The typed prompts and captions are the demo's copy; the replies come from agent-script.ts.
 */

/** Typed by the cursor. */
const PROMPTS = {
  portal: "Make the search button pulse so it's easy to spot",
  search: "Why does the search button feel heavier than everything else?",
  variants: "Explore four fresh directions for this card",
  repo: "hero-fairbnb",
}

/** Story captions, one per chapter. */
const STORY = {
  goal: "Goal: ship a more playful trip card, and make the search button easy to spot.",
  portal: "1 · Ask the Portal Agent for a change, right in the live app",
  capture: "2 · Capture the trip card to the canvas to rework it",
  chat: "3 · Sweat the details with the Build Agent",
  variants: "4 · Explore four directions for the card",
  build: "5 · Pick the winner and build it into the codebase",
  live: "6 · See it live: the new card replaces the old one",
  diff: "7 · Review the diff",
  github: "8 · Sync to GitHub: a branch and a pull request",
  merge: "9 · Merge the pull request",
  done: "Merged. The canvas closes. Goal achieved.",
}

/**
 * The visitor's turns (five per run): the demo pauses on the highlighted choice(s) with this
 * prompt and waits for their click. If they're watching but don't react within 1.75 seconds, the
 * agent chooses for them.
 */
const TURNS = {
  portal: "Your turn: send it to the Portal Agent",
  rate: "Your turn: rate the reply",
  send: "Your turn: hit Explore to send it",
  pick: "Your turn: pick any variant to build",
  merge: "Your turn: merge the pull request",
}

/** The trip card variants on the canvas (the four choices to build from). */
const CORE_RULE_VARIANTS = '[data-variant-source="card-upcoming-trip"]'
/** The agent's pick when the visitor doesn't choose (white card, same shape: it swaps in cleanly). */
const PICKED_VARIANT = '[data-variant-source="card-upcoming-trip"][data-variant-label="typography: playful-pop"]'

export const COMPOSER = 'form[aria-label="Build Agent"]'
export const PROMPT_FIELD = 'textarea[aria-label="Ask the Build Agent"]'
const AGENT_STOP = `${COMPOSER} [aria-label="Stop"]`
/** A frame's spinning agent badge: an agent is generating / building with its chat closed. */
const AGENT_BUSY = "[data-agent-busy]"
export const PORTAL_FIELD = 'textarea[aria-label="Describe the change"]'

/* --------------------------------- Helpers --------------------------------- */

/** Run a scene; if one of its targets never shows up, log it and carry on (unless the run was stopped). */
export async function scene(api: ScriptApi, name: string, run: () => Promise<void>) {
  try {
    await run()
  } catch (error) {
    if (api.aborted()) throw error
    console.warn(`[hero-demo] scene "${name}" cut short:`, error)
  }
}

/** A point over the canvas itself (not a panel or popover), so wheel input pans / zooms it. */
export async function moveOverCanvas(api: ScriptApi) {
  // Stage layout px, like the cursor's coordinates.
  const stage = { width: api.stage.clientWidth, height: api.stage.clientHeight }
  const isCanvas = (x: number, y: number) => api.elementAt({ x, y })?.closest("[data-hero-canvas]") != null
  const here = api.cursor()
  if (isCanvas(here.x, here.y)) return
  const candidates = [
    [0.5, 0.55],
    [0.42, 0.62],
    [0.58, 0.4],
    [0.35, 0.35],
    [0.65, 0.7],
    [0.3, 0.8],
  ]
  const spot = candidates.map(([fx, fy]) => ({ x: stage.width * fx, y: stage.height * fy })).find((p) => isCanvas(p.x, p.y))
  if (spot) await api.moveTo(spot)
}

/** Union of the elements' boxes, relative to the stage. */
function unionBox(api: ScriptApi, selectors: string[]): DOMRect | null {
  const boxes = selectors.flatMap((selector) =>
    Array.from(api.stage.querySelectorAll(selector)).map((el) => api.boxOf(el)).filter((b): b is DOMRect => b !== null),
  )
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((b) => b.left))
  const top = Math.min(...boxes.map((b) => b.top))
  const right = Math.max(...boxes.map((b) => b.right))
  const bottom = Math.max(...boxes.map((b) => b.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

/**
 * Pan the canvas (wheel, like a trackpad) so the elements sit around `fx`/`fy` of the stage.
 * Pans again if the first one fell short (the camera eases), so targets end up in view.
 */
export async function panToShow(api: ScriptApi, selectors: string[], { fx = 0.45, fy = 0.5, duration = 900 } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const box = unionBox(api, selectors)
    if (!box) return
    // Stage layout px, like api.boxOf (the stage may be drawn scaled).
    const stage = { width: api.stage.clientWidth, height: api.stage.clientHeight }
    const dx = box.left + box.width / 2 - stage.width * fx
    const dy = box.top + box.height / 2 - stage.height * fy
    if (Math.hypot(dx, dy) < 40) return
    await moveOverCanvas(api)
    await api.wheel(dx, dy, { duration: attempt === 0 ? duration : 450 })
    await api.wait(120)
  }
}

/** Scroll the element into view inside its own scrolling list (never the page). */
export function revealInList(api: ScriptApi, selector: string) {
  const el = api.stage.querySelector(selector)
  if (!el) return
  let list = el.parentElement
  while (list && list !== api.stage && !(list.scrollHeight > list.clientHeight && /(auto|scroll)/.test(getComputedStyle(list).overflowY))) {
    list = list.parentElement
  }
  if (!list || list === api.stage) return
  const r = el.getBoundingClientRect()
  const l = list.getBoundingClientRect()
  // Screen px → the list's own (scroll) px, in case the screen is drawn scaled.
  const k = screenScale(list)
  if (r.top < l.top) list.scrollTop -= (l.top - r.top) / k + 8
  else if (r.bottom > l.bottom) list.scrollTop += (r.bottom - l.bottom) / k + 8
}

/** Text of the element (or "" if it isn't there). */
export function textOf(api: ScriptApi, selector: string) {
  return api.stage.querySelector(selector)?.textContent ?? ""
}

/**
 * A spot on `el` itself (as fx / fy of its box) that's clear of every descendant's box, with a
 * little margin, so hovering or clicking there targets the element and not any of its contents
 * (e.g. Area capture takes the whole card, not a line of text). Worked out from layout boxes
 * rather than hit-testing, so it doesn't depend on the stage taking pointer events. Scans from
 * the right, middle rows first; `fallback` if nothing is clear.
 */
export function clearSpotOf(
  el: Element | null | undefined,
  fallback: { fx: number; fy: number } = { fx: 0.8, fy: 0.5 },
): { fx: number; fy: number } {
  if (!el) return fallback
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return fallback
  const margin = Math.min(box.width, box.height) * 0.08
  const children = Array.from(el.querySelectorAll("*"))
    .map((child) => child.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
  const isClear = (x: number, y: number) =>
    children.every((r) => x < r.left - margin || x > r.right + margin || y < r.top - margin || y > r.bottom + margin)
  for (const fy of [0.5, 0.42, 0.58, 0.34, 0.66]) {
    for (let step = 0; step <= 14; step++) {
      const fx = 0.85 - step * 0.05
      if (isClear(box.left + box.width * fx, box.top + box.height * fy)) return { fx, fy }
    }
  }
  return fallback
}

/** The Portal's live preview frame (carries the applied changes), and its content inside the clip. */
const PORTAL_PREVIEW_FRAME = "[data-portal-applied]"
export const PORTAL_PREVIEW = "[data-portal-applied] > div"
/** Brief zoom into a change: scale (never more than 1.25), then ease in / hold / ease out (ms). */
const SHOWCASE_ZOOM = 1.25
const SHOWCASE_IN_MS = 650
const SHOWCASE_HOLD_MS = 1500
const SHOWCASE_OUT_MS = 650

/**
 * Zoom the element into the cursor for a moment, then back out: it scales about the cursor's
 * point, so whatever is under the cursor stays put while its surroundings grow around it.
 * `onZoomedIn` runs the moment it's fully zoomed in (e.g. to start the change's animation).
 */
export async function zoomAtCursor(api: ScriptApi, target: string, onZoomedIn?: () => void) {
  const el = await api.find(target)
  const box = api.boxOf(el)
  if (!(el instanceof HTMLElement) || !box) {
    onZoomedIn?.()
    return
  }
  const at = api.cursor()
  const total = SHOWCASE_IN_MS + SHOWCASE_HOLD_MS + SHOWCASE_OUT_MS
  const ease = "cubic-bezier(0.65, 0, 0.35, 1)"
  const zoomed = `scale(${SHOWCASE_ZOOM})`
  const previousOrigin = el.style.transformOrigin
  el.style.transformOrigin = `${at.x - box.left}px ${at.y - box.top}px`
  const animation = el.animate(
    [
      { transform: "scale(1)", easing: ease },
      { transform: zoomed, offset: SHOWCASE_IN_MS / total },
      { transform: zoomed, offset: (SHOWCASE_IN_MS + SHOWCASE_HOLD_MS) / total, easing: ease },
      { transform: "scale(1)" },
    ],
    { duration: total },
  )
  try {
    await api.wait(SHOWCASE_IN_MS)
    onZoomedIn?.()
    await api.wait(SHOWCASE_HOLD_MS + SHOWCASE_OUT_MS)
  } finally {
    animation.cancel()
    el.style.transformOrigin = previousOrigin
  }
}

/** Wait for the agent to finish working (its chat's Stop button, or the frames' spinning badge). */
export async function agentDone(api: ScriptApi, timeout = 20000) {
  await api.wait(400)
  await api.until(() => !api.exists(AGENT_STOP) && !api.exists(AGENT_BUSY), timeout)
}

/**
 * The chat opens right where the Build Agent button was clicked, so the cursor would sit over the
 * text as it's typed: step it off to just below the chat's bottom-left corner first.
 */
async function clearOfPrompt(api: ScriptApi) {
  await api.wait(250) // let the chat finish gliding / zooming in, so the spot is where it lands
  await api.moveTo(COMPOSER, { fx: 0, fy: 1, dx: 10, dy: 18, duration: 380 })
}

/*
 * The visitor can play along on the canvas (see HeroDemo's `visitorArea`). A click of theirs on
 * empty canvas or another frame changes the selection, which closes the open chat; the helpers
 * below check that each chat step actually happened and redo it if it didn't.
 */

/** Open the Build Agent chat on a frame (select it, click its agent button), unless it's open. */
export async function openChat(api: ScriptApi, frame: string) {
  if (api.exists(PROMPT_FIELD)) return
  await api.click(frame, { fx: 0.4 })
  await api.wait(450)
  await api.click(`${frame} button[aria-label="Build Agent"]`)
  await api.find(PROMPT_FIELD)
  await clearOfPrompt(api)
}

const promptValue = (api: ScriptApi) =>
  (api.stage.querySelector(PROMPT_FIELD) as HTMLTextAreaElement | null)?.value ?? ""

/** Type the prompt into the frame's chat; if it's closed midway, reopen it and type it again. */
export async function typePrompt(api: ScriptApi, frame: string, text: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await openChat(api, frame)
    try {
      await api.type(text, { into: PROMPT_FIELD, replace: true })
    } catch (error) {
      if (api.aborted()) throw error
      continue
    }
    if (promptValue(api) === text) return
  }
}

/** The open chat's agent (or a frame's spinning badge) shows it's working. */
const agentStarted = (api: ScriptApi) => api.exists(AGENT_STOP) || api.exists(AGENT_BUSY)

/** Make sure the prompt went out; if not (its chat was closed before it was sent), send it again. */
export async function ensureSent(api: ScriptApi, frame: string, text: string) {
  await api.wait(400)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (agentStarted(api)) return
    await openChat(api, frame) // reopening shows whether it's working after all
    if (agentStarted(api)) return
    await typePrompt(api, frame, text)
    await api.press("Enter", { on: PROMPT_FIELD })
    await api.wait(400)
  }
}

/* --------------------------------- Script ---------------------------------- */

export const heroDemoV1Script: DemoScript = async (api) => {
  /* 1. Portal Agent ------------------------------------------------------------ */
  await scene(api, "portal agent", async () => {
    // The screen opens in the Portal. If the live app is still loading (the demo started with the
    // page), let it load and play its intro; if it's been on screen a while, move straight away
    // so the visitor's eye is caught the moment the screen is in view.
    api.caption(STORY.goal)
    await api.find("[data-portal-screen]")
    const loading = '[role="status"][aria-label="Loading preview"]'
    if (api.exists(loading)) {
      await api.until(() => !api.exists(loading), 10000)
      await api.wait(1800) // the app's intro
    }
    // The goal stays up while the cursor heads for "New agent"; chapter 1 starts with the click.
    await api.click('button[aria-label="New agent"]')
    api.caption(STORY.portal)
    await api.wait(350)
    await api.click(PORTAL_FIELD)
    await api.type(PROMPTS.portal, { into: PORTAL_FIELD })
    await api.wait(250)
    // Hold the button's pulse back until the zoom below is fully in, so it starts on camera.
    const preview = api.stage.querySelector(PORTAL_PREVIEW_FRAME)
    preview?.setAttribute("data-pulse-held", "")
    const releasePulse = () => preview?.removeAttribute("data-pulse-held")
    // Visitor turn 1: send the change to the Portal Agent.
    const portalSend = () => api.stage.querySelector(PORTAL_FIELD)?.closest("form")?.querySelector('button[type="submit"]')
    await api.yourTurn(portalSend, { prompt: TURNS.portal })
    // While it works (the new chat pulses in the header), drift over to the button it's changing.
    await api.wait(500)
    await api.moveTo('[data-portal-screen] [data-anim="search-button"]', { dx: 40, dy: 26 })
    const workedFor = PORTAL_TURNS[0].workedFor
    try {
      await api.until(() => textOf(api, '[data-cursor-id="portal-chat-messages"]').includes(workedFor), 15000)
      await api.wait(500)
      // The button is updated: zoom into the cursor (beside it); the pulse starts once fully zoomed in.
      await zoomAtCursor(api, PORTAL_PREVIEW, releasePulse)
    } finally {
      releasePulse()
    }
    await api.wait(500)
  })

  await scene(api, "portal capture", async () => {
    api.caption(STORY.capture)
    await api.click('button[aria-label="Capture a selection to the canvas (⌘S)"]')
    await api.wait(300)
    const coreRuleBlock = () =>
      Array.from(api.stage.querySelectorAll('[data-portal-screen] [data-anim="block"]')).find((el) =>
        el.textContent?.includes(TRIP.title),
      )
    // Aim at the card itself, clear of its text, so the capture takes the whole card.
    const spot = clearSpotOf(coreRuleBlock())
    await api.moveTo(coreRuleBlock, spot)
    await api.wait(300)
    await api.click(coreRuleBlock, spot)
    await api.wait(900)
    await api.click('button[aria-label="Exit area capture"]')
    await api.wait(250)
  })

  await scene(api, "back to canvas", async () => {
    if (api.exists('button[aria-label="Back to canvas"]')) await api.click('button[aria-label="Back to canvas"]')
    await api.until(() => !api.exists("[data-portal-screen]"), 4000)
    await api.wait(2300) // the canvas sweeps in around the Codebase frame
  })

  /* 2. Build Agent chat --------------------------------------------------------- */
  const search = '[data-cursor-id="frame-search-button"]'
  await scene(api, "build agent chat", async () => {
    api.caption(STORY.chat)
    // Search sits left of centre, so the chat has room to open on its right.
    await panToShow(api, [search], { fx: 0.3, fy: 0.42 })
    await typePrompt(api, search, PROMPTS.search) // the field grows onto a second line
    await api.wait(200)
    await api.press("Enter", { on: PROMPT_FIELD })
    await ensureSent(api, search, PROMPTS.search)
    await agentDone(api)
    await api.wait(1200) // read the reply
    // Visitor turn 2: rate the reply, either way (the agent gives it a thumbs up if they don't).
    const good = `${COMPOSER} button[aria-label="Good response"]`
    const bad = `${COMPOSER} button[aria-label="Bad response"]`
    if (api.exists(good)) {
      revealInList(api, good)
      await api.yourTurn([good, bad], { prompt: TURNS.rate, fallback: 0 })
      await api.wait(450)
    }
  })
  await scene(api, "close chat", async () => {
    if (api.exists(PROMPT_FIELD)) await api.press("Escape", { on: PROMPT_FIELD })
    await api.wait(300)
  })

  /* 3. Build Agent variants ------------------------------------------------------ */
  const coreRule = '[data-cursor-id="frame-card-upcoming-trip"]'
  await scene(api, "variants", async () => {
    api.caption(STORY.variants)
    await panToShow(api, [coreRule], { fx: 0.38, fy: 0.42 })
    await typePrompt(api, coreRule, PROMPTS.variants)
    await api.wait(200)
    // Visitor turn 3: send the prompt. A fresh chat's submit button reads "Explore" (an ongoing
    // one shows an arrow labelled "Send"), so target the submit button itself.
    await api.yourTurn(`${COMPOSER} button[type="submit"]`, { prompt: TURNS.send })
    await ensureSent(api, coreRule, PROMPTS.variants)

    // The copies slide out below the original and the chat closes (the original keeps a spinning
    // agent badge): zoom out a touch and pan down to watch them build.
    await api.find('[data-cursor-id^="variant-"]', 12000)
    await api.wait(1500)
    await moveOverCanvas(api)
    await api.wheel(0, 24, { mods: { ctrl: true }, duration: 500 })
    await api.wait(200)
    await panToShow(api, ['[data-cursor-id^="variant-"]', coreRule], { fx: 0.42, fy: 0.55, duration: 1100 })
    // Follow the work loosely: hover by a variant the agent is building every couple of seconds.
    const started = performance.now()
    while ((api.exists(AGENT_BUSY) || api.exists(AGENT_STOP)) && performance.now() - started < 45000) {
      const building = api.stage.querySelector('[data-agent-status="building"]')
      if (building) await api.moveTo(building, { fx: 0.85, fy: 1.2, duration: 900 })
      await api.wait(2200)
    }
    await agentDone(api, 15000)
    await api.wait(1000)
  })

  /* 4. Build a variant into the codebase ------------------------------------------- */
  await scene(api, "choose where to build", async () => {
    api.caption(STORY.build)
    // The chat closed while the variants were built: select the trip card and reopen its chat. The
    // card and the pick sit right of centre: picking moves the chat to the left.
    if (!api.exists(COMPOSER)) {
      await panToShow(api, [coreRule, CORE_RULE_VARIANTS], { fx: 0.55, fy: 0.45 })
      await openChat(api, coreRule)
      await api.wait(150)
    }
    const choose = '[data-cursor-id="choose-where-to-build"]'
    await api.find(choose)
    revealInList(api, choose)
    await api.click(choose)
    await api.wait(500)
    // Visitor turn 4: pick any of the four variants ("Build this" shows on hover); whichever they
    // pick is built and replaces the card in the live app. The agent picks playful-pop otherwise.
    const variants = Array.from(api.stage.querySelectorAll(CORE_RULE_VARIANTS))
    const fallback = Math.max(0, variants.findIndex((v) => v.matches(PICKED_VARIANT)))
    const { index } = await api.yourTurn(variants.length > 0 ? variants : PICKED_VARIANT, {
      prompt: TURNS.pick,
      fallback,
      fx: 0.3,
      fy: 0.3,
    })
    // If the pick didn't land (a click elsewhere on the canvas turned picking off), redo it with
    // the same choice: reopen the chat, turn picking on, click that variant.
    await api.wait(300)
    const picked = variants[index]
    if (!api.exists(AGENT_BUSY) && picked?.isConnected) {
      await openChat(api, coreRule)
      if (!textOf(api, choose).includes("Pick a variant")) {
        revealInList(api, choose)
        await api.click(choose)
        await api.wait(400)
      }
      await api.click(picked, { fx: 0.3, fy: 0.3 })
    }
    await agentDone(api)
    await api.wait(1200)
  })

  /* 5. The built variant in the live app ------------------------------------------- */
  await scene(api, "portal with built variant", async () => {
    api.caption(STORY.live)
    await panToShow(api, ['[data-cursor-id="codebase-frame"]'], { fx: 0.5, fy: 0.5 })
    await api.doubleClick('[data-cursor-id="codebase-frame"]', { fx: 0.5, fy: 0.4 })
    await api.find("[data-portal-screen]")
    await api.find('[data-cursor-id="built-variant"]', 8000)
    await api.wait(500)
    await api.moveTo('[data-cursor-id="built-variant"]', { fx: 0.7, fy: 0.75, duration: 800 })
    await api.wait(2200)
    await api.click('button[aria-label="Back to canvas"]')
    await api.until(() => !api.exists("[data-portal-screen]"), 4000)
    await api.wait(1700) // the canvas sweeps back in
  })

  /* 6. Diff review ----------------------------------------------------------------- */
  await scene(api, "diff review", async () => {
    api.caption(STORY.diff)
    await api.click('button[aria-label="View code changes"]')
    const dialog = '[role="dialog"][aria-label="Code changes"]'
    await api.find(dialog)
    await api.wait(450)
    // The built variant's change is selected; read down its diff (it fills the pane, its lines sit at the top).
    const diff = `${dialog} [data-diff]`
    await api.moveTo(diff, { fx: 0.25, fy: 0.05 })
    await api.wait(800)
    await api.moveTo(diff, { fx: 0.75, fy: 0.15, duration: 900 })
    await api.wait(1100)
    await api.moveTo(diff, { fx: 0.72, fy: 0.25, duration: 600 })
    await api.wait(600)
    await api.scroll(`${dialog} [data-file-tree]`, 220, 800)
    await api.wait(500)
    await api.click(`${dialog} button[aria-label="Close"]`)
    await api.wait(350)
  })

  /* 7. GitHub: create the repo, sync (branch + pull request), merge ------------------ */
  await scene(api, "github sync", async () => {
    api.caption(STORY.github)
    await githubSync(api, PROMPTS.repo)
  })

  await scene(api, "merge", async () => {
    api.caption(STORY.merge)
    await mergePullRequest(api, TURNS.merge)
    api.caption(STORY.done)
    await restAtHome(api)
  })
}

/* ------------------------------ Shared endings ----------------------------- */

const SYNC_DIALOG = '[role="dialog"][aria-label="Github Sync"]'
const PR_DIALOG = '[role="dialog"][aria-label="Pull request"]'

/** GitHub: create the repo (named `repo`, public), then sync: a branch and a pull request. */
export async function githubSync(api: ScriptApi, repo: string) {
  await api.click('button[aria-label="GitHub"]')
  await api.find("#github-repo-name")
  await api.wait(350)
  await api.type(repo, { into: "#github-repo-name", replace: true })
  await api.wait(250)
  await api.click('button[role="switch"][aria-labelledby="github-public-label"]')
  await api.wait(300)
  await api.click('form[aria-labelledby="create-github-project-title"] button[type="submit"]')
  await api.wait(550)
  await api.click('button[aria-label="GitHub"]')
  await api.find(SYNC_DIALOG)
  await api.wait(450)
  await api.click(`${SYNC_DIALOG} button`) // Sync to Github
  // Synced: the popover shows the branch and the pull request it opened.
  await api.find('[data-cursor-id="github-pr-card"]', 8000)
  await api.moveTo('[data-cursor-id="github-pr-card"]', { fx: 0.6, fy: 0.5, duration: 600 })
  await api.wait(1600)
}

/** Open the pull request and merge it (a visitor turn with `prompt`); resolves once the canvas has closed. */
export async function mergePullRequest(api: ScriptApi, prompt: string) {
  const viewPr = () =>
    Array.from(api.stage.querySelectorAll(`${SYNC_DIALOG} button`)).find((b) => b.textContent?.includes("View on Github"))
  await api.click(viewPr)
  await api.find(PR_DIALOG)
  await api.wait(1200) // read the PR
  const mergeButton = () =>
    Array.from(api.stage.querySelectorAll(`${PR_DIALOG} button`)).find((b) => b.textContent?.includes("Merge pull request"))
  await api.yourTurn(mergeButton, { prompt })
  // Merging… → Merged, then the canvas closes.
  await api.find('[data-cursor-id="canvas-closed"]', 8000)
}

/** Rest where every run starts (the stage's home spot: 62% across, 70% down), while the closing card is read. */
export async function restAtHome(api: ScriptApi) {
  await api.moveTo({ x: api.stage.clientWidth * 0.62, y: api.stage.clientHeight * 0.7 }, { duration: 900 })
  await api.wait(2400) // read the card; it fades, leaving the canvas colour the next run opens from
}

/**
 * The stored v1 demo on a loop (see the header above). The run ends on the plain canvas colour
 * and the next opens the Portal out of it, so the loop cuts straight over.
 */
export function HeroDemoV1({ className }: { className?: string }) {
  const ready = useWindowFullyGrown()
  return (
    <SafariChrome url="app.modeinspect.com/hero-interactive-screen" className={className}>
      <ScriptedStage
        script={heroDemoV1Script}
        className="min-h-0"
        loopTransition="cut"
        loopDelay={900}
        ready={ready}
        visitorArea="[data-hero-canvas]"
        visitorLock={COMPOSER}
      >
        {(iteration) => <HeroScreen className="h-auto min-h-0 flex-1" reopened={iteration > 0} />}
      </ScriptedStage>
    </SafariChrome>
  )
}
