import {test,expect,type Page} from '../../../../../apps/weltraum-browser/node_modules/@playwright/test/index.mjs';
import {Quaternion,Vector3} from '../../../../../apps/weltraum-browser/node_modules/three/build/three.module.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {readHvpCutMarkers} from '../../../../../apps/weltraum-browser/tests/performance/hvpCutRtReport';
import {createCutCpuProbe} from './cpu-probe';

const root=process.env.WELTRAUM_HVP_MEASURE_DIR!;
const read=(page:Page)=>page.evaluate(()=>({root:Number(document.body.dataset.hestiaPrototypeTerrainGeneration),
  digest:document.body.dataset.hestiaPrototypeSourceDigest,physics:JSON.parse(document.body.dataset.hestiaPrototypePhysics??'null'),
  tool:JSON.parse(document.body.dataset.hestiaPrototypeTool??'null'),camera:JSON.parse(document.body.dataset.hestiaPrototypePlayerCamera??'null'),
  clock:JSON.parse(document.body.dataset.hestiaPrototypePhysicsClock??'null'),resources:JSON.parse(document.body.dataset.hestiaPrototypeResources??'null'),
  save:JSON.parse(document.body.dataset.hestiaPrototypeSave??'null'),
  draws:Number(document.body.dataset.hestiaExperimentDrawSubmits),focused:document.hasFocus(),visible:document.visibilityState,dpr:devicePixelRatio}));
