import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  DEV_AUTH_USERNAME: z.string().optional(),
  DEV_AUTH_PASSWORD: z.string().optional(),
  SERVER_SIDE_API_KEY: z.string().min(32).optional(),
  TRADING_ACCOUNT_ID: z.string().min(1).optional(),
  ORDER_EXECUTOR_URL: z.string().url().optional(),
  ORDER_EXECUTOR_API_KEY: z.string().min(1).optional(),
  AI_METRICS_API_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  AI_GLOBAL_RATE_LIMIT: z.string().default('200'),
  AI_MODEL_VERSION: z.string().default('unknown'),
})

export const env = EnvSchema.parse(process.env)

export function isProd() {
  return env.NODE_ENV === 'production'
}
