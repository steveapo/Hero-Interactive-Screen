"use client"

import { Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ChangedFile, DiffRow } from "./code-changes-popover"
import { CODEBASE_WIDTH } from "./codebase-frame"
import type { CanvasRect } from "./drag"

/**
 * Design-system components pulled onto the canvas: drag a tile out of the left sidebar's
 * Components library onto a card frame and an instance of it lands inside that frame. It can
 * then be designed (moved, relabelled, recoloured, resized) and built into the codebase by the
 * Build Agent, after which it shows up on the same card in the live app.
 *
 * Instances are authored in cqw of the desktop screen, like the app's artwork, so the same
 * instance renders identically in a frame on the canvas and on the card in the live app.
 */

const SELECT_BLUE = "#2f6bf6"

/** 1cqw of the desktop screen, in canvas units. */
export const CQW = CODEBASE_WIDTH / 100

/** Library components that can be dragged onto a frame (the others are previews only). */
export const INSERTABLE_COMPONENTS = ["Badge"] as const
export type InsertableComponent = (typeof INSERTABLE_COMPONENTS)[number]

export function isInsertable(name: string): name is InsertableComponent {
  return (INSERTABLE_COMPONENTS as readonly string[]).includes(name)
}

export type BadgeTone = "neutral" | "lime" | "red" | "outline"
export type BadgeSize = "sm" | "md" | "lg"

/** An instance of a library component inside a frame. */
export type FrameComponent = {
  id: string
  component: InsertableComponent
  /** The card frame it sits in. */
  frameId: string
  /** Title of that card in the live app ("Vernazza Sea House"): where it's built. */
  cardTitle: string
  /** Top-left corner inside the frame, in canvas units. */
  x: number
  y: number
  label: string
  tone: BadgeTone
  size: BadgeSize
}

/** A fresh instance, as it comes out of the library (the Badge preview's look). */
export const NEW_BADGE: Pick<FrameComponent, "label" | "tone" | "size"> = { label: "Badge", tone: "neutral", size: "md" }

/** Rough canvas-unit size of a fresh Badge, to centre it on the drop point. */
export const NEW_BADGE_SIZE = { w: 5 * CQW, h: 2 * CQW }

export const BADGE_TONES: { id: BadgeTone; label: string; swatch: string }[] = [
  { id: "neutral", label: "Neutral", swatch: "#111111" },
  { id: "lime", label: "Lime", swatch: "#c2ec66" },
  { id: "red", label: "Red", swatch: "#e4321b" },
  { id: "outline", label: "Outline", swatch: "#ffffff" },
]

export const BADGE_SIZES: { id: BadgeSize; short: string; label: string }[] = [
  { id: "sm", short: "S", label: "Small" },
  { id: "md", short: "M", label: "Medium" },
  { id: "lg", short: "L", label: "Large" },
]

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-[#111111] text-white",
  lime: "bg-[#c2ec66] text-[#16210a]",
  red: "bg-[#e4321b] text-white",
  outline: "border-black/20 bg-white text-[#2f2f2f]",
}

/** Sizes in cqw of the 1440-wide desktop screen (lg ≈ 37px tall at full size). */
const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: "h-[1.6cqw] px-[0.65cqw] text-[0.75cqw]",
  md: "h-[2cqw] px-[0.85cqw] text-[0.95cqw]",
  lg: "h-[2.55cqw] px-[1.15cqw] text-[1.25cqw]",
}

/**
 * The library's Badge (components/ui/badge), sized in cqw. `done` is the checked-in state the built
 * badge toggles to in the live app once the Portal Agent has made it functional.
 */
