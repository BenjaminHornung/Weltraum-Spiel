import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const out='/workspace/.cloud-setup/ui-ceramic-2026-10-13',browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],states=[];page.on('pageerror',e=>errors.push(String(e)));
try{
await page.goto('http://127.0.0.1:5192/',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Graphics',exact:true}).waitFor();assert.equal(await page.evaluate(()=> 'TestBridge' in window),false);states.push({route:'/',language:await page.locator('html').getAttribute('lang')});
await page.goto('http://127.0.0.1:5192/factory.html',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'New game',exact:true}).waitFor();await page.screenshot({path:out+'/clean-copy-start.png'});
await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Open workshop',exact:true}).click();
await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi??'null');return u?.host.confirmed&&u.host.physicsStatus==='Paused';});
assert.equal(await page.evaluate(()=> 'TestBridge' in window),false);await page.screenshot({path:out+'/clean-copy-workshop.png'});
states.push({route:'/factory.html',language:await page.locator('html').getAttribute('lang'),host:await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null').host)});
const r=await fetch('http://127.0.0.1:5192/factory/crashsite-hybrid-v1/crashsite-hybrid-v1.glb');const data=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200);const sha256=createHash('sha256').update(data).digest('hex');assert.equal(sha256,'8912f74b4bcdd0effb41960b97a8d491123f52f5930adeb63544992b236cadfa');states.push({candidatePayloadBytes:data.length,sha256});
assert.equal(errors.length,0);
}finally{await writeFile(out+'/clean-copy-smoke.json',JSON.stringify({kind:'ACTUAL_CLEAN_SOURCE_INSTALL_BUILD_BROWSER_SMOKE',states,errors},null,2));await browser.close();}
