import {expect,it} from "vitest";
import {Worker} from "node:worker_threads";
import {fileURLToPath,pathToFileURL} from "node:url";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {once} from "node:events";
import {rolldown} from "rolldown";
import {createTerrainComponentIndex} from "../../src/voxel/structural/componentIndex";
import {cutAt,rootFor,uFixture} from "./componentIndex/compactFixtures";
import {HVP_SOURCE_MIN_METERS} from "../../src/hvp/hvpCoastSource";
import type {issueHvpCompactNativeOwner} from "../../src/hestia-prototype/physics/compactNativeOwner";
import type {HvpBodyCheckpoint} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
const capability="hvp-compact-native-ipc-qualification-v1";
type Identity=ReturnType<typeof issueHvpCompactNativeOwner>["identity"];
type State=Record<"position"|"rotation"|"velocity"|"angular",Record<string,number>>;
type Child={ownerId:string;hash:string;cells:number;mass:number;velocity:Record<string,number>;angular:Record<string,number>};
interface Result {identity?:Identity;parent?:Identity;archiveReady?:boolean;state?:State;saved?:HvpBodyCheckpoint;legacyHash?:string;
  children?:Child[];hit?:number[];bodies?:number;colliders?:number;released?:number;threadId?:number;}
function endpoint(url:URL,incarnation:number) {
  const worker=new Worker(url,{workerData:{capability,incarnation}});
  let id=0;
  return {worker,async send(input:Record<string,unknown>):Promise<Result> {
    const request=++id;
    const receive=once(worker,"message",{signal:AbortSignal.timeout(30000)});
    worker.postMessage({id:request,incarnation,capability,...input});
    const [reply]=await receive;
    if(reply.id!==request||reply.threadId===0) throw new Error("Wrong actual worker reply");
    if(reply.error) throw new Error(reply.error);
    return reply.result;
  }};
}
function expectMotion(a:Record<string,number>,b:Record<string,number>,places:number) {
  expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  for(const k of Object.keys(a)) expect(a[k]).toBeCloseTo(b[k]!,places);
}

