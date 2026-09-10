import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const baselineName = "hvp-visible-coast-1920x1080.png";
const baselineHash = "b47b7e48fbdcfbe514658238a74838986531cdc09b3dc09d35d39aac5620d1e3";
const maxBoundPixelDifference = 0.35;
const viewport = { width: 1920, height: 1080 } as const;
const runtimeIssues = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const issues: string[] = [];
  runtimeIssues.set(page, issues);
  page.on("console", (message) => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => issues.push(`requestfailed: ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`));
});

test.afterEach(({ page }, testInfo) => {
  if (testInfo.status === "passed") expect(runtimeIssues.get(page)).toEqual([]);
});

const pngDimensions = (image: Buffer): { readonly width: number; readonly height: number } => {
  if (image.length < 24 || image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Invalid PNG signature");
  }
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
};

const readBoundBaseline = async (directory: string): Promise<Buffer> => {
  const image = await readFile(path.join(directory, baselineName));
  const digest = createHash("sha256").update(image).digest("hex");
  if (digest !== baselineHash) throw new Error(`Baseline hash mismatch: ${digest}`);
  expect(pngDimensions(image)).toEqual(viewport);
  return image;
};

const changedPixelRatio = async (page: Page, left: Buffer, right: Buffer): Promise<number> =>
  page.evaluate(async ({ leftBase64, rightBase64 }) => {
    const decode = async (base64: string): Promise<{ readonly width: number; readonly height: number; readonly pixels: Uint8ClampedArray }> => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for HVP-02 comparison");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels };
    };

    const leftImage = await decode(leftBase64);
    const rightImage = await decode(rightBase64);
    if (leftImage.width !== rightImage.width || leftImage.height !== rightImage.height) {
      throw new Error("HVP-02 comparison image dimensions differ");
    }
    let changedPixels = 0;
    for (let offset = 0; offset < leftImage.pixels.length; offset += 4) {
      if ([0, 1, 2].some((channel) => Math.abs(leftImage.pixels[offset + channel]! - rightImage.pixels[offset + channel]!) > 12)) {
        changedPixels += 1;
      }
    }
    return changedPixels / (leftImage.width * leftImage.height);
  }, { leftBase64: left.toString("base64"), rightBase64: right.toString("base64") });

const captureRenderedCanvas = (page: Page): Promise<Buffer> => page.locator("#debug-scene").screenshot();

interface HvpRegionMetrics {
  readonly pixels: number;
  readonly nonBackgroundRatio: number;
  readonly colorBucketCount: number;
  readonly dominantColorRatio: number;
  readonly waterFamilyRatio: number;
  readonly terrainFamilyRatio: number;
}

interface HvpRenderMetrics {
  readonly width: number;
  readonly height: number;
  readonly background: readonly [number, number, number, number];
  readonly nonBackgroundRatio: number;
  readonly distinctColorCount: number;
  readonly waterFamilyRatio: number;
  readonly terrainFamilyRatio: number;
  readonly topBackgroundRatio: number;
  readonly horizonContrast: number;
  readonly center: HvpRegionMetrics;
  readonly bottomCenter: HvpRegionMetrics;
}

