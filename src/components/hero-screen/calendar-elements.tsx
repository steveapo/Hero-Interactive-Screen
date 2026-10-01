import {
  DAY_END,
  DAY_START,
  EventShape,
  formatLabel,
  GRID_LINES,
  NOW,
  toPct,
  weekBehind,
} from "@/app/copy-project/planner-screen"
import { MONDAY, type DayStamp, type PlannerEvent } from "@/app/copy-project/planner-days"
import { cn } from "@/lib/utils"
import { CODEBASE_HEIGHT, CODEBASE_WIDTH } from "./codebase-frame"
import type { CanvasRect } from "./drag"
import type { CssPosition, Insets, LayoutMode, Sides } from "./frame-settings-panel"

/**
 * The iPad Calendar taken apart: one static design frame per element of the live app in the
 * Codebase frame. Every size, fill, radius and border is derived from the planner's own units
 * (cqw of the 1024-wide iPad screen) and its Monday data, so the settings panel reads the real values.
 */

/** 1cqw of the iPad screen, in canvas units. */
const CQW = CODEBASE_WIDTH / 100
/** Body line-height (Tailwind preflight): the status bar's text row is this tall. */
const LINE_HEIGHT = 1.5

/** Heights of the planner's stacked bands, from their cqw paddings and contents. */
const STATUS_BAR_HEIGHT = (1.6 + 1.2 + 2 * LINE_HEIGHT) * CQW // pt + pb + one 2cqw text row
const SCRUBBER_HEIGHT = 4.6 * CQW
const TOOLBAR_HEIGHT = (3 + 4 + 11) * CQW // pt + pb + the 11cqw search button
/** The timeline takes whatever the bands leave of the screen. */
const TIMELINE_HEIGHT = CODEBASE_HEIGHT - STATUS_BAR_HEIGHT - SCRUBBER_HEIGHT - TOOLBAR_HEIGHT

/** Events sit between 7% from the left and 4.5% from the right of the timeline. */
const EVENT_AREA_WIDTH = CODEBASE_WIDTH * (1 - 0.07 - 0.045)
const PX_PER_MINUTE = TIMELINE_HEIGHT / (DAY_END - DAY_START)

/** Toolbar parts, from their cqw sizes. */
const SKIP_HEIGHT = 7.5 * CQW
const SKIP_WIDTH = (SKIP_HEIGHT * 43) / 28 // the arrow glyph's viewBox is 43 × 28
const ADD_SIZE = 7 * CQW
const SEARCH_SIZE = 11 * CQW
/** Day stamp height: the 13cqw numeral at 0.78 leading; widths hug the set glyphs. */
const DAY_STAMP_HEIGHT = 13 * CQW * 0.78

const TIMELINE_FILL = "#f1efec"
const WHITE = "#ffffff"

export type CalendarElement = {
  id: string
  name: string
  /** Position (centre, canvas units, relative to the Codebase frame's centre) and natural size. */
  rect: CanvasRect
  /** Fill colour; null = no fill. */
  fill: string | null
  /** Corner radius in canvas units; null = none. */
  radius: number | null
  /** 1px border colour; null = none. */
  border: string | null
  /** The artwork paints its own shape (a carved event): the frame itself stays transparent. */
  bare?: boolean
  /** Only show the frame's name on the canvas while it is selected. */
  labelOnSelect?: boolean
  /* What the settings panel reads — the element's CSS in the live app. */
  /** Tag of the element in the app (default "div"). */
  tag?: string
  /** CSS position (default static). */
  position?: CssPosition
  /** Insets of an absolutely positioned element. */
  inset?: Insets
  /** Flex row / column etc. (default freeform). */
  layout?: LayoutMode
  /** Padding in canvas px (default 0). */
  padding?: Sides
  /** overflow: hidden (default false). */
  clip?: boolean
  /** Every colour used inside the element (default its fill and border). */
  colors?: string[]
  /** Static artwork, authored in cqw of the iPad screen, at the frame's natural size. */
  content: React.ReactNode
}

/** Distinct colours, nulls dropped. */
function palette(...colors: (string | null)[]): string[] {
  return [...new Set(colors.filter((c): c is string => c !== null))]
}

/**
 * Every element's centre is pushed away from the Codebase frame's centre by this factor (sizes stay
 * the same), which widens the gaps to the Codebase and between the elements themselves.
 */
