import { chromium } from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.argv[2];if(!out)throw Error('Own evidence directory required');await mkdir(out,{recursive:true});
const startedAtUtc=new Date().toISOString(),events=[],errors=[],badResponses=[];let verdict='NOT_RUN',recovery='NOT_RUN',browser,page;
const read=()=>page.evaluate(()=>({atUtc:new Date().toISOString(),source:document.body.dataset.hestiaPrototypeSourceDigest,
 native:JSON.parse(document.body.dataset.hestiaPrototypePhysics??'null'),ui:JSON.parse(document.body.dataset.hestiaFactoryUi??'null'),
 construction:JSON.parse(document.body.dataset.hestiaFactoryConstruction??'null'),clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??'null'),
 testBridge:'TestBridge' in window,visibility:document.visibilityState,focus:document.hasFocus(),pointerLock:document.pointerLockElement?.id??null}));
const capture=async(label)=>{const data=await read();await writeFile(out+'/'+label+'.json',JSON.stringify(data,null,2)+'\n');await page.screenshot({path:out+'/'+label+'.png'});return data;};
const click=async(name)=>page.getByRole('button',{name,exact:true}).click();
const shortMove=async()=>{try{await page.keyboard.down('d');await new Promise(resolve=>setTimeout(resolve,300));}finally{await page.keyboard.up('d');}};
try{
 browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
 page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)badResponses.push({url:r.url(),status:r.status()});});
 await page.goto('http://127.0.0.1:5191/factory.html',{waitUntil:'domcontentloaded'});await page.locator('#factory-shell').waitFor({timeout:30000});
 await click('New game');await click('Open workshop');const open=page.getByRole('button',{name:'Open cargo',exact:true});if(await open.isEnabled())await open.click();
 await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null')?.interaction.cargoOpened===true);
 await page.keyboard.press('Escape');const initial=await capture('01-finite-cargo-before-play');assert.equal(initial.testBridge,false);assert.equal(initial.construction.massMg,2984400000);
 for(let attempt=1;attempt<=2;attempt++){
  const play=page.getByRole('button',{name:'Play',exact:true});if(!await play.isVisible()){await page.keyboard.press('Escape');}
  await click('Play');
  await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi??'null');return u?.host.confirmed&&u.host.physicsStatus==='Running'&&u.host.input?.active;},{},{timeout:5000});
  let moved=false;
  for(let i=0;i<10;i++){
   await new Promise(resolve=>setTimeout(resolve,500));const s=await read();events.push({attempt,sample:i,atUtc:s.atUtc,status:s.native?.status,ticks:s.native?.ticks,player:s.native?.player,clock:s.clock,confirmed:s.ui?.host.confirmed,massMg:s.construction?.massMg});
   assert.equal(s.testBridge,false);assert.equal(s.construction.massMg,initial.construction.massMg);
   if(s.native?.status!=='Running')break;
   if(i===1){await shortMove();moved=true;}
  }
  const end=await capture('0'+(attempt+1)+'-play-attempt-'+attempt);
  if(end.native?.status==='Running'&&end.ui?.host.confirmed&&end.native.ticks-initial.native.ticks>=120&&moved&&Math.abs(end.native.player.position.x-initial.native.player.position.x)>.1){verdict='PASS_BOUNDED_START_MOVEMENT';break;}
  verdict='FAIL_START_OR_SUSTAIN_'+end.native?.status;
  if(end.native?.status==='SimulationHold'){
   const recover=page.getByRole('button',{name:'Recover session',exact:true});if(await recover.isVisible()&&await recover.isEnabled()){
    const before=end;await recover.click();await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi??'null');return u?.host.confirmed&&u.host.physicsStatus==='Paused';});
    const after=await capture('recovery-'+attempt);assert.equal(after.native.ticks,before.native.ticks);assert.deepEqual(after.native.player.position,before.native.player.position);assert.equal(after.construction.massMg,before.construction.massMg);recovery='PASS_EXPLICIT_SAME_TICK_POSE_CUSTODY';
   }else break;
  }else break;
 }
 if(!verdict.startsWith('PASS'))process.exitCode=1;
}catch(e){errors.push(String(e));verdict='FAIL_FLOW';process.exitCode=1;}
finally{
 if(page)await writeFile(out+'/final.json',JSON.stringify(await read().catch(()=>null),null,2)+'\n');
 const cpu=(await readFile('/proc/cpuinfo','utf8')).match(/^model name\s*:\s*(.+)$/m)?.[1];
 const result={startedAtUtc,endedAtUtc:new Date().toISOString(),entry:'http://127.0.0.1:5191/factory.html',viewport:{width:1280,height:720},browser:browser?.version(),hardware:{cpu,cpuQuota:await readFile('/sys/fs/cgroup/cpu.max','utf8').catch(()=>null),gpu:'Mesa llvmpipe software; GPU hardware acceptance NOT_RUN',LP_NUM_THREADS:process.env.LP_NUM_THREADS??'default'},input:'Visible normal English UI, trusted Playwright keyboard, read-only DOM evidence; no TestBridge/pose/world/clock writes',verdict,recovery,events,errors,badResponses};
 await writeFile(out+'/RESULT.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verdict,recovery,events:events.length,errors,badResponses}));await browser?.close();
}
