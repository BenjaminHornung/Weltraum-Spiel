async (page) => {
 const executable='C:/IFI_SourceCode/Utils/opencode-migration/runtime/chromium-1234/chrome-win64/chrome.exe';
 const ownedBrowser=await page.context().browser().browserType().launch({executablePath:executable,headless:true,args:['--disable-gpu']});
 try {
 page=await ownedBrowser.newPage({viewport:{width:1036,height:766}});
 const output='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-RT-08-2026-10-09/.devtoolbox/specs/changes/rt-08-2026-10-09/tests';
 await page.goto('http://127.0.0.1:55316/');await page.waitForFunction(()=>Boolean(window.rt08?.inspect().snapshot));
 const checks=await page.evaluate(()=>{
   const controls=()=>Array.from(document.querySelectorAll('button,input,select')).map(e=>({id:e.id,disabled:e.disabled}));
   const initial=window.rt08.inspect();
   const spp=document.querySelector('#spp');const options=Array.from(spp.options).map(o=>o.value);
   document.querySelector('#width').value='640';document.querySelector('#height').value='360';document.querySelector('#resize').click();
   const resize={width:document.querySelector('#photo').width,height:document.querySelector('#photo').height,gpuRequested:window.rt08.inspect().gpuRequested};
   document.querySelector('#width').value='0';document.querySelector('#resize').click();const invalid=document.querySelector('#status').textContent;
   return {initial,options,resize,invalid,browser:navigator.userAgent,DPR:devicePixelRatio,viewport:[innerWidth,innerHeight],controls:controls()};
 });
 await page.screenshot({path:output+'/dom-review-final-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/dom-review-final-narrow.png',fullPage:true});
 const disposed=await page.evaluate(async()=>{document.querySelector('#dispose').click();await Promise.resolve();window.dispatchEvent(new Event('pagehide'));await Promise.resolve();return {state:window.rt08.inspect(),controls:Array.from(document.querySelectorAll('button,input,select')).map(e=>({id:e.id,disabled:e.disabled}))};});
 await page.screenshot({path:output+'/dom-review-final-disposed.png',fullPage:true});
 const passed=checks.initial.mode==='DOM_ONLY'&&!checks.initial.gpuRequested&&JSON.stringify(checks.options)==='["32","128","512"]'&&checks.resize.width===640&&checks.resize.height===360&&!checks.resize.gpuRequested&&checks.invalid.startsWith('FAIL')&&disposed.state.closed&&disposed.state.state==='disposed'&&!disposed.state.gpuRequested&&disposed.controls.every(c=>c.disabled);
 const browser=page.context().browser();
 const result={status:passed?'PASS':'FAIL',checks,disposed,browserVersion:browser.version(),actualBrowserExecutable:executable,launch:'TOOL_NATIVE_APPROVED_EXISTING_C_BINARY_CPU_DOM_DISABLE_GPU',actualAdapter:'NOT_RUN_NO_GPU',executionLocation:'LOCAL_WINDOWS_ISOLATED',load:'OTHER_SESSIONS_ACTIVE_NOT_REFERENCE',url:page.url()};
 if(!passed)throw Error('DOM repaired acceptance failed');return result;
 } finally {await ownedBrowser.close();}
}