const measureCanvas = async (page: Page, image: Buffer): Promise<HvpRenderMetrics> =>
  page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D context unavailable for HVP inspection");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0]!, pixels[1]!, pixels[2]!, pixels[3]!];
    const region = (left: number, top: number, width: number, height: number): HvpRegionMetrics => {
      let pixelsSeen = 0;
      let backgroundPixels = 0;
      let warmPixels = 0;
      let waterPixels = 0;
      const colorBuckets = new Map<string, number>();
      for (let y = top; y < Math.min(canvas.height, top + height); y += 1) {
        for (let x = left; x < Math.min(canvas.width, left + width); x += 1) {
          const offset = (y * canvas.width + x) * 4;
          const red = pixels[offset]!;
          const green = pixels[offset + 1]!;
          const blue = pixels[offset + 2]!;
          pixelsSeen += 1;
          if (background.every((value, channel) => Math.abs(value - pixels[offset + channel]!) <= 12)) backgroundPixels += 1;
          if (red >= 80 && red - blue >= 16 && green - blue >= 8) warmPixels += 1;
          if (blue >= 64 && blue - red >= 28 && green - red >= 14) waterPixels += 1;
          const bucket = `${Math.floor(red / 16)},${Math.floor(green / 16)},${Math.floor(blue / 16)}`;
          colorBuckets.set(bucket, (colorBuckets.get(bucket) ?? 0) + 1);
        }
      }
      const dominantPixels = Math.max(0, ...colorBuckets.values());
      return {
        pixels: pixelsSeen,
        nonBackgroundRatio: (pixelsSeen - backgroundPixels) / pixelsSeen,
        colorBucketCount: [...colorBuckets.values()].filter((count) => count >= 16).length,
        dominantColorRatio: dominantPixels / pixelsSeen,
        waterFamilyRatio: waterPixels / pixelsSeen,
        terrainFamilyRatio: warmPixels / pixelsSeen
      };
    };
    const rows = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85].map((fraction) => {
      const y = Math.min(canvas.height - 1, Math.floor(canvas.height * fraction));
      return region(0, y, canvas.width, 1).nonBackgroundRatio;
    });
    const overall = region(0, 0, canvas.width, canvas.height);
    return {
      width: canvas.width,
      height: canvas.height,
      background: [background[0]!, background[1]!, background[2]!, background[3]!],
      nonBackgroundRatio: overall.nonBackgroundRatio,
      distinctColorCount: overall.colorBucketCount,
      waterFamilyRatio: overall.waterFamilyRatio,
      terrainFamilyRatio: overall.terrainFamilyRatio,
      topBackgroundRatio: 1 - region(0, 0, canvas.width, Math.floor(canvas.height * 0.2)).nonBackgroundRatio,
      horizonContrast: rows.slice(1).reduce((maximum, value, index) => Math.max(maximum, Math.abs(value - rows[index]!)), 0),
      center: region(
        Math.floor(canvas.width * 0.35),
        Math.floor(canvas.height * 0.35),
        Math.floor(canvas.width * 0.3),
        Math.floor(canvas.height * 0.3)
      ),
      bottomCenter: region(
        Math.floor(canvas.width * 0.35),
        Math.floor(canvas.height * 0.7),
        Math.floor(canvas.width * 0.3),
        Math.floor(canvas.height * 0.25)
      )
    };
  }, image.toString("base64"));

const assertRenderedStructure = async (page: Page, name: string, image: Buffer): Promise<HvpRenderMetrics> => {
  const metrics = await measureCanvas(page, image);
  expect(metrics.width, `${name} must use the deterministic 1920 width`).toBe(viewport.width);
  expect(metrics.height, `${name} must use the deterministic 1080 height`).toBe(viewport.height);
  expect(metrics.background, `${name} must expose the HVP sky background`).toEqual([8, 24, 32, 255]);
  expect(metrics.nonBackgroundRatio, `${name} must contain rendered scene content`).toBeGreaterThan(0.01);
  expect(metrics.distinctColorCount, `${name} must contain multiple rendered color regions`).toBeGreaterThan(4);
  expect(metrics.waterFamilyRatio, `${name} must contain the rendered water family`).toBeGreaterThan(0.01);
  expect(metrics.terrainFamilyRatio, `${name} must contain the rendered terrain family`).toBeGreaterThan(0.01);
  expect(metrics.topBackgroundRatio, `${name} must retain an unobstructed sky edge`).toBeGreaterThan(0.5);
  expect(metrics.horizonContrast, `${name} must contain a rendered horizon transition`).toBeGreaterThan(0.1);
  expect(metrics.center.nonBackgroundRatio, `${name} must contain a central rendered ROI`).toBeGreaterThan(0.05);
  expect(metrics.center.colorBucketCount, `${name} central ROI must not be a flat mask`).toBeGreaterThan(4);
  expect(metrics.bottomCenter.nonBackgroundRatio, `${name} must retain lower scene geometry`).toBeGreaterThan(0.05);
  return metrics;
};

const assertUnderwaterDepth = async (
  page: Page,
  name: string,
  withWater: Buffer,
  withoutWater: Buffer
): Promise<void> => {
  const metrics = await measureCanvas(page, withWater);
  expect(metrics.width, `${name} must use the deterministic 1920 width`).toBe(viewport.width);
  expect(metrics.height, `${name} must use the deterministic 1080 height`).toBe(viewport.height);
  expect(metrics.center.nonBackgroundRatio, `${name} must contain visible geometry in the C02 target ROI`).toBeGreaterThan(0.2);
  expect(metrics.center.waterFamilyRatio, `${name} must contain the water/underwater color family`).toBeGreaterThan(0.1);
  expect(metrics.center.colorBucketCount, `${name} must retain terrain variation below the water`).toBeGreaterThan(4);
  expect(metrics.center.dominantColorRatio, `${name} must not be an opaque flat water mask`).toBeLessThan(0.9);
  expect(await changedPixelRatioInCenter(page, withWater, withoutWater), `${name} must change when the water presentation is toggled`)
    .toBeGreaterThan(0.01);
};

