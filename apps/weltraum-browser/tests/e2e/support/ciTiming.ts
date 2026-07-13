export const isContinuousIntegration = process.env.CI === "true";

export function ciTimeout(localMilliseconds: number, ciMilliseconds: number): number {
  return isContinuousIntegration ? ciMilliseconds : localMilliseconds;
}
