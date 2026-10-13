import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out='/workspace/.cloud-setup/ui-ceramic-2026-10-13';
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],states=[];page.on('pageerror',e=>errors.push(String(e)));
try{
await page.goto('http://127.0.0.1:5191/factory.html',{waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Open workshop',exact:true}).click();
await page.getByRole('button',{name:'Open cargo',exact:true}).click();
await page.waitForFunction(()=>{const u=JSON.parse(document.body.dataset.hestiaFactoryUi??'null');return u?.interaction.cargoOpened&&u.state==='Ready'&&u.host.confirmed;});
await page.getByRole('button',{name:'Former kit select',exact:true}).waitFor();
for(const [width,height] of [[1280,720],[375,812]]){
 await page.setViewportSize({width,height});
 const mass=page.locator('.factory-cargo-packages > p:nth-of-type(2)'),button=page.getByRole('button',{name:'Pick up: Former kit',exact:true});
 const m=await mass.boundingBox(),b=await button.boundingBox();
 if(m.y+m.height>b.y){await page.locator('.factory-panel-content').hover();await page.mouse.wheel(0,160);}
 const a=await mass.boundingBox(),c=await button.boundingBox();assert.ok(a.y+a.height<=c.y+1,'Selected mass obscured by primary action');
 assert.match(await mass.innerText(),/341 kg/);assert.equal(await page.evaluate(()=> 'TestBridge' in window),false);
 await page.screenshot({path:out+'/cargo-post-qa-'+width+'.png'});
 states.push({width,height,mass:await mass.innerText(),massRect:a,buttonRect:c,minimumChoiceHeight:await page.locator('.factory-package-choice').evaluateAll(es=>Math.min(...es.map(e=>e.getBoundingClientRect().height))),host:await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null').host)});
}
}finally{await writeFile(out+'/cargo-post-qa.json',JSON.stringify({states,errors},null,2));await browser.close();}
