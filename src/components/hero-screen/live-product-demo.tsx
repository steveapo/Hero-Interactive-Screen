"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"
import { TRIP } from "@/app/copy-project/airbnb-data"
import { ScriptedStage, type DemoScript, type ScriptApi } from "@/components/cursor-engine"
import { SCREEN_SCALE_ATTR, setScreenScale } from "@/lib/screen-scale"
import { cn } from "@/lib/utils"
import { PORTAL_TURNS, PORTAL_UPDATE_CARD_PROMPT } from "./agent-script"
import { AIRBNB_ELEMENTS } from "./airbnb-elements"
import { CODEBASE, TRIP_CARD } from "./hero-demo"
import { clearSpotOf, panToShow, PORTAL_FIELD, scene, textOf } from "./hero-demo-v1"
import {
  HeroScreen,
  TRIP_CARD_ID,
  WHEEL_ZOOM_SPEED,
  type HeroSeed,
  type HeroStart,
  type LoadIntro,
} from "./hero-screen"
import { MARGIN_SCRUB_PX } from "./layer-settings-panel"
import {
  CQW,
  NEW_FAIRBNB_BADGE,
  NEW_FAIRBNB_BADGE_SIZE,
  NEW_FAIRBNB_BUTTON,
  NEW_FAIRBNB_BUTTON_SIZE,
  type ComponentLibrary,
  type FrameComponent,
} from "./library-components"

/*
 * The feature cards' clips. Each plays once when it scrolls into view, stops on its key moment and
 * stays there as a still (the screen is then the visitor's to play with; see ScriptedStage's
 * `holdLastFrame`).
 *
 * "overview" stands on its own, and plays without a cursor (see OVERVIEW_INTRO). The others tell one
 * story, in page order, about the trip card:
 * each clip opens on the result of the one before (see STORY and HeroSeed), so they read as steps.
 *  1. "capture"       Live product on canvas: in Build Mode, straight to Capture, then the trip card
 *                     → back on a calm canvas (just the Codebase frame), the captured card glides
 *                     in and is selected, editable.
 *  2. "components"    Your components, 1:1: only the captured card on the canvas. From the Fairbnb
 *                     library, its Badge goes in the top right ("Guest favorite") and its Button
 *                     in the bottom right ("Reserve"): real instances, their props in the panel.
 *  3. "visual-edits"  Controls, not prompts: on that card, the nights numeral is selected and its
 *                     top margin scrubbed up in the settings panel → more room between the dates
 *                     and the nights, the card growing with it.
 *  4. "build"         Canvas to code in one shot: the edited card's frame is sent with "Add to
 *                     Build Chat" and the agent is asked to update the card → the live app's card,
 *                     badge, Reserve button and spacing exactly as designed.
 *  5. "test"          Test the real thing: in the live app, the built Reserve button is clicked on
 *                     desktop; then the Viewport menu switches to mobile, the phone is scrolled
 *                     to the reflowed card and its Reserve is clicked again → "Reserved".
 *  6. "share"         Collaborate and ship: with the change built, open Share and create the
 *                     preview link → the Preview URL window, published; then Copy → "Copied
 *                     Preview Link" slides up at the bottom right and back down.
 */

const BACK_TO_CANVAS = 'button[aria-label="Back to canvas"]'
const SHARE_BUTTON = '[data-cursor-id="share"]'
const SHARE_DIALOG = '[role="dialog"][aria-label="Preview URL"]'
const SHARE_COPY = '[data-cursor-id="share-copy"]'
const COPIED_TOAST = '[data-cursor-id="copied-toast"]'

/* Build Mode and its agent (the Portal). */
const PORTAL_SCREEN = "[data-portal-screen]"
const PORTAL_MESSAGES = '[data-cursor-id="portal-chat-messages"]'
/** The selected frame's settings panel button that sends it to the Build Mode agent. */
const ADD_TO_BUILD_CHAT = '[data-cursor-id="add-to-build-chat"]'
/** A frame attached to the Build Mode agent's composer. */
const ATTACHED_FRAME = '[data-cursor-id="portal-attached-frame"]'
/** The built Reserve button on the trip card in the live app. */
const BUILT_RESERVE = '[data-cursor-id="built-reserve"]'
/** "Worked for …" of the update turn: shows once its reply is done. */
const UPDATE_DONE = PORTAL_TURNS.find((t) => t.prompt === PORTAL_UPDATE_CARD_PROMPT)?.workedFor ?? "Worked for"

