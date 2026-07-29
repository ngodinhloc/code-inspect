import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnvService {
  constructor(private readonly configService: ConfigService) {}

  getRabbitMqUrl(): string {
    return (
      this.configService.get<string>('RABBITMQ_URL') ??
      'amqp://guest:guest@localhost:5672/'
    );
  }

  getDatabaseUrl(): string {
    return (
      this.configService.get<string>('DATABASE_URL') ??
      'postgresql://localhost:5432/codeinspect'
    );
  }

  getDatabaseSchema(): string {
    return this.configService.get<string>('DATABASE_SCHEMA') ?? 'backend';
  }

  getRedisUrl(): string {
    return (
      this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379'
    );
  }
}
