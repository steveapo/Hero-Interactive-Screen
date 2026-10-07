/**
 * The Build Agent's script for the hero demo. Nothing here is generated: every reply, every
 * variant and every edit the agent makes on the canvas is defined below, so a recorded take
 * replays identically.
 *
 * How a chat is picked: when the Build Agent is opened on a selection, the chat whose `elements`
 * match the selection exactly is used; otherwise the first chat not used yet (in this order).
 * The nth message the user sends in that chat gets the chat's nth turn.
 */

/* ---------------------------------- Chats ---------------------------------- */

export type AgentTurn = {
  /** What the agent answers (streamed in word by word). */
  reply: string
  /** How long the agent "thinks" before the reply starts (ms). */
  thinkMs?: number
  /** After replying, generate the variants of every selected element that has some (see EVENT_SOURCES). */
  generate?: boolean
  /** Sent once the generation (or the frame build) is done. */
  summary?: string
  /**
   * After replying, build the selected frames as designed on the canvas (the library components
   * dropped into them) into the codebase: they show up on the same cards in the live app.
   */
  buildFrame?: boolean
}

export type AgentChat = {
  /** App element ids this chat belongs to (the selection, in any order). */
  elements?: string[]
  /**
   * Only start this chat when its first message is exactly this (so two stories can share a
   * selection). Chats with a prompt are never picked as a fallback.
   */
  prompt?: string
  turns: AgentTurn[]
}

export const AGENT_CHATS: AgentChat[] = [
  {
    elements: ["search-button"],
    turns: [
      {
        reply:
          "It's the only solid Rausch shape in the header: a #8e4585 disc beside grey and ink field labels, so it reads as the one action at a glance. Taking the magnifier from 1.1cqw to 1cqw lets the disc breathe without losing that.",
      },
      {
        reply:
          "Yes. The logo on the left is the same Rausch, so with the lighter glyph the header balances end to end. I'd keep the 2.8cqw disc; it sits exactly inside the pill's 4cqw height with 0.6cqw to spare.",
      },
    ],
  },
  {
    elements: ["categories"],
    turns: [
      {
        reply:
          "The categories are spread with justify-between, so the gaps stretch to whatever the Filters button leaves. At 1440 that's about 4.6cqw, wider than the 2cqw grid gap below, so the row reads looser than the cards. A fixed 3.2cqw gap tightens it into one rhythm.",
      },
      {
        reply:
          "Agreed. I'd also lift the active underline from 0.6cqw to 0.4cqw off the bottom so it sits closer to its label, the way the header's divider sits to the pill. That's the last of the spacing drift.",
      },
    ],
  },
  {
    elements: ["card-upcoming-trip"],
    turns: [
      {
        reply:
          "On it. I'll explore four directions for the trip card (layout, typography, color and style) right below the original, two at a time.",
        generate: true,
        summary:
          "4 variants are on the canvas. Playful-pop keeps the nights numeral the hero, and neo-industrial is the boldest take. Pick one and I'll build it into the codebase.",
      },
    ],
  },
  {
    // The library-component story (hero-demo.tsx): build the designed frame back into code.
    elements: ["card-upcoming-trip"],
    prompt: "Build this frame into the codebase",
    turns: [
      {
        reply:
          "On it. The badge is your design system's Badge, so I'll use the component itself rather than copying its styles, with the label, variant, size and placement from the frame.",
        buildFrame: true,
        summary:
          "Done. The Vernazza Sea House trip card in the live app now renders <Badge> from @/components/ui/badge, exactly where you placed it. It's display-only for now; open Build Mode to make it do something.",
      },
    ],
  },
]

/* ------------------------------- Build a frame ------------------------------ */

/** A frame build: how long the agent "builds" between its reply and its summary (ms). */
export const BUILD_FRAME_MS = 2600

/** Reply for anything the script doesn't cover. */
export const FALLBACK_REPLY = "It pseudoworks!"

/* ------------------------------ Portal Agent ------------------------------- */

/**
 * The Portal Agent's replies (the chat beside the live app). A message gets the turn whose
 * `prompt` it matches exactly; otherwise the next turn without a prompt, in order. A turn can
 * apply a change to the live preview (`applies`: a token matched by a `[data-portal-applied~="…"]`
 * rule in globals.css, or read by the preview itself, e.g. "badge-check-in").
 */
export type PortalTurn = {
  /** Only used for a message that is exactly this. */
  prompt?: string
  reply: string
  /** A fresh chat ("New agent") is renamed to this after the first reply. */
  title?: string
  thinkMs?: number
  workedFor: string
  added: number
  removed: number
  applies?: string
  /** The agent ran the test suite: what's shown under the reply. */
  tests?: { file: string; names: string[]; passed: number }
}

