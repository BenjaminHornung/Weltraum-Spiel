import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const packet='/workspace/review-packages/Hestia-English-UI-Crashsite-Review-2026-10-13';
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
await page.goto('http://127.0.0.1:5193/GALERIE.html');
const images=await page.locator('img').evaluateAll(async es=>{es.forEach(e=>e.loading="eager");await Promise.all(es.map(e=>e.decode()));return es.map(e=>({embedded:e.src.startsWith('data:image/png;base64,'),width:e.naturalWidth,height:e.naturalHeight,title:e.alt}));});
assert.equal(images.length,53);assert.ok(images.every(i=>i.embedded&&i.width>0&&i.height>0));assert.equal(errors.length,0);
await page.screenshot({path:'/workspace/.cloud-setup/ui-ceramic-2026-10-13/review-gallery-browser.png'});
await writeFile('/workspace/.cloud-setup/ui-ceramic-2026-10-13/review-gallery-browser.json',JSON.stringify({result:'PASS',kind:'ACTUAL_SELF_CONTAINED_HTML_HTTP_BROWSER_REVIEW',images,errors},null,2));
}finally{await browser.close();}
