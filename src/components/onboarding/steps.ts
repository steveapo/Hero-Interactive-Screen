import type { GuideEvent } from "@/components/hero-screen/hero-screen"
import { PORTAL_BUILD_VARIANT_PROMPT } from "@/components/hero-screen/agent-script"

/**
 * The onboarding tour: one step per core action, in the order of the core flow: edit a frame in its
 * controls panel, iterate with AI on the canvas, drop a real component into a variant, take that
 * variant into Build mode, build it, capture back, return, share. Optional bonus steps after Share
 * walk through GitHub sync.
 *
 * Each step says what to do right now (`tryIt`) and which UI to spotlight (`targets`), both from
 * what the visitor has done so far (GuideContext), and completes on the event that proves it was done.
 */

/** What the visitor has done so far, folded from the screen's GuideEvents. */
export type GuideContext = {
  /** Selected canvas frame ids. */
  selection: string[]
  /** The Build Agent chat on the canvas is open. */
  agentOpen: boolean
  /** A message was sent to the Build Agent on the canvas. */
  agentSent: boolean
  /** A frame is being dragged (and could be dropped into the Codebase). */
  dragging: boolean
  /** Build mode (the Portal) is open. */
  portalOpen: boolean
  /** A message was sent in Build mode's chat since it opened. */
  portalSent: boolean
  /** The latest variant run: how many of its variants are built, of how many (0: none yet). */
  variantsDone: number
  variantsTotal: number
  /** That run is over. */
  variantsSettled: boolean
}

export const INITIAL_CONTEXT: GuideContext = {
  selection: [],
  agentOpen: false,
  agentSent: false,
  dragging: false,
  portalOpen: false,
  portalSent: false,
  variantsDone: 0,
  variantsTotal: 0,
  variantsSettled: false,
}

export function foldEvent(ctx: GuideContext, event: GuideEvent): GuideContext {
  switch (event.type) {
    case "selection":
      return { ...ctx, selection: event.ids }
    case "agent":
      return { ...ctx, agentOpen: event.open }
    case "agent-sent":
      return { ...ctx, agentSent: true }
    case "frame-drag":
      return { ...ctx, dragging: event.active }
    case "portal-opened":
      return { ...ctx, portalOpen: true, portalSent: false, dragging: false }
    case "portal-closed":
      return { ...ctx, portalOpen: false }
    case "portal-sent":
      return { ...ctx, portalSent: true }
    case "variants-progress":
      return ctx.variantsDone === event.done && ctx.variantsTotal === event.total && ctx.variantsSettled === event.settled
        ? ctx
        : { ...ctx, variantsDone: event.done, variantsTotal: event.total, variantsSettled: event.settled }
    default:
      return ctx
  }
}

/** Variants are being built (the run has started and isn't over). */
function generating(ctx: GuideContext) {
  return ctx.variantsTotal > 0 && !ctx.variantsSettled
}

/** Something to spotlight: the first element matching `selector`. */
export type GuideTarget = {
  selector: string
  /** Spotlight every element matching `selector`, not just the first. */
  all?: boolean
  /** A short instruction pinned to it (only the first found target with a label shows its label). */
  label?: string
  /**
   * Where the label sits along the target: centred (default, below or above it), or above it
   * aligned to its left ("start") or right ("end") edge, e.g. for a composer docked at a corner.
   */
  labelAlign?: "center" | "start" | "end"
  /** Skip this target while an element matching this selector (or any of these) is on screen. */
  unless?: string | string[]
  /** Space between the element and the cut-out (px). Default 6. */
  padding?: number
  /** Corner radius of the cut-out (px). Default 10. */
  radius?: number
}

/** A page of explanation shown before a step's action (e.g. what Build mode is), with a Next button. */
export type GuideIntroPage = {
  eyebrow: string
  title: string
  body: string
  target: GuideTarget
  /** The Next button's label. */
  next: string
  /** From this page on, the step's `prompt` types itself into the Build mode chat. */
  typesPrompt?: boolean
}

