"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AGENT_CHATS,
  BUILD_FRAME_MS,
  BUILD_SCRIPT,
  EVENT_SOURCES,
  FALLBACK_REPLY,
  type AgentTurn,
  type EventSource,
  type VariantPart,
  type VariantSpec,
} from "./agent-script"
import { builtVariantChange } from "./built-change"
import type { CanvasRect } from "./drag"
import type { FrameComponent } from "./library-components"

/**
 * Simulated Build Agents. Sending a message schedules the agent's whole response up front on a
 * fixed timeline (think → stream the reply → maybe generate variants → summary), so a recorded
 * take replays identically. Runs live here, above the composer: closing the composer doesn't
 * stop an agent, and the canvas keeps showing its work.
 *
 * Generation: every variant first appears as a copy of its source (sliding out of it), then the
 * agent works on at most two variants at a time, alternating between them one piece per step:
 * it highlights the piece, then applies the new style. Rebuilt variants (layout / style) are
 * cleared first and their pieces reappear one by one.
 */

/* --------------------------------- Timing ---------------------------------- */

/** Default thinking time before a reply starts. */
const THINK_MS = 1400
/** One word of a streamed reply. */
const WORD_MS = 45
/** Pause after a reply before the agent moves on. */
const REPLY_PAUSE_MS = 500
/** Variant copies appear this far apart. */
const SCAFFOLD_STAGGER_MS = 180
/** After the last copy appears, before the first edit. */
const WORK_LEAD_MS = 700
/** A piece stays highlighted this long before its new style lands. */
const HIGHLIGHT_MS = 440
/** Pause after a piece lands before the next step. */
const SETTLE_MS = 240
/** At most this many variants are worked on at once. */
const CONCURRENCY = 2
/** After the last edit, before the dashed outlines clear and the summary starts. */
const FINISH_HOLD_MS = 600

/* ---------------------------------- Types ---------------------------------- */

export type AgentTask = { id: string; label: string }

export type AgentMessage = {
  id: number
  role: "user" | "agent"
  text: string
  /** Agent replies stream in: how many words are shown so far. */
  shown?: number
  /** Variants this reply is generating (rendered as a progress list). */
  tasks?: AgentTask[]
}

export type AgentPhase = "idle" | "thinking" | "replying" | "generating" | "building"

export type AgentSession = {
  id: number
  /** The selection it belongs to: sorted element ids joined by "+". */
  key: string
  elementIds: string[]
  /** Index into AGENT_CHATS, or null when the script has nothing left for it. */
  chat: number | null
  /** Turns used so far. */
  turn: number
  messages: AgentMessage[]
  working: boolean
  phase: AgentPhase
}

export type VariantState = {
  id: string
  sessionId: number
  source: EventSource
  spec: VariantSpec
  /** Frame name: "<source> — <variant label>". */
  name: string
  rect: CanvasRect
  /** Centre of the source when the variant was created (where its entrance starts). */
  from: { x: number; y: number }
  status: "queued" | "building" | "done"
  /** Pieces whose new style has landed. */
  applied: VariantPart[]
  /** The agent cleared the content to rebuild it (rebuild variants). */
  cleared: boolean
  /** The piece the agent is editing right now. */
  highlight: VariantPart | null
  /** The whole run is over: the dashed "in progress" outline goes away. */
  settled: boolean
}

/** Where an agent's cursor is: the piece it's editing. */
export type AgentFocus = { variantId: string; part: VariantPart }

/** Lays variants out: one row of rects per source, in the given order. */
export type PlaceVariants = (sources: { elementId: string; count: number }[]) => CanvasRect[][]

/** Number of words (with their trailing space) in a reply. */
export function wordsOf(text: string): string[] {
  return text.match(/\S+\s*/g) ?? []
}

function keyFor(elementIds: string[]) {
  return [...elementIds].sort().join("+")
}

function sameSet(a: string[], b: string[]) {
  return a.length === b.length && keyFor(a) === keyFor(b)
}

/* ---------------------------------- Hook ----------------------------------- */

/**
 * `initialBuiltComponents`: library components already built into the codebase when the screen
 * opens (e.g. a demo clip that starts after the build). Only read on mount.
 */
