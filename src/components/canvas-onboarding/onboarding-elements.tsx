import {
  AppWindow,
  ArrowRight,
  Camera,
  Code,
  Component,
  MousePointerClick,
  Rocket,
  Share2,
  type LucideIcon,
} from "lucide-react"
import type { AppElement } from "@/components/hero-screen/airbnb-elements"
import { OrderSummary } from "@/components/ui/order-summary"
import {
  CaptureScene,
  ComponentsScene,
  ConnectScene,
  EditScene,
  LiveAppScene,
  ShareScene,
  ShipScene,
  Stage,
  STAGE_WIDTH,
  TryMeSticker,
} from "./step-illustrations"

/**
 * The canvas-only onboarding's pieces: the step cards (and the order summary to edit, and two
 * stickers), designed at real size: 24px standard text, nothing under 18px.
 *
 * They're used twice, from this one source:
 * - on the canvas simulation (ONBOARDING_ELEMENTS): each piece is a regular element frame (it can be
 *   selected, moved, resized, refilled and renamed), shown at CANVAS_SCALE (step cards 2000 wide)
 *   beside the 1440-wide Codebase frame;
 * - on the capture pages (/onboarding/steps/…, CAPTURE_PIECES): one piece per page, at real size,
 *   to capture onto the project's canvas.
 *
 * Canvas positions are top-left corners in canvas units, relative to the Codebase frame's centre (it
 * spans x −720…720, y −450…450). The steps read top to bottom in a column left of the Codebase
 * frame, with the Build mode step right beside it.
 */

/** Real-size width of a step card (px): the illustration panel's width. */
const CARD_WIDTH = STAGE_WIDTH
const CARD_FILL = "#ffffff"
const CARD_BORDER = "#e7e5e4"
const CARD_RADIUS = 36
/** The canvas simulation shows the real-size pieces this much larger (1500-wide cards → 2000). */
const CANVAS_SCALE = 4 / 3
/** Left edge of the steps' column on the canvas (canvas units). */
const COLUMN_LEFT = -2900
/** Modeinspect's neon (mi-lime) and the dark ink set on it (mi-lime-ink), from the theme. */
const ACCENT = "#c2ec66"
const ACCENT_INK = "#16210a"
/** Text colours: titles (stone-950), body (stone-600), secondary (stone-500). */
const INK = "#0c0a09"
const BODY = "#57534e"
const MUTED = "#78716c"

/** A frame placed by its top-left corner (canvas units), as a centre-based rect. */
function at(left: number, top: number, w: number, h: number) {
  return { x: left + w / 2, y: top + h / 2, w, h }
}

/* ------------------------------- Inline pieces ------------------------------- */

/** A piece of UI named in the copy (a button, a frame, a mention), set as a neon chip. */
function Ui({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.75 inline-block whitespace-nowrap rounded-[9px] border border-mi-lime-deep bg-mi-lime px-2.25 font-semibold leading-9 text-mi-lime-ink">
      {children}
    </span>
  )
}

