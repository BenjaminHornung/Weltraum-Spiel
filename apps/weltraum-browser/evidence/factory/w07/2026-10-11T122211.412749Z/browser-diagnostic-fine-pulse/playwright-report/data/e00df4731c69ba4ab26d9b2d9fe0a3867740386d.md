# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-placement.spec.ts >> W07 targeted adaptive fine pulse diagnostic only >> capture actual trusted pulses and final source-window result
- Location: tests/e2e/factory-placement.spec.ts:46:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic "HVP-02 readable coast viewport" [active] [ref=e3]
  - region "Ziel und Physikstoß":
    - generic: Kein Treffer innerhalb von 4 m – näher an einen gelösten Körper herangehen.
    - status: F stößt in Blickrichtung; es greift oder zieht kein Objekt.
    - status: "Zelle · Linksklick: Kein Ziel innerhalb 4 m"
    - generic: "1/2/3 + Linksklick: Schneiden an freigegebenen Stellen · V: Perspektive · Esc: Pause / Übersicht"
  - region "Werkstatt" [ref=e4]:
    - strong [ref=e5]: Hestia · Werkstatt
    - status [ref=e6]: Werkstatt bereit · Aktiv
    - paragraph [ref=e7]: Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht. Gemeinsames Speichern folgt.
    - button "Werkstatt pausieren" [ref=e8]
    - button "Werkstatt fortsetzen" [disabled] [ref=e9]
    - button "Wrackfracht öffnen" [ref=e10]
    - button "Zuschnitt vorschauen" [ref=e11]
    - button "Batterie vorschauen" [ref=e12]
    - button "Verteiler vorschauen" [ref=e13]
    - button "Bauvorschau drehen" [ref=e14]
    - button "Bauvorschau verwerfen" [ref=e15]
    - button "Bau bestätigen" [ref=e16]
    - status [ref=e17]: 0 installierte Objekte · 2984.4 kg Gesamtmaterial
```

# Test source

```ts
  1  | import { expect, test, type BrowserContext, type Page } from "@playwright/test";
  2  | import { writeFile } from "node:fs/promises";
  3  | import path from "node:path";
  4  | 
  5  | // TARGETED_DIAGNOSTIC_ONLY: passive trusted key timestamps and actual Native facts.
  6  | test.describe.serial("W07 targeted adaptive fine pulse diagnostic only",()=>{
  7  |   let context:BrowserContext,page:Page,pulseMs=125;
  8  |   const samples:unknown[]=[];
  9  |   const native=()=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics!));
  10 |   test.beforeAll(async({browser},info)=>{
  11 |     context=await browser.newContext({baseURL:info.project.use.baseURL});page=await context.newPage();
  12 |     await page.addInitScript(()=>{
  13 |       const records:unknown[]=[];
  14 |       Object.defineProperty(window,"__w07TrustedKeyTimes",{value:records});
  15 |       for(const type of ["keydown","keyup"])document.addEventListener(type,event=>{
  16 |         const key=event as KeyboardEvent;if(!["a","d"].includes(key.key.toLowerCase()))return;
  17 |         if(records.length>=64)records.shift();records.push({type,key:key.key,code:key.code,trusted:key.isTrusted,eventTime:key.timeStamp,observedAt:performance.now()});
  18 |       },{capture:true,passive:true});
  19 |     });
  20 |   });
  21 |   test.afterAll(async()=>{await context?.close();});
  22 |   const pulse=async()=>{
  23 |     for(let correction=0;correction<4&&samples.length<8;correction++){
  24 |       const before=await native(),x=before.player.position.x;if(x>=-6.4&&x<=-6.1)break;
  25 |       const key=x>-6.25?"d":"a",usedMs=pulseMs;
  26 |       await page.keyboard.press(key,{delay:usedMs});
  27 |       let after=await native();const released=[after];
  28 |       for(let read=0;read<3;read++){
  29 |         const next=await native();released.push(next);
  30 |         const stable=next.ticks>after.ticks&&Math.abs(next.player.position.x-after.player.position.x)<0.000001&&Math.abs(next.player.position.z-after.player.position.z)<0.000001;
  31 |         after=next;if(stable)break;
  32 |       }
  33 |       const crossed=(x+6.25)*(after.player.position.x+6.25)<0;if(crossed)pulseMs=Math.max(50,Math.round(pulseMs/2));
  34 |       const keys=await page.evaluate(()=>(window as unknown as {__w07TrustedKeyTimes:unknown[]}).__w07TrustedKeyTimes);
  35 |       samples.push({correction:samples.length+1,key,usedMs,nextPulseMs:pulseMs,crossedTarget:crossed,deltaX:after.player.position.x-x,zeroMove:after.player.position.x===x,before,after,released,keys});
  36 |     }
  37 |   };
  38 |   test("normal Factory route and actual source reach Ready",async()=>{
  39 |     await page.goto("/factory.html");await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit",{timeout:20_000});await expect(page.locator("canvas")).toHaveCount(1);
  40 |     expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);
  41 |   });
  42 |   test("normal Play plus at most four released adaptive corrections",async()=>{
  43 |     await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");await expect.poll(async()=>(await native()).player.status).toBe("Walking");await pulse();
  44 |   });
  45 |   test("at most four additional released fine corrections in the same session",async()=>{await pulse();});
  46 |   test("capture actual trusted pulses and final source-window result",async()=>{
  47 |     const final=await native(),keys=await page.evaluate(()=>(window as unknown as {__w07TrustedKeyTimes:unknown[]}).__w07TrustedKeyTimes),input=await page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypeInput!));
  48 |     const result={diagnosticOnly:true,normalGameplayGate:false,initialPulseMs:125,minimumPulseMs:50,maxCorrections:8,samples,final,keys,input,sourceXRegion:[-6.4,-6.1],enteredSourceXRegion:final.player.position.x>=-6.4&&final.player.position.x<=-6.1};
  49 |     await writeFile(path.resolve("evidence/factory/w07",process.env.WELTRAUM_FACTORY_EVIDENCE_RUN!,"68-diagnostic-adaptive-pulses.json"),JSON.stringify(result,null,2)+"\n");
> 50 |     expect(final.player.grounded).toBe(true);expect(result.enteredSourceXRegion).toBe(true);expect(samples.length).toBeLessThanOrEqual(8);
     |                                                                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  51 |   });
  52 | });
  53 | 
```