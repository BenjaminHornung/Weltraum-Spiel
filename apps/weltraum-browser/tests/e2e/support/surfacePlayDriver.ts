import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { expect, type Page } from "@playwright/test";

export type SurfacePlayMovementKey = "a" | "d" | "s" | "w" | "Space";

export interface SurfacePlayTestBridgeState {
  readonly ownProperty: boolean;
  readonly inWindow: boolean;
}

export interface SurfacePlayDomEvidence {
  readonly url: string;
  readonly documentReadyState: DocumentReadyState;
  readonly uiSurface: string | null;
  readonly surfacePlayState: string | null;
  readonly locomotionState: string | null;
  readonly pointerLockState: string | null;
  readonly pointerLockElement: string | null;
  readonly viewport: {
    readonly ariaLabel: string | null;
    readonly visible: boolean;
    readonly width: number;
    readonly height: number;
  };
  readonly hud: {
    readonly movement: string;
    readonly grounded: string;
    readonly energy: string;
    readonly weaponStatus: string;
    readonly heat: string;
    readonly target: string;
    readonly action: string;
    readonly block: string;
  };
  readonly testBridge: SurfacePlayTestBridgeState;
}

export interface SurfacePlayMovementEvidence {
  readonly key: SurfacePlayMovementKey;
  readonly heldMilliseconds: number;
  readonly before: SurfacePlayDomEvidence;
  readonly during: SurfacePlayDomEvidence;
  readonly after: SurfacePlayDomEvidence;
}

export interface SurfacePlayFrameSample {
  readonly requestedDurationMilliseconds: number;
  readonly observedDurationMilliseconds: number;
  readonly frameCount: number;
  readonly frameIntervalMilliseconds: {
    readonly mean: number;
    readonly p95: number;
    readonly maximum: number;
  };
  readonly longTaskSupported: boolean;
  readonly longTasks: readonly {
    readonly name: string;
    readonly startTime: number;
    readonly duration: number;
  }[];
  readonly maximumLongTaskMilliseconds: number;
}

export interface OptionalF1ToggleEvidence {
  readonly available: boolean;
  readonly selector: string;
  readonly before: null | Readonly<{ hidden: boolean | "until-found"; ariaHidden: string | null; state: string | null }>;
  readonly after: null | Readonly<{ hidden: boolean | "until-found"; ariaHidden: string | null; state: string | null }>;
}

export interface SurfacePlayCleanupEvidence {
  readonly releasedKeys: readonly SurfacePlayMovementKey[];
  readonly releasedMouseButton: boolean;
  readonly pointerLockReleased: boolean;
}

export interface SurfacePlayDriverOptions {
  readonly readyTimeoutMilliseconds?: number;
  readonly interactionTimeoutMilliseconds?: number;
}

const DEFAULT_READY_TIMEOUT_MILLISECONDS = 120_000;
const DEFAULT_INTERACTION_TIMEOUT_MILLISECONDS = 5_000;
const SURFACE_PLAY_VIEWPORT = 'canvas[aria-label="Hestia surface viewport"]';

const boundedDuration = (value: number, name: string, maximum: number): void => {
  if (!Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new RangeError(`${name} must be greater than 0 and at most ${maximum} ms.`);
  }
};

/**
 * Test-only Surface Play driver. It uses trusted Playwright mouse/keyboard input
 * and reads browser DOM/performance state only; it never imports product runtime
 * modules or calls TestBridge.
 */
export class SurfacePlayDriver {
  readonly #page: Page;
  readonly #readyTimeoutMilliseconds: number;
  readonly #interactionTimeoutMilliseconds: number;
  readonly #heldKeys = new Set<SurfacePlayMovementKey>();
  #mouseButtonDown = false;
  #mousePosition: Readonly<{ x: number; y: number }> | null = null;

  constructor(page: Page, options: SurfacePlayDriverOptions = {}) {
    this.#page = page;
    this.#readyTimeoutMilliseconds = options.readyTimeoutMilliseconds ?? DEFAULT_READY_TIMEOUT_MILLISECONDS;
    this.#interactionTimeoutMilliseconds =
      options.interactionTimeoutMilliseconds ?? DEFAULT_INTERACTION_TIMEOUT_MILLISECONDS;
  }

