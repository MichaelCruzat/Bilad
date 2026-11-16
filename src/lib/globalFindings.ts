type Estimate = {perDecade: number | null; low: number | null; high: number | null; p: number | null; n: number};

/** Descriptive summaries generated from the same footprint/series as Explore. */
export type GlobalFindings = {
  window: [number, number];
  variables: Record<string, {
    allLand: {claim: Estimate; witness: Estimate; intervalsOverlap: boolean | null; ratio: number | null};
  }>;
};

export async function loadGlobalFindings(): Promise<GlobalFindings> {
  const response = await fetch(`${import.meta.env.BASE_URL ?? './'}data/global/findings.json`);
  if (!response.ok) throw new Error(`Global comparison: HTTP ${response.status}`);
  return response.json() as Promise<GlobalFindings>;
}
