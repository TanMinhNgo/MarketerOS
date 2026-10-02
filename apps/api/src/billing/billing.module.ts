import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRepository } from './billing.repository';
import { QuotaService } from '../ai/quota.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingRepository, QuotaService],
})
export class BillingModule {}