export function useBuildAgents(initialBuiltComponents: FrameComponent[] = []) {
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [variants, setVariants] = useState<VariantState[]>([])
  const [focus, setFocus] = useState<Record<number, AgentFocus | null>>({})
  /** The variant built into the codebase (it replaces its source in the live app), if any. */
  const [built, setBuilt] = useState<string | null>(null)
  /** Library components built into the codebase from their frames (a snapshot taken at build time). */
  const [builtComponents, setBuiltComponents] = useState<FrameComponent[]>(initialBuiltComponents)
  const sessionsRef = useRef(sessions)
  const variantsRef = useRef(variants)
  useEffect(() => {
    sessionsRef.current = sessions
    variantsRef.current = variants
  })
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>[]>())
  const nextSession = useRef(1)
  const nextMessage = useRef(1)

  useEffect(() => {
    const all = timers.current
    return () => {
      for (const list of all.values()) list.forEach(clearTimeout)
      all.clear()
    }
  }, [])

  const at = useCallback((sessionId: number, ms: number, run: () => void) => {
    const list = timers.current.get(sessionId) ?? []
    list.push(setTimeout(run, ms))
    timers.current.set(sessionId, list)
  }, [])

  const cancel = useCallback((sessionId: number) => {
    timers.current.get(sessionId)?.forEach(clearTimeout)
    timers.current.delete(sessionId)
  }, [])

  const patchSession = useCallback((id: number, patch: (s: AgentSession) => Partial<AgentSession>) => {
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, ...patch(s) } : s)))
  }, [])

  const patchMessage = useCallback(
    (sessionId: number, messageId: number, patch: Partial<AgentMessage>) => {
      patchSession(sessionId, (s) => ({ messages: s.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) }))
    },
    [patchSession],
  )

  const patchVariant = useCallback((id: string, patch: (v: VariantState) => Partial<VariantState>) => {
    setVariants((list) => list.map((v) => (v.id === id ? { ...v, ...patch(v) } : v)))
  }, [])

  /** Schedules a streamed agent message from `t`; returns when it has finished streaming. */
  const streamReply = useCallback(
    (sessionId: number, t: number, text: string, extra: Partial<AgentMessage> = {}) => {
      const id = nextMessage.current++
      const words = wordsOf(text).length
      at(sessionId, t, () =>
        patchSession(sessionId, (s) => ({
          phase: s.phase === "generating" || s.phase === "building" ? s.phase : "replying",
          messages: [...s.messages, { id, role: "agent", text, shown: 0, ...extra }],
        })),
      )
      for (let i = 1; i <= words; i++) at(sessionId, t + i * WORD_MS, () => patchMessage(sessionId, id, { shown: i }))
      return { id, end: t + words * WORD_MS }
    },
    [at, patchMessage, patchSession],
  )

  /** Schedules the variant generation from `t`; returns when it ends. */
  const planGeneration = useCallback(
    (sessionId: number, t0: number, sources: EventSource[], rows: CanvasRect[][], origins: { x: number; y: number }[]) => {
      const plans = sources.flatMap((source, si) =>
        source.variants.map((spec, vi) => ({
          id: `${sessionId}-${source.elementId}-${vi}`,
          source,
          spec,
          rect: rows[si][vi],
          from: origins[si],
        })),
      )

      at(sessionId, t0, () => patchSession(sessionId, () => ({ phase: "generating" })))

      // 1. Scaffold: copies of the sources slide out into their slots, one after another.
      plans.forEach((plan, i) =>
        at(sessionId, t0 + i * SCAFFOLD_STAGGER_MS, () =>
          setVariants((list) => [
            ...list,
            {
              id: plan.id,
              sessionId,
              source: plan.source,
              spec: plan.spec,
              name: `${plan.source.name} — ${plan.spec.label}`,
              rect: plan.rect,
              from: plan.from,
              status: "queued",
              applied: [],
              cleared: false,
              highlight: null,
              settled: false,
            },
          ]),
        ),
      )

      // 2. Work: two variants at a time, alternating one piece per step between them.
      let t = t0 + plans.length * SCAFFOLD_STAGGER_MS + WORK_LEAD_MS
      const queue = [...plans]
      const slots: { id: string; parts: VariantPart[] }[] = []
      const startNext = () => {
        const plan = queue.shift()
        if (!plan) return
        slots.push({ id: plan.id, parts: [...plan.spec.parts] })
        const rebuild = !!plan.spec.rebuild
        at(sessionId, t, () => patchVariant(plan.id, () => ({ status: "building", cleared: rebuild })))
      }
      for (let i = 0; i < CONCURRENCY; i++) startNext()

      let turn = 0
      while (slots.length > 0) {
        const slot = slots[turn]
        const part = slot.parts.shift()!
        const id = slot.id
        at(sessionId, t, () => {
          setFocus((f) => ({ ...f, [sessionId]: { variantId: id, part } }))
          patchVariant(id, () => ({ highlight: part }))
        })
        at(sessionId, t + HIGHLIGHT_MS, () => patchVariant(id, (v) => ({ applied: [...v.applied, part], highlight: null })))
        t += HIGHLIGHT_MS + SETTLE_MS

        if (slot.parts.length === 0) {
          at(sessionId, t, () => patchVariant(id, () => ({ status: "done" })))
          slots.splice(turn, 1)
          startNext() // the next variant takes the free slot
          if (slots.length > 0) turn %= slots.length
        } else {
          turn = (turn + 1) % slots.length
        }
      }

      // 3. Finish: the cursor leaves and the "in progress" outlines clear.
      t += FINISH_HOLD_MS
      const ids = new Set(plans.map((p) => p.id))
      at(sessionId, t, () => {
        setFocus((f) => ({ ...f, [sessionId]: null }))
        setVariants((list) => list.map((v) => (ids.has(v.id) ? { ...v, settled: true } : v)))
        patchSession(sessionId, () => ({ phase: "replying" }))
      })
      return { end: t, tasks: plans.map((p) => ({ id: p.id, label: `${p.source.title} — ${p.spec.label}` })) }
    },
    [at, patchSession, patchVariant],
  )

  /**
   * Send a message to the agent of a selection. `place` lays out the variants (called now, so it
   * reads the canvas as it is when the message is sent).
   */
  const send = useCallback(
    ({
      elementIds,
      text,
      place,
      originOf,
      components = [],
    }: {
      elementIds: string[]
      text: string
      place: PlaceVariants
      /** Current centre of an app element frame (where its variants slide out from). */
      originOf: (elementId: string) => { x: number; y: number }
      /** The library components inside the selected frames, as they are now (what a frame build ships). */
      components?: FrameComponent[]
    }) => {
      const key = keyFor(elementIds)
      const current = sessionsRef.current
      let session = current.find((s) => s.key === key)
      if (session?.working) return

      if (!session) {
        // The chat written for this selection and this first message, else the one written for
        // the selection, else the first general one nobody has used yet.
        const used = new Set(current.map((s) => s.chat))
        const free = (i: number) => !used.has(i)
        const forSelection = (c: (typeof AGENT_CHATS)[number]) => !!c.elements && sameSet(c.elements, elementIds)
        let chat = AGENT_CHATS.findIndex((c, i) => free(i) && forSelection(c) && c.prompt === text)
        if (chat < 0) chat = AGENT_CHATS.findIndex((c, i) => free(i) && forSelection(c) && c.prompt === undefined)
        if (chat < 0) chat = AGENT_CHATS.findIndex((c, i) => free(i) && c.prompt === undefined)
        session = {
          id: nextSession.current++,
          key,
          elementIds: [...elementIds],
          chat: chat < 0 ? null : chat,
          turn: 0,
          messages: [],
          working: false,
          phase: "idle",
        }
        const created = session
        setSessions((list) => [...list, created])
      }

      const sessionId = session.id
      const turn: AgentTurn = (session.chat !== null ? AGENT_CHATS[session.chat].turns[session.turn] : undefined) ?? {
        reply: FALLBACK_REPLY,
      }
      const userMessage: AgentMessage = { id: nextMessage.current++, role: "user", text }
      patchSession(sessionId, (s) => ({
        messages: [...s.messages, userMessage],
        turn: s.turn + 1,
        working: true,
        phase: "thinking",
      }))

      let t = turn.thinkMs ?? THINK_MS
      const sources = turn.generate ? EVENT_SOURCES.filter((src) => elementIds.includes(src.elementId)) : []

      if (turn.buildFrame) {
        // Reply, then build (the chat closes and the frames' badge spins), then the summary. The
        // components ship as they were when the message was sent.
        const snapshot = components
          .filter((c) => elementIds.includes(c.frameId))
          .map((c) => (turn.wiresUp ? { ...c, functional: true } : c))
        t = streamReply(sessionId, t, turn.reply).end + REPLY_PAUSE_MS
        at(sessionId, t, () => patchSession(sessionId, () => ({ phase: "building" })))
        t += BUILD_FRAME_MS
        at(sessionId, t, () =>
          setBuiltComponents((list) => [...list.filter((c) => !elementIds.includes(c.frameId)), ...snapshot]),
        )
        if (turn.summary) t = streamReply(sessionId, t + 100, turn.summary).end
        t += REPLY_PAUSE_MS / 2
      } else if (sources.length === 0) {
        t = streamReply(sessionId, t, turn.reply).end + REPLY_PAUSE_MS / 2
      } else {
        const rows = place(sources.map((src) => ({ elementId: src.elementId, count: src.variants.length })))
        const origins = sources.map((src) => originOf(src.elementId))
        const reply = streamReply(sessionId, t, turn.reply)
        const generation = planGeneration(sessionId, reply.end + REPLY_PAUSE_MS, sources, rows, origins)
        // The reply carries the progress list as soon as the copies start appearing.
        at(sessionId, reply.end + REPLY_PAUSE_MS, () => patchMessage(sessionId, reply.id, { tasks: generation.tasks }))
        t = generation.end
        if (turn.summary) t = streamReply(sessionId, t + REPLY_PAUSE_MS / 2, turn.summary).end
        t += REPLY_PAUSE_MS / 2
      }

      at(sessionId, t, () => {
        patchSession(sessionId, () => ({ working: false, phase: "idle" }))
        timers.current.delete(sessionId)
      })
    },
    [at, patchMessage, patchSession, planGeneration, streamReply],
  )

  /** Stop an agent: replies stop where they are, variants keep whatever has landed. */
  const stop = useCallback(
    (sessionId: number) => {
      cancel(sessionId)
      setFocus((f) => ({ ...f, [sessionId]: null }))
      setVariants((list) =>
        list.map((v) => (v.sessionId === sessionId ? { ...v, status: "done", highlight: null, settled: true } : v)),
      )
      patchSession(sessionId, (s) => ({
        working: false,
        phase: "idle",
        messages: s.messages.map((m) => (m.shown !== undefined ? { ...m, shown: wordsOf(m.text).length } : m)),
      }))
    },
    [cancel, patchSession],
  )

  /** Clear a conversation (also stops its agent). The variants stay on the canvas. */
  const clear = useCallback(
    (sessionId: number) => {
      stop(sessionId)
      patchSession(sessionId, () => ({ messages: [] }))
    },
    [patchSession, stop],
  )

  const sessionFor = useCallback((elementIds: string[]) => sessions.find((s) => s.key === keyFor(elementIds)), [sessions])

  /**
   * "Choose where to build": the agent builds a finished variant into the codebase. It reports
   * back in the variant's chat, and once it's done the variant replaces its source in the live
   * app (see `built`) and its diff joins the code changes.
   */
  const build = useCallback(
    (sessionId: number, variantId: string) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId)
      const variant = variantsRef.current.find((v) => v.id === variantId)
      if (!session || session.working || !variant) return
      const change = builtVariantChange(variant)
      // The whole run is "building" (chat closed, the frames' badge spinning) until it reports back.
      patchSession(sessionId, (s) => ({
        working: true,
        phase: "building",
        messages: [...s.messages, { id: nextMessage.current++, role: "user", text: BUILD_SCRIPT.request(variant) }],
      }))
      let t = BUILD_SCRIPT.thinkMs
      t = streamReply(sessionId, t, BUILD_SCRIPT.start(variant)).end
      t += BUILD_SCRIPT.buildMs
      at(sessionId, t, () => setBuilt(variantId))
      t = streamReply(sessionId, t + 100, BUILD_SCRIPT.done(variant, change)).end + REPLY_PAUSE_MS / 2
      at(sessionId, t, () => {
        patchSession(sessionId, () => ({ working: false, phase: "idle" }))
        timers.current.delete(sessionId)
      })
    },
    [at, patchSession, streamReply],
  )

  const builtVariant = variants.find((v) => v.id === built) ?? null

  return { sessions, variants, focus, send, stop, clear, sessionFor, build, builtVariant, builtComponents }
}
