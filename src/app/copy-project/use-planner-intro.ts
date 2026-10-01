"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";

/**
 * Motion for the planner screen: the load-in choreography, and the change of day
 * that flies one day's events out and the next day's events in.
 *
 * Every duration, delay and stagger in here is one base beat scaled by a whole
 * power of the golden ratio, so the whole entrance is a single geometric
 * progression:
 *
 *   beat(-4)  beat(-3)  beat(-2)  beat(-1)  beat(0)  beat(1)  beat(2)  beat(3)
 *    0.057     0.092     0.149     0.241    0.390    0.631    1.020    1.651
 *
 * Because φⁿ = φⁿ⁻¹ + φⁿ⁻², every phase starts exactly where the two phases
 * before it add up to — the sequence keeps accelerating, and no number in it
 * was hand-picked. Only the tempo is a matter of taste: the base beat sets how
 * quickly the ladder is read, and every proportion in it holds whatever that is
 * set to.
 */
const PHI = (1 + Math.sqrt(5)) / 2;
/**
 * How quickly the ladder is read, and the one number here that is taste rather
 * than proportion: everything timed in beats is stretched by it, so the whole
 * screen — load-in, day change, rolling readout — keeps its shape and only
 * changes pace. Seven tenths of the rate, twice over: 0.49 of the pace the
 * ladder was first written at.
 */
const TEMPO = 1 / 0.7 ** 2;
/** The base beat, in seconds: two φ-steps below a second, at double time. */
const BASE_BEAT = (1 / PHI ** 2 / 2) * TEMPO;
/** The only source of a duration or an offset: the beat scaled by φ^steps. */
export const beat = (steps: number) => BASE_BEAT * PHI ** steps;

/** Phase entry points on the same φ-ladder. */
const PHASE = {
  screen: 0,
  chrome: beat(-2),
  grid: beat(-1),
  blocks: beat(0),
  controls: beat(1),
  now: beat(2),
} as const;

/** How far apart two neighbours in the same family start. */
const STEP = {
  chrome: beat(-2),
  grid: beat(-4),
  block: beat(-3),
  control: beat(-3),
};

/**
 * A run held at one speed that eases off at the end, given as the share of the
 * journey covered by each share of the time: flat out for the first `cruise` of
 * it, then the pace falling away steadily to `settle` of that speed as it
 * arrives. The cruising speed is whatever makes the two together come to the
 * whole journey.
 *
 * The speed is continuous where the two halves meet, so there is no kick as it
 * starts to ease, and it never reaches zero, so the curve always rises. That
 * last part is what the day change needs of it: its schedule may only ever be
 * read through a warp that never stops or turns back (see `useDayTransition`).
 */
const glide = (cruise: number, settle: number) => {
  const rate = 1 / (cruise + ((1 - cruise) * (1 + settle)) / 2);

  return (progress: number) => {
    if (progress <= cruise) return rate * progress;

    /** how far into the easing-off the journey is */
    const easing = (progress - cruise) / (1 - cruise);

    return rate * (cruise + (1 - cruise) * easing * (1 - ((1 - settle) * easing) / 2));
  };
};

/** The shared ease family — one curve per kind of motion. */
export const EASE = {
  reveal: "expo.out",
  fade: "power2.out",
  /** anything carried into its place arrives with weight and settles back */
  travel: `back.out(${PHI.toFixed(3)})`,
  /**
   * The strip of traffic crossing the frame: φ⁻¹ of the change held at one
   * steady speed, and the last φ⁻² of it easing down to φ⁻² of that pace — a
   * day that sets off at its travelling speed and is only just slowing as it
   * lands, rather than one that is always either gathering or shedding pace.
   *
   * Easing a block on its own is what lets it overtake another so that two of
   * them meet, so this curve is never handed to a block: it warps the time the
   * whole schedule is read at (see `useDayTransition`), which carries every
   * block by the same amount and so keeps every gap the schedule laid out.
   */
  conveyor: glide(1 / PHI, 1 / PHI ** 2),
  /** a wheel turning: eases away and eases back to rest, never snaps */
  wheel: "power2.inOut",
  /**
   * A spring let go: it runs past where it is headed and rings down onto it.
   * The ring is φ-tuned like everything else — a period of φ⁻² of the tween
   * gives it a couple of decaying swings inside whatever it is given. This is
   * what anything landing on its own point lands with.
   */
  spring: `elastic.out(1, ${(1 / PHI ** 2).toFixed(3)})`,
  count: "power2.out",
};

