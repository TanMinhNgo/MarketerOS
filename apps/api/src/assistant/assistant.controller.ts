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
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
import {
  ApiErrorSchema,
  AssistantMessageInputSchema,
  AssistantMessageSchema,
  AssistantMessagesQuerySchema,
  AssistantMessagesResponseSchema,
  UpdateAssistantActionSchema,
  type AssistantMessageInput,
  type AssistantMessagesQuery,
  type UpdateAssistantActionInput,
} from '@marketos/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { SchemaPipe } from '../common/schema.pipe';
import { apiSchema } from '../common/api-schema';
import { OwnershipGuard } from '../projects/ownership.guard';
import { AssistantGuard } from './assistant.guard';
import { AssistantService } from './assistant.service';

@ApiTags('assistant')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiForbiddenResponse({
  schema: apiSchema(ApiErrorSchema),
  description:
    'PLAN_REQUIRED; details { feature: ai_assistant }. Verified Pro user entitlement required.',
})
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiConflictResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(AssistantGuard, OwnershipGuard)
@Controller('projects/:projectId/assistant/messages')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}
  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'before',
    required: false,
    type: String,
    description: 'Exclusive message ID cursor from this project; newest first.',
  })
  @ApiOkResponse({ schema: apiSchema(AssistantMessagesResponseSchema) })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query(new SchemaPipe(AssistantMessagesQuerySchema))
    query: AssistantMessagesQuery,
  ) {
    return this.assistant.list(projectId, user.id, query);
  }
  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({
    description:
      'Clears only this project history/actions; cancels pending replies, never refunds quota.',
  })
  async clear(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
  ) {
    await this.assistant.clear(projectId, user.id);
  }
  @Patch(':messageId/actions/:actionId')
  @ApiBody({ schema: apiSchema(UpdateAssistantActionSchema, 'input') })
  @ApiOkResponse({
    schema: apiSchema(AssistantMessageSchema),
    description:
      'Updated message. Records proposed→applied/dismissed only; does NOT execute the action.',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Param('actionId') actionId: string,
    @Body(new SchemaPipe(UpdateAssistantActionSchema))
    body: UpdateAssistantActionInput,
  ) {
    return this.assistant.updateAction(
      projectId,
      user.id,
      messageId,
      actionId,
      body.status,
    );
  }
  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'New UUID, unique per user across all generation endpoints.',
  })
  @ApiBody({ schema: apiSchema(AssistantMessageInputSchema, 'input') })
  @ApiTooManyRequestsResponse({
    schema: apiSchema(ApiErrorSchema),
    description:
      'QUOTA_EXCEEDED; { limit: 300, used, resetAt }, monthly UTC; separate from TEXT.',
  })
  @ApiOkResponse({
    description:
      'SSE message.delta {text} (append-only chunks), done {userMessage, assistantMessage} or error (ApiError). Actions proposed only, never executed.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  async send(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new SchemaPipe(AssistantMessageInputSchema))
    body: AssistantMessageInput,
    @Res() response: Response,
  ) {
    const requestId = z.uuid().safeParse(key);
    if (!requestId.success)
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Idempotency-Key phải là UUID.',
        details: null,
      });
    const abort = new AbortController();
    response.on('close', () => abort.abort());
    const prepared = await this.assistant.prepare(
      projectId,
      user.id,
      requestId.data,
      body.content,
    );
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    try {
      for await (const item of this.assistant.stream(prepared, abort.signal)) {
        if (abort.signal.aborted || response.writableEnded) break;
        response.write(
          `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`,
        );
      }
    } catch {
      if (!abort.signal.aborted && !response.writableEnded)
        response.write(
          'event: error\ndata: {"code":"SERVICE_UNAVAILABLE","message":"Assistant không khả dụng.","details":null}\n\n',
        );
    } finally {
      if (!response.writableEnded) response.end();
    }
  }
}
