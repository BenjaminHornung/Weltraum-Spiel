import { makeFixture, canonicalBytes, analyticOracle } from './fixtures.mjs';
const hex=bytes=>[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async bytes=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)));

// Policy checks are local diagnostics. A true value cannot grant human/A0 hardware authorization.
export function requireRunnerLease(lease) {
  if(!lease || lease.task!=='PHY-04' || lease.slotGranted!==true || typeof lease.runnerId!=='string' || !lease.runnerId){
    throw new Error('EXPLICIT_A0_RUNNER_SLOT_REQUIRED');
  }
}
export async function runBoundNexus({lease,count=10,scenario='zeroGravity',bindings,fetchBytes,
  loadModule=async(_path,bytes)=>{
    const url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));
    try{return await import(url);}finally{URL.revokeObjectURL(url);}
  }}) {
  requireRunnerLease(lease);
  const fixture=makeFixture(count,scenario);
  if(bindings?.status!=='PASS' || !/^[0-9a-f]{64}$/.test(bindings.wasm?.sha256??'') ||
    !/^[0-9a-f]{64}$/.test(bindings.module?.sha256??'') || !bindings.shaders?.length){
    throw new Error('NEXUS_BROWSER_BUILD_BLOCKED');
  }
  const wasm=new Uint8Array(await fetchBytes(bindings.wasm.path));
  const moduleBytes=new Uint8Array(await fetchBytes(bindings.module.path));
  if(await digest(wasm)!==bindings.wasm.sha256 || await digest(moduleBytes)!==bindings.module.sha256){
    throw new Error('NEXUS_USE_TIME_BYTE_MISMATCH');
  }
  for(const shader of bindings.shaders) {
    if(await digest(new Uint8Array(await fetchBytes(shader.path)))!==shader.sha256) throw new Error('NEXUS_SHADER_BYTE_MISMATCH');
  }
  // Import the verified owned module bytes; no second URL fetch can replace the checked source.
  const module=await loadModule(bindings.module.path,moduleBytes);
  await module.default({module_or_path:wasm});
  const begin=performance.now();
  const raw=Array.from(await module.run_fixture(true,count,scenario==='zeroGravity',scenario==='dynamicGeometry',
    fixture.bodies.map(x=>x.velocity[0]),undefined));
  const totalBridgeMs=performance.now()-begin;
  if(raw.length!==6+count*6 || raw.some(x=>!Number.isFinite(x))) throw new Error('NEXUS_READBACK_CONTRACT');
  const rows=fixture.bodies.map((body,i)=>{
    const oracle=analyticOracle(body,fixture.dt,fixture.steps,fixture.gravity);
    const state=raw.slice(6+i*6,12+i*6);
    return {id:body.id,position:state.slice(0,3),velocity:state.slice(3),oracle};
  });
  return {status:'DIAGNOSTIC_READBACK_ORACLE_ASSESSMENT_REQUIRED',count,scenario,
    fixtureSha256:await digest(canonicalBytes(fixture)),rows,totalBridgeMs,
    cpuSetupIncludingDeviceMs:raw[0],initialUploadMs:raw[1],encodeSubmitAutoResizeMs:raw[2],
    finalReadbackMs:raw[3],geometryRebuildCombinedMs:raw[4],backendTotalMs:raw[5],
    gpuTimer:null,gpuTimerStatus:'NOT_COLLECTED',actualAdapter:null,actualAdapterStatus:'RUNNER_MUST_CAPTURE_ACTUAL_BACKEND',
    environmentLoad:'CONCURRENT_SESSIONS_UNCONTROLLED_UNLESS_RUNNER_PROVES_OTHERWISE',
    deviceLoss:'NOT_RUN',restart:'NOT_RUN',crossDevice:'NOT_RUN',productIntegration:'NO'};
}
