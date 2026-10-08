"use client"

import { memo, useState } from "react"
import { ChevronDown, ChevronRight, Ellipsis, FlipHorizontal2, FlipVertical2, ImagePlus, Minus, Plus, RotateCwSquare, Scan } from "lucide-react"
import { cn } from "@/lib/utils"
import { FrameGlyph } from "./planner-frame"

/* --------------------------------- Types ---------------------------------- */

export type LayoutMode = "freeform" | "row" | "column" | "grid"
export type CssPosition = "static" | "relative" | "absolute"
/** Per-side lengths in canvas px. */
export type Sides = { top: number; right: number; bottom: number; left: number }
/** CSS insets of an absolutely positioned element, in canvas px; null = auto. */
export type Insets = { top: number | null; right: number | null; bottom: number | null; left: number | null }

export const NO_SIDES: Sides = { top: 0, right: 0, bottom: 0, left: 0 }

export const LAYOUT_MODES: { id: LayoutMode; label: string; icon: () => React.JSX.Element }[] = [
  { id: "freeform", label: "Freeform", icon: FreeformIcon },
  { id: "row", label: "Row", icon: RowIcon },
  { id: "column", label: "Column", icon: ColumnIcon },
  { id: "grid", label: "Grid", icon: GridIcon },
]

const SELECT_BLUE = "#2f6bf6"

/** 16.384 → "16.4px"; null → "auto". */
export function px(value: number | null) {
  return value === null ? "auto" : `${Math.round(value * 10) / 10}px`
}

/* ------------------------------ Frame panel ------------------------------- */

/** Right-side settings for a selected design frame. Memoized: the canvas re-renders it on every
 * camera frame otherwise, and its props only change with the selected frame. */
export const FrameSettingsPanel = memo(function FrameSettingsPanel({
  ref,
  tag = "div",
  position = "static",
  inset,
  x,
  y,
  width,
  height,
  layout = "freeform",
  padding = NO_SIDES,
  clip = false,
  fill,
  radius,
  border,
  colors,
  onFillChange,
}: {
  ref?: React.Ref<HTMLElement>
  /** Element tag shown in the header. */
  tag?: string
  position?: CssPosition
  /** Insets, for an absolutely positioned element. */
  inset?: Insets
  /** Top-left position relative to the Codebase frame's top-left, in canvas units. */
  x: number
  y: number
  width: number
  height: number
  layout?: LayoutMode
  padding?: Sides
  clip?: boolean
  /** Fill colour (hex); null = transparent. */
  fill: string | null
  /** Corner radius in canvas units; null = none. */
  radius: number | null
  /** 1px stroke colour (hex); null = none. */
  border: string | null
  /** Colours used inside the frame; defaults to its fill and stroke. */
  colors?: string[]
  /** Makes the fill editable: the Fill swatch opens preset colours (see FillSection). */
  onFillChange?: (color: string) => void
}) {
  const selectionColors = colors ?? [fill, border].filter((c): c is string => c !== null)

  return (
    <SettingsPanelShell ref={ref} icon={<FrameGlyph />} title={tag}>
      <PositionSection position={position} inset={inset} x={x} y={y} />
      <SizeSection width={px(width)} height={px(height)} />
      <LayoutSection layout={layout} padding={padding} clip={clip} />
      <AppearanceSection radius={radius} />
      <FillSection fill={fill} onFillChange={onFillChange} />
      <StrokeSection border={border} />
      <SelectionColorsSection colors={selectionColors} />
    </SettingsPanelShell>
  )
})

/* ------------------------- Shared panel sections -------------------------- */

