"use client"

import { useState } from "react"
import { Ellipsis } from "lucide-react"
import { cn } from "@/lib/utils"
import { trackDrag } from "./drag"
import {
  Field,
  MarginBottomIcon,
  MarginLeftIcon,
  MarginPerSideIcon,
  MarginRightIcon,
  MarginTopIcon,
  PositionSection,
  px,
  Row,
  Section,
  SelectionColorsSection,
  SettingsPanelShell,
  SettingTooltip,
  SideButton,
  SizeSection,
} from "./frame-settings-panel"
import { TextGlyph } from "./text-settings-panel"

/**
 * Settings for a layer selected inside a card frame (the trip card's nights numeral): what it is in
 * the live app, and its top margin, the one setting edited here. That margin is a scrub field:
 * drag its icon sideways to change the value (MARGIN_SCRUB_PX layout px per unit), or type it.
 */

/** Layout px of horizontal drag per unit of margin while scrubbing. */
export const MARGIN_SCRUB_PX = 4

export function LayerSettingsPanel({
  name,
  x,
  y,
  width,
  height,
  marginTop,
  onMarginTopChange,
  fontSize,
  colors,
  onAddToChat,
}: {
  /** Layer name in the header. */
  name: string
  /** Top-left position relative to the Codebase frame's top-left, in canvas units. */
  x: number
  y: number
  /** Hugged size, in canvas units. */
  width: number
  height: number
  /** Top margin in canvas units (px of the desktop screen). */
  marginTop: number
  onMarginTopChange: (value: number) => void
  /** The numeral's font size, in canvas units. */
  fontSize: number
  colors: string[]
  /** "Add to Build Chat": hands the layer's card frame to the Build Mode agent. */
  onAddToChat?: () => void
}) {
  return (
    <SettingsPanelShell icon={<TextGlyph />} title={name} onAddToChat={onAddToChat}>
      <PositionSection position="static" x={x} y={y} />
      <SizeSection width="Hug" height="Hug" hugged={{ w: width, h: height }} />
      <Section title="Layout">
        <Row side={<SideButton label="More layout options" icon={<Ellipsis className="size-3.5" strokeWidth={1.5} />} plain />}>
          <Field label="Flow" strongLabel name="Layout mode" value="Row" chevron />
          <Field label="Gap" strongLabel name="Gap" value={px(fontSize * 0.11)} />
        </Row>
        {/* Margin, always per side; the top one is live */}
        <Row side={<SideButton label="Margin per side" icon={<MarginPerSideIcon />} active />}>
          <Field label={<MarginLeftIcon />} name="Margin left" value="0px" />
          <ScrubField
            cursorId="margin-top"
            label={<MarginTopIcon />}
            name="Margin top"
            value={marginTop}
            onChange={onMarginTopChange}
          />
        </Row>
        <Row>
          <Field label={<MarginRightIcon />} name="Margin right" value="0px" />
          <Field label={<MarginBottomIcon />} name="Margin bottom" value="0px" />
        </Row>
      </Section>
      <Section title="Typography">
        <Row>
          <Field label="Font" strongLabel name="Font family" value="Inter" chevron className="col-span-2" />
        </Row>
        <Row>
          <Field label="Weight" strongLabel name="Font weight" value="Semibold" chevron />
          <Field label="Size" strongLabel name="Font size" value={px(fontSize)} />
        </Row>
      </Section>
      <SelectionColorsSection colors={colors} />
    </SettingsPanelShell>
  )
}

/**
 * A numeric field you can scrub: press its icon and drag sideways (right = more, never below 0),
 * or click the value and type a new one (Enter / leaving the field applies it). Outlined in blue
 * while it's being changed.
 */
function ScrubField({
  cursorId,
  label,
  name,
  value,
  onChange,
}: {
  cursorId: string
  label: React.ReactNode
  name: string
  value: number
  onChange: (value: number) => void
}) {
  const [scrubbing, setScrubbing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = String(Math.round(value))

  function commit() {
    if (draft === null) return
    const next = Number.parseFloat(draft)
    if (Number.isFinite(next)) onChange(Math.max(0, next))
    setDraft(null)
  }

  return (
    <div
      data-cursor-id={cursorId}
      className={cn(
        "group/setting relative flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-stone-200/70 pl-2 pr-1.5 text-[12px] text-stone-900",
        (scrubbing || draft !== null) && "bg-white shadow-[0_0_0_1px_#2f6bf6]",
      )}
    >
      <SettingTooltip label={name} />
      <span
        data-cursor-id={`${cursorId}-scrub`}
        aria-hidden="true"
        className="flex h-full shrink-0 cursor-ew-resize items-center text-stone-500"
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.preventDefault()
          e.stopPropagation()
          const from = value
          setScrubbing(true)
          trackDrag(
            e,
            (dx) => onChange(Math.max(0, Math.round(from + dx / MARGIN_SCRUB_PX))),
            () => setScrubbing(false),
          )
        }}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={name}
        value={draft ?? shown}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setDraft(null)
        }}
        onBlur={commit}
        className="h-full min-w-0 flex-1 bg-transparent text-right tabular-nums outline-none selection:bg-[#2f6bf6]/25"
      />
    </div>
  )
}
