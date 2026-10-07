# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: native.spec.ts >> RAY03: Transform eines lokalen Volumens ändert keine Source-ID; Kamera im Volumen und Überhang korrekt
- Location: ..\..\tests\RD-13\native.spec.ts:22:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Matcher error: received value must be a number or bigint

Received has value: undefined
```

# Page snapshot

```yaml
- main [ref=e2]:
  - heading "RD13 · bounded voxel rays / actual greedy control" [level=1] [ref=e3]
  - paragraph [ref=e4]: Lab projection only · productIntegrated=false · native qualification pending · no performance or art-parity claim.
  - paragraph [ref=e5]: Both variants use the same original slots and selected occupancy, without face AO. F01 is a frozen 64³ terrain window plus original water; vegetation is omitted. Outside coverage stays Unknown.
  - generic [ref=e6]:
    - text: Fixture
    - combobox "Fixture" [ref=e7]:
      - option "F00-CONTROL-REPLAY"
      - option "F01-HVP-COAST-REPLAY"
      - option "F03-SHELTER-REPLAY"
      - option "F04-DETACH-REPLAY" [selected]
      - option "F05-CUTOUT-REPLAY"
      - option "F06-MATERIAL-REPLAY"
  - generic [ref=e8]:
    - text: Variant
    - combobox "Variant" [ref=e9]:
      - option "WebGL2 DDA rays · no AO" [selected]
      - option "Real greedy mesh · no AO"
  - button "Remount selected source / recover explicitly" [ref=e10]
  - generic [ref=e11]:
    - generic [ref=e12]:
      - text: Camera
      - combobox "Camera" [ref=e13]:
        - option "far" [selected]
        - option "medium"
        - option "near"
    - generic [ref=e14]:
      - text: Tick
      - spinbutton "Tick" [ref=e15]: "120"
    - button "Seek" [ref=e16]
    - button "Step +1" [ref=e17]
    - button "Pause" [ref=e18]
    - button "Reset" [ref=e19]
    - generic [ref=e20]:
      - text: Resolution
      - combobox "Resolution" [ref=e21]:
        - option "1280×720" [selected]
        - option "960×540"
        - option "640×360"
    - generic [ref=e22]:
      - text: DPR
      - combobox "DPR" [ref=e23]:
        - option "1" [selected]
        - option "2"
    - button "Dispose" [ref=e24]
  - status [ref=e25]: Host render submitted. Native numeric/image/depth-water qualification still NOT RUN; this is not an art/performance PASS.
  - generic "RD13 lab projection" [ref=e26]
  - group [ref=e27]:
    - generic "Source, costs, unsupported features and failure history" [ref=e28]