/** The Portal chat's send button. */
const portalSend = (api: ScriptApi) => () =>
  api.stage.querySelector(PORTAL_FIELD)?.closest("form")?.querySelector('button[type="submit"]')

/**
 * 0. Everything in one place: no cursor, no clicks; the canvas populates itself (HeroScreen's
 * "emerge" load-in). On an empty canvas the Codebase frame fades in and its live app boots; then,
 * with the frame highlighted, the app's pieces lift off it one by one, each from its own spot in the
 * live app, and glide out onto the canvas as editable frames; the explored screens slide out of it
 * last. Key moment: the codebase and the canvas made of it, in one place. Times in ms after the
 * clip starts.
 */
const OVERVIEW_INTRO: Omit<LoadIntro, "phase"> = {
  style: "emerge",
  chromeAt: 0,
  githubAt: 0,
  codebaseAt: 200,
  elementsAt: 2400,
  settledAt: 6000,
}

/** Share of the canvas (its larger dimension) the captured card fills once zoomed in. */
const FILL_SHARE = 0.45
/** Aim a little past FILL_SHARE, so it clears it comfortably. */
const FILL_AIM = FILL_SHARE * 1.08
/** The canvas zooms in this far here (0.4 elsewhere), so the card can fill FILL_SHARE of it. */
const MAX_ZOOM = 1.5
const CANVAS = "[data-hero-canvas]"
/** Where the card is centred across the canvas: left of the middle, clear of the settings panel. */
const FOCUS_FX = 0.4

/**
 * Real canvas zoom, as a visitor would: with the frame (`target`) centred, the cursor rests on it
 * and ⌘-scrolls by exactly the amount that scales it from its current share of the canvas to
 * FILL_AIM (zoom × exp(−deltaY × WHEEL_ZOOM_SPEED)). Checks again afterwards, then pans it to
 * FOCUS_FX, leaving room on the right for the settings panel.
 */
async function zoomToFill(api: ScriptApi, target: string) {
  await panToShow(api, [target], { fx: 0.5, fy: 0.5 })
  for (let attempt = 0; attempt < 3; attempt++) {
    const frame = api.boxOf(target)
    const canvas = api.boxOf(CANVAS)
    if (!frame || !canvas || !canvas.width || !canvas.height) return
    const share = Math.max(frame.width / canvas.width, frame.height / canvas.height)
    if (share >= FILL_SHARE) break
    const deltaY = -Math.log(FILL_AIM / share) / WHEEL_ZOOM_SPEED
    await api.moveTo(target, { fx: 0.5, fy: 0.5 })
    await api.wheel(0, deltaY, { mods: { ctrl: true }, duration: 1100 })
    await api.wait(200)
  }
  await panToShow(api, [target], { fx: FOCUS_FX, fy: 0.5 })
}

/* ------------------------------- The story -------------------------------- */
/*
 * The trip card as each clip leaves it, so the next one opens there. Positions are the instances'
 * top-left corners in the card's frame (canvas units), inset by the card's own 1.6cqw padding: the
 * Guest favorite Badge in the top-right corner, the Reserve Button in the bottom-right one. The
 * components clip drops them on exactly these spots (see dropAimOf).
 */

const TRIP_RECT = AIRBNB_ELEMENTS.find((el) => el.id === TRIP_CARD_ID)!.rect
/** The card's own padding, in canvas units. */
const TRIP_INSET = 1.6 * CQW
/** Space added above the nights in "Controls, not prompts" (canvas units = px of the desktop app). */
const STORY_GAP = 24

