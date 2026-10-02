import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { MeResponseSchema, ApiErrorSchema } from '@marketos/shared';
import { apiSchema } from '../common/api-schema';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@Controller('me')
export class UsersController {
  @Get()
  @ApiOkResponse({ schema: apiSchema(MeResponseSchema) })
  me(@CurrentUser() user: AuthUser) {
    const { id, clerkId, email, name, isDemo, plan, createdAt } = user;
    return {
      id,
      clerkId,
      email,
      name,
      isDemo,
      plan,
      createdAt: createdAt.toISOString(),
    };
  }
}