const assertBoundReference = async (page: Page, name: string, image: Buffer): Promise<HvpRenderMetrics> => {
  const metrics = await measureCanvas(page, image);
  expect(metrics.width, `${name} must use the deterministic 1920 width`).toBe(viewport.width);
  expect(metrics.height, `${name} must use the deterministic 1080 height`).toBe(viewport.height);
  expect(metrics.nonBackgroundRatio, `${name} must contain bound scene content`).toBeGreaterThan(0.005);
  expect(metrics.distinctColorCount, `${name} must contain bound color regions`).toBeGreaterThan(4);
  return metrics;
};

const assertTolerantBoundMatch = async (page: Page, name: string, bound: Buffer, candidate: Buffer): Promise<void> => {
  const boundMetrics = await assertBoundReference(page, `${name} bound`, bound);
  const candidateMetrics = await assertRenderedStructure(page, `${name} candidate`, candidate);
  expect(Math.abs(candidateMetrics.nonBackgroundRatio - boundMetrics.nonBackgroundRatio), `${name} content ratio drift`)
    .toBeLessThan(0.2);
  expect(Math.abs(candidateMetrics.center.nonBackgroundRatio - boundMetrics.center.nonBackgroundRatio), `${name} ROI drift`)
    .toBeLessThan(0.2);
  expect(await changedPixelRatio(page, bound, candidate), `${name} must remain within the tolerant render comparison`)
    .toBeLessThan(maxBoundPixelDifference);
};

const changedPixelRatioInCenter = async (page: Page, left: Buffer, right: Buffer): Promise<number> =>
  page.evaluate(async ({ leftBase64, rightBase64 }) => {
    const decode = async (base64: string): Promise<{
      readonly width: number;
      readonly height: number;
      readonly context: CanvasRenderingContext2D;
    }> => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for HVP ROI comparison");
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return { width: canvas.width, height: canvas.height, context };
    };
    const [leftImage, rightImage] = await Promise.all([decode(leftBase64), decode(rightBase64)]);
    if (leftImage.width !== rightImage.width || leftImage.height !== rightImage.height) {
      throw new Error("HVP ROI comparison image dimensions differ");
    }
    const left = Math.floor(leftImage.width * 0.35);
    const top = Math.floor(leftImage.height * 0.35);
    const width = Math.floor(leftImage.width * 0.3);
    const height = Math.floor(leftImage.height * 0.3);
    const leftPixels = leftImage.context.getImageData(left, top, width, height).data;
    const rightPixels = rightImage.context.getImageData(left, top, width, height).data;
    const leftWords = new Uint32Array(leftPixels.buffer, leftPixels.byteOffset, leftPixels.byteLength / Uint32Array.BYTES_PER_ELEMENT);
    const rightWords = new Uint32Array(rightPixels.buffer, rightPixels.byteOffset, rightPixels.byteLength / Uint32Array.BYTES_PER_ELEMENT);
    const littleEndian = new Uint8Array(new Uint32Array([0x01020304]).buffer)[0] === 0x04;
    const redShift = littleEndian ? 0 : 24;
    const greenShift = littleEndian ? 8 : 16;
    const blueShift = littleEndian ? 16 : 8;
    let changedPixels = 0;
    for (let index = 0; index < leftWords.length; index += 1) {
      const leftPixel = leftWords[index]!;
      const rightPixel = rightWords[index]!;
      if (
        Math.abs(((leftPixel >>> redShift) & 0xff) - ((rightPixel >>> redShift) & 0xff)) > 12 ||
        Math.abs(((leftPixel >>> greenShift) & 0xff) - ((rightPixel >>> greenShift) & 0xff)) > 12 ||
        Math.abs(((leftPixel >>> blueShift) & 0xff) - ((rightPixel >>> blueShift) & 0xff)) > 12
      ) {
        changedPixels += 1;
      }
    }
    return changedPixels / leftWords.length;
  }, { leftBase64: left.toString("base64"), rightBase64: right.toString("base64") });