/** A keyboard key named in the copy. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.75 inline-block whitespace-nowrap rounded-[9px] border border-b-[4.5px] border-mi-lime-deep bg-white px-2.25 font-mono text-[21px] font-semibold leading-9 text-mi-lime-ink">
      {children}
    </kbd>
  )
}

/** The one thing to do in a step: a neon-edged callout, set apart from the explanation. */
function TryIt({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10.5 flex flex-col gap-3.75 rounded-[24px] border border-mi-lime-deep bg-[#f6fbe9] p-7.5">
      <span className="flex items-center gap-3 text-[18px] font-semibold uppercase tracking-[0.14em] text-mi-lime-ink">
        <span className="flex size-9 items-center justify-center rounded-full bg-mi-lime">
          <MousePointerClick className="size-5.25" strokeWidth={2.25} />
        </span>
        Try it
      </span>
      <p className="text-[24px] font-medium leading-[1.6] text-pretty" style={{ color: ACCENT_INK }}>
        {children}
      </p>
    </div>
  )
}

/* -------------------------------- Step card -------------------------------- */

type Step = {
  /** Step number, shown in the badge. */
  n: number
  /** Chapter label next to the badge. */
  kicker: string
  icon: LucideIcon
  /** The step's illustration (a scene from step-illustrations), across the top of the card. */
  scene: React.ReactNode
  title: string
  /** Paragraphs of explanation. */
  body: React.ReactNode[]
  /** The one thing to do. */
  tryIt?: React.ReactNode
  /** A short aside after the action. */
  note?: React.ReactNode
  /** A call to action closing the step. */
  cta?: React.ReactNode
}

/**
 * A step card at real size (CARD_WIDTH wide, its height hugs its content): illustration, then the
 * step's badge and chapter (18px), title (54px), body (24px), Try it (24px), note (21px).
 */
function StepCard({ n, kicker, icon: Icon, scene, title, body, tryIt, note, cta }: Step) {
  return (
    <div className="flex flex-col" style={{ width: CARD_WIDTH, color: INK }}>
      <Stage>{scene}</Stage>
      <div className="flex flex-col p-18">
        <header className="flex h-12 shrink-0 items-center gap-4.5">
          <span className="flex size-12 items-center justify-center rounded-full bg-mi-lime text-[21px] font-bold tabular-nums text-mi-lime-ink ring-1 ring-mi-lime-deep">
            {n}
          </span>
          <span className="text-[18px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
            {kicker}
          </span>
          <Icon className="ml-auto size-9 text-stone-300" strokeWidth={1.5} />
        </header>
        <h2 className="mt-9 text-[54px] font-semibold leading-[1.15] tracking-[-0.03em] text-balance">{title}</h2>
        <div className="mt-4.5 flex max-w-[960px] flex-col gap-4.5 text-[24px] leading-[1.6] text-pretty" style={{ color: BODY }}>
          {body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
        {tryIt && <TryIt>{tryIt}</TryIt>}
        {note && (
          <p className="mt-6 text-[21px] leading-[1.55]" style={{ color: MUTED }}>
            {note}
          </p>
        )}
        {cta}
      </div>
    </div>
  )
}

/* ------------------------------ Other artwork ------------------------------ */

/** Real size of the order summary card (px). */
const ORDER_SIZE = { w: 534, h: 720 }

/** The order summary from the demo store: its checkout button is the step's padding layer. */
function OrderSummaryCard() {
  // data-anim="block": the painted card takes the pointer in its bare frame (see DesignFrame).
  // The checkout button (data-layer="checkout-button") reads the frame's --layer-padding-x / -y.
  return <OrderSummary data-anim="block" />
}

/** Real size of the "double click me" hint (px). */
const HINT_SIZE = { w: 120, h: 450 }

/** The vertical "double click me" hint by the Codebase frame (reads bottom to top). */
function DoubleClickHint() {
  return (
    <div className="flex items-center justify-center" style={{ width: HINT_SIZE.w, height: HINT_SIZE.h }}>
      <span
        className="rotate-180 font-mono text-[54px] font-bold lowercase leading-[1.12] tracking-[0.12em] [font-variant:small-caps] [writing-mode:vertical-rl]"
        style={{ color: "#3f3f46" }}
      >
        double click me
      </span>
    </div>
  )
}

/** Real size of the "Try me" sticker (px). */
const STICKER_SIZE = { w: 420, h: 195 }

/** The last step's call to action: connect your own project. */
function ConnectCodebaseButton() {
  return (
    <div className="mt-10.5 flex">
      <span className="flex items-center gap-4.5 rounded-full bg-stone-950 py-3.75 pl-9 pr-3.75 text-[24px] font-semibold text-white shadow-[0_24px_48px_-24px_rgba(12,10,9,0.6)]">
        Connect your codebase
        <ArrowRight className="size-12 rounded-full bg-mi-lime p-2.25 text-mi-lime-ink" strokeWidth={2.5} />
      </span>
    </div>
  )
}

/* -------------------------------- The steps -------------------------------- */

/**
 * The steps, with their real-size heights (px): the canvas frames need a fixed size, so each is
 * a little taller than its content (which hugs on the capture pages).
 */
const STEPS: { id: string; slug: string; name: string; height: number; step: Step }[] = [
  {
    id: "onboarding-start-here",
    slug: "1-start-here",
    name: "1 · Start here",
    height: 1290,
    step: {
      n: 1,
      kicker: "Edit on canvas",
      icon: MousePointerClick,
      scene: <EditScene />,
      title: "Start here",
      body: ["This is a real screen from a real codebase. No ticket required."],
      tryIt: (
        <>
          Select the <Ui>Continue to shipping</Ui> button on the order summary, then set its vertical padding to 16.
        </>
      ),
    },
  },
  {
    id: "onboarding-canvas-to-code",
    slug: "2-canvas-to-code",
    name: "2 · Canvas to code",
    height: 1350,
    step: {
      n: 2,
      kicker: "Ship to code",
      icon: Code,
      scene: <ShipScene />,
      title: "Canvas to code in one shot",
      body: ["Now push your edit back to code. The agent rebuilds it 1:1 with your components."],
      tryIt: (
        <>
          Drag the <Ui>Order summary</Ui> frame onto the <Ui>Codebase</Ui>, then hit <Kbd>Enter</Kbd>.
        </>
      ),
      note: "Check the diff: it’s a few lines (roughly 400 fewer than the Slack thread).",
    },
  },
  {
    id: "onboarding-portal-intro",
    slug: "3-your-real-product",
    name: "3 · Your real product",
    height: 1335,
    step: {
      n: 3,
      kicker: "Build mode",
      icon: AppWindow,
      scene: <LiveAppScene />,
      title: "Your real product, running.",
      body: [
        "Well done. Every canvas is connected to your real app, running live in a sandbox. Use it to change things directly in code, capture to canvas and test in a real environment.",
      ],
      tryIt: (
        <>
          Double-click the <Ui>Codebase</Ui> frame to open Build mode.
        </>
      ),
    },
  },
  {
    id: "onboarding-code-to-canvas",
    slug: "4-code-to-canvas",
    name: "4 · Code to canvas",
    height: 1290,
    step: {
      n: 4,
      kicker: "Capture",
      icon: Camera,
      scene: <CaptureScene />,
      title: "Code to canvas",
      body: ["Any element of the running app can come back onto the canvas, pixel perfect and editable."],
      tryIt: (
        <>
          In Build mode, hit <Ui>Capture</Ui> and pick the order summary.
        </>
      ),
    },
  },
  {
    id: "onboarding-components",
    slug: "5-components",
    name: "5 · Components",
    height: 1395,
    step: {
      n: 5,
      kicker: "Design system",
      icon: Component,
      scene: <ComponentsScene />,
      title: "Components",
      body: ["Your components are parsed straight from the codebase. Drag them from the library, or mention them in Build chat."],
      tryIt: (
        <>
          Drag a <Ui>Button</Ui> onto the captured order summary, or type <Ui>@Button</Ui> in Build chat.
        </>
      ),
      note: "Build it back to code, again and again: you design engineer the real thing, in one place, in high fidelity.",
    },
  },
  {
    id: "onboarding-share",
    slug: "6-share",
    name: "6 · Share and collaborate",
    height: 1335,
    step: {
      n: 6,
      kicker: "Collaborate",
      icon: Share2,
      scene: <ShareScene />,
      title: "Share and collaborate",
      body: ["When ready, send the live link to an engineer, a PM, anyone. They open the real thing, not a localhost."],
      tryIt: (
        <>
          When you finally beat final_v4, hit <Ui>GitHub</Ui> and open a PR on this demo repo.
        </>
      ),
    },
  },
  {
    id: "onboarding-your-product",
    slug: "7-your-own-product",
    name: "7 · Your own product",
    height: 1245,
    step: {
      n: 7,
      kicker: "Your turn",
      icon: Rocket,
      scene: <ConnectScene />,
      title: "Now design engineer your own product.",
      body: [
        "Connect a vibe-coded project, a website or your product repo. Modeinspect reads your components, tokens and routes. Nothing ships without a PR your engineers review.",
      ],
      cta: <ConnectCodebaseButton />,
    },
  },
]

const stepById = (id: string) => STEPS.find((s) => s.id === id)!

/* ------------------------------ Capture pages ------------------------------ */

/** One piece per capture page: what it's called, its slug, and the piece at real size. */
export type CapturePiece = { slug: string; label: string; node: React.ReactNode }

/** A step card as a standalone frame: white, hairline border, soft corners, hugging its content. */
function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden bg-white" style={{ width: CARD_WIDTH, borderRadius: CARD_RADIUS, boxShadow: `inset 0 0 0 1px ${CARD_BORDER}` }}>
      {children}
    </div>
  )
}

