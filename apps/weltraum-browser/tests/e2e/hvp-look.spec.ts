import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertFreshHvpEmitTarget, HVP_R8_CANDIDATE_NAMES } from "./hvp-evidence-guard";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const baselineName = "hvp-visible-coast-1920x1080.png";
const baselineHash = "b47b7e48fbdcfbe514658238a74838986531cdc09b3dc09d35d39aac5620d1e3";
// Provenance: first added in commit c068e694 ("HVP-01-FIX: close 8
// visible-coast blockers with failing-first regressions"). The producing
// branch is not objectively provable from Git (branch --contains shows
// containment only), so branch is recorded as unknown. Bytes/hash unchanged.
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

// Visual A/Bs must hold the real simulation still, not compare different physics ticks.
const startPausedHvp = async (page: Page): Promise<void> => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await page.getByRole("button", { name: "Physik pausieren", exact: true }).click();
  await expect.poll(() => page.evaluate(() => ({status:JSON.parse(document.body.dataset.hestiaPrototypePhysics ?? "{}").status,
    clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??"null")}))).toMatchObject({status:"Paused"});
};

interface HvpHudRegionDelta {
  readonly outsideRatio: number;
  readonly insideRatio: number;
}

// Proves Hide UI actually removed the panels from the captured page region
// while the rendered scene outside the HUD box stayed fixed. Reads only:
// DOM geometry plus the existing canvas-decode pattern. No CSS/test
// mutation, no cropping scripts. Locator captures are composited page
// regions, so overlapping DOM is included by construction; this check
// confines the UI contribution to the measured HUD box instead of claiming
// UI-free bytes that the capture path cannot produce while any control
// (here: the lone Show UI button) remains visible.
const hudRegionDelta = async (
  page: Page,
  hidden: Buffer,
  visible: Buffer,
  hud: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
): Promise<HvpHudRegionDelta> =>
  page.evaluate(async ({ hiddenBase64, visibleBase64, box }) => {
    const decode = async (base64: string): Promise<{ readonly width: number; readonly height: number; readonly pixels: Uint8ClampedArray }> => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for HVP HUD-region proof");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels };
    };
    const [concealed, shown] = await Promise.all([decode(hiddenBase64), decode(visibleBase64)]);
    if (concealed.width !== shown.width || concealed.height !== shown.height) {
      throw new Error("HVP HUD-region comparison dimensions differ");
    }
    const scale = concealed.width / window.innerWidth;
    const x0 = Math.max(0, Math.floor(box.x * scale));
    const y0 = Math.max(0, Math.floor(box.y * scale));
    const x1 = Math.min(concealed.width, Math.ceil((box.x + box.width) * scale));
    const y1 = Math.min(concealed.height, Math.ceil((box.y + box.height) * scale));
    let insideChanged = 0;
    let insideSeen = 0;
    let outsideChanged = 0;
    let outsideSeen = 0;
    for (let y = 0; y < concealed.height; y += 1) {
      for (let x = 0; x < concealed.width; x += 1) {
        const offset = (y * concealed.width + x) * 4;
        const changed = [0, 1, 2].some((channel) =>
          Math.abs(concealed.pixels[offset + channel]! - shown.pixels[offset + channel]!) > 12);
        if (x >= x0 && x < x1 && y >= y0 && y < y1) {
          insideSeen += 1;
          if (changed) insideChanged += 1;
        } else {
          outsideSeen += 1;
          if (changed) outsideChanged += 1;
        }
      }
    }
    return { outsideRatio: outsideChanged / outsideSeen, insideRatio: insideChanged / insideSeen };
  }, { hiddenBase64: hidden.toString("base64"), visibleBase64: visible.toString("base64"), box: hud });

interface HvpRegionMetrics {
  readonly skyFamilyRatio: number;
  readonly pixels: number;
  readonly nonBackgroundRatio: number;
  readonly colorBucketCount: number;
  readonly dominantColorRatio: number;
  readonly waterFamilyRatio: number;
  readonly terrainFamilyRatio: number;
  readonly vegetationFamilyRatio: number;
  readonly nearBlackRatio: number;
}

