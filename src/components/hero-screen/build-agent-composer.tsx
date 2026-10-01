"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowUp, Mic, ScreenShare, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

/** Composer box size in screen px, used by the canvas to keep it clear of the side panels. */
export const COMPOSER_WIDTH = 300
export const COMPOSER_HEIGHT = 48

/** Pretend agent: how long it "works" before replying, and what it says. */
const AGENT_REPLY_DELAY_MS = 2400
const AGENT_REPLY = "It pseudoworks!"

type Message = { id: number; role: "user" | "agent"; text: string }

/**
 * Build Agent input that replaces the agent button next to the selected frame.
 * `left`/`top` follow the frame directly; `shiftX`/`shiftY` push it clear of the side panels and
 * are animated, so the box glides out of the way instead of being covered.
 *
 * Pseudo-functional chat: Enter sends the prompt, the agent "works" for a moment (reported via
 * `onWorkingChange` so the frame can show its working state), then replies with a canned message.
 */
export function BuildAgentComposer({
  left,
  top,
  shiftX,
  shiftY,
  onClose,
  onWorkingChange,
  onHeightChange,
}: {
  left: number
  top: number
  shiftX: number
  shiftY: number
  onClose: () => void
  /** The agent started / stopped working on the selected frame. */
  onWorkingChange: (working: boolean) => void
  /** Rendered height in screen px (grows once there are messages). */
  onHeightChange: (height: number) => void
}) {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [working, setWorking] = useState(false)
  /** Thumbs up / down given to agent replies, by message id. */
  const [feedback, setFeedback] = useState<Record<number, "up" | "down">>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)
  const empty = prompt.trim() === ""

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Tell the canvas while the agent works; closing the composer ends the working state.
  useEffect(() => {
    onWorkingChange(working)
    return () => onWorkingChange(false)
  }, [working, onWorkingChange])

  // The agent replies after a short delay (cancelled by Stop or closing the composer).
  useEffect(() => {
    if (!working) return
    const timer = setTimeout(() => {
      setMessages((m) => [...m, { id: nextId.current++, role: "agent", text: AGENT_REPLY }])
      setWorking(false)
    }, AGENT_REPLY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [working])

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages, working])

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
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text }])
    setPrompt("")
    setWorking(true)
  }

  /** Clear the conversation (also stops the agent). */
  function clear() {
    setMessages([])
    setFeedback({})
    setWorking(false)
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
          <div ref={listRef} className="flex max-h-80 flex-col gap-3 overflow-y-auto px-4 pb-3 pt-4">
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
                  <p className="select-text whitespace-pre-wrap break-words text-[13px] text-stone-800">{m.text}</p>
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
                </div>
              ),
            )}
            {working && (
              <p
                aria-live="polite"
                className="self-start bg-[linear-gradient(110deg,#a8a29e_40%,#44403c_50%,#a8a29e_60%)] bg-[length:300%_100%] bg-clip-text text-[13px] font-medium text-transparent animate-mi-shine"
              >
                Working...
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
                className="flex h-7 items-center gap-1.5 rounded-full border border-green-700/25 px-2.5 text-[12px] font-semibold text-green-700 hover:bg-green-700/5"
              >
                <ScreenShare className="size-3.5" strokeWidth={2} />
                Choose where to build
              </button>
            </div>
          )}
          <div className="mx-2 h-px bg-stone-200/70" />
        </>
      )}

      <div className="flex items-center gap-1 py-1.5 pl-4 pr-1.5" style={{ height: COMPOSER_HEIGHT }}>
        <input
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
            if (e.key === "Enter") {
              e.preventDefault()
              send()
            }
          }}
          placeholder={messages.length > 0 ? "Describe the change" : "Explore a fresh take..."}
          aria-label="Ask the Build Agent"
          className="min-w-0 flex-1 select-text bg-transparent text-[13px] text-stone-900 outline-none placeholder:text-stone-500"
        />
        {/* Dictation is offered only until the user starts typing */}
        {empty && (
          <button
            type="button"
            aria-label="Dictate"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-stone-600 hover:bg-stone-700/5"
          >
            <Mic className="size-4" strokeWidth={1.5} />
          </button>
        )}
        {working ? (
          <button
            type="button"
            aria-label="Stop"
            onClick={() => setWorking(false)}
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