/**
 * Elements that belong to a timetable event carry `data-order`: their rank in
 * the day. Using it as the stagger makes the blocks land chronologically
 * rather than in DOM order.
 */
const byDayOrder = (step: number) => (_index: number, target: Element) =>
  Number((target as HTMLElement).dataset.order ?? 0) * step;

const orderDelay = (element: HTMLElement, step: number) =>
  Number(element.dataset.order ?? 0) * step;

export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function usePlannerIntro(root: RefObject<HTMLDivElement | null>, speed = 1) {
  useIsomorphicLayoutEffect(() => {
    const element = root.current;
    if (!element) return;

    const media = gsap.matchMedia(element);

    /** the scrubber's band, and the share of the week the opening day sits at */
    const band = element.querySelector<HTMLElement>("[data-week]");
    const weekBehind = Number(band?.dataset.week ?? 0);

    media.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { reduced } = context.conditions as { motion: boolean; reduced: boolean };

        if (reduced) {
          gsap.set(element, { opacity: 1 });
          if (band) gsap.set(band, { scaleX: weekBehind });
          return;
        }

        const timeline = gsap.timeline({ defaults: { ease: EASE.fade } });
        timeline.timeScale(speed);

        // 1 — the screen itself lights up
        timeline.fromTo(
          element,
          { opacity: 0 },
          { opacity: 1, duration: beat(1) },
          PHASE.screen,
        );

        // 2 — system chrome drops in from above
        timeline.from(
          "[data-anim='chrome']",
          { y: -beat(2) * 10, opacity: 0, duration: beat(0), stagger: STEP.chrome, ease: EASE.travel },
          PHASE.chrome,
        );

        // 3 — the grid draws itself left to right, its labels trailing behind
        timeline
          .from(
            "[data-anim='grid-rule']",
            { scaleX: 0, duration: beat(1), stagger: STEP.grid, ease: EASE.reveal },
            PHASE.grid,
          )
          .from(
            "[data-anim='grid-label']",
            { opacity: 0, x: -beat(1) * 6, duration: beat(-1), stagger: STEP.grid },
            PHASE.grid + STEP.grid,
          );

        // 4 — every block grows downward out of its start time, its corners
        //     morphing from a soft sliver into the shape it actually occupies
        timeline.fromTo(
          "[data-anim='block']",
          { clipPath: "inset(0% 0% 100% 0% round 2cqw)", opacity: 0 },
          {
            clipPath: "inset(0% 0% 0% 0% round 0cqw)",
            opacity: 1,
            duration: beat(0),
            ease: EASE.reveal,
            stagger: byDayOrder(STEP.block),
            clearProps: "clipPath",
          },
          PHASE.blocks,
        );

        // the concave corner patches settle once their block has arrived
        timeline.from(
          "[data-anim='fillet']",
          {
            opacity: 0,
            duration: beat(-1),
            stagger: byDayOrder(STEP.block),
          },
          PHASE.blocks + beat(-1),
        );

        // 5 — the content inside each block lifts into place, one beat behind it
        timeline.from(
          "[data-anim='title']",
          {
            opacity: 0,
            y: beat(1) * 8,
            duration: beat(-1),
            stagger: byDayOrder(STEP.block),
            ease: EASE.travel,
          },
          PHASE.blocks + STEP.block,
        );

        timeline.from(
          "[data-anim='duration']",
          {
            opacity: 0,
            y: beat(2) * 8,
            duration: beat(0),
            stagger: byDayOrder(STEP.block),
            ease: EASE.travel,
          },
          PHASE.blocks + STEP.block,
        );

        // …and the minute counts tick up to their value as they land
        gsap.utils.toArray<HTMLElement>("[data-count]", element).forEach((counter) => {
          const target = Number(counter.dataset.count);
          const ticker = { value: 0 };

          timeline.to(
            ticker,
            {
              value: target,
              duration: beat(1),
              ease: EASE.count,
              snap: { value: 1 },
              onUpdate: () => {
                counter.textContent = String(ticker.value);
              },
            },
            PHASE.blocks + orderDelay(counter, STEP.block) + STEP.block,
          );
        });

        // 6 — the bottom controls rise while the day is still filling in
        timeline
          .from(
            "[data-anim='scrub-track']",
            { scaleX: 0, opacity: 0, duration: beat(2), ease: EASE.reveal },
            PHASE.controls,
          )
          .from(
            "[data-anim='scrub-mark']",
            { scaleY: 0, opacity: 0, duration: beat(-1), stagger: STEP.grid, ease: EASE.travel },
            PHASE.controls + beat(-1),
          )
          .from(
            "[data-anim='control']",
            {
              y: beat(2) * 12,
              opacity: 0,
              duration: beat(0),
              stagger: byDayOrder(STEP.control),
              ease: EASE.travel,
            },
            PHASE.controls,
          )
          .from(
            "[data-anim='search']",
            { scale: 0, opacity: 0, duration: beat(1), ease: EASE.spring },
            PHASE.controls + beat(0),
          );

        // the week behind the reader fills to the day being opened on, so the
        // band starts the session at the share the scrubber actually means
        if (band) {
          timeline.fromTo(
            band,
            { scaleX: 0 },
            { scaleX: weekBehind, duration: beat(1), ease: EASE.reveal },
            PHASE.controls + beat(-1),
          );
        }

        // 7 — last, the present moment sweeps across the finished day
        timeline
          .from(
            "[data-anim='now-line']",
            { scaleX: 0, duration: beat(2), ease: EASE.reveal },
            PHASE.now,
          )
          .from(
            "[data-anim='now-badge']",
            { scale: 0, opacity: 0, duration: beat(1), ease: EASE.spring },
            PHASE.now + beat(-1),
          );
      },
    );

    return () => media.revert();
  }, [root, speed]);
}

