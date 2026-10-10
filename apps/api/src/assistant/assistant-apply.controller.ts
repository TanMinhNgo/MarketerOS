import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AssistantApplyResponseSchema } from '@marketos/shared';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { apiSchema } from '../common/api-schema';
import { OwnershipGuard } from '../projects/ownership.guard';
import { AssistantGuard } from './assistant.guard';
import { AssistantApplyService } from './assistant-apply.service';

@ApiTags('assistant')
@ApiBearerAuth()
@UseGuards(AssistantGuard, OwnershipGuard)
@Controller(
  'projects/:projectId/assistant/messages/:messageId/actions/:actionId/apply',
)
export class AssistantApplyController {
  constructor(private readonly service: AssistantApplyService) {}
  @Get()
  @ApiOkResponse({ schema: apiSchema(AssistantApplyResponseSchema) })
  get(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Param('actionId') actionId: string,
  ) {
    return this.service.get(projectId, user.id, messageId, actionId);
  }
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ schema: apiSchema(AssistantApplyResponseSchema) })
  apply(
    @CurrentUser() user: AuthUser,
    @Param('projectId') projectId: string,
    @Param('messageId') messageId: string,
    @Param('actionId') actionId: string,
  ) {
    return this.service.apply(projectId, user, messageId, actionId);
  }
}