interface HvpRenderMetrics {
  readonly width: number;
  readonly height: number;
  readonly background: readonly [number, number, number, number];
  readonly nonBackgroundRatio: number;
  readonly distinctColorCount: number;
  readonly waterFamilyRatio: number;
  readonly terrainFamilyRatio: number;
  readonly vegetationFamilyRatio: number;
  readonly nearBlackRatio: number;
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
      let vegetationPixels = 0;
      let nearBlackPixels = 0;
      let skyPixels = 0;
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
          if (green > 45 && green > red * 1.25 && green > blue * 1.25) { vegetationPixels += 1; }
          if (red < 12 && green < 12 && blue < 12) { nearBlackPixels += 1; }
          if (blue >= red + 15 && blue >= green && green > 100
            || Math.min(red,green,blue) > 185 && blue >= red && green >= red) { skyPixels += 1; }
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
        terrainFamilyRatio: warmPixels / pixelsSeen,
        vegetationFamilyRatio: vegetationPixels / pixelsSeen,
        nearBlackRatio: nearBlackPixels / pixelsSeen,
        skyFamilyRatio: skyPixels / pixelsSeen
      };
    };
    const rows = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85].map((fraction) => {
      const y = Math.min(canvas.height - 1, Math.floor(canvas.height * fraction));
      return 1 - region(0, y, canvas.width, 1).skyFamilyRatio;
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
      vegetationFamilyRatio: overall.vegetationFamilyRatio,
      nearBlackRatio: overall.nearBlackRatio,
      topBackgroundRatio: region(0, 0, canvas.width, Math.floor(canvas.height * 0.2)).skyFamilyRatio,
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
  // The v5 sky has a gradient and clouds, not the v3/v4 flat RGB background.
  expect(metrics.background[3], `${name} must expose an opaque sky`).toBe(255);
  expect(metrics.background[2], `${name} must retain a blue/cloud sky color`).toBeGreaterThanOrEqual(metrics.background[0]);
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
  // The fixed C02-SHORE pose targets a dry shelf 3 m out (orbit target above
  // the bank); the source-defined lagoon water the pose is contracted to show
  // sits left of frame center. The ROI is bound to that water, thresholds
  // unchanged; the opaque-mask negative fills the same ROI.
  const metrics = await measureShoreWaterRoi(page, withWater);
  expect(metrics.nonBackgroundRatio, `${name} must contain visible geometry in the C02 water ROI`).toBeGreaterThan(0.2);
  expect(metrics.waterFamilyRatio, `${name} must contain the water/underwater color family`).toBeGreaterThan(0.1);
  expect(metrics.colorBucketCount, `${name} must retain terrain variation below the water`).toBeGreaterThan(4);
  expect(metrics.dominantColorRatio, `${name} must not be an opaque flat water mask`).toBeLessThan(0.9);
  expect(await changedPixelRatioInRoi(page, withWater, withoutWater), `${name} must change when the water presentation is toggled`)
    .toBeGreaterThan(0.01);
};

interface HvpWaterRoiMetrics {
  readonly nonBackgroundRatio: number;
  readonly waterFamilyRatio: number;
  readonly colorBucketCount: number;
  readonly dominantColorRatio: number;
}

// Fixed C02 water window: the stepped lagoon shelf at the wall base with
// submerged microsteps, wet band, and crevice water. Bound to fixed pose.
const shoreWaterRoi = { leftFraction: 0.3, topFraction: 0.4, widthFraction: 0.25, heightFraction: 0.25 } as const;

const measureShoreWaterRoi = async (page: Page, image: Buffer): Promise<HvpWaterRoiMetrics> =>
  page.evaluate(async ({ base64, roi }) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D context unavailable for HVP ROI inspection");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0]!, pixels[1]!, pixels[2]!, pixels[3]!];
    const left = Math.floor(canvas.width * roi.leftFraction);
    const top = Math.floor(canvas.height * roi.topFraction);
    const width = Math.floor(canvas.width * roi.widthFraction);
    const height = Math.floor(canvas.height * roi.heightFraction);
    let pixelsSeen = 0;
    let backgroundPixels = 0;
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
        if (blue >= 64 && blue - red >= 28 && green - red >= 14) waterPixels += 1;
        const bucket = `${Math.floor(red / 16)},${Math.floor(green / 16)},${Math.floor(blue / 16)}`;
        colorBuckets.set(bucket, (colorBuckets.get(bucket) ?? 0) + 1);
      }
    }
    const dominantPixels = Math.max(0, ...colorBuckets.values());
    return {
      nonBackgroundRatio: (pixelsSeen - backgroundPixels) / pixelsSeen,
      waterFamilyRatio: waterPixels / pixelsSeen,
      colorBucketCount: [...colorBuckets.values()].filter((count) => count >= 16).length,
      dominantColorRatio: dominantPixels / pixelsSeen
    };
  }, { base64: image.toString("base64"), roi: shoreWaterRoi });

const assertBoundReference = async (page: Page, name: string, image: Buffer): Promise<HvpRenderMetrics> => {
  const metrics = await measureCanvas(page, image);
  expect(metrics.width, `${name} must use the deterministic 1920 width`).toBe(viewport.width);
  expect(metrics.height, `${name} must use the deterministic 1080 height`).toBe(viewport.height);
  expect(metrics.nonBackgroundRatio, `${name} must contain bound scene content`).toBeGreaterThan(0.005);
  expect(metrics.distinctColorCount, `${name} must contain bound color regions`).toBeGreaterThan(4);
  return metrics;
};

const assertCandidateDiffersFromRejectedBaseline = async (
  page: Page,
  name: string,
  rejected: Buffer,
  candidate: Buffer
): Promise<void> => {
  // The stored PNG is the rejected dark coarse render: its bytes and hash stay
  // provenance-checkable, but a corrected scene must NOT match it. Semantic
  // structure is asserted on the candidate; the drift only proves the old
  // render is gone. A new accepted baseline still needs human art review and
  // stays pending (profile-regression), never auto-promoted here.
  await assertBoundReference(page, `${name} rejected`, rejected);
  await assertRenderedStructure(page, `${name} candidate`, candidate);
  expect(await changedPixelRatio(page, rejected, candidate), `${name} must visibly differ from the rejected render`)
    .toBeGreaterThan(maxBoundPixelDifference);
};

