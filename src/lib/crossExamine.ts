/**
 * The cross-examination of a reanalysis series against an independent
 * witness. Kept free of browser-only imports so build scripts can reuse it.
 */
import {agreement, stepScreen, trendTest, type Agreement, type StepScreen, type TrendTest} from './stats';

export type CrossExamination = {
  claim: TrendTest;
  witness: TrendTest;
  verdict: Agreement;
  claimStep: StepScreen | null;
  witnessStep: StepScreen | null;
  /** Reanalysis looks like a jump while the witness does not, or they disagree outright. */
  artifactSuspected: boolean;
};

export function crossExamine(years: number[], claimSeries: ArrayLike<number>, witness: ArrayLike<number>): CrossExamination {
  const claim = trendTest(years, claimSeries);
  const w = trendTest(years, witness);
  const verdict = agreement(claim, w);
  const claimStep = stepScreen(years, claimSeries);
  const witnessStep = stepScreen(years, witness);
  const artifactSuspected =
    verdict === 'contradicted' || Boolean(claimStep?.stepDominated && !witnessStep?.stepDominated && verdict !== 'corroborated');
  return {claim, witness: w, verdict, claimStep, witnessStep, artifactSuspected};
}
