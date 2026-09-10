import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const pngName = "hvp-visible-coast-1920x1080.png";
const recordEvidence = process.env.WELTRAUM_RECORD_EVIDENCE === "1";
const hvpDimensions = { width: 1920, height: 1080 } as const;
const focusedCommand = "npx playwright test tests/e2e/hvp-visible-coast.spec.ts --reporter=list";

interface PixelEvidenceContract {
  readonly dimensions: typeof hvpDimensions;
  readonly perChannelTolerance: 12;
  readonly nonEmptyMinimumRatio: 0.01;
  readonly minimumDistinctColorCount: 4;
  readonly minimumPalettePixels: 256;
  readonly minimumWaterFamilyRatio: 0.01;
  readonly minimumTerrainFamilyRatio: 0.01;
  readonly liveFrameDelta: {
    readonly minChangedPixels: 0;
    readonly maxChangedPixels: 8192;
  };
}

const pixelEvidenceContract: PixelEvidenceContract = {
  dimensions: hvpDimensions,
  perChannelTolerance: 12,
  nonEmptyMinimumRatio: 0.01,
  minimumDistinctColorCount: 4,
  minimumPalettePixels: 256,
  minimumWaterFamilyRatio: 0.01,
  minimumTerrainFamilyRatio: 0.01,
  liveFrameDelta: {
    minChangedPixels: 0,
    maxChangedPixels: 8192
  }
};

interface PixelComparison {
  readonly width: number;
  readonly height: number;
  readonly changedPixels: number;
  readonly changedRatio: number;
  readonly maximumChannelDelta: number;
}

interface CanvasMetrics {
  readonly width: number;
  readonly height: number;
  readonly nonBackgroundPixels: number;
  readonly nonBackgroundRatio: number;
  readonly distinctColorCount: number;
  readonly waterFamilyPixels: number;
  readonly terrainFamilyPixels: number;
}