const play=async(page:Page)=>{await page.getByRole('button',{name:'Spielen · WASD / Maus / Space',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe('debug-scene');
  await expect.poll(async()=>(await read(page)).physics.player?.grounded).toBe(true);};
const inspect=async(page:Page)=>{await page.keyboard.press('Escape');await page.getByRole('button',{name:'Zur Inspektionsansicht',exact:true}).click();
  await expect.poll(async()=>(await read(page)).physics.status).toBe('Paused');};
async function aim(page:Page,owner:string){
  await expect.poll(async()=>(await read(page)).camera?.orientation).not.toBeUndefined();
  const cursor={x:640,y:360};
  for(let i=0;i<12;i++){const s=await read(page),body=s.physics.bodies.find((b:any)=>b.ownerId===owner);
    const eye=new Vector3(s.physics.player.position.x,s.physics.player.position.y+.75,s.physics.player.position.z);
    const desired=new Vector3(body.position.x,body.position.y,body.position.z).sub(eye).normalize();
    const forward=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(s.camera.orientation));
    if(desired.dot(forward)>.999&&s.physics.moving.preview?.ownerId===owner){break;}
    const yaw=Math.atan2(-desired.x,-desired.z)-Math.atan2(-forward.x,-forward.z);
    cursor.x-=Math.atan2(Math.sin(yaw),Math.cos(yaw))/.002;cursor.y-=(Math.asin(desired.y)-Math.asin(forward.y))/.002;
    await page.mouse.move(cursor.x,cursor.y);await expect.poll(async()=>(await read(page)).physics.ticks).toBeGreaterThan(s.physics.ticks);
  }await expect.poll(async()=>(await read(page)).physics.moving.preview?.ownerId).toBe(owner);
}
async function aimPoint(page:Page,point:[number,number,number]){
  const cursor={x:640,y:360};
  for(let i=0;i<12;i++){const s=await read(page),p=s.physics.player.position;
    const desired=new Vector3(...point).sub(new Vector3(p.x,p.y+.75,p.z)).normalize();
    const forward=new Vector3(0,0,-1).applyQuaternion(new Quaternion().fromArray(s.camera.orientation));
    if(desired.dot(forward)>.99995){break;}
    const yaw=Math.atan2(-desired.x,-desired.z)-Math.atan2(-forward.x,-forward.z);
    cursor.x-=Math.atan2(Math.sin(yaw),Math.cos(yaw))/.002;cursor.y-=(Math.asin(desired.y)-Math.asin(forward.y))/.002;
    await page.mouse.move(cursor.x,cursor.y);await expect.poll(async()=>(await read(page)).physics.ticks).toBeGreaterThan(s.physics.ticks);
  }
  await expect.poll(async()=>(await read(page)).tool.message).toContain('Stützzellen');
}
// Alternating independent fresh sessions; AB/BA balances order without a second runner.
const terrainRepeat=process.env.WELTRAUM_PROBE_TERRAIN_REPEAT==='1';
const variants=(process.env.WELTRAUM_PROBE_VARIANTS??'reference,direct').split(',') as Array<'reference'|'direct'|'owned-moving'|'owned-terrain'>;
if(variants.length!==2||variants.some(v=>!['reference','direct','owned-moving','owned-terrain'].includes(v))){throw new Error('Two declared built variants required');}
for(let pair=0;pair<Number(process.env.WELTRAUM_PROBE_PAIRS??1);pair++){for(const kernel of (pair%2?[...variants].reverse():variants)){for(const draw of [true,false]){
  test(`pair-${pair} ${kernel}-${draw?'draw-on':'draw-off'} real detach recut and prepared replay`,async({page,browser},testInfo)=>{
    const name=`pair-${pair}-${kernel}-${draw?'draw-on':'draw-off'}-repeat-${testInfo.repeatEachIndex}`,errors:string[]=[],networkErrors:Array<{path:string;status:number}>=[],ownerPlans:any[]=[],ownerEvents:any[]=[];
    let environment:unknown;
    page.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());if(u.origin==='http://127.0.0.1:5278'){networkErrors.push({path:u.pathname,status:r.status()});}}});
    page.on('pageerror',e=>errors.push(e.name));page.on('console',m=>{const prefix='hvp-owned-body-plan-budget ';if(m.text().startsWith(prefix)&&ownerPlans.length<8){ownerPlans.push(JSON.parse(m.text().slice(prefix.length)));}
      for(const event of ['hvp-owned-body-quote ','hvp-owned-body-rpc ']){if(m.text().startsWith(event)&&ownerEvents.length<32){ownerEvents.push({kind:event.trim(),...JSON.parse(m.text().slice(event.length))});}}
      if(m.type()==='error'){
      errors.push(m.text().replace(/https?:\/\/\S+/g,'[local-url]').slice(0,400));}});
    await page.addInitScript(()=>{const w=window as any;w.CutProbeMeasures=[];w.CutProbeDrops=0;
      new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.name.startsWith('hvp.cut')){continue;}
        if(w.CutProbeMeasures.length===8192){w.CutProbeDrops++;continue;}w.CutProbeMeasures.push({name:e.name,start:e.startTime,duration:e.duration,detail:(e as PerformanceMeasure).detail});}}).observe({type:'measure'});});
    const results:any[]=[];let replay:any=null,failed:string|null=null;
    let profile=process.env.WELTRAUM_PROBE_CPU==='1'?await createCutCpuProbe(page):null;
    const control=(code:string)=>page.evaluate(code);
    try{
      await page.goto(`http://127.0.0.1:5278/?hvpMeasure=1&hvpScenario=rock-arm&kernel=${kernel}`);await page.bringToFront();
      await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});
      environment=await page.evaluate(()=>{const canvas=document.querySelector('#debug-scene') as HTMLCanvasElement,gl=canvas.getContext('webgl2')!;
        const ext=gl.getExtension('WEBGL_debug_renderer_info');return {dpr:devicePixelRatio,viewport:[innerWidth,innerHeight],canvas:[canvas.width,canvas.height],
          drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'UNSUPPORTED',
          vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):'UNSUPPORTED'};});
      expect(await page.evaluate(()=>({dpr:devicePixelRatio,width:innerWidth,height:innerHeight}))).toEqual({dpr:1,width:1280,height:720});
      await page.getByRole('button',{name:'Stütze anvisieren (2 + Klick)',exact:true}).click();
      await expect.poll(async()=>(await read(page)).physics.status).toBe('Paused');await play(page);await page.keyboard.press('Digit2');
      await expect.poll(async()=>(await read(page)).tool.message).toContain('Stützzellen');
      for(const body of [false,true]){
        const moving=body&&!terrainRepeat;
        if(body&&terrainRepeat){await aimPoint(page,[6.1875,1.3125,-6.3125]);}
        if(moving){const owner=(await read(page)).physics.terrainFragments[0].ownerId;
          await expect.poll(async()=>(await read(page)).physics.bodies.find((b:any)=>b.ownerId===owner)?.sleeping,{timeout:20000}).toBe(true);
          await aim(page,owner);await page.keyboard.press('KeyF');await expect.poll(async()=>(await read(page)).physics.bodies.find((b:any)=>b.ownerId===owner)?.sleeping).toBe(false);}
        await control(`window.CutProbe.setDrawing(${draw})`);await page.waitForTimeout(50);const before=await read(page);await profile?.begin();
        await page.mouse.down();await page.mouse.up();
        await expect.poll(async()=>{const s=await read(page);return moving?s.tool.moving?.last?.status:(s.tool.last?.commandId===(body?'cut-2':'cut-1')?s.tool.last.status:undefined);},{timeout:30000}).toBe('Applied');
        const after=await read(page),id=moving?after.tool.moving.last.id:after.tool.last.commandId;
        await page.waitForTimeout(50);
        const raw=await page.evaluate(()=>({entries:(window as any).CutProbeMeasures,drops:(window as any).CutProbeDrops}));
        const markers=readHvpCutMarkers(raw.entries,id,moving);
        expect(markers.outcome).toBe('Applied');expect(markers.appliedMs).not.toBeNull();expect(raw.drops).toBe(0);
        if(draw){expect(markers.firstCommittedRenderSubmitMs).not.toBeNull();expect(after.draws).toBeGreaterThan(before.draws);}
        else{expect(markers.firstCommittedRenderSubmitMs).toBeNull();expect(after.draws).toBe(before.draws);}
        expect(after.physics.terrainGeneration).toBe(after.root);expect(after.physics.terrainTransaction).toBe('Idle');
        if(!terrainRepeat||!body){expect(after.physics.terrainFragments[0].cellCount).toBe(moving?352:384);}
        if(terrainRepeat&&body){expect(after.root).toBe(before.root+1);expect(after.tool.last.transferredCells).toBeGreaterThan(0);
          const facts=await page.evaluate(()=>(window as any).CutProbe.facts());expect(facts.kernelFacts.mirror.deltaCopied).toBeGreaterThan(0);
          if(kernel==='owned-terrain'){expect(facts.kernelFacts.sourceRegionUtf16Bytes).toBe(0);expect(facts.kernelFacts.nativeAncestorReady).toBe(true);}}
        expect(after.resources.totalCpuBytes).toBeLessThanOrEqual(256*1024*1024);
        results.push({body:moving,warmTerrain:terrainRepeat&&body,draw,classification:profile?'PROFILE_DIAGNOSTIC':'DIAGNOSTIC',before,after,markers,raw,
          cpuProfile:await profile?.end(),kernelFacts:await control('window.CutProbe.facts()')});
        await control('window.CutProbe.setDrawing(true)');await page.waitForTimeout(100);
      }
      if(profile){await profile.dispose();profile=null;}
      await inspect(page);
      if(kernel!=='reference'&&draw&&!terrainRepeat){
        const saved=await read(page);await page.getByRole('button',{name:'Spielstand speichern',exact:true}).click();
        await expect.poll(async()=>(await read(page)).save.state,{timeout:30000}).toBe('Saved');
        const close=await control('window.CutProbe.dispose()');expect(close).toMatchObject({state:'Disposed'});
        await page.goto(`http://127.0.0.1:5278/?hvpMeasure=1&hvpScenario=rock-arm&kernel=${kernel}&hvpLoad=primary`);
        await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});
        const loaded=await read(page);expect(loaded.root).toBe(saved.root);expect(loaded.digest).toBe(saved.digest);
        expect(loaded.physics.terrainFragments.map((b:any)=>({id:b.ownerId,digest:b.sourceDigest,cells:b.cellCount,mass:b.massKg})))
          .toEqual(saved.physics.terrainFragments.map((b:any)=>({id:b.ownerId,digest:b.sourceDigest,cells:b.cellCount,mass:b.massKg})));
        await play(page);await page.keyboard.press('Digit2');const owner=loaded.physics.terrainFragments[0].ownerId;
        await aim(page,owner);const before=await read(page);await page.mouse.down();await page.mouse.up();
        await expect.poll(async()=>(await read(page)).tool.moving?.last?.id).toBe('moving-cut-2');
        await expect.poll(async()=>(await read(page)).tool.moving?.last?.status,{timeout:30000}).toBe('Applied');
        const after=await read(page),receipt=after.physics.moving.last;
        results.push({classification:'functional-save-cold-load-consecutive-recut',saved,loaded,before,after});
        expect(receipt.id).toBe('moving-cut-2');expect(receipt.status).toBe('Applied');
        expect(Number.isSafeInteger(receipt.removedCells)).toBe(true);expect(Number.isFinite(receipt.removedMassKg)).toBe(true);
        expect(after.root).toBe(before.root);expect(after.physics.terrainGeneration).toBe(after.root);
        expect(after.physics.terrainFragments.reduce((n:number,b:any)=>n+b.cellCount,receipt.removedCells)).toBe(before.physics.terrainFragments[0].cellCount);
        expect(Math.abs(after.physics.terrainFragments.reduce((n:number,b:any)=>n+b.massKg,receipt.removedMassKg)-before.physics.terrainFragments[0].massKg)).toBeLessThanOrEqual(1e-8);
        await inspect(page);
      }
      if(draw){
        if(process.env.WELTRAUM_PROBE_REPLAY_FAULT==='1'){
          replay=await page.evaluate(async()=>{try{await (window as any).CutProbe.replay(120,'render');return {injectedFailureObserved:false};}
            catch(error){return {injectedFailureObserved:error instanceof Error&&error.message==='Injected replay render failure',facts:(window as any).CutProbe.facts()};}});
          expect(replay.injectedFailureObserved).toBe(true);expect(replay.facts.replayDisposal.state).toBe('Disposed');
          expect(replay.facts.replayDisposal.queryActive).toBe(false);expect(Object.values(replay.facts.replayDisposal.remaining).every(n=>n===0)).toBe(true);
        }else{replay=await control('window.CutProbe.replay(120)');expect(replay.productHashes.length).toBeGreaterThan(0);
          expect(replay.replayDisposal.state).toBe('Disposed');expect(Object.values(replay.replayDisposal.remaining).every(n=>n===0)).toBe(true);}}
      else{await control('window.CutProbe.dispose()');}
      expect(errors).toEqual([]);
    }catch(error){failed=error instanceof Error?error.name:'Unknown';throw error;}
    finally{await profile?.dispose();await mkdir(root,{recursive:true});await writeFile(`${root}/${name}.json`,JSON.stringify({name,failed,errors,networkErrors,browser:browser.version(),environment,ownerPlans,ownerEvents,results,replay},null,2),{flag:'wx'});}
  });
}}}