/** Every piece of one event carries the same `data-order`: this is the event. */
const eventOf = (target: Element) => (target as HTMLElement).dataset.order ?? "";

type Box = { left: number; right: number; top: number; bottom: number };

/**
 * Every rectangle each event is painted as, in frame coordinates: a block is cut
 * into slices around whatever sits on top of it, and carries corner patches where
 * it steps in and out. Two events are only ever in each other's way where their
 * actual pieces line up — their envelopes overlap all the time, precisely because
 * one is carved around the other.
 *
 * offsetLeft is layout, not transform, so this reads the same whatever has
 * already been moved.
 */
const eventPieces = (pieces: Element[]) => {
  const shapes = new Map<string, Box[]>();

  for (const piece of pieces) {
    const element = piece as HTMLElement;
    const parent = element.offsetParent as HTMLElement | null;
    const left = (parent?.offsetLeft ?? 0) + element.offsetLeft;
    const top = (parent?.offsetTop ?? 0) + element.offsetTop;

    shapes.set(eventOf(piece), [
      ...(shapes.get(eventOf(piece)) ?? []),
      { left, right: left + element.offsetWidth, top, bottom: top + element.offsetHeight },
    ]);
  }

  return shapes;
};

/** The one box that holds all of them: what the event is parked and swept by. */
const envelope = (boxes: Box[]): Box => ({
  left: Math.min(...boxes.map((box) => box.left)),
  right: Math.max(...boxes.map((box) => box.right)),
  top: Math.min(...boxes.map((box) => box.top)),
  bottom: Math.max(...boxes.map((box) => box.bottom)),
});

const overlapsDown = (a: Box, b: Box) => a.top < b.bottom && b.top < a.bottom;

