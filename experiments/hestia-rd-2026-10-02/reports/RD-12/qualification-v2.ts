import { requireQualifiedParity, VISUAL_ORACLE_V1 } from './oracle';

// Explicit v2 qualification; v1 pixels/ROI/math/thresholds/history stay frozen.
export const QUALIFICATION_GATE_V2 = 'rd12-material-depth-qualification-v2';
export function requireQualifiedParityV2(reference: readonly number[], candidate: readonly number[], deliberateFault: readonly number[]) {
  const result = requireQualifiedParity(reference, candidate, deliberateFault);
  if (result.negative.meanRgbError <= VISUAL_ORACLE_V1.maximumMeanRgbError) { throw new Error('FALSE-GREEN: deliberate fault passes positive acceptance; ROI unqualified'); }
  return { ...result, version: QUALIFICATION_GATE_V2 };
}
