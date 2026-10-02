import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { ClerkGateway } from './clerk.gateway';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClerkWebhookController } from './clerk-webhook.controller';

@Module({
  // ponytail: per-process IP limit; shared storage when running multiple API replicas.
  imports: [UsersModule, ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])],
  controllers: [ClerkWebhookController],
  providers: [
    ClerkGateway,
    ClerkAuthGuard,
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ClerkAuthGuard },
  ],
  exports: [ClerkGateway],
})
export class AuthModule {}