const STORY_BADGE: FrameComponent = {
  id: "component-1",
  component: "Badge",
  frameId: TRIP_CARD_ID,
  cardTitle: TRIP.title,
  x: TRIP_RECT.w - TRIP_INSET - NEW_FAIRBNB_BADGE_SIZE.w,
  y: TRIP_INSET,
  ...NEW_FAIRBNB_BADGE,
  library: "fairbnb",
}

const STORY_BUTTON: FrameComponent = {
  id: "component-2",
  component: "Button",
  frameId: TRIP_CARD_ID,
  cardTitle: TRIP.title,
  x: TRIP_RECT.w - TRIP_INSET - NEW_FAIRBNB_BUTTON_SIZE.w,
  y: TRIP_RECT.h - TRIP_INSET - NEW_FAIRBNB_BUTTON_SIZE.h,
  ...NEW_FAIRBNB_BUTTON,
  library: "fairbnb",
}

const STORY = {
  /** After "Your components, 1:1": the badge and the Reserve button in the card. */
  components: { components: [STORY_BADGE, STORY_BUTTON] },
  /** After "Controls, not prompts": more room above the nights; the button moved down with the card's bottom. */
  spaced: {
    components: [STORY_BADGE, { ...STORY_BUTTON, y: STORY_BUTTON.y + STORY_GAP }],
    numeralGap: STORY_GAP,
  },
  /** After "Canvas to code in one shot": all of it built into the codebase. */
  built: {
    components: [STORY_BADGE, { ...STORY_BUTTON, y: STORY_BUTTON.y + STORY_GAP }],
    numeralGap: STORY_GAP,
    built: true,
  },
} satisfies Record<string, HeroSeed>

/** Where to drop a fresh instance (its centre lands on the drop point) so it ends up at `c`'s spot. */
function dropAimOf(c: FrameComponent, size: { w: number; h: number }) {
  return { fx: (c.x + size.w / 2) / TRIP_RECT.w, fy: (c.y + size.h / 2) / TRIP_RECT.h }
}

/** The trip card in the live app. */
const liveTripCard = (api: ScriptApi) => () =>
  Array.from(api.stage.querySelectorAll(`${PORTAL_SCREEN} [data-anim="block"]`)).find((el) =>
    el.textContent?.includes(TRIP.title),
  )

const CAPTURE_BUTTON = 'button[aria-label="Capture a selection to the canvas (⌘S)"]'

/**
 * 1. Live product on canvas; key moment: the captured trip card on the canvas, selected and
 * editable. In Build Mode the cursor goes straight to Capture (resting on it a moment), then takes
 * the trip card. The canvas holds only the Codebase frame, so the card gliding in after the capture
 * is the one thing that changes.
 */
const captureScript: DemoScript = async (api) => {
  await scene(api, "capture", async () => {
    await api.find(PORTAL_SCREEN)
    await api.wait(400)
    await api.moveTo(CAPTURE_BUTTON)
    await api.wait(300)
    await api.click(CAPTURE_BUTTON)
    await api.wait(250)
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
    await api.click(BACK_TO_CANVAS)
    await api.until(() => !api.exists("[data-portal-screen]"), 4000)
    // The captured card glides in beside the Codebase frame (a quick glide, see `quickEntrance`).
    await api.wait(900)
  })
  await scene(api, "the snapshot on canvas", async () => {
    await zoomToFill(api, TRIP_CARD)
    // Its right side is the card itself (its text hugs the left), so this selects it.
    await api.click(TRIP_CARD, { fx: 0.85, fy: 0.5 })
    await api.wait(400)
  })
}

/* "Your components, 1:1": the Components library holds the Fairbnb app's own components. */
const COMPONENTS_RAIL = '[data-cursor-id="sidebar-components"]'
const LIBRARY_BADGE = '[data-cursor-id="library-Badge"]'
const LIBRARY_BUTTON = '[data-cursor-id="library-Button"]'
const COMPONENT_SETTINGS = '[data-cursor-id="component-settings"]'
const droppedInstance = (id: string) => `[data-frame-component="${id}"]`
/** Share of the canvas's width the trip card takes here: it sits clear of the open library and the settings panel. */
const COMPONENTS_CARD_SHARE = 0.32
/** Where the trip card is centred across the canvas: between the library (left) and the settings panel (right). */
const COMPONENTS_CARD_FX = 0.52

