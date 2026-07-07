import { ChatResponse, CreateProjectRequest, Project } from "@/types/project";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, cache: "no-store" });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new ApiError(detail?.message ?? `Request failed: ${res.status}`, res.status);
  }
  return res.json();
}

export function createProject(body: CreateProjectRequest): Promise<Project> {
  return request("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getProject(id: string): Promise<Project> {
  return request(`/api/projects/${id}`);
}

export function createChat(projectId: string, question: string): Promise<{ id: string }> {
  return request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, question }),
  });
}

export function getChat(id: string): Promise<ChatResponse> {
  return request(`/api/chat/${id}`);
}

export function listChats(projectId: string): Promise<ChatResponse[]> {
  return request(`/api/projects/${projectId}/chats`);
}

export function chatWsUrl(id: string): string {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
  return `${base}/ws/chat?uuid=${id}`;
}