/** Right-side panel chrome: header with the element tag + "Add to Build Chat". */
export function SettingsPanelShell({
  ref,
  icon,
  title,
  children,
}: {
  ref?: React.Ref<HTMLElement>
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <aside
      ref={ref}
      className="absolute right-1.5 top-[46px] z-30 flex max-h-[calc(100%-56px)] w-[326px] flex-col overflow-y-auto rounded-xl border border-stone-700/10 bg-[#f5f5f4] pb-6 shadow-[0_2px_10px_-2px_rgba(17,17,16,0.1),0_1px_2px_rgba(17,17,16,0.05)] animate-in fade-in slide-in-from-right-1 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-700/10 px-3 py-2.5">
        <h2 className="flex items-center gap-2.5 text-[14px] font-semibold leading-4 text-stone-800">
          {icon}
          {title}
        </h2>
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded-full bg-[#46a35a] px-2.5 text-[12px] font-semibold text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#3d9150]"
        >
          <AddToChatIcon />
          Add to Build Chat
        </button>
      </div>
      {children}
    </aside>
  )
}

/**
 * Position mode, then either X / Y (static / relative) or the insets and constraints
 * (absolute), then rotation and flips.
 */
export function PositionSection({
  position,
  inset,
  x,
  y,
}: {
  position: CssPosition
  inset?: Insets
  /** Canvas position relative to the Codebase frame's top-left. */
  x: number
  y: number
}) {
  return (
    <Section title="Position">
      <Row side={<SideButton label="More position options" icon={<Ellipsis className="size-3.5" strokeWidth={1.5} />} plain />}>
        <Field label="Position" strongLabel name="Position" value={position} chevron className="col-span-2" />
      </Row>

      {position === "absolute" && inset ? (
        <>
          <Row side={<SideButton label="Constraints" icon={<ConstraintsIcon />} active />}>
            <Field label="L" name="Left" value={px(inset.left)} chevron />
            <Field label="T" name="Top" value={px(inset.top)} chevron />
          </Row>
          <Row>
            <Field label="R" name="Right" value={px(inset.right)} chevron />
            <Field label="B" name="Bottom" value={px(inset.bottom)} chevron />
          </Row>
          <Row>
            <div className="flex flex-col gap-2">
              <Field
                label={<HorizontalConstraintIcon />}
                name="Horizontal constraint"
                value={inset.left !== null ? "Left" : "Right"}
                chevron
              />
              <Field
                label={<VerticalConstraintIcon />}
                name="Vertical constraint"
                value={inset.top !== null ? "Top" : "Bottom"}
                chevron
              />
            </div>
            <ConstraintWidget
              left={inset.left !== null}
              right={inset.right !== null}
              top={inset.top !== null}
              bottom={inset.bottom !== null}
            />
          </Row>
        </>
      ) : (
        <Row side={<SideButton label="Constraints" icon={<ConstraintsIcon />} />}>
          {/* static elements ignore offsets, so X / Y read muted */}
          <Field label="X" name="Position X" value={px(x)} chevron muted={position === "static"} />
          <Field label="Y" name="Position Y" value={px(y)} chevron muted={position === "static"} />
        </Row>
      )}

      <Row>
        <Field label={<AngleIcon />} name="Rotation" value="0°" />
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
  )
}

/** W / H, as px or "Hug". `hugged` = the measured size behind a Hug, shown in the tooltips. */
export function SizeSection({
  width,
  height,
  hugged,
}: {
  width: string
  height: string
  hugged?: { w: number; h: number }
}) {
  return (
    <Section title="Size">
      <Row side={<SideButton label="Size options" icon={<SizeIcon />} plain />}>
        <Field label="W" name={hugged ? `Width · ${px(hugged.w)}` : "Width"} value={width} chevron />
        <Field label="H" name={hugged ? `Height · ${px(hugged.h)}` : "Height"} value={height} chevron />
      </Row>
    </Section>
  )
}

/** Layout mode, padding (collapsed or per side), margin per side and clip content. */
export function LayoutSection({
  layout: initialLayout,
  padding,
  clip,
  paddingPerSide = false,
}: {
  layout: LayoutMode
  padding: Sides
  clip: boolean
  /** Open with padding split into its four sides. */
  paddingPerSide?: boolean
}) {
  const [layout, setLayout] = useState<LayoutMode>(initialLayout)
  const [perSide, setPerSide] = useState(paddingPerSide)
  const [clipContent, setClipContent] = useState(clip)
  const horizontal = padding.left === padding.right ? px(padding.left) : "Mixed"
  const vertical = padding.top === padding.bottom ? px(padding.top) : "Mixed"

  const perSideButton = (
    <SideButton
      label="Padding per side"
      icon={<PaddingPerSideIcon />}
      active={perSide}
      onClick={() => setPerSide((v) => !v)}
    />
  )

  return (
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

      {perSide ? (
        <>
          <Row side={perSideButton}>
            <Field label={<PadLeftIcon />} name="Padding left" value={px(padding.left)} />
            <Field label={<PadTopIcon />} name="Padding top" value={px(padding.top)} />
          </Row>
          <Row>
            <Field label={<PadRightIcon />} name="Padding right" value={px(padding.right)} />
            <Field label={<PadBottomIcon />} name="Padding bottom" value={px(padding.bottom)} />
          </Row>
        </>
      ) : (
        <Row side={perSideButton}>
          <Field label={<PaddingXIcon />} name="Horizontal padding" value={horizontal} />
          <Field label={<PaddingYIcon />} name="Vertical padding" value={vertical} />
        </Row>
      )}

      {/* margin, always per side */}
      <Row side={<SideButton label="Margin per side" icon={<MarginPerSideIcon />} active />}>
        <Field label={<MarginLeftIcon />} name="Margin left" value="0px" />
        <Field label={<MarginTopIcon />} name="Margin top" value="0px" />
      </Row>
      <Row>
        <Field label={<MarginRightIcon />} name="Margin right" value="0px" />
        <Field label={<MarginBottomIcon />} name="Margin bottom" value="0px" />
      </Row>

      <label className="mt-2 flex h-7 cursor-pointer items-center justify-between pl-2 pr-9 text-[12px] text-stone-900">
        Clip Content
        <button
          type="button"
          role="switch"
          aria-checked={clipContent}
          onClick={() => setClipContent((v) => !v)}
          className={cn("relative h-3.5 w-6 rounded-full transition-colors", clipContent ? "bg-stone-900" : "bg-stone-200")}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 size-2.5 rounded-full bg-white shadow-sm transition-transform",
              clipContent && "translate-x-2.5",
            )}
          />
        </button>
      </label>
    </Section>
  )
}

