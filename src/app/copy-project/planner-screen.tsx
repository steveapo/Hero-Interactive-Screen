"use client";

import { Fragment, useRef, useState } from "react";

import { cn } from "./utils";
import { usePlannerIntro, useDayTransition } from "./use-planner-intro";
import { RollingReadout } from "./rolling-readout";
import {
  PLANNER_DAYS,
  READOUT_VALUES,
  type DayStamp as DayStampData,
  type PlannerDay,
  type PlannerEvent,
} from "./planner-days";

/**
 * Static recreation of the timetable inspiration screen.
 * Everything is authored in container-query units (cqw) so the whole UI
 * scales with the device screen it is dropped into.
 */

// Visible slice of the day, in minutes since midnight (10:50 -> 14:25).
const DAY_START = 10 * 60 + 50;
const DAY_END = 14 * 60 + 25;
/** The reader's own clock: the same moment whichever day is on screen. */
const NOW = 11 * 60 + 31;

const toPct = (minutes: number) =>
  ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100;

const GRID_LINES = [11 * 60, 11 * 60 + 30, 12 * 60, 12 * 60 + 30, 13 * 60, 13 * 60 + 30, 14 * 60];

const formatLabel = (minutes: number) =>
  `${Math.floor(minutes / 60)}.${String(minutes % 60).padStart(2, "0")}`;

/**
 * The scrubber is the whole week, end to end; the grey band over it is how much
 * of that week is already behind the reader. Each day is a seventh of the track,
 * and the day on screen counts for the part of itself that has already gone — by
 * the clock, so the band lines up with the current-time indicator above it.
 *
 * Returned as a share of the track, which is what the band is scaled by: on the
 * opening day it comes out at 0.07, the sliver the design starts with.
 */
const WEEK_LENGTH = 7;
const weekBehind = (index: number) => (index + NOW / (24 * 60)) / WEEK_LENGTH;

/**
 * Rank of every event in the day, earliest first (ties broken left to right).
 * The load-in animation staggers by this, so the day fills in chronologically
 * instead of in the order the events happen to be declared.
 */
const dayOrder = (events: PlannerEvent[]) =>
  new Map(
    [...events]
      .sort((a, b) => a.start - b.start || a.left - b.left)
      .map((event, index) => [event.label, index] as const),
  );

/**
 * Breathing room kept between a block and anything sitting on top of it.
 * One CSS length, used on both axes, so every gap in the grid is the same size —
 * the grid's own units (% of width, minutes of height) are not comparable.
 */
const OVERLAP_GAP = "1cqw";
/** Inner padding of every block. */
const EVENT_PADDING = "p-[1.6cqw]";

/**
 * A painted piece of an event. Every edge is raw grid geometry (minutes, or % of the
 * grid width) plus the number of gaps it is nudged by, which is only resolved to a real
 * length at paint time — that is what keeps a vertical gap the same size as a horizontal one.
 */
type Segment = {
  start: number;
  startGaps: number;
  end: number;
  endGaps: number;
  left: number;
  leftGaps: number;
  right: number;
  rightGaps: number;
};

/** A CSS length: a grid percentage nudged by a whole number of gaps. */
const withGaps = (percent: number, gaps: number) =>
  gaps === 0
    ? `${percent}%`
    : `calc(${percent}% ${gaps > 0 ? "+" : "-"} ${Math.abs(gaps)} * ${OVERLAP_GAP})`;

/** Orders two edges that may share a raw position but be nudged apart by gaps. */
const compareEdges = (a: number, aGaps: number, b: number, bGaps: number) =>
  a !== b ? a - b : aGaps - bGaps;

/**
 * Reshapes an event so it never runs underneath a block on a higher layer.
 * The event is sliced at every edge of the blocks on top of it — a slice above one stops
 * a gap before it begins, a slice below resumes a gap after it ends — and each slice gives
 * up the horizontal space the block takes, again plus a gap. A block that is only partly
 * covered therefore keeps its full width for the rest of its duration.
 * Returns the rectangles the event is actually painted as (identical neighbours merged).
 */
