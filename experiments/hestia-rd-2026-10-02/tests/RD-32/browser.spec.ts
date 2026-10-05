import { test,expect,type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const entry='/src/experiments/wet-surface/index.html',hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
async function state(page:Page){return JSON.parse((await page.locator('#facts').textContent())!);}
async function submitted(page:Page,tick:number){await page.waitForFunction((tick)=>{const v=JSON.parse(document.getElementById('facts')!.textContent!);return v.diagnostics?.rendered?.tick===tick
  &&v.diagnostics.rendered.frameVersion===v.diagnostics.frameVersion&&v.diagnostics.rendered.fixtureDigest===v.facts.fixtureDigest;},tick);return state(page);}
async function seek(page:Page,tick:number){await page.locator('#tick').fill(String(tick));await page.locator('#seek').click();await expect(page.locator('#status')).toHaveText('Seek angewendet');return submitted(page,tick);}
async function start(page:Page,scenario='F03-SHELTER-REPLAY'){const response=await page.goto(entry);expect(hash(await response!.body())).toBe(hash(readFileSync(`dist${entry}`)));
  await expect(page.locator('#status')).toContainText('Bereit');await page.locator('#scenario').selectOption(scenario);await page.locator('#mount').click();await expect(page.locator('#status')).toContainText('Nässe + Regen aktiv');return submitted(page,0);}
test('WET01/WET03/WET04/WET05 built shared rain/material route: protected/wet faces, opening, drying and exact dry/seek restore',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(String(e)));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  await start(page);await page.locator('#pause').click();await expect(page.locator('#status')).toHaveText('Pausiert');const dry=await submitted(page,0);
  const dryImage=await page.locator('#view').screenshot({path:info.outputPath('dry-t0.png')});
  const closed=await seek(page,300);expect(closed.wetness.result.protectedSamples).toBeGreaterThan(0);expect(closed.wetness.result.wetSamples).toBeGreaterThan(0);
  expect(closed.wetness.rain.visibleParticles).toBeGreaterThan(0);expect(closed.wetness.rain.clippedParticles).toBeGreaterThan(0);expect(closed.liveHosts).toMatchObject({renderers:1,renderloops:1});
  expect(closed.wetness.result.direction).toEqual(closed.wetness.rain.direction);await page.locator('#view').screenshot({path:info.outputPath('closed-wet-t300.png')});
  const opened=await seek(page,420);expect(opened.facts.sourceRevision).toBe(1);expect(opened.wetness.sourceStartTick).toBe(360);expect(opened.wetness.result.fixtureDigest).toBe(opened.facts.fixtureDigest);await page.locator('#view').screenshot({path:info.outputPath('opened-t420.png')});
  const wet=await seek(page,600),wetImage=await page.locator('#view').screenshot({path:info.outputPath('wet-t600.png')});expect(wet.wetness.result.wetSamples).toBeGreaterThan(0);
  const drying=await seek(page,1200);expect(drying.wetness.rain.visibleParticles).toBe(0);expect(drying.wetness.rain.field).toBeNull();expect(drying.wetness.result.maximumWetness01).toBeLessThan(wet.wetness.result.maximumWetness01);
  await page.locator('#view').screenshot({path:info.outputPath('drying-t1200.png')});
  const restored=await seek(page,600);expect(restored.wetness.result.samples).toEqual(wet.wetness.result.samples);expect(hash(await page.locator('#view').screenshot({path:info.outputPath('restored-wet-t600.png')}))).toBe(hash(wetImage));
  const restoredDry=await seek(page,0);expect(restoredDry.wetness.result).toBeNull();expect(hash(await page.locator('#view').screenshot({path:info.outputPath('restored-dry-t0.png')}))).toBe(hash(dryImage));
  await page.locator('#dispose').click();await expect(page.locator('#status')).toHaveText('Disposed');expect((await state(page)).liveHosts).toEqual({renderers:0,renderloops:0,hostListeners:0});expect(errors).toEqual([]);
  await info.attach('bound-wetness-states',{body:JSON.stringify({dry,closed,opened,wet,drying,restored,restoredDry,errors,performance:'Q0_FUNCTIONAL_UNQUALIFIED',productIntegrated:false}),contentType:'application/json'});
});
test('WET02/WET05 native source epoch and shader views remain bound for F06 opening and F04 rotation',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(String(e)));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  await start(page,'F06-MATERIAL-REPLAY');const material=await seek(page,600);expect(material.wetness.result.wetSamples).toBeGreaterThan(0);expect(material.wetness.result.protectedSamples).toBeGreaterThan(0);
  for(const view of ['wetness','roughness','normal','depth','color']){await page.locator('#viewMode').selectOption(view);await expect(page.locator('#status')).toHaveText('Ansicht angewendet');await submitted(page,600);await page.locator('#view').screenshot({path:info.outputPath(`f06-${view}-t600.png`)});}
  await page.locator('#dispose').click();await expect(page.locator('#status')).toHaveText('Disposed');
  await start(page,'F04-DETACH-REPLAY');const rotated=await seek(page,780);expect(rotated.facts.sourceRevision).toBe(2);expect(rotated.wetness.sourceStartTick).toBe(720);expect(rotated.wetness.result.fixtureDigest).toBe(rotated.facts.fixtureDigest);
  await page.locator('#view').screenshot({path:info.outputPath('f04-rotated-t780.png')});expect(errors).toEqual([]);
  await info.attach('bound-opening-rotation-states',{body:JSON.stringify({material,rotated,errors,performance:'Q0_FUNCTIONAL_UNQUALIFIED',productIntegrated:false}),contentType:'application/json'});
});
