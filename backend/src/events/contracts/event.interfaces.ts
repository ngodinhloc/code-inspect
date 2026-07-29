// DI contract every event handler implements. Kept separate from
// project.interface.ts (the event *shapes*) so the dispatch abstraction can be
// reused if this module ever consumes events from more than one contract file.
export interface EventHandler {
  handle(payload: Record<string, unknown>): Promise<void>;
}

// Single durable queue backing every subscription this service makes, across
// both the project and chat exchanges — one queue, many routing-key bindings,
// rather than a queue per event.
export const QUEUE_BACKEND = 'code-inspect.backend.queue';
