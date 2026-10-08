"use client"

import { useLayoutEffect, useRef } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EventCardStyle, VariantPart } from "./agent-script"
import type { VariantState } from "./build-agents"
import { CODEBASE_WIDTH } from "./codebase-frame"
import { AgentStar } from "./planner-frame"

const LABEL_GREY = "#78716c"
/** The agent's own selection colour (the frames it is editing right now). */
const AGENT_PURPLE = "#8b5cf6"

/** Variants slide out of their source: duration, curve and starting scale. */
const VARIANT_ENTER_MS = 700
const VARIANT_ENTER_EASING = "cubic-bezier(0.16, 1, 0.3, 1)"
const VARIANT_ENTER_SCALE = 0.85

/** Which style keys each editable piece covers. */
const PART_KEYS: Record<VariantPart, (keyof EventCardStyle)[]> = {
  card: ["card"],
  title: ["header", "title"],
  lines: ["lines"],
  duration: ["duration", "number", "unit", "unitText"],
}

/** The selector the agent cursor uses to find a piece on the canvas. */
export function agentPartSelector(variantId: string, part: VariantPart) {
  return `[data-agent-part="${variantId}:${part}"]`
}

/**
 * The variant's card as it stands: each piece has the source's style until the agent lands the
 * new one. Rebuilt variants hide their cleared pieces until the agent puts them back (in the new
 * style, highlighted while it does).
 */
