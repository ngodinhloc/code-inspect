"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Github, Play, SearchCode } from "lucide-react";
import { createProject } from "@/lib/api";
import { addRecentProject } from "@/lib/recentProjects";

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/;

export default function NewProjectPage() {
  const router = useRouter();
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUrl = repositoryUrl.trim();
  const isValidUrl = GITHUB_URL_PATTERN.test(trimmedUrl);

  async function handleStart() {
    if (!isValidUrl || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({ repositoryUrl: trimmedUrl, branch: branch.trim() || "main" });
      addRecentProject({
        id: project.id,
        repositoryUrl: project.repositoryUrl,
        branch: project.branch,
        createdAt: project.createdAt,
      });
      router.push(`/projects/${project.id}`);
    } catch (e) {
      setError(String(e));
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-800 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:ring-indigo-950";
  const cardClass =
    "rounded-2xl border border-zinc-200/70 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60";

  return (
    <main className="w-full max-w-none p-4">
      <div className="relative mb-5 overflow-hidden rounded-3xl border border-zinc-200/70 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 shadow-lg shadow-slate-200/20 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:shadow-black/10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-rose-400/20 blur-3xl dark:bg-rose-500/10" />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
            <SearchCode size={22} />
          </span>
          <div>
            <h1 className="bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent dark:from-indigo-400 dark:via-violet-400 dark:to-rose-400">
              New Project
            </h1>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Connect a GitHub repository to build an AI-searchable index of its codebase.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <section className={`mx-auto max-w-xl ${cardClass}`}>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white dark:bg-indigo-500">
            <Github size={13} />
          </span>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Repository</h2>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Repository URL</label>
            <input
              value={repositoryUrl}
              onChange={(e) => setRepositoryUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
              className={inputClass}
            />
            {repositoryUrl.length > 0 && !isValidUrl && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Enter a public GitHub repository URL, e.g. https://github.com/org/repo
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Branch</label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 mx-auto mt-5 flex max-w-xl justify-end">
        <button
          onClick={handleStart}
          disabled={!isValidUrl || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50"
        >
          <Play size={16} />
          {submitting ? "Starting…" : "Start Ingestion"}
        </button>
      </div>
    </main>
  );
}