function resolveSegments(event: PlannerEvent, blockers: PlannerEvent[]): Segment[] {
  const overlapping = blockers.filter((b) => b.end > event.start && b.start < event.end);

  const cuts = new Map<string, { at: number; gaps: number }>([
    [`${event.start}:0`, { at: event.start, gaps: 0 }],
    [`${event.end}:0`, { at: event.end, gaps: 0 }],
  ]);
  for (const blocker of overlapping) {
    if (blocker.start > event.start && blocker.start < event.end) {
      cuts.set(`${blocker.start}:-1`, { at: blocker.start, gaps: -1 });
    }
    if (blocker.end > event.start && blocker.end < event.end) {
      cuts.set(`${blocker.end}:1`, { at: blocker.end, gaps: 1 });
    }
  }
  const bounds = [...cuts.values()].sort((a, b) => a.at - b.at || a.gaps - b.gaps);

  const segments: Segment[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (to.at <= from.at) continue;
    const middle = (from.at + to.at) / 2;

    let left = event.left;
    let leftGaps = 0;
    let right = event.left + event.width;
    let rightGaps = 0;

    for (const blocker of overlapping) {
      if (blocker.start >= middle || blocker.end <= middle) continue;
      const blockerRight = blocker.left + blocker.width;

      if (blocker.left <= left && blockerRight >= right) {
        right = left; // fully covered: this slice disappears
        break;
      }
      if (blockerRight >= left && blocker.left <= left) {
        left = blockerRight; // covered from the left
        leftGaps = 1;
      } else if (blocker.left <= right && blockerRight >= right) {
        right = blocker.left; // covered from the right
        rightGaps = -1;
      } else if (blocker.left > left && blockerRight < right) {
        // covered through the middle: keep whichever side has more room
        if (blocker.left - left >= right - blockerRight) {
          right = blocker.left;
          rightGaps = -1;
        } else {
          left = blockerRight;
          leftGaps = 1;
        }
      }
    }

    if (right - left <= 0) continue;
    const previous = segments[segments.length - 1];
    const continues =
      previous &&
      previous.end === from.at &&
      previous.endGaps === from.gaps &&
      previous.left === left &&
      previous.leftGaps === leftGaps &&
      previous.right === right &&
      previous.rightGaps === rightGaps;

    if (continues) {
      previous.end = to.at;
      previous.endGaps = to.gaps;
    } else {
      segments.push({
        start: from.at,
        startGaps: from.gaps,
        end: to.at,
        endGaps: to.gaps,
        left,
        leftGaps,
        right,
        rightGaps,
      });
    }
  }

  return segments;
}

/**
 * Corner radii for one slice: a corner is rounded only where it is a free (convex)
 * corner of the resolved shape — where the neighbouring slice steps further out, the
 * edge either continues or turns into a concave corner, both of which stay square here.
 */
function segmentRadii(segments: Segment[], index: number, radius: string) {
  const segment = segments[index];
  const above = segments[index - 1];
  const below = segments[index + 1];
  const round = (rounded: boolean) => (rounded ? radius : "0");

  return [
    round(!above || compareEdges(above.left, above.leftGaps, segment.left, segment.leftGaps) > 0),
    round(!above || compareEdges(above.right, above.rightGaps, segment.right, segment.rightGaps) < 0),
    round(!below || compareEdges(below.right, below.rightGaps, segment.right, segment.rightGaps) < 0),
    round(!below || compareEdges(below.left, below.leftGaps, segment.left, segment.leftGaps) > 0),
  ].join(" ");
}

/** A concave corner: a square of fill with a quarter disc bitten out of it. */
type Fillet = {
  x: number;
  xGaps: number;
  time: number;
  timeGaps: number;
  corner: string;
  /** radius of the bitten-out disc */
  radius: string;
};

/**
 * A concave corner always wraps around the convex corner of the block that pushed
 * it in, one gap away from it. Growing that block's radius by exactly one gap makes
 * the two arcs concentric, so the gap stays the same width all the way round the
 * corner — the same reading as the straight edges either side of it.
 */
const concaveRadius = (radius: string) => `calc(${radius} + ${OVERLAP_GAP})`;

/**
 * The block whose corner sits inside this concave corner: it owns the vertical edge
 * the shape steps to (its right edge for a step on the left, its left edge for a step
 * on the right) and it either starts or ends at the junction.
 */
function cornerOwner(blockers: PlannerEvent[], x: number, xGaps: number, time: number) {
  return blockers.find(
    (blocker) =>
      (xGaps > 0 ? blocker.left + blocker.width === x : blocker.left === x) &&
      (blocker.start === time || blocker.end === time),
  );
}

/**
 * Where the shape steps in or out between two slices it forms a concave corner.
 * Each one is smoothed with a reverse curve tangent to both edges.
 */
