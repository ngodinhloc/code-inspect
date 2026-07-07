import { Module } from '@nestjs/common';
import { CheckoutService } from './services/checkout.service';

@Module({
  providers: [CheckoutService],
})
export class CheckoutModule {}
