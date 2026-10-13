import { chromium } from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv[2]; if(!out)throw Error('Output directory required');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const events=[],errors=[],responses=[];let playResult='NOT_RUN';
page.on('pageerror',e=>errors.push({kind:'pageerror',message:String(e)}));
page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:m.text(),location:m.location()});});
page.on('response',r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
const read=()=>page.evaluate(()=>({atUtc:new Date().toISOString(),testBridge:'TestBridge' in window,language:document.documentElement.lang,
 ui:JSON.parse(document.body.dataset.hestiaFactoryUi??'null'),construction:JSON.parse(document.body.dataset.hestiaFactoryConstruction??'null'),
 mode:document.querySelector('#factory-shell')?.dataset.mode,surface:document.querySelector('.factory-shell-modal')?.dataset.surface,
 visibleText:document.querySelector('#factory-shell')?.innerText,
 images:[...document.querySelectorAll('#factory-shell img')].map(i=>({url:i.currentSrc,complete:i.complete,width:i.naturalWidth})),
 fonts:[...document.querySelectorAll('#factory-shell button,#factory-shell strong,#factory-shell small')].filter(e=>e.getBoundingClientRect().width>0&&!e.closest('[hidden]')).slice(0,30).map(e=>({text:e.textContent,fontSize:getComputedStyle(e).fontSize,color:getComputedStyle(e).color})),
 rects:Object.fromEntries(['.factory-shell-hud','.factory-shell-minimap','.factory-shell-utility','.factory-shell-modal'].map(s=>{const e=document.querySelector(s),r=e?.getBoundingClientRect();return[s,r?{x:r.x,y:r.y,width:r.width,height:r.height}:null];}))}));
const capture=async(name)=>{const before=await read();assert.equal(before.testBridge,false);assert.equal(before.language,'en');await page.screenshot({path:out+'/'+name+'.png'});const after=await read();await writeFile(out+'/'+name+'.json',JSON.stringify({before,after},null,2)+'\n');events.push({name,surface:after.surface,state:after.ui?.state,physics:after.ui?.host.physicsStatus});};
const click=name=>page.getByRole('button',{name,exact:true}).click();
const nav=async(name)=>{const target=page.getByRole('button',{name,exact:true});if(!await target.isVisible())await click('Views');await target.click();};
try{
 await page.goto('http://127.0.0.1:5191/factory.html',{waitUntil:'domcontentloaded'});
 await page.locator('#factory-shell').waitFor({timeout:30000});await capture('01-start-1280');
 assert.equal(await page.getByRole('button',{name:'Continue',exact:true}).isEnabled(),false);
 await click('New game');await click('Open workshop');const open=page.getByRole('button',{name:'Open cargo',exact:true});if(await open.isEnabled())await open.click();
 await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null')?.interaction.cargoOpened===true);
 await page.getByRole('button',{name:'Former kit select',exact:true}).waitFor();await capture('02-cargo-1280');
 const mass=(await read()).construction.massMg;
 await click('Cutter kit select');assert.match(await page.locator('.factory-cargo-packages > p:nth-of-type(2)').innerText(),/208 kg/);
 await click('Former kit select');assert.match(await page.locator('.factory-cargo-packages > p:nth-of-type(2)').innerText(),/341 kg/);
 await nav('Build');await click('Preview cutter');await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryConstruction??'null')?.ghost!=null);
 assert.equal(await page.getByRole('button',{name:'Confirm build',exact:true}).isEnabled(),false);await capture('03-build-rejected-1280');
 await click('Choose another facility');assert.equal(await page.getByRole('button',{name:'Preview former',exact:true}).isVisible(),true);await click('Preview cutter');
 const ghost=(await read()).construction.ghost.request;await page.keyboard.press('ArrowRight');await page.keyboard.press('r');
 const moved=(await read()).construction.ghost.request;assert.equal(moved.centerMm[0],ghost.centerMm[0]+250);assert.equal(moved.quarterTurns,(ghost.quarterTurns+1)%4);
 assert.equal((await read()).construction.massMg,mass);
 await nav('Machines');await capture('04-machines-empty-1280');await nav('Power');await capture('05-power-empty-1280');
 await nav('Technology');await capture('06-technology-1280');assert.doesNotMatch((await read()).visibleText,/Endliche|Im freien Bestand|Quelle:/);
 await nav('Map');await capture('07-map-1280');assert.equal(await page.getByRole('button',{name:'Zoom in',exact:true}).isVisible(),true);
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.factory-shell-modal')),true);
 await page.keyboard.press('Escape');assert.equal((await read()).ui.host.physicsStatus,'Paused');await capture('08-paused-hud-1280');
 await page.setViewportSize({width:1920,height:1080});await capture('09-paused-hud-1920');
 await page.setViewportSize({width:375,height:812});await capture('10-paused-hud-375');
 const rects=(await read()).rects,a=rects['.factory-shell-hud'],b=rects['.factory-shell-minimap'];assert.ok(a.y+a.height<=b.y||a.x+a.width<=b.x||b.x+b.width<=a.x,'HUD overlaps minimap');
 await click('Pause and menu');await click('Open workshop');await capture('11-cargo-375');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('.factory-shell-modal')),true);
 await page.keyboard.press('Escape');await page.setViewportSize({width:1280,height:720});await page.keyboard.press('Escape');
 // Explicit normal input; no TestBridge, injected poses or simulated native clock.
 const play=page.getByRole('button',{name:'Play',exact:true});
 if(await play.isEnabled()){
  await play.click();
  try{await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi??'null');return u?.state==='Ready'&&u.host.confirmed&&u.host.physicsStatus==='Running'&&u.host.input?.active&&u.host.nativeTick>=30;},{},{timeout:12000});playResult='PASS_CONFIRMED_START';}
  catch{playResult='FAIL_CONFIRMED_START';}
  await capture('12-explicit-play-1280');
  const observed=(await read()).ui.host.physicsStatus;playResult=observed==='Running'?playResult:observed==='SimulationHold'?'START_CONFIRMED_THEN_SIMULATION_HOLD':'START_NOT_SUSTAINED_'+observed;
  if((await read()).ui.host.physicsStatus==='SimulationHold'){
   const recover=page.getByRole('button',{name:'Recover session',exact:true});
   if(await recover.isEnabled()){await recover.click();await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi??'null');return u?.host.confirmed&&u.host.physicsStatus==='Paused';});await capture('13-recovery-1280');}
  }
 }
 await page.keyboard.press('Escape');
}catch(e){errors.push({kind:'flow',message:String(e)});process.exitCode=1;}
finally{await writeFile(out+'/RESULT.json',JSON.stringify({kind:'ACTUAL_PRODUCTION_BUILD_NORMAL_INPUT',url:'http://127.0.0.1:5191/factory.html',browser:browser.version(),events,errors,responses,playResult,exitCode:process.exitCode??0},null,2)+'\n');console.log(JSON.stringify({events,errors,responses,playResult,exitCode:process.exitCode??0}));await browser.close();}
