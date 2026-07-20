import { Inject, Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EventHandler } from '../contracts/event.interfaces';
import { EVENT_REGISTRY } from '../configs/event.config';

// Transport-agnostic dispatcher: event name -> registry lookup -> handler.handle().
// The consumer stamps `eventName` onto the payload before handing it off (it
// knows it from the routing key the message arrived on), so this stays a
// single-argument, payload-only dispatcher — a message that reaches here
// without one is a transport/wiring bug, not a malformed upstream event, so
// it throws rather than logging and dropping. Shared across both the
// project-lifecycle and chat-lifecycle events this service consumes.
@Injectable()
export class MessageProcessor {
  constructor(
    @Inject(EVENT_REGISTRY)
    private readonly eventRegistry: Record<string, EventHandler>,
    private readonly logger: AppLogger,
  ) {}

  async process(payload: Record<string, unknown>): Promise<void> {
    const eventName = payload.eventName as string | undefined;
    if (!eventName) {
      throw new Error('MessageProcessor.process: eventName missing in payload');
    }

    const handler = this.eventRegistry[eventName];
    if (!handler) {
      this.logger.warn('MessageProcessor.process: no handler for event', {
        eventName,
      });
      return;
    }

    await handler.handle(payload);
  }
}