export function FrameBadge({
  instance,
  done = false,
  className,
}: {
  instance: Pick<FrameComponent, "label" | "tone" | "size">
  done?: boolean
  className?: string
}) {
  return (
    <Badge
      variant={instance.tone === "outline" ? "outline" : "default"}
      className={cn(
        "gap-[0.45em] rounded-full border-[0.09cqw] py-0 font-bold leading-none tracking-tight transition-colors duration-300",
        SIZE_CLASS[instance.size],
        // Done: a soft success pill (the check sits in its own filled disc), so it reads as a state.
        done ? "border-[#1e7b36]/25 bg-[#e3f1e5] pl-[0.3em] text-[#1e7b36]" : TONE_CLASS[instance.tone],
        className,
      )}
    >
      {done && (
        // Wrapped in a span: the Badge forces direct svg children to 12px, which doesn't scale with cqw.
        <span aria-hidden="true" className="flex size-[1.35em] shrink-0 items-center justify-center rounded-full bg-[#1e7b36] text-white">
          <Check className="size-[0.85em]" strokeWidth={3.5} />
        </span>
      )}
      <span>{done ? "Checked in" : instance.label || "Badge"}</span>
    </Badge>
  )
}

/**
 * The instances inside the canvas frames, over the frames themselves. Each is laid out at canvas
 * size in a container as wide as the desktop screen (so cqw resolve like the artwork) and scaled with zoom.
 * Press one to select it; drag it to move it inside its frame.
 */
