import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const app='/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser';
const require=createRequire(path.join(app,'package.json')),{chromium}=require('playwright');
const out=process.argv[2];if(!out)throw Error('Own evidence output required');
await mkdir(path.join(out,'video'),{recursive:true});
const startedAtUtc=new Date().toISOString(),events=[],errors=[],resources=[];
let browser,context,page,cdp,videoPath;
const read=()=>page.evaluate(()=>{
 const decode=key=>JSON.parse(document.body.dataset[key]||'null');
 const canvas=document.querySelector('#debug-scene'),gl=canvas?.getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');
 return {atUtc:new Date().toISOString(),url:location.href,sourceDigest:document.body.dataset.hestiaPrototypeSourceDigest,
  ui:decode('hestiaFactoryUi'),construction:decode('hestiaFactoryConstruction'),native:decode('hestiaPrototypePhysics'),
  input:decode('hestiaPrototypeInput'),transport:decode('hestiaFactoryInputTransport'),clock:decode('hestiaPrototypePhysicsClock'),
  visibility:document.visibilityState,focus:document.hasFocus(),pointerLock:document.pointerLockElement?.id??null,
  inputError:document.body.dataset.hestiaPrototypeInputError??null,testBridge:'TestBridge' in window,
  text:document.body.innerText,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
  renderer:gl?{vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null}:null,
  visibleButtons:[...document.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width&&!b.closest('[hidden]')).map(b=>({text:b.textContent,disabled:b.disabled})),
  shellCount:document.querySelectorAll('#factory-shell').length,debugHudHidden:document.querySelector('#hvp-hud')?.hasAttribute('hidden')};
});
const assert=(value,message)=>{if(!value)throw Error(message);};
const capture=async label=>{const state=await read();await writeFile(path.join(out,label+'.json'),JSON.stringify(state,null,2)+'\n');await page.screenshot({path:path.join(out,label+'.png')});return state;};
const action=async(name,run)=>{const start=new Date().toISOString();try{await run();events.push({name,start,end:new Date().toISOString(),status:'completed'});console.log(name+' completed');}catch(error){events.push({name,start,end:new Date().toISOString(),status:'failed',error:String(error)});throw error;}};
const key=async(type,letter,repeat=false)=>cdp.send('Input.dispatchKeyEvent',{type,key:letter,code:'Key'+letter.toUpperCase(),windowsVirtualKeyCode:letter.toUpperCase().charCodeAt(0),autoRepeat:repeat,modifiers:0,location:0});
const press=async(letter,ms)=>{try{await key('keyDown',letter);await page.waitForTimeout(ms);}finally{await key('keyUp',letter);}await page.waitForTimeout(250);};
const neutral=()=>page.waitForFunction(()=>{
 const input=JSON.parse(document.body.dataset.hestiaPrototypeInput||'null'),rpc=JSON.parse(document.body.dataset.hestiaFactoryInputTransport||'null');
 return input&&input.pressedKeys.length===0&&rpc&&rpc.pendingIds.length===0&&rpc.desiredLevel.x===0&&rpc.desiredLevel.z===0&&!rpc.desiredLevel.sprint&&!rpc.desiredLevel.jump;
},{},{timeout:5000});
const playing=()=>page.waitForFunction(()=>{
 const ui=JSON.parse(document.body.dataset.hestiaFactoryUi||'null'),input=JSON.parse(document.body.dataset.hestiaPrototypeInput||'null');
 return document.pointerLockElement?.id==='debug-scene'&&ui?.host.confirmed&&ui.host.physicsStatus==='Running'&&ui.host.input?.active&&!ui.host.input.activationPending&&input?.locked;
},{},{timeout:5000});
const paused=()=>page.waitForFunction(()=>{
 const ui=JSON.parse(document.body.dataset.hestiaFactoryUi||'null');return ui?.host.confirmed&&ui.host.physicsStatus==='Paused'&&!ui.host.input?.active&&!document.pointerLockElement;
},{},{timeout:5000});
try{
 browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
 context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:720}}});
 page=await context.newPage();cdp=await context.newCDPSession(page);
 page.on('pageerror',error=>errors.push({atUtc:new Date().toISOString(),error:String(error)}));
 page.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push({atUtc:new Date().toISOString(),type:message.type(),text:message.text()});});
 page.on('response',response=>resources.push({url:response.url(),status:response.status(),type:response.request().resourceType()}));
 await action('normal production Entry and actual paused start menu',async()=>{
  await page.goto('http://127.0.0.1:5174/factory.html');await page.locator('#factory-shell').waitFor({timeout:20000});
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Neues Spiel'&&!b.disabled),{},{timeout:10000});await paused();await neutral();
 });
 const initial=await capture('01-normal-start-menu');assert(initial.shellCount===1&&initial.debugHudHidden&&!initial.testBridge,'One normal Shell with hidden diagnostic HUD required');
 await action('real New Game and finite cargo open',async()=>{
  await page.getByRole('button',{name:'Neues Spiel',exact:true}).click();await paused();
  await page.getByRole('button',{name:'Werkstatt ansehen',exact:true}).click();await page.getByRole('button',{name:'Fracht öffnen',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryUi).interaction.cargoOpened,{},{timeout:5000});
 });
 const cargo=await capture('02-opened-finite-cargo');assert(cargo.ui.inventory.reduce((sum,c)=>sum+c.massMg,0)===2_984_400_000,'Initial finite material total must remain exact');
 await action('actual material selection and responsive small/wide reachable transfer controls',async()=>{
  const selection=page.locator('.factory-material-row[aria-label$="auswählen"]').first();await selection.click();
  const detail=page.getByRole('region',{name:'Material übertragen',exact:true});await detail.waitFor();
  await capture('02b-intentional-material-selection');
  for(const [width,height,label] of [[800,720,'02c-small800-material-actions'],[1920,1080,'02d-wide1920-material-actions']]){
   await page.setViewportSize({width,height});await page.waitForTimeout(300);await page.getByRole('button',{name:'Übertragen',exact:true}).scrollIntoViewIfNeeded();
   const box=await page.getByRole('button',{name:'Übertragen',exact:true}).boundingBox();assert(box&&box.y>=0&&box.y+box.height<=height,'Real transfer action must be viewport-reachable after ordinary scroll');await capture(label);
  }
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(200);
 });
 await action('explicit real Play and ACK neutral level',async()=>{
  await page.getByRole('button',{name:'Schließen',exact:true}).click();await page.getByRole('button',{name:'Spielen',exact:true}).last().click();await playing();await neutral();
 });
 const before=await capture('03-playing-after-native-ack');const hud=await page.locator('.factory-shell-hud').boundingBox();assert(hud&&hud.width<=316.1&&hud.height<=64.1,'Actual world HUD must fit agreed316x64 budget');
 await action('trusted released WASD movement',async()=>{await press('d',150);await neutral();});
 const moved=await capture('04-released-normal-walk');assert(Math.abs(moved.native.player.position.x-before.native.player.position.x)>.02,'Normal newly pressed WASD must move actual Native player');
 await action('actual modal pause, no gameplay while modal open and no automatic close resume',async()=>{
  await page.keyboard.press('Escape');await paused();await neutral();await page.getByRole('button',{name:'Feldhandbuch öffnen',exact:true}).click();
  const beforeModal=await read();await press('a',150);const afterModal=await read();
  assert(afterModal.native.ticks===beforeModal.native.ticks,'Confirmed paused modal must not advance Native ticks');
  assert(afterModal.native.player.position.x===beforeModal.native.player.position.x,'Modal key must not move Native player');
 });
 await capture('05-modal-pause-and-help');
 await action('held key across explicit Play remains neutral until release and fresh press',async()=>{
  await key('keyDown','w');await page.getByRole('button',{name:'Schließen',exact:true}).click();await paused();
  await page.getByRole('button',{name:'Spielen',exact:true}).last().click();await playing();await neutral();
  const beforeRepeat=await read();await key('keyDown','w',true);await page.waitForTimeout(180);const afterRepeat=await capture('06-held-repeat-after-new-native-ack');
  assert(afterRepeat.input.pressedKeys.length===0&&afterRepeat.transport.desiredLevel.x===0&&afterRepeat.transport.desiredLevel.z===0,'Held repeat must remain neutral');
  assert(Math.hypot(afterRepeat.native.player.position.x-beforeRepeat.native.player.position.x,afterRepeat.native.player.position.z-beforeRepeat.native.player.position.z)<.002,'Held repeat must not move Native player');
  await key('keyUp','w');await press('a',100);await neutral();
 });
 await capture('07-fresh-press-after-neutral-release');
 await action('confirmed final Pause preserves material and closed save admission',async()=>{
  await page.keyboard.press('Escape');await paused();await neutral();const final=await capture('08-final-confirmed-pause');
  assert(final.ui.inventory.reduce((sum,c)=>sum+c.massMg,0)===2_984_400_000,'Input flow must preserve all finite material');
  assert(final.visibleButtons.filter(button=>['Speichern','Spielstand laden'].includes(button.text)).every(button=>button.disabled),'Combined Save/Continue must remain honestly disabled');
  assert(errors.filter(error=>error.error).length===0,'No unhandled browser error expected');assert(!resources.some(r=>r.status>=400),'Actual game requests must not have hidden404/errors');
 });
}catch(error){console.error(String(error));errors.push({atUtc:new Date().toISOString(),driverError:String(error)});process.exitCode=1;if(page&&!page.isClosed())await capture('failure-before-cleanup').catch(error=>errors.push({captureError:String(error)}));}
finally{
 if(page){await writeFile(path.join(out,'final-read.json'),JSON.stringify(await read().catch(()=>null),null,2)+'\n');videoPath=await page.video()?.path().catch(()=>null);}
 await context?.close().catch(error=>{errors.push({closeError:String(error)});process.exitCode=1;});await browser?.close().catch(error=>{errors.push({browserCloseError:String(error)});process.exitCode=1;});
 await writeFile(path.join(out,'execution.json'),JSON.stringify({startedAtUtc,endedAtUtc:new Date().toISOString(),entry:'http://127.0.0.1:5174/factory.html',browserVersion:browser?.version(),viewport:{width:1280,height:720,dpr:1},input:'normal visible controls and trusted CDP keys only; read-only diagnostics; no World/pose/clock/material mutations',scope:'Normal actual gamefeel Start/Cargo/Walk/responsive selection+scroll/Help/Input ACK; map/history/full W09/S1/Save/Owner acceptance pending',videoPath,events,errors,resources},null,2)+'\n');console.log('Actual context close finalized video: '+videoPath);
}
