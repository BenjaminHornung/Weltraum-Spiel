// RD12 v1, independent of the frozen (known insensitive) RD11 32-pixel oracle.
// Native qualification requires full-resolution scene signal AND deliberate
// omission/depth-fault rejection on the same owning camera/ROI before parity.
export const VISUAL_ORACLE_V1 = Object.freeze({
  version: 'rd12-material-depth-v1', minimumPixels: 4096, minimumReferenceContrast: 0.04,
  maximumMeanRgbError: 0.035, minimumFaultMeanRgbError: 0.01,
  regions: [
    { id: 'F01-scene-baked-colors', scenario: 'F01-HVP-COAST-REPLAY', camera: 'C01-EYE', rect: [0.05, 0.12, 0.90, 0.80], fault: 'omit-vertex-colors' },
    { id: 'F06-material-depth-scene', scenario: 'F06-MATERIAL-REPLAY', camera: 'fixture-first-camera', rect: [0.05, 0.05, 0.90, 0.90], fault: 'disable-depth-test' },
  ],
});
export function compareSceneRoi(reference: readonly number[], candidate: readonly number[]) {
  if (reference.length !== candidate.length || reference.length % 4 !== 0 || reference.length / 4 < VISUAL_ORACLE_V1.minimumPixels) { throw new Error('ROI insufficient/mismatched native pixels'); }
  let error = 0; let sum = 0; let squares = 0;
  for (let pixel = 0; pixel < reference.length; pixel += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const a = reference[pixel + channel] / 255; const b = candidate[pixel + channel] / 255;
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || a > 1 || b < 0 || b > 1) { throw new Error('Invalid ROI channel'); }
      error += Math.abs(a - b); sum += a; squares += a * a;
    }
  }
  const n = reference.length / 4 * 3; const contrast = Math.sqrt(Math.max(0, squares / n - (sum / n) ** 2));
  if (contrast < VISUAL_ORACLE_V1.minimumReferenceContrast) { throw new Error('ROI lacks meaningful scene signal'); }
  return { meanRgbError: error / n, referenceContrast: contrast, pixels: reference.length / 4 };
}
export function requireQualifiedParity(reference: readonly number[], candidate: readonly number[], deliberateFault: readonly number[]) {
  const positive = compareSceneRoi(reference, candidate); const negative = compareSceneRoi(reference, deliberateFault);
  if (negative.meanRgbError < VISUAL_ORACLE_V1.minimumFaultMeanRgbError) { throw new Error('FALSE-GREEN: owning material/depth fault not detected; ROI unqualified'); }
  if (positive.meanRgbError > VISUAL_ORACLE_V1.maximumMeanRgbError) { throw new Error('Stock-material parity rejected'); }
  return { positive, negative, version: VISUAL_ORACLE_V1.version };
}