/**
 * Real canvas zoom, either way: ⌘-scroll over `target` by exactly the amount that takes it from
 * its current share of the canvas's width to `share`, then pan it to `fx`.
 */
async function zoomToShare(api: ScriptApi, target: string, share: number, fx: number) {
  await panToShow(api, [target], { fx: 0.5, fy: 0.5 })
  const frame = api.boxOf(target)
  const canvas = api.boxOf(CANVAS)
  if (frame && canvas && canvas.width && frame.width) {
    const current = frame.width / canvas.width
    if (Math.abs(current / share - 1) > 0.05) {
      await api.moveTo(target, { fx: 0.5, fy: 0.5 })
      await api.wheel(0, -Math.log(share / current) / WHEEL_ZOOM_SPEED, { mods: { ctrl: true }, duration: 1000 })
      await api.wait(200)
    }
  }
  await panToShow(api, [target], { fx, fy: 0.5 })
}

/**
 * 2. Your components, 1:1; key moment: real instances of the Fairbnb Badge ("Guest favorite", top
 * right) and Button ("Reserve", bottom right) in the captured trip card, the Button selected with
 * its design-system props in the settings panel. The library shows the app's own components
 * (componentLibrary "fairbnb"), not generic defaults; only the card is on the canvas.
 */
const componentsScript: DemoScript = async (api) => {
  await scene(api, "the card", async () => {
    await zoomToShare(api, TRIP_CARD, COMPONENTS_CARD_SHARE, COMPONENTS_CARD_FX)
    await api.wait(300)
  })
  await scene(api, "open the library", async () => {
    await api.click(COMPONENTS_RAIL)
    await api.find(LIBRARY_BADGE)
    await api.wait(700)
  })
  await scene(api, "the badge, top right", async () => {
    await api.drag(LIBRARY_BADGE, TRIP_CARD, {
      from: { fx: 0.5, fy: 0.65 },
      to: dropAimOf(STORY_BADGE, NEW_FAIRBNB_BADGE_SIZE),
      duration: 1300,
    })
    await api.find(COMPONENT_SETTINGS, 3000)
    await api.wait(600)
  })
  await scene(api, "the reserve button, bottom right", async () => {
    await api.drag(LIBRARY_BUTTON, TRIP_CARD, {
      from: { fx: 0.5, fy: 0.65 },
      to: dropAimOf(STORY_BUTTON, NEW_FAIRBNB_BUTTON_SIZE),
      duration: 1300,
    })
    await api.find(droppedInstance(STORY_BUTTON.id), 3000)
    await api.wait(500)
    // Rest just below the new Button, so it and its settings read clearly.
    await api.moveTo(droppedInstance(STORY_BUTTON.id), { fx: 0.5, fy: 1, dy: 28, duration: 700 })
  })
}

/** The trip card's nights numeral, a layer inside its frame. */
const NIGHTS_LAYER = `${TRIP_CARD} [data-layer="nights"]`
/** The layer panel's Margin top field, and the icon that scrubs it. */
const MARGIN_TOP_FIELD = '[data-cursor-id="margin-top"]'
const MARGIN_TOP_SCRUB = '[data-cursor-id="margin-top-scrub"]'
/** The settings panel's layout width (w-[326px]): its drawn width over this is the screen's scale. */
const PANEL_WIDTH = 326

/**
 * 3. Controls, not prompts; key moment: the edited trip card (badge and Reserve button in place)
 * with more room between its dates and its nights. The nights numeral is selected and its top
 * margin scrubbed up in the settings panel: the value counts up, the margin tints above the
 * numeral and the card grows with it, live.
 */
