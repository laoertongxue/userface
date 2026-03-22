import type {
  AcquisitionContext,
  CommunityId,
  ConnectorCapabilities,
  ConnectorMode,
  ConnectorProbeResult,
  ConnectorSnapshot,
  ExternalAccountRef,
  FetchSnapshotInput,
} from '@/src/contexts/source-acquisition/domain/contracts/AcquisitionPorts';

export interface CommunityConnector {
  readonly community: CommunityId;
  readonly mode: ConnectorMode;
  readonly capabilities: ConnectorCapabilities;

  probe(ref: ExternalAccountRef, ctx: AcquisitionContext): Promise<ConnectorProbeResult>;

  fetchSnapshot(
    input: FetchSnapshotInput,
    ctx: AcquisitionContext,
  ): Promise<ConnectorSnapshot>;
}
