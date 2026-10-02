import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { FeatureKey, PlanKey } from '@marketos/shared';

export type AuthUser = {
  id: string;
  clerkId: string;
  email: string | null;
  name: string | null;
  isDemo: boolean;
  createdAt: Date;
  plan: PlanKey;
  features: FeatureKey[];
};
export type AuthRequest = Request & { user: AuthUser };
export const Public = () => SetMetadata('public', true);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthRequest>().user,
);
