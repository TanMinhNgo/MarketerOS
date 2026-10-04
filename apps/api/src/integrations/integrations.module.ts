import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { AuthModule } from '../auth/auth.module';
import {
  ConnectionsController,
  IntegrationOAuthController,
  PublicationsController,
  PublishController,
} from './integrations.controller';
import { IntegrationCrypto } from './integration-crypto';
import { IntegrationsGuard } from './integrations.guard';
import { IntegrationsService } from './integrations.service';
import { ProviderGateway } from './provider.gateway';

@Module({
  imports: [ProjectsModule, AuthModule],
  controllers: [
    ConnectionsController,
    IntegrationOAuthController,
    PublishController,
    PublicationsController,
  ],
  providers: [
    IntegrationCrypto,
    IntegrationsGuard,
    IntegrationsService,
    ProviderGateway,
  ],
  exports: [IntegrationsService, ProviderGateway],
})
export class IntegrationsModule {}