```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test';
  2  | // AUTHORED/TYPE-CHECKED ONLY. No server, port, browser or native execution is granted in Phase1.
  3  | const entry='/src/experiments/voxel-rays/index.html';
  4  | async function ready(page:Page) {
  5  |   await expect(page.locator('#status')).toContainText('Host render submitted');
  6  | }
  7  | test('RAY01: unabhängiges CPU-DDA-Oracle für Randtreffer, negative Richtung, Nullkomponente, innen startenden Strahl und Unknown',async({page})=>{
  8  |   await page.goto(`${entry}?testBridge=1`); await ready(page);
  9  |   const result=await page.evaluate(async()=> (window as any).TestBridge.probeCases());
  10 |   expect(result.results).toHaveLength(12);
  11 |   for (const {id,result:r} of result.results) { expect(r.status,`${id}: ${JSON.stringify(r)}`).toBe('PASS'); }
  12 |   for (const r of result.faults) { expect(r.status,JSON.stringify(r)).toBe('FAIL'); }
  13 | });
  14 | test('RAY02: Position/Depth/Material/Normal nach Edit stimmt mit belegter Quelle; keine geglättete SDF-Oberfläche',async({page})=>{
  15 |   await page.goto(`${entry}?testBridge=1`); await ready(page); await page.selectOption('#fixture','F06-MATERIAL-REPLAY'); await page.click('#remount'); await ready(page);
  16 |   const before=await page.evaluate(()=> (window as any).TestBridge.read());
  17 |   await page.fill('#tick','90'); await page.click('#seek'); await ready(page);
  18 |   const result=await page.evaluate(async()=>({state:(window as any).TestBridge.read(),edit:await (window as any).TestBridge.probeEdit('material-room')}));
  19 |   expect(result.state.facts.fixtureDigest).not.toBe(before.facts.fixtureDigest); expect(result.edit.positive.status,JSON.stringify(result.edit.positive)).toBe('PASS');
  20 |   expect(result.edit.stale.status,JSON.stringify(result.edit.stale)).toBe('FAIL'); expect(result.edit.proxy.status,JSON.stringify(result.edit.proxy)).toBe('FAIL');
  21 | });
  22 | test('RAY03: Transform eines lokalen Volumens ändert keine Source-ID; Kamera im Volumen und Überhang korrekt',async({page})=>{
  23 |   await page.goto(`${entry}?testBridge=1`); await ready(page); await page.selectOption('#fixture','F04-DETACH-REPLAY'); await page.click('#remount'); await ready(page);
  24 |   await page.fill('#tick','60'); await page.click('#seek'); await ready(page); const before=await page.evaluate(()=> (window as any).TestBridge.volumes());
  25 |   await page.fill('#tick','120'); await page.click('#seek'); await ready(page); const result=await page.evaluate(async()=>({volumes:(window as any).TestBridge.volumes(),
  26 |     inside:await (window as any).TestBridge.probe('fragment-wood',[0.9375,1.0625,0.3125],[0,1,0])}));
> 27 |   expect(result.inside.status,JSON.stringify(result.inside)).toBe('PASS'); expect(result.inside.expected.t).toBeGreaterThan(0);
     |                                                                                                             ^ Error: expect(received).toBeGreaterThan(expected)
  28 |   const a=before.find((v:any)=>v.source.regionId==='fragment-wood'); const b=result.volumes.find((v:any)=>v.source.regionId==='fragment-wood');
  29 |   expect(b.source.sourceIds).toEqual(a.source.sourceIds); expect(b.source.ownerId).toBe(a.source.ownerId);
  30 | });
  31 | test('RAY04: GPU-Formatlimit oder Uploadüberlauf scheitert vor Allokation; alte Volumenversion wird nicht weitergezeichnet',async({page})=>{
  32 |   await page.goto(`${entry}?testBridge=1`); await ready(page);
  33 |   const failure=await page.evaluate(async()=>{ try { await (window as any).TestBridge.failReplacement(); return 'unexpected-success'; } catch(e) { return String(e); } });
  34 |   expect(failure).toMatch(/RGBA8UI|format/i); await expect(page.locator('#viewport')).toBeHidden();
  35 |   await expect.poll(()=>page.evaluate(()=> (window as any).TestBridge.read().diagnostics.terminal.disposed)).toBe(true);
  36 |   // Recovery is an explicit normal remount, not hidden reuse of an old snapshot.
  37 |   await page.click('#remount'); await ready(page); await expect(page.locator('#viewport')).toBeVisible();
  38 | });
  39 | test('normal controls, real greedy, source revisions, disposal, and no TestBridge on normal entry',async({page})=>{
  40 |   await page.goto(entry); await ready(page); expect(await page.evaluate(()=>Object.hasOwn(window,'TestBridge'))).toBe(false);
  41 |   await page.selectOption('#variant','greedy-no-ao'); await page.click('#remount'); await ready(page);
  42 |   await page.selectOption('#fixture','F03-SHELTER-REPLAY'); await page.click('#remount'); await ready(page);
  43 |   await page.fill('#tick','120'); await page.click('#seek'); await ready(page); await page.click('#reset'); await ready(page);
  44 |   await page.selectOption('#resolution','960x540'); await page.selectOption('#dpr','2'); await page.click('#pause'); await page.click('#step');
  45 |   await page.click('#dispose'); await expect(page.locator('#viewport')).toBeHidden(); await expect(page.locator('#status')).toContainText('Disposed');
  46 | });
  47 | test('selected F01 solid attachment depth / proxy fault under original translucent-water presentation; not an image-parity gate',async({page})=>{
  48 |   await page.goto(`${entry}?testBridge=1`);await ready(page);await page.selectOption('#fixture','F01-HVP-COAST-REPLAY');await page.click('#remount');await ready(page);
  49 |   const result=await page.evaluate(async()=>{
  50 |     const d=[3,-1.75,4];const len=Math.hypot(...d);const direction=d.map((n)=>n/len);const bridge=(window as any).TestBridge;
  51 |     return {state:bridge.read(),positive:await bridge.probe('coast-crop',[-2,1.25,-6],direction),proxy:await bridge.probe('coast-crop',[-2,1.25,-6],direction,'proxy-depth')};
  52 |   });
  53 |   expect(result.state.diagnostics.host.frame.cameraId).toBe('C02-SHORE');expect(result.state.facts.unsupportedFeatures).toContain('selected-f01-not-full-parity');
  54 |   expect(result.positive.status,JSON.stringify(result.positive)).toBe('PASS');expect(result.positive.device.classification).toBe('hardware-candidate');
  55 |   expect(result.positive.expected.status).toBe('hit');
  56 |   expect(result.positive.observed.attachmentDepth).toBeGreaterThan(0);expect(result.proxy.status,JSON.stringify(result.proxy)).toBe('FAIL');
  57 |   // Actual alpha/depth-water image comparison is still a separate Phase2 gate; never infer it from these numeric samples.
  58 | });
  59 | 
```