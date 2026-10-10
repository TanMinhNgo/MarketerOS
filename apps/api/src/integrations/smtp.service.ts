import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { PublishEmailSchema } from '@marketos/shared';
import { ProviderError } from './provider.gateway';

export const SmtpMessageSchema = PublishEmailSchema.extend({
  from: z.email(),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[^\r\n]*$/),
  text: z
    .string()
    .trim()
    .min(1)
    .max(100_000)
    .refine(
      (text) =>
        !/\{\{[^}]+\}\}|\[(Tên doanh nghiệp|Địa chỉ doanh nghiệp)\]/i.test(
          text,
        ),
      'Replace email template placeholders before sending.',
    ),
}).strict();
export type SmtpMessage = z.infer<typeof SmtpMessageSchema>;

@Injectable()
export class SmtpService {
  constructor(private readonly config: ConfigService) {}

  settings() {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    const from = this.config.get<string>('SMTP_FROM');
    const name = this.config.get<string>('SMTP_FROM_NAME') ?? '';
    if (
      !host ||
      !user ||
      !pass ||
      !from ||
      !z.email().safeParse(from).success ||
      /[\r\n]/.test(name)
    )
      throw new ServiceUnavailableException('SMTP is not configured.');
    return { host, user, pass, from, name };
  }

  configured() {
    try {
      this.settings();
      return true;
    } catch {
      return false;
    }
  }

  private transport() {
    const { host, user, pass } = this.settings();
    return nodemailer.createTransport({
      host,
      port: this.config.get<number>('SMTP_PORT') ?? 587,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      requireTLS: true,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
      dnsTimeout: 15_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async verify() {
    const sender = this.settings();
    try {
      await this.transport().verify();
    } catch {
      throw new ServiceUnavailableException(
        'SMTP connection could not be verified.',
      );
    }
    return { address: sender.from, name: sender.name || sender.from };
  }

  async send(
    snapshot: unknown,
    publicationId: string,
    connectedSender: string,
  ) {
    const parsed = SmtpMessageSchema.safeParse(snapshot);
    if (!parsed.success) throw new ProviderError('CONTENT_REJECTED');
    const message = parsed.data;
    const sender = this.settings();
    if (sender.from !== connectedSender || message.from !== connectedSender)
      throw new ProviderError('CONTENT_REJECTED');
    const messageId = `<${publicationId}@${sender.from.split('@')[1]}>`;
    try {
      const result = await this.transport().sendMail({
        from: { address: sender.from, name: sender.name },
        to: message.to,
        subject: message.subject,
        text: message.text,
        messageId,
      });
      if (result.accepted.length !== 1 || result.rejected.length)
        throw new ProviderError('CONTENT_REJECTED');
      return { id: messageId, url: null };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      // SMTP may accept DATA before the connection drops; never retry automatically.
      throw new ProviderError('PROVIDER_ERROR', false, true);
    }
  }
}
