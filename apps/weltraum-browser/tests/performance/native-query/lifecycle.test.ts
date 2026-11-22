import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect,it} from "vitest";
import {wasmBase64} from "../../../vendor/rapier-phy01-positive-margin-r05/dist/src/wasmBytes";
import {initializeHvpRapier,R} from "../../../src/hestia-prototype/physics/rapierPort";

const unit={x:0,y:0,z:0,w:1};
const capsule=new R.Capsule(.035,.025);
function slot(handle:number) {
  const bits=new DataView(new ArrayBuffer(8));
  bits.setFloat64(0,handle,true);
  return bits.getUint32(0,true);
}
function verify(w:R.World,x:number,expected?:number) {
  const ray=w.castRay(new R.Ray({x,y:0,z:-1},{x:0,y:0,z:1}),2,true)?.collider.handle;
  const shape=w.castShape({x,y:0,z:-1},unit,{x:0,y:0,z:1},capsule,0,2,true)?.collider.handle;
  expect(ray).toBe(expected);expect(shape).toBe(expected);
}
it("binds the actually loaded WASM to the qualification receipt",()=>{
  const profile=JSON.parse(readFileSync("vendor/rapier-phy01-positive-margin-r05/profile.json","utf8"));
  const sha=createHash("sha256").update(Buffer.from(wasmBase64,"base64")).digest("hex");
  expect(sha).toBe(process.env.HESTIA_QUERY_WASM_SHA256??profile.wasmSha256);
});
it("publishes standalone and attached shapes before a step, with same-slot replacement and independent restored worlds",async()=>{
  await initializeHvpRapier();
  const world=new R.World({x:0,y:0,z:0});
  try {
    const a=world.createCollider(R.ColliderDesc.cuboid(.25,.25,.25).setTranslation(0,0,0));
    const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(2,0,0));
    const b=world.createCollider(R.ColliderDesc.cuboid(.25,.25,.25),body);
    world.updateSceneQueries();verify(world,0,a.handle);verify(world,2,b.handle);
    world.step();
    // Rebuild the first projection after a solver step. Other shapes remain queryable.
    a.setEnabled(false);world.updateSceneQueries();verify(world,0);verify(world,2,b.handle);
    a.setEnabled(true);a.setTranslation({x:1,y:0,z:0});world.updateSceneQueries();
    verify(world,0);verify(world,1,a.handle);
    body.setTranslation({x:4,y:0,z:0},true);world.updateSceneQueries();verify(world,2);verify(world,4,b.handle);
    const old=b.handle;
    world.removeCollider(b,true);
    const c=world.createCollider(R.ColliderDesc.cuboid(.25,.25,.25).setTranslation(6,0,0));
    expect(c.handle).not.toBe(old);expect(slot(c.handle)).toBe(slot(old));
    world.updateSceneQueries();verify(world,4);verify(world,6,c.handle);
    // Interleave repeated no-step publications and restore a world saved before another solver step.
    const cold=R.World.restoreSnapshot(world.takeSnapshot());
    try {
      cold.updateSceneQueries();verify(cold,1,a.handle);verify(cold,4);verify(cold,6,c.handle);
      cold.getCollider(c.handle).setEnabled(false);cold.updateSceneQueries();verify(cold,6);
      verify(world,6,c.handle);
      cold.step();cold.updateSceneQueries();verify(cold,1,a.handle);verify(cold,6);
    }finally{cold.free();}
    world.removeCollider(a,true);world.updateSceneQueries();verify(world,1);verify(world,6,c.handle);
  }finally{world.free();}
});
it("leaves the next solver contact and post-step moving-body queries intact",async()=>{
  await initializeHvpRapier();
  const w=new R.World({x:0,y:-9.81,z:0});
  try {
    const floor=w.createCollider(R.ColliderDesc.cuboid(4,.1,4).setTranslation(0,-.1,0));
    const body=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,.22,0));
    const ball=w.createCollider(R.ColliderDesc.ball(.25),body);
    w.updateSceneQueries();floor.setEnabled(false);w.updateSceneQueries();floor.setEnabled(true);w.updateSceneQueries();
    const retained=new Set<number>();
    for(let i=0;i<10;i++){w.step();w.contactPairsWith(ball,col=>retained.add(col.handle));}
    expect(retained.has(floor.handle)).toBe(true);expect(body.translation().y).toBeGreaterThan(.18);
    floor.setEnabled(false);w.updateSceneQueries();
    expect(w.castRay(new R.Ray({x:2,y:1,z:0},{x:0,y:-1,z:0}),2,true)).toBeNull();
    for(let i=0;i<32;i++)w.step();
    expect(body.translation().y).toBeLessThan(0);
    body.setTranslation({x:2,y:0,z:0},true);w.updateSceneQueries();verify(w,2,ball.handle);
  }finally{w.free();}
});
