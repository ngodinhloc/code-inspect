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

  getEmbeddingServiceUrl(): string {
    return (
      this.configService.get<string>('EMBEDDING_SERVICE_URL') ??
      'http://localhost:8000'
    );
  }
}
