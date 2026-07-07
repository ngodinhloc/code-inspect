import { Module } from '@nestjs/common';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { CheckoutModule } from './checkout/checkout.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [RabbitMQModule, CheckoutModule, HealthModule],
})
export class AppModule {}
