"use client";

import { use, useEffect, useRef, useState } from "react";
import { GitBranch, Github } from "lucide-react";
import QueryChat from "@/components/QueryChat";
import StatusBadge from "@/components/StatusBadge";
import StatusTimeline from "@/components/StatusTimeline";
import { getProject } from "@/lib/api";
import { Project } from "@/types/project";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["READY", "FAILED"]);

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    function stopPolling() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function fetchProject() {
      getProject(id)
        .then((next) => {
          if (cancelled) return;
          setProject(next);
          if (TERMINAL_STATUSES.has(next.status)) stopPolling();
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    }

    fetchProject();
    timerRef.current = setInterval(fetchProject, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [id]);

  return (
    <main className="w-full max-w-none p-4">
      {error && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!project ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading project…</p>
      ) : (
        <>
          <div className="mb-5 rounded-2xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <Github size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {project.repositoryUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <GitBranch size={11} />
                    {project.branch}
                  </p>
                </div>
              </div>
              <StatusBadge status={project.status} />
            </div>

            <StatusTimeline status={project.status} />

            {project.status === "FAILED" && project.failureReason && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {project.failureReason}
              </div>
            )}
          </div>

          {project.status === "READY" ? (
            <QueryChat projectId={project.id} />
          ) : project.status !== "FAILED" ? (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Indexing in progress — questions will be available once the project is ready.
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
