import { ForbiddenException } from '@nestjs/common';
import type { FeatureKey } from '@marketos/shared';
import type { AuthUser } from './auth.decorators';

export function requireFeature(
  user: Pick<AuthUser, 'features'>,
  feature: FeatureKey,
) {
  if (!user.features.includes(feature))
    throw new ForbiddenException({
      code: 'PLAN_REQUIRED',
      message: 'Gói đăng ký chưa cấp quyền cho tính năng này.',
      details: { feature },
    });
}
