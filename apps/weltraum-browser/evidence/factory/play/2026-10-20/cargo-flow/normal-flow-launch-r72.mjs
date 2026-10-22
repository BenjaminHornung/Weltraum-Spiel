(async (page) => {
  // Ordinary UI helpers reused from normal-acceptance-launch-r43; no profiling or game-command injection.
  const host = page.context().browser();
  if (host.__fp06R72) throw new Error('Inspect or close the existing owned R72 browser first');
  const profile = 'E:/DEV/Weltraum-Spiel/FP06-FullFlow-20261020-R72';
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
    const before = await s.read(); if (before.status === 'Running') await p.keyboard.press('Escape');
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
    await p.bringToFront(); await p.getByRole('button', { name: 'Play', exact: true }).click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'); return n?.status === 'Running' && u?.host?.confirmed && document.pointerLockElement?.id === 'debug-scene'; }, null, { timeout: 5000 });
    return s.record('play');
  };
  s.closePlay = async () => {
    const close = p.getByRole('button', { name: 'Close', exact: true }); if (await close.isVisible()) await close.click();
    if (!(await p.getByRole('button', { name: 'Play', exact: true }).isVisible())) await p.keyboard.press('Escape');
    return s.play();
  };
  s.press = async (key, milliseconds) => {
    const before = await s.read();
    if (before.status !== 'Running' || before.input?.pressedKeys?.length) throw new Error('Movement needs confirmed neutral Running');
    await p.keyboard.down(key); try { await p.waitForTimeout(milliseconds); } finally { await p.keyboard.up(key); }
    await p.waitForFunction(tick => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), i = JSON.parse(d.hestiaPrototypeInput || 'null'), t = JSON.parse(d.hestiaFactoryInputTransport || 'null'); return n?.ticks > tick && i?.pressedKeys?.length === 0 && (!t || (t.pendingIds?.length === 0 && t.lastSentId === t.lastAckId && t.desiredLevel?.x === 0 && t.desiredLevel?.z === 0 && t.desiredLevel?.jump === false && t.desiredLevel?.sprint === false)); }, before.tick, { timeout: 5000 });
    return s.record('key', { key, milliseconds, before: { tick: before.tick, player: before.player } });
  };
  s.walk = async (axis, target, tolerance = 0.08) => {
    if (!['x', 'z'].includes(axis)) throw new Error('Only ordinary ground axes');
    let rate = 0.003, stalled = 0;
    for (let step = 0; step < 60; step++) {
      const before = await s.read(), delta = target - before.player[axis];
      if (Math.abs(delta) <= tolerance) return s.record('waypoint', { axis, target });
      const key = axis === 'x' ? (delta > 0 ? 'a' : 'd') : (delta > 0 ? 'w' : 's');
      const milliseconds = Math.max(1, Math.min(500, Math.round(Math.abs(delta) / rate * 0.75)));
      const after = await s.press(key, milliseconds), moved = Math.abs(after.player[axis] - before.player[axis]);
      stalled = moved < 0.001 ? stalled + 1 : 0;
      if (stalled >= 2) throw new Error('Normal path physically blocked at ' + JSON.stringify(after.player));
      if (moved > 0) rate = Math.max(0.001, moved / milliseconds);
    }
    throw new Error('Waypoint not reached with normal inputs');
  };
  s.pick = async name => {
    await s.panel('Cargo'); const open = p.getByRole('button', { name: 'Open cargo', exact: true });
    if (await open.isVisible()) await open.click();
    const quick = p.getByRole('button', { name: name + ' select', exact: true });
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
  s.close = async () => { s.events.push({ kind: 'actual-process-close', atUtc: new Date().toISOString() }); await context.close(); return { profile, pageClosed: p.isClosed(), disconnected: s.disconnected }; };
  host.__fp06R72 = s;
  await p.goto('http://127.0.0.1:5197/factory.html#full-flow-r72');
  await p.getByRole('button', { name: 'New game', exact: true }).waitFor({ state: 'visible', timeout: 20000 });
  await p.getByRole('button', { name: 'New game', exact: true }).click();
  await p.getByRole('button', { name: 'Open workshop', exact: true }).waitFor({ state: 'visible', timeout: 20000 });
  return s.record('new-game-zero-owners', { profile });
})
