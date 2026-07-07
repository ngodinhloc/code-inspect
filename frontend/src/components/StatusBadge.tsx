"use client";

import { ProjectStatus } from "@/types/project";

const STATUS_BADGE_STYLES: Record<ProjectStatus, string> = {
  CREATED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  CHECKED_OUT: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  PARSED: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  INDEXED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  READY: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const STATUS_DOT_STYLES: Record<ProjectStatus, string> = {
  CREATED: "bg-zinc-400",
  CHECKED_OUT: "animate-pulse bg-sky-500",
  PARSED: "animate-pulse bg-violet-500",
  INDEXED: "animate-pulse bg-amber-500",
  READY: "bg-emerald-500",
  FAILED: "bg-red-500",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  CREATED: "Queued",
  CHECKED_OUT: "Cloning",
  PARSED: "Parsing",
  INDEXED: "Indexing",
  READY: "Ready",
  FAILED: "Failed",
};

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE_STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_STYLES[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}
