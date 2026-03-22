import { z } from 'zod';

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const nonEmptyStringSchema = z.string().trim().min(1);
