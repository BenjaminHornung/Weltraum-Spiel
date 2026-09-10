import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const baselineName = "hvp-visible-coast-1920x1080.png";
const baselineHash = "b47b7e48fbdcfbe514658238a74838986531cdc09b3dc09d35d39aac5620d1e3";
const viewport = { width: 1920, height: 1080 } as const;

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

test.use({ viewport });

test("HVP-02 T02 water toggle keeps shore depth visible through the real UI", async ({ page }) => {
  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
  await page.getByRole("button", { name: "C02-SHORE" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-camera", "C02-SHORE");
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-underwater-geometry", "visible");

  const withWater = await page.screenshot();
  await page.getByRole("button", { name: "Water: on" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-hestia-prototype-water", "off");
  await expect(page.getByRole("button", { name: "Water: off" })).toBeVisible();
  const withoutWater = await page.screenshot();
  expect(await changedPixelRatio(page, withWater, withoutWater)).toBeGreaterThan(0.01);

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

  const wide = await page.screenshot();
  await page.getByRole("button", { name: "C01-EYE" }).click();
  const eye = await page.screenshot();
  expect(await changedPixelRatio(page, wide, eye)).toBeGreaterThan(0.01);
  await expect(page.locator("#hvp-detail")).toContainText("Terrain faces:");
});

test("HVP-02 T05/T06 use the stored binding and expose the non-editable proxy", async ({ page }) => {
  const baseline = await readBoundBaseline(evidenceDirectory);
  expect(baseline.length).toBeGreaterThan(1_000);

  const directory = await mkdtemp(path.join(tmpdir(), "hvp-look-baseline-negative-"));
  try {
    await writeFile(path.join(directory, baselineName), Buffer.from("foreign baseline"));
    await expect(readBoundBaseline(directory)).rejects.toThrow(/hash mismatch/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  await page.goto("/?hestiaPrototype=1");
  await expect(page.locator("#hvp-state")).toContainText("State: Ready", { timeout: 20_000 });
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
  const eye = await page.screenshot();
  await page.getByRole("button", { name: "C04-WIDE" }).click();
  const wide = await page.screenshot();
  expect(pngDimensions(eye)).toEqual(viewport);
  expect(pngDimensions(wide)).toEqual(viewport);
  await expect(page.evaluate(() => "TestBridge" in window)).resolves.toBe(false);
});
