import { expect, test, type Page } from '@playwright/test';
// AUTHORED/TYPE-CHECKED ONLY. No server, port, browser or native execution is granted in Phase1.
const entry='/src/experiments/voxel-rays/index.html';
async function ready(page:Page) {
  await expect(page.locator('#status')).toContainText('Host render submitted');
}
test('RAY01: unabhängiges CPU-DDA-Oracle für Randtreffer, negative Richtung, Nullkomponente, innen startenden Strahl und Unknown',async({page})=>{
  await page.goto(`${entry}?testBridge=1`); await ready(page);
  const result=await page.evaluate(async()=> (window as any).TestBridge.probeCases());
  expect(result.results).toHaveLength(12);
  for (const {id,result:r} of result.results) { expect(r.status,`${id}: ${JSON.stringify(r)}`).toBe('PASS'); }
  for (const r of result.faults) { expect(r.status,JSON.stringify(r)).toBe('FAIL'); }
});
test('RAY02: Position/Depth/Material/Normal nach Edit stimmt mit belegter Quelle; keine geglättete SDF-Oberfläche',async({page})=>{
  await page.goto(`${entry}?testBridge=1`); await ready(page); await page.selectOption('#fixture','F06-MATERIAL-REPLAY'); await page.click('#remount'); await ready(page);
  const before=await page.evaluate(()=> (window as any).TestBridge.read());
  await page.fill('#tick','90'); await page.click('#seek'); await ready(page);
  const result=await page.evaluate(async()=>({state:(window as any).TestBridge.read(),edit:await (window as any).TestBridge.probeEdit('material-room')}));
  expect(result.state.facts.fixtureDigest).not.toBe(before.facts.fixtureDigest); expect(result.edit.positive.status,JSON.stringify(result.edit.positive)).toBe('PASS');
  expect(result.edit.stale.status,JSON.stringify(result.edit.stale)).toBe('FAIL'); expect(result.edit.proxy.status,JSON.stringify(result.edit.proxy)).toBe('FAIL');
});
test('RAY03: Transform eines lokalen Volumens ändert keine Source-ID; Kamera im Volumen und Überhang korrekt',async({page})=>{
  await page.goto(`${entry}?testBridge=1`); await ready(page); await page.selectOption('#fixture','F04-DETACH-REPLAY'); await page.click('#remount'); await ready(page);
  await page.fill('#tick','60'); await page.click('#seek'); await ready(page); const before=await page.evaluate(()=> (window as any).TestBridge.volumes());
  await page.fill('#tick','120'); await page.click('#seek'); await ready(page); const result=await page.evaluate(async()=>({volumes:(window as any).TestBridge.volumes(),
    inside:await (window as any).TestBridge.probe('fragment-wood',[0.9375,1.0625,0.3125],[0,1,0])}));
  expect(result.inside.status,JSON.stringify(result.inside)).toBe('PASS'); expect(result.inside.expected.t).toBeGreaterThan(0);
  const a=before.find((v:any)=>v.source.regionId==='fragment-wood'); const b=result.volumes.find((v:any)=>v.source.regionId==='fragment-wood');
  expect(b.source.sourceIds).toEqual(a.source.sourceIds); expect(b.source.ownerId).toBe(a.source.ownerId);
});
test('RAY04: GPU-Formatlimit oder Uploadüberlauf scheitert vor Allokation; alte Volumenversion wird nicht weitergezeichnet',async({page})=>{
  await page.goto(`${entry}?testBridge=1`); await ready(page);
  const failure=await page.evaluate(async()=>{ try { await (window as any).TestBridge.failReplacement(); return 'unexpected-success'; } catch(e) { return String(e); } });
  expect(failure).toMatch(/RGBA8UI|format/i); await expect(page.locator('#viewport')).toBeHidden();
  await expect.poll(()=>page.evaluate(()=> (window as any).TestBridge.read().diagnostics.terminal.disposed)).toBe(true);
  // Recovery is an explicit normal remount, not hidden reuse of an old snapshot.
  await page.click('#remount'); await ready(page); await expect(page.locator('#viewport')).toBeVisible();
});
test('normal controls, real greedy, source revisions, disposal, and no TestBridge on normal entry',async({page})=>{
  await page.goto(entry); await ready(page); expect(await page.evaluate(()=>Object.hasOwn(window,'TestBridge'))).toBe(false);
  await page.selectOption('#variant','greedy-no-ao'); await page.click('#remount'); await ready(page);
  await page.selectOption('#fixture','F03-SHELTER-REPLAY'); await page.click('#remount'); await ready(page);
  await page.fill('#tick','120'); await page.click('#seek'); await ready(page); await page.click('#reset'); await ready(page);
  await page.selectOption('#resolution','960x540'); await page.selectOption('#dpr','2'); await page.click('#pause'); await page.click('#step');
  await page.click('#dispose'); await expect(page.locator('#viewport')).toBeHidden(); await expect(page.locator('#status')).toContainText('Disposed');
});
test('selected F01 solid attachment depth / proxy fault under original translucent-water presentation; not an image-parity gate',async({page})=>{
  await page.goto(`${entry}?testBridge=1`);await ready(page);await page.selectOption('#fixture','F01-HVP-COAST-REPLAY');await page.click('#remount');await ready(page);
  const result=await page.evaluate(async()=>{
    const d=[3,-1.75,4];const len=Math.hypot(...d);const direction=d.map((n)=>n/len);const bridge=(window as any).TestBridge;
    return {state:bridge.read(),positive:await bridge.probe('coast-crop',[-2,1.25,-6],direction),proxy:await bridge.probe('coast-crop',[-2,1.25,-6],direction,'proxy-depth')};
  });
  expect(result.state.diagnostics.host.frame.cameraId).toBe('C02-SHORE');expect(result.state.facts.unsupportedFeatures).toContain('selected-f01-not-full-parity');
  expect(result.positive.status,JSON.stringify(result.positive)).toBe('PASS');expect(result.positive.device.classification).toBe('hardware-candidate');
  expect(result.positive.expected.status).toBe('hit');
  expect(result.positive.observed.attachmentDepth).toBeGreaterThan(0);expect(result.proxy.status,JSON.stringify(result.proxy)).toBe('FAIL');
  // Actual alpha/depth-water image comparison is still a separate Phase2 gate; never infer it from these numeric samples.
});