const visualEditsScript: DemoScript = async (api) => {
  await scene(api, "select the nights", async () => {
    await zoomToFill(api, TRIP_CARD)
    await api.wait(300)
    // On the "3" itself.
    await api.click(NIGHTS_LAYER, { fx: 0.2, fy: 0.55 })
    await api.find(MARGIN_TOP_SCRUB)
    await api.wait(600)
  })
  await scene(api, "scrub the margin", async () => {
    await api.moveTo(MARGIN_TOP_FIELD, { fx: 0.5, fy: 0.5, duration: 700 })
    await api.wait(250)
    // Drag the margin icon right by exactly STORY_GAP units (MARGIN_SCRUB_PX layout px each, drawn at
    // the screen's scale), a little extra so the rounding lands on it.
    const panel = api.boxOf(() => api.stage.querySelector(MARGIN_TOP_FIELD)?.closest("aside"))
    const scrub = api.boxOf(MARGIN_TOP_SCRUB)
    if (panel && scrub) {
      const scale = panel.width / PANEL_WIDTH
      const distance = (STORY_GAP + 0.3) * MARGIN_SCRUB_PX * scale
      const y = scrub.top + scrub.height / 2
      await api.drag(MARGIN_TOP_SCRUB, { x: scrub.left + scrub.width / 2 + distance, y }, { duration: 1300 })
    }
    await api.wait(500)
    // Rest beside the spaced-out card.
    await api.moveTo(NIGHTS_LAYER, { fx: 1.6, fy: 0.2, duration: 700 })
  })
}

/**
 * 4. Canvas to code in one shot; key moment: in Build Mode, the trip card in the live app exactly
 * as designed on the canvas: the Guest favorite badge, the Reserve button and the wider gap above
 * the nights. The edited card's frame is selected and sent with its settings panel's "Add to Build
 * Chat", which opens Build Mode with the frame attached; the agent is asked to update the card.
 */
const buildScript: DemoScript = async (api) => {
  await scene(api, "the edited card", async () => {
    await zoomToFill(api, TRIP_CARD)
    await api.wait(500)
    // Its right side is the card itself, between the badge (top) and the Reserve button (bottom).
    await api.click(TRIP_CARD, { fx: 0.85, fy: 0.45 })
    await api.find(ADD_TO_BUILD_CHAT)
    await api.wait(500)
  })
  await scene(api, "add to build chat", async () => {
    await api.click(ADD_TO_BUILD_CHAT)
    await api.find(PORTAL_SCREEN)
    await api.find(ATTACHED_FRAME)
    await api.wait(700)
  })
  await scene(api, "update the card", async () => {
    await api.click(PORTAL_FIELD)
    await api.type(PORTAL_UPDATE_CARD_PROMPT, { into: PORTAL_FIELD })
    await api.wait(250)
    await api.click(portalSend(api))
    await api.until(() => textOf(api, PORTAL_MESSAGES).includes(UPDATE_DONE), 15000)
  })
  await scene(api, "1:1 in the live app", async () => {
    // The built badge and button swap in with a blue flash while the card eases taller.
    await api.find(BUILT_RESERVE, 6000)
    await api.wait(700)
    await api.moveTo(BUILT_RESERVE, { fx: 0.5, fy: 2.4, duration: 800 })
  })
}

/** The Share popover's "Create Preview Link" button. */
const createPreviewLink = (api: ScriptApi) => () =>
  Array.from(api.stage.querySelectorAll(`${SHARE_DIALOG} button`)).find((el) =>
    el.textContent?.includes("Create Preview Link"),
  )

/**
 * 6. Collaborate and ship; key moment: the Preview URL window, published, over the Codebase frame
 * and the built trip card (the real thing being shared). Its link is copied: the "Copied Preview
 * Link" box slides up at the bottom right, stays a moment, and slides back down.
 */
const shareScript: DemoScript = async (api) => {
  await scene(api, "share", async () => {
    await panToShow(api, [CODEBASE], { fx: 0.45, fy: 0.55 })
    await api.wait(300)
    await api.click(SHARE_BUTTON)
    await api.find(SHARE_DIALOG)
    await api.wait(600)
    await api.click(createPreviewLink(api))
    await api.wait(500)
  })
  await scene(api, "copy the link", async () => {
    await api.click(SHARE_COPY)
    await api.find(COPIED_TOAST)
    // Rest beside the window while the box is up; it slides away by itself.
    await api.moveTo(SHARE_DIALOG, { fx: 0.3, fy: 1, dy: 28, duration: 600 })
    await api.until(() => !api.exists(COPIED_TOAST), 5000)
  })
}

