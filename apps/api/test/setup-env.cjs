process.env.NODE_ENV = 'test';
process.env.CLERK_WEBHOOK_SECRET = `whsec_${Buffer.from('local-webhook-test-secret').toString('base64')}`;
process.env.WEB_URL = 'http://localhost:3000';
process.env.OPENAI_API_KEY = 'test-key';
process.env.AI_MODEL = 'test-model';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://localhost:5433/marketos_test';
