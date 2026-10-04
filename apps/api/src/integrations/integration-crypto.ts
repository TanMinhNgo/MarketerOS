import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class IntegrationCrypto {
  constructor(private readonly config: ConfigService) {}
  private key(): Buffer {
    const encoded = this.config.get<string>('TOKEN_ENCRYPTION_KEY') ?? '';
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded)
      throw new ServiceUnavailableException(
        'Integration encryption unavailable',
      );
    return key;
  }
  encrypt(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }
  decrypt<T>(encoded: string): T {
    try {
      const bytes = Buffer.from(encoded, 'base64');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key(),
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString('utf8'),
      ) as T;
    } catch {
      throw new ServiceUnavailableException(
        'Integration credential unavailable',
      );
    }
  }
  signState(data: {
    userId: string;
    projectId: string;
    provider: string;
    nonce: string;
    issuedAt: number;
  }): string {
    const body = Buffer.from(JSON.stringify(data)).toString('base64url');
    const mac = createHmac('sha256', this.key())
      .update(body)
      .digest('base64url');
    return `${body}.${mac}`;
  }
  readState(value: string): {
    userId: string;
    projectId: string;
    provider: string;
    nonce: string;
    issuedAt: number;
  } {
    const [body, signature, extra] = value.split('.');
    if (!body || !signature || extra)
      throw new BadRequestException('Invalid OAuth state');
    const expected = createHmac('sha256', this.key()).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new BadRequestException('Invalid OAuth state');
    try {
      const data = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as Record<string, unknown>;
      if (
        typeof data.userId !== 'string' ||
        typeof data.projectId !== 'string' ||
        typeof data.provider !== 'string' ||
        typeof data.nonce !== 'string' ||
        typeof data.issuedAt !== 'number' ||
        data.issuedAt > Date.now() ||
        Date.now() - data.issuedAt > 600_000
      )
        throw new Error('expired');
      return data as ReturnType<IntegrationCrypto['readState']>;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }
}