/**
 * The least ground an arriving block covers, as a share of the frame.
 *
 * Parked only just outside, a block whose slot sits against the edge it comes in
 * from has almost nothing to travel: it appears at the edge and stops, while the
 * blocks from the far side of the day are still crossing. Standing them all at
 * least this far out gives every one of them room to read as a move, and closes
 * the spread of journeys so the day arrives as one consistent movement. At the
 * shared rate it is beat(-1) of travel — the shortest journey in the change.
 */
const ROOM = 1 / PHI;

/**
 * Where an event stands when it is off the frame, on the given side: 1 past the
 * right edge, -1 past the left. By default just far enough that its leading edge
 * is level with the edge and not a pixel more — which is all a block leaving
 * needs to be out of shot — but never nearer than `least`.
 */
const parkedAt = (box: Box, side: number, frame: number, least = 0) => {
  const edge = side > 0 ? frame - box.left : -box.right;

  return side > 0 ? Math.max(edge, least) : Math.min(edge, -least);
};

/**
 * Bands of events that share vertical ground, connected through each other: two
 * that overlap are in the same band, and so is anything either of them overlaps.
 * Only events within a band can ever get in each other's way.
 */
const bands = (boxes: Map<string, Box>) => {
  const band = new Map([...boxes.keys()].map((event, index) => [event, index] as const));
  const join = (from: number, to: number) => {
    for (const [event, id] of band) {
      if (id === from) band.set(event, to);
    }
  };

  for (const [a, boxA] of boxes) {
    for (const [b, boxB] of boxes) {
      if (a === b || !overlapsDown(boxA, boxB)) continue;
      const first = band.get(a) ?? 0;
      const second = band.get(b) ?? 0;
      if (first !== second) join(Math.max(first, second), Math.min(first, second));
    }
  }

  return band;
};

/**
 * Where every arriving event stands before it comes on, worked out a band at a
 * time: each band stands at the distance its furthest-travelling member needs.
 *
 * Standing each event at its own distance would line their leading edges up
 * against the frame edge, which is nothing like the spacing they hold at rest —
 * and the schedule would then have to buy that spacing back with delay, leaving
 * one block halfway across before its neighbour had set off. A band that waits
 * at one distance keeps its layout intact, so its events can follow each other
 * in as closely as the sweep asks, and they all cover the same ground in the
 * same time.
 */
const standOff = (boxes: Map<string, Box>, side: number, frame: number, least: number) => {
  const band = bands(boxes);
  const furthest = new Map<number, number>();

  for (const [event, box] of boxes) {
    const id = band.get(event) ?? 0;
    const need = Math.abs(parkedAt(box, side, frame, least));
    furthest.set(id, Math.max(furthest.get(id) ?? 0, need));
  }

  return new Map(
    [...boxes.keys()].map(
      (event) => [event, (side > 0 ? 1 : -1) * (furthest.get(band.get(event) ?? 0) ?? 0)] as const,
    ),
  );
};

/**
 * A block on the move: where it stands when it sets off, where it stops, the
 * rate it covers that ground at, and how long it therefore takes.
 */
type Mover = {
  event: string;
  /** the box it is parked, swept and weighed by */
  box: Box;
  /** and the rectangles it is actually painted as, which is what can collide */
  pieces: Box[];
  from: number;
  to: number;
  rate: number;
  duration: number;
  /** how long it hangs back beyond its turn in the sweep */
  lead: number;
  /** which day it belongs to — filled in by the schedule */
  day: number;
  /** when it sets off — filled in by the schedule */
  at: number;
};

const areaOf = (box: Box) =>
  Math.max(box.right - box.left, 0) * Math.max(box.bottom - box.top, 0);

/** How much of one box the other reaches into. */
const sharedWith = (box: Box, other: Box) =>
  Math.max(0, Math.min(box.right, other.right) - Math.max(box.left, other.left)) *
  Math.max(0, Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top));

/**
 * How much of a block is tangled up with the rest of its day: the share of its
 * own footprint that its neighbours reach into, and never more than all of it.
 */
