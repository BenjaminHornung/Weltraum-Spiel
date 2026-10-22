(async (page) => {
  // Ordinary UI helpers reused from normal-acceptance-launch-r43; no profiling or game-command injection.
  const host = page.context().browser();
  if (host.__fp06R77) throw new Error('Inspect or close the existing owned R77 browser first');
  const profile = 'E:/DEV/Weltraum-Spiel/FP06-V6-FullFlow-20261021-R77';
  const context = await host.browserType().launchPersistentContext(profile, {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false,
    viewport: { width: 1249, height: 1221 }
  });
  const p = context.pages()[0] || await context.newPage();
  const s = { context, p, profile, events: [], errors: [], disconnected: false };
  context.browser().on('disconnected', () => { s.disconnected = true; });
  p.on('pageerror', e => s.errors.push(e.message));
  p.on('requestfailed', r => s.errors.push(r.url() + ': ' + r.failure()?.errorText));
  s.read = () => p.evaluate(() => {
    const read = key => JSON.parse(document.body.dataset[key] || 'null');
    const n = read('hestiaPrototypePhysics'), u = read('hestiaFactoryUi'), c = read('hestiaFactoryConstruction'), carrier = n?.factoryFacilities?.carrier;
    return { tick: n?.ticks, status: n?.status, player: n?.player?.position, input: read('hestiaPrototypeInput'),
      transport: read('hestiaFactoryInputTransport'), hostConfirmed: u?.host?.confirmed, host: u?.host,
      clock: read('hestiaPrototypePhysicsClock'), bodyCount: n?.bodyCount, colliderCount: n?.colliderCount,
      carrier: carrier ? { phase: carrier.phase, profileId: carrier.profileId, massKg: carrier.nativeMassKg, positionMm: carrier.positionMm } : null,
      facilityState: n?.factoryFacilities?.state, facilityCount: n?.factoryFacilities?.owners?.length,
      massMg: c?.massMg, factorySteps: u?.factorySteps, interaction: u?.interaction,
      receipt: u?.lastReceipt ? { commandId: u.lastReceipt.commandId, status: u.lastReceipt.status, reason: u.lastReceipt.reason } : null,
      persistence: u?.host?.persistence, power: u?.power, testBridge: 'TestBridge' in window };
  });
  s.record = async (kind, data = {}) => {
    const state = await s.read(); s.events.push({ kind, ...data, state });
    if (state.testBridge || (state.status && !['Running', 'Paused'].includes(state.status))) throw new Error('Unexpected normal-play state: ' + state.status);
    return state;
  };
  s.pause = async () => {
    const before = await s.read();
    if (before.status === 'Running') {
      await p.bringToFront();
      await p.keyboard.down('Escape');
      try { await p.waitForTimeout(100); } finally { await p.keyboard.up('Escape'); }
    }
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'); return n?.status === 'Paused' && u?.host?.confirmed; }, null, { timeout: 5000 });
    return s.record('pause');
  };
  s.panel = async name => {
    await s.pause(); const workshop = p.getByRole('button', { name: 'Open workshop', exact: true });
    if (await workshop.isVisible()) await workshop.click();
    const views = p.getByRole('button', { name: 'Views', exact: true });
    if (await views.getAttribute('aria-expanded') !== 'true') await views.click();
    await p.getByRole('button', { name, exact: true }).click(); return s.record('panel', { name });
  };
  s.play = async () => {
    await p.bringToFront();
    const play = p.getByRole('button', { name: 'Play', exact: true }), box = await play.boundingBox();
    await play.click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'); return n?.status === 'Running' && u?.host?.confirmed && document.pointerLockElement?.id === 'debug-scene'; }, null, { timeout: 5000 });
    const q = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera).orientation);
    const [x, y, z, w] = q, yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y));
    const dx = Math.round(-Math.atan2(Math.sin(Math.PI - yaw), Math.cos(Math.PI - yaw)) / 0.002);
    // Ordinary captured mouse-look keeps the established narrow route aligned; never set the camera/world directly.
    if (dx) await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2);
    await p.waitForFunction(() => { const [x, y, z, w] = JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera).orientation, yaw = Math.atan2(2 * (w * y + x * z), 1 - 2 * (x * x + y * y)); return Math.abs(Math.atan2(Math.sin(Math.PI - yaw), Math.cos(Math.PI - yaw))) < 0.02; }, null, { timeout: 5000 });
    return s.record('play', { normalCapturedLookDx: dx });
  };
  s.closePlay = async () => {
    const close = p.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click();
    if (!(await p.getByRole('button', { name: 'Play', exact: true }).isVisible())) await p.keyboard.press('Escape');
    return s.play();
  };
  s.press = async (key, milliseconds) => {
    const before = await s.read();
    if (before.status !== 'Running' || before.input?.pressedKeys?.length) throw new Error('Movement needs confirmed neutral Running');
    const keys = Array.isArray(key) ? key : [key];
    for (const value of keys) await p.keyboard.down(value);
    try { await p.waitForTimeout(milliseconds); } finally { for (const value of [...keys].reverse()) await p.keyboard.up(value); }
    await p.waitForFunction(tick => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), i = JSON.parse(d.hestiaPrototypeInput || 'null'), t = JSON.parse(d.hestiaFactoryInputTransport || 'null'); return n?.ticks > tick && i?.pressedKeys?.length === 0 && (!t || (t.pendingIds?.length === 0 && t.lastSentId === t.lastAckId && t.desiredLevel?.x === 0 && t.desiredLevel?.z === 0 && t.desiredLevel?.jump === false && t.desiredLevel?.sprint === false)); }, before.tick, { timeout: 5000 });
    return s.record('key', { key, milliseconds, before: { tick: before.tick, player: before.player } });
  };
  s.walk = async (axis, target, tolerance = 0.08) => {
    if (!['x', 'z'].includes(axis)) throw new Error('Only ordinary ground axes');
    const initial = await s.read(), destination = { x: initial.player.x, z: initial.player.z }; destination[axis] = target;
    let stalled = 0;
    for (let step = 0; step < 60; step++) {
      const before = await s.read(), dx = destination.x - before.player.x, dz = destination.z - before.player.z, distance = Math.hypot(dx, dz);
      if (distance <= tolerance) return s.record('waypoint', { axis, target, destination });
      const q = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera).orientation);
      const [x, y, z, w] = q, forward = [-2 * (x * z + w * y), -(1 - 2 * (x * x + y * y))], right = [1 - 2 * (y * y + z * z), 2 * (x * z - w * y)];
      const choices = [[['w'], forward], [['s'], forward.map(n => -n)], [['d'], right], [['a'], right.map(n => -n)]];
      for (const [f, r] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) choices.push([[f > 0 ? 'w' : 's', r > 0 ? 'd' : 'a'], [forward[0] * f + right[0] * r, forward[1] * f + right[1] * r]]);
      choices.sort((a, b) => (b[1][0] * dx + b[1][1] * dz) / Math.hypot(...b[1]) - (a[1][0] * dx + a[1][1] * dz) / Math.hypot(...a[1]));
      const after = await s.press(choices[0][0], Math.max(20, Math.min(250, Math.round(distance / 0.003 * 0.6))));
      const remaining = Math.hypot(destination.x - after.player.x, destination.z - after.player.z);
      stalled = Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z) < 0.001 ? stalled + 1 : 0;
      if (stalled >= 2) { await s.pause(); throw new Error('Normal path physically blocked at ' + JSON.stringify(after.player)); }
    }
    await s.pause();
    throw new Error('Waypoint not reached with normal inputs');
  };
  s.pick = async name => {
    await s.panel('Cargo'); const open = p.getByRole('button', { name: 'Open cargo', exact: true });
    if (await open.isVisible()) await open.click();
    const quick = p.locator('.factory-package-choices').getByRole('button', { name: name + ' select', exact: true });
    if (await quick.isVisible()) await quick.click(); else {
      if (!(await p.getByLabel('Transport package', { exact: true }).isVisible())) await p.getByText('More transport packages', { exact: true }).click();
      const options = await p.getByLabel('Transport package', { exact: true }).locator('option').evaluateAll(es => es.map(e => ({ value: e.value, label: e.label })));
      const matches = options.filter(o => o.label.startsWith(name + ' · Wreck cargo '));
      if (matches.length !== 1) throw new Error('Choose one observed cargo package: ' + JSON.stringify(options));
      await p.getByLabel('Transport package', { exact: true }).selectOption(matches[0].value);
    }
    await p.getByRole('button', { name: 'Pick up: ' + name, exact: true }).click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'); return n?.factoryFacilities?.carrier?.phase === 'Carrying' && u?.host?.confirmed; }, null, { timeout: 5000 });
    return s.record('pickup', { name });
  };
  s.deposit = async () => {
    await s.panel('Cargo'); await p.getByRole('button', { name: 'Set down here', exact: true }).click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'); return n?.factoryFacilities?.carrier?.phase === 'Deposited' && u?.host?.confirmed; }, null, { timeout: 5000 });
    return s.record('deposit');
  };
  s.build = async name => {
    await s.panel('Build'); const before = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryConstruction).installations.length);
    const preview = p.getByRole('button', { name: 'Preview ' + name, exact: true });
    if (!(await preview.isVisible())) await p.getByRole('button', { name: 'Choose another facility', exact: true }).click();
    await preview.click();
    await p.waitForFunction(() => { const c = JSON.parse(document.body.dataset.hestiaFactoryConstruction || 'null'); return c?.ghost && ['Prepared', 'Rejected'].includes(c.ghost.status); }, null, { timeout: 5000 });
    const ghost = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryConstruction).ghost);
    if (ghost.status !== 'Prepared') throw new Error('Ordinary build preview rejected: ' + JSON.stringify(ghost));
    await p.getByRole('button', { name: 'Confirm build', exact: true }).click();
    await p.waitForFunction(count => { const d = document.body.dataset, c = JSON.parse(d.hestiaFactoryConstruction || 'null'), n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'); return c?.installations.length === count + 1 && n?.factoryFacilities?.state === 'Idle' && u?.host?.confirmed; }, before, { timeout: 10000 });
    return s.record('paid-build', { name });
  };
  s.ui = () => p.evaluate(() => JSON.parse(document.body.dataset.hestiaFactoryUi || 'null'));
  s.slot = () => p.evaluate(async () => {
    const name = 'weltraum-hestia-factory-v1';
    if (!(await indexedDB.databases()).some(d => d.name === name)) throw new Error('No existing Factory database');
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open(name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onupgradeneeded = () => { r.transaction.abort(); reject(new Error('Read must not create/upgrade database')); }; });
    const record = await new Promise((resolve, reject) => { const tx = db.transaction('saveSlots', 'readonly'), r = tx.objectStore('saveSlots').get('factory-primary'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); tx.oncomplete = () => db.close(); });
    if (!record) throw new Error('No Factory slot');
    const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value) : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    const envelope = JSON.parse(new TextDecoder().decode(record.payloadBytes)), cp = envelope.player.data.factory;
    const hashes = {}; for (const key of ['native', 'nativeFactory', 'profiles', 'host', 'factory']) hashes[key] = await digest(new TextEncoder().encode(canonical(cp[key])));
    const { publicationRevision, ...rest } = cp.factory;
    hashes.factoryExceptPublication = await digest(new TextEncoder().encode(canonical(rest)));
    return { metadata: record.metadata, payloadSha256: await digest(record.payloadBytes), version: cp.version, signature: cp.signature, host: cp.host, hashes, installationCount: cp.factory.installations.length };
  });
  s.save = async () => {
    await s.pause();
    const close = p.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click();
    const save = p.getByRole('button', { name: 'Save', exact: true }); if (!(await save.isVisible())) await p.keyboard.press('Escape');
    const before = await s.read(), revision = before.persistence.revision ?? 0;
    if (!(await save.isEnabled())) throw new Error('Explicit Save unavailable');
    await save.click();
    // Verification observation only: the full successful save exceeded 10s; all product deadlines remain unchanged.
    await p.waitForFunction(previous => { const v = JSON.parse(document.body.dataset.hestiaFactoryUi).host.persistence; return ['Rejected', 'RecoveryHold'].includes(v.state) || (v.state === 'Saved' && v.revision > previous); }, revision, { timeout: 20000 });
    const after = await s.record('explicit-save-new-revision'), slot = await s.slot();
    if (after.persistence.state !== 'Saved' || slot.metadata.recordRevision !== revision + 1 || slot.host.nativeTick !== before.tick || slot.installationCount !== before.facilityCount) throw new Error('Save did not acknowledge the current confirmed state');
    return slot;
  };
  s.close = async () => { s.events.push({ kind: 'actual-process-close', atUtc: new Date().toISOString() }); await context.close(); return { profile, pageClosed: p.isClosed(), disconnected: s.disconnected }; };
  host.__fp06R77 = s;
  await p.goto('http://127.0.0.1:5197/factory.html#v6-full-flow-r77');
  await p.getByRole('button', { name: 'New game', exact: true }).waitFor({ state: 'visible', timeout: 20000 });
  await p.getByRole('button', { name: 'New game', exact: true }).click();
  await p.getByRole('button', { name: 'Open workshop', exact: true }).waitFor({ state: 'visible', timeout: 20000 });
  return s.record('new-game-zero-owners', { profile });
})
