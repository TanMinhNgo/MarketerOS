import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationCrypto } from './integration-crypto';
import { isPublishable, scheduledRequestId } from './publication.worker';
import { mapProviderError } from './provider.gateway';

describe('Phase 10 integration invariants', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const crypto = new IntegrationCrypto({
    get: (name: string) => (name === 'TOKEN_ENCRYPTION_KEY' ? key : undefined),
  } as ConfigService);
  it('encrypts credentials with random IV and rejects tampering', () => {
    const first = crypto.encrypt({ accessToken: 'secret-token' });
    const second = crypto.encrypt({ accessToken: 'secret-token' });
    expect(first).not.toBe(second);
    expect(first).not.toContain('secret-token');
    expect(crypto.decrypt(first)).toEqual({ accessToken: 'secret-token' });
    const bytes = Buffer.from(first, 'base64');
    bytes[bytes.length - 1] ^= 1;
    expect(() => crypto.decrypt(bytes.toString('base64'))).toThrow();
  });
  it('binds OAuth state to fields, signature and ten-minute expiry', () => {
    const data = {
      userId: 'u',
      projectId: 'p',
      provider: 'facebook',
      nonce: 'n',
      issuedAt: Date.now(),
    };
    const state = crypto.signState(data);
    expect(crypto.readState(state)).toEqual(data);
    expect(() => crypto.readState(`${state}x`)).toThrow(BadRequestException);
    expect(() =>
      crypto.readState(
        crypto.signState({ ...data, issuedAt: Date.now() - 600_001 }),
      ),
    ).toThrow(BadRequestException);
  });
  it('only schedules approved due content and uses a stable request id', () => {
    const due = new Date('2026-10-03T10:00:00Z');
    const now = new Date('2026-10-03T10:00:01Z');
    expect(isPublishable('DRAFT', due, now)).toBe(false);
    expect(isPublishable('READY', due, now)).toBe(false);
    expect(isPublishable('SCHEDULED', null, now)).toBe(false);
    expect(isPublishable('SCHEDULED', due, now)).toBe(true);
    expect(scheduledRequestId('content-1', due)).toBe(
      'content-1:2026-10-03T10:00:00.000Z',
    );
  });
  it('maps provider failures without exposing raw provider errors', () => {
    expect(mapProviderError(401).code).toBe('TOKEN_EXPIRED');
    expect(mapProviderError(403).code).toBe('PERMISSION_DENIED');
    expect(mapProviderError(429).retryable).toBe(true);
    expect(mapProviderError(422).code).toBe('CONTENT_REJECTED');
    expect(mapProviderError(503).ambiguous).toBe(true);
  });
});
