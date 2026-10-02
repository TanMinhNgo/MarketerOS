import { validateEnvironment } from './env';

const valid = {
  WEB_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://localhost:5433/marketos',
  OPENAI_API_KEY: 'test-key',
  AI_MODEL: 'test-model',
};

test('validates configuration and never echoes secret values', () => {
  expect(validateEnvironment(valid).PORT).toBe(3001);
  expect(validateEnvironment({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  expect(() =>
    validateEnvironment({ ...valid, NODE_ENV: 'production' }),
  ).toThrow('CLERK_SECRET_KEY');
  expect(() =>
    validateEnvironment({ ...valid, CLERK_SECRET_KEY: 'sk_test_missing_pair' }),
  ).toThrow('CLERK_PUBLISHABLE_KEY');
  expect(() => validateEnvironment({ ...valid, PORT: '0' })).toThrow('PORT');
  expect(() => validateEnvironment({ ...valid, OPENAI_API_KEY: '' })).toThrow(
    'OPENAI_API_KEY',
  );
  expect(() =>
    validateEnvironment({ ...valid, OPENAI_API_KEY: undefined }),
  ).toThrow('OPENAI_API_KEY');
  expect(() => validateEnvironment({ ...valid, AI_MODEL: '' })).toThrow(
    'AI_MODEL',
  );
  expect(() => validateEnvironment({ ...valid, AI_MODEL: undefined })).toThrow(
    'AI_MODEL',
  );
  expect(() =>
    validateEnvironment({ ...valid, CLERK_WEBHOOK_SECRET: 'invalid-secret' }),
  ).toThrow('CLERK_WEBHOOK_SECRET');
  expect(() =>
    validateEnvironment({ ...valid, WEB_URL: 'ftp://localhost' }),
  ).toThrow('WEB_URL');
  expect(() =>
    validateEnvironment({ ...valid, DATABASE_URL: 'secret-invalid-url' }),
  ).toThrow('DATABASE_URL');
  try {
    validateEnvironment({ ...valid, DATABASE_URL: 'secret-invalid-url' });
  } catch (error) {
    expect(String(error)).not.toContain('secret-invalid-url');
  }
});