const LAYOUT_SPREAD = 1.25

/** A frame placed by its top-left corner (canvas units), which is how the layout below reads. */
function placed(left: number, top: number, w: number, h: number): CanvasRect {
  return { x: (left + w / 2) * LAYOUT_SPREAD, y: (top + h / 2) * LAYOUT_SPREAD, w, h }
}

/* --------------------------------- Layout --------------------------------- */
// Top-left corners in canvas units; the Codebase frame spans x −512…512, y −683…683.
// Status bar above the Codebase, background to its left, scrubber / toolbar / toolbar parts to
// its right, and the events scattered below it — Intentionality tucked into Explains' cutout.

const STATUS_BAR_AT = { left: -530, top: -962 }
const BACKGROUND_AT = { left: -1599, top: -568 }
const SCRUBBER_AT = { left: 668, top: -742 }
const TOOLBAR_AT = { left: 635, top: -535 }

const PARTS_AT = {
  dayPrevious: { left: 675, top: -178 },
  skipForward: { left: 918, top: -167 },
  skipBack: { left: 918, top: 27 },
  add: { left: 1457, top: -256 },
  search: { left: 1448, top: -62 },
}

/** Listed back to front: Intentionality sits over Explains' cutout, so it comes after it. */
const EVENTS_AT: { label: string; left: number; top: number }[] = [
  { label: "Core Rule", left: -1022, top: 1009 },
  { label: "Goals", left: -612, top: 724 },
  { label: "In General", left: -272, top: 837 },
  { label: "Explains", left: 463, top: 748 },
  { label: "Intentionality", left: 205, top: 837 },
  { label: "Living", left: 192, top: 1238 },
]

/* ------------------------------- Event boxes ------------------------------ */

/** "bg-[#585a44]" → "#585a44"; "bg-white" → "#ffffff". */
function hexFrom(className: string, prefix: "bg" | "border" | "text"): string | null {
  const match = className.match(new RegExp(`${prefix}-\\[(#[0-9a-fA-F]{6})\\]`))
  if (match) return match[1].toLowerCase()
  return className.split(" ").includes(`${prefix}-white`) ? WHITE : null
}

/**
 * The event exactly as the live screen paints it — carved around the blocks on a higher layer,
 * with the same concave corners. The frame is a window onto the day's event area, shifted so the
 * event's box sits at the frame's top-left.
 */
function EventArtwork({ event }: { event: PlannerEvent }) {
  return (
    <div
      className="absolute"
      style={{
        width: EVENT_AREA_WIDTH,
        height: TIMELINE_HEIGHT,
        left: -(event.left / 100) * EVENT_AREA_WIDTH,
        top: -(event.start - DAY_START) * PX_PER_MINUTE,
      }}
    >
      <EventShape event={event} events={MONDAY.events} order={0} />
    </div>
  )
}

/** An event block of the opening day, at its natural box size, placed by its top-left corner. */
function eventElement({ label, left, top }: { label: string; left: number; top: number }): CalendarElement {
  const event = MONDAY.events.find((e) => e.label === label)
  if (!event) throw new Error(`No Monday event called "${label}"`)
  const w = (event.width / 100) * EVENT_AREA_WIDTH
  const h = (event.end - event.start) * PX_PER_MINUTE
  const fill = hexFrom(event.background, "bg")
  const border = hexFrom(event.surface, "border")
  return {
    id: `event-${event.label.toLowerCase().replace(/\s+/g, "-")}`,
    name: `Event — ${event.label}`,
    rect: placed(left, top, w, h),
    fill,
    radius: parseFloat(event.radius) * CQW,
    border,
    bare: true,
    // the events sit a gap apart, so their names only show on selection
    labelOnSelect: true,
    // in the app each block is absolutely placed in the day's event area
    position: "absolute",
    inset: {
      left: (event.left / 100) * EVENT_AREA_WIDTH,
      top: (event.start - DAY_START) * PX_PER_MINUTE,
      right: null,
      bottom: null,
    },
    clip: true,
    colors: palette(fill, border, hexFrom(event.titleClass, "text"), hexFrom(event.numberClass, "text")),
    content: <EventArtwork event={event} />,
  }
}

/* ------------------------------ Screen bands ------------------------------ */

