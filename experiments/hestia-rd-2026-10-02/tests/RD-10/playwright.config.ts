import { defineConfig } from '@playwright/test';
import rootConfig from '../../playwright.config';

if (process.env.HESTIA_RD_TASK !== 'RD-10') { throw new Error('Explicit own RD10 task required'); }
if (!['DEV', 'OPTIMIZED'].includes(process.env.HESTIA_RD10_BUILD_CLASS ?? '')) { throw new Error('Explicit build classification required'); }
export default defineConfig({ ...rootConfig, testDir: '.', testMatch: 'browser.spec.ts', timeout: 45_000 });
