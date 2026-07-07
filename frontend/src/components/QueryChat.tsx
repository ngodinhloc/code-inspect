"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ChevronRight, FileCode2, Loader2, SearchCode, Send, User } from "lucide-react";
import { chatWsUrl, createChat, getChat, listChats } from "@/lib/api";
import { AnswerStepResponse, ChatMessage, QueryTurn } from "@/types/project";

interface ChatWsUpdate {
  event: "chat-update" | "completed" | "failed" | "error";
  data: unknown;
}

function StepList({ steps }: { steps: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          {step.status === "hasReplied" ? (
            <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
          ) : (
            <Loader2 size={13} className="shrink-0 animate-spin text-indigo-500" />
          )}
          {step.actor}
        </div>
      ))}
    </div>
  );
}

export default function QueryChat({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<QueryTurn[]>([]);
  const [asking, setAsking] = useState(false);
  const [openCitations, setOpenCitations] = useState<Set<number>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);

  function toggleCitations(index: number) {
    setOpenCitations((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function updateLastTurn(patch: Partial<QueryTurn>) {
    setTurns((prev) => prev.map((turn, i) => (i === prev.length - 1 ? { ...turn, ...patch } : turn)));
  }

  function applyAnswerStep(steps: ChatMessage[]): Partial<QueryTurn> {
    const answerStep = steps.find((s) => s.step === "answer" && s.status === "hasReplied");
    if (!answerStep) return {};
    const { answer, citations } = answerStep.response as AnswerStepResponse;
    return { answer, citations };
  }

  async function finalizeFromServer(chatId: string) {
    try {
      const chat = await getChat(chatId);
      updateLastTurn({
        status: chat.status,
        steps: chat.contents,
        error: chat.status === "failed" ? (chat.failureReason ?? "The chat failed.") : undefined,
        ...applyAnswerStep(chat.contents),
      });
    } catch (e) {
      updateLastTurn({ status: "failed", error: String(e) });
    } finally {
      setAsking(false);
    }
  }

  function watchChat(chatId: string) {
    const ws = new WebSocket(chatWsUrl(chatId));
    wsRef.current = ws;
    ws.onmessage = (msgEvent) => {
      try {
        const update: ChatWsUpdate = JSON.parse(msgEvent.data);
        if (update.event === "chat-update") {
          const cache = update.data as { messages: ChatMessage[] };
          updateLastTurn({ steps: cache.messages, ...applyAnswerStep(cache.messages) });
        } else if (update.event === "completed" || update.event === "failed") {
          void finalizeFromServer(chatId);
        } else if (update.event === "error") {
          updateLastTurn({ status: "failed", error: String(update.data) });
          setAsking(false);
        }
      } catch {
        // ignore malformed frames
      }
    };
    ws.onerror = () => {
      updateLastTurn({ status: "failed", error: "WebSocket connection failed." });
      setAsking(false);
    };
  }

  // Chat turns only ever lived in component state, so a page refresh looked
  // like the reply had never been saved — it was, this just reloads it.
  // Resumes watching the last turn too, in case it was still running.
  useEffect(() => {
    let cancelled = false;
    listChats(projectId)
      .then((chats) => {
        if (cancelled) return;
        const loaded: QueryTurn[] = chats.map((c) => ({
          chatId: c.id,
          question: c.question,
          steps: c.contents,
          status: c.status,
          error: c.status === "failed" ? (c.failureReason ?? "The chat failed.") : undefined,
          ...applyAnswerStep(c.contents),
        }));
        setTurns(loaded);

        const last = loaded[loaded.length - 1];
        if (last?.status === "running" && last.chatId) {
          setAsking(true);
          watchChat(last.chatId);
        }
      })
      .catch(() => {
        // History is a nice-to-have; a failed load just starts with an empty thread.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    setAsking(true);
    setQuestion("");
    setTurns((prev) => [...prev, { question: trimmed, steps: [], status: "running" }]);

    try {
      const { id: chatId } = await createChat(projectId, trimmed);
      updateLastTurn({ chatId });
      watchChat(chatId);
    } catch (e) {
      updateLastTurn({ status: "failed", error: String(e) });
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-end justify-start gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                <User size={14} />
              </span>
              <div className="max-w-[75%] rounded-2xl rounded-tl-md bg-indigo-600 px-4 py-2.5 text-sm text-white shadow-sm">
                {turn.question}
              </div>
            </div>
            <div className="flex items-end justify-end gap-2">
              <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-zinc-200/70 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                {turn.error ? (
                  <p className="text-red-600 dark:text-red-400">{turn.error}</p>
                ) : turn.answer == null ? (
                  turn.steps.length === 0 ? (
                    <div className="flex items-center gap-1 py-0.5 text-zinc-400 dark:text-zinc-500">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60 [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60" />
                    </div>
                  ) : (
                    <StepList steps={turn.steps} />
                  )
                ) : (
                  <>
                    <p className="whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">
                      {turn.answer}
                    </p>
                    {turn.citations && turn.citations.length > 0 && (
                      <div className="mt-3 overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-500/30">
                        <button
                          onClick={() => toggleCitations(i)}
                          className="flex w-full items-center gap-1.5 bg-indigo-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                        >
                          {openCitations.has(i) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <FileCode2 size={13} />
                          Sources
                          <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-indigo-500">
                            {turn.citations.length}
                          </span>
                        </button>
                        {openCitations.has(i) && (
                          <div className="flex flex-col gap-1 px-2.5 pb-2.5">
                            {turn.citations.map((c, j) => (
                              <div
                                key={j}
                                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs dark:border-zinc-700"
                              >
                                <FileCode2 size={12} className="shrink-0 text-zinc-400 dark:text-zinc-500" />
                                <span
                                  className="truncate font-mono text-zinc-800 dark:text-zinc-200"
                                  title={c.file}
                                >
                                  {c.file}
                                </span>
                                {c.symbol && (
                                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    {c.symbol}
                                  </span>
                                )}
                                {c.line != null && (
                                  <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                                    L{c.line}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200/70 bg-white text-indigo-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-indigo-400">
                <Bot size={14} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
        <SearchCode size={16} className="ml-1 shrink-0 text-zinc-400" />
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          placeholder="Ask a question about this codebase…"
          className="flex-1 bg-transparent px-1 py-1.5 text-sm text-zinc-800 outline-none dark:text-zinc-200"
        />
        <button
          onClick={handleAsk}
          disabled={!question.trim() || asking}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
