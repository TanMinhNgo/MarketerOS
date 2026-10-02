import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthRequest } from '../auth/auth.decorators';
import { ProjectsRepository } from './projects.repository';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly projects: ProjectsRepository) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const id = request.params.projectId;
    if (typeof id === 'string')
      await this.projects.owned(id, request.user.id, true);
    return true;
  }
}
