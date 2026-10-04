import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

// Separate diagnosis only. Does not edit/relabel the original16 or use a fallback.
const entry = '/src/experiments/babylon/index.html';
for (const mode of ['C3', 'C4']) {
  test(`DIAG-V1 ${mode} exact facts DOM/reader and original locator capture diagnosis via visible home link`, async ({ page, browser }, info) => {
    const requests: string[] = []; const errors: string[] = []; const consoleMessages: unknown[] = [];
    page.on('request', (request) => requests.push(request.url())); page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
    await page.goto('/'); expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
    await page.getByRole('link', { name: 'RD12 Babylon fixture renderer · C3 WebGL2 / C4 WebGPU' }).click();
    await expect(page).toHaveURL(new RegExp(entry.replaceAll('.', '\\.'))); expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
    await page.locator('#preset').selectOption(mode); await page.locator('#scenario').selectOption('F04-DETACH-REPLAY'); await page.locator('#mount').click();
    await expect(page.locator('#status')).toContainText(/SUBMITTED|FAILED|TERMINAL/, { timeout: 35_000 });
    const innerText = await page.locator('#facts').innerText(); const textContent = await page.locator('#facts').textContent();
    const facts = JSON.parse(textContent!); const dom = await page.locator('#facts').evaluate((element) => ({
      detailsOpen: element.closest('details')?.open, clientRects: element.getClientRects().length, textContentLength: element.textContent?.length,
      innerTextLength: (element as HTMLElement).innerText.length, hiddenByCollapsedDetails: element.closest('details')?.open === false,
    }));
    const canvas = await page.locator('#view').evaluate((element) => { const canvas = element as HTMLCanvasElement; const rect = canvas.getBoundingClientRect();
      const gl = canvas.getContext('webgl2'); const extension = gl?.getExtension('WEBGL_debug_renderer_info');
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bufferWidth: canvas.width, bufferHeight: canvas.height,
        glVersion: gl?.getParameter(gl.VERSION) ?? null, glRenderer: extension ? gl?.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null }; });
    const defaultAdapter = await page.evaluate(async () => { const gpu = (navigator as any).gpu; if (!gpu) { return { status: 'UNAVAILABLE' }; }
      const adapter = await gpu.requestAdapter(); if (!adapter) { return { status: 'UNAVAILABLE' }; } const a = adapter.info;
      return { status: 'OBSERVED_DEFAULT_NOT_ATTESTED_APP_IDENTITY', vendor: a?.vendor ?? null, architecture: a?.architecture ?? null, device: a?.device ?? null,
        description: a?.description ?? null, isFallbackAdapter: a?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? null }; });
    const session = await browser.newBrowserCDPSession(); const browserGpu = await session.send('SystemInfo.getInfo'); await session.detach();
    const body = { version: 'rd12-native-reader-diagnosis-v1', mode, innerText, textContent, dom, facts, canvas, defaultAdapter, browserGpu,
      requests, errors, consoleMessages, originalFailure: 'SyntaxError at browser.spec.ts:16 observed(innerText)', productIntegrated: false };
    await info.attach(`${mode}-reader-diagnosis.json`, { body: Buffer.from(JSON.stringify(body, null, 2)), contentType: 'application/json' });
    expect(dom.hiddenByCollapsedDetails).toBe(true); expect(innerText).toBe(''); expect(facts.productIntegrated).toBe(false);
    expect(facts.diagnostic?.backend.actual).toBe(mode === 'C3' ? 'webgl2' : 'webgpu'); expect(facts.diagnostic?.rendered).not.toBeNull();
    const before = JSON.parse((await page.locator('#facts').textContent())!); let image: Buffer | undefined; let captureError: string | null = null;
    try { image = await page.locator('#view').screenshot({ timeout: 15_000 }); }
    catch (error) { captureError = String(error); }
    const after = JSON.parse((await page.locator('#facts').textContent())!);
    if (image) { await info.attach(`${mode}-original-locator-diagnostic.png`, { body: image, contentType: 'image/png' }); }
    await info.attach(`${mode}-capture-diagnosis.json`, { body: Buffer.from(JSON.stringify({ version: 'original-locator-api-diagnostic-v1', canvas, captureError, before, after,
      screenshotSha256: image ? createHash('sha256').update(image).digest('hex') : null, productIntegrated: false }, null, 2)), contentType: 'application/json' });
    expect(after.diagnostic.rendered).toEqual(before.diagnostic.rendered); expect(captureError).toBeNull();
    expect(requests.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]); expect(requests.filter((url) => /glslang|twgsl|cdn|\.wasm(?:\?|$)/i.test(url))).toEqual([]); expect(errors).toEqual([]);
    await page.locator('#dispose').click(); await expect(page.locator('#status')).toContainText('DISPOSED');
  });
}
test('DIAG-V1 gallery visible RD12 link; gallery still only C0/C1/C2, normal bridge absent', async ({ page }, info) => {
  await page.goto('/'); await page.getByRole('link', { name: 'RD40 variant gallery' }).click();
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
  const options = await page.locator('select option').allTextContents(); await info.attach('gallery-options.json', { body: Buffer.from(JSON.stringify({ options, productIntegrated: false })), contentType: 'application/json' });
  expect(options.some((text) => /C3|C4/.test(text))).toBe(false);
  await page.getByRole('link', { name: /RD12 Babylon/ }).click(); await expect(page).toHaveURL(new RegExp(entry.replaceAll('.', '\\.')));
  expect(await page.evaluate(() => 'TestBridge' in window)).toBe(false);
});
