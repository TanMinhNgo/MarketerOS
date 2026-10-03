import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
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
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import {
  ApiErrorSchema,
  AutomationSchema,
  AutomationRunSchema,
  AutomationsResponseSchema,
  AutomationRunsResponseSchema,
  AutomationRunsQuerySchema,
  CreateAutomationSchema,
  UpdateAutomationSchema,
  type AutomationRunsQuery,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { SchemaPipe } from '../common/schema.pipe';
import { apiSchema } from '../common/api-schema';
import { AutomationGuard } from './automation.guard';
import { AutomationRepository } from './automation.repository';

@ApiTags('automations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiForbiddenResponse({
  schema: apiSchema(ApiErrorSchema),
  description:
    "PLAN_REQUIRED { feature: 'automation' }; verified Max user entitlement required.",
})
@ApiNotFoundResponse({
  schema: apiSchema(ApiErrorSchema),
  description: 'Ownership, Trash, automation or cursor unavailable.',
})
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiConflictResponse({
  schema: apiSchema(ApiErrorSchema),
  description:
    'PLAN_LIMIT for enabling automation 11; CONFLICT for duplicate idempotency or paused Run now.',
})
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(AutomationGuard)
@Controller('projects/:projectId/automations')
export class AutomationController {
  constructor(private readonly automations: AutomationRepository) {}
  @Get()
  @ApiOkResponse({ schema: apiSchema(AutomationsResponseSchema) })
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.automations.list(projectId, user.id);
  }
  @Post()
  @ApiBody({ schema: apiSchema(CreateAutomationSchema, 'input') })
  @ApiCreatedResponse({ schema: apiSchema(AutomationSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new SchemaPipe(CreateAutomationSchema)) input: CreateAutomationInput,
  ) {
    return this.automations.create(projectId, user.id, input);
  }
  @Patch(':id')
  @ApiBody({
    schema: apiSchema(UpdateAutomationSchema, 'input'),
    description:
      'Partial config; type immutable. schedule is replaced in full.',
  })
  @ApiOkResponse({ schema: apiSchema(AutomationSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new SchemaPipe(UpdateAutomationSchema)) input: UpdateAutomationInput,
  ) {
    return this.automations.update(projectId, user.id, id, input);
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({
    description:
      'Cancels queued runs, cascades run history; preserves created content, messages and quota ledger.',
  })
  async delete(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.automations.delete(projectId, user.id, id);
  }
  @Post(':id/run')
  @HttpCode(202)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    schema: { type: 'string', format: 'uuid' },
  })
  @ApiAcceptedResponse({
    schema: apiSchema(AutomationRunSchema),
    description:
      'Durably queued in PostgreSQL; worker outbox dispatches to BullMQ.',
  })
  @ApiTooManyRequestsResponse({
    schema: apiSchema(ApiErrorSchema),
    description: 'QUOTA_EXCEEDED { limit, used, resetAt }',
  })
  run(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string,
  ) {
    if (!z.uuid().safeParse(key).success) throw new BadRequestException();
    return this.automations.reserve(projectId, user.id, id, key);
  }
  @Get(':id/runs')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description: 'Exclusive run ID from this automation; newest first.',
  })
  @ApiOkResponse({ schema: apiSchema(AutomationRunsResponseSchema) })
  runs(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query(new SchemaPipe(AutomationRunsQuerySchema))
    query: AutomationRunsQuery,
  ) {
    return this.automations.runs(projectId, user.id, id, query);
  }
}
