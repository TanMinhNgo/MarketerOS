import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiErrorSchema,
  ContentListQuerySchema,
  ContentListResponseSchema,
  ContentResponseSchema,
  CreateContentSchema,
  UpdateContentSchema,
  type ContentListQuery,
  type CreateContentInput,
  type UpdateContentInput,
} from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { apiSchema } from '../common/api-schema';
import { SchemaPipe } from '../common/schema.pipe';
import { OwnershipGuard } from '../projects/ownership.guard';
import { ContentService } from './content.service';

@ApiTags('content')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(OwnershipGuard)
@Controller('projects/:projectId/contents')
export class ContentController {
  constructor(private readonly contents: ContentService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['DRAFT', 'READY', 'SCHEDULED', 'DONE'],
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    format: 'date-time',
    description: 'Inclusive start; requires to; max 62 days.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    format: 'date-time',
    description: 'Exclusive end; requires from; max 62 days.',
  })
  @ApiQuery({
    name: 'unscheduled',
    required: false,
    enum: ['true', 'false'],
    description:
      'true filters scheduledAt IS NULL; cannot combine with from/to.',
  })
  @ApiOkResponse({ schema: apiSchema(ContentListResponseSchema) })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query(new SchemaPipe(ContentListQuerySchema)) query: ContentListQuery,
  ) {
    return this.contents.list(projectId, user.id, query);
  }

  @Post()
  @ApiBody({ schema: apiSchema(CreateContentSchema, 'input') })
  @ApiCreatedResponse({ schema: apiSchema(ContentResponseSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Body(new SchemaPipe(CreateContentSchema)) data: CreateContentInput,
  ) {
    return this.contents.create(projectId, user.id, data);
  }

  @Get(':contentId')
  @ApiOkResponse({ schema: apiSchema(ContentResponseSchema) })
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('contentId') id: string,
  ) {
    return this.contents.get(projectId, user.id, id);
  }

  @Patch(':contentId')
  @ApiBody({ schema: apiSchema(UpdateContentSchema, 'input') })
  @ApiOkResponse({ schema: apiSchema(ContentResponseSchema) })
  @ApiConflictResponse({
    schema: apiSchema(ApiErrorSchema),
    description:
      'Invalid status transition or edit of DONE content; details includes current and requested status.',
  })
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('contentId') id: string,
    @Body(new SchemaPipe(UpdateContentSchema)) data: UpdateContentInput,
  ) {
    return this.contents.update(projectId, user.id, id, data);
  }

  @Delete(':contentId')
  @ApiOkResponse({ schema: apiSchema(ContentResponseSchema) })
  delete(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('contentId') id: string,
  ) {
    return this.contents.delete(projectId, user.id, id);
  }
}
