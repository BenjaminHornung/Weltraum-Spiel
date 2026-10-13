import {chromium} from '/workspace/Weltraum-Spiel/apps/weltraum-browser/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='/workspace/.cloud-setup/ui-ceramic-2026-10-13';
const browser=await chromium.launch({headless:true,executablePath:'/workspace/.cloud-setup/bin/chromium-hestia-mesa'});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],events=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
await page.goto('http://127.0.0.1:5191/',{waitUntil:'domcontentloaded'});
await page.locator('#graphics-settings-button').waitFor();
assert.equal(await page.evaluate(()=> 'TestBridge' in window),false);
await page.screenshot({path:out+'/main-01-english.png'});
events.push({name:'normal-main',text:await page.locator('body').innerText()});
await page.locator('#graphics-settings-button').click();
await page.locator('#graphics-settings-dialog[open]').waitFor();
await page.screenshot({path:out+'/main-02-graphics-english.png'});
events.push({name:'graphics-dialog',text:await page.locator('#graphics-settings-dialog').innerText()});
await page.keyboard.press('Escape');assert.equal(await page.locator('#graphics-settings-dialog').evaluate(e=>e.open),false);
await page.goto('http://127.0.0.1:5191/factory.html',{waitUntil:'domcontentloaded'});
await page.getByRole('button',{name:'New game',exact:true}).click();
await page.getByRole('button',{name:'Open workshop',exact:true}).click();
await page.keyboard.press('Escape');
const objective=page.locator('.factory-shell-objective');
for(let i=0;i<15;i++){await page.keyboard.press('Tab');if(await objective.evaluate(e=>e===document.activeElement))break;}
assert.equal(await objective.evaluate(e=>e===document.activeElement),true);
assert.equal(await objective.evaluate(e=>e.matches(':focus-visible')),true);
events.push({name:'keyboard-objective-focus',style:await objective.evaluate(e=>({boxShadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outline,clip:getComputedStyle(e).clipPath}))});
await page.screenshot({path:out+'/focus-objective-final.png'});
}finally{await writeFile(out+'/main-and-focus-smoke.json',JSON.stringify({events,errors,exitCode:process.exitCode??0},null,2));await browser.close();}
