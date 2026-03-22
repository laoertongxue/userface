import { z } from 'zod';
import { nonEmptyStringSchema } from '@/src/shared/schemas/common';

export const communitySchema = z.enum(['v2ex', 'guozaoke', 'weibo']);

export const externalAccountSchema = z.object({
  community: communitySchema,
  handle: nonEmptyStringSchema,
  uid: nonEmptyStringSchema.optional(),
  homepageUrl: z.string().url().optional(),
});

export const identitySchema = z.object({
  label: nonEmptyStringSchema.optional(),
  accounts: z.array(externalAccountSchema).min(1),
});

export const identitySuggestRequestSchema = z.object({
  accounts: z.array(externalAccountSchema).min(1),
});
