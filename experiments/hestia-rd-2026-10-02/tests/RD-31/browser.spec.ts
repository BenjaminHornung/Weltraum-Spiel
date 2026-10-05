import { test,expect,type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const entry='/src/experiments/rain/index.html';
const digest=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
async function state(page:Page){return JSON.parse((await page.locator('#facts').textContent())!);}
async function rendered(page:Page,tick:number){
  await page.waitForFunction((tick)=>{const v=JSON.parse(document.getElementById('facts')!.textContent!);return v.diagnostics?.rendered?.tick===tick&&v.diagnostics.rendered.fixtureDigest===v.facts.fixtureDigest
    &&v.diagnostics.rendered.frameVersion===v.diagnostics.frameVersion&&JSON.stringify(v.diagnostics.rendered.frame)===JSON.stringify(v.diagnostics.frame);},tick);
  return state(page);
}
async function seek(page:Page,tick:number){await page.locator('#tick').fill(String(tick));await page.locator('#seek').click();return rendered(page,tick);}
async function mount(page:Page,variant='source-query'){
  const response=await page.goto(entry);expect(digest(await response!.body())).toBe(digest(readFileSync(`dist${entry}`)));
  await expect(page.locator('#status')).toContainText('Bereit');await page.locator('#variant').selectOption(variant);await page.locator('#mount').click();
  await expect(page.locator('#status')).toContainText('Regen aktiv');return rendered(page,0);
}
test('RAIN01/RAIN02/RAIN03 built real rain: roof opening, same-camera seek restore, one renderer and bound unknown',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(String(error)));
  await mount(page);await page.locator('#pause').click();await expect(page.locator('#status')).toContainText('Pausiert');
  const closed=await seek(page,300);expect(closed.rain.clippedParticles).toBeGreaterThan(0);
  expect(closed.rain.visibleParticles).toBeGreaterThan(0);expect(closed.diagnostics.rendererInfo.calls).toBeGreaterThan(0);
  expect(closed.liveHosts).toMatchObject({renderers:1,renderloops:1});expect(closed.facts.errors).toEqual([]);
  expect(closed.rain.sourceFrame.basis).toBe('right-handed-y-up');expect(closed.rain.coverageBindings.length).toBe(2);
  expect(closed.rain.field.coverageBindings).toEqual(closed.rain.coverageBindings);
  expect(closed.facts.logicalCosts['effect-1-instanceUploadBytes'].value).toBe((768+64)*16*4);
  const image=await page.locator('#view').screenshot({path:info.outputPath('closed-t300.png')});
  const opened=await seek(page,420);expect(opened.facts.sourceRevision).toBe(1);expect(opened.rain.fixtureDigest).toBe(opened.facts.fixtureDigest);
  expect(opened.rain.field.columns.some((c:{hitDistanceMeters?:number},i:number)=>c.hitDistanceMeters!==closed.rain.field.columns[i].hitDistanceMeters)).toBe(true);
  expect(opened.diagnostics.frame.cameraId).toBe(closed.diagnostics.frame.cameraId);await page.locator('#view').screenshot({path:info.outputPath('open-t420.png')});
  const restored=await seek(page,300);expect(restored.rain).toEqual(closed.rain);
  expect(digest(await page.locator('#view').screenshot({path:info.outputPath('restored-t300.png')}))).toBe(digest(image));
  await page.locator('#weather').selectOption('gust-rain');const gust=await rendered(page,300);
  expect(gust.rain.direction).not.toEqual(closed.rain.direction);expect(gust.rain.fixtureDigest).toBe(closed.rain.fixtureDigest);
  await page.locator('#weather').selectOption('clear');const off=await rendered(page,300);expect(off.rain.coverage).toBe('not-sampled');expect(off.rain.field).toBeNull();
  expect(off.facts.logicalCosts['effect-1-instanceUploadBytes'].value).toBe((768+64)*16*4);
  expect(errors).toEqual([]);await info.attach('bound-states',{body:JSON.stringify({closed,opened,restored,gust,off,performance:'Q0_FUNCTIONAL_UNQUALIFIED',productIntegrated:false}),contentType:'application/json'});
});
test('RAIN05 built source/preset lifecycle: 20 mounts and 100 source transitions retain one canvas',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(error)=>errors.push(String(error)));await mount(page);
  await page.locator('#pause').click();await expect(page.locator('#status')).toContainText('Pausiert');
  const first=await state(page);
  for(let i=0;i<100;i++){const v=await seek(page,i%2?300:420);expect(v.liveHosts.renderers).toBe(1);expect(v.liveHosts.renderloops).toBe(1);expect(v.mounts).toBe(1);expect(v.diagnostics.rendererInfo.geometries).toBeLessThanOrEqual(first.diagnostics.rendererInfo.geometries);}
  for(let i=0;i<20;i++){
    await page.locator('#dispose').click();await expect(page.locator('#status')).toHaveText('Disposed');
    const disposed=await state(page);expect(disposed.mounts).toBe(0);expect(disposed.liveHosts).toEqual({renderers:0,renderloops:0,hostListeners:0});
    await page.locator('#mount').click();await expect(page.locator('#status')).toContainText('Regen aktiv');await rendered(page,0);
  }
  await page.locator('#dispose').click();await expect(page.locator('#status')).toHaveText('Disposed');expect(errors).toEqual([]);
  await info.attach('lifecycle',{body:JSON.stringify({mounts:20,sourceTransitions:100,final:await state(page),performance:'Q0_FUNCTIONAL_UNQUALIFIED',productIntegrated:false}),contentType:'application/json'});
});
