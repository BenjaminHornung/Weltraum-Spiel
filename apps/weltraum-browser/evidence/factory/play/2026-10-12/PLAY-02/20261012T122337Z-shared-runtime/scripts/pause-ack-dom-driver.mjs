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
 page.on('console',message=>{if(message.type()==='error')errors.push({text:message.text(),location:message.location()});});
 await page.goto('http://127.0.0.1:5174/factory.html');await page.locator('#factory-shell').waitFor({timeout:20000});await paused();
 await page.getByRole('button',{name:'Neues Spiel',exact:true}).click();await paused();
 await page.getByRole('button',{name:'Spielen',exact:true}).last().click();await playing();await neutral();
 await page.keyboard.press('Escape');await paused();await neutral();await page.waitForTimeout(250);
 await page.getByRole('button',{name:'Feldhandbuch öffnen',exact:true}).click();
 await capture('01-pause-help-actual');
 const dom=await page.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,cls:e.className,hidden:e.hidden,open:e.open,rect:{x:b.x,y:b.y,width:b.width,height:b.height},display:s.display,position:s.position,background:s.backgroundColor,zIndex:s.zIndex,text:e.textContent?.slice(0,160)};}).filter(e=>e.rect.width>1000&&e.rect.height>400||e.id==='hvp-player-pause'));
 await writeFile(path.join(out,'overlay-dom.json'),JSON.stringify(dom,null,2)+'\n');
 const state=await read();assert(!state.text.includes('Aktion nicht bestätigt'),'actual confirmed Native Pause must not show a rejected action');
 console.log('actual Pause action receipt accepted');
}finally{
 if(context){const video=page?.video();await context.close();if(video)videoPath=await video.path();}
 await browser?.close();await writeFile(path.join(out,'execution.json'),JSON.stringify({startedAtUtc,endedAtUtc:new Date().toISOString(),errors,videoPath},null,2)+'\n');
}
