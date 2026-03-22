import { env } from '@/src/config/env';
import { NARRATIVE_GATEWAY_POLICY } from '@/src/contexts/report-composition/infrastructure/narrative/NarrativeGatewayPolicy';

export type NarrativeProviderName = 'none' | 'minimax';

export type NarrativeGatewayConfig = {
  provider: NarrativeProviderName;
  timeoutMs: number;
  minimax: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    isConfigured: boolean;
  };
};

export type NarrativeGatewayEnvSource = {
  NARRATIVE_PROVIDER?: string;
  NARRATIVE_TIMEOUT_MS?: number;
  MINIMAX_API_KEY?: string;
  MINIMAX_BASE_URL?: string;
  MINIMAX_MODEL?: string;
};

function normalizeProvider(value?: string): NarrativeProviderName {
  return value === 'minimax' ? 'minimax' : 'none';
}

function normalizeTimeout(value?: number): number {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return NARRATIVE_GATEWAY_POLICY.defaultTimeoutMs;
  }

  return Math.round(value);
}

export function readNarrativeGatewayConfig(
  source: NarrativeGatewayEnvSource = env,
): NarrativeGatewayConfig {
  const provider = normalizeProvider(source.NARRATIVE_PROVIDER);
  const timeoutMs = normalizeTimeout(source.NARRATIVE_TIMEOUT_MS);
  const apiKey = source.MINIMAX_API_KEY?.trim() || undefined;
  const baseUrl = source.MINIMAX_BASE_URL?.trim() || undefined;
  const model = source.MINIMAX_MODEL?.trim() || undefined;

  return {
    provider,
    timeoutMs,
    minimax: {
      apiKey,
      baseUrl,
      model,
      isConfigured: Boolean(apiKey && baseUrl && model),
    },
  };
}

