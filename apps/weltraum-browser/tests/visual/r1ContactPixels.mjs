import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const cacheDir=await mkdtemp(path.join(os.tmpdir(),'r1-contact-vite-'));
const server=await createServer({configFile:false,cacheDir,logLevel:'error',server:{host:'127.0.0.1',port:0},
  optimizeDeps:{include:['three','three-mesh-bvh']},
  plugins:[{name:'r1-pixel-probe',configureServer(vite){vite.middlewares.use('/r1-pixel-proof',(_req,res)=>{
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><meta charset="utf-8"><title>R1 contact proof</title><style>body{font:16px system-ui;color:#182332;background:white;margin:24px}main{display:flex;gap:24px}figure{margin:0}canvas{width:240px;height:240px;image-rendering:pixelated}figcaption{margin-top:8px}</style><canvas hidden id="raster"></canvas><main><figure><canvas id="before"></canvas><figcaption>Vor dem Cut</figcaption></figure><figure><canvas id="after"></canvas><figcaption>Nach dem Cut</figcaption></figure></main>');
  });}}]});
let browser;
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:552,height:312}});
  await page.goto(new URL('r1-pixel-proof',server.resolvedUrls.local[0]).href);
  const proof=await page.evaluate(async()=>{const {runProbe}=await import('/tests/visual/r1ContactPixels.browser.mjs');return runProbe();});
  assert.equal(proof.attachmentPublication,'UNAVAILABLE');
  assert.equal(proof.afterRevision,proof.beforeRevision+1);assert.equal(proof.cutCells,1);
  assert.equal(proof.centerUnknown,'Unknown');assert.ok(proof.changedPixels>0&&proof.changedPixels<proof.extent[0]*proof.extent[1]);
  for(const key of ['relit','unknown','sourceStale','oldFrame'])assert.equal(proof.digests[key],proof.digests.raster,key);
  assert.notEqual(proof.digests.shaded,proof.digests.raster);
  for(let k=0;k<3;k++){
    assert.equal(proof.centerBefore[k],Math.fround(proof.direct[k]+proof.emissive[k]));
    assert.ok(proof.direct[k]>0&&proof.emissive[k]>0&&proof.indirect[k]>0&&proof.centerAfter[k]>proof.centerBefore[k]);
  }
  if(process.argv[2])await page.screenshot({path:process.argv[2]});
  console.log(JSON.stringify({browser:browser.version(),...proof},null,2));
}finally{await browser?.close();await server.close();await rm(cacheDir,{recursive:true,force:true});}
