// Reuses ordinary input helpers from R80 SHA256 06950cb86b51147cf97e4219145d9ad1b77eef11baab37391229d4b97d181620.
async (page) => {
  const host=page.context().browser(),old=host.__fp06Visual;
  if(!old||old.p.isClosed())throw Error('Existing owned headed Chrome required');
  const s={p:old.p,context:old.context,profile:old.profile,events:[],shots:[],errors:old.errors,requests:old.requests,originalSlot:old.before};
  const p=s.p;
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
    const play = p.getByRole('button', { name: 'Play', exact: true });
    await play.click();
    await p.waitForFunction(() => { const d = document.body.dataset, n = JSON.parse(d.hestiaPrototypePhysics || 'null'), u = JSON.parse(d.hestiaFactoryUi || 'null'), input = JSON.parse(d.hestiaPrototypeInput || 'null'); return n?.status === 'Running' && u?.host?.confirmed && u.host.input.active && input?.owner === 'Player' && document.pointerLockElement?.id === 'debug-scene'; }, null, { timeout: 5000 });
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
    // Raw pointer events also reach headless Chrome; observe heading without synthetic look alignment.
    return s.record('play', { orientation: await p.evaluate(() => JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera).orientation) });
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
      // Ground WASD ignores pitch; normalize both projected axes before combining diagonals.
      for (const vector of [forward, right]) { const length = Math.hypot(...vector); vector[0] /= length; vector[1] /= length; }
      const choices = [[['w'], forward], [['s'], forward.map(n => -n)], [['d'], right], [['a'], right.map(n => -n)]];
      for (const [f, r] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) choices.push([[f > 0 ? 'w' : 's', r > 0 ? 'd' : 'a'], [forward[0] * f + right[0] * r, forward[1] * f + right[1] * r]]);
      choices.sort((a, b) => (b[1][0] * dx + b[1][1] * dz) / Math.hypot(...b[1]) - (a[1][0] * dx + a[1][1] * dz) / Math.hypot(...a[1]));
      const after = await s.press(choices[0][0], Math.max(20, Math.min(80, Math.round(distance / 0.003 * 0.6))));
      const remaining = Math.hypot(destination.x - after.player.x, destination.z - after.player.z);
      stalled = Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z) < 0.001 ? stalled + 1 : 0;
      if (stalled >= 2) { await s.pause(); throw new Error('Normal path physically blocked at ' + JSON.stringify(after.player)); }
    }
    await s.pause();
    throw new Error('Waypoint not reached with normal inputs');
  };

  s.slot=old.slot;s.look=old.look;s.steer=old.steer;
  s.capture=async name=>{
    if(!/^[A-Z0-9_]+$/.test(name)||s.shots.some(v=>v.name===name))throw Error('Invalid or used capture name');
    const path='E:/DEV/Weltraum-Spiel/FP06-Candidate/apps/weltraum-browser/evidence/factory/play/2026-10-21/visual-repairs/'+name+'.png';
    const state=await s.read();
    const view=await p.evaluate(()=>{const d=document.body.dataset,f=JSON.parse(d.hestiaFactoryPresentation||'null');return{camera:JSON.parse(d.hestiaPrototypePlayerCamera||'null'),cost:f?.cost,scenes:f?.scenes,resources:JSON.parse(d.hestiaPrototypeResources||'null')};});
    await p.screenshot({path});s.shots.push({name,path,state,...view});return{name,path,state,cost:view.cost};
  };
  s.report=()=>({atUtc:new Date().toISOString(),originalSlot:s.originalSlot,events:s.events,shots:s.shots,errors:s.errors,requests:s.requests});
  host.__fp06Repairs=s;return{status:'ordinary input helpers installed',state:await s.read()};
}
