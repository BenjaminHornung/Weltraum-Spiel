async (page) => {
  if (page.url() !== 'http://127.0.0.1:5192/') throw Error('Wrong GFX origin');
  const key='weltraum.browser.graphics-settings';
  const saved=await page.evaluate(key=>localStorage.getItem(key),key);
  await page.setViewportSize({width:1100,height:850});
  const lost=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2');
    const extension=gl?.getExtension('WEBGL_lose_context');
    if(!extension)return false;
    extension.loseContext();return true;
  });
  let lossStatus='UNSUPPORTED';
  if(lost){
    await page.waitForFunction(()=>document.querySelector('#effective').textContent.includes('UnavailableLastKnown'));
    const old=JSON.parse(await page.locator('#effective').textContent());
    await page.locator('#scale').fill('0.8');await page.locator('#scale').press('Tab');
    await page.getByRole('button',{name:'Anwenden',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('WebGL2 unavailable'));
    const effective=JSON.parse(await page.locator('#effective').textContent());
    if(effective.renderScale!==old.renderScale||effective.rendererAvailability!=='UnavailableLastKnown')throw Error('Lost context reported applied scale');
    const row=await page.locator('#capabilities tr').filter({has:page.getByText('adaptiveResolution',{exact:true})}).textContent();
    if(!row.includes('Unsupported'))throw Error('Lost context claimed adaptive capability');
    lossStatus='PASS';
  }
  const future='{ "schemaVersion":9, "settings":{"mustRemain":"future fixture"} }';
  await page.evaluate(({key,future})=>localStorage.setItem(key,future),{key,future});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#probe').textContent.includes('actualBackend'));
  await page.locator('#weather').selectOption('High');
  await page.getByRole('button',{name:'Anwenden',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('future'));
  const bytes=await page.evaluate(key=>localStorage.getItem(key),key);
  if(bytes!==future)throw Error('Future fixture overwritten');
  const futureMessage=await page.locator('#status').textContent();
  if(saved!==null)await page.evaluate(({key,saved})=>localStorage.setItem(key,saved),{key,saved});
  return {contextLoss:lossStatus,futureVersion:'PASS',futureMessage,preservedBytes:bytes,restoredOriginalFixture:true,canvasCount:await page.locator('canvas').count(),purpose:'FUNCTIONAL_DIAGNOSTIC_CONCURRENT_LOAD'};
}
