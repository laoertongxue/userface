import { BuildCanonicalActivityStream } from '@/src/contexts/activity-normalization/application/use-cases/BuildCanonicalActivityStream';
import type { AnalyzePortraitInput } from '@/src/contexts/portrait-analysis/application/dto/AnalyzePortraitInput';
import type { ArchetypeCode } from '@/src/contexts/portrait-analysis/domain/value-objects/ArchetypeCode';
import type { SignalCode } from '@/src/contexts/portrait-analysis/domain/value-objects/SignalCode';
import type { TagCode } from '@/src/contexts/portrait-analysis/domain/value-objects/TagCode';
import type {
  CanonicalActivity,
  CommunityId,
  ConnectorSnapshot,
  ConnectorWarning,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

type GoldenCaseExpectation = {
  archetypeIn: ArchetypeCode[];
  mustHaveSignals?: SignalCode[];
  mustHaveTags?: TagCode[];
  mustNotHaveTags?: TagCode[];
  minConfidence?: number;
  maxConfidence?: number;
  minEvidence?: number;
  maxEvidence?: number;
  degraded?: boolean;
  crossCommunity?: boolean;
};

export type GoldenCase = {
  name:
    | 'discussion-heavy-single-community'
    | 'topic-led-output-heavy-single-community'
    | 'low-data-insufficient'
    | 'long-form-substantive'
    | 'cross-community-balanced'
    | 'degraded-source-partial-result';
  purpose: string;
  input: AnalyzePortraitInput;
  expectations: GoldenCaseExpectation;
};

type ActivitySeed = {
  id: string;
  community: CommunityId;
  handle: string;
  type: 'topic' | 'reply';
  dayOffset: number;
  hourOffset?: number;
  text: string;
  topicTitle: string;
  nodeName?: string;
  route: string;
  warningSuffix?: string;
};

type SnapshotSeed = {
  community: CommunityId;
  handle: string;
  activities: CanonicalActivity[];
  degraded?: boolean;
  warnings?: ConnectorWarning[];
};

const BASE_TIME = Date.parse('2026-03-01T00:00:00.000Z');

function at(dayOffset: number, hourOffset = 0): string {
  return new Date(BASE_TIME + (dayOffset * 24 + hourOffset) * 60 * 60 * 1000).toISOString();
}

function shortText(label: string): string {
  return `${label} ok.`;
}

function substantiveText(label: string): string {
  return `${label} with enough detail to remain analyzable in the current portrait engine.`;
}

function longFormText(label: string, includeLink = false): string {
  const core = `${label} ${'long-form analysis '.repeat(14).trim()}.`;

  return includeLink ? `${core} Reference: https://example.com/${label.replace(/\s+/g, '-')}` : core;
}

function makeActivity(seed: ActivitySeed): CanonicalActivity {
  const publishedAt = at(seed.dayOffset, seed.hourOffset ?? 0);

  return {
    id: seed.id,
    community: seed.community,
    handle: seed.handle,
    type: seed.type,
    url: `https://example.com/${seed.community}/${seed.id}`,
    topicId: seed.id,
    topicTitle: seed.topicTitle,
    nodeName: seed.nodeName,
    contentText: seed.text,
    excerpt: seed.text,
    publishedAt,
    sourceTrace: {
      route: seed.route,
      fetchedAt: at(seed.dayOffset, (seed.hourOffset ?? 0) + 1),
      contentHash: `hash-${seed.id}`,
    },
  };
}

function makeSnapshot(seed: SnapshotSeed): ConnectorSnapshot {
  return {
    ref: {
      community: seed.community,
      handle: seed.handle,
    },
    profile: {
      community: seed.community,
      handle: seed.handle,
      displayName: seed.handle,
      stats: {},
    },
    activities: seed.activities,
    diagnostics: {
      fetchedPages: Math.max(seed.activities.length > 0 ? 2 : 1, 1),
      fetchedItems: seed.activities.length,
      elapsedMs: 1200,
      degraded: seed.degraded ?? false,
      usedRoutes: [`/${seed.community}/profile`, `/${seed.community}/activities`],
    },
    warnings: seed.warnings ?? [],
  };
}

function buildAnalyzePortraitInput(seeds: SnapshotSeed[]): AnalyzePortraitInput {
  const snapshots = seeds.map(makeSnapshot);

  return {
    identityCluster: {
      accounts: snapshots.map((snapshot) => snapshot.ref),
      mergeSuggestions: [],
    },
    snapshots,
    activityStream: new BuildCanonicalActivityStream().execute(snapshots),
  };
}

function discussionHeavyCase(): GoldenCase {
  const handle = 'discussor';
  const activities = [
    makeActivity({
      id: 'dh-r1',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 0,
      hourOffset: 8,
      text: substantiveText('Architecture reply one'),
      topicTitle: 'Architecture reply one',
      nodeName: 'architecture',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-r2',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 0,
      hourOffset: 10,
      text: substantiveText('Architecture reply two'),
      topicTitle: 'Architecture reply two',
      nodeName: 'architecture',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-r3',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 1,
      hourOffset: 8,
      text: substantiveText('Troubleshooting reply three'),
      topicTitle: 'Troubleshooting reply three',
      nodeName: 'qna',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-r4',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 1,
      hourOffset: 11,
      text: substantiveText('Troubleshooting reply four'),
      topicTitle: 'Troubleshooting reply four',
      nodeName: 'qna',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-r5',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 2,
      hourOffset: 9,
      text: substantiveText('Community reply five'),
      topicTitle: 'Community reply five',
      nodeName: 'general',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-r6',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 3,
      hourOffset: 9,
      text: shortText('Reply six'),
      topicTitle: 'Reply six',
      nodeName: 'general',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-r7',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 4,
      hourOffset: 9,
      text: shortText('Reply seven'),
      topicTitle: 'Reply seven',
      nodeName: 'general',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'dh-t1',
      community: 'v2ex',
      handle,
      type: 'topic',
      dayOffset: 0,
      hourOffset: 14,
      text: shortText('Topic one'),
      topicTitle: 'Topic one',
      nodeName: 'architecture',
      route: '/member/:username/topics',
    }),
    makeActivity({
      id: 'dh-t2',
      community: 'v2ex',
      handle,
      type: 'topic',
      dayOffset: 2,
      hourOffset: 14,
      text: shortText('Topic two'),
      topicTitle: 'Topic two',
      nodeName: 'general',
      route: '/member/:username/topics',
    }),
    makeActivity({
      id: 'dh-t3',
      community: 'v2ex',
      handle,
      type: 'topic',
      dayOffset: 4,
      hourOffset: 14,
      text: shortText('Topic three'),
      topicTitle: 'Topic three',
      nodeName: 'general',
      route: '/member/:username/topics',
    }),
  ];

  return {
    name: 'discussion-heavy-single-community',
    purpose: 'Reply-heavy单社区样本，用于验证discussion-heavy方向画像。',
    input: buildAnalyzePortraitInput([
      {
        community: 'v2ex',
        handle,
        activities,
      },
    ]),
    expectations: {
      archetypeIn: ['DISCUSSION_ORIENTED'],
      mustHaveSignals: ['DISCUSSION_HEAVY'],
      mustHaveTags: ['DISCUSSION_HEAVY'],
      mustNotHaveTags: ['LOW_DATA'],
      minConfidence: 0.45,
      maxConfidence: 0.9,
      minEvidence: 3,
      maxEvidence: 5,
      crossCommunity: false,
      degraded: false,
    },
  };
}

function topicLedOutputHeavyCase(): GoldenCase {
  const handle = 'publisher';
  const activities: CanonicalActivity[] = [];

  for (let index = 0; index < 15; index += 1) {
    activities.push(
      makeActivity({
        id: `to-topic-${index}`,
        community: 'v2ex',
        handle,
        type: 'topic',
        dayOffset: index % 6,
        hourOffset: index,
        text: longFormText(`Topic output ${index}`, index % 2 === 0),
        topicTitle: `Topic output ${index}`,
        nodeName: index % 2 === 0 ? 'knowledge' : 'notes',
        route: '/member/:username/topics',
      }),
    );
  }

  for (let index = 0; index < 7; index += 1) {
    activities.push(
      makeActivity({
        id: `to-reply-${index}`,
        community: 'v2ex',
        handle,
        type: 'reply',
        dayOffset: index % 5,
        hourOffset: 12 + index,
        text: substantiveText(`Reply support ${index}`),
        topicTitle: `Reply support ${index}`,
        nodeName: 'knowledge',
        route: '/member/:username/replies',
      }),
    );
  }

  return {
    name: 'topic-led-output-heavy-single-community',
    purpose: 'Topic-led且输出量较高的单社区样本，用于验证output-oriented方向画像。',
    input: buildAnalyzePortraitInput([
      {
        community: 'v2ex',
        handle,
        activities,
      },
    ]),
    expectations: {
      archetypeIn: ['INFORMATION_CURATOR', 'TOPIC_ORIENTED'],
      mustHaveSignals: ['TOPIC_LED', 'HIGH_OUTPUT'],
      mustHaveTags: ['TOPIC_LED', 'HIGH_OUTPUT'],
      mustNotHaveTags: ['LOW_DATA'],
      minConfidence: 0.65,
      maxConfidence: 1,
      minEvidence: 4,
      maxEvidence: 5,
      crossCommunity: false,
      degraded: false,
    },
  };
}

function lowDataCase(): GoldenCase {
  const handle = 'sparse-user';
  const activities = [
    makeActivity({
      id: 'ld-1',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 0,
      text: shortText('tiny one'),
      topicTitle: 'tiny one',
      nodeName: 'general',
      route: '/member/:username/replies',
    }),
    makeActivity({
      id: 'ld-2',
      community: 'v2ex',
      handle,
      type: 'topic',
      dayOffset: 0,
      hourOffset: 2,
      text: shortText('tiny two'),
      topicTitle: 'tiny two',
      nodeName: 'general',
      route: '/member/:username/topics',
    }),
    makeActivity({
      id: 'ld-3',
      community: 'v2ex',
      handle,
      type: 'reply',
      dayOffset: 1,
      text: shortText('tiny three'),
      topicTitle: 'tiny three',
      nodeName: 'general',
      route: '/member/:username/replies',
    }),
  ];

  return {
    name: 'low-data-insufficient',
    purpose: '低样本、低文本密度样本，用于验证insufficient-data兜底。',
    input: buildAnalyzePortraitInput([
      {
        community: 'v2ex',
        handle,
        activities,
      },
    ]),
    expectations: {
      archetypeIn: ['INSUFFICIENT_DATA'],
      mustHaveSignals: ['LOW_DATA'],
      mustHaveTags: ['LOW_DATA'],
      minConfidence: 0,
      maxConfidence: 0.45,
      minEvidence: 1,
      maxEvidence: 3,
      crossCommunity: false,
      degraded: false,
    },
  };
}

function longFormCase(): GoldenCase {
  const handle = 'essayist';
  const activities: CanonicalActivity[] = [];

  for (let index = 0; index < 10; index += 1) {
    activities.push(
      makeActivity({
        id: `lf-${index}`,
        community: 'v2ex',
        handle,
        type: index % 2 === 0 ? 'topic' : 'reply',
        dayOffset: index,
        text: longFormText(`Long form piece ${index}`),
        topicTitle: `Long form piece ${index}`,
        nodeName: index % 2 === 0 ? 'writing' : 'discussion',
        route: index % 2 === 0 ? '/member/:username/topics' : '/member/:username/replies',
      }),
    );
  }

  return {
    name: 'long-form-substantive',
    purpose: '长文本、高正文密度样本，用于验证LONG_FORM与证据选择。',
    input: buildAnalyzePortraitInput([
      {
        community: 'v2ex',
        handle,
        activities,
      },
    ]),
    expectations: {
      archetypeIn: ['COMMUNITY_PARTICIPANT', 'INFORMATION_CURATOR', 'TOPIC_ORIENTED'],
      mustHaveSignals: ['LONG_FORM'],
      mustHaveTags: ['LONG_FORM'],
      mustNotHaveTags: ['LOW_DATA'],
      minConfidence: 0.65,
      maxConfidence: 1,
      minEvidence: 3,
      maxEvidence: 5,
      crossCommunity: false,
      degraded: false,
    },
  };
}

function crossCommunityCase(): GoldenCase {
  const alpha = 'alpha';
  const beta = 'beta';
  const v2exActivities: CanonicalActivity[] = [];
  const guozaokeActivities: CanonicalActivity[] = [];

  for (let index = 0; index < 6; index += 1) {
    v2exActivities.push(
      makeActivity({
        id: `cc-v-${index}`,
        community: 'v2ex',
        handle: alpha,
        type: index < 4 ? 'reply' : 'topic',
        dayOffset: index,
        text:
          index < 3
            ? longFormText(`V2EX activity ${index}`, index % 2 === 0)
            : substantiveText(`V2EX activity ${index}`),
        topicTitle: `V2EX activity ${index}`,
        nodeName: index < 4 ? 'architecture' : 'notes',
        route: index < 4 ? '/member/:username/replies' : '/member/:username/topics',
      }),
    );
    guozaokeActivities.push(
      makeActivity({
        id: `cc-g-${index}`,
        community: 'guozaoke',
        handle: beta,
        type: index < 4 ? 'topic' : 'reply',
        dayOffset: index,
        hourOffset: 12,
        text: longFormText(`Guozaoke activity ${index}`, index % 2 === 0),
        topicTitle: `Guozaoke activity ${index}`,
        nodeName: index < 4 ? 'you-wen-wo-da' : 'xin-qing',
        route: index < 4 ? '/u/:id/topics' : '/u/:id/replies',
      }),
    );
  }

  return {
    name: 'cross-community-balanced',
    purpose: '双社区样本，用于验证cross-community信号与community synthesis。',
    input: buildAnalyzePortraitInput([
      {
        community: 'v2ex',
        handle: alpha,
        activities: v2exActivities,
      },
      {
        community: 'guozaoke',
        handle: beta,
        activities: guozaokeActivities,
      },
    ]),
    expectations: {
      archetypeIn: ['COMMUNITY_PARTICIPANT', 'DISCUSSION_ORIENTED', 'TOPIC_ORIENTED', 'INFORMATION_CURATOR'],
      mustHaveSignals: ['CROSS_COMMUNITY'],
      mustHaveTags: ['CROSS_COMMUNITY'],
      mustNotHaveTags: ['LOW_DATA'],
      minConfidence: 0.6,
      maxConfidence: 1,
      minEvidence: 4,
      maxEvidence: 5,
      crossCommunity: true,
      degraded: false,
    },
  };
}

function degradedCase(): GoldenCase {
  const handle = 'partial-user';
  const activities = [
    makeActivity({
      id: 'dg-1',
      community: 'guozaoke',
      handle,
      type: 'reply',
      dayOffset: 0,
      text: substantiveText('Recovered reply one'),
      topicTitle: 'Recovered reply one',
      nodeName: 'you-wen-wo-da',
      route: '/u/:id/replies',
    }),
    makeActivity({
      id: 'dg-2',
      community: 'guozaoke',
      handle,
      type: 'reply',
      dayOffset: 1,
      text: substantiveText('Recovered reply two'),
      topicTitle: 'Recovered reply two',
      nodeName: 'you-wen-wo-da',
      route: '/u/:id/replies',
    }),
    makeActivity({
      id: 'dg-3',
      community: 'guozaoke',
      handle,
      type: 'topic',
      dayOffset: 2,
      text: longFormText('Recovered topic three'),
      topicTitle: 'Recovered topic three',
      nodeName: 'xin-qing',
      route: '/u/:id/topics',
    }),
    makeActivity({
      id: 'dg-4',
      community: 'guozaoke',
      handle,
      type: 'topic',
      dayOffset: 3,
      text: substantiveText('Recovered topic four'),
      topicTitle: 'Recovered topic four',
      nodeName: 'xin-qing',
      route: '/u/:id/topics',
    }),
    makeActivity({
      id: 'dg-5',
      community: 'guozaoke',
      handle,
      type: 'reply',
      dayOffset: 4,
      text: substantiveText('Recovered reply five'),
      topicTitle: 'Recovered reply five',
      nodeName: 'you-wen-wo-da',
      route: '/u/:id/replies',
    }),
    makeActivity({
      id: 'dg-6',
      community: 'guozaoke',
      handle,
      type: 'topic',
      dayOffset: 5,
      text: substantiveText('Recovered topic six'),
      topicTitle: 'Recovered topic six',
      nodeName: 'xin-qing',
      route: '/u/:id/topics',
    }),
    makeActivity({
      id: 'dg-7',
      community: 'guozaoke',
      handle,
      type: 'reply',
      dayOffset: 6,
      text: substantiveText('Recovered reply seven'),
      topicTitle: 'Recovered reply seven',
      nodeName: 'you-wen-wo-da',
      route: '/u/:id/replies',
    }),
    makeActivity({
      id: 'dg-8',
      community: 'guozaoke',
      handle,
      type: 'topic',
      dayOffset: 7,
      text: substantiveText('Recovered topic eight'),
      topicTitle: 'Recovered topic eight',
      nodeName: 'xin-qing',
      route: '/u/:id/topics',
    }),
  ];

  return {
    name: 'degraded-source-partial-result',
    purpose: '来源降级样本，用于验证confidence下调、summary收敛与warnings透传。',
    input: buildAnalyzePortraitInput([
      {
        community: 'guozaoke',
        handle,
        activities,
        degraded: true,
        warnings: [
          {
            code: 'PARTIAL_RESULT',
            message: 'Replies were partially available during this request.',
          },
        ],
      },
    ]),
    expectations: {
      archetypeIn: ['INSUFFICIENT_DATA', 'COMMUNITY_PARTICIPANT', 'DISCUSSION_ORIENTED', 'TOPIC_ORIENTED', 'INFORMATION_CURATOR'],
      mustHaveTags: ['LOW_DATA'],
      minConfidence: 0.2,
      maxConfidence: 0.75,
      minEvidence: 2,
      maxEvidence: 5,
      crossCommunity: false,
      degraded: true,
    },
  };
}

export const GOLDEN_CASES: GoldenCase[] = [
  discussionHeavyCase(),
  topicLedOutputHeavyCase(),
  lowDataCase(),
  longFormCase(),
  crossCommunityCase(),
  degradedCase(),
];

export function getGoldenCase(name: GoldenCase['name']): GoldenCase {
  const found = GOLDEN_CASES.find((item) => item.name === name);

  if (!found) {
    throw new Error(`Unknown golden case: ${name}`);
  }

  return found;
}