const persistDeterministicEvidence = async (fileName: string, content: Buffer | string): Promise<void> => {
  const filePath = path.join(evidenceDirectory, fileName);
  const bytes = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  try {
    if ((await readFile(filePath)).equals(bytes)) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (!recordEvidence) {
    throw new Error(`Evidence differs at ${fileName}; rerun with WELTRAUM_RECORD_EVIDENCE=1 to record it explicitly.`);
  }
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(filePath, bytes);
};

const readStoredPngEvidence = async (directory: string): Promise<Buffer> => {
  const filePath = path.join(directory, pngName);
  try {
    return await readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Missing stored PNG evidence at ${filePath}; record it explicitly with WELTRAUM_RECORD_EVIDENCE=1.`, { cause: error });
    }
    throw error;
  }
};

const decodeAndCompare = async (page: Page, expected: Buffer, actual: Buffer): Promise<PixelComparison> =>
  page.evaluate(async ({ expectedBase64, actualBase64, perChannelTolerance }) => {
    const decode = async (base64: string): Promise<{ width: number; height: number; pixels: Uint8ClampedArray }> => {
      const binary = atob(base64);
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context === null) throw new Error("Canvas 2D context unavailable for PNG comparison");
      context.drawImage(bitmap, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      bitmap.close();
      return { width: canvas.width, height: canvas.height, pixels };
    };
    const expectedImage = await decode(expectedBase64);
    const actualImage = await decode(actualBase64);
    if (expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height) {
      throw new Error(`PNG size mismatch: ${expectedImage.width}x${expectedImage.height} vs ${actualImage.width}x${actualImage.height}`);
    }
    let changedPixels = 0;
    let maximumChannelDelta = 0;
    for (let offset = 0; offset < expectedImage.pixels.length; offset += 4) {
      let changed = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(expectedImage.pixels[offset + channel] - actualImage.pixels[offset + channel]);
        maximumChannelDelta = Math.max(maximumChannelDelta, delta);
        if (delta > perChannelTolerance) changed = true;
      }
      if (changed) changedPixels += 1;
    }
    return {
      width: actualImage.width,
      height: actualImage.height,
      changedPixels,
      changedRatio: changedPixels / (actualImage.width * actualImage.height),
      maximumChannelDelta
    };
  }, {
    expectedBase64: expected.toString("base64"),
    actualBase64: actual.toString("base64"),
    perChannelTolerance: pixelEvidenceContract.perChannelTolerance
  });

const measureCanvas = async (page: Page, image: Buffer): Promise<CanvasMetrics> =>
  page.evaluate(async ({ base64, perChannelTolerance, minimumPalettePixels }) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Canvas 2D context unavailable for PNG measurement");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
    let nonBackgroundPixels = 0;
    let waterFamilyPixels = 0;
    let terrainFamilyPixels = 0;
    const colorBuckets = new Map<string, number>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
      const red = pixels[offset]!;
      const green = pixels[offset + 1]!;
      const blue = pixels[offset + 2]!;
      const differs = background.some((value, channel) => Math.abs(value - pixels[offset + channel]!) > perChannelTolerance);
      if (!differs) continue;
      nonBackgroundPixels += 1;
      const bucket = `${Math.floor(red / 16)},${Math.floor(green / 16)},${Math.floor(blue / 16)}`;
      colorBuckets.set(bucket, (colorBuckets.get(bucket) ?? 0) + 1);
      if (blue >= 64 && blue - red >= 28 && green - red >= 14) waterFamilyPixels += 1;
      if (red >= 80 && red - blue >= 16 && green - blue >= 8) terrainFamilyPixels += 1;
    }
    if (nonBackgroundPixels === 0) throw new Error("HVP canvas is empty");
    return {
      width: canvas.width,
      height: canvas.height,
      nonBackgroundPixels,
      nonBackgroundRatio: nonBackgroundPixels / (canvas.width * canvas.height),
      distinctColorCount: [...colorBuckets.values()].filter((count) => count >= minimumPalettePixels).length,
      waterFamilyPixels,
      terrainFamilyPixels
    };
  }, {
    base64: image.toString("base64"),
    perChannelTolerance: pixelEvidenceContract.perChannelTolerance,
    minimumPalettePixels: pixelEvidenceContract.minimumPalettePixels
  });

const assertCanvasEvidence = async (page: Page, name: string, image: Buffer): Promise<CanvasMetrics> => {
  const metrics = await measureCanvas(page, image);
  expect(metrics.width, `${name} must use the deterministic 1920 width`).toBe(hvpDimensions.width);
  expect(metrics.height, `${name} must use the deterministic 1080 height`).toBe(hvpDimensions.height);
  expect(metrics.nonBackgroundRatio, `${name} must be visibly non-empty`).toBeGreaterThan(pixelEvidenceContract.nonEmptyMinimumRatio);
  expect(metrics.distinctColorCount, `${name} must contain several stable palette colors`).toBeGreaterThan(
    pixelEvidenceContract.minimumDistinctColorCount
  );
  expect(metrics.waterFamilyPixels, `${name} must contain the water color family`).toBeGreaterThan(
    hvpDimensions.width * hvpDimensions.height * pixelEvidenceContract.minimumWaterFamilyRatio
  );
  expect(metrics.terrainFamilyPixels, `${name} must contain the terrain color family`).toBeGreaterThan(
    hvpDimensions.width * hvpDimensions.height * pixelEvidenceContract.minimumTerrainFamilyRatio
  );
  return metrics;
};

const renderBlankPng = async (page: Page, width: number, height: number): Promise<Buffer> => {
  const blankImageBase64 = await page.evaluate(({ w, h }) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, { w: width, h: height });
  return Buffer.from(blankImageBase64, "base64");
};

const renderWrongSizePng = async (page: Page, width: number, height: number): Promise<Buffer> => {
  const imageBase64 = await page.evaluate(({ w, h }) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context unavailable for wrong-size PNG");
    context.fillStyle = "#ff00ff";
    context.fillRect(Math.floor(w / 2), Math.floor(h / 2), 1, 1);
    return canvas.toDataURL("image/png").split(",", 2)[1]!;
  }, { w: width, h: height });
  return Buffer.from(imageBase64, "base64");
};

const loadAndValidateStoredHvpEvidence = async (page: Page, directory: string): Promise<Buffer> => {
  const stored = await readStoredPngEvidence(directory);
  await assertCanvasEvidence(page, `stored ${pngName}`, stored);
  return stored;
};

test.use({ viewport: { width: 1920, height: 1080 } });

test("HVP-01 visible coast reaches Ready through the real UI and renders the bound scene structure", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => requestFailures.push(request.url()));

  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-hud")).toBeVisible();
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await expect(page.locator("#debug-scene")).toHaveAttribute("aria-label", "HVP-02 readable coast viewport");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-state", "Ready");
  await expect(page.locator("#hvp-detail")).toContainText("Terrain faces:");
  await expect(page.locator("#hvp-failure")).toHaveCount(0);

  const liveImage = await page.screenshot();
  const secondLiveImage = await page.screenshot();
  await assertCanvasEvidence(page, "live HVP frame", liveImage);
  await assertCanvasEvidence(page, "second live HVP frame", secondLiveImage);
  if (recordEvidence) {
    await persistDeterministicEvidence(pngName, liveImage);
  }
  const comparison = await decodeAndCompare(page, liveImage, secondLiveImage);
  // eslint-disable-next-line no-console
  console.log(`HVP-LIVE-CALIBRATION changedPixels=${comparison.changedPixels} changedRatio=${comparison.changedRatio} maximumChannelDelta=${comparison.maximumChannelDelta}`);
  expect(comparison.changedPixels, "live-vs-live changed-pixel lower band").toBeGreaterThanOrEqual(
    pixelEvidenceContract.liveFrameDelta.minChangedPixels
  );
  expect(comparison.changedPixels, "live-vs-live changed-pixel upper band").toBeLessThanOrEqual(
    pixelEvidenceContract.liveFrameDelta.maxChangedPixels
  );

  expect(consoleErrors, `console errors (${focusedCommand})`).toEqual([]);
  expect(pageErrors, `page errors (${focusedCommand})`).toEqual([]);
  expect(requestFailures, `request failures (${focusedCommand})`).toEqual([]);
});

test("HVP-01 camera presets switch through real buttons", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });

  await page.getByRole("button", { name: "C01-EYE" }).click();
  await expect(page.locator("#hvp-mode")).toContainText("C01-EYE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C01-EYE");

  await page.getByRole("button", { name: "C04-WIDE" }).click();
  await expect(page.locator("#hvp-mode")).toContainText("C04-WIDE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C04-WIDE");
});

test("existing routes stay untouched and combined queries resolve to Surface Lab", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#flight-hud")).toBeVisible();
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => "TestBridge" in window)).toBe(false);

  await page.goto("/?surfaceLab=1&hestiaPrototype=1");
  await expect(page.locator("body")).toHaveAttribute("data-surface-lab", "1");
  await expect(page.locator("#hvp-hud")).toHaveCount(0);
});

test("stored HVP PNG evidence rejects missing, corrupt, blank, and wrong-size replacements", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });

  const validImage = await readStoredPngEvidence(evidenceDirectory);
  const blankImage = await renderBlankPng(page, hvpDimensions.width, hvpDimensions.height);
  const wrongSizeImage = await renderWrongSizePng(page, 640, 360);
  await assertCanvasEvidence(page, `stored ${pngName}`, validImage);

  const expectRejected = async (label: string, mutate: (directory: string) => Promise<void>): Promise<void> => {
    const directory = await mkdtemp(path.join(tmpdir(), "hvp-visible-coast-negative-"));
    try {
      await writeFile(path.join(directory, pngName), validImage);
      await mutate(directory);
      await expect(loadAndValidateStoredHvpEvidence(page, directory), label).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };

  await expectRejected("missing stored PNG", async (directory) => {
    await rm(path.join(directory, pngName));
  });
  await expectRejected("corrupt stored PNG", async (directory) => {
    await writeFile(path.join(directory, pngName), Buffer.from("not a PNG"));
  });
  await expectRejected("blank stored PNG", async (directory) => {
    await writeFile(path.join(directory, pngName), blankImage);
  });
  await expectRejected("wrong-size stored PNG", async (directory) => {
    await writeFile(path.join(directory, pngName), wrongSizeImage);
  });
});