const changedPixelRatioInRoi = async (page: Page, left: Buffer, right: Buffer): Promise<number> =>
  page.evaluate(async ({ leftBase64, rightBase64, roi }) => {
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
    const left = Math.floor(leftImage.width * roi.leftFraction);
    const top = Math.floor(leftImage.height * roi.topFraction);
    const width = Math.floor(leftImage.width * roi.widthFraction);
    const height = Math.floor(leftImage.height * roi.heightFraction);
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
  }, { leftBase64: left.toString("base64"), rightBase64: right.toString("base64"), roi: shoreWaterRoi });

const renderBackgroundOnlyPng = async (page: Page, skyGradient = false): Promise<Buffer> => {
  const base64 = await page.evaluate((gradientSky) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context unavailable for HVP background negative");
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "rgb(100 150 210)");
    gradient.addColorStop(0.4, "rgb(220 232 240)");
    gradient.addColorStop(1, "rgb(135 181 217)");
    context.fillStyle = gradientSky ? gradient : "rgb(8 24 32)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, skyGradient);
  return Buffer.from(base64, "base64");
};

const renderOpaqueWaterMask = async (page: Page, source: Buffer): Promise<Buffer> => {
  const base64 = await page.evaluate(async ({ sourceBase64, roi }) => {
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
      Math.floor(canvas.width * roi.leftFraction),
      Math.floor(canvas.height * roi.topFraction),
      Math.floor(canvas.width * roi.widthFraction),
      Math.floor(canvas.height * roi.heightFraction)
    );
    bitmap.close();
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, { sourceBase64: source.toString("base64"), roi: shoreWaterRoi });
  return Buffer.from(base64, "base64");
};

test.use({ viewport });

