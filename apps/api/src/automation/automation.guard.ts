import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.decorators';
import { requireFeature } from '../auth/require-feature';
import { ProjectsRepository } from '../projects/projects.repository';

@Injectable()
export class AutomationGuard implements CanActivate {
  constructor(private readonly projects: ProjectsRepository) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    requireFeature(
      request.user.plan === 'max' ? request.user : { features: [] },
      'automation',
    );
    await this.projects.owned(
      String(request.params.projectId),
      request.user.id,
    );
    return true;
  }
}