export function FrameComponentsLayer({
  components,
  frameRects,
  camera,
  selectedId,
  onPress,
}: {
  components: FrameComponent[]
  frameRects: Record<string, CanvasRect>
  camera: { x: number; y: number; zoom: number }
  selectedId: string | null
  onPress: (e: React.PointerEvent, id: string) => void
}) {
  return (
    <>
      {components.map((c) => {
        const frame = frameRects[c.frameId]
        if (!frame) return null
        const left = frame.x - frame.w / 2 + c.x
        const top = frame.y - frame.h / 2 + c.y
        const selected = selectedId === c.id
        return (
          <div
            key={c.id}
            className="pointer-events-none absolute z-[12] origin-top-left"
            style={{
              left: `calc(50% + ${camera.x + left * camera.zoom}px)`,
              top: `calc(50% + ${camera.y + top * camera.zoom}px)`,
              transform: `scale(${camera.zoom})`,
            }}
          >
            <div className="@container absolute left-0 top-0" style={{ width: CODEBASE_WIDTH }}>
              <div
                data-frame-component={c.id}
                data-cursor-id={`frame-component-${c.id}`}
                className="pointer-events-auto relative w-fit cursor-default animate-in fade-in zoom-in-90 duration-300"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onPress(e, c.id)
                }}
              >
                <FrameBadge instance={c} />
                {selected && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[0.18cqw] rounded-[0.3cqw]"
                    style={{ boxShadow: `0 0 0 ${1.5 / camera.zoom}px ${SELECT_BLUE}` }}
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}

/** A library component following the pointer while it's dragged out of the sidebar (root px). */
export function ComponentDragGhost({ x, y, zoom }: { x: number; y: number; zoom: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-[45] origin-top-left"
      style={{ left: x, top: y, transform: `scale(${zoom})` }}
    >
      <div className="@container absolute left-0 top-0" style={{ width: CODEBASE_WIDTH }}>
        <div className="w-fit -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_8px_16px_rgba(17,17,16,0.25)]">
          <FrameBadge instance={NEW_BADGE} />
        </div>
      </div>
    </div>
  )
}

/** Right-side settings for a selected component instance: its props, as the design system defines them. */
export function ComponentSettingsPanel({
  instance,
  onChange,
}: {
  instance: FrameComponent
  onChange: (patch: Partial<FrameComponent>) => void
}) {
  return (
    <aside
      data-cursor-id="component-settings"
      className="absolute right-1.5 top-[46px] z-30 flex w-[326px] flex-col rounded-xl border border-stone-700/10 bg-[#f2f2f1] p-2.5 pb-3 shadow-[0_2px_10px_-2px_rgba(17,17,16,0.1),0_1px_2px_rgba(17,17,16,0.05)] animate-in fade-in slide-in-from-right-1 duration-150"
    >
      <h2 className="flex items-center gap-2 pt-1 text-[13px] font-semibold leading-4 text-stone-900">
        <ComponentGlyph />
        {instance.component}
        <span className="ml-auto rounded-full bg-[#ede9fe] px-2 py-0.5 text-[11px] font-medium text-[#6d28d9]">
          Design system
        </span>
      </h2>

      <Field label="Text">
        <input
          aria-label="Badge text"
          value={instance.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-7 w-full select-text rounded-md bg-stone-200/70 px-2 text-[13px] text-stone-900 outline-none focus:bg-white focus:shadow-[0_0_0_1px_rgba(47,107,246,0.6)]"
        />
      </Field>

      <Field label="Variant">
        <div className="flex gap-1.5">
          {BADGE_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              aria-label={tone.label}
              aria-pressed={instance.tone === tone.id}
              onClick={() => onChange({ tone: tone.id })}
              className={cn(
                "flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md text-[12px] text-stone-800 transition-colors",
                instance.tone === tone.id ? "bg-white shadow-[0_0_0_1px_rgba(47,107,246,0.6)]" : "bg-stone-200/70 hover:bg-stone-200",
              )}
            >
              <span
                className="size-3 rounded-full border border-stone-700/20"
                style={{ background: tone.swatch }}
              />
              {tone.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Size">
        <div className="flex rounded-md bg-stone-200/70 p-0.5">
          {BADGE_SIZES.map((size) => (
            <button
              key={size.id}
              type="button"
              aria-label={size.label}
              aria-pressed={instance.size === size.id}
              onClick={() => onChange({ size: size.id })}
              className={cn(
                "h-6 flex-1 rounded-[5px] text-[12px] font-medium transition-colors",
                instance.size === size.id ? "bg-white text-stone-900 shadow-[0_1px_2px_rgba(17,17,16,0.1)]" : "text-stone-600 hover:text-stone-900",
              )}
            >
              {size.short}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Source">
        <p className="flex h-7 items-center rounded-md bg-stone-200/70 px-2 font-mono text-[12px] text-stone-700">
          @/components/ui/badge
        </p>
      </Field>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2.5">
      <p className="mb-1 text-[11px] font-medium leading-4 text-stone-700">{label}</p>
      {children}
    </div>
  )
}

function ComponentGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-[#6d28d9]">
      <path d="M7 1 9.5 3.5 7 6 4.5 3.5Z" />
      <path d="M3.5 4.5 6 7 3.5 9.5 1 7Z" />
      <path d="M10.5 4.5 13 7 10.5 9.5 8 7Z" />
      <path d="M7 8 9.5 10.5 7 13 4.5 10.5Z" />
    </svg>
  )
}

/* ----------------------------- Built into code ----------------------------- */

/** File the built components land in (shown in Code changes). */
export const BUILT_COMPONENTS_FILE = "src/app/copy-project/fairbnb-screen.tsx"

/** The code change behind building frame components into the live app: one Badge per instance on its card. */
export function builtComponentsChange(components: FrameComponent[]): ChangedFile {
  const rows: DiffRow[] = []
  let left = 1
  let right = 1
  const context = (text: string) => rows.push([{ n: left++, text, kind: "context" }, { n: right++, text, kind: "context" }])
  const add = (text: string) => rows.push([null, { n: right++, text, kind: "add" }])

  context(`import { cn } from "./utils";`)
  add(`import { Badge } from "@/components/ui/badge";`)
  left = 213
  right = 214
  context(`        <div data-anim="title">`)
  context(`          <p className="text-[1.6cqw] font-semibold tracking-tight text-[#222222]">{trip.title}</p>`)
  context(`        </div>`)
  for (const c of components) {
    add(`        {trip.title === "${c.cardTitle}" && (`)
    add(`          <Badge`)
    add(`            tone="${c.tone}"`)
    add(`            size="${c.size}"`)
    add(`            className="absolute left-[${(c.x / CQW).toFixed(1)}cqw] top-[${(c.y / CQW).toFixed(1)}cqw]"`)
    add(`          >`)
    add(`            ${c.label}`)
    add(`          </Badge>`)
    add(`        )}`)
  }
  const added = rows.filter(([l, r]) => l === null && r?.kind === "add").length
  return { path: BUILT_COMPONENTS_FILE, added, removed: 0, diff: rows }
}