/** Opacity and corner radius (canvas units; null = 0). */
export function AppearanceSection({ radius }: { radius: number | null }) {
  return (
    <Section title="Appearance">
      <Row side={<SideButton label="Corner radius per corner" icon={<Scan className="size-3.5" strokeWidth={1.25} />} plain />}>
        <Field label={<OpacityIcon />} name="Opacity" value="100%" />
        <Field label={<Scan className="size-3.5" strokeWidth={1.25} />} name="Corner radius" value={px(radius ?? 0)} />
      </Row>
    </Section>
  )
}

/** Preset fills offered when the Fill swatch is clicked (an editable fill). */
export const FILL_SWATCHES = ["#ffffff", "#f6e9f3", "#fde8e4", "#fdf3dc", "#eaf5d8", "#e3f0fb", "#ece9fb", "#f1f1ef"]

/**
 * Fill colour row + Add Image. A transparent fill reads as #000000 at 0 %. With `onFillChange`,
 * clicking the swatch opens a row of preset colours (FILL_SWATCHES); picking one sets the fill.
 */
export function FillSection({ fill, onFillChange }: { fill: string | null; onFillChange?: (color: string) => void }) {
  const [picking, setPicking] = useState(false)
  return (
    <Section title="Fill">
      <Row side={<SideButton label="Remove fill" icon={<Minus className="size-3.5" strokeWidth={1.25} />} plain />}>
        <ColorField
          name="Fill"
          color={fill}
          className="col-span-2"
          onSwatchClick={onFillChange ? () => setPicking((p) => !p) : undefined}
        />
      </Row>
      {onFillChange && picking && (
        <div
          role="group"
          aria-label="Fill colours"
          className="mr-8 flex flex-wrap gap-1.5 rounded-md bg-stone-200/70 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {FILL_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Fill ${color}`}
              aria-pressed={color === fill}
              onClick={() => {
                onFillChange(color)
                setPicking(false)
              }}
              className={cn(
                "size-5 rounded-[5px] border border-stone-700/15 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#2f6bf6]",
                color === fill && "ring-2 ring-[#2f6bf6] ring-offset-1 ring-offset-stone-200",
              )}
              style={{ background: color }}
            />
          ))}
        </div>
      )}
      <Row>
        <button
          type="button"
          className="group/setting relative col-span-2 flex h-6 items-center gap-2 rounded-md bg-stone-200/70 pl-1.5 text-[12px] text-stone-400 hover:bg-stone-200"
        >
          <SettingTooltip label="Add image fill" />
          <span className="flex size-4 items-center justify-center rounded-[4px] border border-stone-300 text-stone-500">
            <ImagePlus className="size-3" strokeWidth={1.25} />
          </span>
          Add Image
        </button>
      </Row>
    </Section>
  )
}

