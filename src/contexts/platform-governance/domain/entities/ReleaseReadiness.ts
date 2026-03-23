export type ReleaseReadiness = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  checkedAt?: string;
  scope?: string;
};

export function createReleaseReadiness(input: ReleaseReadiness): ReleaseReadiness {
  const blockers = [...new Set(input.blockers.map((item) => item.trim()).filter(Boolean))];
  const warnings = [...new Set(input.warnings.map((item) => item.trim()).filter(Boolean))];

  return {
    ...input,
    ready: blockers.length > 0 ? false : input.ready,
    blockers,
    warnings,
    scope: input.scope?.trim() || undefined,
  };
}
