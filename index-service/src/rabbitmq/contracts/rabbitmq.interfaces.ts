export type MessageHandler = (
  payload: Record<string, unknown>,
  routingKey: string,
) => Promise<void>;

export interface Binding {
  exchange: string;
  routingKey: string;
}

export interface Subscription {
  queue: string;
  bindings: Binding[];
  handler: MessageHandler;
}