/** Stroke colour row, or a greyed header with an add button when there's none. */
export function StrokeSection({ border }: { border: string | null }) {
  if (!border) return <EmptySection title="Stroke" addLabel="Add stroke" />
  return (
    <Section title="Stroke">
      <Row side={<SideButton label="Remove stroke" icon={<Minus className="size-3.5" strokeWidth={1.25} />} plain />}>
        <ColorField name="Stroke" color={border} />
        <Field label={<StrokeWidthIcon />} name="Stroke width" value="1px" />
      </Row>
    </Section>
  )
}

/** Every colour used inside the frame, as swatches. */
export function SelectionColorsSection({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-700/10 px-3 py-3">
      <button type="button" className="flex items-center gap-1 text-[12px] font-semibold leading-4 text-stone-500 hover:text-stone-700">
        Selection colors
        <ChevronRight className="size-3.5" strokeWidth={1.5} />
      </button>
      <div className="flex items-center gap-1">
        {colors.map((color) => (
          <span
            key={color}
            title={color}
            className="size-3.5 rounded-[4px] border border-stone-700/15"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  )
}

/** A section with nothing set yet: greyed header + add button. */
export function EmptySection({ title, addLabel }: { title: string; addLabel: string }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-700/10 py-2.5 pl-3 pr-2">
      <h3 className="text-[12px] font-semibold leading-4 text-stone-500">{title}</h3>
      <SideButton label={addLabel} icon={<Plus className="size-3.5" strokeWidth={1.25} />} plain />
    </div>
  )
}

/* -------------------------------- Pieces --------------------------------- */

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-stone-700/10 px-3 pb-4 pt-3">
      <h3 className="mb-1 text-[12px] font-semibold leading-4 text-stone-900">{title}</h3>
      {children}
    </section>
  )
}

/**
 * Two-column field row with a trailing slot for a side button. The slot is kept even when
 * empty, so every row's fields line up.
 */
export function Row({ side, children }: { side?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="grid flex-1 grid-cols-2 gap-2">{children}</div>
      <div className="flex size-6 shrink-0 items-center justify-center">{side}</div>
    </div>
  )
}

/**
 * Setting name shown above a control on hover/focus; fades in while moving up into place.
 * Parent needs `group/setting relative`. `align="end"` pins it to the right edge for controls
 * near the panel's right side, so it isn't clipped.
 */
