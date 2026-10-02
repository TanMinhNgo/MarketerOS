import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiErrorSchema,
  GenerateContentInputSchema,
  GenerateVariantInputSchema,
  type GenerateContentInput,
  type GenerateVariantInput,
} from '@marketos/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { apiSchema } from '../common/api-schema';
import { SchemaPipe } from '../common/schema.pipe';
import { OwnershipGuard } from '../projects/ownership.guard';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiConflictResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiTooManyRequestsResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(OwnershipGuard, ThrottlerGuard)
@Controller('projects/:projectId/generate')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID mới cho mỗi lần tạo',
  })
  @ApiBody({ schema: apiSchema(GenerateContentInputSchema, 'input') })
  @ApiOkResponse({
    description: 'SSE: variant.delta, variant.done, done hoặc error',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  async generate(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Headers('idempotency-key') requestId: string | undefined,
    @Body(new SchemaPipe(GenerateContentInputSchema))
    input: GenerateContentInput,
    @Res() response: Response,
  ) {
    return this.run(projectId, user, requestId, input, response);
  }

  @Post('variant')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID mới cho mỗi lần tạo',
  })
  @ApiBody({ schema: apiSchema(GenerateVariantInputSchema, 'input') })
  @ApiOkResponse({
    description:
      'SSE: variant.delta/variant.done với index đã gửi; done { generationId, variants: [variant] } (SingleVariantDoneSchema), hoặc error (ApiError). Một request tính 1 TEXT.',
    content: { 'text/event-stream': { schema: { type: 'string' } } },
  })
  generateVariant(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Headers('idempotency-key') requestId: string | undefined,
    @Body(new SchemaPipe(GenerateVariantInputSchema))
    body: GenerateVariantInput,
    @Res() response: Response,
  ) {
    return this.run(projectId, user, requestId, body.input, response, {
      others: body.others,
      index: body.index,
    });
  }

  private async run(
    projectId: string,
    user: AuthUser,
    requestId: string | undefined,
    input: GenerateContentInput,
    response: Response,
    single?: Pick<GenerateVariantInput, 'others' | 'index'>,
  ) {
    if (!z.uuid().safeParse(requestId).success)
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Idempotency-Key phải là UUID.',
        details: null,
      });
    const prepared = await this.ai.prepare(
      projectId,
      user,
      requestId!,
      input,
      single,
    );
    const abort = new AbortController();
    response.on('close', () => abort.abort());
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    try {
      for await (const item of this.ai.stream(prepared, abort.signal)) {
        if (abort.signal.aborted || response.writableEnded) break;
        response.write(
          `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`,
        );
      }
    } catch {
      if (!abort.signal.aborted && !response.writableEnded)
        response.write(
          'event: error\ndata: {"code":"SERVICE_UNAVAILABLE","message":"Không tạo được nội dung.","details":null}\n\n',
        );
    } finally {
      if (!response.writableEnded) response.end();
    }
  }
}
