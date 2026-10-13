import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const evidence=fileURLToPath(new URL('../../.devtoolbox/specs/changes/gfx-03-2026-10-09/tests',import.meta.url));
const profile=JSON.parse(await readFile(`${evidence}/browser-profile-review-corrections-v1.json`));
assert.equal(profile.functionality,'PASS');assert.equal(profile.checks.length,169);assert.ok(profile.checks.every(c=>c.status==='PASS'));
assert.equal(profile.lifecycle.length,30);assert.equal(profile.matrix.length,3);assert.equal(profile.shaderBindings.length,55);
assert.equal(profile.gpuTimerMs,null);assert.equal(profile.referenceAcceptance,'NOT_RUN');
for(const scene of profile.matrix){assert.equal(scene.rows.length,3);assert.equal(scene.versionParity.pass,false);assert.equal(scene.backendParity.pass,false);
  for(const row of scene.rows){assert.equal(row.facts.status,'PASS');assert.equal(row.image.width,384);assert.equal(row.image.height,256);
    assert.ok(row.negatives.every(n=>!n.comparison.pass&&n.comparison.status==='DIFFERENT'));
    const capture=JSON.parse(await readFile(`${evidence}/review-capture-${row.variant}-${scene.scene}.json`));
    assert.equal(capture.image,row.image.sha256,'PNG-adjacent raw framebuffer binding');
    const png=await readFile(`${evidence}/review-capture-${row.variant}-${scene.scene}.png`);assert.equal(png.subarray(1,4).toString(),'PNG');
    if(scene.scene==='water-depth'){
      const below=JSON.parse(await readFile(`${evidence}/review-capture-${row.variant}-water-below.json`));
      const expected=profile.checks.find(c=>c.name===`${row.variant}/water-underside-nonblank`);
      assert.equal(below.image,expected.detail.sha256);assert.equal(below.facts.waterView,'below');
      const image=await readFile(`${evidence}/review-capture-${row.variant}-water-below.png`);assert.equal(image.subarray(1,4).toString(),'PNG');
    }
  }}
for(const shader of profile.shaderBindings){const bytes=Buffer.from(shader.code);assert.equal(bytes.length,shader.byteLength);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),shader.sha256);}
const normal=JSON.parse(await readFile(`${evidence}/normal-route-review.json`));assert.equal(normal.testBridgeAbsent,true);assert.equal(normal.gfxBridgeAbsent,true);
assert.equal(normal.status.status,'PASS');assert.equal(profile.final.liveRenderers,0);assert.equal(profile.final.liveLoops,0);assert.equal(profile.final.liveShadowTargets,0);assert.ok(profile.final.observedShadowDisposals>0);
console.log(`PASS ${profile.checks.length} browser assertions, ${profile.shaderBindings.length} shader bytebindings, 12 capture bindings. Strict parity remains FAIL/REQUIRES_DECISION.`);
