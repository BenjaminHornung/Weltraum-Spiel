// Actual existing headed Chrome; ordinary input helpers, no game commands or save writes.
async (page) => {
  const fs = await import('node:fs');
  const crypto = await import('node:crypto');
  const host = page.context().browser(), old = host.__fp06Visual;
  if (!old || old.p.isClosed()) throw Error('Existing owned visual Chrome is required');
  const base = 'E:/DEV/Weltraum-Spiel/FP06-Candidate/apps/weltraum-browser/evidence/factory/play/2026-10-21/';
  const source = fs.readFileSync(base + 'walkable-hull/normal-flow-continue-r80.mjs', 'utf8');
  if (crypto.createHash('sha256').update(source).digest('hex') !== '06950cb86b51147cf97e4219145d9ad1b77eef11baab37391229d4b97d181620') throw Error('Input helper changed');
  const s = {p:old.p,context:old.context,profile:old.profile,events:[],shots:[],errors:old.errors,requests:old.requests,originalSlot:old.before};
  const start = source.indexOf('  s.read ='), end = source.indexOf('  s.pickup =');
  if (start < 0 || end <= start) throw Error('Input helper boundary missing');
  new Function('s','p',source.slice(start,end))(s,s.p);
  s.slot = old.slot;
  s.look = old.look;
  s.steer = old.steer;
  s.capture = async name => {
    if (!/^[A-Z0-9_]+$/.test(name)) throw Error('Invalid capture name');
    const path = base + 'visual-repairs/' + name + '.png';
    if (fs.existsSync(path)) throw Error('Capture already exists');
    const state = await s.read();
    const view = await s.p.evaluate(() => {
      const d=document.body.dataset,f=JSON.parse(d.hestiaFactoryPresentation||'null');
      return {camera:JSON.parse(d.hestiaPrototypePlayerCamera||'null'),cost:f?.cost,
        scenes:f?.scenes,resources:JSON.parse(d.hestiaPrototypeResources||'null')};
    });
    await s.p.screenshot({path});
    const shot={name,path,state,...view};s.shots.push(shot);return {name,path,state,cost:view.cost};
  };
  s.report = () => ({atUtc:new Date().toISOString(),originalSlot:s.originalSlot,events:s.events,shots:s.shots,errors:s.errors,requests:s.requests});
  host.__fp06Repairs=s;
  return {status:'ordinary input helpers installed',state:await s.read()};
}
