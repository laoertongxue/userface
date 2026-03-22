import type {
  AcquisitionContext,
  ConnectorDiagnostics,
  ConnectorSnapshot,
  ConnectorWarning,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';
import type { CommunityConnector } from '@/src/contexts/source-acquisition/domain/contracts/CommunityConnector';

function buildDiagnostics(elapsedMs: number, usedRoutes: string[], degraded = true): ConnectorDiagnostics {
  return {
    fetchedPages: 0,
    fetchedItems: 0,
    elapsedMs,
    degraded,
    usedRoutes,
  };
}

function buildSnapshot(
  ref: ExternalAccountRef,
  elapsedMs: number,
  usedRoutes: string[],
  warnings: ConnectorWarning[],
): ConnectorSnapshot {
  return {
    ref,
    profile: null,
    activities: [],
    diagnostics: buildDiagnostics(elapsedMs, usedRoutes, true),
    warnings,
  };
}

export abstract class StubCommunityConnector implements CommunityConnector {
  abstract readonly community: CommunityConnector['community'];
  abstract readonly mode: CommunityConnector['mode'];
  abstract readonly capabilities: CommunityConnector['capabilities'];

  protected buildPlaceholderWarning(message: string): ConnectorWarning {
    return {
      code: 'UNSUPPORTED',
      message,
    };
  }

  async probe(ref: ExternalAccountRef): Promise<{
    ok: boolean;
    community: CommunityConnector['community'];
    ref: ExternalAccountRef;
    warnings: ConnectorWarning[];
  }> {
    return {
      ok: false,
      community: this.community,
      ref,
      warnings: [
        this.buildPlaceholderWarning(
          `${this.community} connector scaffold exists, but live acquisition is not implemented yet.`,
        ),
      ],
    };
  }

  async fetchSnapshot(
    input: FetchSnapshotInput,
    _ctx: AcquisitionContext,
  ): Promise<ConnectorSnapshot> {
    const startedAt = Date.now();
    const warnings = [
      this.buildPlaceholderWarning(
        `${this.community} connector scaffold exists, but live acquisition is not implemented yet.`,
      ),
    ];

    return buildSnapshot(input.ref, Date.now() - startedAt, [], warnings);
  }
}
