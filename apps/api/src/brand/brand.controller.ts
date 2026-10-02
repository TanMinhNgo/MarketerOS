import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { apiSchema } from '../common/api-schema';
import {
  BrandBriefResponseSchema,
  ApiErrorSchema,
  UpsertBrandBriefSchema,
  type UpsertBrandBriefInput,
} from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { SchemaPipe } from '../common/schema.pipe';
import { OwnershipGuard } from '../projects/ownership.guard';
import { BrandService } from './brand.service';

@ApiTags('brand')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(OwnershipGuard)
@Controller('projects/:projectId/brand-brief')
export class BrandController {
  constructor(private readonly brand: BrandService) {}
  @Get()
  @ApiOkResponse({ schema: apiSchema(BrandBriefResponseSchema) })
  get(@CurrentUser() user: AuthUser, @Param('projectId') id: string) {
    return this.brand.get(id, user.id);
  }
  @Put()
  @ApiBody({ schema: apiSchema(UpsertBrandBriefSchema, 'input') })
  @ApiOkResponse({ schema: apiSchema(BrandBriefResponseSchema) })
  put(
    @CurrentUser() user: AuthUser,
    @Param('projectId') id: string,
    @Body(new SchemaPipe(UpsertBrandBriefSchema)) data: UpsertBrandBriefInput,
  ) {
    return this.brand.upsert(id, user.id, data);
  }
}
