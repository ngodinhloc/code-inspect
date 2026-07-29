import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';
import {
  Binding,
  MessageHandler,
  Subscription,
} from '../contracts/rabbitmq.interfaces';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private pendingSubscriptions: Subscription[] = [];

  constructor(
    private readonly logger: AppLogger,
    private readonly envService: EnvService,
  ) {}

  async onModuleInit() {
    await this.connect(this.envService.getRabbitMqUrl());
    for (const sub of this.pendingSubscriptions) {
      await this.bindSubscription(sub);
    }
    this.pendingSubscriptions = [];
  }

  private async connect(url: string, attempt = 1): Promise<void> {
    const maxAttempts = 10;
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      this.logger.log('RabbitMQService.connect: Connected to RabbitMQ');
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const delay = Math.min(1000 * attempt, 10000);
      this.logger.warn(
        `RabbitMQService.connect: RabbitMQ not ready, retrying in ${delay}ms…`,
        {
          attempt,
          maxAttempts,
        },
      );
      await new Promise((r) => setTimeout(r, delay));
      return this.connect(url, attempt + 1);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  // this.channel is guaranteed set by the time this runs: publish() is only
  // ever called from request handlers, which can't execute until
  // NestFactory.create() (and therefore this service's onModuleInit/connect)
  // has resolved — see main.ts, where app.listen() only happens after.
  async publish(
    exchange: string,
    routingKey: string,
    payload: unknown,
  ): Promise<void> {
    await this.channel!.assertExchange(exchange, 'topic', { durable: true });
    this.channel!.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
    this.logger.log('RabbitMQService.publish: Published', {
      exchange,
      routingKey,
    });
  }

  // Register a consumer for one queue bound to one or more (exchange, routingKey)
  // bindings; if the connection is not up yet the binding is deferred to onModuleInit.
  async subscribe(
    queue: string,
    bindings: Binding[],
    handler: MessageHandler,
  ): Promise<void> {
    const sub: Subscription = { queue, bindings, handler };
    if (!this.channel) {
      this.pendingSubscriptions.push(sub);
      return;
    }
    await this.bindSubscription(sub);
  }

  // Only called once this.channel is set — either directly from subscribe()
  // (which only reaches here past its own channel check) or from the
  // pendingSubscriptions drain in onModuleInit, which runs after connect()
  // resolves.
  private async bindSubscription({
    queue,
    bindings,
    handler,
  }: Subscription): Promise<void> {
    const exchanges = new Set(bindings.map((b) => b.exchange));
    for (const exchange of exchanges) {
      await this.channel!.assertExchange(exchange, 'topic', {
        durable: true,
      });
    }
    await this.channel!.assertQueue(queue, { durable: true });
    for (const { exchange, routingKey } of bindings) {
      await this.channel!.bindQueue(queue, exchange, routingKey);
    }
    await this.channel!.consume(queue, (msg) => {
      if (!msg) return;
      const routingKey = msg.fields.routingKey;
      void (async () => {
        try {
          const payload = JSON.parse(msg.content.toString()) as Record<
            string,
            unknown
          >;
          this.logger.log('RabbitMQService.consume: received', {
            queue,
            routingKey,
            payload,
          });
          await handler(payload, routingKey);
          this.channel!.ack(msg);
        } catch (err) {
          this.logger.error('RabbitMQService.consume: handler failed', {
            queue,
            routingKey,
            error: String(err),
          });
          this.channel!.nack(msg, false, false);
        }
      })();
    });
    this.logger.log('RabbitMQService.subscribe: Consuming', {
      queue,
      bindings,
    });
  }
}
