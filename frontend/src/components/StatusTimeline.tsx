"use client";

import { Check, X } from "lucide-react";
import { ProjectStatus } from "@/types/project";

const STAGES: { status: ProjectStatus; label: string }[] = [
  { status: "CREATED", label: "Started" },
  { status: "CHECKED_OUT", label: "Checked Out" },
  { status: "PARSED", label: "Parsed" },
  { status: "INDEXED", label: "Indexed" },
  { status: "READY", label: "Ready" },
];

export default function StatusTimeline({ status }: { status: ProjectStatus }) {
  const failed = status === "FAILED";
  const currentIndex = failed ? -1 : STAGES.findIndex((s) => s.status === status);

  return (
    <div className="flex items-center">
      {STAGES.map((stage, i) => {
        const done = !failed && i < currentIndex;
        const active = !failed && i === currentIndex;
        const isLast = i === STAGES.length - 1;

        return (
          <div key={stage.status} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors ${
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-zinc-200 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600"
                }`}
              >
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span
                className={`whitespace-nowrap text-xs font-medium ${
                  active ? "text-indigo-600 dark:text-indigo-300" : "text-zinc-500 dark:text-zinc-500"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={`mx-1.5 h-0.5 flex-1 rounded-full ${done ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`}
              />
            )}
          </div>
        );
      })}
      {failed && (
        <div className="ml-3 flex flex-col items-center gap-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-red-500 bg-red-500 text-white">
            <X size={14} />
          </div>
          <span className="whitespace-nowrap text-xs font-medium text-red-600 dark:text-red-400">Failed</span>
        </div>
      )}
    </div>
  );
}
