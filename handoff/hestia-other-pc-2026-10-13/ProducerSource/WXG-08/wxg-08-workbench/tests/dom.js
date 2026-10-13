async (page) => {
 const label=await page.evaluate(()=>new URL(location.href).searchParams.get('wxg08EvidenceRun')??'dom-r07');if(!/^[a-z0-9-]+$/.test(label))throw Error('EVIDENCE_LABEL');
 const out='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-WXG-08-2026-10-09/.devtoolbox/specs/changes/wxg-08-2026-10-09/tests/'+label;
 const executablePath='C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
 const context=await page.context().browser().browserType().launchPersistentContext('C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-WXG-08-2026-10-09/spikes/wxg-08-workbench/.runtime/browser-profile-'+label,{executablePath,headless:true,args:['--disable-gpu'],acceptDownloads:true,viewport:{width:1100,height:1000},deviceScaleFactor:1}),browser=context.browser(),p=await context.newPage(),checks=[],errors=[],requests=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure()}));
 const assert=(v,msg)=>{if(!v)throw Error(msg);},status=()=>p.locator('#status').innerText();
 const wait=prefix=>p.waitForFunction(prefix=>document.querySelector('#status').textContent.startsWith(prefix),prefix);
 const check=async(name,fn)=>{try{await fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',error:String(e)});throw e;}};
 const prepare=async()=>{await p.locator('#validate').click();await wait('Validated');await p.locator('#preview').click();await wait('Preview');};
 let result,exportDigest;
 try{
 await p.goto('http://127.0.0.1:4188');await wait('Draft');
 await check('visible draft -> validate -> actual preview',async()=>{await prepare();assert(await p.locator('#map rect').count()===72,'map cells');assert((await p.locator('#sample').innerText()).includes('Known'),'Known');});
 await p.screenshot({path:out+'/hestia-high.png',fullPage:true});
 await check('selected map cell and keyboard probe use actual sample',async()=>{await p.locator('#probe').selectOption('30');assert((await p.locator('#sample').innerText()).includes('row 2 / col 6'),'probe');await p.locator('#probe').focus();await p.keyboard.press('ArrowDown');assert((await p.locator('#sample').innerText()).includes('row 2 / col 7'),'keyboard probe');await p.locator('#map rect').nth(0).click();assert(await p.locator('#probe').inputValue()==='0','map pick');});
 await check('preview controls do not change canonical draft',async()=>{
  const d=await p.locator('#draft').inputValue();await p.locator('#quality').selectOption('Low');await p.locator('#cloud').fill('0.8');await p.locator('#layer').selectOption('wind');
  assert(await p.locator('#draft').inputValue()===d,'preview mutated draft');assert(await p.locator('#map line').count()===0,'Low detail');
  await p.screenshot({path:out+'/wind-low.png',fullPage:true});
  await p.locator('#quality').selectOption('High');assert(await p.locator('#map line').count()===72,'High wind detail');
 });
 await check('keyboard tick invalidates export until fresh preview',async()=>{
  const before=await p.locator('#tick').inputValue();await p.locator('#tick').focus();await p.keyboard.press('ArrowRight');assert(await p.locator('#tick').inputValue()!==before,'keyboard tick');
  assert(await p.locator('#export').isDisabled(),'old preview export');await p.locator('#preview').click();await wait('Preview');
 });
 await check('named versioned event and duplicate ID reject',async()=>{
  await p.locator('#wind').fill('24');await p.locator('#event').click();await prepare();
  await p.locator('#event').click();await p.locator('#validate').click();await wait('Blocked');assert((await status()).includes('DUPLICATE'),'duplicate not rejected');assert(await p.locator('#export').isDisabled(),'invalid export');
  await p.locator('#cancel').click();await wait('Draft');await p.locator('#event').click();await prepare();
 });
 await check('real download -> schema -> reload exact roundtrip',async()=>{
  const promise=p.waitForEvent('download');await p.locator('#export').click();const download=await promise;await download.saveAs(out+'/scenario-export.json');await wait('Exported');
  const stored=await p.evaluate(()=>localStorage.getItem('wxg08.lab.v1.HestiaAuthoring'));
  assert(await p.locator('#export-json').textContent()===stored,'export != stored');const parsed=JSON.parse(stored);assert(parsed.revision===1&&parsed.draft.events.length===1,'schema/events');
  exportDigest=await p.evaluate(async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join(''),stored);
  assert(!/gpuHandle|renderOrigin|camera|worker|authoredCloudCoverage/.test(stored),'export handles');
  await p.reload();await wait('Draft');assert(await p.locator('#draft').inputValue()===JSON.stringify(parsed.draft,null,2),'reload bytes');
 });
 await check('real two-tab Web-Lock stale draft CAS',async()=>{
  const q=await context.newPage();await q.goto('http://127.0.0.1:4188');await q.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Draft'));
  await prepare();await p.locator('#export').click();await wait('Exported');
  await q.locator('#validate').click();await q.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Validated'));
  await q.locator('#preview').click();await q.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Preview'));
  await q.locator('#export').click();await q.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Blocked'));
  assert((await q.locator('#status').innerText()).includes('STALE_DRAFT'),'stale accepted');await q.close();
 });
 await check('invalid range / species / handles use actual validators',async()=>{
  await p.locator('#cancel').click();await wait('Draft');const base=JSON.parse(await p.locator('#draft').inputValue());
  await p.getByText('Kanonischen Draft prüfen / JSON bearbeiten',{exact:true}).click();
  for(const edit of [d=>d.events[0].config.zonalWindMps=-1,d=>d.base.bundle.physics.gasMixture[0].speciesId='invalid',d=>d.camera={},d=>d.events[0].id=7,d=>d.events[0].config.provenance.worker={},d=>d.events[0].config.substellarDirection.gpuHandle={}]){
   const d=JSON.parse(JSON.stringify(base));edit(d);await p.locator('#draft').fill(JSON.stringify(d));await p.locator('#validate').click();await wait('Blocked');assert(await p.locator('#preview').isDisabled()&&await p.locator('#export').isDisabled(),'invalid actions');
  }
 });
 await check('Cancel while real cross-tab CAS waits preserves stored bytes',async()=>{
  await p.keyboard.press('Escape');await wait('Draft');await prepare();const before=await p.evaluate(()=>localStorage.getItem('wxg08.lab.v1.HestiaAuthoring'));
  const q=await context.newPage();await q.goto('http://127.0.0.1:4188');
  await q.evaluate(()=>{void navigator.locks.request('wxg08.lab.v1.HestiaAuthoring',async()=>{window.wxgLockReady=true;await new Promise(resolve=>window.releaseWxgLock=resolve);});});
  await q.waitForFunction(()=>window.wxgLockReady);await p.locator('#export').click();await p.keyboard.press('Escape');await wait('Draft');await q.evaluate(()=>window.releaseWxgLock());
  await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Draft'));assert(await p.evaluate(()=>localStorage.getItem('wxg08.lab.v1.HestiaAuthoring'))===before,'cancelled CAS wrote');await q.close();
 });
 await check('Cancel / Escape discards uncommitted draft',async()=>{
  await p.keyboard.press('Escape');await wait('Draft');const saved=await p.locator('#draft').inputValue();await p.locator('#draft').fill('{}');await p.keyboard.press('Escape');await wait('Draft');assert(await p.locator('#draft').inputValue()===saved,'cancel mismatch');
 });
 await check('planet switch during actual async load admits newest only',async()=>{
  await p.evaluate(()=>{const select=document.querySelector('#planet');for(const value of ['Dust','Methane','Airless']){select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));}});
  await wait('Draft');assert(JSON.parse(await p.locator('#draft').inputValue()).planet==='Airless','stale planet adopted');await prepare();assert((await p.locator('#sample').innerText()).startsWith('NoAtmosphere'),'airless');await p.screenshot({path:out+'/airless.png',fullPage:true});
 });
 await check('all fixture planets and moisture/condensate inspection',async()=>{
  for(const name of ['Hestia','Dust','Methane','GasGiant','TidallyLocked','HestiaAuthoring']){
   await p.locator('#planet').selectOption(name);await wait('Draft');await prepare();const statusText=await p.locator('#sample').innerText();assert(statusText.includes(['Hestia','Methane'].includes(name)?'Unsupported':'Known'),'fixture '+name);await p.screenshot({path:out+'/fixture-'+name+'.png',fullPage:true});
  }
  await p.locator('#layer').selectOption('moisture');assert((await p.locator('#sample').innerText()).includes('UNSUPPORTED_NO_SATURATION'),'fake moisture');await p.locator('#layer').selectOption('condensate');
 });
 await check('responsive keyboard focus and no runtime JS/network errors',async()=>{
  await p.setViewportSize({width:420,height:900});await p.locator('#planet').focus();await p.keyboard.press('Tab');assert(await p.locator('#tick').evaluate(el=>el===document.activeElement),'focus order');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');await p.screenshot({path:out+'/mobile.png',fullPage:true});assert(errors.length===0&&requests.length===0,'runtime errors');
 });
 result={status:'PASS',checks,exportDigest,executablePath,browserVersion:browser.version(),browserArgs:['--disable-gpu'],userAgent:await p.evaluate(()=>navigator.userAgent),viewport:{width:1100,height:1000},lastViewport:{width:420,height:900},dpr:1,actualAdapter:'NOT_REQUESTED_CPU_DOM_SVG',gpuTimer:null,environment:'LOCAL_WINDOWS_ISOLATED',load:'CONCURRENT_UNCONTROLLED',queries:'NONE',errors,requests,productIntegration:'NO',hardware:'NOT_RUN_NO_SLOT'};
 }catch(e){result={status:'FAIL',checks,error:String(e),errors,requests};await p.screenshot({path:out+'/failure.png',fullPage:true});}
 finally{await context.close();}
 return result;
}
