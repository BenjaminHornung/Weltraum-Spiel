import {beforeAll, expect, it, vi} from "vitest";
import {HVP_SOURCE_MIN_METERS} from "../../src/hvp/hvpCoastSource";
import {captureHvpBodyHit, type HvpCuttableBody} from "../../src/hestia-prototype/physics/bodyCut";
import {createHvpOwnedHashBodyCutSession} from "../../src/hestia-prototype/physics/bodyCutSession";
import {issueHvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import {R, initializeHvpRapier} from "../../src/hestia-prototype/physics/rapierPort";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {createTerrainComponentIndex} from "../../src/voxel/structural/componentIndex";
import {createStructuralOwnerLedger} from "../../src/voxel/structural/model";
import {cutAt, rootFor, uFixture} from "./componentIndex/compactFixtures";

beforeAll(initializeHvpRapier);
it.each(["move", "rollback", "replace", "dispose"] as const)("captures before the first yield and handles %s during archive creation", async action => {
  const cut = cutAt(rootFor(uFixture()), [12,2,4]);
  const index = createTerrainComponentIndex(cut.before);
  const fragment = index.prepareCompact(cut).fragments[0]!;
  index.dispose();
  const budget = () => createStructuralOwnerLedger(0, 96 * 1024 * 1024, 128);
  const resident = budget(), command = budget();
  const owner = issueHvpCompactNativeOwner({ownerId:fragment.ownerId, origin:HVP_SOURCE_MIN_METERS,
    compactSource:{generation:fragment.revision, parts:fragment.parts, cellCount:fragment.cellCount},
    cells:[], massKg:fragment.massKg, colliderBoxes:fragment.colliderBoxes},
    {generation:cut.after.revision, sessionId:cut.after.sessionId, epoch:cut.after.epoch, terrainDigest:cut.after.sourceDigest}, resident.reserve);
  const world = new R.World({x:0,y:0,z:0});
  const body = installHvpRigidBody(world, owner.recipe, {rotation:{x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2},translationMeters:{x:0,y:-.375,z:0}});
  const target:HvpCuttableBody = {ownerId:fragment.ownerId, body, compactOwner:owner,
    get recipe(){ const archive = owner.peekArchive(); if(!archive) throw Error("Unexpected synchronous archive read"); return archive; }};
  const targets = new Map([[target.ownerId,target]]);
  const moving = createHvpOwnedHashBodyCutSession(world, targets, new Map([[target.ownerId,body]]), "compact-moving");
  const eye = {x:-1,y:1.25,z:-12.5*.125}, direction = {x:1,y:0,z:0};
  const hit = captureHvpBodyHit(world, targets, eye, direction, 42)!;
  const request = {id:"recut",ownerId:target.ownerId,sourceDigest:hit.sourceDigest,edge:1,direction};
  let clock = 0;
  const now = vi.spyOn(performance,"now").mockImplementation(() => ++clock);
  let yields = 0;
  const host = {assertCurrent(){}, async yieldTask(){
    if (++yields !== 1) return;
    expect(moving.read()).toMatchObject({pendingId:"recut",state:"Preparing"});
    expect(moving.holdsWorld).toBe(false);
    expect(() => moving.checkpoint()).toThrow();
    expect(() => moving.begin(request,eye,43)).toThrow();
    if (action === "move") {
      body.setTranslation({x:8,y:10,z:12},true);
      body.setRotation({x:0,y:0,z:0,w:1},true);
    }
    if (action === "rollback") moving.rollback("recut");
    if (action === "replace") targets.delete(target.ownerId);
    if (action === "dispose") moving.dispose();
    await Promise.resolve();
  }};
  try {
    await expect(moving.beginCompact({...request,expectedEye:{...eye,x:eye.x+.125}},eye,42,host,() => command)).rejects.toThrow("Augenposition");
    expect(moving.busy).toBe(false);
    const pending = moving.beginCompact({...request,expectedEye:eye},eye,42,host,() => command);
    if (action === "move") {
      const ready = await pending;
      expect(ready.issuedTick).toBe(42);
      expect(ready.payload.cell).toEqual(hit.cell);
      expect(ready.cells.length).toBe(fragment.cellCount);
      expect(captureHvpBodyHit(world,targets,eye,direction,43)).toBeNull();
      moving.rollback("recut");
    } else {
      await expect(pending).rejects.toThrow(/cancelled/);
    }
    expect(yields).toBeGreaterThan(0);
    expect(moving.busy).toBe(false);
    expect(command.resources.reservedBytes).toBe(0);
  } finally { now.mockRestore();owner.dispose();world.free();resident.release(); }
});
