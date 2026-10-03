import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.decorators';
import { requireFeature } from '../auth/require-feature';
import { ProjectsRepository } from '../projects/projects.repository';

@Injectable()
export class AssistantGuard implements CanActivate {
  constructor(private readonly projects: ProjectsRepository) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    requireFeature(
      request.user.plan !== 'free' ? request.user : { features: [] },
      'ai_assistant',
    );
    await this.projects.owned(
      String(request.params.projectId),
      request.user.id,
    );
    return true;
  }
}
