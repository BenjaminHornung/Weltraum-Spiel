import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11',out='/workspace/.cloud-setup/ui-ceramic-2026-10-13';
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:2600,height:800},deviceScaleFactor:1});
const data=async path=>'data:image/png;base64,'+(await readFile(path)).toString('base64');
const source=await data(root+'/art/factory/visual-reference/2026-10-13/01-fracht-transport.png'),actual=await data(out+'/cargo-post-qa-1280.png');
try{
const style='<style>body{margin:0;background:#182b38;color:#fff;font:18px system-ui}main{display:flex;gap:20px;padding:10px}h2{margin:8px 0;font-size:18px}.full img{width:1280px;height:auto}.crop{width:420px;height:500px;overflow:hidden;position:relative}.crop img{width:1280px;max-width:none;position:absolute;left:-840px;top:-200px}</style>';
await page.setContent(style+'<main class="full"><section><h2>OWNER-APPROVED CONCEPT · 1672 × 941 normalized to 1280 wide · German source</h2><img src="'+source+'"></section><section><h2>ACTUAL PRODUCTION BROWSER · 1280 × 720 · English · empty/paused source state</h2><img src="'+actual+'"></section></main>');
await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.screenshot({path:out+'/qa-full-cargo.png'});
await page.setViewportSize({width:900,height:570});
await page.setContent(style+'<main><section><h2>Source inspector, normalized</h2><div class="crop"><img src="'+source+'"></div></section><section><h2>Actual inspector, selected Former</h2><div class="crop"><img src="'+actual+'"></div></section></main>');
await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.screenshot({path:out+'/qa-focused-cargo.png'});
await page.setViewportSize({width:1280,height:720});
await page.goto('http://127.0.0.1:5191/factory.html',{waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'New game',exact:true}).click();await page.getByRole('button',{name:'Open workshop',exact:true}).click();
await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null')?.host.confirmed===true);
const perf=await page.evaluate(async()=>{
 const times=[],start=performance.now();let last=start;
 await new Promise(resolve=>{function sample(t){times.push(t-last);last=t;if(times.length>=30)resolve();else requestAnimationFrame(sample);}requestAnimationFrame(sample);});
 const sorted=[...times].sort((a,b)=>a-b);return {kind:'ACTUAL_BUILD_PAUSED_PRESENTATION_FRAME_SAMPLE',frames:times.length,wallMs:performance.now()-start,medianFrameMs:sorted[Math.floor(sorted.length*.5)],p95FrameMs:sorted[Math.floor(sorted.length*.95)],maxFrameMs:sorted.at(-1),meanFrameMs:times.reduce((a,b)=>a+b,0)/times.length,testBridge:'TestBridge' in window,state:JSON.parse(document.body.dataset.hestiaFactoryUi??'null')?.host,assetTelemetry:document.body.dataset.hestiaFactoryAssets??null,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},note:'Paused fresh world and loaded existing assets, No concurrent Blender/test/browser work; NOT a full running production/Save benchmark. New wreck remains NOT_ADMITTED.'};
});
await writeFile(out+'/presentation-performance-isolated.json',JSON.stringify(perf,null,2));
const path='/factory/crashsite-hybrid-v1/crashsite-hybrid-v1.glb',r=await fetch('http://127.0.0.1:5191'+path),buf=Buffer.from(await r.arrayBuffer());
const manifest=JSON.parse(await readFile(root+'/apps/weltraum-browser/public/factory/crashsite-hybrid-v1/manifest.json','utf8'));
const hash=createHash('sha256').update(buf).digest('hex');assert.equal(r.status,200);assert.equal(hash,manifest.glbSha256);assert.equal(buf.length,manifest.glbBytes);
await writeFile(out+'/production-asset-payload.json',JSON.stringify({status:r.status,url:path,bytes:buf.length,sha256:hash,buildIncluded:true,runtimeAdmission:'NOT_ADMITTED'},null,2));
}finally{await browser.close();}
