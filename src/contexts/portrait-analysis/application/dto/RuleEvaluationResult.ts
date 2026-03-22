import type { CommunitySynthesisResult } from '@/src/contexts/portrait-analysis/application/dto/CommunitySynthesisResult';
import type { PortraitTag } from '@/src/contexts/portrait-analysis/domain/entities/PortraitTag';
import type { Signal } from '@/src/contexts/portrait-analysis/domain/entities/Signal';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';

export type PrimaryArchetype = {
  code: ArchetypeCode;
  score: number;
  rationale: string;
  supportingSignalCodes: SignalCode[];
};

export type RuleEvaluationResult = CommunitySynthesisResult & {
  primaryArchetype: PrimaryArchetype;
  signals: Signal[];
  tags: PortraitTag[];
};
