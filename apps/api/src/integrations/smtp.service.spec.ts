import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { ProviderError } from './provider.gateway';
import { SmtpService } from './smtp.service';

const message = {
  from: 'sender@example.com',
  to: 'reader@example.com',
  subject: 'Tin mới',
  text: 'Xin chào!',
};
const config = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: 587,
  SMTP_SECURE: 'false',
  SMTP_USER: 'user',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: message.from,
};
const service = () => new SmtpService(new ConfigService(config));
afterEach(() => jest.restoreAllMocks());

test('SMTP is optional and readiness never connects or exposes credentials', () => {
  const transport = jest.spyOn(nodemailer, 'createTransport');
  expect(new SmtpService(new ConfigService({})).configured()).toBe(false);
  expect(service().configured()).toBe(true);
  expect(transport).not.toHaveBeenCalled();
});

test('verify uses authenticated TLS transport without sending a message', async () => {
  const verify = jest.fn().mockResolvedValue(true);
  const transport = jest
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ verify } as unknown as Transporter);
  await expect(service().verify()).resolves.toEqual({
    address: message.from,
    name: message.from,
  });
  expect(transport).toHaveBeenCalledWith(
    expect.objectContaining({
      requireTLS: true,
      secure: false,
      auth: { user: 'user', pass: 'secret' },
      disableFileAccess: true,
      disableUrlAccess: true,
    }),
  );
  expect(verify).toHaveBeenCalledTimes(1);
});

test('sends only frozen plain text to one recipient and uses a stable message id', async () => {
  const sendMail = jest
    .fn()
    .mockResolvedValue({ accepted: [message.to], rejected: [] });
  jest
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ sendMail } as unknown as Transporter);
  await expect(
    service().send(message, 'publication-1', message.from),
  ).resolves.toEqual({ id: '<publication-1@example.com>', url: null });
  expect(sendMail).toHaveBeenCalledWith({
    from: { address: message.from, name: '' },
    to: message.to,
    subject: message.subject,
    text: message.text,
    messageId: '<publication-1@example.com>',
  });
});

test.each([
  { ...message, to: 'reader@example.com,other@example.com' },
  { ...message, subject: 'hello\r\nBcc: victim@example.com' },
  { ...message, text: '{{unsubscribe_link}}' },
  { ...message, text: 'Liên hệ [Tên doanh nghiệp]' },
  { ...message, from: 'different@example.com' },
])(
  'rejects invalid or unresolved messages before opening SMTP',
  async (snapshot) => {
    const transport = jest.spyOn(nodemailer, 'createTransport');
    await expect(
      service().send(snapshot, 'publication-1', message.from),
    ).rejects.toMatchObject({ code: 'CONTENT_REJECTED' });
    expect(transport).not.toHaveBeenCalled();
  },
);

test('ambiguous send failures never become automatic retries', async () => {
  const sendMail = jest
    .fn()
    .mockRejectedValue(new Error('SMTP secret diagnostic'));
  jest
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ sendMail } as unknown as Transporter);
  await expect(
    service().send(message, 'publication-1', message.from),
  ).rejects.toMatchObject({
    code: 'PROVIDER_ERROR',
    retryable: false,
    ambiguous: true,
  });
  expect(sendMail).toHaveBeenCalledTimes(1);
});

test('rejects a changed env sender before opening SMTP', async () => {
  const transport = jest.spyOn(nodemailer, 'createTransport');
  await expect(
    service().send(message, 'publication-1', 'previous@example.com'),
  ).rejects.toBeInstanceOf(ProviderError);
  expect(transport).not.toHaveBeenCalled();
});

test('failed verification returns a sanitized 503', async () => {
  const verify = jest
    .fn()
    .mockRejectedValue(new Error('secret SMTP diagnostic'));
  jest
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ verify } as unknown as Transporter);
  await expect(service().verify()).rejects.toMatchObject({
    status: 503,
    message: 'SMTP connection could not be verified.',
  });
});

test('a rejected recipient is never recorded as SMTP acceptance', async () => {
  const sendMail = jest
    .fn()
    .mockResolvedValue({ accepted: [], rejected: [message.to] });
  jest
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ sendMail } as unknown as Transporter);
  await expect(
    service().send(message, 'publication-1', message.from),
  ).rejects.toMatchObject({ code: 'CONTENT_REJECTED', retryable: false });
});
