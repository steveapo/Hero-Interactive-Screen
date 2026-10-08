"use client"

import { useLayoutEffect, useState } from "react"
import { Check, ChevronDown, Ellipsis, FlipHorizontal2, FlipVertical2, ImagePlus, Minus, Pencil, RotateCwSquare, Scan } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ChangedFile, DiffRow } from "./code-changes-popover"
import { CODEBASE_WIDTH } from "./codebase-frame"
import type { CanvasRect } from "./drag"
import {
  AddToChatIcon,
  AngleIcon,
  Glyph,
  IconButton,
  LAYOUT_MODES,
  OpacityIcon,
  PaddingXIcon,
  PaddingYIcon,
  px,
  Row,
  Section,
  SelectionColorsSection,
  SettingTooltip,
  SideButton,
  StrokeWidthIcon,
  type LayoutMode,
} from "./frame-settings-panel"

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

/**
 * `variant` = the design-system variant name shown in Component States; `fillToken` / `borderToken`
 * name the colour tokens behind TONE_CLASS (null border = transparent); `text` = the label colour.
 */
export const BADGE_TONES: {
  id: BadgeTone
  label: string
  variant: string
  swatch: string
  fillToken: string
  text: string
  border: { token: string; color: string; opacity: number } | null
}[] = [
  { id: "neutral", label: "Neutral", variant: "default", swatch: "#111111", fillToken: "neutral-900", text: "#ffffff", border: null },
  { id: "lime", label: "Lime", variant: "lime", swatch: "#c2ec66", fillToken: "lime-300", text: "#16210a", border: null },
  { id: "red", label: "Red", variant: "destructive", swatch: "#e4321b", fillToken: "red-600", text: "#ffffff", border: null },
  {
    id: "outline",
    label: "Outline",
    variant: "outline",
    swatch: "#ffffff",
    fillToken: "white",
    text: "#2f2f2f",
    border: { token: "black", color: "#000000", opacity: 20 },
  },
]