const tangleOf = (box: Box, boxes: Map<string, Box>, event: string) => {
  const shared = [...boxes].reduce(
    (total, [other, otherBox]) => (other === event ? total : total + sharedWith(box, otherBox)),
    0,
  );

  return Math.min(shared / (areaOf(box) || 1), 1);
};

/** How much slower the heaviest block of a day travels than the lightest. */
const HEFT = 1 / PHI ** 3;

/** How long a wholly tangled-up block hangs back beyond its turn in the sweep. */
const TANGLE = beat(-3);

/**
 * Works out the journey each block of a day makes, and how it carries itself
 * along the way. Three things about a block decide its timing, which is what
 * keeps the day reading as one body rather than a set of parts:
 *
 *   · its position sets its turn in the sweep, later in `swept`;
 *   · its size sets its pace, a big block being that much heavier to carry over
 *     the same ground than a small one;
 *   · how tangled it is with its neighbours sets how far it hangs back, so a
 *     block that sits under half the day lets the day go before it does.
 *
 * Tangle is measured on the envelopes, not the pieces: two events carved around
 * each other never share a pixel, and being interleaved is exactly the thing
 * worth reading in their timing.
 */
const movers = (
  shapes: Map<string, Box[]>,
  journey: {
    from: (box: Box, event: string) => number;
    to: (box: Box, event: string) => number;
    rate: number;
  },
): Mover[] => {
  const boxes = new Map([...shapes].map(([event, pieces]) => [event, envelope(pieces)] as const));
  const heaviest = Math.max(1, ...[...boxes.values()].map(areaOf));

  return [...shapes].map(([event, pieces]) => {
    const box = boxes.get(event) ?? envelope(pieces);
    const start = journey.from(box, event);
    const stop = journey.to(box, event);
    const rate = journey.rate * (1 - HEFT * (areaOf(box) / heaviest));

    return {
      event,
      box,
      pieces,
      from: start,
      to: stop,
      rate,
      duration: Math.max(Math.abs(stop - start) / rate, beat(-3)),
      lead: tangleOf(box, boxes, event) * TANGLE,
      day: 0,
      at: 0,
    };
  });
};

/**
 * Puts one group of blocks in the order the change has to consider them — ahead
 * of the travel first — and gives each its opening time.
 *
 * The order is by leading edge: going to the next day everything moves left, so
 * the block whose left edge is furthest left is in front of all the others; going
 * back, it is the one whose right edge is furthest right. That order is what the
 * schedule leans on when it works out who has to make room for whom, so it has to
 * be the arrangement on the screen and never the clock — a block that hangs back
 * is still in front of the ones behind it, and asking them to wait for it would
 * strand it at the back of its own day.
 *
 * The opening time is the sweep across that same axis, taken from the middle of
 * each block so the wave reads evenly, plus however long the block hangs back for
 * being tangled up with its neighbours.
 */
const swept = (group: Mover[], direction: number, spread: number, day: number) => {
  const centre = ({ box }: Mover) => (box.left + box.right) / 2;
  /** how far in front the block is: smaller is further ahead */
  const front = ({ box }: Mover) => (direction > 0 ? box.left : -box.right);

  const centres = group.map(centre);
  const first = Math.min(...centres);
  const span = Math.max(...centres) - first || 1;
  const across = (mover: Mover) => (centre(mover) - first) / span;

  return group
    .map((mover) => ({
      ...mover,
      day,
      at: (direction > 0 ? across(mover) : 1 - across(mover)) * spread + mover.lead,
    }))
    .sort((a, b) => front(a) - front(b));
};

/** The closest two blocks of the same day may ever come, as a share of the frame. */
const CLEARANCE = 0.03;

/**
 * And the distance the day arriving keeps behind the day leaving. Wider than the
 * clearance between neighbours: the two days are separate views of the week, and
 * the reader should be able to read the space between them as the join.
 */
const PARTING = 1 / PHI ** 5;

