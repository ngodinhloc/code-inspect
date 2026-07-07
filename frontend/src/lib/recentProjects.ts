const STORAGE_KEY = "code-inspect:recent-projects";
const MAX_ENTRIES = 20;

export interface RecentProject {
  id: string;
  repositoryUrl: string;
  branch: string;
  createdAt: string;
}

export function getRecentProjects(): RecentProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentProject(project: RecentProject): void {
  if (typeof window === "undefined") return;
  const existing = getRecentProjects().filter((p) => p.id !== project.id);
  const next = [project, ...existing].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("project-created"));
}

// Called when the backend reports a project as gone (404) — the sidebar's
// history is a client-side cache with no other way to learn a project was
// deleted server-side.
export function removeRecentProject(id: string): void {
  if (typeof window === "undefined") return;
  const next = getRecentProjects().filter((p) => p.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("project-created"));
}
