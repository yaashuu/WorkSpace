import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from .env file into process.env if present
dotenv.config();

export const envSchema = z.object({
  PORT: z.coerce
    .number({ message: 'PORT must be a valid number' })
    .int('PORT must be an integer')
    .min(1, 'PORT must be at least 1')
    .max(65535, 'PORT must be at most 65535')
    .default(5000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'], {
      message: 'NODE_ENV must be development, production, or test',
    })
    .default('development'),
  MONGODB_URI: z
    .string({ message: 'MONGODB_URI is required' })
    .min(1, 'MONGODB_URI cannot be empty'),
  MONGODB_TEST_URI: z
    .string()
    .min(1, 'MONGODB_TEST_URI cannot be empty')
    .optional(),
  JWT_SECRET: z
    .string({ message: 'JWT_SECRET is required' })
    .min(16, 'JWT_SECRET must be at least 16 characters for security'),
  JWT_EXPIRES_IN: z
    .string()
    .default('7d'),
  CORS_ORIGIN: z
    .string()
    .optional(),
  BODY_LIMIT: z
    .string()
    .default('1mb'),
  RATE_LIMIT_LOGIN_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .default(10),
  RATE_LIMIT_REGISTER_MAX: z.coerce
    .number()
    .int()
    .min(1)
    .default(10),
  RATE_LIMIT_API_MAX: z.coerce
    .number()
    .int()
    .min(10)
    .default(300),
  ADMIN_EMAIL: z
    .string()
    .email('ADMIN_EMAIL must be a valid email address')
    .optional(),
  ADMIN_PASSWORD: z
    .string()
    .min(8, 'ADMIN_PASSWORD must be at least 8 characters')
    .optional(),
  ADMIN_NAME: z
    .string()
    .min(1, 'ADMIN_NAME cannot be empty')
    .optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production') {
    if (data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'In production, JWT_SECRET must be at least 32 characters long for cryptographic security',
      });
    }
    if (data.CORS_ORIGIN === '*') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGIN'],
        message: 'In production, CORS_ORIGIN cannot be a wildcard "*". Specify explicit allowed domains.',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:');
  const fieldErrors = parsedEnv.error.flatten().fieldErrors;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      console.error(`  - ${field}: ${messages.join(', ')}`);
    }
  }
  process.exit(1);
}

export const env: Env = parsedEnv.data;
