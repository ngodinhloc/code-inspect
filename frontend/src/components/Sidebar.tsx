"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeft, PanelRight, Plus, ChevronDown, ChevronRight, SearchCode } from "lucide-react";
import { getRecentProjects, removeRecentProject, RecentProject } from "@/lib/recentProjects";
import { ApiError, getProject } from "@/lib/api";
import { ProjectStatus } from "@/types/project";

const POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES = new Set<ProjectStatus>(["READY", "FAILED"]);

// Simplified to the two states a user cares about at a glance, plus failed:
// still in the pipeline (orange, pulsing) vs ready to query (green).
const STATUS_DOT_CLASS: Record<ProjectStatus, string> = {
  CREATED: "bg-amber-500 animate-pulse",
  CHECKED_OUT: "bg-amber-500 animate-pulse",
  PARSED: "bg-amber-500 animate-pulse",
  INDEXED: "bg-amber-500 animate-pulse",
  READY: "bg-emerald-500",
  FAILED: "bg-red-500",
};

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [history, setHistory] = useState<RecentProject[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProjectStatus>>({});

  useEffect(() => {
    const refresh = () => setHistory(getRecentProjects());
    refresh();
    window.addEventListener("project-created", refresh);
    return () => window.removeEventListener("project-created", refresh);
  }, [pathname]);

  useEffect(() => {
    if (history.length === 0) return;
    let cancelled = false;
    const terminal = new Set<string>();

    function tick() {
      const pending = history.filter((p) => !terminal.has(p.id));
      if (pending.length === 0) return;
      Promise.all(
        pending.map((p) =>
          getProject(p.id)
            .then((project) => ({ id: p.id, status: project.status }))
            .catch((e) => {
              // The sidebar's history is a client-side cache with no other
              // way to learn the backend deleted this project — evict it.
              if (e instanceof ApiError && e.status === 404) {
                terminal.add(p.id);
                removeRecentProject(p.id);
              }
              return null;
            }),
        ),
      ).then((results) => {
        if (cancelled) return;
        const updates: Record<string, ProjectStatus> = {};
        for (const r of results) {
          if (!r) continue;
          updates[r.id] = r.status;
          if (TERMINAL_STATUSES.has(r.status)) terminal.add(r.id);
        }
        if (Object.keys(updates).length > 0) {
          setStatuses((prev) => ({ ...prev, ...updates }));
        }
      });
    }

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [history]);

  const navItemClass = (active: boolean) =>
    `flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
        : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-400 dark:hover:bg-zinc-800/70"
    }`;

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
        isOpen ? "w-72" : "w-14"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isOpen ? <PanelLeft size={16} /> : <PanelRight size={16} />}
        </button>
        {isOpen && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <SearchCode size={13} />
            </span>
            Code Inspect
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          <button onClick={() => router.push("/")} className={navItemClass(pathname === "/")}>
            <Plus size={15} className="shrink-0" />
            {isOpen && "New Project"}
          </button>
        </div>

        {isOpen && (
          <>
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="mt-5 flex w-full items-center gap-1 px-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400"
            >
              {historyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Projects
              {history.length > 0 && (
                <span className="ml-auto rounded-full bg-zinc-200 px-1.5 py-px text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {history.length}
                </span>
              )}
            </button>
            {historyOpen && (
              <div className="mt-1 space-y-0.5">
                {history.length === 0 && (
                  <p className="px-2.5 py-2 text-xs text-zinc-400 dark:text-zinc-600">No projects yet</p>
                )}
                {history.map((item) => {
                  const active = pathname === `/projects/${item.id}`;
                  const status = statuses[item.id];
                  return (
                    <button
                      key={item.id}
                      title={item.repositoryUrl}
                      onClick={() => router.push(`/projects/${item.id}`)}
                      className={`flex w-full flex-col rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-indigo-50 dark:bg-indigo-500/10"
                          : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            status ? STATUS_DOT_CLASS[status] : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        />
                        <span
                          className={`truncate ${
                            active
                              ? "font-medium text-indigo-700 dark:text-indigo-300"
                              : "text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {item.repositoryUrl.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                        </span>
                      </span>
                      <span className="pl-3 text-xs text-zinc-400 dark:text-zinc-600">{item.branch}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