function EventVariantCard({ variant }: { variant: VariantState }) {
  const { source, spec, applied, highlight, cleared } = variant
  const isNew = (part: VariantPart) => applied.includes(part) || (cleared && highlight === part)
  const visible = (part: VariantPart) => part === "card" || !cleared || applied.includes(part) || highlight === part

  function style(part: VariantPart): EventCardStyle {
    if (!isNew(part)) return source.base
    const next = { ...source.base }
    for (const key of PART_KEYS[part]) {
      const value = spec.style[key]
      if (value !== undefined) (next as Record<string, string | undefined>)[key] = value
    }
    return next
  }

  const card = style("card").card
  const title = style("title")
  const lines = style("lines").lines
  const duration = style("duration")
  const showHeader = visible("title") || (source.lines.length > 0 && visible("lines"))

  return (
    <div
      data-agent-part={`${variant.id}:card`}
      className={cn("absolute inset-0 isolate overflow-hidden transition-[background,border-radius,box-shadow,padding] duration-500", card)}
    >
      {showHeader && (
        <div className={title.header}>
          {visible("title") && (
            <Piece variant={variant} part="title" fresh={isNew("title")}>
              <p className={title.title}>{source.title}</p>
            </Piece>
          )}
          {source.lines.length > 0 && visible("lines") && (
            <Piece variant={variant} part="lines" fresh={isNew("lines")}>
              {source.lines.map((line) => (
                <p key={line} className={lines}>
                  {line}
                </p>
              ))}
            </Piece>
          )}
        </div>
      )}
      {visible("duration") && (
        <Piece variant={variant} part="duration" fresh={isNew("duration")} className={duration.duration}>
          <span className={duration.number}>{source.duration}</span>
          <span className={duration.unit}>{duration.unitText ?? "MIN"}</span>
        </Piece>
      )}

      {/* Editing the card itself: tint all of it */}
      {highlight === "card" && <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-[#2f6bf6]/20" />}
    </div>
  )
}

/**
 * A variant's finished card (every piece in its new style), e.g. built into the live app.
 * Fills its positioned parent; cqw resolve against the nearest container (the desktop screen).
 */
export function FinishedEventCard({ variant }: { variant: VariantState }) {
  return (
    <EventVariantCard
      variant={{ ...variant, id: `${variant.id}-live`, applied: variant.spec.parts, highlight: null, cleared: false }}
    />
  )
}

/** One editable piece; remounts (fading in) when its new style lands, highlighted while edited. */
function Piece({
  variant,
  part,
  fresh,
  className,
  children,
}: {
  variant: VariantState
  part: VariantPart
  fresh: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      key={fresh ? "new" : "old"}
      data-agent-part={`${variant.id}:${part}`}
      className={cn("relative", fresh && "animate-in fade-in duration-300", className)}
    >
      {variant.highlight === part && (
        <span aria-hidden="true" className="absolute -inset-[0.4cqw] -z-10 rounded-[0.3cqw] bg-[#2f6bf6]/30" />
      )}
      {children}
    </div>
  )
}

/**
 * A variant the Build Agent generated, on the canvas next to the rest. Laid out like a design
 * frame (artwork at canvas size, scaled with zoom). The variants being edited right now get the
 * agent's purple selection; the others carry no outline.
 */
export function VariantFrame({
  variant,
  zoom,
  offsetX,
  offsetY,
  pickable = false,
  onPick,
  built = false,
}: {
  variant: VariantState
  zoom: number
  offsetX: number
  offsetY: number
  /** "Choose where to build" is on: hovering shows "Build this", clicking picks the variant. */
  pickable?: boolean
  onPick?: () => void
  /** This variant has been built into the codebase. */
  built?: boolean
}) {
  const { rect, from } = variant
  const ref = useRef<HTMLDivElement>(null)

  // Slide out of the source on mount.
  const entrance = useRef({ x: (from.x - rect.x) * zoom, y: (from.y - rect.y) * zoom })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const { x, y } = entrance.current
    const animation = el.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(${VARIANT_ENTER_SCALE})`, opacity: 0 },
        { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
      ],
      { duration: VARIANT_ENTER_MS, easing: VARIANT_ENTER_EASING },
    )
    return () => animation.cancel()
  }, [])

  const width = rect.w * zoom
  return (
    <div
      ref={ref}
      data-cursor-id={`variant-${variant.id}`}
      data-agent-status={variant.status}
      data-variant-source={variant.source.elementId}
      data-variant-label={variant.spec.label}
      className={cn("group/variant absolute -translate-x-1/2 -translate-y-1/2", pickable && "cursor-pointer")}
      style={{
        left: `calc(50% + ${offsetX + rect.x * zoom}px)`,
        top: `calc(50% + ${offsetY + rect.y * zoom}px)`,
        width,
        height: rect.h * zoom,
      }}
      onPointerDown={
        pickable
          ? (e) => {
              e.stopPropagation() // keep the selection (and its chat) while picking
              onPick?.()
            }
          : undefined
      }
    >
      <span
        className="absolute -top-7 left-0 flex h-6 items-center overflow-hidden whitespace-nowrap font-medium"
        style={{ fontSize: 13, color: LABEL_GREY, maxWidth: Math.max(width, 40) }}
      >
        <span className="truncate">{variant.name}</span>
      </span>

      <div className="pointer-events-none relative size-full">
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ width: rect.w, height: rect.h, transform: `scale(${zoom})` }}
        >
          <div className="@container absolute left-0 top-0 h-full" style={{ width: CODEBASE_WIDTH }}>
            <div className="relative h-full" style={{ width: rect.w }}>
              <EventVariantCard variant={variant} />
            </div>
          </div>
        </div>
      </div>

      {/* Picking: a green outline and "Build this" on hover */}
      {pickable && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[4px] rounded-[4px] border-2 border-dashed border-green-600/40 transition-colors group-hover/variant:border-solid group-hover/variant:border-green-600"
        >
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-green-700 px-2.5 py-1 text-[12px] font-semibold text-white opacity-0 shadow-[0_4px_12px_-2px_rgba(21,128,61,0.4)] transition-opacity group-hover/variant:opacity-100">
            Build this
          </span>
        </div>
      )}
      {built && <div aria-hidden="true" className="pointer-events-none absolute -inset-[4px] rounded-[4px] border-2 border-mi-lime-deep" />}
      {/* Built into the codebase: a check on the frame's top-left corner */}
      {built && (
        <span
          aria-label="In codebase"
          className="pointer-events-none absolute -left-[11px] -top-[11px] z-10 flex size-[22px] items-center justify-center rounded-full bg-mi-lime text-mi-lime-ink shadow-[0_4px_10px_-2px_rgba(90,122,24,0.45)] ring-2 ring-white animate-in zoom-in-50 fade-in duration-200"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}

      {/* The agent is editing this one: its purple selection with corner handles */}
      {variant.status === "building" && (
        <div aria-hidden="true" className="pointer-events-none absolute -inset-[3px] animate-in fade-in duration-200" style={{ border: `1px solid ${AGENT_PURPLE}` }}>
          {[
            "-left-[4px] -top-[4px]",
            "-right-[4px] -top-[4px]",
            "-bottom-[4px] -left-[4px]",
            "-bottom-[4px] -right-[4px]",
          ].map((corner) => (
            <span key={corner} className={cn("absolute size-[7px] border bg-white", corner)} style={{ borderColor: AGENT_PURPLE }} />
          ))}
        </div>
      )}

    </div>
  )
}

/**
 * The agent's cursor: a green arrow pointer (tip at the point) with a small "Build Agent" tag,
 * gliding to the top-left of the piece it's editing. Positioned in canvas units under a
 * zoom-scaled layer, so the glide (a CSS transition on the inner translate) is independent of
 * panning and zooming; the pointer is counter-scaled to stay screen-sized.
 */
export function AgentCursor({ x, y, zoom, offsetX, offsetY }: { x: number; y: number; zoom: number; offsetX: number; offsetY: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 z-10 origin-top-left"
      style={{ transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})` }}
    >
      <div
        className="absolute left-0 top-0"
        style={{ transform: `translate(${x}px, ${y}px)`, transition: "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="origin-top-left" style={{ transform: `scale(${1 / zoom})` }}>
          <div className="relative animate-in zoom-in-50 fade-in duration-200">
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              aria-hidden="true"
              className="-translate-x-[3px] -translate-y-[2px] drop-shadow-[0_2px_3px_rgba(22,33,10,0.35)]"
            >
              <path
                d="M3 2.2v15.6c0 .5.6.8 1 .4l3.7-3.6 2.4 5.5c.2.4.6.6 1 .4l2-.9c.4-.2.6-.6.4-1l-2.4-5.4h5.2c.5 0 .8-.6.4-1L4 1.8c-.4-.4-1-.1-1 .4Z"
                className="fill-mi-lime stroke-mi-lime-ink"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <span className="absolute left-[14px] top-[18px] flex items-center gap-1 whitespace-nowrap rounded-full bg-mi-lime py-0.5 pl-1.5 pr-2 text-[11px] font-semibold leading-4 text-mi-lime-ink shadow-[0_4px_12px_-2px_rgba(90,122,24,0.35)]">
              <AgentStar className="size-[10px] animate-spin [animation-duration:2.4s]" />
              Build Agent
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