function resolveFillets(segments: Segment[], blockers: PlannerEvent[]): Fillet[] {
  const fillets: Fillet[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const upper = segments[i];
    const lower = segments[i + 1];
    if (upper.end !== lower.start || upper.endGaps !== lower.startGaps) continue;
    const junction = { time: upper.end, timeGaps: upper.endGaps };

    /** the corner is sized off the block that carved it, not off this block */
    const radiusAt = (x: number, xGaps: number) => {
      const owner = cornerOwner(blockers, x, xGaps, junction.time);
      return concaveRadius(owner ? owner.radius : OVERLAP_GAP);
    };

    const leftStep = compareEdges(upper.left, upper.leftGaps, lower.left, lower.leftGaps);
    if (leftStep > 0) {
      fillets.push({
        x: upper.left,
        xGaps: upper.leftGaps,
        ...junction,
        corner: "top left",
        radius: radiusAt(upper.left, upper.leftGaps),
      });
    } else if (leftStep < 0) {
      fillets.push({
        x: lower.left,
        xGaps: lower.leftGaps,
        ...junction,
        corner: "bottom left",
        radius: radiusAt(lower.left, lower.leftGaps),
      });
    }

    const rightStep = compareEdges(upper.right, upper.rightGaps, lower.right, lower.rightGaps);
    if (rightStep < 0) {
      fillets.push({
        x: upper.right,
        xGaps: upper.rightGaps,
        ...junction,
        corner: "top right",
        radius: radiusAt(upper.right, upper.rightGaps),
      });
    } else if (rightStep > 0) {
      fillets.push({
        x: lower.right,
        xGaps: lower.rightGaps,
        ...junction,
        corner: "bottom right",
        radius: radiusAt(lower.right, lower.rightGaps),
      });
    }
  }

  return fillets;
}

/** Index of the roomiest slice — the one that carries the event's title. */
const roomiestSegment = (segments: Segment[]) => {
  const area = (segment: Segment) =>
    (segment.end - segment.start) * (segment.right - segment.left);
  return segments.reduce(
    (best, segment, index) => (area(segment) > area(segments[best]) ? index : best),
    0,
  );
};

function StatusBar({ date, direction }: { date: string; direction: number }) {
  return (
    <div className="flex shrink-0 items-center justify-between bg-[#f1efec] px-[3.5cqw] pt-[1.6cqw] pb-[1.2cqw] text-[2cqw] tracking-tight text-black">
      <div data-anim="chrome" className="flex items-center gap-[1.6cqw]">
        <span className="font-semibold">9:41</span>
        <RollingReadout
          value={date}
          direction={direction}
          sizes={READOUT_VALUES.date}
          className="font-medium"
        />
      </div>
      <img
        data-anim="chrome"
        src="/status.png"
        alt="Cellular, Wi-Fi and battery status"
        className="h-[1.8cqw] w-auto select-none"
      />
    </div>
  );
}

function Timeline({ days }: { days: PlannerDay[] }) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#f1efec]">
      {/* half-hour rules + time labels — the hours never change, so they stay put */}
      {GRID_LINES.map((minutes) => (
        <div key={minutes} className="absolute inset-x-0" style={{ top: `${toPct(minutes)}%` }}>
          <div
            data-anim="grid-rule"
            className="absolute right-[2%] left-[7%] h-px origin-left bg-black/[8%]"
          />
          <span
            data-anim="grid-label"
            className="absolute left-[1.5%] -translate-y-1/2 text-[1.5cqw] font-medium tracking-tight text-black/35"
          >
            {formatLabel(minutes)}
          </span>
        </div>
      ))}

      {/* one layer per day, stacked; only the open one is visible */}
      {days.map((day) => (
        <DayLayer key={day.slug} day={day} />
      ))}

      {/* current time indicator — the reader's clock, so it never changes with
          the day, and it is always drawn over every block */}
      <div
        data-anim="now-line"
        className="absolute inset-x-0 z-30 h-px origin-left bg-[#e4321b]"
        style={{ top: `${toPct(NOW)}%` }}
      />
      <div
        data-anim="now-badge"
        className="absolute left-[1.2%] z-30 -translate-y-1/2 rounded-[0.4cqw] bg-[#e4321b] px-[0.7cqw] py-[0.3cqw] text-[1.5cqw] leading-none font-semibold tracking-tight text-white"
        style={{ top: `${toPct(NOW)}%` }}
      >
        {formatLabel(NOW)}
      </div>
    </div>
  );
}

