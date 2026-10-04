import { defineConfig } from 'vitest/config';
import phase1 from './vitest.phase1.config';

export default defineConfig({ ...phase1, test: { ...phase1.test, setupFiles: ['reports/RD-40/phase2-source-proof.ts'] } });
