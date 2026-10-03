/** Frozen before any run. These are functional image gates, not art acceptance. */
export const ROIS = Object.freeze([
  { id: 'geometry-depth', rect: [0.15, 0.20, 0.70, 0.70] as const },
  { id: 'coast-baked-ao', rect: [0.10, 0.35, 0.36, 0.50] as const },
  { id: 'water-material', rect: [0.50, 0.45, 0.40, 0.40] as const },
]);
export const ROI_THRESHOLDS = Object.freeze({ c0c1MeanRgbError: 0.06, c1c2MeanRgbError: 0.035, minimumReferenceSignal: 0.015, minimumContrastRatio: 0.70 });

export function compareRoi(reference: readonly number[], candidate: readonly number[], axis: 'C0-C1' | 'C1-C2') {
  if (reference.length !== candidate.length || reference.length < 12 || reference.length % 4 !== 0) { throw new Error('Invalid equal RGBA ROI samples'); }
  let error = 0; let referenceSum = 0; let candidateSum = 0; let referenceSquared = 0; let candidateSquared = 0;
  for (let index = 0; index < reference.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const r = reference[index + channel] / 255; const c = candidate[index + channel] / 255;
      if (![r, c].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) { throw new Error('Invalid ROI pixel'); }
      error += Math.abs(r - c);
    }
    const r = (reference[index] + reference[index + 1] + reference[index + 2]) / 765;
    const c = (candidate[index] + candidate[index + 1] + candidate[index + 2]) / 765;
    referenceSum += r; candidateSum += c; referenceSquared += r * r; candidateSquared += c * c;
  }
  const count = reference.length / 4; const meanRgbError = error / (count * 3);
  const referenceContrast = Math.sqrt(Math.max(0, referenceSquared / count - (referenceSum / count) ** 2));
  const candidateContrast = Math.sqrt(Math.max(0, candidateSquared / count - (candidateSum / count) ** 2));
  const threshold = axis === 'C0-C1' ? ROI_THRESHOLDS.c0c1MeanRgbError : ROI_THRESHOLDS.c1c2MeanRgbError;
  if (referenceContrast < ROI_THRESHOLDS.minimumReferenceSignal) { throw new Error('ROI lacks reference signal; NOT_RUN, never parity success'); }
  if (candidateContrast < referenceContrast * ROI_THRESHOLDS.minimumContrastRatio || meanRgbError > threshold) {
    throw new Error('ROI parity rejected: missing shader/AO/depth/material or full-color substitute');
  }
  return { meanRgbError, referenceContrast, candidateContrast, threshold };
}

export function requireNativeFeatures(unsupported: readonly string[], requested: readonly string[]) {
  if (requested.some((feature) => unsupported.includes(feature))) { throw new Error('UNSUPPORTED: native shader/shadow/AO parity cannot be replaced by full color'); }
}
