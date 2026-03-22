import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';
import type { TagCode } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';

export type PortraitTag = {
  code: TagCode;
  displayName: string;
  summaryHint: string;
  supportingSignalCodes: SignalCode[];
};