export const PORTAL_TURNS: PortalTurn[] = [
  {
    prompt: "Make the search button pulse so it's easy to spot",
    title: "Pulsing Search Button",
    reply:
      "Done. The Rausch search button in the header now pulses with a soft ring, so the one action on the page is easy to find at a glance. It's a small CSS animation on the button in fairbnb-screen.tsx; take a look on the left.",
    workedFor: "Worked for 12 seconds",
    added: 14,
    removed: 1,
    applies: "search-pulse",
  },
  // The library-component story (hero-demo.tsx): functionality for the built badge, then tests.
  {
    prompt: "Tapping the Check in badge should check me in to the stay",
    title: "Check In Badge Checks In",
    reply:
      "Done. The Check in badge on the Vernazza Sea House card is now a button: tapping it checks you in (the card fades back and the badge flips to Checked in), and tapping again undoes it. The state lives in fairbnb-screen.tsx and is kept per trip. Give it a tap on the left.",
    workedFor: "Worked for 18 seconds",
    added: 27,
    removed: 3,
    applies: "badge-check-in",
  },
  {
    prompt: "Add a test for it and run the suite",
    reply:
      "Added trip-check-in.test.tsx: it taps the badge, checks the trip is marked checked in, taps again to undo, and makes sure other trips aren't affected. Then I ran the whole suite.",
    workedFor: "Worked for 25 seconds",
    added: 41,
    removed: 0,
    tests: {
      file: "trip-check-in.test.tsx",
      names: ["checks in to Vernazza Sea House when the badge is tapped", "tapping again undoes it", "keeps other trips untouched"],
      passed: 24,
    },
  },
]

export const PORTAL_FALLBACK: PortalTurn = {
  reply: "On it. That one isn't scripted yet, so nothing changed in the app.",
  workedFor: "Worked for 2 seconds",
  added: 0,
  removed: 0,
}

/* ----------------------------- Build into code ----------------------------- */

/** A variant as the build messages need it. */
type BuiltVariantInfo = { name: string; source: { name: string; title: string }; spec: { label: string } }
type BuiltChangeInfo = { path: string; added: number; removed: number }

/**
 * "Choose where to build" → pick a variant: what's said while the Build Agent builds it into the
 * codebase (where it replaces its source in the live app).
 */
export const BUILD_SCRIPT = {
  thinkMs: 900,
  /** How long the agent "builds" between its two messages. */
  buildMs: 2600,
  /** Sent as the user's message when a variant is picked. */
  request: (v: BuiltVariantInfo) => `Build “${v.spec.label}” into the ${v.source.title} card`,
  start: (v: BuiltVariantInfo) =>
    `Building ${v.spec.label} into the ${v.source.title} card. Same data and spacing; only its styles change.`,
  done: (v: BuiltVariantInfo, change: BuiltChangeInfo) =>
    `Done. ${v.source.title} in the live app now uses ${v.spec.label} (+${change.added} −${change.removed} in ${change.path.split("/").pop()}). Open the Portal to see it.`,
}

/** File the built variant's styles land in (shown in Code changes). */
export const BUILT_FILE_PATH = "src/app/copy-project/trip-card-styles.ts"

/* ------------------------------- Pull request ------------------------------ */

/**
 * The pull request "Sync to Github" opens (shown in the sync popover and the PR sheet). Merging
 * it ends the story: the canvas closes.
 */
export type PullRequest = {
  number: number
  title: string
  /** Appended to the repo name for the branch, e.g. modeinspect/hero-fairbnb-variants. */
  branchSuffix: string
  description: string
  commits: number
}

export const PULL_REQUEST: PullRequest = {
  number: 12,
  title: "Restyled trip card and a pulsing search button",
  /** Appended to the repo name for the branch, e.g. modeinspect/hero-fairbnb-variants. */
  branchSuffix: "variants",
  // Neutral about which variant: the visitor may pick any of the four in the demo.
  description:
    "Builds the trip card variant picked on the canvas into the home page and makes the search button pulse so it's easy to spot.",
  commits: 3,
}

/** The pull request of the library-component story: used once a frame has been built into code. */
export const COMPONENT_PULL_REQUEST: PullRequest = {
  number: 12,
  title: "Check in badge on the trip card, tap to check in",
  branchSuffix: "check-in-badge",
  description:
    "Adds the design system's Badge to the Vernazza Sea House trip card as designed on the canvas, makes tapping it check in to the stay, and covers it with trip-check-in.test.tsx.",
  commits: 3,
}

/* --------------------------------- Variants -------------------------------- */

/**
 * A text card (the trip card), split into the pieces the agent edits one at a time. Each piece is
 * a full class list (no merging), authored in cqw of the desktop screen like the live app.
 */
export type EventCardStyle = {
  /** The card itself: fill, radius, shadow, border, padding and how its two blocks are laid out. */
  card: string
  /** Title + subtitle lines block. */
  header: string
  title: string
  lines: string
  /** Numeral block: the number and its unit. */
  duration: string
  number: string
  unit: string
  /** Unit text (default "MIN"). */
  unitText?: string
}

/** What the agent edits in one step. card → card; title → header + title; lines → lines; duration → duration + number + unit. */
export type VariantPart = "card" | "title" | "lines" | "duration"

export type VariantSpec = {
  /** e.g. "layout: editorial": shown after the source's name. */
  label: string
  /**
   * Structural change: the agent clears the card's content first and rebuilds it piece by
   * piece. Otherwise it restyles the existing pieces in place.
   */
  rebuild?: boolean
  /** The pieces the agent edits, in order. */
  parts: VariantPart[]
  /** The finished variant's style; pieces not listed keep the source's. */
  style: Partial<EventCardStyle>
}

