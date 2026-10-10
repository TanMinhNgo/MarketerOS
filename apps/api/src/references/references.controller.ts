import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ReferenceInputSchema,
  ReferencesResponseSchema,
  type ReferenceInput,
} from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { requireFeature } from '../auth/require-feature';
import { apiSchema } from '../common/api-schema';
import { SchemaPipe } from '../common/schema.pipe';
import { OwnershipGuard } from '../projects/ownership.guard';
import { ReferencesService } from './references.service';

@ApiTags('references')
@ApiBearerAuth()
@UseGuards(OwnershipGuard)
@Controller('projects/:projectId/references')
export class ReferencesController {
  constructor(private readonly references: ReferencesService) {}
  @Get()
  @ApiOkResponse({ schema: apiSchema(ReferencesResponseSchema) })
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    requireFeature(user, 'personalization');
    return this.references.list(projectId, user.id);
  }
  @Post()
  @HttpCode(204)
  @ApiBody({ schema: apiSchema(ReferenceInputSchema, 'input') })
  @ApiNoContentResponse()
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new SchemaPipe(ReferenceInputSchema)) input: ReferenceInput,
  ) {
    requireFeature(user, 'personalization');
    return this.references.write(projectId, user.id, input);
  }
  @Put(':id')
  @HttpCode(204)
  @ApiBody({ schema: apiSchema(ReferenceInputSchema, 'input') })
  @ApiNoContentResponse()
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new SchemaPipe(ReferenceInputSchema)) input: ReferenceInput,
  ) {
    requireFeature(user, 'personalization');
    return this.references.write(projectId, user.id, input, id);
  }
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    requireFeature(user, 'personalization');
    return this.references.write(projectId, user.id, undefined, id);
  }
}
