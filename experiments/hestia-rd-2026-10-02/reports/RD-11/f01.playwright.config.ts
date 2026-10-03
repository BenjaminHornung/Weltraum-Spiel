import base from './playwright.config';
// Reuse the exact snapshot/output/backend admission; preserve the original nine-case oracle.
export default { ...base, testMatch: 'f01-phase2.spec.ts' };
