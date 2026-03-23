import type { ExternalAccountRef } from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { ProviderProbeTarget } from '@/src/contexts/platform-governance/application/dto/ProviderProbeInput';

type ConnectorProbeTarget = {
  community: ExternalAccountRef['community'];
  ref: ExternalAccountRef;
};

export const HEALTH_PROBE_POLICY = {
  connectorTimeoutMs: 4_000,
  providerTimeoutMs: 4_000,
  recommendedCronIntervalMinutes: 15,
  connectorTargets: [
    {
      community: 'v2ex',
      ref: {
        community: 'v2ex',
        handle: 'laoertongzhi',
      },
    },
    {
      community: 'guozaoke',
      ref: {
        community: 'guozaoke',
        handle: 'tipsy_love',
      },
    },
  ] as const satisfies readonly ConnectorProbeTarget[],
  providerTargets: ['disabled', 'rule-only', 'minimax'] as const satisfies readonly ProviderProbeTarget[],
} as const;
