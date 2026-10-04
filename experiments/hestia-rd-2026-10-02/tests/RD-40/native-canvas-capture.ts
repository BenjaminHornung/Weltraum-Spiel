import { expect, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import type { GalleryState } from '../../src/tools/variant-gallery/session';
import type { SourceBinding } from '../../src/tools/variant-gallery/source';

// A compositor-visible whole canvas, not a direct GPU-buffer read or a recoded PNG.
export async function nativeCanvasCapture(page: Page, info: TestInfo, name: string,
  head: { sourceCommit: string; sourceTree: string; buildDigest: string }): Promise<Buffer> {
  const read = async () => {
    const text = await page.locator('#facts').textContent(); expect(text?.trim()).toBeTruthy();
    return JSON.parse(text!) as { state: GalleryState; source: SourceBinding };
  };
  const canvas = page.locator('#gallery-canvas'); await canvas.scrollIntoViewIfNeeded();
  const before = await read(); expect(before.state.status).toBe('READY'); expect(before.state.busy).toBe(false);
  expect(before.state.comparison!.frame.paused).toBe(true);
  const clip = await canvas.boundingBox(); expect(clip).not.toBeNull();
  const dom = await canvas.evaluate((element: HTMLCanvasElement) => ({ intrinsicWidth: element.width, intrinsicHeight: element.height,
    dpr: devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, scroll: { x: scrollX, y: scrollY } }));
  const buffer = before.state.submission!.resolution;
  expect(dom.intrinsicWidth).toBe(buffer.bufferWidth); expect(dom.intrinsicHeight).toBe(buffer.bufferHeight);
  expect(dom.dpr).toBe(buffer.dpr); expect(clip!.width).toBe(buffer.width); expect(clip!.height).toBe(buffer.height);
  expect(clip!.x).toBeGreaterThanOrEqual(0); expect(clip!.y).toBeGreaterThanOrEqual(0);
  expect(clip!.x + clip!.width).toBeLessThanOrEqual(dom.viewport.width);
  expect(clip!.y + clip!.height).toBeLessThanOrEqual(dom.viewport.height);
  // Element screenshots enclose fractional origins in an integer rectangle. Keep
  // the actual floating rectangle here; scale follows the real browser DPR.
  const bytes = await page.screenshot({ clip: clip!, scale: 'device' });
  await writeFile(info.outputPath(`${name}.png`), bytes, { flag: 'wx' });
  const decoded = await page.evaluate(async (base64) => {
    const image = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], { type: 'image/png' }));
    const size = { width: image.width, height: image.height }; image.close(); return size;
  }, bytes.toString('base64'));
  const after = await read();
  await writeFile(info.outputPath(`${name}-native-capture.json`), JSON.stringify({ productIntegrated: false,
    classification: 'ACTUAL-NATIVE-COMPOSITOR-WHOLE-FLOAT-CANVAS-NOT-DIRECT-GPU-BUFFER', head, clip,
    fractionalOrigin: { x: clip!.x - Math.floor(clip!.x), y: clip!.y - Math.floor(clip!.y) }, dom, declaredViewport: buffer,
    scale: 'device', pngSha256: createHash('sha256').update(bytes).digest('hex'), decoded, before, after,
    runtimeOrStyleModified: false, roundedOrPaddedOrRecoded: false }, null, 2), { flag: 'wx' });
  expect(decoded).toEqual({ width: buffer.bufferWidth, height: buffer.bufferHeight });
  expect(after.state.status).toBe('READY'); expect(after.state.busy).toBe(false);
  expect(after.state.selection).toEqual(before.state.selection); expect(after.state.comparison).toEqual(before.state.comparison);
  expect(after.source).toEqual(before.source); expect(after.state.submission!.backend).toEqual(before.state.submission!.backend);
  expect(after.state.submission!.quality).toEqual(before.state.submission!.quality);
  return bytes;
}
