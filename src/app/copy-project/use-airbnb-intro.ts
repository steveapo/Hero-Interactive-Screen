"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

/**
 * The Fairbnb desktop screen's opening sequence. It reads top to bottom, the way the eye takes in
 * the page, and each band arrives with its own gesture:
 *
 *   0.00  the window lights up
 *   0.10  the logo slides in; the search pill unfolds from its centre, its fields rise in, then
 *         the Rausch search button spins into place; the header's nav trails in on the right
 *   0.30  the category row rises left to right; the active underline draws itself
 *   0.46  the trip card lifts into place; its nights numeral rolls up out of a mask
 *   0.56  the check-in banner is unveiled left to right and settles from a slow zoom
 *   0.80  the listings are unveiled one after another, photos settling, hearts popping
 *   1.30  the Show map button springs up last, the one floating control
 *
 * The trip card (the card the demo builds on) is fully settled by ~1.3s, before the Portal's
 * built components measure it. Every transform is cleared when its tween ends, so nothing is
 * left offset once the sequence is done.
 */

const EASE = {
  /** Fast out, long settle: things being unveiled. */
  reveal: "expo.out",
  /** Movement into place. */
  rise: "power3.out",
  fade: "power2.out",
  /** Small controls landing with a little overshoot. */
  pop: "back.out(2)",
  /** The floating Show map button: a spring let go. */
  spring: "elastic.out(1, 0.6)",
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const q = (name: string) => `[data-anim='${name}']`;

/** Listing pieces stagger by their card's rank (`data-order` on the card). */
const byCard = (step: number) => (_index: number, target: Element) =>
  Number(target.closest<HTMLElement>("[data-order]")?.dataset.order ?? 0) * step;

export function useAirbnbIntro(root: RefObject<HTMLDivElement | null>, speed = 1) {
  useIsomorphicLayoutEffect(() => {
    const element = root.current;
    if (!element) return;

    const media = gsap.matchMedia(element);

    media.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { reduced } = context.conditions as { motion: boolean; reduced: boolean };
        if (reduced) {
          gsap.set(element, { opacity: 1 });
          return;
        }

        /** 1cqw of the screen, in px: offsets scale with the screen like everything else. */
        const cq = element.clientWidth / 100;
        const tl = gsap.timeline({ defaults: { ease: EASE.rise } });
        tl.timeScale(speed);

        // 1 — the window lights up
        tl.fromTo(element, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: EASE.fade }, 0);

        // 2 — header: logo, the search pill unfolding from its centre (a clip, so its round ends
        //     stay round the whole way), its fields, the search button, then the nav on the
        //     right. The clip hides the pill's shadow, so the shadow fades in once it's open.
        tl.from(q("logo"), { x: -1.4 * cq, opacity: 0, duration: 0.6, clearProps: "transform" }, 0.1)
          .fromTo(
            q("search-pill"),
            { clipPath: "inset(0% 22% 0% 22% round 2cqw)", opacity: 0 },
            { clipPath: "inset(0% 0% 0% 0% round 2cqw)", opacity: 1, duration: 0.8, ease: EASE.reveal, clearProps: "clipPath" },
            0.12,
          )
          .from(q("search-pill"), { boxShadow: "0 0 0 rgba(0,0,0,0)", duration: 0.4, ease: EASE.fade, clearProps: "boxShadow" }, 0.92)
          .from(q("search-field"), { y: 0.6 * cq, opacity: 0, duration: 0.5, stagger: 0.07, clearProps: "transform" }, 0.28)
          .from(q("search-button"), { scale: 0, rotate: -120, duration: 0.7, ease: EASE.pop, clearProps: "transform" }, 0.36)
          .from(q("nav-item"), { y: -0.8 * cq, opacity: 0, duration: 0.5, stagger: 0.06, clearProps: "transform" }, 0.2);

        // 3 — categories rise left to right; the active underline draws itself
        tl.from(q("category"), { y: 0.8 * cq, opacity: 0, duration: 0.55, stagger: 0.035, clearProps: "transform" }, 0.3)
          .from(q("category-underline"), { scaleX: 0, duration: 0.7, ease: EASE.reveal, clearProps: "transform" }, 0.56);

        // 4 — section headings, each with its section
        tl.from(q("section-head"), { y: 0.7 * cq, opacity: 0, duration: 0.55, stagger: 0.34, clearProps: "transform" }, 0.42);

        // 5 — the trip card lifts into place, then its contents
        tl.from(
          `${q("trip")} ${q("block")}`,
          { y: 1.6 * cq, scale: 0.98, opacity: 0, duration: 0.8, ease: EASE.reveal, clearProps: "transform,opacity" },
          0.46,
        )
          .from(`${q("trip")} ${q("title")}`, { y: 0.6 * cq, opacity: 0, duration: 0.55, clearProps: "transform" }, 0.58)
          .from(`${q("trip")} ${q("line")}`, { y: 0.5 * cq, opacity: 0, duration: 0.5, stagger: 0.06, clearProps: "transform" }, 0.64)
          .from(q("numeral"), { yPercent: 105, duration: 0.8, ease: EASE.reveal, clearProps: "transform" }, 0.68)
          .from(q("unit"), { x: -0.6 * cq, opacity: 0, duration: 0.5, clearProps: "transform" }, 0.84);

        // 6 — the check-in banner is unveiled left to right and settles from a slow zoom
        tl.fromTo(
          q("tile"),
          { clipPath: "inset(0% 100% 0% 0% round 1cqw)" },
          { clipPath: "inset(0% 0% 0% 0% round 1cqw)", duration: 1, ease: EASE.reveal, clearProps: "clipPath" },
          0.56,
        )
          .from(q("tile-photo"), { scale: 1.18, duration: 1.5, ease: EASE.fade, clearProps: "transform" }, 0.56)
          .from(q("tile-text"), { y: 0.6 * cq, opacity: 0, duration: 0.5, stagger: 0.06, clearProps: "transform" }, 0.86);

        // 7 — the listings, one after another
        const LISTING = 0.8;
        const STEP = 0.09;
        tl.fromTo(
          q("photo"),
          { clipPath: "inset(0% 0% 100% 0% round 1cqw)" },
          {
            clipPath: "inset(0% 0% 0% 0% round 1cqw)",
            duration: 0.9,
            ease: EASE.reveal,
            stagger: byCard(STEP),
            clearProps: "clipPath",
          },
          LISTING,
        )
          .from(q("photo-img"), { scale: 1.3, duration: 1.5, ease: EASE.fade, stagger: byCard(STEP), clearProps: "transform" }, LISTING)
          .from(q("heart"), { scale: 0, duration: 0.55, ease: EASE.pop, stagger: byCard(STEP), clearProps: "transform" }, LISTING + 0.4)
          .from(q("pill"), { x: -0.8 * cq, opacity: 0, duration: 0.5, stagger: byCard(STEP), clearProps: "transform" }, LISTING + 0.45)
          .from(q("dots"), { opacity: 0, duration: 0.5, stagger: byCard(STEP) }, LISTING + 0.5)
          .from(
            `${q("listing-text")} > *`,
            { y: 0.5 * cq, opacity: 0, duration: 0.5, stagger: 0.03, clearProps: "transform" },
            LISTING + 0.22,
          );

        // 8 — the Show map button springs up last
        tl.from(q("map-pill"), { y: 2 * cq, scale: 0.8, opacity: 0, duration: 1.1, ease: EASE.spring, clearProps: "transform" }, 1.3);
      },
    );

    return () => media.revert();
  }, [root, speed]);
}
