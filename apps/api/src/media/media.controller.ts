import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import {
  ApiErrorSchema,
  AssetListQuerySchema,
  AssetListResponseSchema,
  AssetSchema,
  AssetUrlResponseSchema,
  ContentAssetsResponseSchema,
  GenerateImageInputSchema,
  ReplaceContentAssetsSchema,
  type AssetListQuery,
  type GenerateImageInput,
  type ReplaceContentAssetsInput,
} from '@marketos/shared';
import { z } from 'zod';
import type {} from 'multer';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { apiSchema } from '../common/api-schema';
import { SchemaPipe } from '../common/schema.pipe';
import { MediaGuard } from './media.guard';
import { MediaService } from './media.service';

@ApiTags('media')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiForbiddenResponse({
  schema: apiSchema(ApiErrorSchema),
  description: 'PLAN_REQUIRED {feature:image_generation}',
})
@ApiBadRequestResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiNotFoundResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiConflictResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiServiceUnavailableResponse({ schema: apiSchema(ApiErrorSchema) })
@ApiPayloadTooLargeResponse({ schema: apiSchema(ApiErrorSchema) })
@UseGuards(MediaGuard)
@Controller('projects/:projectId')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('images/generate')
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID for this image request.',
  })
  @ApiBody({ schema: apiSchema(GenerateImageInputSchema, 'input') })
  @ApiCreatedResponse({ schema: apiSchema(AssetSchema) })
  @ApiTooManyRequestsResponse({ schema: apiSchema(ApiErrorSchema) })
  generate(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Headers('idempotency-key') requestId: string | undefined,
    @Body(new SchemaPipe(GenerateImageInputSchema)) input: GenerateImageInput,
  ) {
    if (!z.uuid().safeParse(requestId).success)
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Idempotency-Key phải là UUID.',
        details: null,
      });
    return this.media.generate(projectId, user, requestId!, input);
  }

  @Post('assets/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ schema: apiSchema(AssetSchema) })
  upload(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('name') name?: string,
  ) {
    return this.media.upload(projectId, file, name);
  }

  @Get('assets')
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['IMAGE', 'VIDEO', 'DOCUMENT'],
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'before', required: false, type: String })
  @ApiOkResponse({ schema: apiSchema(AssetListResponseSchema) })
  list(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Query(new SchemaPipe(AssetListQuerySchema)) query: AssetListQuery,
  ) {
    return this.media.list(projectId, user.id, query);
  }

  @Get('assets/:id')
  @ApiOkResponse({ schema: apiSchema(AssetSchema) })
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.media.get(projectId, user.id, id);
  }

  @Get('assets/:id/url')
  @ApiOkResponse({ schema: apiSchema(AssetUrlResponseSchema) })
  url(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.media.url(projectId, user.id, id);
  }

  @Delete('assets/:id')
  @HttpCode(204)
  @ApiNoContentResponse()
  remove(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.media.remove(projectId, user.id, id);
  }

  @Get('contents/:contentId/assets')
  @ApiOkResponse({ schema: apiSchema(ContentAssetsResponseSchema) })
  contentAssets(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('contentId') contentId: string,
  ) {
    return this.media.contentAssets(projectId, user.id, contentId);
  }

  @Put('contents/:contentId/assets')
  @ApiBody({ schema: apiSchema(ReplaceContentAssetsSchema, 'input') })
  @ApiOkResponse({ schema: apiSchema(ContentAssetsResponseSchema) })
  replaceContentAssets(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('contentId') contentId: string,
    @Body(new SchemaPipe(ReplaceContentAssetsSchema))
    input: ReplaceContentAssetsInput,
  ) {
    return this.media.replaceContentAssets(
      projectId,
      user.id,
      contentId,
      input,
    );
  }
}