/**
 * 5. Test the real thing; key moment: the built card on a phone, its Reserve button (full width
 * there) just clicked into "Reserved". The built Reserve is clicked on desktop first; then the
 * Viewport menu takes the live app to mobile, where the card reflows to that breakpoint's own
 * layout, the screen is scrolled down to it, and Reserve is clicked again: real components,
 * really interactive, at every breakpoint.
 */
const testScript: DemoScript = async (api) => {
  const desktopReserve = `${screenAt("desktop")} ${BUILT_RESERVE}`
  const mobileReserve = `${screenAt("mobile")} ${BUILT_RESERVE}`
  await scene(api, "reserve on desktop", async () => {
    await api.find(screenAt("desktop"))
    // The built badge and button swap in once the app has settled.
    await api.find(desktopReserve, 6000)
    await api.wait(700)
    await api.moveTo(desktopReserve, { duration: 900 })
    await api.wait(300)
    await api.click(desktopReserve)
    await api.wait(1100)
  })
  await scene(api, "to mobile", async () => {
    await switchViewport(api, "mobile")
  })
  await scene(api, "scroll down", async () => {
    // Scroll the phone's content until the trip card sits at the top of it.
    const main = api.stage.querySelector<HTMLElement>(`${screenAt("mobile")} main`)
    const card = main?.querySelector("[data-trip-card]")
    const mainBox = main ? api.boxOf(main) : null
    const cardBox = card ? api.boxOf(card) : null
    if (main && mainBox && cardBox && mainBox.height) {
      // Stage px → the phone's CSS px (the device is drawn scaled).
      const k = main.clientHeight / mainBox.height
      const top = main.scrollTop + (cardBox.top - mainBox.top) * k - 12
      await api.moveTo(main, { fx: 0.5, fy: 0.6, duration: 600 })
      await api.scroll(main, Math.max(0, top), 900)
    }
    await api.wait(500)
  })
  await scene(api, "reserve on mobile", async () => {
    await api.moveTo(mobileReserve, { duration: 800 })
    await api.wait(300)
    await api.click(mobileReserve)
    await api.wait(1100)
    // Rest just below it, so "Reserved" reads clearly.
    await api.moveTo(mobileReserve, { fx: 0.7, fy: 2.2, duration: 600 })
  })
}

const VIEWPORT_MENU = 'button[aria-label="Viewport"]'
const viewportOption = (id: string) => `[data-cursor-id="viewport-${id}"]`
/** The live app's screen at a viewport (see AirbnbDevice in portal-view). */
const screenAt = (viewport: string) => `[data-portal-screen][data-viewport="${viewport}"]`

/** Switch the Portal's preview to `viewport` through its Viewport menu. */
async function switchViewport(api: ScriptApi, viewport: string) {
  await api.click(VIEWPORT_MENU)
  await api.find(viewportOption(viewport))
  await api.wait(450)
  await api.click(viewportOption(viewport))
  await api.find(screenAt(viewport))
  await api.wait(700)
}

export type FeatureClipId = "overview" | "capture" | "visual-edits" | "components" | "test" | "build" | "share"