it("qualifies real R05 worker IPC from compact admission and native query through cold moving recut",async()=>{
  const entry=fileURLToPath(new URL("../performance/componentIndex/compactNativeQualificationWorker.ts",import.meta.url));
  const bundle=await rolldown({input:entry,platform:"node",logLevel:"silent"});
  const directory=await mkdtemp(join(tmpdir(),"hvp-compact-worker-"));
  const workerPath=join(directory,"qualification.mjs"),workerUrl=pathToFileURL(workerPath);
  try {
    const output=await bundle.generate({format:"esm",codeSplitting:false});
    const entryChunk=output.output.find(c=>c.type==="chunk"&&c.isEntry);
    if(!entryChunk||entryChunk.type!=="chunk") throw new Error("Missing qualification worker");
    await writeFile(workerPath,entryChunk.code);
  } finally {await bundle.close();}
  const root=rootFor(uFixture()),cut=cutAt(root,[12,2,4]),index=createTerrainComponentIndex(cut.before);
  const fragment=index.prepareCompact(cut).fragments[0]!;index.dispose();
  const request={ownerId:fragment.ownerId,origin:HVP_SOURCE_MIN_METERS,cells:[],massKg:fragment.massKg,
    colliderBoxes:fragment.colliderBoxes,compactSource:{generation:fragment.revision,parts:fragment.parts,cellCount:fragment.cellCount}};
  const binding={sessionId:cut.before.sessionId,epoch:cut.before.epoch,generation:fragment.revision,terrainDigest:cut.after.sourceDigest};
  const live=endpoint(workerUrl,1),peers=[live];
  async function close(peer:typeof live,released:number) {
    const exited=once(peer.worker,"exit");expect((await peer.send({kind:"dispose"})).released).toBe(released);
    expect(await exited).toEqual([0]);
  }
  const samples:{phase:string;roundTripMs:number}[]=[];
  async function run(peer:typeof live,input:Record<string,unknown>,phase:string) {
    const start=performance.now(),result=await peer.send(input);
    samples.push({phase,roundTripMs:performance.now()-start});return result;
  }
  try {
    const denied=once(live.worker,"message");live.worker.postMessage({id:1,incarnation:1,capability:"foreign-capability",kind:"initialize"});
    expect((await denied)[0].error).toMatch(/Wrong endpoint/);
    expect(await run(live,{kind:"initialize"},"worker-wasm-init")).toMatchObject({ready:true});
    const opened=await run(live,{kind:"open",request,binding},"warm-ipc-compact-and-publish");
    const source=opened.identity!;
    expect(source).toMatchObject({...binding,kind:"hvp-compact-runtime-v1",ownerId:request.ownerId});
    expect(source.membershipDigest).toMatch(/^hvp-material-cells-v1:[a-f0-9]{16}$/);
    expect(opened.archiveReady).toBe(false);
    expect(await run(live,{kind:"query",identity:source},"query-before-step")).toMatchObject({identity:source,holeRay:true,holeCapsule:true,wallRay:true,archiveReady:false});
    await expect(live.send({kind:"move",identity:{...source,epoch:source.epoch+1}})).rejects.toThrow(/Stale compact/);
    const moved=await run(live,{kind:"move",identity:source},"native-step");
    expect(moved.archiveReady).toBe(false);expect(moved.state).not.toEqual(opened.state);
    const saved=await run(live,{kind:"save",identity:source},"archive-and-save");
    expect(saved.identity).toEqual(source);expect(saved.legacyHash).toMatch(/^fnv1a64-v1:[a-f0-9]{16}$/);
    const liveCut=await run(live,{kind:"recut",identity:source},"live-recut");
    await expect(live.send({kind:"recut",identity:source})).rejects.toThrow(/Stale compact/);
    await close(live,2);
    const cold=endpoint(workerUrl,2);peers.push(cold);
    const restored=await run(cold,{kind:"cold",saved:saved.saved,binding,identity:source},"cold-restore");
    const invalid={...source,membershipDigest:"hvp-material-cells-v1:0000000000000000"};
    await expect(cold.send({kind:"query",identity:invalid})).rejects.toThrow(/Stale compact identity/);
    expect(restored.identity).toEqual(source);expect(restored.threadId).not.toBe(opened.threadId);
    for(const field of ["position","rotation","velocity","angular"] as const) expectMotion(restored.state![field],moved.state![field],5);
    const coldCut=await run(cold,{kind:"recut",identity:source},"cold-recut");
    await close(cold,2);
    for(const cut of [liveCut,coldCut]) {
      expect(cut.parent).toEqual(source);expect(cut.hit).toEqual([18,3,4]);
      expect(cut.bodies).toBe(2);expect(cut.children).toHaveLength(2);
      expect(cut.children!.reduce((n,body)=>n+body.cells,0)).toBe(fragment.cellCount-1);
    }
    for(const [i,a] of liveCut.children!.entries()) {
      const b=coldCut.children![i]!;
      expect([a.ownerId,a.hash,a.cells,a.mass]).toEqual([b.ownerId,b.hash,b.cells,b.mass]);
      expectMotion(a.velocity,b.velocity,5);expectMotion(a.angular,b.angular,5);
    }
    const rejection=endpoint(workerUrl,3);peers.push(rejection);
    await expect(rejection.send({kind:"cold",saved:saved.saved,binding,identity:invalid})).rejects.toThrow(/Saved fragment identity mismatch/);
    await close(rejection,0);
    console.info("Isolated compact R05 worker IPC",JSON.stringify({capability,identity:source,legacyDigest:saved.legacyHash,samples}));
  } finally {await Promise.all(peers.map(peer=>peer.worker.terminate()));await rm(directory,{recursive:true,force:true});}
},90000);
