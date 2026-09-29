"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { AgentButton, CaptureConnector, CollaboratorCursor, CommentPin, Composer, FrameView } from "./canvas"
import { BOARD_HEIGHT, BOARD_WIDTH, INITIAL_FRAMES, type CanvasFrame, type FrameId } from "./data"
import { LeftPanel } from "./left-panel"
import { RightPanel, type CodeTab } from "./right-panel"
import { TopBar, type WorkspaceMode } from "./top-bar"

/** How far the canvas slides left in Code mode so frames stay clear of the wider code panel. */
const CODE_MODE_SHIFT = -180

type DragState = { id: FrameId; pointerX: number; pointerY: number; originX: number; originY: number }

export function HeroCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  const [frames, setFrames] = useState<CanvasFrame[]>(INITIAL_FRAMES)
  const [selectedId, setSelectedId] = useState<FrameId | null>("desktop")
  const [mode, setMode] = useState<WorkspaceMode>("design")
  const [codeTab, setCodeTab] = useState<CodeTab>("changes")
  const [shareOpen, setShareOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(true)

  const drag = useRef<DragState | null>(null)
  const [draggingId, setDraggingId] = useState<FrameId | null>(null)

  // Fit the fixed 1440×900 board to the container width.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / BOARD_WIDTH))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const frameById = (id: FrameId) => frames.find((f) => f.id === id)!
  const selected = selectedId ? frameById(selectedId) : null

  function changeMode(next: WorkspaceMode) {
    setMode(next)
    setShareOpen(false)
  }

  function startDrag(frame: CanvasFrame, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: frame.id, pointerX: e.clientX, pointerY: e.clientY, originX: frame.x, originY: frame.y }
    setDraggingId(frame.id)
    setSelectedId(frame.id)
    setShareOpen(false)
  }

  function moveDrag(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || !scale) return
    const x = Math.round(d.originX + (e.clientX - d.pointerX) / scale)
    const y = Math.round(d.originY + (e.clientY - d.pointerY) / scale)
    setFrames((prev) => prev.map((f) => (f.id === d.id ? { ...f, x, y } : f)))
  }

  function endDrag() {
    drag.current = null
    setDraggingId(null)
  }

  const portal = frameById("portal")
  const desktop = frameById("desktop")
  const mobile = frameById("mobile")

  return (
    <div className="relative w-full max-w-[1200px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-16 -top-14 bottom-4 -z-10"
        style={{
          background:
            "radial-gradient(62% 58% at 50% 28%, rgba(194,236,102,0.4), rgba(194,236,102,0.12) 46%, transparent 72%)",
        }}
      />
      <div
        ref={containerRef}
        className="relative aspect-[1440/900] w-full overflow-hidden rounded-[10px] border border-mi-ink/20 bg-stone-200 shadow-[0_2px_4px_rgba(17,17,16,0.05),0_50px_90px_-28px_rgba(17,17,16,0.28)] sm:rounded-[14px]"
      >
        <div className="pointer-events-none size-full lg:pointer-events-auto">
          <div
            className="absolute left-0 top-0 origin-top-left transition-opacity duration-400"
            style={{
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `scale(${scale ?? 1})`,
              opacity: scale ? 1 : 0,
            }}
          >
            {/* Canvas surface */}
            <div
              className="absolute inset-0 bg-mi-canvas"
              style={{
                backgroundImage: "radial-gradient(rgba(17,17,16,0.07) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
              onPointerDown={() => {
                setSelectedId(null)
                setShareOpen(false)
              }}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {/* World layer: slides aside when the code panel opens */}
              <div
                className="absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${mode === "code" ? CODE_MODE_SHIFT : 0}px)` }}
              >
                <CaptureConnector from={portal} to={desktop} />
                {frames.map((frame) => (
                  <FrameView
                    key={frame.id}
                    frame={frame}
                    selected={frame.id === selectedId}
                    dragging={frame.id === draggingId}
                    onPointerDown={(e) => startDrag(frame, e)}
                  />
                ))}
                <CommentPin frame={mobile} />
                <CollaboratorCursor x={mobile.x + mobile.w + 56} y={mobile.y + 150} />
                {selected && !draggingId && (
                  <AgentButton frame={selected} onClick={() => setComposerOpen((v) => !v)} />
                )}
                {selected && composerOpen && !draggingId && mode === "design" && (
                  <Composer key={selected.id} frame={selected} onClose={() => setComposerOpen(false)} />
                )}
              </div>
            </div>

            <TopBar
              mode={mode}
              onModeChange={changeMode}
              onOpenChanges={() => {
                setCodeTab("changes")
                changeMode("code")
              }}
              shareOpen={shareOpen}
              onShareToggle={() => setShareOpen((v) => !v)}
            />

            <LeftPanel
              frames={frames}
              selectedId={selectedId}
              onSelect={setSelectedId}
              className={cn(
                "transition-[translate,opacity] duration-400 ease-out",
                mode === "code" && "pointer-events-none -translate-x-[260px] opacity-0",
              )}
            />

            <RightPanel
              mode={mode}
              frame={selected}
              onModeChange={changeMode}
              codeTab={codeTab}
              onCodeTabChange={setCodeTab}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
