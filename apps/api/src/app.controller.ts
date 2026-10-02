import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { HealthResponse } from '@marketos/shared';
import { Public } from './auth/auth.decorators';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Public()
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status', 'db'],
      properties: {
        status: { type: 'string', enum: ['ok'] },
        db: { type: 'string', enum: ['up'] },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Database không khả dụng; ApiError SERVICE_UNAVAILABLE.',
  })
  health(): Promise<HealthResponse> {
    return this.appService.health();
  }
}
