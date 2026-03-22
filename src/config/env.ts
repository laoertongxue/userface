import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NARRATIVE_PROVIDER: z.enum(['none', 'minimax']).optional(),
  NARRATIVE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  MINIMAX_API_KEY: z.string().optional(),
  MINIMAX_BASE_URL: z.string().optional(),
  MINIMAX_MODEL: z.string().optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  NARRATIVE_PROVIDER: process.env.NARRATIVE_PROVIDER,
  NARRATIVE_TIMEOUT_MS: process.env.NARRATIVE_TIMEOUT_MS,
  MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
  MINIMAX_BASE_URL: process.env.MINIMAX_BASE_URL,
  MINIMAX_MODEL: process.env.MINIMAX_MODEL,
});