test("HVP-02 T02 water toggle keeps shore depth visible through the real UI", async ({ page }) => {
  test.setTimeout(120_000);
  await startPausedHvp(page);
  await page.getByRole("button", { name: "C02-SHORE" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C02-SHORE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-underwater-geometry", "visible");

  const dumpDirectory = process.env.WELTRAUM_DUMP_HVP_DIR;
  if (dumpDirectory !== undefined && dumpDirectory !== "") {
    await assertFreshHvpEmitTarget(
      dumpDirectory,
      ["hvp-c02-with-water.png", "hvp-c02-without-water.png"],
      HVP_R8_CANDIDATE_NAMES
    );
  }

  // Canvas-region capture after the real Hide UI button. Locator captures are
  // composited page regions, so overlapping DOM is included by construction:
  // with panels hidden the only remaining control is the lone Show UI
  // button (see the T08 HUD-region proof); no CSS/test mutation is used.
  await page.getByRole("button", { name: "Hide UI" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-hud", "hidden");
  const withWater = await captureRenderedCanvas(page);
  expect(pngDimensions(withWater)).toEqual(viewport);
  await page.getByRole("button", { name: "Show UI" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-hud", "visible");
  await page.getByRole("button", { name: "Water: on" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-water", "off");
  await expect(page.getByRole("button", { name: "Water: off" })).toBeVisible();
  const withoutWater = await captureRenderedCanvas(page);
  if (dumpDirectory !== undefined && dumpDirectory !== "") {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dumpDirectory, { recursive: true });
    await writeFile(path.join(dumpDirectory, "hvp-c02-with-water.png"), withWater);
    await writeFile(path.join(dumpDirectory, "hvp-c02-without-water.png"), withoutWater);
  }
  await assertUnderwaterDepth(page, "C02 underwater ROI", withWater, withoutWater);
  const opaqueWaterMask = await renderOpaqueWaterMask(page, withoutWater);
  await expect(assertUnderwaterDepth(page, "opaque water negative", opaqueWaterMask, withoutWater))
    .rejects.toThrow(/water|flat|ROI|geometry/i);

  await page.getByRole("button", { name: "Water: off" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-water", "on");
  await expect(page.getByRole("button", { name: "Water: on" })).toBeVisible();
  // Apples-to-apples restore pair: re-hide first so both frames carry the
  // same HUD state (panels hidden, lone Show UI button), matching the
  // shipped withWater bytes instead of mixing HUD states across the toggle.
  await page.getByRole("button", { name: "Hide UI" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-hud", "hidden");
  const restored = await captureRenderedCanvas(page);
  await page.getByRole("button", { name: "Show UI" }).click();
  expect(await changedPixelRatio(page, restored, withoutWater), "re-enabled water must differ from water-off")
    .toBeGreaterThan(0.01);
  expect(await changedPixelRatio(page, restored, withWater), "re-enabled water must restore the water-on frame")
    .toBeLessThan(0.01);
});

const meanLuminance = async (page: Page, image: Buffer): Promise<number> =>
  page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D context unavailable for HVP luminance");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    const count = canvas.width * canvas.height;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      total += 0.2126 * pixels[offset]! + 0.7152 * pixels[offset + 1]! + 0.0722 * pixels[offset + 2]!;
    }
    return total / count / 255;
  }, image.toString("base64"));

test("HVP-02 R3 AO toggle changes rendered brightness through the real UI", async ({ page }) => {
  test.setTimeout(120_000);
  await startPausedHvp(page);
  await page.getByRole("button", { name: "C02-SHORE" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-ao", "on");

  // Real-route geometry/state identity through DOM only: no TestBridge, no
  // created controls, no renderer internals. AO must change pixels while
  // every available content identifier stays fixed.
  const geometryState = async (): Promise<string> => page.evaluate(() => {
    const pick = (name: string): string => document.body.getAttribute(name) ?? "";
    return JSON.stringify({
      faces: pick("data-hestia-prototype-faces"),
      triangles: pick("data-hestia-prototype-triangles"),
      sourceDigest: pick("data-hestia-prototype-source-digest"),
      waterDigest: pick("data-hestia-prototype-water-digest"),
      camera: pick("data-hestia-prototype-camera"),
      state: pick("data-hestia-prototype-state"),
      look: pick("data-hestia-prototype-look"),
      seed: pick("data-hestia-prototype-seed"),
      detail: document.querySelector("#hvp-detail")?.textContent ?? "",
      mode: document.querySelector("#hvp-mode")?.textContent ?? ""
    });
  });
  const aoOn = await captureRenderedCanvas(page);
  const stateOn = await geometryState();
  expect(stateOn).toContain("b8fde6b0");
  const aoToggle = page.getByRole("button", { name: "Inspect-only ambient occlusion toggle" });
  await aoToggle.click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-ao", "off");
  await expect(page.locator("#hvp-ao-toggle")).toContainText("AO: off");
  const aoOff = await captureRenderedCanvas(page);
  expect(await geometryState(), "AO toggle must not change real-route geometry/state").toBe(stateOn);
  const luminanceOn = await meanLuminance(page, aoOn);
  const luminanceOff = await meanLuminance(page, aoOff);
  // AO only darkens crevices: the frame mean must move, and neutralizing AO
  // must brighten with source, geometry, camera, and lights held fixed.
  expect(Math.abs(luminanceOff - luminanceOn)).toBeGreaterThan(0.002);
  expect(luminanceOff).toBeGreaterThan(luminanceOn);

  await page.getByRole("button", { name: "Inspect-only ambient occlusion toggle" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-ao", "on");
  await expect(page.locator("#hvp-ao-toggle")).toContainText("AO: on");
  expect(await geometryState(), "AO re-enable must restore real-route geometry/state").toBe(stateOn);

  await page.setViewportSize({ width: 1280, height: 720 });
  const small = await captureRenderedCanvas(page);
  expect(small.length).toBeGreaterThan(1_000);

  const candidateDirectory = process.env.WELTRAUM_DUMP_HVP_DIR;
  if (candidateDirectory !== undefined && candidateDirectory !== "") {
    await assertFreshHvpEmitTarget(candidateDirectory, ["hvp-c02-ao-off.png"], HVP_R8_CANDIDATE_NAMES);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(candidateDirectory, { recursive: true });
    // No ao-on file: that visual state (C02, water on, AO on) is already
    // emitted as hvp-c02-with-water.png; the manifest references it for both
    // claims instead of duplicating bytes under two semantic names.
    await writeFile(path.join(candidateDirectory, "hvp-c02-ao-off.png"), aoOff);
  }
});

test("HVP-02 T03 key and cool fill are bound to the readable look", async ({ page }) => {
  test.setTimeout(120_000);
  await startPausedHvp(page);
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-look", "hvp:readable-coast-v6");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-lighting", "key-fill");
  await expect(page.locator("body")).toHaveAttribute(
    "data-hestia-prototype-material-roles",
    "limestone-dry,limestone-wet,soil,moss"
  );

  // Scene-only metrics must not count the expanded vegetation HUD as missing sky.
  await page.getByRole("button", { name: "Hide UI", exact: true }).click();
  const wide = await captureRenderedCanvas(page);
  await assertRenderedStructure(page, "HVP-T03 wide", wide);
  await page.getByRole("button", { name: "Show UI", exact: true }).click();
  await page.getByRole("button", { name: "C01-EYE" }).click();
  await page.getByRole("button", { name: "Hide UI", exact: true }).click();
  const eye = await captureRenderedCanvas(page);
  await assertRenderedStructure(page, "HVP-T03 eye", eye);
  expect(await changedPixelRatio(page, wide, eye)).toBeGreaterThan(0.01);
  await page.getByRole("button", { name: "Show UI", exact: true }).click();
  await expect(page.locator("#hvp-detail")).toContainText("Terrain faces:");
});

test("HVP-02 T05/T06 use the stored binding and expose the non-editable proxy", async ({ page }) => {
  test.setTimeout(120_000);
  await startPausedHvp(page);
  const candidate = await captureRenderedCanvas(page);
  const rejected = await readBoundBaseline(evidenceDirectory);
  expect(rejected.length).toBeGreaterThan(1_000);
  await assertCandidateDiffersFromRejectedBaseline(page, "HVP-02 C04", rejected, candidate);

  const directory = await mkdtemp(path.join(tmpdir(), "hvp-look-baseline-negative-"));
  try {
    const foreignBaseline = Buffer.from(rejected);
    foreignBaseline[24] = foreignBaseline[24]! ^ 1;
    await writeFile(path.join(directory, baselineName), foreignBaseline);
    await expect(readBoundBaseline(directory)).rejects.toThrow(/hash mismatch/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-source-revision", "hvp-authored-coast-v5");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-seed", "hestia-hvp-lagoon-001");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-renderer", "three-basic-lit");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-background-editable", "false");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-background", "distant-coast-proxy");
});

test("HVP-02 T08 C01 and C04 render complete viewport captures without a test harness", async ({ page, browser }) => {
  // Full-resolution captures and pixel checks share the test deadline, as in T02/AO.
  test.setTimeout(120_000);
  await startPausedHvp(page);
  await page.getByRole("button", { name: "C01-EYE" }).click();
  const candidateDirectory = process.env.WELTRAUM_DUMP_HVP_DIR;
  let emitRunId: string | undefined;
  if (candidateDirectory !== undefined && candidateDirectory !== "") {
    emitRunId = await assertFreshHvpEmitTarget(
      candidateDirectory,
      [
        "hvp-c01-eye.png",
        "hvp-c04-wide.png",
        "hvp-c04-wide-1280x720.png",
        "manifest.json"
      ],
      HVP_R8_CANDIDATE_NAMES
    );
  }
  // Canvas-region capture after the real Hide UI button. Locator captures are
  // composited page regions, so overlapping DOM is included by construction:
  // with panels hidden the only remaining control is the lone Show UI
  // button. The HUD-region proof below confines that contribution to the
  // measured HUD box instead of claiming unproducible UI-free bytes.
  const eyeVisible = await captureRenderedCanvas(page);
  const hudBox = await page.locator("#hvp-hud").boundingBox();
  if (hudBox === null) throw new Error("HVP HUD box is unavailable for the HUD-region proof");
  await page.getByRole("button", { name: "Hide UI" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-hud", "hidden");
  const eye = await captureRenderedCanvas(page);
  expect(pngDimensions(eye)).toEqual(viewport);
  await page.getByRole("button", { name: "Show UI" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-hud", "visible");
  const region = await hudRegionDelta(page, eye, eyeVisible, hudBox);
  expect(region.outsideRatio, "scene outside the HUD box must stay fixed across Hide/Show").toBeLessThan(0.005);
  expect(region.insideRatio, "HUD panels must actually disappear from the capture").toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "C04-WIDE" }).click();
  await page.getByRole("button", { name: "Hide UI" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-hud", "hidden");
  const wide = await captureRenderedCanvas(page);
  expect(pngDimensions(wide)).toEqual(viewport);
  await page.getByRole("button", { name: "Show UI" }).click();
  await page.setViewportSize({ width: 1280, height: 720 });
  const wideTech = await page.screenshot();
  if (candidateDirectory !== undefined && candidateDirectory !== "") {
    const { mkdir } = await import("node:fs/promises");
    const { execFileSync } = await import("node:child_process");
    await mkdir(candidateDirectory, { recursive: true });
    await writeFile(path.join(candidateDirectory, "hvp-c01-eye.png"), eye);
    await writeFile(path.join(candidateDirectory, "hvp-c04-wide.png"), wide);
    await writeFile(path.join(candidateDirectory, "hvp-c04-wide-1280x720.png"), wideTech);
    const sha256Hex = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
    const productSources = [
      "src/hvp/hvpCoastSource.ts",
      "src/hvp/hvpCoastMesher.ts",
      "src/hvp/hvpBootstrap.ts",
      "src/hvp/hvpCamera.ts",
      "src/hvp/hvpHud.ts",
      "src/voxel/blockAmbientOcclusion.ts",
      "src/hestia-prototype/presentation/look.ts",
      "src/render/three/backend/threeMaterialFactory.ts",
      "src/render/three/backend/threeMeshFactory.ts"
    ];
    const files = [];
    for (const relative of productSources) {
      const bytes = await readFile(path.resolve(process.cwd(), relative));
      files.push({ path: relative, sha256: sha256Hex(bytes), bytes: bytes.length });
    }
    const captureMeta = async (name: string, image: Buffer, camera: string, viewport: string, state = "") => ({
      name,
      camera,
      viewport,
      state,
      width: pngDimensions(image).width,
      height: pngDimensions(image).height,
      sha256: sha256Hex(image),
      bytes: image.length
    });
    const primaryCaptures: Array<Record<string, unknown>> = [
      await captureMeta("hvp-c01-eye.png", eye, "C01-EYE", "1920x1080", "water on, AO on; canvas-region capture, HUD panels hidden (lone Show UI button remains top-left by product design)"),
      await captureMeta("hvp-c04-wide.png", wide, "C04-WIDE", "1920x1080", "water on, AO on; canvas-region capture, HUD panels hidden (lone Show UI button remains top-left by product design)"),
      await captureMeta("hvp-c04-wide-1280x720.png", wideTech, "C04-WIDE", "1280x720", "water on, AO on; page-level capture, HUD visible (technical)")
    ];
    const companion: ReadonlyArray<readonly [string, string, string, string]> = [
      ["hvp-c02-with-water.png", "C02-SHORE", "1920x1080", "water on, AO on; canvas-region capture, HUD panels hidden (lone Show UI button remains top-left by product design)"],
      ["hvp-c02-without-water.png", "C02-SHORE", "1920x1080", "water off, AO on; canvas-region capture, HUD visible"],
      ["hvp-c02-ao-off.png", "C02-SHORE", "1920x1080", "water on, AO off; canvas-region capture, HUD visible"]
    ];
    const companionCaptures = await Promise.all(companion.map(async ([fileName, camera, viewport, state]) => {
      const image = await readFile(path.join(candidateDirectory, fileName));
      const meta = await captureMeta(fileName, image, camera, viewport, state);
      // The C02 AO-on visual state is byte-identical to the water-on baseline,
      // so one capture carries both claims instead of duplicating bytes under
      // another semantic name.
      return fileName === "hvp-c02-with-water.png"
        ? { ...meta, claims: ["water-on baseline", "ao-on baseline"] }
        : meta;
    }));
    const captures = [...primaryCaptures, ...companionCaptures];
    const requiredCaptureNames = HVP_R8_CANDIDATE_NAMES.filter((name) => name !== "manifest.json");
    if (
      captures.length !== requiredCaptureNames.length ||
      new Set(captures.map((capture) => capture.name)).size !== requiredCaptureNames.length ||
      requiredCaptureNames.some((name) => !captures.some((capture) => capture.name === name))
    ) {
      throw new Error("HVP R8 manifest requires all three primary and all three companion captures.");
    }
    const body = page.locator("body");
    const resources = JSON.parse((await body.getAttribute("data-hestia-prototype-resources")) ?? "null");
    expect(resources?.ledger.triangles).toBe(Number(await body.getAttribute("data-hestia-prototype-triangles")));
    expect(resources.ledger.triangles).toBeLessThanOrEqual(resources.caps.maxTriangles);
    expect(resources.ledger.totalCpuBytes).toBeLessThanOrEqual(resources.caps.maxCpuBytes);
    expect(resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(resources.caps.maxMeshBytes);
    expect(resources.ledger.drawCalls).toBeLessThanOrEqual(resources.caps.maxDrawCalls);
    const specBytes = await readFile(path.resolve(process.cwd(), "tests/e2e/hvp-look.spec.ts"));
    const manifest = {
      worktree: "Hestia-HVP02-readable-coast",
      branch: "feature/hvp-02-readable-coast",
      runId: emitRunId,
      baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd() }).toString().trim(),
      dirtyTracked: execFileSync("git", ["status", "--porcelain"], { cwd: process.cwd() }).toString().trim().length > 0,
      productSources: files,
      labAo: {
        commit: "94bd8acd7ab12d21ff53987330a0e97f46166a17",
        files: ["src/voxel/blockAo.ts", "src/voxel/aoGreedyFaceMesher.ts", "src/render-three/aoVertexColors.ts"]
      },
      source: {
        seed: await body.getAttribute("data-hestia-prototype-seed"),
        revision: await body.getAttribute("data-hestia-prototype-source-revision"),
        digest: await body.getAttribute("data-hestia-prototype-source-digest"),
        waterDigest: await body.getAttribute("data-hestia-prototype-water-digest"),
        triangles: await body.getAttribute("data-hestia-prototype-triangles")
      },
      render: {
        look: await body.getAttribute("data-hestia-prototype-look"),
        renderer: await body.getAttribute("data-hestia-prototype-renderer"),
        ao: await body.getAttribute("data-hestia-prototype-ao"),
        water: await body.getAttribute("data-hestia-prototype-water"),
        browser: `${browser.browserType().name()} ${browser.version()}`,
        dpr: await page.evaluate(() => window.devicePixelRatio)
      },
      captureTest: {
        path: "tests/e2e/hvp-look.spec.ts",
        sha256: sha256Hex(specBytes),
        bytes: specBytes.length
      },
      cameras: [
        { preset: "C01-EYE", position: [-8, 3.15, -11], target: [0, 1, 5], fov: 60 },
        { preset: "C02-SHORE", position: [-2, 1.25, -6], target: [1, -0.5, -2], fov: 55 },
        { preset: "C04-WIDE", position: [-24, 18, -28], target: [0, 1, 1], fov: 55 }
      ],
      complete: true,
      resources,
      captures,
      supersedesHistorical: [
        "evidence/hvp-candidates/* (r1: rejected dark coarse baseline era)",
        "evidence/hvp-candidates-r2/* (r2: pre-AO single-tone far field era)",
        "evidence/hvp-candidates-r3/* (r3: AO corner-order defect era)",
        "evidence/hvp-candidates-r4/* (r4: raised-wall seam defect era)",
        "evidence/hvp-candidates-r5/* (r5: duplicate with-water/ao-on bytes, hardcoded browser/DPR, HUD in all captures, blank C01/C04 states)",
        "evidence/hvp-candidates-r6/* (r6: full-page beauty files contain the Show UI button; HUD-free wording overclaims UI-free art evidence)",
        "evidence/hvp-candidates-r7/* (r7: partial manifests and stale other-emitter companions were not rejected)",
        "evidence/hvp-candidates-r8/* (r8: Hide/Show discarded the original control-button styles)",
        "evidence/hvp-candidates-r9/* (r9: closed northern outlet, wet-role height/depth mismatch and repeated shelves)",
        "evidence/hvp-candidates-r10/* (r10: water output allocation and malformed-grid guards were incomplete)"
      ]
    };
    await writeFile(path.join(candidateDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  await assertRenderedStructure(page, "HVP-02 C01", eye);
  await assertCandidateDiffersFromRejectedBaseline(page, "HVP-02 C04", await readBoundBaseline(evidenceDirectory), wide);
  const backgroundOnly = await renderBackgroundOnlyPng(page);
  await expect(assertRenderedStructure(page, "background-off negative", backgroundOnly))
    .rejects.toThrow(/rendered scene content|color|horizon|ROI|geometry|background/i);
  await expect(assertRenderedStructure(page, "sky-gradient-only negative", await renderBackgroundOnlyPng(page, true)))
    .rejects.toThrow(/terrain family/);
  await expect(page.evaluate(() => "TestBridge" in window)).resolves.toBe(false);
});

test("HVP-03 root coast renders all four real camera views with admitted vegetation", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await startPausedHvp(page);
  const body = page.locator("body");
  await expect(body).toHaveAttribute("data-hestia-prototype-vegetation", "hvp-root-umbrella-v3");
  await expect(body).toHaveAttribute("data-hestia-prototype-effects", "hvp-surface-light-v1");
  await expect(body).toHaveAttribute("data-hestia-prototype-vegetation-physics", "wood-static-collision; decoration-noncolliding");
  const resources = JSON.parse((await body.getAttribute("data-hestia-prototype-resources"))!);
  expect(resources.ledger.triangles).toBeLessThanOrEqual(resources.caps.maxTriangles);
  expect(resources.ledger.drawCalls).toBeLessThanOrEqual(resources.caps.maxDrawCalls);
  expect(resources.ledger.totalCpuBytes).toBeLessThanOrEqual(resources.caps.maxCpuBytes);
  expect(resources.ledger.retainedMeshBytes).toBeLessThanOrEqual(resources.caps.maxMeshBytes);
  expect(resources.ledger.vegetationSourceBytes).toBeGreaterThan(0);
  const directory = process.env.WELTRAUM_DUMP_HVP03_DIR;
  const names = ["hvp03-c01.png", "hvp03-c02.png", "hvp03-c03.png", "hvp03-c04.png", "hvp03-c04-1280.png", "manifest.json"];
  const runId = directory ? await assertFreshHvpEmitTarget(directory, names, names) : undefined;
  const captures: Array<Record<string, unknown>> = [];
  const capture = async (name: string, camera: string): Promise<Buffer> => {
    const image = await captureRenderedCanvas(page);
    if (directory) { await writeFile(path.join(directory, name), image); }
    captures.push({name,camera,...pngDimensions(image),sha256:createHash("sha256").update(image).digest("hex"),bytes:image.length,
      state:"water on; AO on; physics paused; panels hidden; Show UI control visible"});
    return image;
  };
  for (const [camera,name] of [["C01-EYE",names[0]!],["C02-SHORE",names[1]!],["C03-ROOTS",names[2]!],["C04-WIDE",names[3]!]]) {
    await page.getByRole("button", {name:camera!,exact:true}).click();
    await expect(body).toHaveAttribute("data-hestia-prototype-camera", camera!);
    await page.getByRole("button", {name:"Hide UI",exact:true}).click();
    const image = await capture(name!, camera!);
    if (camera === "C03-ROOTS") {
      const metrics = await measureCanvas(page,image);
      expect(metrics.vegetationFamilyRatio, "C03 must render foliage, not only publish vegetation metadata").toBeGreaterThan(0.025);
      expect(metrics.nearBlackRatio, "C03 undersides must retain visible light response rather than black bands").toBeLessThan(0.01);
    }
    await page.getByRole("button", {name:"Show UI",exact:true}).click();
  }
  await expect.poll(async()=>JSON.parse((await body.getAttribute("data-hestia-prototype-frame-diagnostics"))??"{}").fullscreenTargets).toBe(0);
  await expect.poll(async()=>JSON.parse((await body.getAttribute("data-hestia-prototype-frame-diagnostics"))??"{}").shadowUpdated).toBe(false);
  const frameDiagnostics=JSON.parse((await body.getAttribute("data-hestia-prototype-frame-diagnostics"))!);
  // Local terrain sectors add material groups; compare steady draws to admitted
  // products instead of the old monolithic scene's incidental 150-draw threshold.
  expect(frameDiagnostics.calls).toBeGreaterThan(0);
  expect(frameDiagnostics.calls).toBeLessThanOrEqual(resources.ledger.drawCalls);
  expect(frameDiagnostics.calls).toBeLessThanOrEqual(resources.caps.maxDrawCalls);
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole("button", {name:"Hide UI",exact:true}).click();
  await capture(names[4]!, "C04-WIDE");
  expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);
  if (directory) {
    const {execFileSync} = await import("node:child_process");
    const sources = [];
    for (const file of ["src/hestia-prototype/presentation/vegetation.ts","src/hestia-prototype/presentation/look.ts","src/hestia-prototype/presentation/visualEffects.ts","src/hvp/hvpBootstrap.ts","src/hvp/hvpCamera.ts","src/hvp/hvpHud.ts","src/hvp/hvpCoastSource.ts","src/hvp/hvpCoastMesher.ts","tests/e2e/hvp-look.spec.ts",
      "src/hestia-prototype/physics/rapierPort.ts", "src/hestia-prototype/physics/profile.ts", "src/hestia-prototype/physics/tick.ts", "src/hestia-prototype/physics/terrainColliders.ts", "src/hestia-prototype/physics/session.ts", "src/hestia-prototype/physics/physicsWorker.ts", "src/hestia-prototype/physics/client.ts",
      "src/hestia-prototype/player/locomotion.ts", "src/hestia-prototype/player/input.ts", "src/hestia-prototype/player/presentation.ts", "src/workers/hvpCollisionJob.ts", "src/workers/workerPool.ts", "src/workers/streamingWorker.ts", "tests/e2e/hvp-visible-coast.spec.ts", "package.json", "package-lock.json",
       "src/workers/hvpTerrainJob.ts", "src/hestia-prototype/terrain/picking.ts", "src/hestia-prototype/terrain/cutPlan.ts", "src/hestia-prototype/terrain/terrainProducts.ts", "src/hestia-prototype/terrain/terrainConsumer.ts", "src/hestia-prototype/terrain/plasmaTool.ts",
        "src/hestia-prototype/physics/principalAxes.ts", "src/hestia-prototype/physics/rigidBody.ts", "src/hestia-prototype/terrain/structuralIngest.ts",
         "src/hestia-prototype/physics/structuralBreak.ts", "src/hestia-prototype/physics/branchSession.ts", "src/hestia-prototype/presentation/structuralPart.ts", "src/hestia-prototype/terrain/structuralConsumer.ts",
          "src/hestia-prototype/physics/rigidRecipe.ts", "src/hestia-prototype/terrain/supportPlan.ts", "src/workers/hvpSupportJob.ts",
           "src/hestia-prototype/terrain/terrainTransfer.ts", "src/hestia-prototype/physics/terrainFragment.ts", "src/hestia-prototype/presentation/terrainFragment.ts",
           "src/hestia-prototype/physics/structuralPlan.ts", "src/hestia-prototype/physics/bodyCutPlan.ts", "src/hestia-prototype/physics/bodyCut.ts",
            "src/hestia-prototype/physics/bodyCutSession.ts", "src/hestia-prototype/terrain/bodyCutConsumer.ts", "src/workers/hvpBodyCutJob.ts",
            "src/hestia-prototype/persistence/gridCheckpoint.ts", "src/hestia-prototype/persistence/bodyCheckpoint.ts", "src/hestia-prototype/persistence/plantCheckpoint.ts",
            "src/hestia-prototype/persistence/worldCheckpoint.ts", "src/hestia-prototype/persistence/gameCheckpoint.ts", "src/hestia-prototype/persistence/receiptCheckpoint.ts",
            "src/hestia-prototype/persistence/saveStore.ts", "src/hestia-prototype/persistence/sceneReplacement.ts", "src/hestia-prototype/physics/restoreBody.ts",
             "src/hestia-prototype/physics/worldReplacement.ts", "src/browser-storage/indexedDbSaveRepository.ts", "src/browser-storage/codec.ts", "src/browser-storage/exportImport.ts",
              "src/hestia-prototype/gameplay/salvageLoop.ts", "src/hestia-prototype/presentation/salvageMarker.ts",
              "src/hestia-prototype/runtime/regionSource.ts", "src/hestia-prototype/runtime/residency.ts", "src/hestia-prototype/runtime/neighborController.ts",
              "src/hestia-prototype/runtime/neighborProducts.ts", "src/hestia-prototype/runtime/projectionPacket.ts", "src/hestia-prototype/runtime/dormancyController.ts",
              "src/hestia-prototype/physics/neighborRegion.ts", "src/hestia-prototype/physics/bodyResidency.ts", "src/workers/hvpNeighborJob.ts",
              "src/streaming/memoryContentCache.ts", "src/streaming/contentKey.ts", "src/streaming/residency.ts"]) {
      const bytes = await readFile(path.resolve(file));
      sources.push({path:file,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
    }
    await writeFile(path.join(directory,"manifest.json"),JSON.stringify({
      runId,baseCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
      branch:execFileSync("git",["branch","--show-current"],{encoding:"utf8"}).trim(),dirtyTracked:true,
      browser:`${browser.browserType().name()} ${browser.version()}`,dpr:await page.evaluate(()=>devicePixelRatio),
      vegetationDigest:await body.getAttribute("data-hestia-prototype-vegetation-digest"),
      look:await body.getAttribute("data-hestia-prototype-look"),
      sourceDigest:await body.getAttribute("data-hestia-prototype-source-digest"),
      effects:await body.getAttribute("data-hestia-prototype-effects"),frameDiagnostics,
              sources,resources,captures,complete:true,artAcceptance:"PENDING_OWNER",stage:"HVP-13 bounded adjacent canonical region, projection LOD and checkpointed body residency",
       neighbor:JSON.parse((await body.getAttribute("data-hestia-prototype-neighbor"))??"{}"),
       dormancy:JSON.parse((await body.getAttribute("data-hestia-prototype-body-residency"))??"{}"),
       ownedRender:JSON.parse((await body.getAttribute("data-hestia-prototype-owned-render"))??"{}"),
      terrainGeneration:await body.getAttribute("data-hestia-prototype-terrain-generation"),
      terrainSectors:JSON.parse((await body.getAttribute("data-hestia-prototype-terrain-sectors"))??"[]"),
           cutScope:"SafeQuarry, bounded anchored timber, actual C05 undercut and terrain/timber fragment or descendant cell/box recut; foliage remapped or retired with its real support cell; dynamic sphere and arbitrary root-tree detachment NOT_IMPLEMENTED",
       physics: JSON.parse((await body.getAttribute("data-hestia-prototype-physics")) ?? "{}"),
       save: JSON.parse((await body.getAttribute("data-hestia-prototype-save")) ?? "{}"),
         saveEvidence: "These are paused coast overview images, not traversal, dormancy or salvage proof. Separate normal-input tests and attachments prove 20 regional round trips, collision-ready entry, LOD independence, actual sleeping-body eviction/rehydration, live/cold neighbor restoration, IndexedDB abort/rollback and domain-driven salvage completion.",
      preparation: JSON.parse((await body.getAttribute("data-hestia-prototype-physics-preparation")) ?? "{}")
    },null,2)+"\n");
  }
});
