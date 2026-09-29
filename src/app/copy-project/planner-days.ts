/**
 * The days the planner can show. Each one is a self-contained dummy schedule;
 * the arrows in the bottom bar step between them.
 */

export type PlannerEvent = {
  label: string;
  lines: string[];
  duration: number;
  start: number;
  end: number;
  /** natural horizontal placement, in % of the grid's content area */
  left: number;
  width: number;
  /** blocks on a higher layer keep their shape; lower blocks give way to them */
  layer: number;
  /** corner radius, used for the outer corners and the concave inner corners */
  radius: string;
  /** the block's fill, also painted into its inner corners */
  background: string;
  /** anything drawn on top of the fill: border, shadow, stacking */
  surface: string;
  titleClass: string;
  subtitleClass: string;
  numberClass: string;
};

/** The read-out either side of the skip arrows: yesterday and tomorrow. */
export type DayStamp = {
  day: string;
  weekday: string;
};

export type PlannerDay = {
  /** stable identity for this day */
  slug: string;
  /** date shown in the status bar */
  date: string;
  /** the days either side of this one, stamped in the bottom bar */
  previous: DayStamp;
  next: DayStamp;
  events: PlannerEvent[];
};

const MONDAY_EVENTS: PlannerEvent[] = [
  {
    label: "In General",
    lines: ["Philosophy"],
    duration: 70,
    start: 11 * 60,
    end: 12 * 60 + 10,
    left: 0,
    width: 47.5,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#585a44]",
    surface: "",
    titleClass: "text-white",
    subtitleClass: "text-white/40",
    numberClass: "text-white",
  },
  {
    label: "Intentionality",
    lines: ["Making Conscious"],
    duration: 48,
    start: 11 * 60,
    end: 11 * 60 + 48,
    left: 52.5,
    width: 47.5,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#e8442a]",
    surface: "",
    titleClass: "text-[#1d0a05]",
    subtitleClass: "text-black/30",
    numberClass: "text-white",
  },
  {
    label: "Explains",
    lines: ["How We Perceive", "Patterns"],
    duration: 55,
    start: 12 * 60 + 30,
    end: 14 * 60 + 12,
    left: 52.5,
    width: 47.5,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#a9ab90]",
    surface: "",
    titleClass: "text-[#33352a]",
    subtitleClass: "text-black/25",
    numberClass: "text-[#1b1b17]",
  },
  {
    label: "Core Rule",
    lines: ["Every User", "Program"],
    duration: 63,
    start: 12 * 60 + 15,
    end: 13 * 60 + 18,
    left: 0,
    width: 79,
    layer: 2,
    radius: "1.4cqw",
    background: "bg-white",
    surface: "shadow-[0_0.6cqw_1.6cqw_rgba(0,0,0,0.14)]",
    titleClass: "text-[#2f2f2f]",
    subtitleClass: "text-black/25",
    numberClass: "text-[#141414]",
  },
  {
    label: "Goals",
    lines: [],
    duration: 39,
    start: 13 * 60 + 33,
    end: 14 * 60 + 12,
    left: 22.5,
    width: 25,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#8e3b34]",
    surface: "",
    titleClass: "text-white",
    subtitleClass: "text-white/35",
    numberClass: "text-white",
  },
  {
    label: "Living",
    lines: [],
    duration: 39,
    start: 11 * 60 + 30,
    end: 12 * 60 + 9,
    left: 75,
    width: 25,
    layer: 2,
    radius: "1cqw",
    background: "bg-[#ef9ee6]",
    surface: "border border-[#f8cdf2] shadow-[0_0.4cqw_1cqw_rgba(0,0,0,0.12)] z-20",
    titleClass: "text-[#2a1026]",
    subtitleClass: "text-black/30",
    numberClass: "text-[#150310]",
  },
];

const TUESDAY_EVENTS: PlannerEvent[] = [
  {
    label: "Deep Work",
    lines: ["Uninterrupted"],
    duration: 72,
    start: 11 * 60,
    end: 12 * 60 + 12,
    left: 0,
    width: 52,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#8e3b34]",
    surface: "",
    titleClass: "text-white",
    subtitleClass: "text-white/40",
    numberClass: "text-white",
  },
  {
    label: "Signals",
    lines: ["Noticing Change"],
    duration: 54,
    start: 11 * 60,
    end: 11 * 60 + 54,
    left: 57,
    width: 43,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#a9ab90]",
    surface: "",
    titleClass: "text-[#33352a]",
    subtitleClass: "text-black/25",
    numberClass: "text-[#1b1b17]",
  },
  {
    label: "Rituals",
    lines: [],
    duration: 42,
    start: 11 * 60 + 36,
    end: 12 * 60 + 18,
    left: 75,
    width: 25,
    layer: 2,
    radius: "1cqw",
    background: "bg-[#ef9ee6]",
    surface: "border border-[#f8cdf2] shadow-[0_0.4cqw_1cqw_rgba(0,0,0,0.12)] z-20",
    titleClass: "text-[#2a1026]",
    subtitleClass: "text-black/30",
    numberClass: "text-[#150310]",
  },
  {
    label: "Field Notes",
    lines: ["Second Brain", "Capture"],
    duration: 60,
    start: 12 * 60 + 20,
    end: 13 * 60 + 20,
    left: 10,
    width: 79,
    layer: 2,
    radius: "1.4cqw",
    background: "bg-white",
    surface: "shadow-[0_0.6cqw_1.6cqw_rgba(0,0,0,0.14)]",
    titleClass: "text-[#2f2f2f]",
    subtitleClass: "text-black/25",
    numberClass: "text-[#141414]",
  },
  {
    label: "Reading",
    lines: ["How Ideas Travel"],
    duration: 80,
    start: 12 * 60 + 45,
    end: 14 * 60 + 5,
    left: 52.5,
    width: 47.5,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#585a44]",
    surface: "",
    titleClass: "text-white",
    subtitleClass: "text-white/40",
    numberClass: "text-white",
  },
  {
    label: "Review",
    lines: [],
    duration: 35,
    start: 13 * 60 + 40,
    end: 14 * 60 + 15,
    left: 0,
    width: 30,
    layer: 1,
    radius: "0.9cqw",
    background: "bg-[#e8442a]",
    surface: "",
    titleClass: "text-[#1d0a05]",
    subtitleClass: "text-black/30",
    numberClass: "text-white",
  },
];

export const MONDAY: PlannerDay = {
  slug: "monday",
  date: "Mon Apr 26",
  previous: { day: "10", weekday: "MON" },
  next: { day: "12", weekday: "TUE" },
  events: MONDAY_EVENTS,
};

export const TUESDAY: PlannerDay = {
  slug: "tuesday",
  date: "Tue Apr 27",
  previous: { day: "11", weekday: "TUE" },
  next: { day: "13", weekday: "WED" },
  events: TUESDAY_EVENTS,
};

/** Left to right, in the order they are skipped through. */
export const PLANNER_DAYS: PlannerDay[] = [MONDAY, TUESDAY];

const unique = (values: string[]) => [...new Set(values)];

/**
 * Every value each read-out can ever show. A read-out reserves the width of the
 * widest of them, so the bottom bar keeps its layout while a day rolls over —
 * "WED" is wider than "MON", and nothing should shift because of it.
 */
export const READOUT_VALUES = {
  day: unique(PLANNER_DAYS.flatMap((day) => [day.previous.day, day.next.day])),
  weekday: unique(PLANNER_DAYS.flatMap((day) => [day.previous.weekday, day.next.weekday])),
  date: unique(PLANNER_DAYS.map((day) => day.date)),
};