type ClipConfig = {
  /** The cursor's script. Omitted: no cursor; the screen plays its `loadIntro` on its own. */
  script?: DemoScript
  /** The screen's load-in, played once the clip starts (see HeroScreen's `loadIntro`). */
  loadIntro?: Omit<LoadIntro, "phase">
  start: HeroStart
  /** Only these app frames are on the canvas (see HeroScreen's `elementIds`). Omitted: all. */
  elementIds?: string[]
  /** Leaving Build Mode, the canvas frames glide in (see HeroScreen's `canvasEntrance`). Default off. */
  canvasEntrance?: boolean
  /** That entrance is a quick single glide (see HeroScreen's `quickEntrance`). Default off. */
  quickEntrance?: boolean
  /** The Portal's browser window shows the live app's address (see HeroScreen's `portalShowUrl`). Default on. */
  portalShowUrl?: boolean
  /** The design system in the Components library (see HeroScreen's `componentLibrary`). Default "default". */
  componentLibrary?: ComponentLibrary
  /** The Codebase frame is on the canvas (see HeroScreen's `showCodebase`). Default on. */
  showCodebase?: boolean
  /** The trip card as the previous step of the story left it (see STORY and HeroScreen's `seed`). */
  seed?: HeroSeed
}

/** The story's clips show the trip card alone. */
const TRIP_ONLY = [TRIP_CARD_ID]

const CLIPS: Record<FeatureClipId, ClipConfig> = {
  // An empty canvas that populates itself: the Codebase frame, then the app's pieces lifted off it.
  overview: { loadIntro: OVERVIEW_INTRO, start: "canvas", canvasEntrance: true },
  // A calm canvas: just the Codebase frame, then the captured trip card gliding in beside it.
  capture: {
    script: captureScript,
    start: "portal",
    elementIds: TRIP_ONLY,
    canvasEntrance: true,
    quickEntrance: true,
  },
  // The captured card alone; the library holds the Fairbnb app's own components.
  components: {
    script: componentsScript,
    start: "canvas",
    elementIds: TRIP_ONLY,
    showCodebase: false,
    componentLibrary: "fairbnb",
  },
  // The card with its badge and Reserve button.
  "visual-edits": {
    script: visualEditsScript,
    start: "canvas",
    elementIds: TRIP_ONLY,
    showCodebase: false,
    componentLibrary: "fairbnb",
    seed: STORY.components,
  },
  // The completely edited card: that's what gets built.
  build: {
    script: buildScript,
    start: "canvas",
    elementIds: TRIP_ONLY,
    showCodebase: false,
    componentLibrary: "fairbnb",
    seed: STORY.spaced,
  },
  // Opens in Build Mode on the live app with the card built; no address in the title bar.
  test: {
    script: testScript,
    start: "portal",
    portalShowUrl: false,
    elementIds: TRIP_ONLY,
    componentLibrary: "fairbnb",
    seed: STORY.built,
  },
  // Built into the code, so there's a real change to share: the Codebase frame and the card.
  share: {
    script: shareScript,
    start: "canvas",
    elementIds: TRIP_ONLY,
    componentLibrary: "fairbnb",
    seed: STORY.built,
  },
}

/** Same tempo as the hero demo (scripted times × 0.85). */
const PACE = 0.85

/** The live app is simply there in the showcase: no loading state, no intro (the Portal's default is 2s). */
const PORTAL_LOAD_MS = 0

/**
 * The screen is laid out at this desktop size and drawn scaled to fit the card. Narrower than the
 * hero's 1280px, so the UI is drawn a little larger in the card.
 */
const LAYOUT = { width: 1100, height: 688 }

/**
 * A clip starts once it's fully in the viewport. Checked at a few ratios near 1, since a box drawn
 * at fractional px may never report exactly 1. A clip taller than the viewport counts as fully in
 * view once it fills the viewport's height.
 */
const VISIBLE_THRESHOLDS = [0.9, 0.95, 0.99, 1]
const FULLY_VISIBLE_RATIO = 0.99

/** A playing clip pauses once this share of it is out of the viewport. */
const PAUSE_HIDDEN_SHARE = 0.75
/** Visibility is re-checked at every 5% step, so the 75% mark is caught in both directions. */
const PAUSE_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)

