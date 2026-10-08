"use client"

import { memo, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CircleCheck, ExternalLink, GitBranch, GitMerge, GitPullRequest, X } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { PULL_REQUEST, type PullRequest } from "./agent-script"

/** GitHub account the demo repos live under. */
const OWNER = "modeinspect"

/**
 * Top-bar GitHub control.
 * - not connected (draft project): a "Create a GitHub project" dialog. Creating one links the repo.
 * - connected: a "Github Sync" popover. Syncing pushes the canvas to a branch and opens a pull
 *   request; from then on the popover shows that PR (and the button a green dot).
 * - "View on Github" opens the PR; merging it calls `onMerged` (the canvas closes).
 */
export const GithubButton = memo(function GithubButton({
  connected: initiallyConnected,
  defaultRepoName,
  branch = "main",
  changes,
  pullRequest = PULL_REQUEST,
  onMerged,
  defaultOpen = false,
  openOnCue = false,
}: {
  connected: boolean
  /** Opens with its popover / dialog already showing. */
  defaultOpen?: boolean
  /**
   * Opens the popover when this turns true (e.g. at its step of a load-in intro), with a softer,
   * slightly longer opening than a click's.
   */
  openOnCue?: boolean
  /** Prefilled repository name in the create dialog. */
  defaultRepoName: string
  /** Branch the project was imported from (connected state). */
  branch?: string
  /** What the pull request contains (files changed, lines added / removed). */
  changes: { files: number; added: number; removed: number }
  /** The pull request syncing opens (title, description, branch). */
  pullRequest?: PullRequest
  /** The pull request was merged. */
  onMerged?: () => void
}) {
  const [connected, setConnected] = useState(initiallyConnected)
  /** Repository the project is linked to (set when one is created). */
  const [repo, setRepo] = useState(defaultRepoName)
  const [open, setOpen] = useState(defaultOpen)
  /** The canvas has been synced: its branch and pull request exist. */
  const [synced, setSynced] = useState(false)
  const [prOpen, setPrOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const prBranch = `${OWNER}/${repo}-${pullRequest.branchSuffix}`

  /** The popover was opened by the cue (not a click): it uses the intro opening. */
  const [cued, setCued] = useState(false)
  useEffect(() => {
    if (!openOnCue) return
    setCued(true)
    setOpen(true)
  }, [openOnCue])

  // Close the sync popover on outside click or Escape (the dialog handles its own dismissal)
  useEffect(() => {
    if (!open || !connected) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, connected])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="GitHub"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        // No background at rest or while open: like the other top-bar buttons, it only tints on hover.
        className="relative flex size-8 items-center justify-center rounded-md text-stone-800 hover:bg-stone-700/5"
      >
        <GithubIcon />
        {/* Synced: green dot */}
        {synced && (
          <span className="absolute right-[3px] top-1/2 size-[5px] -translate-y-1/2 rounded-full bg-green-500 animate-in zoom-in-0 duration-200" />
        )}
      </button>

      {open && connected && (
        <GithubSyncPopover
          cued={cued}
          branch={branch}
          repo={`${OWNER}/${repo}`}
          prBranch={prBranch}
          synced={synced}
          pullRequest={pullRequest}
          onSynced={() => setSynced(true)}
          onViewPr={() => {
            setOpen(false)
            setPrOpen(true)
          }}
        />
      )}
      {open && !connected && (
        <CreateGithubProjectDialog
          anchor={rootRef}
          defaultName={defaultRepoName}
          onCancel={() => setOpen(false)}
          onCreate={(name) => {
            setRepo(name)
            setConnected(true)
            setOpen(false)
          }}
        />
      )}
      {prOpen && (
        <PullRequestSheet
          anchor={rootRef}
          repo={`${OWNER}/${repo}`}
          branch={branch}
          prBranch={prBranch}
          changes={changes}
          pullRequest={pullRequest}
          onClose={() => setPrOpen(false)}
          onMerged={() => {
            setPrOpen(false)
            onMerged?.()
          }}
        />
      )}
    </div>
  )
})

/* ------------------------------ Connected state ----------------------------- */

/** Pretend sync: pushing the branch and opening the pull request. */
const SYNC_MS = 1800

