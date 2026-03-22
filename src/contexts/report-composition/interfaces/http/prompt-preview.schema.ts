import { z } from 'zod';

export const promptPreviewRequestSchema = z.object({
  portrait: z.object({
    archetype: z.string(),
    tags: z.array(z.string()),
    summary: z.string(),
    confidence: z.number(),
  }),
  metrics: z.object({
    totalActivities: z.number(),
    topicCount: z.number(),
    replyCount: z.number(),
    avgTextLength: z.number(),
    activeDays: z.number(),
  }),
  evidence: z.array(
    z.object({
      label: z.string(),
      excerpt: z.string(),
      activityUrl: z.string().url().or(z.string().startsWith('/')),
      community: z.string(),
      publishedAt: z.string(),
    }),
  ),
});
