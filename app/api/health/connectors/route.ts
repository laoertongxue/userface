import { NextResponse } from 'next/server';
import { StaticConnectorRegistry } from '@/src/contexts/source-acquisition/infrastructure/connectors/registry';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET() {
  const connectorRegistry = new StaticConnectorRegistry();

  return NextResponse.json({
    connectors: connectorRegistry.list().map((connector) => ({
      community: connector.community,
      mode: connector.mode,
      capabilities: connector.capabilities,
      implementation: 'scaffolded',
    })),
  });
}
