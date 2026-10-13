/** Finite browser functionality. No benchmark, threshold calibration or reference acceptance. */
export async function runProfile(b){
  const checks=[];const assert=(name,condition,detail)=>{checks.push({name,status:condition?'PASS':'FAIL',detail});};
  const matrix=[],shaderByDigest=new Map();
  for(const scene of ['terrain-ao','alpha-wind','water-depth']){
    const captures={};const rows=[];
    for(const variant of ['historical-webgl','current-webgl','current-webgpu']){
      await b.mount(variant);await b.setScene(scene);const facts=b.facts();
      assert(`${scene}/${variant}/actual-backend`,facts.status==='PASS'&&facts.actualBackend===(variant==='current-webgpu'?'WebGPU':'WebGL2'),facts);
      if(facts.status!=='PASS')continue;
      const image=await b.capture();captures[variant]=image;
      assert(`${scene}/${variant}/native-shadow-target`,b.facts().liveShadowTargets>0,{liveShadowTargets:b.facts().liveShadowTargets});
      const input=b.readPresentationInputs();assert(`${scene}/${variant}/depth-camera-port`,input.depth.isDepthTexture&&input.projection.length===16&&input.view.length===16&&Object.isFrozen(input.sourceBinding)&&b.isPresentationCurrent(input.epoch),{epoch:input.epoch,sourceBinding:input.sourceBinding});
      assert(`${scene}/${variant}/nonblank`,b.compareImages(new Uint8Array(image.pixels),new Uint8Array(image.pixels),image.width,image.height).pass,{sha256:image.sha256});
      const shaders=await b.shaderBindings();assert(`${scene}/${variant}/compiled-shaders`,shaders.length>0,{count:shaders.length});
      for(const shader of shaders)shaderByDigest.set(shader.sha256,shader);
      const negatives=[];
      for(const defect of scene==='terrain-ao'?['vertex-colors','ao','emission']:scene==='alpha-wind'?['vertex-colors']:['water-assignment','water-depth','water-side']){
        await b.setDefect(defect);const wrong=await b.capture();const comparison=b.compareImages(new Uint8Array(image.pixels),new Uint8Array(wrong.pixels),image.width,image.height);
        negatives.push({defect,comparison,wrongSha256:wrong.sha256});assert(`${scene}/${variant}/reject-${defect}`,!comparison.pass&&comparison.status==='DIFFERENT',comparison);
      }
      await b.setDefect('none');
      assert(`${scene}/${variant}/stale-depth-port-rejected`,!b.isPresentationCurrent(input.epoch),null);
      if(scene==='water-depth'){
        await b.setWaterView('below');const below=await b.capture();
        assert(`${variant}/water-underside-nonblank`,b.compareImages(new Uint8Array(below.pixels),new Uint8Array(below.pixels),below.width,below.height).pass,{sha256:below.sha256});
        for(const defect of ['water-depth','water-side']){await b.setDefect(defect);const wrong=await b.capture();const comparison=b.compareImages(new Uint8Array(below.pixels),new Uint8Array(wrong.pixels),below.width,below.height);
          assert(`${variant}/underside-reject-${defect}`,!comparison.pass&&comparison.status==='DIFFERENT',comparison);}
        await b.setDefect('none');await b.setWaterView('above');
      }
      if(scene==='alpha-wind'){
        const before=await b.capture(),oldOwner=b.facts().owner;await b.transferOwner(oldOwner);const moved=await b.capture();
        assert(`${variant}/owner-transfer-visible`,before.sha256!==moved.sha256,{before:before.sha256,after:moved.sha256,owner:b.facts().owner});
        let rejected=false;try{await b.transferOwner(oldOwner);}catch{rejected=true;}assert(`${variant}/stale-owner-rejected`,rejected,null);
        await b.setTick(180);const wind=await b.capture();assert(`${variant}/wind-tick-visible`,wind.sha256!==moved.sha256,{before:moved.sha256,after:wind.sha256});
        await b.setTick(120);
      }
      rows.push({variant,facts,image:{sha256:image.sha256,width:image.width,height:image.height},negatives});
    }
    const compare=(a,c)=>a&&c?b.compareImages(new Uint8Array(a.pixels),new Uint8Array(c.pixels),a.width,a.height):{pass:false,status:'NOT_RUN'};
    matrix.push({scene,rows,versionParity:compare(captures['historical-webgl'],captures['current-webgl']),backendParity:compare(captures['current-webgl'],captures['current-webgpu'])});
  }
  const lifecycle=[];
  for(const variant of ['historical-webgl','current-webgl','current-webgpu']){
    for(let i=0;i<10;i++){
      await b.mount(variant);await b.resize(352,240);const capture=await b.capture();
      assert(`${variant}/cycle-${i}/resize`,capture.width===352&&capture.height===240&&b.compareImages(new Uint8Array(capture.pixels),new Uint8Array(capture.pixels),352,240).pass,null);
      b.schedule();await b.dispose();const facts=b.facts();assert(`${variant}/cycle-${i}/dispose`,facts.liveRenderers===0&&facts.liveLoops===0&&facts.liveShadowTargets===0,facts);
      lifecycle.push({variant,cycle:i,facts});await b.resize(384,256);
    }
    await b.mount(variant);const borrow=b.readPresentationInputs();const loss=await b.injectLoss();const facts=b.facts();
    assert(`${variant}/injected-loss`,loss===(variant==='current-webgpu'?'DEVICE_LOST':'CONTEXT_LOST')&&facts.liveLoops===0&&facts.status===loss,{loss,facts});
    assert(`${variant}/loss-invalidates-depth-borrow`,!b.isPresentationCurrent(borrow.epoch),{before:borrow.epoch,after:facts.presentationEpoch});
    let lostReadRejected=false;try{b.readPresentationInputs();}catch{lostReadRejected=true;}assert(`${variant}/lost-depth-read-rejected`,lostReadRejected,null);
    await b.dispose();await b.mount(variant);assert(`${variant}/remount-after-loss`,b.facts().status==='PASS',b.facts());await b.dispose();
  }
  const capabilities=[];
  for(const [name,opts] of [['no-adapter',{forceNoAdapter:true}],['wrong-feature',{requiredFeatures:['gfx03-deliberate-unsupported']}],['limits',{requiredLimits:{maxTextureDimension2D:2147483647}}]]){
    const facts=await b.mount('current-webgpu',opts);assert(name,facts.status==='UNSUPPORTED'&&facts.actualBackend!== 'WebGL2',facts);capabilities.push({name,facts});
  }
  await b.dispose();const final=b.facts();assert('no-unhandled-gpu-errors',final.errors.length===0,final.errors);
  return {schema:'hestia.gfx03-functional-profile.v1',environment:'LOCAL_WINDOWS_ISOLATED',concurrentSessions:true,
    framebuffer:[384,256],dpr:1,qualifiedPerformance:'NOT_RUN',referenceAcceptance:'NOT_RUN',gpuTimerMs:null,
    functionality:checks.every(c=>c.status==='PASS')?'PASS':'FAIL',checks,matrix,lifecycle,capabilities,
    shaderBindings:[...shaderByDigest.values()],final};
}