function StatusBarArtwork() {
  return (
    <div className="flex h-full items-center justify-between px-[3.5cqw] pb-[1.2cqw] pt-[1.6cqw] text-[2cqw] tracking-tight text-black">
      <div className="flex items-center gap-[1.6cqw]">
        <span className="font-semibold">9:41</span>
        <span className="font-medium">{MONDAY.date}</span>
      </div>
      <img src="/status.png" alt="" draggable={false} className="h-[1.8cqw] w-auto select-none" />
    </div>
  )
}

/** The timeline surface: half-hour rules, time labels and the current-time indicator. */
function BackgroundArtwork() {
  return (
    <>
      {GRID_LINES.map((minutes) => (
        <div key={minutes} className="absolute inset-x-0" style={{ top: `${toPct(minutes)}%` }}>
          <div className="absolute left-[7%] right-[2%] h-px bg-black/[8%]" />
          <span className="absolute left-[1.5%] -translate-y-1/2 text-[1.5cqw] font-medium tracking-tight text-black/35">
            {formatLabel(minutes)}
          </span>
        </div>
      ))}
      <div className="absolute inset-x-0 h-px bg-[#e4321b]" style={{ top: `${toPct(NOW)}%` }} />
      <div
        className="absolute left-[1.2%] -translate-y-1/2 rounded-[0.4cqw] bg-[#e4321b] px-[0.7cqw] py-[0.3cqw] text-[1.5cqw] font-semibold leading-none tracking-tight text-white"
        style={{ top: `${toPct(NOW)}%` }}
      >
        {formatLabel(NOW)}
      </div>
    </>
  )
}

function ScrubberArtwork() {
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-px bg-black/10" />
      <div
        className="absolute bottom-[34%] left-[3%] right-[3%] top-[34%]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(0,0,0,0.28) 0 0.15cqw, transparent 0.15cqw 1.4cqw)",
        }}
      />
      <div
        className="absolute bottom-[22%] left-[3%] top-[22%] w-[94%] origin-left bg-black/[8%]"
        style={{ transform: `scaleX(${weekBehind(0)})` }}
      />
      {[10, 30, 60].map((left) => (
        <div key={left} className="absolute bottom-[14%] top-[14%] w-[0.35cqw] bg-black" style={{ left: `${left}%` }} />
      ))}
    </>
  )
}

/* ------------------------------ Toolbar parts ----------------------------- */

function DayStampArtwork({ day, weekday }: DayStamp) {
  return (
    <div className="flex items-start gap-[0.6cqw]">
      <span className="text-[13cqw] font-bold leading-[0.78] tracking-[-0.06em] text-[#111]">{day}</span>
      <span className="text-[2cqw] font-bold tracking-tight text-[#e4321b]">{weekday}</span>
    </div>
  )
}

function SkipArtwork({ forward, enabled }: { forward?: boolean; enabled: boolean }) {
  return (
    <svg
      viewBox="0 0 43 28"
      className={cn("h-[7.5cqw]", forward && "rotate-180", enabled ? "text-[#bdbbb6]" : "text-[#e2e0dc]")}
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="0" y="1" width="3" height="26" rx="1.5" />
      <path d="M23 1 3 14l20 13V1Z" />
      <path d="M43 1 23 14l20 13V1Z" />
    </svg>
  )
}

function AddArtwork() {
  return (
    <svg viewBox="0 0 40 40" className="h-[7cqw] text-[#bdbbb6]" fill="currentColor" aria-hidden="true">
      <rect x="17" y="2" width="6" height="36" rx="1" />
      <rect x="2" y="17" width="36" height="6" rx="1" />
    </svg>
  )
}

/** The magnifier; the black disc behind it is the Search frame's own fill and radius. */
function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-[4.6cqw] text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  )
}

/** Centres a part in its frame, which hugs it. */
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center">{children}</div>
}

/** The bottom bar on the opening day: back is greyed out, forward is available. */
function ToolbarArtwork() {
  return (
    <div className="flex h-full items-center justify-between px-[4%] pb-[4cqw] pt-[3cqw]">
      <DayStampArtwork {...MONDAY.previous} />
      <div className="flex items-center gap-[2.5cqw]">
        <SkipArtwork enabled={false} />
        <SkipArtwork forward enabled />
      </div>
      <DayStampArtwork {...MONDAY.next} />
      <div className="flex items-center gap-[1.2cqw]">
        <AddArtwork />
        <div className="flex aspect-square w-[11cqw] items-center justify-center rounded-full bg-black">
          <SearchGlyph />
        </div>
      </div>
    </div>
  )
}