/**
 * What one block needs from another before it can move, in ground the other has
 * to cover — or nothing at all, if the other is not in its way.
 *
 * Only the painted pieces are compared, and only those pieces of the two that
 * line up horizontally. Of those, only the ones where the other block really is
 * in front along the line of travel count: where it is behind, it is that block's
 * problem, not this one's. Getting this from the pieces is what stops a block
 * that is merely carved around another from being treated as standing in its way
 * — their envelopes always overlap; their shapes never do.
 */
const roomFor = (ahead: Mover, behind: Mover, direction: number, apart: number) => {
  let room: number | null = null;

  for (const front of ahead.pieces) {
    for (const back of behind.pieces) {
      if (!overlapsDown(front, back)) continue;

      const frontEdge = direction > 0 ? front.right + ahead.from : front.left + ahead.from;
      const backEdge = direction > 0 ? back.left + behind.from : back.right + behind.from;
      /** how far apart they stand now; negative means this one is not in front */
      const gap = direction > 0 ? backEdge - frontEdge : frontEdge - backEdge;
      if (gap < 0) continue;

      room = Math.max(room ?? -Infinity, apart - gap);
    }
  }

  return room;
};

/**
 * Times every block of both days as traffic on one conveyor, the day leaving
 * ahead of the day arriving, and hands back each day's blocks arranged from the
 * front of the travel to the back.
 *
 * Every block is checked against every other one that is in front of it at the
 * only two moments their distance can be at its least — the schedule is laid out
 * in steady time, where every block covers its ground at a constant rate, so
 * between those moments every gap changes at a steady rate and cannot dip
 * between them:
 *
 *   · when the block sets off, the one ahead must already have left it room;
 *   · when the block stops, the one ahead must have gone that much further
 *     again, because a block only stops once it is standing in its slot, and
 *     the one ahead may still be crossing the ground that slot is on.
 *
 * Both come out as "how far the one ahead must have travelled", turned into a
 * time by its own rate. A block parked beyond the frame edge is already clear of
 * everything for the first check, so that one often comes out negative and lets
 * it set off with the day that is still leaving — which is what keeps both days
 * on screen at once instead of the reader watching an empty frame go by. The
 * second check is what holds it back from landing on top of anything.
 *
 * The demands are then settled by going over them until nothing moves. Being in
 * front is a matter of geometry, and no block is in front of itself, so there is
 * no circle to get stuck in: each pass fixes at least the block nearest the
 * front that is still out of place, and the whole thing lands inside as many
 * passes as there are blocks.
 *
 * Steady time is the schedule's own clock, not the clock it is watched on: the
 * change plays it back through an eased warp of that clock, which is monotonic
 * and shared by every block, so at any instant the whole strip stands exactly
 * where it stood at one moment of this plan — and so keeps every clearance
 * proved here.
 */
const schedule = (
  groups: { group: Mover[]; spread: number }[],
  direction: number,
  clearance: number,
  parting: number,
) => {
  const planned = groups.map(({ group, spread }, day) => swept(group, direction, spread, day));
  const all = planned.flat();

  const demands = all.flatMap((behind) =>
    all
      .filter((ahead) => ahead !== behind)
      .map((ahead) => ({
        ahead,
        behind,
        /** neighbours keep the clearance; the day behind keeps the wider parting */
        room: roomFor(ahead, behind, direction, ahead.day === behind.day ? clearance : parting),
      }))
      .filter((demand): demand is { ahead: Mover; behind: Mover; room: number } =>
        demand.room !== null,
      ),
  );

  for (let pass = 0; pass < all.length; pass++) {
    let shifted = false;

    for (const { ahead, behind, room } of demands) {
      /** all the ground the one ahead has to give, and no more can be asked of it */
      const reach = Math.abs(ahead.to - ahead.from);
      /** what it must have covered by the time this block stops in its slot */
      const berth = Math.min(room + Math.abs(behind.to - behind.from), reach);
      const at = Math.max(
        behind.at,
        ahead.at + Math.min(room, reach) / ahead.rate,
        ahead.at + berth / ahead.rate - behind.duration,
      );

      if (at > behind.at) {
        behind.at = at;
        shifted = true;
      }
    }

    if (!shifted) break;
  }

  return planned;
};

