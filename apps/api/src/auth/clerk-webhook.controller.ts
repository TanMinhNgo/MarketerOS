import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { Webhook } from 'svix';
import { z } from 'zod';
import {
  ApiErrorSchema,
  WebhookAcknowledgementSchema,
  type WebhookAcknowledgement,
} from '@marketos/shared';
import { apiSchema } from '../common/api-schema';
import { UsersRepository } from '../users/users.repository';
import { Public } from './auth.decorators';

const eventSchema = z.object({ type: z.string().min(1), data: z.unknown() });
const deletedUserSchema = z.object({ id: z.string().min(1).max(256) });

@ApiTags('webhooks')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersRepository,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiConsumes('application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'data'],
      properties: {
        type: { type: 'string' },
        data: { type: 'object', additionalProperties: true },
      },
    },
  })
  @ApiHeader({ name: 'svix-id', required: true })
  @ApiHeader({ name: 'svix-timestamp', required: true })
  @ApiHeader({ name: 'svix-signature', required: true })
  @ApiOkResponse({ schema: apiSchema(WebhookAcknowledgementSchema) })
  @ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
  @ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
  @ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
  @ApiTooManyRequestsResponse({ schema: apiSchema(ApiErrorSchema) })
  async receive(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<WebhookAcknowledgement> {
    const secret = this.config.get<string>('CLERK_WEBHOOK_SECRET');
    if (!secret) throw new ServiceUnavailableException();
    const id = request.headers['svix-id'];
    const timestamp = request.headers['svix-timestamp'];
    const signature = request.headers['svix-signature'];
    if (
      !request.rawBody ||
      typeof id !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof signature !== 'string'
    )
      throw new BadRequestException();
    let payload: unknown;
    try {
      new Webhook(secret).verify(request.rawBody.toString('utf8'), {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': signature,
      });
      payload = JSON.parse(request.rawBody.toString('utf8')) as unknown;
    } catch {
      throw new UnauthorizedException();
    }
    const event = eventSchema.safeParse(payload);
    if (!event.success) throw new BadRequestException();
    if (event.data.type === 'user.deleted') {
      const user = deletedUserSchema.safeParse(event.data.data);
      if (!user.success) throw new BadRequestException();
      await this.users.delete(user.data.id);
    }
    // deleteMany is idempotent: retries and already-absent users need no event table.
    return { received: true };
  }
}
