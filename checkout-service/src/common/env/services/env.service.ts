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

  getRepositoriesDir(): string {
    return (
      this.configService.get<string>('REPOSITORIES_DIR') ?? '/repositories'
    );
  }
}
