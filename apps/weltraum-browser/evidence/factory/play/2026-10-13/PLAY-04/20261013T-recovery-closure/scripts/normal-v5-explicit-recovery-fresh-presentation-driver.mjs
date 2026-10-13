import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import path from 'node:path';
const app='/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser';
const require=createRequire(path.join(app,'package.json')), {chromium}=require('playwright');
const out=process.argv[2];if(!out)throw Error('Own actual evidence path required');
await mkdir(path.join(out,'video'),{recursive:true});
const events=[],errors=[],resources=[],startedAtUtc=new Date().toISOString();
let browser,context,page,cdp,videoPath,cursor={x:0,y:0};
const read=()=>page.evaluate(()=>({url:location.href,text:document.body.innerText,sourceDigest:document.body.dataset.hestiaPrototypeSourceDigest,sourceRevision:document.body.dataset.hestiaPrototypeSourceRevision,ui:JSON.parse(document.body.dataset.hestiaFactoryUi||'null'),construction:JSON.parse(document.body.dataset.hestiaFactoryConstruction||'null'),presentation:JSON.parse(document.body.dataset.hestiaFactoryPresentation||'null'),native:JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null'),diagnostics:{physicsClock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock||'null'),input:JSON.parse(document.body.dataset.hestiaPrototypeInput||'null'),transport:JSON.parse(document.body.dataset.hestiaFactoryInputTransport||'null'),physicsWorkers:document.body.dataset.hestiaPrototypePhysicsWorkers,ownedRender:JSON.parse(document.body.dataset.hestiaPrototypeOwnedRender||'null'),camera:JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera||'null'),visibility:document.visibilityState,hasFocus:document.hasFocus(),pointerLockElement:document.pointerLockElement?.id??null,inputError:document.body.dataset.hestiaPrototypeInputError??null},testBridge:'TestBridge' in window}));
const summary=s=>({player:s.native?.player,carrier:s.native?.factoryFacilities?.carrier?{phase:s.native.factoryFacilities.carrier.phase,positionMm:s.native.factoryFacilities.carrier.positionMm,mass:s.native.factoryFacilities.carrier.nativeMassKg,colliders:s.native.factoryFacilities.carrier.colliderHandles}:null,veto:s.native?.factoryFacilities?.lastCarrierVeto,handling:s.ui?.interaction?.handling?{phase:s.ui.interaction.handling.phase,massMg:s.ui.interaction.handling.massMg}:null,inventory:s.ui?.inventory?.map(c=>({id:c.id,role:c.role,massMg:c.massMg,stackCount:c.contents.length})),construction:s.construction?{state:s.construction.state,installations:s.construction.installations,revision:s.construction.revision,massMg:s.construction.massMg,ghost:s.construction.ghost}:null,connections:s.ui?.connections,deposits:s.ui?.interaction?.localDeposits,power:s.ui?.power,buttons:null,testBridge:s.testBridge});
const press=async(key,ms)=>{
 const pre=await read();if(pre.native?.status!=='Running'||!pre.ui?.host.confirmed||pre.diagnostics.pointerLockElement!=='debug-scene'||pre.diagnostics.input?.pressedKeys.length)throw Error('Move requires current confirmed Play and neutral released keys: '+JSON.stringify(pre.diagnostics));const priorSent=pre.diagnostics.transport?.lastSentId;const keyCode={a:65,d:68,s:83,w:87}[key];if(!keyCode)throw Error('Unsupported movement key');
 const code='Key'+key.toUpperCase(),up={type:'keyUp',modifiers:0,key,windowsVirtualKeyCode:keyCode,code,location:0};
 const failures=[],exposureStart=Date.now();let held;
 try{
  await cdp.send('Input.dispatchKeyEvent',{type:'keyDown',modifiers:0,windowsVirtualKeyCode:keyCode,code,commands:[],key,text:key,unmodifiedText:key,autoRepeat:false,location:0,isKeypad:false});
  // CDP has processed the trusted keydown. Do not wait for rendered datasets
  // or evaluate page code while a physical key is held: those reads add frame
  // latency to the requested gesture. Native ACK/neutrality is checked below.
  await page.waitForTimeout(ms);
 }catch(e){failures.push(e);}finally{try{await cdp.send('Input.dispatchKeyEvent',up);}catch(e){failures.push(e);}}
 events.push({kind:'trusted-physical-key-exposure',key,requestedMs:ms,observedElapsedMs:Date.now()-exposureStart,heldAtUtc:new Date().toISOString(),before:{ticks:pre.native?.ticks,player:pre.native?.player,diagnostics:pre.diagnostics},held:held?{ticks:held.native?.ticks,player:held.native?.player,diagnostics:held.diagnostics}:null});
 if(failures.length)throw new AggregateError(failures,'Normal input exposure/release failed: '+failures.map(e=>String(e)).join(' | '));
 await page.waitForTimeout(350);await page.waitForFunction(prior=>{const p=JSON.parse(document.body.dataset.hestiaFactoryInputTransport||'null'),i=JSON.parse(document.body.dataset.hestiaPrototypeInput||'null');return p&&p.lastSentId>prior&&p.lastAckId===p.lastSentId&&!p.pendingIds.length&&p.commandDepth===0&&!p.closing&&p.desiredLevel.x===0&&p.desiredLevel.z===0&&!p.desiredLevel.sprint&&!p.desiredLevel.jump&&i&&!i.pressedKeys.length;},priorSent,{timeout:5000});
 // Input ACKs own no pose. With one outstanding public Read, wait for two
 // subsequent confirmed published tick changes after released neutrality.
 // This observes the existing Native world; it never advances or edits it.
 const settledTicks=[];
 for(let i=0;i<2;i++){
  const tick=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics).ticks);
  await page.waitForFunction(tick=>{const n=JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null'),u=JSON.parse(document.body.dataset.hestiaFactoryUi||'null'),t=JSON.parse(document.body.dataset.hestiaFactoryInputTransport||'null');return n?.status==='Running'&&u?.host.confirmed&&n.ticks>tick&&t?.lastAckId===t.lastSentId&&!t.pendingIds.length&&!t.desiredLevel.x&&!t.desiredLevel.z;},tick,{timeout:5000});
  settledTicks.push(await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics).ticks));
 }
 events.push({kind:'released-neutral-fresh-native-pose',key,settledTicks});
};
let recoveries=0;
const recoverWithVisibleInputs=async()=>{
 const before=await read();if(before.native?.status!=='SimulationHold')return false;
 if(++recoveries>6)throw Error('Bounded test scenario exhausted six explicit player recoveries; performance still FAIL');
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Sitzung freigeben'&&!b.disabled&&b.getBoundingClientRect().width),{},{timeout:5000});
 await writeFile(path.join(out,`recovery-${recoveries}-before.json`),JSON.stringify(before,null,2)+'\n');
 await page.screenshot({path:path.join(out,`recovery-${recoveries}-before.png`)});
 await page.getByRole('button',{name:'Sitzung freigeben',exact:true}).last().click();
 await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi||'null'),n=JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null');return n?.status==='Paused'&&u?.host.confirmed&&!u.host.input?.pausePending;},{},{timeout:5000});
 const paused=await read();
 for(const [name,a,b] of [['tick',before.native.ticks,paused.native.ticks],['bodies',before.native.bodies,paused.native.bodies],['cargo',before.native.factoryFacilities?.cargo,paused.native.factoryFacilities?.cargo],['owners',before.native.factoryFacilities?.owners,paused.native.factoryFacilities?.owners],['carrier',before.native.factoryFacilities?.carrier,paused.native.factoryFacilities?.carrier],['inventory',before.ui?.inventory,paused.ui?.inventory],['battery',before.ui?.power?.batteryEnergyJ,paused.ui?.power?.batteryEnergyJ]])if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Recovery changed confirmed '+name);
 if(paused.diagnostics.pointerLockElement||paused.diagnostics.input?.pressedKeys.length||paused.native.ticks!==before.native.ticks)throw Error('Recovery must stay neutral and paused at the same native tick');
 await writeFile(path.join(out,`recovery-${recoveries}-paused.json`),JSON.stringify(paused,null,2)+'\n');
 await page.screenshot({path:path.join(out,`recovery-${recoveries}-paused.png`)});
 events.push({kind:'explicit-visible-player-recovery',atUtc:new Date().toISOString(),number:recoveries,nativeTick:paused.native.ticks,confirmed:paused.ui.host.confirmed,retained:['bodies','cargo','owners','carrier','inventory','battery'],performance:'HOLD_OBSERVED_FAIL_NOT_MASKED'});
 await page.getByRole('button',{name:'Spielen',exact:true}).last().click();
 await page.waitForFunction(prior=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi||'null'),n=JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null');return n?.status==='Running'&&n.ticks>prior&&u?.host.nativeTick===n.ticks&&u.host.confirmed&&u.host.physicsStatus==='Running'&&document.pointerLockElement?.id==='debug-scene';},paused.native.ticks,{timeout:5000});
 return true;
};
const walk=async(axis,target)=>{
 if(!['x','z'].includes(axis)||!Number.isFinite(target))throw Error('Invalid walk target');
 let cap=500;
 for(let i=0;i<40;i++){
  const before=await read(),v=before.native.player.position[axis];if(Math.abs(v-target)<.08)return;
  const key=axis==='x'?(v>target?'d':'a'):(v>target?'s':'w'),ms=Math.max(17,Math.min(cap,Math.round(Math.abs(v-target)/3*1000)));
  try{await press(key,ms);}catch(error){if(await recoverWithVisibleInputs())continue;throw error;}const after=await read();events.push({kind:'released-walk-gesture',axis,target,key,ms,before:before.native.player,after:after.native.player,veto:after.native.factoryFacilities?.lastCarrierVeto});
  if((v-target)*(after.native.player.position[axis]-target)<0)cap=Math.max(17,Math.round(cap/2));
  if(Math.abs(after.native.player.position[axis]-v)<.001)throw Error('Normal movement blocked: '+JSON.stringify(summary(after)));
 }
 throw Error('Normal route target not reached after 40 released gestures');
};
try{
 browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,...(process.argv.includes('--no-video')?{}:{recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}})});page=await context.newPage();cdp=await context.newCDPSession(page);
 page.on('pageerror',error=>errors.push({time:new Date().toISOString(),error:String(error)}));page.on('console',msg=>{if(['error','warning'].includes(msg.type()))errors.push({time:new Date().toISOString(),type:msg.type(),text:msg.text()});});page.on('response',r=>resources.push({url:r.url(),status:r.status(),type:r.request().resourceType()}));
 await page.goto('http://127.0.0.1:5174/factory.html');await page.locator('#factory-shell').waitFor({timeout:20000});await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Neues Spiel'&&!b.disabled),{},{timeout:10000});const ready=await read();events.push({kind:'driver-ready',atUtc:new Date().toISOString(),diagnostics:ready.diagnostics,nativeStatus:ready.native?.status,nativeTicks:ready.native?.ticks});console.log('DRIVER_READY '+JSON.stringify(summary(ready)));
 const lines=createInterface({input:process.stdin,terminal:false});
 for await(const line of lines){
  if(!line.trim())continue;const start=new Date().toISOString();let command;
  try{
   command=JSON.parse(line);if(command.kind==='close'){events.push({command,start,end:new Date().toISOString(),status:'completed'});break;}
   if(command.kind==='click'){const b=page.getByRole('button',{name:command.name,exact:true}).last(),box=await b.boundingBox();if(box)cursor={x:box.x+box.width/2,y:box.y+box.height/2};await b.click();}
   else if(command.kind==='play'){const b=page.getByRole('button',{name:'Spielen',exact:true}).last(),box=await b.boundingBox();if(box)cursor={x:box.x+box.width/2,y:box.y+box.height/2};await b.click();try{await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi||'null'),i=JSON.parse(document.body.dataset.hestiaPrototypeInput||'null');const n=JSON.parse(document.body.dataset.hestiaPrototypePhysics||'null');return n?.status==='Running'&&n.ticks>0&&u?.host.nativeTick===n.ticks&&u.host.confirmed&&u.host.physicsStatus==='Running'&&u.host.input?.active&&!u.host.input.activationPending&&document.pointerLockElement?.id==='debug-scene'&&i&&!i.pressedKeys.length;},{},{timeout:5000});}catch(error){if(!await recoverWithVisibleInputs())throw error;}}
   else if(command.kind==='pause'){if((await read()).native?.status==='SimulationHold')await recoverWithVisibleInputs();await page.keyboard.press('Escape');await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi||'null');return u?.host.confirmed&&u.host.physicsStatus==='Paused'&&!document.pointerLockElement;},{},{timeout:5000});}
   else if(command.kind==='await-installed'){await page.waitForFunction(id=>JSON.parse(document.body.dataset.hestiaFactoryConstruction||'null')?.installations.some(i=>i.definitionSourceId===id),command.sourceId,{timeout:5000});}
   else if(command.kind==='key')await page.keyboard.press(command.key);
   else if(command.kind==='press')await press(command.key,command.ms);
   else if(command.kind==='walk'){if((await read()).native?.status==='SimulationHold')await recoverWithVisibleInputs();await walk(command.axis,command.target);}
   else if(command.kind==='mouse'){const before=await read();if(!before.ui?.host.confirmed||before.native?.status!=='Running'||!before.diagnostics.pointerLockElement)throw Error('Look requires actual current Play/Lock');cursor={x:cursor.x+(command.dx??0),y:cursor.y+(command.dy??0)};await page.mouse.move(cursor.x,cursor.y);await page.waitForTimeout(100);const after=await read();events.push({kind:'trusted-absolute-mouse-look',cursor,before:before.diagnostics.camera,after:after.diagnostics.camera,atUtc:new Date().toISOString()});}
   else if(command.kind==='assert-model'){const state=await read(),owner=state.native.factoryFacilities.owners.find(o=>o.definitionSourceId===command.sourceId||o.definitionRef?.sourceId===command.sourceId),scene=state.presentation?.scenes.find(p=>p.instanceId===owner?.instanceId),parts=state.native.factoryFacilities.partObservations?.find(p=>p.instanceId===owner?.instanceId);if(!owner||!scene?.published||!scene.s1||scene.modelError||!scene.visibleKeys.length||!parts?.confirmed||!parts.complete||!parts.published||state.sourceDigest!=='0e2a0bcb'||state.testBridge)throw Error('Actual S1 model binding failed: '+JSON.stringify({owner,scene,parts,source:state.sourceDigest}));}
   else if(command.kind==='capture'){const s=await read();await writeFile(path.join(out,command.label+'.json'),JSON.stringify(s,null,2)+'\n');if(!process.argv.includes('--no-video')||(s.native?.status==='Paused'&&s.ui?.host.confirmed))await page.screenshot({path:path.join(out,command.label+'.png')});}
   else if(command.kind==='idle-probe'){const samples=[];for(let i=0;i<command.seconds;i++){await page.waitForTimeout(1000);const s=await read();samples.push({observedAtUtc:new Date().toISOString(),nativeStatus:s.native?.status,ticks:s.native?.ticks,backlogSeconds:s.native?.backlogSeconds,discardedSeconds:s.native?.discardedSeconds,player:s.native?.player,uiState:s.ui?.state,host:s.ui?.host,diagnostics:s.diagnostics});}await writeFile(path.join(out,'idle-observations.json'),JSON.stringify(samples,null,2)+'\n');}
   else if(command.kind!=='status')throw Error('Unsupported visible action');
   await page.waitForTimeout(500);const s=await read();const buttons=await page.getByRole('button').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width).map(e=>({name:e.textContent,disabled:e.disabled})));
   const result={...summary(s),buttons,diagnostics:s.diagnostics,nativeStatus:s.native?.status};events.push({command,start,end:new Date().toISOString(),status:'completed',result});console.log('ACTION_RESULT '+JSON.stringify({command,result:{...result,buttons:command.kind==='status'?buttons:undefined}}));
  }catch(error){events.push({command,start,end:new Date().toISOString(),status:'failed',error:String(error)});console.log('ACTION_FAILED '+String(error));process.exitCode=1;if(process.argv.includes('--stop-on-failure'))break;}
  await writeFile(path.join(out,'normal-route-actions.json'),JSON.stringify(events,null,2)+'\n');
 }
 lines.close();process.stdin.pause();
}catch(error){errors.push({driverError:String(error)});console.error(String(error));process.exitCode=1;}
finally{
 if(page){await writeFile(path.join(out,'normal-route-final.json'),JSON.stringify(await read().catch(()=>null),null,2)+'\n');videoPath=page.video()?await page.video().path().catch(()=>null):null;}
 await context?.close().catch(e=>{errors.push({contextCloseError:String(e)});process.exitCode=1;});await browser?.close().catch(e=>{errors.push({browserCloseError:String(e)});process.exitCode=1;});
 await writeFile(path.join(out,'normal-route-execution.json'),JSON.stringify({startedAtUtc,endedAtUtc:new Date().toISOString(),entry:'http://127.0.0.1:5174/factory.html',browserVersion:browser?.version(),viewport:{width:1280,height:720,dpr:1},backend:'Declared software Mesa wrapper; hardware acceptance NOT_RUN',recording:process.argv.includes('--no-video')?'Disabled for this bounded V5 Native UI/map/mouse calibration; no video or W11 claim':'VP8 recording',input:'normal visible UI and trusted CDP WASD; read-only diagnostics; no pose/world mutation',videoPath,events,errors,resources},null,2)+'\n');console.log('DRIVER_CLOSED '+videoPath);
}
