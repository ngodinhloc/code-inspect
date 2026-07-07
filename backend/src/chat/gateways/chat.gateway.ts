import { WebSocketGateway, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/services/redis.service';
import { Chat } from '../../database/entities/chat.entity';
import { ChatCache } from '../contracts/chat.interface';

const POLL_INTERVAL_MS = 500;
const MAX_POLLS = 1200; // 10 min timeout
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// @nestjs/platform-ws routes upgrades by an exact literal pathname match against
// this path, so the chat uuid must travel as a query param rather than a path
// segment — same constraint the sibling project's ExperimentGateway works around.
@Injectable()
@WebSocketGateway({ path: '/ws/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly subscriptions = new Map<WebSocket, NodeJS.Timeout>();

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(Chat) private readonly chatRepo: Repository<Chat>,
  ) {}

  async handleConnection(client: WebSocket, req: IncomingMessage): Promise<void> {
    const uuid = new URL(req.url ?? '', 'http://localhost').searchParams.get('uuid') ?? '';
    if (!UUID_RE.test(uuid)) {
      client.close(1008, 'Expected ?uuid={uuid}');
      return;
    }

    const chat = await this.chatRepo.findOne({ where: { uuid } });
    if (!chat) {
      client.send(JSON.stringify({ event: 'error', data: `Chat ${uuid} not found` }));
      client.close(1008, 'Chat not found');
      return;
    }
    // Completed/failed chats are served from Postgres via GET — never poll
    // Redis for a chat that's already terminal.
    if (chat.status === 'completed') {
      client.send(JSON.stringify({ event: 'completed', data: { uuid } }));
      client.close(1000, 'Chat already completed');
      return;
    }
    if (chat.status === 'failed') {
      client.send(JSON.stringify({ event: 'failed', data: { uuid } }));
      client.close(1000, 'Chat failed');
      return;
    }

    this.startPolling(client, uuid);
  }

  private startPolling(client: WebSocket, uuid: string): void {
    let polls = 0;
    let lastPayload = '';

    const intervalId = setInterval(async () => {
      if (++polls > MAX_POLLS) {
        this.clearSubscription(client);
        client.send(JSON.stringify({ event: 'error', data: 'Timed out waiting for an answer.' }));
        client.close(1000, 'Timeout');
        return;
      }

      try {
        const cache = await this.redisService.getJson<ChatCache>(`chat:${uuid}`);
        if (!cache) return;

        const payload = JSON.stringify({ event: 'chat-update', data: cache });
        if (payload !== lastPayload) {
          lastPayload = payload;
          client.send(payload);
        }

        if (cache.status === 'completed') {
          this.clearSubscription(client);
          client.send(JSON.stringify({ event: 'completed', data: { uuid } }));
          client.close(1000, 'Chat completed');
        } else if (cache.status === 'failed') {
          this.clearSubscription(client);
          client.send(JSON.stringify({ event: 'failed', data: { uuid } }));
          client.close(1000, 'Chat failed');
        }
      } catch {
        // Redis transient error — keep polling
      }
    }, POLL_INTERVAL_MS);

    this.subscriptions.set(client, intervalId);
  }

  handleDisconnect(client: WebSocket): void {
    this.clearSubscription(client);
  }

  private clearSubscription(client: WebSocket): void {
    const existing = this.subscriptions.get(client);
    if (existing) {
      clearInterval(existing);
      this.subscriptions.delete(client);
    }
  }
}
