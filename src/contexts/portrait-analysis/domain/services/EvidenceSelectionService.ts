import type { EvidenceSelectionInput } from '@/src/contexts/portrait-analysis/application/dto/EvidenceSelectionInput';
import type { EvidenceSelectionResult } from '@/src/contexts/portrait-analysis/application/dto/EvidenceSelectionResult';
import type { EvidenceCandidate } from '@/src/contexts/portrait-analysis/domain/entities/EvidenceCandidate';
import {
  COMMUNITY_DIVERSITY_BONUS,
  EVIDENCE_SELECTION_POLICY,
  MAX_TEXT_LENGTH_BONUS_THRESHOLD,
  MIN_SUBSTANTIVE_CHARS,
  NODE_CONTEXT_BONUS,
  PUBLISHED_AT_PRESENT_BONUS,
  RECENCY_SOFT_BONUS,
  TOPIC_CONTEXT_BONUS,
  TYPE_DIVERSITY_BONUS,
  URL_PRESENT_BONUS,
} from '@/src/contexts/portrait-analysis/domain/services/EvidenceSelectionPolicy';
import { NodeHashService } from '@/src/shared/contracts/HashService';
import { normalizeWhitespace, truncateText } from '@/src/shared/utils/text';

type ScoredCandidate = EvidenceCandidate & {
  normalizedExcerpt: string;
  normalizedText: string;
  recencyRank: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeText(value: string): string {
  return normalizeWhitespace(value);
}

function normalizePublishedAt(value: string): string | undefined {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function buildCandidateId(hashService: NodeHashService, activityId: string, excerpt: string): string {
  return hashService.sha256(`evidence-candidate:${activityId}:${excerpt}`);
}

function buildBaseReasons(candidate: ScoredCandidate): string[] {
  const reasons: string[] = [];

  if (candidate.textLength && candidate.textLength >= MIN_SUBSTANTIVE_CHARS) {
    reasons.push('substantive-text');
  }

  if (candidate.nodeName) {
    reasons.push('node-context');
  } else if (candidate.labelHint.includes('topic')) {
    reasons.push('topic-context');
  }

  if (candidate.recencyRank === 0) {
    reasons.push('recent-representative');
  }

  return reasons.slice(0, 3);
}

function computeBaseScore(candidate: ScoredCandidate): number {
  const textLength = candidate.textLength ?? 0;
  let score = 0;

  score += Math.min(textLength, MAX_TEXT_LENGTH_BONUS_THRESHOLD) / MAX_TEXT_LENGTH_BONUS_THRESHOLD;

  if (textLength >= MIN_SUBSTANTIVE_CHARS) {
    score += 0.4;
  }

  if (candidate.nodeName) {
    score += NODE_CONTEXT_BONUS;
  }

  if (candidate.labelHint.includes('topic')) {
    score += TOPIC_CONTEXT_BONUS;
  }

  if (candidate.activityUrl) {
    score += URL_PRESENT_BONUS;
  }

  if (normalizePublishedAt(candidate.publishedAt)) {
    score += PUBLISHED_AT_PRESENT_BONUS;
  }

  score += Math.max(RECENCY_SOFT_BONUS - candidate.recencyRank * 0.02, 0);

  return Number(score.toFixed(4));
}

function candidateText(activity: EvidenceSelectionInput['activities'][number]): string {
  return normalizeText(activity.contentText || activity.excerpt || '');
}

function dedupeCandidates(candidates: ScoredCandidate[]): {
  dedupedCandidates: ScoredCandidate[];
  dedupedCount: number;
} {
  const byActivityId = new Map<string, ScoredCandidate>();

  for (const candidate of candidates) {
    const current = byActivityId.get(candidate.activityId);

    if (!current || (candidate.score ?? 0) > (current.score ?? 0)) {
      byActivityId.set(candidate.activityId, candidate);
    }
  }

  const byExcerpt = new Map<string, ScoredCandidate>();

  for (const candidate of byActivityId.values()) {
    const excerptKey = candidate.normalizedExcerpt;
    const current = byExcerpt.get(excerptKey);

    if (!current || (candidate.score ?? 0) > (current.score ?? 0)) {
      byExcerpt.set(excerptKey, candidate);
    }
  }

  const byUrlAndText = new Map<string, ScoredCandidate>();

  for (const candidate of byExcerpt.values()) {
    const key = `${candidate.activityUrl}|${candidate.normalizedText}`;
    const current = byUrlAndText.get(key);

    if (!current || (candidate.score ?? 0) > (current.score ?? 0)) {
      byUrlAndText.set(key, candidate);
    }
  }

  const dedupedCandidates = [...byUrlAndText.values()].sort(
    (left, right) => (right.score ?? 0) - (left.score ?? 0),
  );

  return {
    dedupedCandidates,
    dedupedCount: Math.max(candidates.length - dedupedCandidates.length, 0),
  };
}

export class EvidenceSelectionService {
  select(input: EvidenceSelectionInput): EvidenceSelectionResult {
    const hashService = new NodeHashService();
    const sortedActivities = [...input.activities].sort((left, right) => {
      const leftTime = new Date(left.publishedAt).getTime();
      const rightTime = new Date(right.publishedAt).getTime();

      return rightTime - leftTime;
    });

    const rawCandidates = sortedActivities
      .map<ScoredCandidate | null>((activity, index) => {
        const text = candidateText(activity);
        const excerpt = truncateText(text || normalizeText(activity.excerpt || ''), 180);

        if (!excerpt) {
          return null;
        }

        const candidate: ScoredCandidate = {
          id: buildCandidateId(hashService, activity.id, excerpt),
          activityId: activity.id,
          community: activity.community,
          activityType: activity.type,
          labelHint:
            activity.type === 'topic' ? 'Representative topic' : 'Representative reply',
          excerpt,
          activityUrl: activity.url,
          publishedAt: normalizePublishedAt(activity.publishedAt) ?? activity.publishedAt,
          reasons: [],
          nodeName: activity.nodeName,
          textLength: text.length,
          normalizedExcerpt: normalizeText(excerpt),
          normalizedText: text,
          recencyRank: index,
          score: 0,
        };

        candidate.score = computeBaseScore(candidate);
        candidate.reasons = buildBaseReasons(candidate);
        return candidate;
      })
      .filter((candidate): candidate is ScoredCandidate => candidate !== null);

    const { dedupedCandidates, dedupedCount } = dedupeCandidates(rawCandidates);
    const selected: EvidenceCandidate[] = [];
    const selectedTypes = new Set<'topic' | 'reply'>();
    const selectedCommunities = new Set<string>();
    const maxEvidence = input.maxEvidence ?? EVIDENCE_SELECTION_POLICY.maxSelectedEvidence;

    while (selected.length < maxEvidence && dedupedCandidates.length > 0) {
      let bestIndex = -1;
      let bestScore = -1;

      dedupedCandidates.forEach((candidate, index) => {
        let score = candidate.score ?? 0;
        const reasons = [...candidate.reasons];

        if (
          input.featureVector.community.crossCommunity &&
          !selectedCommunities.has(candidate.community)
        ) {
          score += COMMUNITY_DIVERSITY_BONUS;
          reasons.push('community-coverage');
        }

        if (candidate.activityType && !selectedTypes.has(candidate.activityType)) {
          score += TYPE_DIVERSITY_BONUS;
          reasons.push('type-balance');
        }

        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
          dedupedCandidates[index] = {
            ...candidate,
            score: Number(score.toFixed(4)),
            reasons: [...new Set(reasons)].slice(0, 3),
          };
        }
      });

      if (bestIndex === -1) {
        break;
      }

      const [winner] = dedupedCandidates.splice(bestIndex, 1);

      if (!winner) {
        break;
      }

      selected.push({
        id: winner.id,
        activityId: winner.activityId,
        community: winner.community,
        activityType: winner.activityType,
        labelHint: winner.labelHint,
        excerpt: winner.excerpt,
        activityUrl: winner.activityUrl,
        publishedAt: winner.publishedAt,
        reasons: [...new Set(winner.reasons)].slice(0, 3),
        nodeName: winner.nodeName,
        score: winner.score,
        textLength: winner.textLength,
      });

      if (winner.activityType) {
        selectedTypes.add(winner.activityType);
      }

      selectedCommunities.add(winner.community);
    }

    return {
      candidates: rawCandidates.map((candidate) => ({
        id: candidate.id,
        activityId: candidate.activityId,
        community: candidate.community,
        activityType: candidate.activityType,
        labelHint: candidate.labelHint,
        excerpt: candidate.excerpt,
        activityUrl: candidate.activityUrl,
        publishedAt: candidate.publishedAt,
        reasons: candidate.reasons,
        nodeName: candidate.nodeName,
        score: clamp(candidate.score ?? 0, 0, 2),
        textLength: candidate.textLength,
      })),
      selected,
      stats: {
        totalCandidates: rawCandidates.length,
        selectedCount: selected.length,
        topicEvidenceCount: selected.filter((item) => item.activityType === 'topic').length,
        replyEvidenceCount: selected.filter((item) => item.activityType === 'reply').length,
        communityCoverage: [...selectedCommunities] as EvidenceSelectionResult['stats']['communityCoverage'],
        dedupedCount,
      },
    };
  }
}
