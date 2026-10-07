"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowUp, Check, Mic, ScreenShare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { wordsOf, type AgentMessage, type AgentSession, type AgentTask, type VariantState } from "./build-agents"
import { AgentStar } from "./planner-frame"

/** Composer box size in screen px, used by the canvas to keep it clear of the side panels. */
export const COMPOSER_WIDTH = 300
export const COMPOSER_HEIGHT = 48
/** The prompt field grows up to this tall (px), then scrolls. */
const PROMPT_MAX_HEIGHT = 120

/**
 * Build Agent input that replaces the agent button next to the selection.
 * `left`/`top` follow the selection directly; `shiftX`/`shiftY` push it clear of the side panels
 * and are animated, so the box glides out of the way instead of being covered.
 *
 * Shows the selection's agent session (see useBuildAgents): the conversation lives there, so it
 * survives closing the composer and the agent keeps working meanwhile.
 */
export function BuildAgentComposer({
  left,
  top,
  shiftX,
  shiftY,
  session,
  variants,
  onSend,
  onStop,
  onClear,
  onChooseBuild,
  picking = false,
  onClose,
  onHeightChange,
}: {
  left: number
  top: number
  shiftX: number
  shiftY: number
  /** The selection's agent session (none until the first message). */
  session: AgentSession | undefined
  /** Generated variants, for the progress list of a generating reply. */
  variants: VariantState[]
  onSend: (text: string) => void
  onStop: () => void
  onClear: () => void
  /** "Choose where to build": pick one of this chat's variants to build into the codebase. */
  onChooseBuild?: () => void
  /** Picking a variant is under way. */
  picking?: boolean
  onClose: () => void
  /** Rendered height in screen px (grows once there are messages). */
  onHeightChange: (height: number) => void
}) {
  const [prompt, setPrompt] = useState("")
  /** Thumbs up / down given to agent replies, by message id. */
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({})
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const empty = prompt.trim() === ""
  const messages = session?.messages ?? []
  const working = session?.working ?? false

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // The prompt grows with what's typed (up to PROMPT_MAX_HEIGHT, then it scrolls).
  useLayoutEffect(() => {
    const field = inputRef.current
    if (!field) return
    field.style.height = "auto"
    field.style.height = `${Math.min(field.scrollHeight, PROMPT_MAX_HEIGHT)}px`
  }, [prompt])

  // Keep the newest message in view (also as replies stream in and tasks tick off).
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [session, variants])

  // Report the height so the canvas can keep the whole card on screen.
  useEffect(() => {
    const node = formRef.current
    if (!node) return
    const observer = new ResizeObserver(() => onHeightChange(node.offsetHeight))
    observer.observe(node)
    return () => observer.disconnect()
  }, [onHeightChange])

  function send() {
    const text = prompt.trim()
    if (text === "" || working) return
    onSend(text)
    setPrompt("")
  }

  /** Clear the conversation (also stops the agent). */
  function clear() {
    onClear()
    setFeedback({})
    inputRef.current?.focus()
  }

  /** Toggle a thumbs up / down on an agent reply. */
  function rate(id: number, value: "up" | "down") {
    setFeedback((f) => {
      const next = { ...f }
      if (next[id] === value) delete next[id]
      else next[id] = value
      return next
    })
  }

  return (
    <form
      ref={formRef}
      role="search"
      aria-label="Build Agent"
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex flex-col rounded-[22px] bg-white shadow-[0_8px_24px_-8px_rgba(17,17,16,0.25),0_1px_3px_rgba(17,17,16,0.08)] transition-[translate] duration-300 ease-out animate-in fade-in zoom-in-95"
      style={{ left, top, width: COMPOSER_WIDTH, translate: `${shiftX}px ${shiftY}px` }}
    >
      {messages.length > 0 && (
        <>
          <div ref={listRef} className="flex max-h-80 select-text flex-col gap-3 overflow-y-auto px-4 pb-3 pt-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <p
                  key={m.id}
                  className="max-w-[85%] select-text self-end whitespace-pre-wrap break-words rounded-[18px] bg-stone-200/70 px-3 py-1.5 text-[13px] text-stone-900"
                >
                  {m.text}
                </p>
              ) : (
                <div key={m.id} className="flex flex-col gap-1.5">
                  <p className="select-text whitespace-pre-wrap break-words text-[13px] text-stone-800">{streamed(m)}</p>
                  {m.tasks && <TaskList tasks={m.tasks} variants={variants} />}
                  {(m.shown === undefined || m.shown >= wordsOf(m.text).length) && !(working && m.tasks) && (
                  <div className={cn("-ml-1.5 flex items-center gap-0.5 transition-opacity", feedback[m.id] && "opacity-70")}>
                    <button
                      type="button"
                      aria-label="Good response"
                      aria-pressed={feedback[m.id] === "up"}
                      onClick={() => rate(m.id, "up")}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md hover:bg-stone-700/5",
                        feedback[m.id] === "up" ? "text-[#2f6bf6]" : "text-stone-400",
                      )}
                    >
                      <ThumbsUp className="size-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      aria-label="Bad response"
                      aria-pressed={feedback[m.id] === "down"}
                      onClick={() => rate(m.id, "down")}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md hover:bg-stone-700/5",
                        feedback[m.id] === "down" ? "text-[#2f6bf6]" : "text-stone-400",
                      )}
                    >
                      <ThumbsDown className="size-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                  )}
                </div>
              ),
            )}
            {(session?.phase === "thinking" || session?.phase === "generating" || session?.phase === "building") && (
              <p
                aria-live="polite"
                className="self-start bg-[linear-gradient(110deg,#a8a29e_40%,#44403c_50%,#a8a29e_60%)] bg-[length:300%_100%] bg-clip-text text-[13px] font-medium text-transparent animate-mi-shine"
              >
                {session.phase === "generating"
                  ? "Building variants..."
                  : session.phase === "building"
                    ? "Building into the codebase..."
                    : "Working..."}
              </p>
            )}
          </div>
          {/* Conversation actions, once the agent has replied */}
          {!working && (
            <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
              <button
                type="button"
                onClick={clear}
                className="flex h-7 items-center gap-1.5 rounded-full border border-stone-200 px-2.5 text-[12px] font-semibold text-stone-600 hover:bg-stone-700/5"
              >
                <Trash2 className="size-3.5" strokeWidth={2} />
                Clear
              </button>
              <button
                type="button"
                data-cursor-id="choose-where-to-build"
                aria-pressed={picking}
                onClick={onChooseBuild}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-colors",
                  picking
                    ? "border-green-700 bg-green-700 text-white"
                    : "border-green-700/25 text-green-700 hover:bg-green-700/5",
                )}
              >
                <ScreenShare className="size-3.5" strokeWidth={2} />
                {picking ? "Pick a variant…" : "Choose where to build"}
              </button>
            </div>
          )}
          <div className="mx-2 h-px bg-stone-200/70" />
        </>
      )}

      {/* Prompt row: the field grows as you type; the buttons stay on its last line */}
      <div className="flex items-end gap-1 py-1.5 pl-4 pr-1.5" style={{ minHeight: COMPOSER_HEIGHT }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={messages.length > 0 ? "Describe the change" : "Explore a fresh take..."}
          aria-label="Ask the Build Agent"
          className="min-w-0 flex-1 resize-none select-text bg-transparent py-[9px] text-[13px] leading-[18px] text-stone-900 outline-none placeholder:text-stone-500"
        />
        {/* Dictation is offered only until the user starts typing */}
        {empty && (
          <button
            type="button"
            aria-label="Dictate"
            className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-700/5"
          >
            <Mic className="size-4" strokeWidth={1.5} />
          </button>
        )}
        {working ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={onStop}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-stone-200 hover:bg-stone-700/5"
          >
            <span className="size-3 rounded-[2px] bg-stone-900" />
          </button>
        ) : messages.length > 0 ? (
          <button
            type="submit"
            disabled={empty}
            aria-label="Send"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
              empty ? "bg-stone-200/80 text-stone-400" : "bg-[#2f6bf6] text-white hover:bg-[#2159dc]",
            )}
          >
            <ArrowUp className="size-4" strokeWidth={2} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={empty}
            className={cn(
              "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
              empty ? "bg-stone-200/80 text-stone-400" : "bg-[#2f6bf6] text-white hover:bg-[#2159dc]",
            )}
          >
            Explore
          </button>
        )}
      </div>
    </form>
  )
}