const readBack = <T,>(group: Mover[], value: (mover: Mover) => T) =>
  new Map(group.map((mover) => [mover.event, value(mover)] as const));

const endsAt = (group: Mover[]) => Math.max(0, ...group.map((mover) => mover.at + mover.duration));

/** Reads a per-event value back out for one of its pieces. */
const perEvent =
  <T,>(plan: Map<string, T>, fallback: T) =>
  (_index: number, target: Element) =>
    plan.get(eventOf(target)) ?? fallback;

const dayPieces = (layer: Element) =>
  gsap.utils.toArray<HTMLElement>("[data-anim='block'], [data-anim='fillet']", layer);

/**
 * Changes the day in place: the grid, the current-time indicator, the scrubber
 * and the bar stay exactly where they are, and only the events of the day are
 * exchanged.
 *
 * The two days are one strip of traffic running past the frame, so nothing
 * fades: blocks are only ever moved, and the frame does the hiding. The day
 * leaving is ahead on that strip and the day arriving follows it in, close
 * enough that both are on screen at once — the reader never watches an empty
 * frame go by — but never so close that two blocks touch. `schedule` works out
 * who can set off when; `gone` and `settled` are read back off its plan, so the
 * change lasts exactly as long as the day it is carrying needs.
 *
 * A change is kept alive for as long as it is running. Turning back while it is
 * still going does not start anything new: the same timeline is simply told to
 * run the other way from wherever its playhead has got to, so the days move back
 * the way they came instead of jumping to a fresh start.
 */
