import { generateKeyPairSync, sign } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { UnauthorizedException } from '@nestjs/common';
import { ClerkGateway } from './clerk.gateway';

test('Clerk SDK verifies signatures, expiry and allowed origin without external calls', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const host = 'unit-test.clerk.accounts.dev';
  const client = createClerkClient({
    secretKey: 'sk_test_local_fixture',
    publishableKey: `pk_test_${Buffer.from(`${host}$`).toString('base64')}`,
    jwtKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  });
  const gateway = new ClerkGateway(
    new ConfigService({ WEB_URL: 'http://localhost:3000' }),
  );
  jest.spyOn(gateway, 'client').mockReturnValue(client);
  const now = Math.floor(Date.now() / 1000);
  function token(overrides: Record<string, unknown> = {}) {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    const payload = `${encode({ alg: 'RS256', typ: 'JWT', kid: 'test' })}.${encode(
      {
        sub: 'user_local_test',
        sid: 'sess_local_test',
        iss: `https://${host}`,
        azp: 'http://localhost:3000',
        iat: now,
        nbf: now - 1,
        exp: now + 60,
        sts: 'active',
        ...overrides,
      },
    )}`;
    return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url')}`;
  }
  await expect(gateway.authenticate(`Bearer ${token()}`)).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'free',
    features: [],
  });
  await expect(
    gateway.authenticate(`Bearer ${token({ pla: 'u:pro' })}`),
  ).resolves.toEqual({ clerkId: 'user_local_test', plan: 'pro', features: [] });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'o:pro', fea: 'o:project_aware_ai_assistant' })}`,
    ),
  ).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'free',
    features: [],
  });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:pro', fea: 'u:brand_brief_for_each_project,u:unknown_feature' })}`,
    ),
  ).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'pro',
    features: ['brand_brief'],
  });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:pro', fea: 'o:brand_brief,o:project_aware_ai_assistant' })}`,
    ),
  ).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'pro',
    features: [],
  });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:pro', fea: 'u:project_aware_ai_assistant' })}`,
    ),
  ).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'pro',
    features: ['ai_assistant'],
  });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:pro', fea: 'u:ai_assistant' })}`,
    ),
  ).resolves.toEqual({ clerkId: 'user_local_test', plan: 'pro', features: [] });
  const freeSlugs = [
    'up_to_3_projects',
    'basic_ai_content_generation_allowance',
    'trial_ai_image_generation_allowance',
    'up_to_3_content_variations_per_generation',
    'brand_brief_for_each_project',
    'personal_preferences_and_references',
    'content_drafts_and_calendar',
  ];
  const proSlugs = [
    'everything_in_free',
    'higher_ai_content_and_image_generation_allowances',
    'increased_project_limit',
    'up_to_5_content_variations_per_generation',
    'access_to_advanced_ai_models',
    'expanded_reference_and_media_storage',
    'channel_connections_and_scheduled_publishing',
    'project_aware_ai_assistant',
    'content_performance_analytics',
  ];
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:free_user', fea: freeSlugs.map((s) => `u:${s}`).join(',') })}`,
    ),
  ).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'free',
    features: [
      'content_generation',
      'image_generation',
      'brand_brief',
      'personalization',
      'content_calendar',
    ],
  });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:pro', fea: proSlugs.map((s) => `u:${s}`).join(',') })}`,
    ),
  ).resolves.toEqual({
    clerkId: 'user_local_test',
    plan: 'pro',
    features: [
      'content_generation',
      'image_generation',
      'brand_brief',
      'personalization',
      'content_calendar',
      'more_projects',
      'strong_model',
      'expanded_references',
      'channel_publishing',
      'ai_assistant',
      'content_analytics',
    ],
  });
  await expect(
    gateway.authenticate(
      `Bearer ${token({ pla: 'u:pro', fea: proSlugs.map((s) => `o:${s}`).join(',') })}`,
    ),
  ).resolves.toEqual({ clerkId: 'user_local_test', plan: 'pro', features: [] });
  for (const invalid of [
    token({ azp: 'https://evil.example' }),
    token({ exp: now - 60 }),
    token({ azp: undefined }),
    `${token()}.tampered`,
  ]) {
    await expect(
      gateway.authenticate(`Bearer ${invalid}`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  }
});