/** The part of an agent reply streamed in so far. */
function streamed(m: AgentMessage) {
  if (m.shown === undefined) return m.text
  return wordsOf(m.text).slice(0, m.shown).join("")
}

/**
 * Progress of a generating reply: one row per variant once it's on the canvas, with a spinning
 * star while the agent builds it and a check once it's done.
 */
function TaskList({ tasks, variants }: { tasks: AgentTask[]; variants: VariantState[] }) {
  const rows = tasks.flatMap((task) => {
    const variant = variants.find((v) => v.id === task.id)
    return variant ? [{ ...task, status: variant.status }] : []
  })
  if (rows.length === 0) return null
  return (
    <ul className="flex flex-col gap-1 rounded-xl bg-stone-100/80 px-2.5 py-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-2 text-[12px] animate-in fade-in slide-in-from-top-0.5 duration-200">
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full",
              row.status === "done" ? "bg-mi-lime text-stone-900" : row.status === "building" ? "bg-stone-200 text-stone-600" : "border border-stone-300",
            )}
          >
            {row.status === "done" && <Check key="done" className="size-2.5" strokeWidth={3} />}
            {row.status === "building" && <AgentStar key="building" className="size-2.5 animate-spin [animation-duration:1.6s]" />}
          </span>
          <span className={cn("truncate", row.status === "queued" ? "text-stone-400" : "text-stone-700")}>{row.label}</span>
        </li>
      ))}
    </ul>
  )
}
