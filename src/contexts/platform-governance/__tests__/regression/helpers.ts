import type {
  AcquisitionContext,
  ConnectorProbeResult,
  ExternalAccountRef,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';
import type { ConnectorRegistry } from '@/src/contexts/source-acquisition/domain/contracts/ConnectorRegistry';
import {
  createAnalyzeRequestComplexitySnapshot,
  createSuggestRequestComplexitySnapshot,
} from '@/src/contexts/platform-governance/application/dto/RequestComplexitySnapshot';
import {
  createFeatureSwitchSnapshot,
  type FeatureSwitchSnapshot,
} from '@/src/contexts/platform-governance/domain/entities/FeatureSwitchSnapshot';
import {
  createIncidentState,
  type IncidentState,
} from '@/src/contexts/platform-governance/domain/entities/IncidentState';
import type { FeatureSwitchProvider } from '@/src/contexts/platform-governance/domain/services/FeatureSwitchProvider';
import { requestGovernancePolicy } from '@/src/contexts/platform-governance/domain/services/RequestGovernancePolicy';
import { featureSwitchKeyValues, type FeatureSwitchKey } from '@/src/contexts/platform-governance/domain/value-objects/FeatureSwitchKey';
import type { ReleaseSafetyMode } from '@/src/contexts/platform-governance/domain/value-objects/ReleaseSafetyMode';

export const GOVERNANCE_TEST_TIMESTAMP = '2026-03-23T10:00:00.000Z';

export function createBaselineAnalyzeSnapshot(
  overrides: Partial<Parameters<typeof createAnalyzeRequestComplexitySnapshot>[0]> = {},
) {
  return createAnalyzeRequestComplexitySnapshot({
    requestBodyBytes: 256,
    requestedAt: GOVERNANCE_TEST_TIMESTAMP,
    requesterFingerprint: 'fp-analyze-baseline',
    governanceMode: requestGovernancePolicy.mode,
    accounts: [{ community: 'v2ex' }],
    llmProvider: 'none',
    ...overrides,
  });
}

export function createBaselineSuggestSnapshot(
  overrides: Partial<Parameters<typeof createSuggestRequestComplexitySnapshot>[0]> = {},
) {
  return createSuggestRequestComplexitySnapshot({
    requestBodyBytes: 256,
    requestedAt: GOVERNANCE_TEST_TIMESTAMP,
    requesterFingerprint: 'fp-suggest-baseline',
    governanceMode: requestGovernancePolicy.mode,
    accounts: [
      { community: 'v2ex' },
      { community: 'guozaoke' },
    ],
    ...overrides,
  });
}

export function createSwitchSnapshots(
  overrides: Partial<Record<FeatureSwitchKey, boolean>> = {},
): FeatureSwitchSnapshot[] {
  return [...featureSwitchKeyValues]
    .map((key) =>
      createFeatureSwitchSnapshot({
        key,
        enabled: overrides[key] ?? true,
        source: 'provider',
      }),
    )
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function createInactiveIncident(): IncidentState {
  return createIncidentState({
    active: false,
    severity: 'INFO',
    mode: 'NORMAL',
    reason: 'none',
    activeSwitches: [],
  });
}

export class FakeSwitchProvider implements FeatureSwitchProvider {
  constructor(
    private readonly snapshots: FeatureSwitchSnapshot[],
    private readonly mode: ReleaseSafetyMode = 'NORMAL',
    private readonly incident: IncidentState = createInactiveIncident(),
  ) {}

  isEnabled(key: FeatureSwitchKey): boolean {
    return this.snapshots.find((item) => item.key === key)?.enabled ?? false;
  }

  snapshot(): FeatureSwitchSnapshot[] {
    return [...this.snapshots];
  }

  getSafetyMode(): ReleaseSafetyMode {
    return this.mode;
  }

  getIncidentState(): IncidentState {
    return this.incident;
  }
}

export class FakeConnector implements CommunityConnector {
  readonly mode = 'public' as const;
  readonly capabilities = {
    publicProfile: true,
    publicTopics: false,
    publicReplies: false,
    requiresAuth: false,
    supportsPagination: false,
    supportsCrossCommunityHints: false,
  };

  constructor(
    readonly community: 'v2ex' | 'guozaoke',
    private readonly probeImpl: (
      ref: ExternalAccountRef,
      ctx: AcquisitionContext,
    ) => Promise<ConnectorProbeResult>,
  ) {}

  async probe(ref: ExternalAccountRef, ctx: AcquisitionContext): Promise<ConnectorProbeResult> {
    return this.probeImpl(ref, ctx);
  }

  async fetchSnapshot() {
    return {
      ref: { community: this.community, handle: 'probe-user' },
      profile: null,
      activities: [],
      diagnostics: {
        fetchedPages: 0,
        fetchedItems: 0,
        elapsedMs: 0,
        degraded: true,
        usedRoutes: [],
      },
      warnings: [],
    };
  }
}

export class FakeConnectorRegistry implements ConnectorRegistry {
  constructor(private readonly connectors: CommunityConnector[]) {}

  get(community: 'v2ex' | 'guozaoke' | 'weibo'): CommunityConnector {
    const connector = this.connectors.find((item) => item.community === community);

    if (!connector) {
      throw new Error(`Unknown connector: ${community}`);
    }

    return connector;
  }

  list(): CommunityConnector[] {
    return [...this.connectors];
  }
}