export type GuideStep = {
  id: string
  /** Where this step happens, shown above the title. */
  eyebrow: string
  title: string
  body: string
  /**
   * While something is happening that's worth explaining (e.g. the agent building variants), the
   * guide card tells that story instead of the step's own eyebrow, title and body.
   */
  explain?: (ctx: GuideContext) => { eyebrow: string; title: string; body: string } | null
  /** Shown first, page by page, while Build mode is open (what the visitor is looking at). */
  intro?: GuideIntroPage[]
  /** Typed into the Build mode chat for the visitor (from the intro page that `typesPrompt`). */
  prompt?: string
  /** Where the camera should be for this step (see HeroScreen's guideFocus). */
  focus?: "overview" | "variants" | "captures"
  /** Once done: where the camera goes, and what's spotlit, while the done message holds. */
  doneFocus?: "overview" | "variants" | "captures"
  doneTargets?: (ctx: GuideContext) => GuideTarget[]
  /**
   * Once done, wait for the visitor to press Continue (labelled this) instead of moving on by
   * itself; the spotlight stays on what was made.
   */
  continueLabel?: string
  /** Once done, a second way on: into the optional steps starting at step `to`. */
  offer?: { label: string; to: string }
  /** A bonus step: only reached through an `offer`; the main tour finishes before it. */
  optional?: boolean
  /** The one thing to do right now. */
  tryIt: (ctx: GuideContext) => string
  targets: (ctx: GuideContext) => GuideTarget[]
  /** An animated ghost showing the drag to make (selectors of where it starts and lands). */
  dragHint?: (ctx: GuideContext) => { from: string; to: string } | null
  /** The event that proves the step was done. */
  completes?: (event: GuideEvent) => boolean
  /** The step is done by clicking an element matching this selector. */
  completeOnClick?: string
  /** Already done when the step comes up (e.g. already back on the canvas). */
  alreadyDone?: (ctx: GuideContext) => boolean
  /**
   * A milestone: doing it early (during an earlier step) skips the tour ahead to it, so a visitor
   * who goes their own way isn't asked to do things that no longer make sense.
   */
  milestone?: boolean
  /** Shown once the step is done, before the next one comes up. */
  done: string
  /** How long the done message holds before the next step (ms). Default 1400. */
  holdMs?: number
}

/* -------------------------------- Selectors -------------------------------- */

export const TRIP_FRAME = '[data-cursor-id="frame-card-upcoming-trip"]'
export const CODEBASE_FRAME = '[data-cursor-id="codebase-frame"]'
const AGENT_BUTTON = 'button[aria-label="Build Agent"]'
const AGENT_COMPOSER = 'form[aria-label="Build Agent"]'
const FILL_SWATCH = '[data-cursor-id="fill-swatch"]'
const FILL_PICKER = '[data-cursor-id="fill-picker"]'
const COMPONENTS_RAIL = '[data-cursor-id="sidebar-components"]'
const LIBRARY_BADGE = '[data-cursor-id="library-Badge"]'
const PORTAL_PREVIEW = '[data-cursor-id="portal-preview"]'
/** An invisible box over the trip card in Build mode's live app (see PortalView's TripCardMarker). */
const PORTAL_TRIP_CARD = '[data-cursor-id="portal-trip-card"]'
const PORTAL_CHAT = '[data-cursor-id="portal-chat"]'
const PORTAL_COMPOSER = '[data-cursor-id="portal-composer"]'
const PORTAL_SEND = '[data-cursor-id="portal-send"]'
const ATTACHED_FRAME = '[data-cursor-id="portal-attached-frame"]'
const CAPTURE_BUTTON = 'button[aria-label^="Capture a selection"]'
const BACK_TO_CANVAS = 'button[aria-label="Back to canvas"]'
export const SHARE_BUTTON = '[data-cursor-id="share"]'
/** The Share popover's "Create Preview Link" button (only there while not yet published). */
export const SHARE_CREATE = '[data-cursor-id="share-create"]'
export const SHARE_POPOVER = '[data-cursor-id="share-popover"]'
const GITHUB_BUTTON = 'button[aria-label^="GitHub"]'
const GITHUB_CREATE_DIALOG = 'form[aria-labelledby="create-github-project-title"]'
const GITHUB_SYNC_POPOVER = '[role="dialog"][aria-label="Github Sync"]'

const TRIP_ID = "card-upcoming-trip"
/** The variants the Build Agent generates on the canvas. */
const VARIANT_FRAMES = '[data-cursor-id^="variant-"]'
/** Pieces of the live app captured onto the canvas. */
const CAPTURED_FRAMES = '[data-cursor-id^="capture-"]'

