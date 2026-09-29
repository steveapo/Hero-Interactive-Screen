"use client";

import { useRef, useState } from "react";
import gsap from "gsap";

import { cn } from "./utils";
import { EASE, beat, useIsomorphicLayoutEffect } from "./use-planner-intro";

/**
 * A read-out that changes like a gauge wheel: the value on show rolls out of the
 * window while the new one rolls in behind it — upwards when the day steps
 * forward, downwards when it steps back. Nothing fades; the window does the
 * hiding, exactly like the frame does for the events.
 *
 * Both halves share one duration and one eased curve, so the pair reads as a
 * single wheel turning rather than two texts passing each other. The wheel is
 * given two φ-steps more than the screen's base beat: a word travelling its own
 * height is read the whole way, so it is turned slowly enough that the eye can
 * follow the letters rather than see them blink over.
 *
 * The window is a single grid cell that every value is laid into — the ones on
 * show and an invisible copy of each value the read-out can ever hold — so the
 * cell is always as wide as the widest of them and the read-out never changes
 * size as it turns. Figures are set tabular for the same reason, and the window
 * carries a sliver of right padding to give the last glyph the room the negative
 * tracking takes away from it.
 */
export function RollingReadout({
  value,
  direction,
  sizes,
  className,
}: {
  value: string;
  direction: number;
  /** every value this read-out can show; the widest one reserves the width */
  sizes?: string[];
  className?: string;
}) {
  const frame = useRef<HTMLSpanElement>(null);
  const settled = useRef(value);
  const [roll, setRoll] = useState<{ from: string; to: string } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (value === settled.current) return;
    setRoll({ from: settled.current, to: value });
    settled.current = value;
  }, [value]);

  useIsomorphicLayoutEffect(() => {
    const window_ = frame.current;
    if (!window_) return;

    const spans = window_.querySelectorAll("[data-roll]");

    /**
     * Between two rolls there is one span in the window, and it is the one that
     * rolled out of it last time. It is handed back to its place here, in the
     * render that has just put the settled value into it. Handing it back any
     * earlier — as the turn that rolled it away finished — left the value it
     * used to hold standing in the window for the frame before React swapped
     * the text, and that is the second number appearing beside the new one.
     */
    if (!roll) {
      gsap.set(spans, { clearProps: "transform" });
      return;
    }

    const [leaving, arriving] = Array.from(spans);

    // where the two of them stand before the wheel turns, said outright rather
    // than left to the timeline's first frame: the value on show at its place in
    // the window, the one coming in exactly one window behind it. Saying it here
    // is also what lets a turn interrupted part-way set off from a known
    // position instead of from whatever transform the last one had reached.
    gsap.set(leaving, { yPercent: 0 });
    gsap.set(arriving, { yPercent: 100 * direction });

    const timeline = gsap.timeline({ onComplete: () => setRoll(null) });

    timeline
      .to(leaving, { yPercent: -100 * direction, duration: beat(2), ease: EASE.wheel }, 0)
      .to(arriving, { yPercent: 0, duration: beat(2), ease: EASE.wheel }, 0);

    return () => {
      timeline.kill();
    };
  }, [roll, direction]);

  return (
    <span
      ref={frame}
      className={cn("grid overflow-hidden pr-[0.08em] -mr-[0.08em] tabular-nums", className)}
    >
      {(sizes ?? [value]).map((reserved) => (
        <span key={reserved} aria-hidden className="invisible col-start-1 row-start-1">
          {reserved}
        </span>
      ))}
      <span data-roll className="col-start-1 row-start-1">
        {roll ? roll.from : value}
      </span>
      {roll && (
        <span data-roll className="col-start-1 row-start-1">
          {roll.to}
        </span>
      )}
    </span>
  );
}
