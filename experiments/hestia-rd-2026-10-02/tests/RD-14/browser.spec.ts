import { test,expect,type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const entry='/src/experiments/material-light/index.html',hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
async function state(page:Page){return JSON.parse((await page.locator('#facts').textContent())!);}
async function submitted(page:Page,version?:number){await page.waitForFunction((expected)=>{const v=JSON.parse(document.getElementById('facts')!.textContent!);return v.diagnostics?.rendered&&v.diagnostics.rendered.frameVersion===v.diagnostics.frameVersion
  &&(expected===null||v.diagnostics.rendered.frameVersion===expected)&&v.diagnostics.rendered.fixtureDigest===v.facts.fixtureDigest;},version??null);return state(page);}
async function start(page:Page,scenario='F06-MATERIAL-REPLAY'){const response=await page.goto(entry);expect(hash(await response!.body())).toBe(hash(readFileSync(`dist${entry}`)));
  await expect(page.locator('#status')).toContainText('Bereit');await page.locator('#scenario').selectOption(scenario);await page.locator('#mount').click();await expect(page.locator('#status')).toContainText('Materiallabor aktiv');return submitted(page);}
test('MAT01/MAT02/MAT03/MAT04 built material: native shaders, actual wet/normal/depth/roughness views, source opening and dispose',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(String(e)));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  const dry=await start(page);expect(dry.diagnostics.rendererInfo.calls).toBeGreaterThan(0);expect(dry.liveHosts).toMatchObject({renderers:1,renderloops:1});
  const dryImage=await page.locator('#view').screenshot({path:info.outputPath('dry-color.png')});
  await page.locator('#wetness').fill('0.8');await page.locator('#wetness').dispatchEvent('change');await expect(page.locator('#status')).toHaveText('Materialparameter angewendet');
  const wet=await submitted(page),wetImage=await page.locator('#view').screenshot({path:info.outputPath('wet-color.png')});
  expect(wet.facts.fixtureDigest).toBe(dry.facts.fixtureDigest);expect(wet.diagnostics.frame).toEqual(dry.diagnostics.frame);expect(wet.diagnostics.frameVersion).toBeGreaterThan(dry.diagnostics.frameVersion);expect(hash(wetImage)).not.toBe(hash(dryImage));
  for(const mode of ['normal','depth','roughness','wetness']){await page.locator('#viewMode').selectOption(mode);const v=await submitted(page);expect(v.material.viewMode).toBe(mode);await page.locator('#view').screenshot({path:info.outputPath(`${mode}.png`)});}
  await page.locator('#viewMode').selectOption('color');await submitted(page);await page.locator('#tick').fill('420');await page.locator('#seek').click();await expect(page.locator('#status')).toHaveText('Seek angewendet');
  const opened=await submitted(page);expect(opened.facts.sourceRevision).toBe(1);await page.locator('#view').screenshot({path:info.outputPath('opened-wet-color.png')});
  await page.locator('#dispose').click();await expect(page.locator('#status')).toHaveText('Disposed');expect((await state(page)).liveHosts).toEqual({renderers:0,renderloops:0,hostListeners:0});
  expect(errors).toEqual([]);await info.attach('bound-material-states',{body:JSON.stringify({dry,wet,opened,errors,productIntegrated:false,performance:'Q0_FUNCTIONAL_UNQUALIFIED'}),contentType:'application/json'});
});
test('MAT03/MAT04 native F04 detach/rotation and F01 translucent water shader use the same material owner',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(String(e)));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  await start(page,'F04-DETACH-REPLAY');await page.locator('#tick').fill('720');await page.locator('#seek').click();await expect(page.locator('#status')).toHaveText('Seek angewendet');
  const detached=await submitted(page);expect(detached.facts.sourceRevision).toBe(2);await page.locator('#view').screenshot({path:info.outputPath('f04-rotated.png')});
  await page.locator('#dispose').click();await expect(page.locator('#status')).toHaveText('Disposed');
  const coast=await start(page,'F01-HVP-COAST-REPLAY');await page.locator('#weather').selectOption('rain');await expect(page.locator('#status')).toHaveText('Frameinput angewendet');
  await page.locator('#tick').fill('60');await page.locator('#seek').click();await expect(page.locator('#status')).toHaveText('Seek angewendet');
  const rainyCoast=await submitted(page);expect(rainyCoast.diagnostics.frame.weather.rain01).toBe(0.8);expect(rainyCoast.facts.fixtureDigest).toBe(coast.facts.fixtureDigest);await page.locator('#view').screenshot({path:info.outputPath('f01-water-rain.png')});
  expect(errors).toEqual([]);await info.attach('bound-detach-water-states',{body:JSON.stringify({detached,coast,rainyCoast,errors,productIntegrated:false,performance:'Q0_FUNCTIONAL_UNQUALIFIED'}),contentType:'application/json'});
});
test('MAT01/MAT04 direct material channel commands submit a new bound native version without any UI setFrame',async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',(e)=>errors.push(String(e)));page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(entry+'?testBridge=1');await expect(page.locator('#status')).toContainText('Bereit');await page.locator('#mount').click();await expect(page.locator('#status')).toContainText('Materiallabor aktiv');
  const before=await submitted(page),direct=await page.evaluate(()=>{
    const bridge=(window as Window&{MaterialTestBridge?:{setWetness(value:number):{frameVersion:number;frame:unknown}}}).MaterialTestBridge;if(!bridge)throw Error('Direct material bridge missing');return bridge.setWetness(0.7);
  });
  expect(direct.frameVersion).toBeGreaterThan(before.diagnostics.frameVersion);expect(direct.frame).toEqual(before.diagnostics.frame);
  const wet=await submitted(page,direct.frameVersion);expect(wet.diagnostics.rendered.frameVersion).toBe(direct.frameVersion);
  const normalCommand=await page.evaluate(()=>{const bridge=(window as Window&{MaterialTestBridge?:{setViewMode(mode:string):{frameVersion:number;frame:unknown}}}).MaterialTestBridge;if(!bridge)throw Error('Direct material bridge missing');return bridge.setViewMode('normal');});
  expect(normalCommand.frameVersion).toBeGreaterThan(direct.frameVersion);const normal=await submitted(page,normalCommand.frameVersion);expect(normal.material.viewMode).toBe('normal');expect(normal.diagnostics.frame).toEqual(before.diagnostics.frame);
  await page.locator('#view').screenshot({path:info.outputPath('direct-normal-channel.png')});expect(errors).toEqual([]);
  await info.attach('direct-channel-states',{body:JSON.stringify({before,direct,wet,normalCommand,normal,performance:'Q0_FUNCTIONAL_UNQUALIFIED',productIntegrated:false}),contentType:'application/json'});
});