/** Spacing / size tokens of the design-system Badge (components/ui/badge: h-5 px-2 py-0.5 gap-1 border). */
const BADGE_TOKENS = { height: "5", paddingX: "2", paddingY: "0.5", gap: "1", borderWidth: "border" }

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
  const tone = BADGE_TONES.find((t) => t.id === instance.tone) ?? BADGE_TONES[0]
  const [layout, setLayout] = useState<LayoutMode>("row")
  const [wrap, setWrap] = useState(false)
  // components/ui/badge sets overflow-hidden
  const [clip, setClip] = useState(true)

  // Rendered size of the instance, in canvas units (offset sizes ignore the zoom transform).
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-frame-component="${instance.id}"]`)
    if (el) setMeasured({ w: el.offsetWidth, h: el.offsetHeight })
  }, [instance.id, instance.label, instance.tone, instance.size])

  return (
    <aside
      data-cursor-id="component-settings"
      className="absolute right-1.5 top-[46px] z-30 flex max-h-[calc(100%-56px)] w-[326px] flex-col overflow-y-auto rounded-xl border border-stone-700/10 bg-[#f5f5f4] shadow-[0_2px_10px_-2px_rgba(17,17,16,0.1),0_1px_2px_rgba(17,17,16,0.05)] animate-in fade-in slide-in-from-right-1 duration-150"
    >
      {/* Header: instance name + Add to Build Chat, then the main component + Detach */}
      <div className="flex flex-col gap-2.5 border-b border-stone-700/10 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2.5 text-[14px] font-semibold leading-4 text-stone-800">
            <ComponentGlyph />
            {instance.component} (Instance)
          </h2>
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded-full border border-[#46a35a]/40 bg-[#e3f1e5] px-2.5 text-[12px] font-semibold text-[#2f7d42] transition-colors hover:bg-[#d5ebd9]"
          >
            <AddToChatIcon />
            Add to Build Chat
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold leading-4 text-stone-900">{instance.component}</p>
          <button
            type="button"
            className="flex h-6 items-center rounded-md bg-stone-200/70 px-2 text-[12px] text-stone-900 transition-colors hover:bg-stone-200"
          >
            Detach
          </button>
        </div>
      </div>

      <Section title="Component States">
        <Row>
          <span className="flex h-6 items-center pl-5 text-[12px] text-stone-900">variant</span>
          <label className="group/setting relative flex h-6 min-w-0 items-center rounded-md bg-stone-200/70 text-[12px] text-stone-900">
            <SettingTooltip label="variant" align="end" />
            <select
              aria-label="variant"
              value={instance.tone}
              onChange={(e) => onChange({ tone: e.target.value as BadgeTone })}
              className="h-full w-full min-w-0 cursor-pointer appearance-none bg-transparent pl-2 pr-6 outline-none"
            >
              {BADGE_TONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.variant}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-stone-400" strokeWidth={1.25} />
          </label>
        </Row>
      </Section>

      <Section title="Position">
        <Row>
          <PropField label="X" name="Position X" value={px(instance.x)} trailing="variable" />
          <PropField label="Y" name="Position Y" value={px(instance.y)} trailing="variable" />
        </Row>
        <Row>
          <PropField label={<AngleIcon />} name="Rotation" value="0°" />
          <div className="flex h-6 items-stretch divide-x divide-[#f5f5f4] rounded-md bg-stone-200/70 text-stone-700">
            <IconButton label="Rotate 90°">
              <RotateCwSquare className="size-3.5" strokeWidth={1.25} />
            </IconButton>
            <IconButton label="Flip horizontal">
              <FlipHorizontal2 className="size-3.5" strokeWidth={1.25} />
            </IconButton>
            <IconButton label="Flip vertical" align="end">
              <FlipVertical2 className="size-3.5" strokeWidth={1.25} />
            </IconButton>
          </div>
        </Row>
      </Section>

      <Section title="Size">
        <Row side={<SideButton label="Size options" icon={<Scan className="size-3.5" strokeWidth={1.25} />} plain />}>
          <PropField label="W" name="Width" value={measured ? px(measured.w) : "Hug"} trailing="variable" />
          <PropField label="H" name="Height" value={BADGE_TOKENS.height} token trailing="variable" />
        </Row>
      </Section>

      <Section title="Layout">
        <Row side={<SideButton label="More layout options" icon={<Ellipsis className="size-3.5" strokeWidth={1.5} />} plain />}>
          <div role="radiogroup" aria-label="Layout mode" className="col-span-2 flex h-7 rounded-md bg-stone-200/70">
            {LAYOUT_MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={layout === id}
                aria-label={label}
                onClick={() => setLayout(id)}
                className={cn(
                  "group/setting relative flex flex-1 items-center justify-center rounded-md transition-colors",
                  layout === id ? "bg-[#2f6bf6] text-white" : "text-stone-700 hover:bg-stone-700/5",
                )}
              >
                <Icon />
                <SettingTooltip label={label} align={id === "grid" ? "end" : "center"} />
              </button>
            ))}
          </div>
        </Row>
        <Row>
          <AlignmentGrid />
          <div className="flex flex-col gap-2">
            <div className="flex h-6 items-center justify-between pl-2 pr-1 text-[12px] text-stone-900">
              Wrap
              <Toggle label="Wrap" on={wrap} onToggle={() => setWrap((v) => !v)} />
            </div>
            <PropField label={<GapIcon />} name="Gap" value={BADGE_TOKENS.gap} token trailing="edit" />
          </div>
        </Row>
        <Row side={<SideButton label="Padding per side" icon={<Scan className="size-3.5" strokeWidth={1.25} />} plain />}>
          <PropField label={<PaddingXIcon />} name="Horizontal padding" value={BADGE_TOKENS.paddingX} token trailing="edit" />
          <PropField label={<PaddingYIcon />} name="Vertical padding" value={BADGE_TOKENS.paddingY} token trailing="edit" />
        </Row>
        <Row side={<SideButton label="Margin per side" icon={<Scan className="size-3.5" strokeWidth={1.25} />} plain />}>
          <PropField label={<MarginXIcon />} name="Horizontal margin" value="0" token trailing="edit" />
          <PropField label={<MarginYIcon />} name="Vertical margin" value="0" token trailing="edit" />
        </Row>
        <div className="mt-2 flex h-7 items-center justify-between pl-2 text-[12px] text-stone-900">
          Clip Content
          <Toggle label="Clip Content" on={clip} onToggle={() => setClip((v) => !v)} />
        </div>
      </Section>

      <Section title="Appearance">
        <Row side={<SideButton label="Corner radius per corner" icon={<Scan className="size-3.5" strokeWidth={1.25} />} plain />}>
          <PropField label={<OpacityIcon />} name="Opacity" value="100%" trailing="variable" />
          <PropField
            label={<Scan className="size-3.5" strokeWidth={1.25} />}
            name="Corner radius"
            value={measured ? px(measured.h / 2) : "0px"}
            trailing="variable"
          />
        </Row>
      </Section>

      <Section title="Fill">
        <Row side={<SideButton label="Remove fill" icon={<Minus className="size-3.5" strokeWidth={1.25} />} plain />}>
          <TokenColorField name="Fill" token={tone.fillToken} color={tone.swatch} opacity={100} className="col-span-2" />
        </Row>
        <Row>
          <button
            type="button"
            className="group/setting relative col-span-2 flex h-6 w-fit items-center gap-2 rounded-md bg-stone-200/70 pl-1.5 pr-2 text-[12px] text-stone-900 hover:bg-stone-200"
          >
            <SettingTooltip label="Add image fill" />
            <ImagePlus className="size-3.5 text-stone-600" strokeWidth={1.25} />
            Add Image
          </button>
        </Row>
      </Section>

      <Section title="Border">
        <Row side={<SideButton label="Remove border" icon={<Minus className="size-3.5" strokeWidth={1.25} />} plain />}>
          <TokenColorField
            name="Border"
            token={tone.border?.token ?? "transparent"}
            color={tone.border?.color ?? null}
            opacity={tone.border?.opacity ?? 0}
            className="col-span-2"
          />
        </Row>
        <Row side={<SideButton label="Border per side" icon={<BorderPerSideIcon />} plain />}>
          <PropField label={<BorderStyleIcon />} name="Border style" value="solid" chevron />
          <PropField label={<StrokeWidthIcon />} name="Border width" value={BADGE_TOKENS.borderWidth} token trailing="edit" />
        </Row>
      </Section>

      <SelectionColorsSection colors={[tone.swatch, tone.text]} />
    </aside>
  )
}

/**
 * Read-only property field: label on the left, right-aligned value (in a white chip when it's a
 * design token), then an optional variable-binding / edit-token affordance.
 */
function PropField({
  label,
  name,
  value,
  token = false,
  chevron = false,
  trailing,
}: {
  label: React.ReactNode
  /** Full setting name, shown in the hover tooltip. */
  name: string
  value: string
  token?: boolean
  chevron?: boolean
  trailing?: "variable" | "edit"
}) {
  return (
    <div
      tabIndex={0}
      aria-label={name}
      className="group/setting relative flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-stone-200/70 pl-2 pr-1.5 text-[12px] text-stone-900 outline-none"
    >
      <SettingTooltip label={name} />
      <span className="shrink-0 text-stone-500">{label}</span>
      <span className="flex min-w-0 flex-1 justify-end tabular-nums">
        <span className={cn("truncate", token && "rounded-[4px] bg-white px-1 shadow-[0_0_0_1px_rgba(17,17,16,0.06)]")}>{value}</span>
      </span>
      {chevron && <ChevronDown className="size-3 shrink-0 text-stone-400" strokeWidth={1.25} />}
      {trailing === "variable" && <VariableIcon />}
      {trailing === "edit" && <Pencil className="size-3 shrink-0 text-stone-500" strokeWidth={1.25} />}
    </div>
  )
}

/** Swatch + colour token name (white chip) + opacity. null colour = transparent checkerboard. */
function TokenColorField({
  name,
  token,
  color,
  opacity,
  className,
}: {
  name: string
  token: string
  color: string | null
  opacity: number
  className?: string
}) {
  return (
    <div className={cn("flex h-6 min-w-0 items-center rounded-md bg-stone-200/70 text-[12px] text-stone-900", className)}>
      <span tabIndex={0} className="group/setting relative flex h-full min-w-0 flex-1 items-center gap-2 pl-1.5 outline-none">
        <SettingTooltip label={`${name} colour`} />
        <span
          className="size-3.5 shrink-0 rounded-[4px] border border-stone-700/15"
          style={{ background: color ?? "repeating-conic-gradient(#d6d3d1 0 25%, #ffffff 0 50%) 0 0 / 7px 7px" }}
        />
        <span className="truncate rounded-[4px] bg-white px-1 shadow-[0_0_0_1px_rgba(17,17,16,0.06)]">{token}</span>
      </span>
      <span
        tabIndex={0}
        className={cn(
          "group/setting relative flex h-full w-[60px] shrink-0 items-center justify-end gap-1.5 border-l border-[#f5f5f4] pr-2 tabular-nums outline-none",
          color === null && "text-stone-400",
        )}
      >
        <SettingTooltip label={`${name} opacity`} align="end" />
        {opacity}
        <span className="text-stone-400">%</span>
      </span>
    </div>
  )
}

/** Small on/off switch. */
function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      onClick={onToggle}
      className={cn("relative h-3.5 w-6 rounded-full transition-colors", on ? "bg-stone-900" : "bg-stone-300")}
    >
      <span
        className={cn("absolute left-0.5 top-0.5 size-2.5 rounded-full bg-white shadow-sm transition-transform", on && "translate-x-2.5")}
      />
    </button>
  )
}

/** 3×3 alignment picker; children sit centred (the Badge is items-center justify-center). */
function AlignmentGrid() {
  return (
    <div aria-label="Alignment" className="grid min-h-[88px] grid-cols-3 grid-rows-3 place-items-center rounded-md bg-stone-200/70 p-2">
      {Array.from({ length: 9 }, (_, i) =>
        i === 4 ? (
          <span key={i} className="flex items-center gap-[2px]">
            <span className="h-2 w-[2px] rounded-full" style={{ background: SELECT_BLUE }} />
            <span className="h-3 w-[2px] rounded-full" style={{ background: SELECT_BLUE }} />
            <span className="h-2 w-[2px] rounded-full" style={{ background: SELECT_BLUE }} />
          </span>
        ) : (
          <span key={i} className="size-[3px] rounded-full bg-stone-400" />
        ),
      )}
    </div>
  )
}

function ComponentGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-stone-800">
      <path d="M7 1 9.5 3.5 7 6 4.5 3.5Z" />
      <path d="M3.5 4.5 6 7 3.5 9.5 1 7Z" />
      <path d="M10.5 4.5 13 7 10.5 9.5 8 7Z" />
      <path d="M7 8 9.5 10.5 7 13 4.5 10.5Z" />
    </svg>
  )
}

/** Bind-to-variable affordance: four rounded cells. */
function VariableIcon() {
  return (
    <span className="shrink-0 text-stone-500">
      <Glyph>
        <rect x="2" y="2" width="4" height="4" rx="1.5" />
        <rect x="8" y="2" width="4" height="4" rx="1.5" />
        <rect x="2" y="8" width="4" height="4" rx="1.5" />
        <rect x="8" y="8" width="4" height="4" rx="1.5" />
      </Glyph>
    </span>
  )
}

function GapIcon() {
  return (
    <Glyph>
      <path d="M2 3v8M12 3v8" />
      <path d="M5 4.5v5M9 4.5v5" />
    </Glyph>
  )
}

function MarginXIcon() {
  return (
    <Glyph>
      <path d="M1.5 2.5v9M12.5 2.5v9" />
      <rect x="4.5" y="4" width="5" height="6" rx="1" />
    </Glyph>
  )
}

function MarginYIcon() {
  return (
    <Glyph>
      <path d="M2.5 1.5h9M2.5 12.5h9" />
      <rect x="3.5" y="4.5" width="7" height="5" rx="1" />
    </Glyph>
  )
}

function BorderStyleIcon() {
  return (
    <Glyph>
      <path d="M2 3.5h10" />
      <path d="M2 7h2M6 7h2M10 7h2" />
      <path d="M2 10.5h1M5 10.5h1M8 10.5h1M11 10.5h1" />
    </Glyph>
  )
}

function BorderPerSideIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="1.5" width="11" height="11" rx="2" />
      <rect x="4.5" y="4.5" width="5" height="5" rx="1" />
    </Glyph>
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