const renderBackgroundOnlyPng = async (page: Page): Promise<Buffer> => {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context unavailable for HVP background negative");
    context.fillStyle = "rgb(8 24 32)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  });
  return Buffer.from(base64, "base64");
};

const renderOpaqueWaterMask = async (page: Page, source: Buffer): Promise<Buffer> => {
  const base64 = await page.evaluate(async (sourceBase64) => {
    const binary = atob(sourceBase64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context unavailable for HVP opaque-water negative");
    context.drawImage(bitmap, 0, 0);
    context.fillStyle = "rgb(2 102 242)";
    context.fillRect(
      Math.floor(canvas.width * 0.35),
      Math.floor(canvas.height * 0.35),
      Math.floor(canvas.width * 0.3),
      Math.floor(canvas.height * 0.3)
    );
    bitmap.close();
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, source.toString("base64"));
  return Buffer.from(base64, "base64");
};

test.use({ viewport });

test("HVP-02 T02 water toggle keeps shore depth visible through the real UI", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await page.getByRole("button", { name: "C02-SHORE" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C02-SHORE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-underwater-geometry", "visible");

  const withWater = await captureRenderedCanvas(page);
  await page.getByRole("button", { name: "Water: on" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-water", "off");
  await expect(page.getByRole("button", { name: "Water: off" })).toBeVisible();
  const withoutWater = await captureRenderedCanvas(page);
  await assertUnderwaterDepth(page, "C02 underwater ROI", withWater, withoutWater);
  const opaqueWaterMask = await renderOpaqueWaterMask(page, withoutWater);
  await expect(assertUnderwaterDepth(page, "opaque water negative", opaqueWaterMask, withoutWater))
    .rejects.toThrow(/water|flat|ROI|geometry/i);

  await page.getByRole("button", { name: "Water: off" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-water", "on");
});

test("HVP-02 T03 key and cool fill are bound to the readable look", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-look", "hvp:readable-coast-v1");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-lighting", "key-fill");
  await expect(page.locator("body")).toHaveAttribute(
    "data-hestia-prototype-material-roles",
    "limestone-dry,limestone-wet,soil,moss"
  );

  const wide = await captureRenderedCanvas(page);
  await assertRenderedStructure(page, "HVP-T03 wide", wide);
  await page.getByRole("button", { name: "C01-EYE" }).click();
  const eye = await captureRenderedCanvas(page);
  await assertRenderedStructure(page, "HVP-T03 eye", eye);
  expect(await changedPixelRatio(page, wide, eye)).toBeGreaterThan(0.01);
  await expect(page.locator("#hvp-detail")).toContainText("Terrain faces:");
});

test("HVP-02 T05/T06 use the stored binding and expose the non-editable proxy", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  const candidate = await captureRenderedCanvas(page);
  const baseline = await readBoundBaseline(evidenceDirectory);
  expect(baseline.length).toBeGreaterThan(1_000);
  await assertTolerantBoundMatch(page, "HVP-02 C04", baseline, candidate);

  const directory = await mkdtemp(path.join(tmpdir(), "hvp-look-baseline-negative-"));
  try {
    const foreignBaseline = Buffer.from(baseline);
    foreignBaseline[24] = foreignBaseline[24]! ^ 1;
    await writeFile(path.join(directory, baselineName), foreignBaseline);
    await expect(readBoundBaseline(directory)).rejects.toThrow(/hash mismatch/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-source-revision", "1");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-seed", "0");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-renderer", "three-basic-lit");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-background-editable", "false");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-background", "distant-coast-proxy");
});

test("HVP-02 T08 C01 and C04 render complete viewport captures without a test harness", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await page.getByRole("button", { name: "C01-EYE" }).click();
  const eye = await captureRenderedCanvas(page);
  await page.getByRole("button", { name: "C04-WIDE" }).click();
  const wide = await captureRenderedCanvas(page);
  await assertRenderedStructure(page, "HVP-02 C01", eye);
  await assertTolerantBoundMatch(page, "HVP-02 C04", await readBoundBaseline(evidenceDirectory), wide);
  const backgroundOnly = await renderBackgroundOnlyPng(page);
  await expect(assertRenderedStructure(page, "background-off negative", backgroundOnly))
    .rejects.toThrow(/rendered scene content|color|horizon|ROI|geometry/i);
  await expect(page.evaluate(() => "TestBridge" in window)).resolves.toBe(false);
});
