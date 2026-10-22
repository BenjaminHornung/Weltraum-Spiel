(async (page) => {
  const host = page.context().browser();
  if (host.__fp06Acceptance) throw new Error("Acceptance browser already registered; inspect or close it first");
  const profile = "E:/DEV/Weltraum-Spiel/FP06-Browser-Acceptance-20261017-R09";
  const context = await host.browserType().launchPersistentContext(profile, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true, viewport: { width: 1280, height: 720 },
    recordVideo: { dir: "E:/DEV/Weltraum-Spiel/FP06-Candidate/apps/weltraum-browser/evidence/factory/play/2026-10-15/review-continuation/acceptance-r09-video" }
  });
  const p = context.pages()[0] || await context.newPage();
  await p.addInitScript(() => {
    window.__fp06SaveMetrics = [];
    window.__fp06SaveMetricDrops = 0;
    window.__fp06SaveObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        if (!/^hvp\.factory(Save|Stage|Cold)(Admission|Rejected)$/.test(entry.name)) continue;
        if (window.__fp06SaveMetrics.length >= 2000) { window.__fp06SaveMetricDrops++; continue; }
        window.__fp06SaveMetrics.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration, detail: entry.detail });
      }
    });
    window.__fp06SaveObserver.observe({ type: "measure" });
  });
  const s = { context, p, profile, events: [], errors: [], disconnected: false };
  context.browser().on("disconnected", () => { s.disconnected = true; });
  p.on("pageerror", error => s.errors.push(error.message));
  s.read = () => p.evaluate(() => {
    const json = key => { const value = document.body.dataset[key]; return value ? JSON.parse(value) : null; };
    const physics = json("hestiaPrototypePhysics"), ui = json("hestiaFactoryUi"), construction = json("hestiaFactoryConstruction"), carrier = physics?.factoryFacilities?.carrier;
    return { at: performance.now(), tick: physics?.ticks, status: physics?.status, player: physics?.player?.position,
      input: json("hestiaPrototypeInput"), transport: json("hestiaFactoryInputTransport"),
      camera: json("hestiaPrototypePlayerCamera"), clock: json("hestiaPrototypePhysicsClock"),
      carrier: carrier ? { phase: carrier.phase, profileId: carrier.profileId, massKg: carrier.massKg, positionMm: carrier.positionMm } : null, facilityState: physics?.factoryFacilities?.state,
      facilityCount: physics?.factoryFacilities?.owners?.length, massMg: construction?.massMg,
      factorySteps: ui?.factorySteps, hostConfirmed: ui?.host?.confirmed,
      receipt: ui?.lastReceipt ? { commandId: ui.lastReceipt.commandId, status: ui.lastReceipt.status, reason: ui.lastReceipt.reason } : null,
      persistence: ui?.host?.persistence, power: ui?.power, testBridge: "TestBridge" in window };
  });
  s.record = async (kind, data = {}) => {
    const state = await s.read(); s.events.push({ kind, ...data, state });
    if (state.testBridge) throw new Error("Normal acceptance must not expose TestBridge");
    if (state.status && !["Running", "Paused"].includes(state.status)) throw new Error("Unexpected game stop: " + state.status);
    return state;
  };
  s.pause = async () => {
    const before = await s.read();
    if (before.status === "Running") await p.keyboard.press("Escape");
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || "null"), u = JSON.parse(d.hestiaFactoryUi || "null"); return n?.status === "Paused" && u?.host?.confirmed; }, null, { timeout: 5000 });
    return s.record("pause");
  };
  s.panel = async name => {
    await s.pause();
    const workshop = p.getByRole("button", { name: "Open workshop", exact: true });
    if (await workshop.isVisible()) await workshop.click();
    const views = p.getByRole("button", { name: "Views", exact: true });
    if (await views.getAttribute("aria-expanded") !== "true") await views.click();
    await p.getByRole("button", { name, exact: true }).click();
    return s.record("panel", { name });
  };
  s.play = async () => {
    await p.bringToFront();
    await p.getByRole("button", { name: "Play", exact: true }).click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || "null"), u = JSON.parse(d.hestiaFactoryUi || "null"); return n?.status === "Running" && u?.host?.confirmed && document.pointerLockElement?.id === "debug-scene"; }, null, { timeout: 5000 });
    return s.record("play");
  };
  s.closePlay = async () => {
    const close = p.getByRole("button", { name: "Close", exact: true });
    if (await close.isVisible()) await close.click();
    const play = p.getByRole("button", { name: "Play", exact: true });
    if (!(await play.isVisible())) await p.keyboard.press("Escape");
    return s.play();
  };
  s.press = async (key, milliseconds) => {
    const before = await s.read();
    if (before.status !== "Running" || before.input?.pressedKeys?.length) throw new Error("Movement needs confirmed neutral Running");
    await p.keyboard.down(key);
    try { await p.waitForTimeout(milliseconds); } finally { await p.keyboard.up(key); }
    await p.waitForFunction(tick => {
      const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || "null"), i = JSON.parse(d.hestiaPrototypeInput || "null"), t = JSON.parse(d.hestiaFactoryInputTransport || "null");
      return n?.ticks > tick && i?.pressedKeys?.length === 0 && (!t || (t.pendingIds?.length === 0 && t.lastSentId === t.lastAckId && t.desiredLevel?.x === 0 && t.desiredLevel?.z === 0 && t.desiredLevel?.jump === false && t.desiredLevel?.sprint === false));
    }, before.tick, { timeout: 5000 });
    return s.record("key", { key, milliseconds, before: { tick: before.tick, player: before.player } });
  };
  s.walk = async (axis, target, tolerance = 0.08) => {
    if (!["x", "z"].includes(axis)) throw new Error("Only normal ground axes");
    let previousMovementPerMs = 0.003, stalled = 0;
    for (let step = 0; step < 60; step++) {
      const before = await s.read(), delta = target - before.player[axis];
      if (Math.abs(delta) <= tolerance) return s.record("waypoint", { axis, target });
      const key = axis === "x" ? (delta > 0 ? "a" : "d") : (delta > 0 ? "w" : "s");
      const milliseconds = Math.max(1, Math.min(500, Math.round(Math.abs(delta) / previousMovementPerMs * 0.75)));
      const after = await s.press(key, milliseconds), moved = Math.abs(after.player[axis] - before.player[axis]);
      stalled = moved < 0.001 ? stalled + 1 : 0;
      if (stalled >= 2) throw new Error("Normal path physically blocked at " + JSON.stringify(after.player));
      if (moved > 0) previousMovementPerMs = Math.max(0.001, moved / milliseconds);
    }
    throw new Error("Waypoint not reached with normal inputs");
  };
  s.pick = async name => {
    await s.panel("Cargo");
    const open = p.getByRole("button", { name: "Open cargo", exact: true });
    if (await open.isVisible()) await open.click();
    const quick = p.getByRole("button", { name: name + " select", exact: true });
    if (await quick.isVisible()) await quick.click();
    else {
      const details = p.getByText("More transport packages", { exact: true });
      if (!(await p.getByLabel("Transport package", { exact: true }).isVisible())) await details.click();
      const options = await p.getByLabel("Transport package", { exact: true }).locator("option").evaluateAll(nodes => nodes.map(n => ({ value: n.value, label: n.label })));
      const matching = options.filter(option => option.label.startsWith(name + " · Wreck cargo "));
      if (matching.length !== 1) throw new Error("Select one observed cargo package: " + JSON.stringify(options));
      await p.getByLabel("Transport package", { exact: true }).selectOption(matching[0].value);
    }
    await p.getByRole("button", { name: "Pick up: " + name, exact: true }).click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || "null"), u = JSON.parse(d.hestiaFactoryUi || "null"); return n?.factoryFacilities?.carrier?.phase === "Carrying" && u?.host?.confirmed; }, null, { timeout: 5000 });
    return s.record("pickup", { name });
  };
  s.deposit = async () => {
    await s.panel("Cargo");
    await p.getByRole("button", { name: "Set down here", exact: true }).click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || "null"), u = JSON.parse(d.hestiaFactoryUi || "null"); return n?.factoryFacilities?.carrier?.phase === "Deposited" && u?.host?.confirmed; }, null, { timeout: 5000 });
    return s.record("deposit");
  };
  s.build = async name => {
    await s.panel("Build");
    const before = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryConstruction).installations.length);
    const preview = p.getByRole("button", { name: "Preview " + name, exact: true });
    if (!(await preview.isVisible())) await p.getByRole("button", { name: "Choose another facility", exact: true }).click();
    await preview.click();
    await p.waitForFunction(() => { const c = JSON.parse(document.body.dataset.hestiaFactoryConstruction || "null"); return c?.ghost && ["Prepared", "Rejected"].includes(c.ghost.status); }, null, { timeout: 5000 });
    const ghost = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryConstruction).ghost);
    if (ghost.status !== "Prepared") throw new Error("Ordinary build preview rejected: " + JSON.stringify(ghost));
    await p.getByRole("button", { name: "Confirm build", exact: true }).click();
    await p.waitForFunction(count => { const d = document.body.dataset, c = JSON.parse(d.hestiaFactoryConstruction || "null"), n = JSON.parse(d.hestiaPrototypePhysics || "null"), u = JSON.parse(d.hestiaFactoryUi || "null"); return c?.installations.length === count + 1 && n?.factoryFacilities?.state === "Idle" && u?.host?.confirmed; }, before, { timeout: 10000 });
    return s.record("paid-build", { name });
  };
  s.ui = () => p.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryUi || "null"));
  s.native = () => p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics || "null"));
  s.close = async () => { s.events.push({ kind: "actual-context-close", atUtc: new Date().toISOString() }); await context.close(); return { disconnected: s.disconnected, profile }; };
  host.__fp06Acceptance = s;
  return { registered: true, profile, url: p.url() };
})