export const CAPTURE_PIECES: CapturePiece[] = [
  ...STEPS.map(({ slug, name, step }) => ({
    slug,
    label: name,
    node: (
      <CardFrame>
        <StepCard {...step} />
      </CardFrame>
    ),
  })),
  {
    slug: "order-summary",
    label: "Order summary",
    node: (
      <div style={{ width: ORDER_SIZE.w, height: ORDER_SIZE.h }}>
        <OrderSummaryCard />
      </div>
    ),
  },
  { slug: "try-me", label: "Try me sticker", node: <TryMeSticker /> },
  { slug: "double-click", label: "Double click hint", node: <DoubleClickHint /> },
]

/* ------------------------------- Canvas frames ------------------------------- */

/** A real-size piece shown CANVAS_SCALE times larger, filling a frame of the scaled size. */
function Scaled({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  return (
    <div className="origin-top-left" style={{ width: w, height: h, transform: `scale(${CANVAS_SCALE})` }}>
      {children}
    </div>
  )
}

/** A step card frame in the steps' column (canvas units). */
function stepFrame(id: string, top: number): AppElement {
  const { name, height, step } = stepById(id)
  const rect = at(COLUMN_LEFT, top, CARD_WIDTH * CANVAS_SCALE, height * CANVAS_SCALE)
  return {
    id,
    name,
    rect,
    appRect: rect,
    fill: CARD_FILL,
    radius: CARD_RADIUS * CANVAS_SCALE,
    border: CARD_BORDER,
    layout: "column",
    padding: { top: 72, right: 72, bottom: 72, left: 72 },
    clip: true,
    colors: [CARD_FILL, CARD_BORDER, INK, BODY, MUTED, ACCENT, ACCENT_INK],
    content: (
      <Scaled w={CARD_WIDTH} h={height}>
        <StepCard {...step} />
      </Scaled>
    ),
  }
}

/** The step the canvas opens on. */
export const START_FRAME_ID = "onboarding-start-here"

/*
 * Tops of the steps on the canvas (canvas units), 200 apart; each is its real height × CANVAS_SCALE
 * tall. The Build mode step is centred on the Codebase frame; the others stack above and below it.
 */
const TOP = {
  start: -4810,
  canvasToCode: -2890,
  portal: -890,
  codeToCanvas: 1090,
  components: 3010,
  share: 5070,
  yourProduct: 7050,
}

export const ONBOARDING_ELEMENTS: AppElement[] = [
  stepFrame("onboarding-start-here", TOP.start),
  // The interactive step's card, right of the first step (at real size: it's the app's own card),
  // with its sticker below it.
  {
    id: "onboarding-order-summary",
    name: "Order summary",
    rect: at(-800, -4310, ORDER_SIZE.w, ORDER_SIZE.h),
    appRect: at(-800, -4310, ORDER_SIZE.w, ORDER_SIZE.h),
    fill: null,
    radius: null,
    border: null,
    bare: true,
    tag: "section",
    layout: "column",
    padding: { top: 36, right: 0, bottom: 36, left: 0 },
    colors: ["#ffffff", "#0a0a0a", "#737373"],
    paddingLayer: { id: "checkout-button", name: "Button", padding: { x: 24, y: 12 }, lineHeight: 30 },
    content: <OrderSummaryCard />,
  },
  {
    id: "onboarding-try-me",
    name: "Try me",
    rect: at(-800, -3540, STICKER_SIZE.w * CANVAS_SCALE, STICKER_SIZE.h * CANVAS_SCALE),
    appRect: at(-800, -3540, STICKER_SIZE.w * CANVAS_SCALE, STICKER_SIZE.h * CANVAS_SCALE),
    fill: null,
    radius: null,
    border: null,
    labelOnSelect: true,
    colors: [ACCENT, ACCENT_INK],
    content: (
      <Scaled w={STICKER_SIZE.w} h={STICKER_SIZE.h}>
        <TryMeSticker />
      </Scaled>
    ),
  },
  stepFrame("onboarding-canvas-to-code", TOP.canvasToCode),
  stepFrame("onboarding-portal-intro", TOP.portal),
  {
    id: "onboarding-double-click",
    name: "Double click me",
    rect: at(600, -1100, HINT_SIZE.w * CANVAS_SCALE, HINT_SIZE.h * CANVAS_SCALE),
    appRect: at(600, -1100, HINT_SIZE.w * CANVAS_SCALE, HINT_SIZE.h * CANVAS_SCALE),
    fill: null,
    radius: null,
    border: null,
    labelOnSelect: true,
    colors: ["#3f3f46"],
    content: (
      <Scaled w={HINT_SIZE.w} h={HINT_SIZE.h}>
        <DoubleClickHint />
      </Scaled>
    ),
  },
  stepFrame("onboarding-code-to-canvas", TOP.codeToCanvas),
  stepFrame("onboarding-components", TOP.components),
  stepFrame("onboarding-share", TOP.share),
  stepFrame("onboarding-your-product", TOP.yourProduct),
]
