import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ApiErrorSchema, BillingUsageResponseSchema } from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { apiSchema } from '../common/api-schema';
import { BillingService } from './billing.service';

@ApiTags('billing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('usage')
  @ApiOkResponse({
    schema: apiSchema(BillingUsageResponseSchema),
    description:
      'Own verified plan/features, active projects and monthly UTC TEXT/IMAGE usage. Optional assistant and automation usage follow verified entitlements. No storage limit.',
  })
  usage(@CurrentUser() user: AuthUser) {
    return this.billing.usage(user);
  }
}
