import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClerkGateway } from './clerk.gateway';
import { UsersRepository } from '../users/users.repository';
import type { AuthRequest } from './auth.decorators';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly clerk: ClerkGateway,
    private readonly users: UsersRepository,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>('public', [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authorization = request.headers.authorization;
    if (!authorization || !/^Bearer \S+$/i.test(authorization))
      throw new UnauthorizedException();
    let principal: Awaited<ReturnType<ClerkGateway['authenticate']>>;
    try {
      principal = await this.clerk.authenticate(authorization);
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnauthorizedException
      )
        throw error;
      throw new ServiceUnavailableException();
    }
    const user =
      (await this.users.find(principal.clerkId)) ??
      (await this.users.upsert(
        principal.clerkId,
        await this.clerk.profile(principal.clerkId),
      ));
    request.user = { ...user, plan: principal.plan };
    return true;
  }
}
