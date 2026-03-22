import { z } from 'zod';
import { identitySchema } from '@/src/contexts/identity-resolution/interfaces/http/identity.schema';

export const analyzeRequestSchema = z.object({
  identity: identitySchema,
  options: z
    .object({
      maxPagesPerCommunity: z.number().int().positive().max(10).optional(),
      maxItemsPerCommunity: z.number().int().positive().max(500).optional(),
      includeTopics: z.boolean().optional(),
      includeReplies: z.boolean().optional(),
      locale: z.enum(['zh-CN', 'en-US']).optional(),
      llmProvider: z.enum(['minimax', 'none']).optional(),
    })
    .optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