/** A single toolbar part, placed by its top-left corner. */
function part(
  id: string,
  name: string,
  at: { left: number; top: number },
  w: number,
  h: number,
  content: React.ReactNode,
  style: Partial<Pick<CalendarElement, "fill" | "radius" | "tag" | "layout" | "colors">> = {},
): CalendarElement {
  return {
    id,
    name,
    rect: placed(at.left, at.top, w, h),
    ...style,
    fill: style.fill ?? null,
    radius: style.radius ?? null,
    border: null,
    content: <Centered>{content}</Centered>,
  }
}

/* -------------------------------- The set --------------------------------- */

/** Padding in canvas px from cqw sides. */
const cqwSides = (top: number, right: number, bottom: number, left: number): Sides => ({
  top: top * CQW,
  right: right * CQW,
  bottom: bottom * CQW,
  left: left * CQW,
})

export const CALENDAR_ELEMENTS: CalendarElement[] = [
  {
    id: "status-bar",
    name: "Status Bar",
    rect: placed(STATUS_BAR_AT.left, STATUS_BAR_AT.top, CODEBASE_WIDTH, STATUS_BAR_HEIGHT),
    fill: TIMELINE_FILL,
    radius: null,
    border: null,
    layout: "row",
    padding: cqwSides(1.6, 3.5, 1.2, 3.5),
    colors: palette(TIMELINE_FILL, "#000000"),
    content: <StatusBarArtwork />,
  },
  {
    id: "background",
    name: "Background",
    rect: placed(BACKGROUND_AT.left, BACKGROUND_AT.top, CODEBASE_WIDTH, TIMELINE_HEIGHT),
    fill: TIMELINE_FILL,
    radius: null,
    border: null,
    position: "relative",
    clip: true,
    colors: palette(TIMELINE_FILL, "#000000", "#e4321b", WHITE),
    content: <BackgroundArtwork />,
  },
  ...EVENTS_AT.map(eventElement),
  {
    id: "scrubber",
    name: "Scrubber",
    rect: placed(SCRUBBER_AT.left, SCRUBBER_AT.top, CODEBASE_WIDTH, SCRUBBER_HEIGHT),
    fill: WHITE,
    radius: null,
    border: null,
    position: "relative",
    colors: palette(WHITE, "#000000"),
    content: <ScrubberArtwork />,
  },
  {
    id: "toolbar",
    name: "Toolbar",
    rect: placed(TOOLBAR_AT.left, TOOLBAR_AT.top, CODEBASE_WIDTH, TOOLBAR_HEIGHT),
    fill: WHITE,
    radius: null,
    border: null,
    position: "relative",
    layout: "row",
    // px-[4%] of the screen width, pt-[3cqw], pb-[4cqw]
    padding: cqwSides(3, 4, 4, 4),
    colors: palette(WHITE, "#111111", "#e4321b", "#bdbbb6", "#e2e0dc", "#000000"),
    content: <ToolbarArtwork />,
  },
  part("day-previous", `${MONDAY.previous.day} ${MONDAY.previous.weekday}`, PARTS_AT.dayPrevious, 190, DAY_STAMP_HEIGHT, (
    <DayStampArtwork {...MONDAY.previous} />
  ), { layout: "row", colors: palette("#111111", "#e4321b") }),
  part("skip-forward", "Skip Forward", PARTS_AT.skipForward, SKIP_WIDTH, SKIP_HEIGHT, <SkipArtwork forward enabled />, {
    tag: "button",
    colors: palette("#bdbbb6"),
  }),
  part("skip-back", "Skip Back", PARTS_AT.skipBack, SKIP_WIDTH, SKIP_HEIGHT, <SkipArtwork enabled={false} />, {
    tag: "button",
    colors: palette("#e2e0dc"),
  }),
  part("add", "Add", PARTS_AT.add, ADD_SIZE, ADD_SIZE, <AddArtwork />, { tag: "svg", colors: palette("#bdbbb6") }),
  part("search", "Search", PARTS_AT.search, SEARCH_SIZE, SEARCH_SIZE, <SearchGlyph />, {
    fill: "#000000",
    radius: SEARCH_SIZE / 2,
    layout: "row",
    colors: palette("#000000", WHITE),
  }),
]