export function SettingTooltip({ label, align = "center" }: { label: string; align?: "center" | "end" }) {
  return (
    <span
      role="tooltip"
      className={cn(
        "pointer-events-none absolute bottom-full z-10 mb-1.5 whitespace-nowrap rounded-md bg-stone-200 px-2 py-1 text-[13px] font-normal leading-4 text-stone-800 shadow-[0_1px_2px_rgba(17,17,16,0.06)] translate-y-1 opacity-0 transition-[opacity,translate] duration-150 ease-out group-hover/setting:translate-y-0 group-hover/setting:opacity-100 group-focus-visible/setting:translate-y-0 group-focus-visible/setting:opacity-100",
        align === "center" ? "left-1/2 -translate-x-1/2" : "right-0",
      )}
    >
      {label}
    </span>
  )
}

/**
 * Read-only field: label (letter, word or icon) on the left, right-aligned value, optional
 * dropdown chevron. `muted` greys it out for settings that don't apply.
 */
export function Field({
  label,
  name,
  value,
  chevron = false,
  muted = false,
  strongLabel = false,
  className,
}: {
  label: React.ReactNode
  /** Full setting name, shown in the hover tooltip. */
  name: string
  value: string
  chevron?: boolean
  muted?: boolean
  /** Word labels ("Position", "Font") read dark; letter / icon labels read grey. */
  strongLabel?: boolean
  className?: string
}) {
  return (
    <div
      tabIndex={0}
      aria-label={name}
      className={cn(
        "group/setting relative flex h-6 min-w-0 items-center gap-1.5 rounded-md pl-2 pr-1.5 text-[12px] outline-none",
        muted ? "bg-stone-200/40 text-stone-400" : "bg-stone-200/70 text-stone-900",
        className,
      )}
    >
      <SettingTooltip label={name} />
      <span className={cn("shrink-0", muted ? "text-stone-400" : strongLabel ? "text-stone-900" : "text-stone-500")}>
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-right tabular-nums">{value}</span>
      {chevron && <ChevronDown className="size-3 shrink-0 text-stone-400" strokeWidth={1.25} />}
    </div>
  )
}

/** Swatch + hex + opacity. null = transparent: checkerboard, #000000 at 0 %. With `onSwatchClick` the swatch + hex is a button. */
export function ColorField({
  name,
  color,
  className,
  onSwatchClick,
}: {
  name: string
  color: string | null
  className?: string
  onSwatchClick?: () => void
}) {
  const swatch = (
    <>
      <SettingTooltip label={`${name} colour`} />
      <span
        className="size-3.5 shrink-0 rounded-[4px] border border-stone-700/15"
        style={{
          background:
            color ?? "repeating-conic-gradient(#d6d3d1 0 25%, #ffffff 0 50%) 0 0 / 7px 7px",
        }}
      />
      <span className="truncate font-mono tracking-tight">{color ?? "#000000"}</span>
    </>
  )
  return (
    <div className={cn("flex h-6 min-w-0 items-center rounded-md bg-stone-200/70 text-[12px] text-stone-900", className)}>
      {onSwatchClick ? (
        <button
          type="button"
          aria-label={`${name} colour`}
          onClick={onSwatchClick}
          className="group/setting relative flex h-full min-w-0 flex-1 items-center gap-2 rounded-l-md pl-1.5 text-left outline-none hover:bg-stone-200"
        >
          {swatch}
        </button>
      ) : (
        <span tabIndex={0} className="group/setting relative flex h-full min-w-0 flex-1 items-center gap-2 pl-1.5 outline-none">
          {swatch}
        </span>
      )}
      <span
        tabIndex={0}
        className="group/setting relative flex h-full w-[60px] shrink-0 items-center justify-end gap-1.5 border-l border-[#f5f5f4] pr-2 tabular-nums outline-none"
      >
        <SettingTooltip label={`${name} opacity`} align="end" />
        {color ? 100 : 0}
        <span className="text-stone-400">%</span>
      </span>
    </div>
  )
}

