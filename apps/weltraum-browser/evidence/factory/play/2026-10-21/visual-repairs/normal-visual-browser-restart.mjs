async (page) => {
  const host = page.context().browser(), previous = host.__fp06Visual;
  if (!previous || previous.p.isClosed()) throw Error('Existing owned external Chrome required');
  const expected = 'a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0';
  const before = await previous.slot();
  if (before.payloadSha256 !== expected) throw Error('Original Save19 hash changed before restart');
  const state = await previous.read();
  if (state.status !== 'Paused') throw Error('Explicit Pause required before closing owned Chrome');
  const closure = { atUtc: new Date().toISOString(), profile: previous.profile, before, state, disconnected: false };
  previous.context.browser().once('disconnected', () => { closure.disconnected = true; });
  await previous.context.close();
  closure.pageClosed = previous.p.isClosed();
  if (!closure.pageClosed || !closure.disconnected) throw Error('Owned Chrome process did not disconnect');
  host.__fp06VisualHistory ??= [];
  host.__fp06VisualHistory.push({ previous, closure });
  const context = await host.browserType().launchPersistentContext(previous.profile, {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false,
    viewport: { width: 1249, height: 1221 }
  });
  const p = context.pages()[0] || await context.newPage();
  const v = { p, context, profile: previous.profile, before, errors: [], requests: [], shots: [], closure };
  p.on('pageerror', error => v.errors.push(error.message));
  p.on('requestfailed', request => v.errors.push(request.url() + ': ' + request.failure()?.errorText));
  p.on('response', response => { if (response.url().includes('/factory/')) v.requests.push({ url: response.url(), status: response.status() }); });
  v.read = () => p.evaluate(() => {
    const n = JSON.parse(document.body.dataset.hestiaPrototypePhysics || 'null');
    return { status: n?.status, tick: n?.ticks, player: n?.player?.position, bodyCount: n?.bodyCount, colliderCount: n?.colliderCount };
  });
  v.slot = () => p.evaluate(async () => {
    if (!(await indexedDB.databases()).some(database => database.name === 'weltraum-hestia-factory-v1')) throw Error('Existing DB missing');
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('weltraum-hestia-factory-v1');
      request.onupgradeneeded = () => { request.transaction.abort(); reject(Error('No DB upgrade')); };
      request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result);
    });
    const record = await new Promise((resolve, reject) => {
      const transaction = db.transaction('saveSlots', 'readonly'), request = transaction.objectStore('saveSlots').get('factory-primary');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); transaction.oncomplete = () => db.close();
    });
    const payloadSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', record.payloadBytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    return { metadata: record.metadata, payloadSha256 };
  });
  v.look = async (yaw, pitch = 0) => {
    if ((await v.read()).status === 'Running') await p.keyboard.press('Escape');
    await p.waitForFunction(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics || 'null')?.status === 'Paused');
    const q = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera || 'null')?.orientation);
    if (!q) throw Error('Camera needs one explicit Play before looking');
    const [x, y, z, w] = q, currentYaw = Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
    const currentPitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * x - y * z))));
    const deltaYaw = Math.atan2(Math.sin(yaw - currentYaw), Math.cos(yaw - currentYaw));
    const play = p.getByRole('button', { name: 'Play', exact: true }), box = await play.boundingBox();
    await play.click(); await p.waitForFunction(() => document.pointerLockElement?.id === 'debug-scene');
    await p.mouse.move(box.x + box.width / 2 - deltaYaw / .002, box.y + box.height / 2 - (pitch - currentPitch) / .002, { steps: 20 });
    return p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera || 'null'));
  };
  v.steer = async (yaw, pitch = 0) => { await v.look(yaw, pitch); await p.waitForTimeout(150); await v.look(yaw, pitch); await p.waitForTimeout(150); };
  host.__fp06Visual = v;
  await p.goto('http://127.0.0.1:5197/factory.html#visual-repair-cold-continue');
  const resume = p.getByRole('button', { name: 'Continue', exact: true });
  await resume.waitFor({ state: 'visible', timeout: 20000 });
  p.once('dialog', dialog => dialog.accept()); await resume.click();
  await p.waitForFunction(() => {
    const n = JSON.parse(document.body.dataset.hestiaPrototypePhysics || 'null'), ui = JSON.parse(document.body.dataset.hestiaFactoryUi || 'null');
    return n?.status === 'Paused' && ui?.host?.confirmed && ui.host.persistence.saveAvailable && !document.pointerLockElement;
  }, null, { timeout: 20000 });
  const after = await v.slot(), loaded = await v.read();
  if (after.payloadSha256 !== expected || loaded.tick !== 48547 || loaded.bodyCount !== 15 || loaded.colliderCount !== 200) throw Error('Save19 restart parity failed');
  return { status: 'actual external Chrome restart and ordinary Continue PASS', closure, loaded, after };
}