function DayLayer({ day }: { day: PlannerDay }) {
  const { events } = day;
  const order = dayOrder(events);

  return (
    <div data-anim="day-layer" className="absolute inset-0">
      {/* events — each one reshaped around the blocks that sit on top of it */}
      <div className="absolute inset-y-0 left-[7%] right-[4.5%]">
        {events.map((event) => {
          const blockers = events.filter((other) => other.layer > event.layer);
          const segments = resolveSegments(event, blockers);
          // the title sits in the roomiest slice, the duration always at the very bottom
          const titleIndex = roomiestSegment(segments);
          const durationIndex = segments.length - 1;
          const eventOrder = order.get(event.label) ?? 0;

          return (
            <Fragment key={event.label}>
              {segments.map((segment, index) => (
                <div
                  key={`${segment.start}:${segment.startGaps}`}
                  data-anim="block"
                  data-order={eventOrder}
                  style={{
                    top: withGaps(toPct(segment.start), segment.startGaps),
                    height: withGaps(
                      toPct(segment.end) - toPct(segment.start),
                      segment.endGaps - segment.startGaps,
                    ),
                    left: withGaps(segment.left, segment.leftGaps),
                    width: withGaps(segment.right - segment.left, segment.rightGaps - segment.leftGaps),
                    borderRadius: segmentRadii(segments, index, event.radius),
                  }}
                  className={cn("absolute overflow-hidden", event.background, event.surface)}
                >
                  {index === titleIndex && (
                    <div
                      data-anim="title"
                      data-order={eventOrder}
                      className={cn("absolute inset-x-0 top-0 leading-[1.3]", EVENT_PADDING)}
                    >
                      <p className={cn("text-[1.55cqw] font-bold tracking-tight", event.titleClass)}>
                        {event.label}
                      </p>
                      {event.lines.map((line) => (
                        <p
                          key={line}
                          className={cn(
                            "text-[1.55cqw] font-bold tracking-tight",
                            event.subtitleClass,
                          )}
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                  {index === durationIndex && (
                    <div
                      data-anim="duration"
                      data-order={eventOrder}
                      className={cn(
                        "absolute inset-x-0 bottom-0 flex items-start gap-[0.5cqw]",
                        EVENT_PADDING,
                        event.numberClass,
                      )}
                    >
                      <span
                        data-count={event.duration}
                        data-order={eventOrder}
                        className="text-[6.4cqw] leading-[0.78] font-medium tracking-[-0.045em]"
                      >
                        {event.duration}
                      </span>
                      <span className="text-[1.15cqw] font-bold">MIN</span>
                    </div>
                  )}
                </div>
              ))}

              {resolveFillets(segments, blockers).map((fillet) => {
                const x = withGaps(fillet.x, fillet.xGaps);
                const y = withGaps(toPct(fillet.time), fillet.timeGaps);
                // the stop straddles the arc by half a pixel either side: a gradient
                // hard stop is not antialiased, this hands the curve a soft edge
                const bite = `radial-gradient(circle ${fillet.radius} at ${fillet.corner}, transparent calc(100% - 0.5px), #000 calc(100% + 0.5px))`;

                return (
                  <div
                    key={`${fillet.time}-${fillet.corner}`}
                    data-anim="fillet"
                    data-order={eventOrder}
                    style={{
                      width: fillet.radius,
                      height: fillet.radius,
                      left: fillet.corner.endsWith("left") ? `calc(${x} - ${fillet.radius})` : x,
                      top: fillet.corner.startsWith("top") ? `calc(${y} - ${fillet.radius})` : y,
                      maskImage: bite,
                      WebkitMaskImage: bite,
                    }}
                    className={cn("absolute", event.background)}
                  />
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Scrubber({ index }: { index: number }) {
  return (
    <div className="relative h-[4.6cqw] shrink-0 border-t border-black/10 bg-white">
      {/* week view: the whole week of half-hour slots, edge to edge */}
      <div
        data-anim="scrub-track"
        className="absolute top-[34%] right-[3%] bottom-[34%] left-[3%] origin-left"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, rgba(0,0,0,0.28) 0 0.15cqw, transparent 0.15cqw 1.4cqw)",
        }}
      />
      {/* how much of the week is behind the reader — the day change scales this
          band to its new share, in step with the events being exchanged */}
      <div
        data-anim="scrub-mark"
        data-week={weekBehind(index)}
        className="absolute top-[22%] bottom-[22%] left-[3%] w-[94%] origin-left bg-black/[8%]"
      />
      {/* important events */}
      {[10, 30, 60].map((left) => (
        <div
          key={left}
          data-anim="scrub-mark"
          className="absolute top-[14%] bottom-[14%] w-[0.35cqw] bg-black"
          style={{ left: `${left}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Yesterday on the left, tomorrow on the right. Both are read-outs: they roll to
 * the neighbouring dates whenever the day changes.
 */
function DayStamp({
  stamp,
  direction,
  order,
}: {
  stamp: DayStampData;
  direction: number;
  order: number;
}) {
  return (
    <div data-anim="control" data-order={order} className="flex items-start gap-[0.6cqw]">
      <RollingReadout
        value={stamp.day}
        direction={direction}
        sizes={READOUT_VALUES.day}
        className="text-[13cqw] leading-[0.78] font-bold tracking-[-0.06em] text-[#111]"
      />
      <RollingReadout
        value={stamp.weekday}
        direction={direction}
        sizes={READOUT_VALUES.weekday}
        className="text-[2cqw] font-bold tracking-tight text-[#e4321b]"
      />
    </div>
  );
}

/** Skips to the previous / next day. Greys out at either end of the week. */
function SkipButton({
  direction,
  enabled,
  order,
  onSkip,
}: {
  direction: "back" | "forward";
  enabled: boolean;
  order: number;
  onSkip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSkip}
      disabled={!enabled}
      data-anim="control"
      data-order={order}
      aria-label={`${direction === "back" ? "Previous" : "Next"} day`}
      className="cursor-pointer text-[#bdbbb6] transition-colors duration-200 active:text-[#111] disabled:cursor-default disabled:text-[#e2e0dc]"
    >
      <svg
        viewBox="0 0 43 28"
        className={cn("h-[7.5cqw]", direction === "forward" && "rotate-180")}
        fill="currentColor"
      >
        <rect x="0" y="1" width="3" height="26" rx="1.5" />
        <path d="M23 1 3 14l20 13V1Z" />
        <path d="M43 1 23 14l20 13V1Z" />
      </svg>
    </button>
  );
}

function BottomBar({
  day,
  direction,
  canSkip,
  onSkip,
}: {
  day: PlannerDay;
  direction: number;
  canSkip: (step: -1 | 1) => boolean;
  onSkip: (step: -1 | 1) => void;
}) {
  return (
    <div className="relative flex shrink-0 items-center justify-between bg-white px-[4%] pt-[3cqw] pb-[4cqw]">
      <DayStamp stamp={day.previous} direction={direction} order={0} />
      <div className="flex items-center gap-[2.5cqw]">
        <SkipButton
          direction="back"
          enabled={canSkip(-1)}
          order={1}
          onSkip={() => onSkip(-1)}
        />
        <SkipButton
          direction="forward"
          enabled={canSkip(1)}
          order={2}
          onSkip={() => onSkip(1)}
        />
      </div>
      <DayStamp stamp={day.next} direction={direction} order={3} />
      <div className="flex items-center gap-[1.2cqw]">
        <svg
          data-anim="control"
          data-order={4}
          viewBox="0 0 40 40"
          className="h-[7cqw] text-[#bdbbb6]"
          fill="currentColor"
        >
          <rect x="17" y="2" width="6" height="36" rx="1" />
          <rect x="2" y="17" width="36" height="6" rx="1" />
        </svg>
        <div
          data-anim="search"
          className="flex aspect-square w-[11cqw] items-center justify-center rounded-full bg-black"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-[4.6cqw] text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 4.5 4.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function PlannerScreen() {
  const root = useRef<HTMLDivElement>(null);
  /** which day is open, and which way the last step went */
  const [{ index, direction }, setDay] = useState({ index: 0, direction: 1 });
  const day = PLANNER_DAYS[index];

  usePlannerIntro(root);
  useDayTransition(root, index, direction);

  const canSkip = (step: -1 | 1) => index + step >= 0 && index + step < PLANNER_DAYS.length;
  const skip = (step: -1 | 1) => {
    if (!canSkip(step)) return;
    setDay({ index: index + step, direction: step });
  };

  return (
    <div
      ref={root}
      className="flex h-full w-full flex-col overflow-hidden bg-white font-sans text-black opacity-0"
    >
      <StatusBar date={day.date} direction={direction} />
      <Timeline days={PLANNER_DAYS} />
      <Scrubber index={index} />
      <BottomBar day={day} direction={direction} canSkip={canSkip} onSkip={skip} />
    </div>
  );
}
