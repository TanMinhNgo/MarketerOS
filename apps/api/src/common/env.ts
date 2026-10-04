import { z } from 'zod';

const EnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    WEB_URL: z.url({ protocol: /^https?$/ }).pipe(
      z.string().refine((value) => {
        const url = new URL(value);
        return !url.username && !url.password;
      }),
    ),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    CLERK_WEBHOOK_SECRET: z
      .string()
      .regex(/^whsec_[A-Za-z0-9+/=]+$/)
      .optional()
      .or(z.literal('')),
    CLERK_SECRET_KEY: z
      .string()
      .regex(/^sk_(test|live)_.+$/)
      .optional()
      .or(z.literal('')),
    CLERK_PUBLISHABLE_KEY: z
      .string()
      .regex(/^pk_(test|live)_.+$/)
      .optional()
      .or(z.literal('')),
    OPENAI_API_KEY: z.string().trim().min(1),
    AI_MODEL: z.string().trim().min(1),
    IMAGE_MODEL: z.string().trim().min(1).default('gpt-image-2.5-sunburst'),
    IMAGEKIT_PRIVATE_KEY: z.string().optional(),
    IMAGEKIT_URL_ENDPOINT: z
      .url({ protocol: /^https?$/ })
      .optional()
      .or(z.literal('')),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
    META_APP_ID: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    OAUTH_CALLBACK_BASE: z
      .url({ protocol: /^https?$/ })
      .optional()
      .or(z.literal('')),
    TOKEN_ENCRYPTION_KEY: z.string().optional(),
  })
  .superRefine((env, context) => {
    if (
      env.TOKEN_ENCRYPTION_KEY &&
      Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'base64').length !== 32
    )
      context.addIssue({
        code: 'custom',
        path: ['TOKEN_ENCRYPTION_KEY'],
        message: 'Expected base64 of 32 bytes.',
      });
    if (
      Boolean(env.CLERK_SECRET_KEY) !== Boolean(env.CLERK_PUBLISHABLE_KEY) ||
      (env.NODE_ENV === 'production' && !env.CLERK_SECRET_KEY)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CLERK_SECRET_KEY'],
        message: 'Configure both Clerk keys.',
      });
      context.addIssue({
        code: 'custom',
        path: ['CLERK_PUBLISHABLE_KEY'],
        message: 'Configure both Clerk keys.',
      });
    }
  });

export type Environment = z.infer<typeof EnvironmentSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const result = EnvironmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    throw new Error(`Invalid environment variables: ${fields.join(', ')}`);
  }
  return result.data;
}