if(process.env.WELTRAUM_PROBE_LIFECYCLE==='1'){
  test('direct native-source cancel late release and ordinary reset',async({page,browser})=>{
    const workerFault=process.env.WELTRAUM_PROBE_NATIVE_FAULT==='1',errors:string[]=[];page.on('pageerror',e=>errors.push(e.name));const facts=()=>page.evaluate(()=>(window as any).CutProbe.facts());
    const observer=workerFault?await createCutCpuProbe(page):null;
    const records:any[]=[];let failed:string|null=null;
    try{
      await page.addInitScript(()=>{const w=window as any;w.CutProbeMeasures=[];new PerformanceObserver(list=>{
        for(const e of list.getEntries()){if(e.name.startsWith('hvp.cut')){w.CutProbeMeasures.push({name:e.name,start:e.startTime,duration:e.duration,detail:(e as PerformanceMeasure).detail});}}
      }).observe({type:'measure'});});
      await page.goto('http://127.0.0.1:5278/?hvpMeasure=1&hvpScenario=rock-arm&kernel=direct&delay=native-source');await page.bringToFront();
      await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});
      await page.getByRole('button',{name:'Stütze anvisieren (2 + Klick)',exact:true}).click();
      await expect.poll(async()=>(await read(page)).physics.status).toBe('Paused');await play(page);await page.keyboard.press('Digit2');
      await expect.poll(async()=>(await read(page)).tool.message).toContain('Stützzellen');const before=await read(page);
      await page.mouse.down();await page.mouse.up();
      await expect.poll(async()=>(await facts()).nativeGate?.state,{timeout:30000}).toBe('Ready');const prepared=await facts();
      expect(prepared.nativeGate.sourceViews[0].cellCount).toBe(384);expect((await read(page)).root).toBe(before.root);
      if(workerFault){await observer!.closeNativeWorkerUnexpectedly();await expect.poll(()=>observer!.nativeFaultObserved()).toBe(true);}
      await page.evaluate(()=>(window as any).CutProbe.beginDispose());
      await page.waitForTimeout(50);await page.evaluate(()=>(window as any).CutProbe.releaseNativeSource());
      const disposalAttempt=await page.evaluate(async()=>{try{return {receipt:await (window as any).CutProbe.dispose(),error:null};}
        catch(error){return {receipt:(window as any).CutProbe.facts().disposal,error:error instanceof Error?error.name:'Unknown'};}});
      const receipt=disposalAttempt.receipt;
      records.push({stage:'disposal-attempt-before-assertions',before,prepared,disposalAttempt,
        nativeExitObserved:observer?.nativeFaultObserved()??false,nativeRelease:workerFault?'UNCONFIRMED_NO_NATIVE_ACK':'ReceiptRequired'});
      expect(receipt.finalTerrainRoot.revision).toBe(before.root);expect(receipt.finalTerrainRoot.sourceDigest).toBe(before.digest);
      if(workerFault){expect(receipt.state).toBe('Failed');expect(receipt.errors.length).toBeGreaterThan(0);
        expect(receipt.disposed.workers).toBe(0);expect(receipt.disposed.pendingJobs).toBe(0);expect(receipt.disposed.listeners).toBe(0);
        // Failed remote shutdown retains the last reported clock/World counts.
        // These are unconfirmed snapshots, not measurements of live native timers/bodies.
      }
      else{expect(receipt.state).toBe('Disposed');expect(Object.values(receipt.disposed).every(n=>n===0)).toBe(true);}
      await page.waitForTimeout(250);const terminal=await facts(),raw=await page.evaluate(()=>(window as any).CutProbeMeasures);
      expect(terminal.nativeGate.state).toBe('Released');expect(terminal.kernelFacts.mirror).toBeNull();
      expect(readHvpCutMarkers(raw,'cut-1',false).outcome).not.toBe('Applied');records.push({before,prepared,disposalAttempt,receipt,terminal,raw});
      await observer?.dispose();
      await page.goto('http://127.0.0.1:5278/?hvpMeasure=1&hvpScenario=rock-arm&kernel=direct');
      await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});
      expect((await facts()).kernel).toBe('direct-known-cells-v1');expect((await read(page)).root).toBe(0);
      page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Neustart: Felsarm',exact:true}).click();
      await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});await page.waitForTimeout(250);
      const reset=await read(page);expect(reset.root).toBe(0);expect(reset.physics.terrainGeneration).toBe(0);expect(reset.tool.issued).toBe(0);
      expect((await facts()).kernel).toBe('checkpoint-reference');records.push({reset,newSessionSelection:'Explicit direct remount, then ordinary reset selects default reference'});
      const closing=await page.evaluate(()=>(window as any).CutProbe.dispose());expect(closing.state).toBe('Disposed');records.push({closing});if(!workerFault){expect(errors).toEqual([]);}
    }catch(error){failed=error instanceof Error?error.name:'Unknown';throw error;}
    finally{await mkdir(root,{recursive:true});await writeFile(`${root}/native-source-cancel-late-reset.json`,JSON.stringify({classification:'fault-and-lifecycle-diagnostic',workerFault,failed,errors,browser:browser.version(),records},null,2));}
  });
}

