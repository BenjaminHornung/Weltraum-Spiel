async (page) => {
  // Run only by the sole Runner in its bound A0 slot. Never executed by RT08 producer.
  const run = 'rt08-'+new Date().toISOString().toLowerCase().replaceAll(':','-').replaceAll('.','-');
  if (!(await page.url()).includes('127.0.0.1:') || !(await page.url()).includes('runner=1')) throw Error('Navigate to own printed preview /?runner=1 first; Runner/A0 slot required');
  const save=async(name,data)=>page.evaluate(async({run,name,data})=>{const response=await fetch(`/capture/${run}/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(response.status!==201)throw Error('Capture save rejected '+response.status);},{run,name,data});
  try {
  const captures=[];
  for (const spp of [32,128,512]) {
    await page.selectOption('#spp',String(spp));await page.click('#start');
    await page.waitForFunction(()=>['complete','error','lost','cancelled','disposed'].includes(window.rt08.inspect().state),null,{timeout:185000});
    const state=await page.evaluate(()=>window.rt08.inspect());
    if(state.state!=='complete'){await save('diagnostics',{productIntegration:'NO',status:'FAIL',state});throw Error('Photo failed: '+state.state);}
    const capture=await page.evaluate(()=>window.rt08.captureBytes());
    await save(String(spp),capture);captures.push(capture);
  }
  const convergence=await page.evaluate(async captures=>{
    const pixels=[];for(const c of captures){const image=await createImageBitmap(new Blob([new Uint8Array(c.bytes)],{type:'image/png'}));const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);pixels.push(ctx.getImageData(0,0,canvas.width,canvas.height).data);image.close();}
    const rmse=(a,b)=>Math.sqrt(a.reduce((sum,v,i)=>sum+(i%4===3?0:(v-b[i])**2),0)/(a.length/4*3));
    return {status:'DIAGNOSTIC',comparisonEndpoint:'512 spp is internal endpoint, not ground truth',rmse32to512:rmse(pixels[0],pixels[2]),rmse128to512:rmse(pixels[1],pixels[2]),artDecision:'PENDING_OWNER',referenceQualification:'NO'};
  },captures);
  await page.click('#start');await page.click('#cancel');
  await page.waitForFunction(()=>window.rt08.inspect().state==='cancelled');
  await page.fill('#width','640');await page.fill('#height','360');await page.click('#resize');
  const resized=await page.evaluate(()=>window.rt08.inspect());
  await page.evaluate(()=>window.rt08.loseDeviceForRunner());const lost=await page.evaluate(()=>window.rt08.inspect());
  await page.click('#dispose');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await save('diagnostics',{productIntegration:'NO',convergence,resized,lost,disposed:await page.evaluate(()=>window.rt08.inspect()),hardwareLoss:'INJECTED_DESTROY_ONLY_ACTUAL_DRIVER_LOSS_NOT_PROVEN'});
  return {run,spp:[32,128,512],convergence,productIntegration:'NO',referenceQualification:'NO'};
  } finally {await page.evaluate(()=>window.dispatchEvent(new Event('pagehide'))).catch(()=>{});}
}
