async (page) => {
  const host = page.context().browser(), recovered = host.__fp06Recovered;
  if (!recovered || recovered.p.isClosed()) throw Error('Owned recovered external Chrome required');
  const { p, context, profile } = recovered;
  const v = { p, context, profile, errors: [], requests: [], shots: [], before: null };
  p.on('pageerror', e => v.errors.push(e.message));
  p.on('requestfailed', r => v.errors.push(r.url() + ': ' + r.failure()?.errorText));
  p.on('response', r => { if (r.url().includes('/factory/')) v.requests.push({ url: r.url(), status: r.status() }); });
  v.read = () => p.evaluate(() => {
    const n = JSON.parse(document.body.dataset.hestiaPrototypePhysics || 'null');
    return { status: n?.status, tick: n?.ticks, player: n?.player?.position, bodyCount: n?.bodyCount, colliderCount: n?.colliderCount };
  });
  v.slot = () => p.evaluate(async () => {
    if (!(await indexedDB.databases()).some(d => d.name === 'weltraum-hestia-factory-v1')) throw Error('Existing DB missing');
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('weltraum-hestia-factory-v1');
      r.onupgradeneeded = () => { r.transaction.abort(); reject(Error('No DB upgrade')); };
      r.onerror = () => reject(r.error); r.onsuccess = () => resolve(r.result);
    });
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction('saveSlots', 'readonly'), r = tx.objectStore('saveSlots').get('factory-primary');
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); tx.oncomplete = () => db.close();
    });
    const payloadSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', record.payloadBytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    return { metadata: record.metadata, payloadSha256 };
  });
  v.look = async (yaw, pitch = 0) => {
    if ((await v.read()).status === 'Running') await p.keyboard.press('Escape');
    await p.waitForFunction(() => JSON.parse(document.body.dataset.hestiaPrototypePhysics || 'null')?.status === 'Paused', null, { timeout: 5000 });
    const q = await p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera || 'null')?.orientation);
    if (!q) throw Error('Camera needs one explicit Play');
    const [x, y, z, w] = q, currentYaw = Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
    const currentPitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * x - y * z))));
    const deltaYaw = Math.atan2(Math.sin(yaw - currentYaw), Math.cos(yaw - currentYaw));
    const play = p.getByRole('button', { name: 'Play', exact: true }), box = await play.boundingBox();
    await play.click({ timeout: 5000 });
    await p.waitForFunction(() => document.pointerLockElement?.id === 'debug-scene', null, { timeout: 5000 });
    await p.mouse.move(box.x + box.width / 2 - deltaYaw / .002, box.y + box.height / 2 - (pitch - currentPitch) / .002, { steps: 20 });
    return p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera || 'null'));
  };
  v.steer = async (yaw, pitch = 0) => { await v.look(yaw, pitch); await p.waitForTimeout(150); await v.look(yaw, pitch); await p.waitForTimeout(150); };
  host.__fp06Visual = v;
  await p.goto('http://127.0.0.1:5197/factory.html#visual-repair-r06-final');
  const resume = p.getByRole('button', { name: 'Continue', exact: true });
  await resume.waitFor({ state: 'visible', timeout: 20000 });
  v.before = await v.slot();
  if (v.before.payloadSha256 !== 'a2eccec1b71b982b45f069fbfde282c04aa8533d060191bc133672dc8121ecc0') throw Error('Original Save19 changed');
  p.once('dialog', d => d.accept()); await resume.click({ timeout: 5000 });
  await p.waitForFunction(() => {
    const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null');
    return n?.status === 'Paused' && u?.host?.confirmed && !document.pointerLockElement;
  }, null, { timeout: 20000 });
  const state = await v.read();
  if (state.tick !== 48547 || state.bodyCount !== 15 || state.colliderCount !== 200) throw Error('Saved Native parity failed');
  return { status: 'ordinary Continue into final V7 PASS', before: v.before, state };
}
