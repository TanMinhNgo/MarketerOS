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
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { apiSchema } from '../common/api-schema';
import {
  CreateProjectSchema,
  ApiErrorSchema,
  UpdateProjectSchema,
  ProjectResponseSchema,
  ProjectListResponseSchema,
  ProjectListQuerySchema,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ProjectListQuery,
} from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { SchemaPipe } from '../common/schema.pipe';
import { OwnershipGuard } from './ownership.guard';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(OwnershipGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ schema: apiSchema(ProjectListResponseSchema) })
  list(
    @CurrentUser() user: AuthUser,
    @Query(new SchemaPipe(ProjectListQuerySchema)) query: ProjectListQuery,
  ) {
    return this.projects.list(user.id, query);
  }
  @Get('trash')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({ schema: apiSchema(ProjectListResponseSchema) })
  trashList(
    @CurrentUser() user: AuthUser,
    @Query(new SchemaPipe(ProjectListQuerySchema)) query: ProjectListQuery,
  ) {
    return this.projects.list(user.id, query, true);
  }
  @Post()
  @ApiBody({ schema: apiSchema(CreateProjectSchema, 'input') })
  @ApiCreatedResponse({ schema: apiSchema(ProjectResponseSchema) })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new SchemaPipe(CreateProjectSchema)) data: CreateProjectInput,
  ) {
    return this.projects.create(user.id, data);
  }
  @Get(':projectId')
  @ApiOkResponse({ schema: apiSchema(ProjectResponseSchema) })
  get(@CurrentUser() user: AuthUser, @Param('projectId') id: string) {
    return this.projects.get(id, user.id);
  }
  @Patch(':projectId')
  @ApiBody({ schema: apiSchema(UpdateProjectSchema, 'input') })
  @ApiOkResponse({ schema: apiSchema(ProjectResponseSchema) })
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId') id: string,
    @Body(new SchemaPipe(UpdateProjectSchema)) data: UpdateProjectInput,
  ) {
    return this.projects.update(id, user.id, data);
  }
  @Delete(':projectId')
  @ApiOkResponse({ schema: apiSchema(ProjectResponseSchema) })
  remove(@CurrentUser() user: AuthUser, @Param('projectId') id: string) {
    return this.projects.trash(id, user.id);
  }
  @Post(':projectId/restore')
  @ApiCreatedResponse({ schema: apiSchema(ProjectResponseSchema) })
  restore(@CurrentUser() user: AuthUser, @Param('projectId') id: string) {
    return this.projects.restore(id, user.id);
  }
}