export function useDayTransition(
  root: RefObject<HTMLDivElement | null>,
  index: number,
  direction: number,
) {
  const shown = useRef<number | null>(null);
  const change = useRef<{
    timeline: gsap.core.Timeline;
    /** the strip the timeline reads: killed with it, since it is not a child */
    strip: gsap.core.Timeline;
    from: number;
    to: number;
  } | null>(null);

  useIsomorphicLayoutEffect(() => {
    const element = root.current;
    if (!element) return;

    const layers = gsap.utils.toArray<HTMLElement>("[data-anim='day-layer']", element);
    const incoming = layers[index];
    const previous = shown.current;
    const outgoing = previous === null ? undefined : layers[previous];
    shown.current = index;

    if (!incoming) return;

    /** the scrubber's band, and the share of the week the open day asks it for */
    const band = element.querySelector<HTMLElement>("[data-week]");
    const weekBehind = Number(band?.dataset.week ?? 0);

    const settle = () =>
      layers.forEach((layer, position) =>
        gsap.set(layer, { autoAlpha: position === index ? 1 : 0 }),
      );

    // the first render is simply the day the screen opens on — the band is left
    // to the load-in, which fills it to this day's share as the screen arrives
    if (previous === null || previous === index) {
      settle();
      return;
    }

    // a change between these two days is already on its way: steer it rather than
    // start again, so an interrupted change runs back from where it had got to
    const running = change.current;
    if (running && running.timeline.isActive()) {
      if (running.to === index && running.from === previous) {
        running.timeline.play();
        return;
      }
      if (running.from === index && running.to === previous) {
        running.timeline.reverse();
        return;
      }
      running.timeline.kill();
      running.strip.kill();
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !outgoing) {
      settle();
      if (band) gsap.set(band, { scaleX: weekBehind });
      return;
    }

    const frame = incoming.clientWidth;
    /**
     * How fast a block covers ground. The day leaving crosses the frame one
     * φ-step slower than the day arriving, so a block that starts against the
     * edge it leaves by is carried out rather than flicked off it.
     */
    const outRate = frame / beat(1);
    const inRate = frame / beat(0);

    const leaving = dayPieces(outgoing);
    const arriving = dayPieces(incoming);
    const leavingShapes = eventPieces(leaving);
    const arrivingShapes = eventPieces(arriving);
    const arrivingBoxes = new Map(
      [...arrivingShapes].map(([event, pieces]) => [event, envelope(pieces)] as const),
    );
    const waiting = standOff(arrivingBoxes, direction, frame, frame * ROOM);

    // the day leaving crosses a whole frame and a parting, so it always has
    // enough ground to give way to anything coming in behind it; the day arriving
    // waits a band at a time, each band holding its own layout
    const [outMovers, inMovers] = [
      movers(leavingShapes, {
        from: () => 0,
        to: () => -direction * frame * (1 + PARTING),
        rate: outRate,
      }),
      movers(arrivingShapes, {
        from: (_box, event) => waiting.get(event) ?? 0,
        to: () => 0,
        rate: inRate,
      }),
    ];

    const timed = schedule(
      [
        { group: outMovers, spread: beat(-2) },
        { group: inMovers, spread: beat(-2) },
      ],
      direction,
      frame * CLEARANCE,
      frame * PARTING,
    );

    const [going, coming] = timed;

    /** the day that left is out of shot once its last block has stopped */
    const gone = endsAt(going);
    /** and the change is over once the last block of either day has stopped */
    const settled = Math.max(gone, endsAt(coming));

    // stand the day that is arriving where it sets off from. It can be switched
    // on straight away: every one of its blocks is out of shot until it moves.
    gsap.set(arriving, { x: perEvent(readBack(coming, (mover) => mover.from), 0) });
    gsap.set(incoming, { autoAlpha: 1 });

    const timeline = gsap.timeline();

    // the schedule is played back as one strip: its blocks are laid out on their
    // own steady clock, and the change reads that clock through an ease. Every
    // block is therefore always at the same moment of the plan as every other,
    // which is what lets the whole day set off and come to rest on a curve
    // without any two of them closing on each other — a single block given the
    // same curve would run its own journey at its own rate and could overtake.
    const strip = gsap.timeline({ paused: true });

    strip
      .to(
        leaving,
        {
          x: perEvent(readBack(going, (mover) => mover.to), 0),
          duration: perEvent(readBack(going, (mover) => mover.duration), beat(-3)),
          ease: "none",
          stagger: perEvent(readBack(going, (mover) => mover.at), 0),
        },
        0,
      )
      .to(
        arriving,
        {
          x: 0,
          duration: perEvent(readBack(coming, (mover) => mover.duration), beat(-3)),
          ease: "none",
          stagger: perEvent(readBack(coming, (mover) => mover.at), 0),
        },
        0,
      )
      // the day that left is put back exactly as it was, ready to be shown again
      .set(outgoing, { autoAlpha: 0 }, gone)
      .set(leaving, { x: 0 }, gone);

    // and the change is the reading of that clock: the same span of steady time,
    // read at one pace and eased off only at the end. The strip is only ever
    // scrubbed by this tween, so it is dropped once the tween is spent —
    // whichever end it finishes at.
    const spent = () => strip.kill();

    timeline.fromTo(
      strip,
      { time: 0 },
      {
        time: settled,
        duration: settled,
        ease: EASE.conveyor,
        onComplete: spent,
        onReverseComplete: spent,
      },
      0,
    );

    // nothing else in the screen moves with the day. The hour rules, their
    // labels and the current-hour marker are the fixed thing it is read against
    // — the same reason the scrubber's ruling stays put — and the day itself
    // stops dead in its slots: it is already easing off as it lands, so there
    // is nothing left over for it to run past them with.

    // the week fills or empties across the whole exchange, so the band comes to
    // rest on its new share at the same moment the last block does — and it is
    // read at the day's own pace, so the two never pull against each other
    if (band) {
      timeline.to(band, { scaleX: weekBehind, duration: settled, ease: EASE.conveyor }, 0);
    }

    change.current = { timeline, strip, from: previous, to: index };
  }, [root, index, direction]);

  // the running change belongs to the screen, not to one render of it
  useEffect(
    () => () => {
      change.current?.timeline.kill();
      change.current?.strip.kill();
    },
    [],
  );
}