/** One feature clip (see CLIPS): plays once when fully scrolled into view, then holds its key moment. */
export function FeatureClip({ clip, className }: { clip: FeatureClipId; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  /** Fully scrolled into view (latched): the clip may start. */
  const [ready, setReady] = useState(false)
  const {
    script,
    loadIntro,
    start,
    elementIds,
    canvasEntrance = false,
    quickEntrance = false,
    portalShowUrl = true,
    componentLibrary,
    showCodebase = true,
    seed,
  } = CLIPS[clip]

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        const fillsViewport = entry.intersectionRect.height >= window.innerHeight * FULLY_VISIBLE_RATIO
        if (entry.intersectionRatio < FULLY_VISIBLE_RATIO && !fillsViewport) return
        setReady(true)
        observer.disconnect()
      },
      { threshold: VISIBLE_THRESHOLDS },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Bumped by the reset button: remounts the stage, so the clip replays from its first frame. */
  const [runId, setRunId] = useState(0)

  /**
   * 75% or more of the clip is out of the viewport (scrolled past the top or back below the
   * bottom): it pauses where it is, and carries on once it's back in view. A clip taller than the
   * viewport counts as in view while it covers more than the rest of the viewport.
   */
  const [outOfView, setOutOfView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const visibleShare = Math.max(entry.intersectionRatio, entry.intersectionRect.height / window.innerHeight)
        setOutOfView(!entry.isIntersecting || visibleShare < 1 - PAUSE_HIDDEN_SHARE)
      },
      { threshold: PAUSE_THRESHOLDS },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** The screen's load-in, held until the clip starts. */
  const intro = useMemo<LoadIntro | undefined>(
    () => (loadIntro ? { ...loadIntro, phase: ready ? "play" : "waiting" } : undefined),
    [loadIntro, ready],
  )

  const screen = (
    <HeroScreen
      // A replay remounts the screen, so its load-in plays again from an empty canvas.
      key={script ? undefined : runId}
      className="h-auto min-h-0 flex-1"
      start={start}
      portalLoadMs={PORTAL_LOAD_MS}
      portalShowUrl={portalShowUrl}
      maxZoom={MAX_ZOOM}
      canvasEntrance={canvasEntrance}
      quickEntrance={quickEntrance}
      elementIds={elementIds}
      componentLibrary={componentLibrary}
      showCodebase={showCodebase}
      seed={seed}
      loadIntro={intro}
    />
  )

  return (
    <div ref={ref} className={cn("group/clip relative overflow-hidden rounded-lg bg-mi-canvas", className)}>
      <ScaledScreen>
        {script ? (
          <ScriptedStage
            key={runId}
            script={script}
            pace={PACE}
            ready={ready}
            paused={outOfView}
            loop={false}
            holdLastFrame
            className="min-h-0"
          >
            {screen}
          </ScriptedStage>
        ) : (
          // No script: no cursor; the screen plays its load-in by itself.
          <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">{screen}</div>
        )}
      </ScaledScreen>

      {/* Reset: shown while the screen is hovered (or the button has keyboard focus). */}
      <button
        type="button"
        onClick={() => {
          setReady(true)
          setRunId((id) => id + 1)
        }}
        aria-label="Replay"
        className="absolute bottom-3 left-3 z-50 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 opacity-0 shadow-[0_0_0_1px_#c9c7c3,0_4px_12px_rgba(17,17,16,0.2)] transition-opacity duration-200 hover:bg-neutral-100 focus-visible:opacity-100 group-hover/clip:opacity-100"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Replay
      </button>
    </div>
  )
}

/**
 * Lays the screen out at LAYOUT (a desktop size it's designed for) and draws it scaled to the
 * card's width, keeping its aspect. The scale is registered (see lib/screen-scale) so the cursor
 * script and the canvas map pointer positions correctly.
 */
function ScaledScreen({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const host = hostRef.current
    const content = contentRef.current
    if (!host || !content) return
    const fit = () => {
      const next = host.clientWidth / LAYOUT.width
      if (!next) return
      setScreenScale(content, next)
      setScale(next)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="relative w-full" style={{ aspectRatio: `${LAYOUT.width} / ${LAYOUT.height}` }}>
      <div
        ref={contentRef}
        {...{ [SCREEN_SCALE_ATTR]: "" }}
        className="absolute left-0 top-0 flex origin-top-left flex-col"
        style={{ width: LAYOUT.width, height: LAYOUT.height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}
