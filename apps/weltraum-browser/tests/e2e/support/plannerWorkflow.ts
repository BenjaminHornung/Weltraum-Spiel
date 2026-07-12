import { expect, type Locator, type Page } from "@playwright/test";

export const PREVIEW_HASH_PATTERN = /^[a-f0-9]{8}$/;

export async function openVisiblePlanner(page: Page): Promise<Locator> {
  const planner = page.getByTestId("navigation-planner");
  if (!(await planner.isVisible())) {
    const openButton = page.locator("#open-navigation-planner");
    await expect(openButton, "Player HUD must expose the visible planner entry point").toBeVisible();
    await openButton.click();
  }
  await expect(planner).toBeVisible();
  return planner;
}

export async function currentVisiblePreviewHash(page: Page): Promise<string | null> {
  return page.getByTestId("navigation-planner").getAttribute("data-visible-preview-hash");
}

export async function readVisiblePreviewHash(page: Page): Promise<string> {
  await expect.poll(() => currentVisiblePreviewHash(page)).toMatch(PREVIEW_HASH_PATTERN);
  return (await currentVisiblePreviewHash(page))!;
}

export async function selectVisiblePlannerTarget(page: Page, targetId: string, label: string): Promise<string> {
  await openVisiblePlanner(page);
  const target = page.locator(`#planner-target-options button[data-planner-target-id="${targetId}"]`);
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  await target.click();
  await expect(target).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("planner-selected-target")).toContainText(label);
  const previewHash = await readVisiblePreviewHash(page);
  await expect(page.locator("#planner-route-detail")).toContainText(previewHash);
  return previewHash;
}

export async function selectVisiblePlannerProfile(
  page: Page,
  profile: "Safe" | "Balanced" | "Fast"
): Promise<string> {
  await openVisiblePlanner(page);
  const profileButton = page.locator(`#planner-profile-${profile.toLowerCase()}`);
  await expect(profileButton).toBeEnabled();
  if (await profileButton.getAttribute("aria-pressed") !== "true") {
    const previousHash = await currentVisiblePreviewHash(page);
    await profileButton.click();
    await expect(profileButton).toHaveAttribute("aria-pressed", "true");
    if (previousHash !== null) {
      await expect.poll(() => currentVisiblePreviewHash(page)).not.toBe(previousHash);
    }
  }
  const hash = await readVisiblePreviewHash(page);
  await expect(page.locator("#planner-route-detail")).toContainText(hash);
  return hash;
}

export async function previewVisibleRoute(page: Page): Promise<string> {
  await openVisiblePlanner(page);
  const previewButton = page.locator("#planner-preview-route");
  const engageButton = page.getByTestId("planner-engage-route");
  await expect(previewButton).toBeEnabled();
  await previewButton.click();
  await expect(engageButton).toBeEnabled();
  const hash = await readVisiblePreviewHash(page);
  await expect(page.locator("#planner-route-detail")).toContainText(hash);
  return hash;
}

export async function engageVisiblePreview(page: Page, expectedHash: string): Promise<void> {
  const planner = await openVisiblePlanner(page);
  await expect(planner).toHaveAttribute("data-visible-preview-hash", expectedHash);
  const engage = page.getByTestId("planner-engage-route");
  await expect(engage).toBeEnabled();
  await engage.click();
  await expect(planner).toBeHidden();
}
