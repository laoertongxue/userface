import type { ComposeNarrativeInput } from '@/src/contexts/report-composition/application/dto/ComposeNarrativeInput';
import type { NarrativeGenerationResult } from '@/src/contexts/report-composition/application/dto/NarrativeGenerationResult';
import type { LlmNarrativeGateway } from '@/src/contexts/report-composition/domain/contracts/LlmNarrativeGateway';
import type { NarrativeDraft } from '@/src/contexts/report-composition/domain/entities/NarrativeDraft';
import type { NarrativeSection } from '@/src/contexts/report-composition/domain/entities/NarrativeSection';
import { normalizeWhitespace } from '@/src/shared/utils/text';
import { metricNames } from '@/src/contexts/platform-governance/infrastructure/observability/MetricNames';
import { observabilityEvents } from '@/src/contexts/platform-governance/infrastructure/observability/StructuredLogger';

function humanizeArchetype(archetype: string): string {
  switch (archetype) {
    case 'discussion-oriented':
      return '讨论参与型';
    case 'topic-oriented':
      return '主题输出型';
    case 'community-participant':
      return '社区参与型';
    case 'problem-solver':
      return '问题解决型';
    case 'information-curator':
      return '信息整理型';
    case 'observer':
      return '轻量参与型';
    case 'insufficient-data':
      return '样本有限';
    default:
      return archetype;
  }
}

function buildHeadline(input: ComposeNarrativeInput): string {
  const leadingTag = input.portrait.tags[0];
  const archetypeLabel = humanizeArchetype(input.portrait.archetype);

  if (leadingTag) {
    return `${archetypeLabel}，当前更显著的特征是 ${leadingTag}。`;
  }

  return `${archetypeLabel}。`;
}

function buildShortSummary(input: ComposeNarrativeInput): string {
  const summary = normalizeWhitespace(input.portrait.summary);

  if (summary) {
    return summary;
  }

  return '当前叙事草稿直接基于结构化规则事实生成。';
}

function buildCaveatContent(input: ComposeNarrativeInput): string | null {
  const warningCodes = input.warnings.map((warning) => warning.code);
  const cautionReasons: string[] = [];

  if (input.degraded) {
    cautionReasons.push('source-degraded');
  }

  if (warningCodes.includes('LOW_DATA') || input.portrait.tags.includes('low-data')) {
    cautionReasons.push('low-data');
  }

  if (warningCodes.length > 0) {
    cautionReasons.push(`warnings:${warningCodes.join(',')}`);
  }

  if (cautionReasons.length === 0) {
    return null;
  }

  return `当前结论应谨慎解读，原因包括 ${cautionReasons.join('；')}。`;
}

export class RuleOnlyNarrativeGateway implements LlmNarrativeGateway {
  async generateNarrative(input: ComposeNarrativeInput): Promise<NarrativeGenerationResult> {
    const observability = input.observability?.child('narrative.generate.rule_only');
    const span = observability?.startSpan('narrative.generate.rule_only');
    observability?.logger.event(observabilityEvents.narrativeGenerateStarted, {
      message: 'Rule-only narrative generation started.',
      context: {
        provider: 'rule-only',
        mode: input.mode,
      },
    });
    const sections: NarrativeSection[] = [
      {
        code: 'HEADLINE',
        content: buildHeadline(input),
        grounded: true,
        sourceHints: ['portrait.archetype', 'portrait.tags'],
        supportingEvidenceIds: input.selectedEvidence.slice(0, 1).map((item) => item.id),
      },
      {
        code: 'SHORT_SUMMARY',
        content: buildShortSummary(input),
        grounded: true,
        sourceHints: ['portrait.summary', 'portrait.confidence'],
        supportingEvidenceIds: input.selectedEvidence.slice(0, 2).map((item) => item.id),
      },
    ];
    const caveatContent = buildCaveatContent(input);

    if (caveatContent) {
      sections.push({
        code: 'CAVEATS',
        content: caveatContent,
        grounded: true,
        sourceHints: ['warnings', 'degraded', 'fallbackPolicy'],
      });
    }

    const draft: NarrativeDraft = {
      mode: input.mode,
      sections,
      generatedBy: 'RULE_ONLY',
      audience: input.audience,
      tone: input.tone,
      warnings: [],
      metadata: {
        provider: 'rule-only',
        sectionCount: sections.length,
      },
    };

    const result = {
      draft,
      fallbackUsed: false,
      warnings: [],
    } satisfies NarrativeGenerationResult;
    const completedSpan = span?.finish('success');
    observability?.logger.event(observabilityEvents.narrativeGenerateCompleted, {
      message: 'Rule-only narrative generation completed.',
      context: {
        provider: 'rule-only',
        mode: input.mode,
        sectionCount: sections.length,
        durationMs: completedSpan?.durationMs,
      },
    });
    observability?.metrics.counter(metricNames.narrativeGenerateTotal, 1, {
      provider: 'rule-only',
      mode: input.mode,
      outcome: 'success',
    });
    if (completedSpan) {
      observability?.metrics.timing(metricNames.narrativeGenerateDurationMs, completedSpan.durationMs, {
        provider: 'rule-only',
        mode: input.mode,
        outcome: 'success',
      });
    }

    return result;
  }
}
