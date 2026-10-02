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
  });
  await expect(
    gateway.authenticate(`Bearer ${token({ pla: 'u:pro' })}`),
  ).resolves.toEqual({ clerkId: 'user_local_test', plan: 'pro' });
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
