import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppLogger } from '../../common/logger/services/app-logger';
import { EnvService } from '../../common/env/services/env.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  constructor(
    private readonly logger: AppLogger,
    private readonly envService: EnvService,
  ) {}

  onModuleInit() {
    this.client = new Redis(this.envService.getRedisUrl(), {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
    this.client.on('error', (err) =>
      this.logger.error('RedisService: Redis error', { error: String(err) }),
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