export type EventSource = {
  /** App element id. */
  elementId: string
  /** Frame name, used for the variants' names. */
  name: string
  title: string
  lines: string[]
  /** The card's numeral (the trip's nights). */
  duration: number
  /** The card exactly as the live app paints it. */
  base: EventCardStyle
  variants: VariantSpec[]
}

/** The trip card exactly as TripCard in airbnb-screen.tsx paints it. */
const TRIP_CARD_BASE: EventCardStyle = {
  card: "flex flex-col justify-between rounded-[1cqw] border border-[#ebebeb] bg-white p-[1.6cqw] shadow-[0_0.3cqw_1.2cqw_rgba(0,0,0,0.08)]",
  header: "leading-[1.35]",
  title: "text-[1.6cqw] font-semibold tracking-tight text-[#222222]",
  lines: "text-[1.05cqw] font-medium tracking-tight text-[#6a6a6a]",
  duration: "flex items-end gap-[0.5cqw] text-[#222222]",
  number: "text-[4.6cqw] font-semibold leading-[0.82] tracking-[-0.05em]",
  unit: "pb-[0.25cqw] text-[0.8cqw] font-bold tracking-[0.08em] text-[#8e4585]",
  unitText: "NIGHTS",
}

/** Elements the agent can generate variants for, in the order their rows are laid out. */
export const EVENT_SOURCES: EventSource[] = [
  {
    elementId: "card-upcoming-trip",
    name: "Trip — Vernazza Sea House",
    title: "Vernazza Sea House",
    lines: ["Cinque Terre, Italy", "Jun 12 – 15"],
    duration: 3,
    base: TRIP_CARD_BASE,
    variants: [
      {
        label: "layout: editorial",
        rebuild: true,
        parts: ["card", "duration", "title", "lines"],
        style: {
          card: "flex flex-row-reverse items-end justify-between gap-[1.2cqw] rounded-[1cqw] border border-[#ebebeb] bg-white p-[1.8cqw] shadow-[0_0.3cqw_1.2cqw_rgba(0,0,0,0.08)]",
          header: "min-w-[45%] border-t border-black/10 pt-[0.6cqw] text-right leading-[1.35]",
          lines: "text-[1cqw] font-medium tracking-tight text-black/45",
          duration: "flex flex-col items-start gap-[0.4cqw] text-[#222222]",
          number: "text-[6.8cqw] font-semibold leading-[0.8] tracking-[-0.06em]",
          unit: "text-[0.75cqw] font-bold tracking-[0.2em] text-black/40",
        },
      },
      {
        label: "typography: playful-pop",
        parts: ["title", "lines", "duration"],
        style: {
          header: "leading-[1.1]",
          title: "text-[2.35cqw] font-black leading-[0.95] tracking-[-0.045em] text-[#222222]",
          lines: "mt-[0.4cqw] text-[1.1cqw] font-semibold tracking-tight text-black/45",
          duration: "flex items-end gap-[0.5cqw] text-[#222222]",
          number: "text-[4.6cqw] font-black leading-[0.8] tracking-[-0.06em]",
          unit: "mb-[0.25cqw] rounded-full bg-[#8e4585] px-[0.55cqw] py-[0.2cqw] text-[0.75cqw] font-black text-white",
        },
      },
      {
        label: "color: plum-glow",
        parts: ["card", "title", "lines", "duration"],
        style: {
          card: "flex flex-col justify-between rounded-[1cqw] bg-[linear-gradient(150deg,#8e4585_0%,#7d3a75_55%,#5e2a58_100%)] p-[1.6cqw] shadow-[0_0.5cqw_1.5cqw_-0.25cqw_rgba(125,58,117,0.5)]",
          title: "text-[1.6cqw] font-semibold tracking-tight text-white",
          lines: "text-[1.05cqw] font-medium tracking-tight text-white/70",
          duration: "flex items-end gap-[0.5cqw] text-white",
          unit: "pb-[0.25cqw] text-[0.8cqw] font-bold tracking-[0.08em] text-white/80",
        },
      },
      {
        label: "style: neo-industrial",
        rebuild: true,
        parts: ["card", "title", "lines", "duration"],
        style: {
          card: "flex flex-col justify-between rounded-none bg-[#111110] p-[1.6cqw] shadow-[0.5cqw_0.5cqw_0_#8e4585]",
          header: "leading-[1.2]",
          title: "font-mono text-[1.35cqw] font-bold uppercase tracking-[0.04em] text-[#8e4585]",
          lines: "font-mono text-[0.85cqw] uppercase tracking-[0.08em] text-white/45",
          duration: "flex items-end justify-between border-t border-white/15 pt-[0.6cqw] text-white",
          number: "font-mono text-[4cqw] font-bold leading-[0.8] tracking-[-0.04em]",
          unit: "font-mono text-[0.8cqw] font-bold tracking-[0.12em] text-[#8e4585]",
        },
      },
    ],
  },
]
