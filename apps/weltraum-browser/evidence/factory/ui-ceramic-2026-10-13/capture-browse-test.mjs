import { chromium } from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.argv[2],url=process.argv[3]??'http://127.0.0.1:5190/factory.html';
if(!out)throw Error('Output required');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[],events=[],responses=[];
page.on("response",r=>{if(r.status()>=400)responses.push({url:r.url(),status:r.status()});});
const navigate=async(name)=>{const target=page.getByRole("button",{name,exact:true});if(!await target.isVisible())await page.getByRole("button",{name:"Ansichten",exact:true}).click();await target.click();};
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const capture=async(name)=>{
 await page.screenshot({path:out+'/'+name+'.png'});
 const read=await page.evaluate(()=>({atUtc:new Date().toISOString(),testBridge:'TestBridge' in window,
  ui:JSON.parse(document.body.dataset.hestiaFactoryUi??'null'),construction:JSON.parse(document.body.dataset.hestiaFactoryConstruction??'null'),
  buttons:[...document.querySelectorAll('#factory-shell button')].filter(b=>b.getBoundingClientRect().width>0&&!b.closest('[hidden]')).map(b=>({text:b.textContent.trim(),disabled:b.disabled})),
  mode:document.querySelector('#factory-shell')?.dataset.mode,surface:document.querySelector('.factory-shell-modal')?.dataset.surface}));
 await writeFile(out+'/'+name+'.json',JSON.stringify(read,null,2)+'\n');
 if(read.testBridge)throw Error('Normal route exposed TestBridge');
 events.push({name,surface:read.surface,uiState:read.ui?.state});
};
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.locator('#factory-shell').waitFor({timeout:30000});
 await capture('01-start');
 await page.getByRole('button',{name:'Neues Spiel',exact:true}).click();
 await page.getByRole('button',{name:'Werkstatt ansehen',exact:true}).click();
 const open=page.getByRole('button',{name:'Fracht öffnen',exact:true});
 if(await open.isEnabled()){await open.click();await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null')?.interaction.cargoOpened===true);}
 await capture('02-cargo');
 await navigate("Bauen");
 await page.getByRole('button',{name:'Zuschnitt vorschauen',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryConstruction??'null')?.ghost!=null);
 await capture('03-build');
 await page.getByRole('button',{name:'Andere Anlage wählen',exact:true}).click();
 if(!await page.getByRole('button',{name:'Umformung vorschauen',exact:true}).isVisible())throw Error('BUILD_BROWSE_RED: unchanged preview must allow another selection');
 await navigate("Energie");
 await capture('04-energy');
 await navigate("Karte");await capture('05-map');
 await page.keyboard.press('Escape');await capture('06-paused-hud');
 await page.getByRole('button',{name:'Spielen',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.body.dataset.hestiaFactoryUi??'null')?.host.physicsStatus==='Running');
 await capture('07-playing-hud');
 await page.keyboard.press('Escape');
}catch(e){errors.push(String(e));process.exitCode=1;}
finally{
 await writeFile(out+'/capture-result.json',JSON.stringify({kind:'ACTUAL_NORMAL_BROWSER_CAPTURE',url,viewport:[1280,720],browser:browser.version(),events,errors,responses,exitCode:process.exitCode??0},null,2)+'\n');
 console.log(JSON.stringify({events,errors,responses,exitCode:process.exitCode??0}));await browser.close();
}