function GithubSyncPopover({
  cued = false,
  branch,
  repo,
  prBranch,
  synced,
  pullRequest,
  onSynced,
  onViewPr,
}: {
  /** Opened by the intro cue: scales up out of the GitHub button as it fades and drops in. */
  cued?: boolean
  branch: string
  repo: string
  prBranch: string
  synced: boolean
  pullRequest: PullRequest
  onSynced: () => void
  onViewPr: () => void
}) {
  const [syncing, setSyncing] = useState(false)
  const onSyncedRef = useRef(onSynced)
  useEffect(() => {
    onSyncedRef.current = onSynced
  })

  useEffect(() => {
    if (!syncing) return
    const timer = setTimeout(() => {
      setSyncing(false)
      onSyncedRef.current()
    }, SYNC_MS)
    return () => clearTimeout(timer)
  }, [syncing])

  return (
    <div
      role="dialog"
      aria-label="Github Sync"
      className={cn(
        "absolute right-0 top-full z-50 mt-1.5 flex w-[300px] flex-col rounded-xl border border-stone-700/10 bg-[#f3f3f1] p-3 shadow-[0_4px_14px_-4px_rgba(17,17,16,0.14),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in",
        cued
          ? "origin-top-right zoom-in-90 slide-in-from-top-2 duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          : "slide-in-from-top-1 duration-150",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-px-13 font-medium text-stone-900">Github Sync</h2>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Open repository on GitHub"
          className="-mr-1 flex size-6 items-center justify-center rounded-md text-stone-500 hover:bg-stone-700/5 hover:text-stone-800"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.5} />
        </a>
      </div>

      {synced ? (
        <div className="flex flex-col animate-in fade-in duration-300">
          <p className="mt-1.5 flex items-center gap-2 text-px-12 text-stone-700">
            <span className="size-1.5 rounded-full bg-green-500" />
            Your canvas is synced with its branch
          </p>
          <div data-cursor-id="github-pr-card" className="mt-4 flex flex-col gap-2 rounded-lg bg-stone-700/5 p-3">
            <p className="truncate text-[14px] font-medium leading-5 text-stone-900">{pullRequest.title}</p>
            <p className="flex min-w-0 items-center gap-1.5 text-px-12 text-stone-600">
              <GitBranch className="size-3.5 shrink-0 text-stone-500" strokeWidth={1.5} />
              <span className="truncate">{prBranch}</span>
            </p>
            <p className="line-clamp-2 text-px-12 text-stone-500">{pullRequest.description}</p>
          </div>
          <button
            type="button"
            onClick={onViewPr}
            className="mt-2 flex h-8 w-full items-center justify-center rounded-lg bg-stone-700/5 text-px-13 font-medium text-stone-900 hover:bg-stone-700/10"
          >
            View on Github
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1.5 flex items-center gap-1.5 text-px-12 text-stone-700">
            <GitBranch className="size-3.5 text-stone-500" strokeWidth={1.5} />
            Imported from {branch}
          </p>
          <p className="mt-1 truncate pl-5 text-px-12 text-stone-500">{repo}</p>
          <div className="my-3 h-px bg-stone-700/10" />
          <button
            type="button"
            disabled={syncing}
            onClick={() => setSyncing(true)}
            // Not through cn(): tailwind-merge reads the custom `text-px-12` size as a text colour and
            // drops it in favour of `text-stone-900`.
            className={`flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-px-12 font-medium text-stone-900 shadow-[0_1px_2px_rgba(22,33,10,0.12)] transition-colors ${
              syncing ? "bg-mi-lime-deep" : "bg-mi-lime hover:bg-mi-lime-deep"
            }`}
          >
            {syncing && <Spinner className="size-3.5" />}
            {syncing ? "Syncing…" : "Sync to Github"}
          </button>
          <p className="mt-2.5 text-px-12 text-stone-500">
            {syncing ? "Pushing a branch and opening a pull request…" : "Changes sync as a new branch."}
          </p>
        </>
      )}
    </div>
  )
}

/* ------------------------------- Pull request ------------------------------- */

/** Pretend merge: how long "Merging…" runs, and how long "Merged" shows before `onMerged`. */
const MERGE_MS = 1300
const MERGED_HOLD_MS = 1900

/**
 * The pull request, GitHub-style, over the hero screen: title, branches, what changed, checks,
 * and "Merge pull request". Merging flips it to Merged, then reports back.
 */
function PullRequestSheet({
  anchor,
  repo,
  branch,
  prBranch,
  changes,
  pullRequest,
  onClose,
  onMerged,
}: {
  anchor: React.RefObject<HTMLElement | null>
  repo: string
  branch: string
  prBranch: string
  changes: { files: number; added: number; removed: number }
  pullRequest: PullRequest
  onClose: () => void
  onMerged: () => void
}) {
  const [phase, setPhase] = useState<"open" | "merging" | "merged">("open")
  const [host] = useState<Element | null>(() => anchor.current?.closest("[data-hero-root]") ?? null)
  const onMergedRef = useRef(onMerged)
  useEffect(() => {
    onMergedRef.current = onMerged
  })

  useEffect(() => {
    if (phase === "open") return
    const timer = setTimeout(
      () => (phase === "merging" ? setPhase("merged") : onMergedRef.current()),
      phase === "merging" ? MERGE_MS : MERGED_HOLD_MS,
    )
    return () => clearTimeout(timer)
  }, [phase])

  const merged = phase === "merged"
  return createPortal(
    <div
      className={cn("inset-0 z-50 flex items-center justify-center bg-stone-900/15 p-6 animate-in fade-in duration-150", host ? "absolute" : "fixed")}
      onPointerDown={phase === "open" ? onClose : undefined}
    >
      <section
        role="dialog"
        aria-label="Pull request"
        onPointerDown={(e) => e.stopPropagation()}
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[#d0d7de] bg-white text-[#1f2328] shadow-[0_16px_48px_-12px_rgba(17,17,16,0.35)] animate-in fade-in zoom-in-95 duration-200"
      >
        <header className="flex items-center justify-between gap-2 border-b border-[#d0d7de] bg-[#f6f8fa] px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-[#59636e]">
            <GithubIcon />
            <span className="truncate">
              {repo} · Pull request #{pullRequest.number}
            </span>
          </span>
          <button
            type="button"
            aria-label="Close pull request"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-[#59636e] hover:bg-black/5"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
          <h2 className="text-[20px] font-semibold leading-tight">
            {pullRequest.title} <span className="font-normal text-[#59636e]">#{pullRequest.number}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#59636e]">
            <span
              key={merged ? "merged" : "open"}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-white animate-in zoom-in-90 duration-200",
                merged ? "bg-[#8250df]" : "bg-[#1f883d]",
              )}
            >
              {merged ? <GitMerge className="size-3.5" strokeWidth={2} /> : <GitPullRequest className="size-3.5" strokeWidth={2} />}
              {merged ? "Merged" : "Open"}
            </span>
            <span>
              <strong className="font-semibold text-[#1f2328]">{OWNER}</strong> {merged ? "merged" : "wants to merge"}{" "}
              {pullRequest.commits} commits into <Branch>{branch}</Branch> from <Branch>{prBranch}</Branch>
            </span>
          </div>
          <p className="rounded-md border border-[#d0d7de] px-3 py-2.5 text-[13px] leading-5">{pullRequest.description}</p>
          <p className="text-[12px] tabular-nums text-[#59636e]">
            {changes.files} files changed <span className="font-medium text-[#1a7f37]">+{changes.added}</span>{" "}
            <span className="font-medium text-[#d1242f]">−{changes.removed}</span>
          </p>

          {/* Merge box */}
          <div
            className={cn(
              "flex flex-col gap-3 rounded-md border p-3 transition-colors",
              merged ? "border-[#8250df]/40 bg-[#fbefff]" : "border-[#d0d7de]",
            )}
          >
            {merged ? (
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#8250df] animate-in fade-in duration-300">
                <GitMerge className="size-4" strokeWidth={2} />
                Pull request successfully merged and closed
              </p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  <CircleCheck className="size-4 text-[#1a7f37]" strokeWidth={2} />
                  All checks have passed
                </p>
                <p className="-mt-1.5 pl-6 text-[12px] text-[#59636e]">This branch has no conflicts with the base branch.</p>
                <button
                  type="button"
                  disabled={phase !== "open"}
                  onClick={() => setPhase("merging")}
                  className="flex h-8 items-center justify-center gap-1.5 self-start rounded-md bg-[#1f883d] px-3.5 text-[13px] font-semibold text-white hover:bg-[#1a7f37] disabled:opacity-80"
                >
                  {phase === "merging" && <Spinner className="size-3.5" />}
                  {phase === "merging" ? "Merging…" : "Merge pull request"}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>,
    host ?? document.body,
  )
}

function Branch({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md bg-[#ddf4ff] px-1.5 py-0.5 font-mono text-[12px] text-[#0969da]">{children}</code>
}

/* ---------------------------- Not connected state --------------------------- */

function CreateGithubProjectDialog({
  anchor,
  defaultName,
  onCancel,
  onCreate,
}: {
  /** The GitHub button: the dialog renders into the hero screen it sits in. */
  anchor: React.RefObject<HTMLElement | null>
  defaultName: string
  onCancel: () => void
  onCreate: (name: string) => void
}) {
  const [name, setName] = useState(defaultName)
  const [isPublic, setIsPublic] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  /** The hero screen's root (the dialog covers just the screen); <body> outside of one. */
  const [host] = useState<Element | null>(() => anchor.current?.closest("[data-hero-root]") ?? null)

  // Select the prefilled name so it can be typed over straight away
  useEffect(() => {
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onCancel])

  // Portalled out of the top bar (its own stacking context would let the toolbar sit above the
  // backdrop) into the hero screen's root, so it covers the screen, not the whole page.
  return createPortal(
    <div
      className={cn(
        "inset-0 z-50 flex items-center justify-center bg-stone-900/10 p-4 animate-in fade-in duration-150",
        host ? "absolute" : "fixed",
      )}
      onPointerDown={onCancel}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-github-project-title"
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onCreate(name.trim())
        }}
        className="flex w-full max-w-[460px] flex-col rounded-2xl bg-[#f3f3f1] p-4 shadow-[0_12px_40px_-8px_rgba(17,17,16,0.25),0_1px_3px_rgba(17,17,16,0.08)] animate-in fade-in zoom-in-95 duration-150"
      >
        <h2 id="create-github-project-title" className="text-[15px] font-medium leading-5 text-stone-900">
          Create a GitHub project
        </h2>

        <label htmlFor="github-repo-name" className="mt-4 text-px-13 font-medium text-stone-900">
          Name
        </label>
        <input
          ref={inputRef}
          id="github-repo-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          className="mt-1.5 h-9 w-full select-text rounded-lg border border-stone-700/15 bg-white px-2.5 text-px-13 text-stone-900 outline-none selection:bg-mi-lime/70 focus:border-stone-700/30"
        />

        <div className="mt-3 flex items-center justify-between gap-4 rounded-lg bg-stone-700/5 px-3 py-2.5">
          <div className="flex flex-col gap-0.5">
            <span id="github-public-label" className="text-px-13 font-medium text-stone-900">
              Public repository
            </span>
            <span className="text-px-12 text-stone-700">Anyone on GitHub can see your code.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-labelledby="github-public-label"
            onClick={() => setIsPublic((v) => !v)}
            className={cn(
              "relative h-[18px] w-8 shrink-0 rounded-full transition-colors",
              isPublic ? "bg-stone-900" : "bg-stone-700/15",
            )}
          >
            <span
              className={cn(
                "absolute left-0.5 top-0.5 size-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(17,17,16,0.2)] transition-transform",
                isPublic && "translate-x-[14px]",
              )}
            />
          </button>
        </div>

        <div className="my-3 h-px bg-stone-700/10" />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 items-center rounded-md bg-stone-700/5 px-3.5 text-px-13 font-medium text-stone-800 hover:bg-stone-700/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex h-8 items-center rounded-md bg-white px-3.5 text-px-13 font-medium text-stone-900 shadow-[0_1px_3px_rgba(17,17,16,0.12)] hover:bg-stone-50 disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </form>
    </div>,
    host ?? document.body,
  )
}

function GithubIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 0C7.16 0 0 7.3411 0 16.4047C0 23.6638 4.58 29.795 10.94 31.9687C11.74 32.1122 12.04 31.6201 12.04 31.1894C12.04 30.7998 12.02 29.508 12.02 28.1341C8 28.8928 6.96 27.1293 6.64 26.2065C6.46 25.7349 5.68 24.279 5 23.8893C4.44 23.5818 3.64 22.823 4.98 22.8025C6.24 22.782 7.14 23.9919 7.44 24.484C8.88 26.9652 11.18 26.268 12.1 25.8374C12.24 24.7711 12.66 24.0534 13.12 23.6433C9.56 23.2332 5.84 21.8183 5.84 15.5435C5.84 13.7594 6.46 12.283 7.48 11.1347C7.32 10.7246 6.76 9.04309 7.64 6.78745C7.64 6.78745 8.98 6.35682 12.04 8.46893C13.32 8.09982 14.68 7.91527 16.04 7.91527C17.4 7.91527 18.76 8.09982 20.04 8.46893C23.1 6.33632 24.44 6.78745 24.44 6.78745C25.32 9.04309 24.76 10.7246 24.6 11.1347C25.62 12.283 26.24 13.7389 26.24 15.5435C26.24 21.8388 22.5 23.2332 18.94 23.6433C19.52 24.1559 20.02 25.1402 20.02 26.6781C20.02 28.8723 20 30.6358 20 31.1894C20 31.6201 20.3 32.1327 21.1 31.9687C27.42 29.795 32 23.6433 32 16.4047C32 7.3411 24.84 0 16 0Z"
      />
    </svg>
  )
}