/** Trailing button to the right of a field row. `active` = light blue (a toggled mode); `plain` = no hover tile tint. */
export function SideButton({
  label,
  icon,
  active = false,
  plain = false,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  active?: boolean
  plain?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={plain ? undefined : active}
      onClick={onClick}
      className={cn(
        "group/setting relative flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
        active ? "bg-[#2f6bf6]/10 text-[#2f6bf6]" : "text-stone-600 hover:bg-stone-700/5",
      )}
    >
      {icon}
      <SettingTooltip label={label} align="end" />
    </button>
  )
}

/** Segmented button inside a grouped control. */
export function IconButton({
  label,
  align,
  active = false,
  onClick,
  children,
}: {
  label: string
  align?: "center" | "end"
  active?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group/setting relative flex flex-1 items-center justify-center first:rounded-l-md last:rounded-r-md transition-colors",
        active ? "rounded-md bg-[#2f6bf6] text-white" : "hover:bg-stone-700/5",
      )}
    >
      {children}
      <SettingTooltip label={label} align={align} />
    </button>
  )
}

/** Which insets are pinned: the pinned sides' markers turn blue. */
function ConstraintWidget({ left, right, top, bottom }: { left: boolean; right: boolean; top: boolean; bottom: boolean }) {
  const tone = (pinned: boolean) => (pinned ? SELECT_BLUE : "#a8a29e")
  return (
    <div aria-label="Constraints" className="relative h-full min-h-14 rounded-md bg-stone-200/70">
      <span className="absolute left-1/2 top-1.5 h-2.5 -translate-x-1/2 rounded-full" style={{ width: top ? 2 : 1, background: tone(top) }} />
      <span className="absolute bottom-1.5 left-1/2 h-2.5 -translate-x-1/2 rounded-full" style={{ width: bottom ? 2 : 1, background: tone(bottom) }} />
      <span className="absolute left-2 top-1/2 w-3 -translate-y-1/2 rounded-full" style={{ height: left ? 2 : 1, background: tone(left) }} />
      <span className="absolute right-2 top-1/2 w-3 -translate-y-1/2 rounded-full" style={{ height: right ? 2 : 1, background: tone(right) }} />
      {/* centre cross */}
      <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-stone-400" />
      <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-stone-400" />
    </div>
  )
}

/* --------------------------------- Icons ---------------------------------- */

export function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  )
}

/** Window with a header bar; its bottom edge opens where the up arrow comes out of it. */
export function AddToChatIcon() {
  return (
    <Glyph>
      <path d="M5.25 12.5H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h8A1.5 1.5 0 0 1 12.5 3v8a1.5 1.5 0 0 1-1.5 1.5H8.75" />
      <path d="M1.5 4.5h11" />
      <path d="M7 13V7.25M5 9.25l2-2 2 2" />
    </Glyph>
  )
}

export function AngleIcon() {
  return (
    <Glyph>
      <path d="M2 2v10h10M2 7a5 5 0 0 1 5 5" />
    </Glyph>
  )
}

function ConstraintsIcon() {
  return (
    <Glyph>
      <path d="M1.5 4V2.5a1 1 0 0 1 1-1H4M10 1.5h1.5a1 1 0 0 1 1 1V4M12.5 10v1.5a1 1 0 0 1-1 1H10M4 12.5H2.5a1 1 0 0 1-1-1V10" />
      <path d="M7 1.5v11M1.5 7h11" />
    </Glyph>
  )
}

function HorizontalConstraintIcon() {
  return (
    <Glyph>
      <rect x="2" y="2" width="10" height="10" rx="1.5" />
      <path d="M4.5 5.5h5M4.5 8.5h5" />
    </Glyph>
  )
}

function VerticalConstraintIcon() {
  return (
    <Glyph>
      <rect x="2" y="2" width="10" height="10" rx="1.5" />
      <path d="M5.5 4.5v5M8.5 4.5v5" />
    </Glyph>
  )
}

function SizeIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="3" width="8" height="7" rx="1" />
      <path d="M12.5 2.5v8M11.5 2.5h2M11.5 10.5h2M4 12.5h3" />
    </Glyph>
  )
}

function FreeformIcon() {
  return (
    <Glyph>
      <rect x="5" y="1.5" width="4" height="4" rx="0.5" />
      <rect x="1.5" y="8.5" width="4" height="4" rx="0.5" />
      <rect x="8.5" y="8.5" width="4" height="4" rx="0.5" />
    </Glyph>
  )
}

function RowIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="2" width="4" height="4" rx="1" />
      <rect x="8.5" y="2" width="4" height="4" rx="1" />
      <path d="M1.5 10h11M10.5 8l2 2-2 2" />
    </Glyph>
  )
}

function ColumnIcon() {
  return (
    <Glyph>
      <rect x="2" y="1.5" width="4" height="4" rx="1" />
      <rect x="2" y="8.5" width="4" height="4" rx="1" />
      <path d="M10 1.5v11M8 10.5l2 2 2-2" />
    </Glyph>
  )
}

function GridIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" />
      <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" />
      <rect x="8" y="8" width="4.5" height="4.5" rx="1" />
    </Glyph>
  )
}

export function PaddingXIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="3" width="11" height="8" rx="1" />
      <path d="M3.5 5v4M10.5 5v4" />
    </Glyph>
  )
}

export function PaddingYIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <path d="M4 5h6M4 9h6" />
    </Glyph>
  )
}

function PadLeftIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="3" width="11" height="8" rx="1" />
      <path d="M3.5 5v4" />
    </Glyph>
  )
}

function PadRightIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="3" width="11" height="8" rx="1" />
      <path d="M10.5 5v4" />
    </Glyph>
  )
}

function PadTopIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <path d="M4 4.75h6" />
    </Glyph>
  )
}

function PadBottomIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="2.5" width="11" height="9" rx="1" />
      <path d="M4 9.25h6" />
    </Glyph>
  )
}

function PaddingPerSideIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
      <rect x="4" y="4" width="6" height="6" rx="0.75" />
    </Glyph>
  )
}

function MarginPerSideIcon() {
  return (
    <Glyph>
      <path d="M1.5 2v10M12.5 2v10" />
      <rect x="3.5" y="1.5" width="7" height="11" rx="1" />
      <rect x="5.5" y="3.5" width="3" height="7" rx="0.5" />
    </Glyph>
  )
}

function MarginLeftIcon() {
  return (
    <Glyph>
      <path d="M1.5 2.5v9" />
      <rect x="4.5" y="3.5" width="5.5" height="7" rx="1" />
    </Glyph>
  )
}

function MarginRightIcon() {
  return (
    <Glyph>
      <path d="M12.5 2.5v9" />
      <rect x="4" y="3.5" width="5.5" height="7" rx="1" />
    </Glyph>
  )
}

function MarginTopIcon() {
  return (
    <Glyph>
      <path d="M2.5 1.5h9" />
      <rect x="3.5" y="4.5" width="7" height="5.5" rx="1" />
    </Glyph>
  )
}

function MarginBottomIcon() {
  return (
    <Glyph>
      <path d="M2.5 12.5h9" />
      <rect x="3.5" y="4" width="7" height="5.5" rx="1" />
    </Glyph>
  )
}

export function StrokeWidthIcon() {
  return (
    <Glyph>
      <path d="M2 3.5h10" />
      <path d="M2 7h10" strokeWidth="1.75" />
      <path d="M2 10.5h10" strokeWidth="2.5" />
    </Glyph>
  )
}

export function OpacityIcon() {
  return (
    <Glyph>
      <rect x="1.5" y="1.5" width="11" height="11" rx="1.5" />
      <path d="M12.5 1.5 1.5 12.5h11Z" fill="currentColor" />
    </Glyph>
  )
}