if(process.env.WELTRAUM_PROBE_MOVING_FAULT==='1'){
  test('owned Moving real prepared-plan cancellation late release and fresh recovery',async({page,browser})=>{
    const fault=process.env.WELTRAUM_PROBE_NATIVE_FAULT==='1',records:any[]=[];let failed:string|null=null;
    const observer=fault?await createCutCpuProbe(page):null;
    const facts=()=>page.evaluate(()=>(window as any).CutProbe.facts());
    try{
      await page.goto('http://127.0.0.1:5278/?hvpMeasure=1&hvpScenario=rock-arm&kernel=owned-moving&delay=moving-plan');await page.bringToFront();
      await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});
      await page.getByRole('button',{name:'Stütze anvisieren (2 + Klick)',exact:true}).click();await play(page);await page.keyboard.press('Digit2');
      await expect.poll(async()=>(await read(page)).tool.message).toContain('Stützzellen');await page.mouse.down();await page.mouse.up();
      await expect.poll(async()=>(await read(page)).tool.last?.status,{timeout:30000}).toBe('Applied');
      const owner=(await read(page)).physics.terrainFragments[0].ownerId;
      await expect.poll(async()=>(await read(page)).physics.bodies.find((b:any)=>b.ownerId===owner)?.sleeping,{timeout:20000}).toBe(true);
      await aim(page,owner);await page.keyboard.press('KeyF');await expect.poll(async()=>(await read(page)).physics.bodies.find((b:any)=>b.ownerId===owner)?.sleeping).toBe(false);
      const before=await read(page);await page.mouse.down();await page.mouse.up();
      await expect.poll(async()=>(await facts()).nativeGate?.state,{timeout:30000}).toBe('Ready');const prepared=await facts();
      expect(prepared.nativeGate.projection.parts.reduce((n:number,p:any)=>n+p.cells.length,0)).toBe(352);
      expect((await read(page)).root).toBe(before.root);const ticks=(await read(page)).physics.ticks;
      await expect.poll(async()=>(await read(page)).physics.ticks).toBeGreaterThan(ticks);
      if(fault){await observer!.closeNativeWorkerUnexpectedly();await expect.poll(()=>observer!.nativeFaultObserved()).toBe(true);}
      await page.evaluate(()=>(window as any).CutProbe.beginDispose());await page.waitForTimeout(50);await page.evaluate(()=>(window as any).CutProbe.releaseNativeSource());
      const closing=await page.evaluate(async()=>{try{return {receipt:await (window as any).CutProbe.dispose(),error:null};}
        catch(e){return {receipt:(window as any).CutProbe.facts().disposal,error:e instanceof Error?e.name:'Unknown'};}});
      records.push({before,prepared,closing,nativeExitObserved:observer?.nativeFaultObserved()??false,nativeRelease:fault?'UNCONFIRMED_NO_NATIVE_ACK':'ReceiptRequired'});
      expect(closing.receipt.finalTerrainRoot.revision).toBe(before.root);expect(closing.receipt.finalTerrainRoot.sourceDigest).toBe(before.digest);
      if(fault){expect(closing.receipt.state).toBe('Failed');expect(closing.receipt.disposed.workers).toBe(0);expect(closing.receipt.disposed.pendingJobs).toBe(0);}
      else{expect(closing.receipt.state).toBe('Disposed');expect(Object.values(closing.receipt.disposed).every(v=>v===0)).toBe(true);}
      await observer?.dispose();
      await page.goto('http://127.0.0.1:5278/?hvpMeasure=1&hvpScenario=rock-arm&kernel=owned-moving');
      await expect(page.locator('#hvp-state')).toContainText('State: Ready',{timeout:30000});expect((await read(page)).root).toBe(0);
      const recovered=await page.evaluate(()=>(window as any).CutProbe.dispose());expect(recovered.state).toBe('Disposed');records.push({recovered});
    }catch(error){failed=error instanceof Error?error.name:'Unknown';throw error;}
    finally{await observer?.dispose().catch(()=>{});await mkdir(root,{recursive:true});await writeFile(`${root}/moving-plan-fault.json`,JSON.stringify({fault,failed,browser:browser.version(),records},null,2),{flag:'wx'});}
  });
}