  async openRoute(route = "/?surfacePlay=1"): Promise<SurfacePlayDomEvidence> {
    try {
      await this.#page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(
        this.#page.locator('body[data-ui-surface="surface-play"][data-surface-play-state="ready"]'),
        "Surface Play route must publish ready DOM state"
      ).toHaveCount(1, { timeout: this.#readyTimeoutMilliseconds });
      await expect(this.#page.locator(SURFACE_PLAY_VIEWPORT)).toBeVisible({
        timeout: this.#interactionTimeoutMilliseconds
      });
      await expect(this.#page.locator("#surface-play-hud")).toBeVisible({
        timeout: this.#interactionTimeoutMilliseconds
      });
      await this.assertTestBridgeAbsent();
      return await this.readDomEvidence();
    } catch (error) {
      return await this.#failWithDiagnostics("open Surface Play route", error);
    }
  }

  async assertTestBridgeAbsent(): Promise<SurfacePlayTestBridgeState> {
    const state = await this.#page.evaluate((): SurfacePlayTestBridgeState => ({
      ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
      inWindow: "TestBridge" in window
    }));
    expect(state, "Surface Play must never expose window.TestBridge").toEqual({
      ownProperty: false,
      inWindow: false
    });
    return state;
  }

  async readDomEvidence(): Promise<SurfacePlayDomEvidence> {
    return this.#page.evaluate((viewportSelector): SurfacePlayDomEvidence => {
      const text = (selector: string): string =>
        document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? "";
      const viewport = document.querySelector<HTMLCanvasElement>(viewportSelector);
      const bounds = viewport?.getBoundingClientRect();
      const style = viewport === null ? null : getComputedStyle(viewport);
      const pointerLockElement = document.pointerLockElement;
      return {
        url: window.location.href,
        documentReadyState: document.readyState,
        uiSurface: document.body.dataset.uiSurface ?? null,
        surfacePlayState: document.body.dataset.surfacePlayState ?? null,
        locomotionState: document.body.dataset.locomotionState ?? null,
        pointerLockState: document.querySelector<HTMLElement>(".surface-play-ui")?.dataset.pointerLock ?? null,
        pointerLockElement: pointerLockElement?.getAttribute("aria-label") ?? pointerLockElement?.tagName ?? null,
        viewport: {
          ariaLabel: viewport?.getAttribute("aria-label") ?? null,
          visible: viewport !== null && bounds !== undefined && bounds.width > 0 && bounds.height > 0
            && style?.visibility !== "hidden" && style?.display !== "none",
          width: bounds?.width ?? 0,
          height: bounds?.height ?? 0
        },
        hud: {
          movement: text("#surface-play-movement"),
          grounded: text("#surface-play-grounded"),
          energy: text("#surface-play-energy-value"),
          weaponStatus: text("#surface-play-weapon-status"),
          heat: text("#surface-play-heat-value"),
          target: text("#surface-play-target"),
          action: text("#surface-play-action"),
          block: text("#surface-play-block")
        },
        testBridge: {
          ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
          inWindow: "TestBridge" in window
        }
      };
    }, SURFACE_PLAY_VIEWPORT);
  }

  async engagePointerLock(): Promise<SurfacePlayDomEvidence> {
    try {
      const engage = this.#page.getByRole("button", {
        name: /Click (?:to engage suit control|viewport to resume suit control)/,
        exact: true
      });
      await expect(engage).toBeVisible({ timeout: this.#interactionTimeoutMilliseconds });
      const bounds = await engage.boundingBox();
      if (bounds === null) throw new Error("Pointer-Lock control has no browser-space bounds.");
      this.#mousePosition = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      await engage.click();
      await this.#page.waitForFunction(
        (viewportSelector) => {
          const viewport = document.querySelector(viewportSelector);
          return viewport !== null && document.pointerLockElement === viewport
            && document.querySelector<HTMLElement>(".surface-play-ui")?.dataset.pointerLock === "engaged";
        },
        SURFACE_PLAY_VIEWPORT,
        { timeout: this.#interactionTimeoutMilliseconds }
      );
      await this.assertTestBridgeAbsent();
      return await this.readDomEvidence();
    } catch (error) {
      return await this.#failWithDiagnostics("engage real Pointer Lock", error);
    }
  }

  async holdMovement(key: SurfacePlayMovementKey, heldMilliseconds = 150): Promise<SurfacePlayMovementEvidence> {
    boundedDuration(heldMilliseconds, "heldMilliseconds", 5_000);
    try {
      await this.#requirePointerLock();
      const before = await this.readDomEvidence();
      await this.#page.keyboard.down(key);
      this.#heldKeys.add(key);
      await this.#page.waitForTimeout(heldMilliseconds);
      const during = await this.readDomEvidence();
      await this.#page.keyboard.up(key);
      this.#heldKeys.delete(key);
      await this.#page.waitForTimeout(34);
      return { key, heldMilliseconds, before, during, after: await this.readDomEvidence() };
    } catch (error) {
      if (this.#heldKeys.has(key)) {
        await this.#page.keyboard.up(key).catch(() => undefined);
        this.#heldKeys.delete(key);
      }
      return await this.#failWithDiagnostics(`hold real keyboard input ${key}`, error);
    }
  }

  async moveSequence(
    keys: readonly SurfacePlayMovementKey[],
    heldMilliseconds = 150
  ): Promise<readonly SurfacePlayMovementEvidence[]> {
    const evidence: SurfacePlayMovementEvidence[] = [];
    for (const key of keys) evidence.push(await this.holdMovement(key, heldMilliseconds));
    return evidence;
  }

  async aimByMouseDelta(deltaX: number, deltaY: number, steps = 4): Promise<SurfacePlayDomEvidence> {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) throw new TypeError("Mouse aim deltas must be finite.");
    if (!Number.isInteger(steps) || steps < 1 || steps > 20) {
      throw new RangeError("Mouse aim steps must be an integer from 1 through 20.");
    }
    try {
      await this.#requirePointerLock();
      const viewport = this.#page.viewportSize();
      if (viewport === null) throw new Error("Surface Play Driver requires an explicit viewport.");
      const current = this.#mousePosition ?? { x: viewport.width / 2, y: viewport.height / 2 };
      const next = {
        x: Math.max(2, Math.min(viewport.width - 2, current.x + deltaX)),
        y: Math.max(2, Math.min(viewport.height - 2, current.y + deltaY))
      };
      await this.#page.mouse.move(next.x, next.y, { steps });
      this.#mousePosition = next;
      await this.#page.waitForTimeout(34);
      return await this.readDomEvidence();
    } catch (error) {
      return await this.#failWithDiagnostics("aim with real mouse movement", error);
    }
  }

  async clickFire(): Promise<SurfacePlayDomEvidence> {
    try {
      await this.#requirePointerLock();
      const viewport = this.#page.viewportSize();
      if (viewport === null) throw new Error("Surface Play Driver requires an explicit viewport.");
      const position = this.#mousePosition ?? { x: viewport.width / 2, y: viewport.height / 2 };
      await this.#page.mouse.move(position.x, position.y);
      await this.#page.mouse.down({ button: "left" });
      this.#mouseButtonDown = true;
      await this.#page.waitForTimeout(16);
      await this.#page.mouse.up({ button: "left" });
      this.#mouseButtonDown = false;
      await this.#page.waitForTimeout(34);
      await this.assertTestBridgeAbsent();
      return await this.readDomEvidence();
    } catch (error) {
      if (this.#mouseButtonDown) {
        await this.#page.mouse.up({ button: "left" }).catch(() => undefined);
        this.#mouseButtonDown = false;
      }
      return await this.#failWithDiagnostics("fire with real mouse click", error);
    }
  }

  /** Presses F1 only when the caller's read-only debug DOM seam exists. */
  async toggleF1IfPresent(selector: string): Promise<OptionalF1ToggleEvidence> {
    const target = this.#page.locator(selector).first();
    if (await target.count() === 0) return { available: false, selector, before: null, after: null };
    const state = async (): Promise<NonNullable<OptionalF1ToggleEvidence["before"]>> =>
      target.evaluate((element) => ({
        hidden: (element as HTMLElement).hidden,
        ariaHidden: element.getAttribute("aria-hidden"),
        state: element.getAttribute("data-visible")
      }));
    const before = await state();
    await this.#page.keyboard.press("F1");
    await this.#page.waitForTimeout(34);
    return { available: true, selector, before, after: await state() };
  }

  async measureFrameAndLongTasks(durationMilliseconds = 500): Promise<SurfacePlayFrameSample> {
    boundedDuration(durationMilliseconds, "durationMilliseconds", 10_000);
    try {
      return await this.#page.evaluate(async (requestedDurationMilliseconds): Promise<SurfacePlayFrameSample> => {
        const frameTimes: number[] = [];
        const longTasks: { name: string; startTime: number; duration: number }[] = [];
        const longTaskSupported = PerformanceObserver.supportedEntryTypes.includes("longtask");
        let observer: PerformanceObserver | null = null;
        let animationFrame = 0;
        let deadline = 0;
        const startedAt = performance.now();
        try {
          if (longTaskSupported) {
            observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                longTasks.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration });
              }
            });
            observer.observe({ type: "longtask", buffered: false });
          }
          await new Promise<void>((resolveSample) => {
            let finished = false;
            const finish = (): void => {
              if (finished) return;
              finished = true;
              clearTimeout(deadline);
              if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
              resolveSample();
            };
            const frame = (timestamp: number): void => {
              frameTimes.push(timestamp);
              if (timestamp - startedAt >= requestedDurationMilliseconds) return finish();
              animationFrame = requestAnimationFrame(frame);
            };
            deadline = window.setTimeout(finish, requestedDurationMilliseconds + 1_000);
            animationFrame = requestAnimationFrame(frame);
          });
        } finally {
          observer?.disconnect();
          if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
          if (deadline !== 0) clearTimeout(deadline);
        }
        const intervals = frameTimes.slice(1).map((time, index) => time - frameTimes[index]!);
        const sorted = [...intervals].sort((left, right) => left - right);
        const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
        return {
          requestedDurationMilliseconds,
          observedDurationMilliseconds: performance.now() - startedAt,
          frameCount: frameTimes.length,
          frameIntervalMilliseconds: {
            mean: intervals.length === 0 ? 0 : intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
            p95: sorted[p95Index] ?? 0,
            maximum: intervals.reduce((maximum, value) => Math.max(maximum, value), 0)
          },
          longTaskSupported,
          longTasks,
          maximumLongTaskMilliseconds: longTasks.reduce((maximum, entry) => Math.max(maximum, entry.duration), 0)
        };
      }, durationMilliseconds);
    } catch (error) {
      return await this.#failWithDiagnostics("measure bounded frame and Long Task sample", error);
    }
  }

  async captureScreenshot(outputPath: string): Promise<string> {
    const absolutePath = resolve(outputPath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await this.#page.screenshot({ path: absolutePath, fullPage: false });
    return absolutePath;
  }

  async release(): Promise<SurfacePlayCleanupEvidence> {
    const releasedKeys = [...this.#heldKeys];
    for (const key of releasedKeys) {
      await this.#page.keyboard.up(key).catch(() => undefined);
      this.#heldKeys.delete(key);
    }
    const releasedMouseButton = this.#mouseButtonDown;
    if (this.#mouseButtonDown) {
      await this.#page.mouse.up({ button: "left" }).catch(() => undefined);
      this.#mouseButtonDown = false;
    }
    let pointerLockReleased = true;
    if (!this.#page.isClosed()) {
      await this.#page.evaluate(() => {
        if (document.pointerLockElement !== null) document.exitPointerLock();
      }).catch(() => undefined);
      pointerLockReleased = await this.#page.waitForFunction(
        () => document.pointerLockElement === null,
        undefined,
        { timeout: this.#interactionTimeoutMilliseconds }
      ).then(() => true, () => false);
    }
    this.#mousePosition = null;
    if (!pointerLockReleased) {
      return await this.#failWithDiagnostics("release Pointer Lock during cleanup", new Error("Pointer Lock remained active."));
    }
    return { releasedKeys, releasedMouseButton, pointerLockReleased };
  }

  async #requirePointerLock(): Promise<void> {
    const locked = await this.#page.evaluate(
      (viewportSelector) => document.pointerLockElement === document.querySelector(viewportSelector),
      SURFACE_PLAY_VIEWPORT
    );
    if (!locked) throw new Error("Real player input requires the Surface Play viewport to own Pointer Lock.");
  }

  async #failWithDiagnostics(label: string, cause: unknown): Promise<never> {
    let diagnostics: unknown;
    try {
      diagnostics = this.#page.isClosed() ? { pageClosed: true } : await this.readDomEvidence();
    } catch (diagnosticError) {
      diagnostics = {
        collectionFailed: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)
      };
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${label} failed: ${message}\nDOM diagnostics: ${JSON.stringify(diagnostics, null, 2)}`, { cause });
  }
}
