import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  ApiErrorSchema,
  ConnectionSchema,
  ConnectionsResponseSchema,
  FacebookPagesResponseSchema,
  OAuthStartResponseSchema,
  PublicationSchema,
  PublicationsQuerySchema,
  PublicationsResponseSchema,
  SelectFacebookPageSchema,
  IntegrationProviderSchema,
  IntegrationProvidersResponseSchema,
  type PublicationsQuery,
  type SelectFacebookPageInput,
  PublishInputSchema,
  type PublishInput,
} from '@marketos/shared';
import { CurrentUser, Public, type AuthUser } from '../auth/auth.decorators';
import { SchemaPipe } from '../common/schema.pipe';
import { apiSchema } from '../common/api-schema';
import { IntegrationsGuard } from './integrations.guard';
import { IntegrationsService } from './integrations.service';
import type { Provider } from './provider.gateway';

const provider = (value: string): Provider => {
  if (value === 'smtp' || !IntegrationProviderSchema.safeParse(value).success)
    throw new BadRequestException({
      code: 'VALIDATION',
      message: 'Unsupported provider.',
    });
  return value as Provider;
};

@ApiTags('integrations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiForbiddenResponse({
  schema: apiSchema(ApiErrorSchema),
  description: "PLAN_REQUIRED { feature: 'channel_publishing' }",
})
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiConflictResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(IntegrationsGuard)
@Controller('projects/:projectId/connections')
export class ConnectionsController {
  constructor(private readonly service: IntegrationsService) {}
  @Get()
  @ApiOkResponse({ schema: apiSchema(ConnectionsResponseSchema) })
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.service.list(projectId, user.id);
  }
  @Get('providers')
  @ApiOkResponse({ schema: apiSchema(IntegrationProvidersResponseSchema) })
  catalog(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    return this.service.catalog(projectId, user.id);
  }
  @Get('instagram/accounts')
  @ApiQuery({ name: 'session', required: true })
  @ApiOkResponse({ schema: apiSchema(FacebookPagesResponseSchema) })
  instagramAccounts(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('session') session: string,
  ) {
    return this.service.pages(projectId, user.id, session, 'instagram');
  }
  @Post('instagram/accounts')
  @ApiBody({ schema: apiSchema(SelectFacebookPageSchema, 'input') })
  @ApiCreatedResponse({ schema: apiSchema(ConnectionSchema) })
  selectInstagram(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new SchemaPipe(SelectFacebookPageSchema))
    input: SelectFacebookPageInput,
  ) {
    return this.service.selectPage(
      projectId,
      user.id,
      input.session,
      input.pageId,
      'instagram',
    );
  }
  @Post(':provider/start')
  @ApiCreatedResponse({ schema: apiSchema(OAuthStartResponseSchema) })
  start(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('provider') raw: string,
  ) {
    return this.service.start(projectId, user, provider(raw));
  }
  @Post('smtp')
  @ApiCreatedResponse({ schema: apiSchema(ConnectionSchema) })
  connectSmtp(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new SchemaPipe(z.object({}).strict().default({})))
    _input: Record<string, never>,
  ) {
    void _input;
    return this.service.connectSmtp(projectId, user.id);
  }
  @Get('facebook/pages')
  @ApiQuery({ name: 'session', required: true })
  @ApiOkResponse({ schema: apiSchema(FacebookPagesResponseSchema) })
  pages(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query('session') session: string,
  ) {
    return this.service.pages(projectId, user.id, session);
  }
  @Post('facebook/pages')
  @ApiBody({ schema: apiSchema(SelectFacebookPageSchema, 'input') })
  @ApiCreatedResponse({ schema: apiSchema(ConnectionSchema) })
  selectPage(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new SchemaPipe(SelectFacebookPageSchema))
    input: SelectFacebookPageInput,
  ) {
    return this.service.selectPage(
      projectId,
      user.id,
      input.session,
      input.pageId,
    );
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  disconnect(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.service.disconnect(projectId, user.id, id);
  }
}

@ApiTags('oauth')
@Controller('oauth')
export class IntegrationOAuthController {
  constructor(private readonly service: IntegrationsService) {}
  @Public()
  @Get(':provider/callback')
  @Redirect('', 302)
  @ApiQuery({ name: 'state', required: true })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'error', required: false })
  @ApiResponse({
    status: 302,
    description: '302 redirect to WEB_URL/apps/integrations?result=...',
  })
  async callback(
    @Param('provider') raw: string,
    @Query('state') state: string,
    @Query('code') code?: string,
  ) {
    const url = await this.service.callback(provider(raw), state ?? '', code);
    return { url, statusCode: 302 };
  }
}

@ApiTags('publications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiForbiddenResponse({
  schema: apiSchema(ApiErrorSchema),
  description: "PLAN_REQUIRED { feature: 'channel_publishing' }",
})
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiConflictResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(IntegrationsGuard)
@Controller('projects/:projectId/contents/:contentId/publish')
export class PublishController {
  constructor(private readonly service: IntegrationsService) {}
  @Post()
  @HttpCode(202)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiAcceptedResponse({ schema: apiSchema(PublicationSchema) })
  @ApiBody({ required: false, schema: apiSchema(PublishInputSchema, 'input') })
  publish(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('contentId') contentId: string,
    @Headers('idempotency-key') key: string,
    @Body(new SchemaPipe(PublishInputSchema)) input: PublishInput,
  ) {
    if (!z.uuid().safeParse(key).success)
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Idempotency-Key must be UUID.',
      });
    return this.service.publish(
      projectId,
      user.id,
      contentId,
      key,
      undefined,
      input,
    );
  }
}

@ApiTags('publications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiForbiddenResponse({
  schema: apiSchema(ApiErrorSchema),
  description: "PLAN_REQUIRED { feature: 'channel_publishing' }",
})
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(IntegrationsGuard)
@Controller('projects/:projectId/publications')
export class PublicationsController {
  constructor(private readonly service: IntegrationsService) {}
  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false })
  @ApiQuery({ name: 'contentId', required: false })
  @ApiOkResponse({ schema: apiSchema(PublicationsResponseSchema) })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query(new SchemaPipe(PublicationsQuerySchema)) query: PublicationsQuery,
  ) {
    return this.service.publications(projectId, user.id, query);
  }
}