/** Build mode is closed: the way back in (double-click the Codebase frame). */
const OPEN_BUILD_MODE: GuideTarget = { selector: CODEBASE_FRAME, label: "Double-click to open Build mode", radius: 12 }

/** What to drag into Build mode: the variants, or the trip card when there are none. */
function dragSource(ctx: GuideContext) {
  return ctx.variantsTotal > 0 ? VARIANT_FRAMES : TRIP_FRAME
}

/** Spotlight what to drag and where to drop it (Build mode is closed). */
function dragTargets(ctx: GuideContext): GuideTarget[] {
  return [
    ctx.variantsTotal > 0
      ? { selector: VARIANT_FRAMES, all: true, label: "Drag your favourite onto the app", radius: 8, padding: 8 }
      : { selector: TRIP_FRAME, label: "Drag me onto your app", radius: 8 },
    { selector: CODEBASE_FRAME, radius: 12 },
  ]
}

/* ---------------------------------- Steps ---------------------------------- */

export const STEPS: GuideStep[] = [
  {
    id: "controls",
    eyebrow: "On the canvas",
    title: "Edit it visually",
    body: "Select a frame and its controls panel opens on the right: position, size, layout, fill and more. Change a value and the frame updates instantly.",
    tryIt: (ctx) =>
      ctx.selection.includes(TRIP_ID)
        ? "In the controls panel on the right, click the Fill swatch, then pick a design token or a custom colour."
        : "Click the trip card to select it.",
    targets: (ctx) =>
      ctx.selection.includes(TRIP_ID)
        ? [
            { selector: FILL_PICKER, label: "Pick a token or a custom colour", radius: 12, padding: 4 },
            { selector: FILL_SWATCH, label: "Open the colour picker", unless: FILL_PICKER, radius: 6, padding: 5 },
            { selector: TRIP_FRAME, radius: 8, padding: 4 },
          ]
        : [{ selector: TRIP_FRAME, label: "Click to select", radius: 8 }],
    completes: (e) => e.type === "style-changed",
    done: "The card updated right away. Those are your app's real styles, so the code can follow.",
    holdMs: 2200,
  },
  {
    id: "iterate",
    eyebrow: "On the canvas",
    title: "Iterate with AI",
    body: "Every frame here is a real piece of your app. Select one and ask the agent for new directions; the variations land right next to it.",
    explain: (ctx) =>
      generating(ctx) || ctx.variantsSettled
        ? {
            eyebrow: "The agent at work",
            title: ctx.variantsSettled ? "Four directions, ready to compare" : "Building four directions, live",
            body: "The agent copied your trip card four times and is restyling all four at once, each in its own direction: layout, typography, color and style. They're real frames made from your app's code, so any of them can be built straight into the app.",
          }
        : null,
    tryIt: (ctx) =>
      generating(ctx)
        ? `Watch the copies change as the agent works: ${ctx.variantsDone} of ${ctx.variantsTotal} ready.`
        : ctx.agentSent
          ? "The agent is reading your card and planning the variations…"
          : ctx.agentOpen
            ? "The prompt is ready for you. Press Explore to send it."
            : ctx.selection.includes(TRIP_ID)
              ? "Click the green star next to the card to open the agent."
              : "Click the trip card to select it.",
    targets: (ctx) =>
      generating(ctx) || ctx.variantsSettled
        ? [{ selector: VARIANT_FRAMES, all: true, label: ctx.variantsSettled ? "Your four new directions" : "Built live by the agent", radius: 8, padding: 8 }]
        : ctx.agentSent
          ? []
          : ctx.agentOpen
            ? [{ selector: AGENT_COMPOSER, label: "Press Explore", labelAlign: "start", radius: 22 }]
            : ctx.selection.includes(TRIP_ID)
              ? [
                  { selector: AGENT_BUTTON, label: "Open the agent", radius: 999, padding: 5 },
                  { selector: TRIP_FRAME, radius: 8, padding: 4 },
                ]
              : [{ selector: TRIP_FRAME, label: "Click to select", radius: 8 }],
    completes: (e) => e.type === "variants-progress" && e.settled,
    done: "All four are on the canvas. Next, add a real component to your favourite.",
    continueLabel: "Next: add a component",
  },
  {
    id: "components",
    eyebrow: "On the canvas",
    title: "Use your real components",
    body: "The library holds your design system's actual components, not drawings of them. Drop one into a variant and it ships with it when you build.",
    // The variants, clear of the library that opens on the left.
    focus: "variants",
    tryIt: () => "Open Components in the left rail, then drag the Badge onto your favourite variant.",
    targets: (ctx) => [
      { selector: LIBRARY_BADGE, label: "Drag onto a variant", radius: 8, padding: 4 },
      { selector: COMPONENTS_RAIL, label: "Open Components", unless: LIBRARY_BADGE, radius: 8, padding: 3 },
      ctx.variantsTotal > 0
        ? { selector: VARIANT_FRAMES, all: true, radius: 8, padding: 8 }
        : { selector: TRIP_FRAME, radius: 8 },
    ],
    dragHint: (ctx) => ({ from: LIBRARY_BADGE, to: ctx.variantsTotal > 0 ? VARIANT_FRAMES : TRIP_FRAME }),
    completes: (e) => e.type === "component-added",
    done: "That Badge is the real <Badge> from your codebase, and it goes wherever this variant goes.",
    holdMs: 2000,
  },
  {
    id: "into-build-mode",
    eyebrow: "Canvas → Build mode",
    title: "Bring a variant into your app",
    body: "The Codebase frame is your app, running live. Drop a variant onto it and Build mode opens with that design attached, ready to build.",
    focus: "overview",
    tryIt: (ctx) =>
      ctx.dragging
        ? "Let go over the Codebase frame."
        : ctx.variantsTotal > 0
          ? "Drag your favourite variant onto the Codebase frame."
          : "Drag the trip card onto the Codebase frame.",
    targets: dragTargets,
    dragHint: (ctx) => (ctx.dragging ? null : { from: dragSource(ctx), to: CODEBASE_FRAME }),
    completes: (e) => e.type === "portal-opened" && e.attached.length > 0,
    milestone: true,
    done: "You're in Build mode: the same app, running live.",
    holdMs: 1100,
  },
  {
    id: "build",
    eyebrow: "Build mode",
    title: "Build it",
    body: "The agent turns the attached variant into code, and the card in the app updates in place.",
    intro: [
      {
        eyebrow: "Build mode · 1 of 3",
        title: "This is your app, live",
        body: "Build mode runs your real codebase. The preview on the left is the app itself, not a picture of it: scroll it, click it, it all works. Changes land here as soon as they're built.",
        target: { selector: PORTAL_PREVIEW, label: "Your live app", radius: 8, padding: 0 },
        next: "Next: the agent",
      },
      {
        eyebrow: "Build mode · 2 of 3",
        title: "Your agent works here",
        body: "This chat is an agent that knows your whole codebase. The variant you dropped is attached to it as a chip, so it knows exactly which design you mean.",
        target: { selector: PORTAL_CHAT, radius: 0, padding: 0 },
        next: "Next: the prompt",
      },
      {
        eyebrow: "Build mode · 3 of 3",
        title: "Prompts can be short",
        body: "The attached design carries the detail, so a sentence is enough. We're writing this one for you; next time it's yours.",
        target: { selector: PORTAL_COMPOSER, label: "Your prompt", labelAlign: "start", radius: 14, padding: 3 },
        next: "Got it",
        typesPrompt: true,
      },
    ],
    prompt: PORTAL_BUILD_VARIANT_PROMPT,
    tryIt: (ctx) =>
      !ctx.portalOpen
        ? "Drag a variant onto the Codebase frame to open Build mode."
        : ctx.portalSent
          ? "The agent is building it. Watch the trip card in the app."
          : "Press Send, then watch the trip card in the app change.",
    targets: (ctx) =>
      !ctx.portalOpen
        ? dragTargets(ctx)
        : ctx.portalSent
          ? [
              // The trip card itself while it's rebuilt; the whole preview if it can't be found.
              { selector: PORTAL_TRIP_CARD, label: "Watch the trip card", radius: 8, padding: 6 },
              { selector: PORTAL_PREVIEW, label: "Watch the trip card", unless: PORTAL_TRIP_CARD, radius: 8, padding: 0 },
            ]
          : [
              { selector: PORTAL_SEND, label: "Send to build", labelAlign: "end", radius: 999, padding: 5 },
              { selector: ATTACHED_FRAME, radius: 9, padding: 3 },
            ],
    completes: (e) => e.type === "frames-built",
    milestone: true,
    done: "Built. The trip card in your app now uses your variant, Badge included.",
    holdMs: 3400,
  },
  {
    id: "capture",
    eyebrow: "Build mode",
    title: "Capture back to the canvas",
    body: "Build mode works both ways: capture any part of the live app and it lands on your canvas as a frame, ready to design on.",
    tryIt: (ctx) =>
      ctx.portalOpen
        ? "Click the capture button at the top, then click anything in the app."
        : "Double-click the Codebase frame to open Build mode.",
    targets: (ctx) =>
      ctx.portalOpen
        ? [
            { selector: CAPTURE_BUTTON, label: "Capture to canvas", radius: 8, padding: 4 },
            { selector: PORTAL_PREVIEW, label: "Click anything to capture it", unless: CAPTURE_BUTTON, radius: 8, padding: 0 },
          ]
        : [OPEN_BUILD_MODE],
    completes: (e) => e.type === "captured",
    done: "Captured. It's waiting on your canvas, right of the app.",
  },
  {
    id: "back",
    eyebrow: "Build mode → Canvas",
    title: "Back to the canvas",
    body: "Build mode is just one layer deep. You can always step back out, with this button or Esc.",
    tryIt: () => "Click Back to Canvas at the top left.",
    targets: () => [{ selector: BACK_TO_CANVAS, label: "Back to the canvas", radius: 8, padding: 4 }],
    completes: (e) => e.type === "portal-closed",
    alreadyDone: (ctx) => !ctx.portalOpen,
    done: "Back on the canvas. Here's what you captured: a frame, ready to design on.",
    // The capture gets a moment in the spotlight before the next step.
    doneFocus: "captures",
    doneTargets: () => [{ selector: CAPTURED_FRAMES, all: true, label: "Your capture", radius: 6, padding: 8 }],
    holdMs: 2800,
  },
  {
    id: "share",
    eyebrow: "Ship it",
    title: "Share it",
    body: "Send a live prototype in one click: anyone with the link sees the app with your changes, running.",
    tryIt: () => "Click Share, then Create Preview Link.",
    targets: () => [
      // Once the Share popover is open, point at its Create Preview Link button.
      { selector: SHARE_CREATE, label: "Create a preview link", radius: 8, padding: 4 },
      { selector: SHARE_BUTTON, label: "Share a live preview", unless: SHARE_CREATE, radius: 9, padding: 4 },
    ],
    // Only publishing the link completes the step: opening the popover alone isn't sharing yet.
    completeOnClick: SHARE_CREATE,
    // The popover stays open on its published state while the done message shows.
    doneTargets: () => [{ selector: SHARE_POPOVER, label: "Your live preview", radius: 12, padding: 4 }],
    done: "Your preview is live. Engineers can also get the same change as a pull request on GitHub.",
    continueLabel: "Finish the tour",
    offer: { label: "Explore GitHub sync", to: "github-create" },
  },

  /* ----------------------------- Bonus: GitHub ----------------------------- */

  {
    id: "github-create",
    optional: true,
    eyebrow: "Bonus · GitHub",
    title: "Connect a repository",
    body: "A canvas can sync to GitHub. Create a repository for this project: your changes go there as a branch and a pull request.",
    tryIt: () => "Click the GitHub button at the top right, then press Create.",
    targets: () => [
      { selector: GITHUB_CREATE_DIALOG, label: "Name it and press Create", radius: 16, padding: 4 },
      { selector: GITHUB_BUTTON, label: "Open GitHub", unless: GITHUB_CREATE_DIALOG, radius: 9, padding: 4 },
    ],
    completes: (e) => e.type === "github" && e.stage === "created",
    done: "Repository created and linked to this canvas.",
  },
  {
    id: "github-sync",
    optional: true,
    eyebrow: "Bonus · GitHub",
    title: "Sync your changes",
    body: "Syncing pushes everything you built here to a new branch and opens a pull request, with the context a reviewer needs.",
    tryIt: () => "Open GitHub again and press Sync to Github.",
    targets: () => [
      { selector: GITHUB_SYNC_POPOVER, label: "Press Sync to Github", radius: 12, padding: 4 },
      { selector: GITHUB_BUTTON, label: "Open GitHub Sync", unless: GITHUB_SYNC_POPOVER, radius: 9, padding: 4 },
    ],
    completes: (e) => e.type === "github" && e.stage === "synced",
    done: "Synced. Your changes are on a new branch, with a pull request ready for your engineers to review.",
    holdMs: 2400,
  },
]
