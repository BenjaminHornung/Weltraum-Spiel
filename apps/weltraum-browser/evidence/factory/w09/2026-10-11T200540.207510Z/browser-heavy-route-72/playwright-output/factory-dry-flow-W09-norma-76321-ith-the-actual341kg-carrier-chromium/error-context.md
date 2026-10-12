# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-dry-flow.spec.ts >> W09 normal finite heavy bootstrap transport >> released normal corrections reach the natural west corridor with the actual341kg carrier
- Location: tests/e2e/factory-dry-flow.spec.ts:27:2

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < -8.1
Received:   -6.000001907348633
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
    - paragraph [ref=e7]: Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Schwere Chassis zuerst transportieren, bevor Anlagen den Weg belegen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht oder dem erreichbaren Transportdepot. Gemeinsames Speichern folgt.
    - button "Werkstatt pausieren" [ref=e8]
    - button "Werkstatt fortsetzen" [disabled] [ref=e9]
    - button "Wrackfracht öffnen" [ref=e10]
    - button "Zuschnitt vorschauen" [ref=e11]
    - button "Umformung vorschauen" [ref=e12]
    - button "Rohlager vorschauen" [ref=e13]
    - button "Produktlager vorschauen" [ref=e14]
    - button "Werkbank vorschauen" [ref=e15]
    - button "Neue Stütze platzieren" [ref=e16]
    - button "Batterie vorschauen" [ref=e17]
    - button "Verteiler vorschauen" [ref=e18]
    - button "Bauvorschau drehen" [ref=e19]
    - button "Bauvorschau verwerfen" [ref=e20]
    - button "Bau bestätigen" [ref=e21]
    - status [ref=e22]: 0 installierte Objekte · 2984.4 kg Gesamtmaterial
    - region "Fracht und Lager" [ref=e23]:
      - heading "Fracht und Lager" [level=2] [ref=e24]
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - heading "Wrackfracht 1" [level=3] [ref=e28]
            - paragraph [ref=e29]: 2643,4 kg / 4000 kg · Erreichbar
            - generic [ref=e30]:
              - paragraph [ref=e31]: "Falt-Windanlage 6 kW: 1 Stück · 350 kg"
              - paragraph [ref=e32]: "Falt-Windanlage 6 kW: 1 Stück · 350 kg"
              - paragraph [ref=e33]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
              - paragraph [ref=e34]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
              - paragraph [ref=e35]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
              - paragraph [ref=e36]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
              - paragraph [ref=e37]: "Expeditionsakku 4 kWh: 1 Stück · 50 kg"
              - paragraph [ref=e38]: "40-kW-Verteiler: 1 Stück · 25 kg"
              - paragraph [ref=e39]: "Feldwerkbank: 1 Stück · 40 kg"
              - paragraph [ref=e40]: "Thermogeneratorkern: 1 Stück · 150 kg"
              - paragraph [ref=e41]: "Feldkabel: 40 m · 10 kg"
              - paragraph [ref=e42]: "Materialcontainer: 1 Stück · 60 kg"
              - paragraph [ref=e43]: "Materialcontainer: 1 Stück · 60 kg"
              - paragraph [ref=e44]: "Materialcontainer: 1 Stück · 60 kg"
              - paragraph [ref=e45]: "Fundamentschuh: 1 Stück · 12 kg"
              - paragraph [ref=e46]: "Fundamentschuh: 1 Stück · 12 kg"
              - paragraph [ref=e47]: "Fundamentschuh: 1 Stück · 12 kg"
              - paragraph [ref=e48]: "Fundamentschuh: 1 Stück · 12 kg"
              - paragraph [ref=e49]: "Fundamentschuh: 1 Stück · 12 kg"
              - paragraph [ref=e50]: "Fundamentschuh: 1 Stück · 12 kg"
              - paragraph [ref=e51]: "Geprüfter Schiffsstahl: 96 kg"
              - paragraph [ref=e52]: "Stahlprofile: 60 kg"
              - paragraph [ref=e53]: "Stahlblech: 46 kg"
              - paragraph [ref=e54]: "Rückgewinnungs-Elastomer: 16 kg"
              - paragraph [ref=e55]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e56]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e57]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e58]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e59]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e60]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e61]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e62]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e63]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e64]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e65]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e66]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e67]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e68]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e69]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e70]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e71]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e72]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e73]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e74]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e75]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e76]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e77]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e78]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
              - paragraph [ref=e79]: "Maschinenantriebskern: 1 Stück · 2 kg"
              - paragraph [ref=e80]: "Maschinenantriebskern: 1 Stück · 2 kg"
              - paragraph [ref=e81]: "Maschinenantriebskern: 1 Stück · 2 kg"
              - paragraph [ref=e82]: "Maschinensteuerung: 1 Stück · 0,2 kg"
              - paragraph [ref=e83]: "Maschinensteuerung: 1 Stück · 0,2 kg"
              - paragraph [ref=e84]: "Maschinensteuerung: 1 Stück · 0,2 kg"
              - paragraph [ref=e85]: "Maschinensteuerung: 1 Stück · 0,2 kg"
              - paragraph [ref=e86]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e87]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e88]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e89]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e90]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e91]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e92]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e93]: "Zuschnitt-Werkzeugkopf: 1 Stück · 3 kg"
              - paragraph [ref=e94]: "Brecherbacke: 1 Stück · 6 kg"
              - paragraph [ref=e95]: "Montage-Werkzeugsatz: 1 Stück · 3 kg"
              - paragraph [ref=e96]: "Kleinschürfer-Werkzeugkopf: 1 Stück · 5 kg"
              - paragraph [ref=e97]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
              - paragraph [ref=e98]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
              - paragraph [ref=e99]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
              - paragraph [ref=e100]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
              - paragraph [ref=e101]: "Reservegenerator-/Lagerkern: 1 Stück · 35 kg"
              - paragraph [ref=e102]: "Rotor-/Naben-Bausatz: 1 Stück · 40 kg"
              - paragraph [ref=e103]: "Geborgenes Cutterchassis: 1 Stück · 180 kg"
              - paragraph [ref=e104]: "Geborgenes Brecherchassis: 1 Stück · 450 kg"
            - 'button "Aufnehmen: C26-PACK" [disabled] [ref=e105]'
            - 'button "Aufnehmen: B06-BOM" [disabled] [ref=e106]'
            - 'button "Aufnehmen: BATTERY-PACK" [disabled] [ref=e107]'
            - 'button "Aufnehmen: DISTRIBUTOR-PACK" [disabled] [ref=e108]'
            - 'button "Aufnehmen: BENCH-PACK" [disabled] [ref=e109]'
            - 'button "Aufnehmen: BIN-PACK" [disabled] [ref=e110]'
            - 'button "Aufnehmen: BELT4" [disabled] [ref=e111]'
            - 'button "Aufnehmen: CABLE40" [disabled] [ref=e112]'
            - 'button "Aufnehmen: RAW8" [disabled] [ref=e113]'
            - 'button "Aufnehmen: MONTAGE" [disabled] [ref=e114]'
          - generic [ref=e115]:
            - heading "Transport 1" [level=3] [ref=e116]
            - paragraph [ref=e117]: 341 kg / 341 kg · Erreichbar
            - generic [ref=e118]:
              - paragraph [ref=e119]: "Maschinenantriebskern: 1 Stück · 2 kg"
              - paragraph [ref=e120]: "Maschinensteuerung: 1 Stück · 0,2 kg"
              - paragraph [ref=e121]: "Leitersatz: 1 Stück · 0,8 kg"
              - paragraph [ref=e122]: "Umformwerkzeuge: 1 Stück · 4 kg"
              - paragraph [ref=e123]: "Geborgenes Formerchassis: 1 Stück · 300 kg"
              - paragraph [ref=e124]: "Stahlprofile: 20 kg"
              - paragraph [ref=e125]: "Stahlblech: 14 kg"
            - 'button "Aufnehmen: C27-PACK" [disabled] [ref=e126]'
            - 'button "Aufnehmen: B07-BOM" [disabled] [ref=e127]'
            - 'button "Aufnehmen: MONTAGE" [disabled] [ref=e128]'
        - generic [ref=e129]:
          - button "Fracht öffnen" [ref=e130]
          - paragraph [ref=e131]: "Transportgut: 341 kg"
          - button "Hier ablegen" [ref=e132]
          - button "Zurück zur Fracht" [ref=e133]
        - generic [ref=e134]:
          - heading "Lokal übertragen" [level=3] [ref=e135]
          - combobox "Transferquelle" [ref=e136]:
            - option "Wrackfracht 1 · Falt-Windanlage 6 kW" [selected]
            - option "Wrackfracht 1 · Falt-Windanlage 6 kW"
            - option "Wrackfracht 1 · PV-Faltarray 2 kWp"
            - option "Wrackfracht 1 · PV-Faltarray 2 kWp"
            - option "Wrackfracht 1 · PV-Faltarray 2 kWp"
            - option "Wrackfracht 1 · PV-Faltarray 2 kWp"
            - option "Wrackfracht 1 · Expeditionsakku 4 kWh"
            - option "Wrackfracht 1 · 40-kW-Verteiler"
            - option "Wrackfracht 1 · Feldwerkbank"
            - option "Wrackfracht 1 · Thermogeneratorkern"
            - option "Wrackfracht 1 · Feldkabel"
            - option "Wrackfracht 1 · Materialcontainer"
            - option "Wrackfracht 1 · Materialcontainer"
            - option "Wrackfracht 1 · Materialcontainer"
            - option "Wrackfracht 1 · Fundamentschuh"
            - option "Wrackfracht 1 · Fundamentschuh"
            - option "Wrackfracht 1 · Fundamentschuh"
            - option "Wrackfracht 1 · Fundamentschuh"
            - option "Wrackfracht 1 · Fundamentschuh"
            - option "Wrackfracht 1 · Fundamentschuh"
            - option "Wrackfracht 1 · Geprüfter Schiffsstahl"
            - option "Wrackfracht 1 · Stahlprofile"
            - option "Wrackfracht 1 · Stahlblech"
            - option "Wrackfracht 1 · Rückgewinnungs-Elastomer"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Passives 1-m-Bandmodul"
            - option "Wrackfracht 1 · Maschinenantriebskern"
            - option "Wrackfracht 1 · Maschinenantriebskern"
            - option "Wrackfracht 1 · Maschinenantriebskern"
            - option "Wrackfracht 1 · Maschinensteuerung"
            - option "Wrackfracht 1 · Maschinensteuerung"
            - option "Wrackfracht 1 · Maschinensteuerung"
            - option "Wrackfracht 1 · Maschinensteuerung"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Zuschnitt-Werkzeugkopf"
            - option "Wrackfracht 1 · Brecherbacke"
            - option "Wrackfracht 1 · Montage-Werkzeugsatz"
            - option "Wrackfracht 1 · Kleinschürfer-Werkzeugkopf"
            - option "Wrackfracht 1 · Dedizierter Bandantrieb"
            - option "Wrackfracht 1 · Dedizierter Bandantrieb"
            - option "Wrackfracht 1 · Dedizierter Bandantrieb"
            - option "Wrackfracht 1 · Dedizierter Bandantrieb"
            - option "Wrackfracht 1 · Reservegenerator-/Lagerkern"
            - option "Wrackfracht 1 · Rotor-/Naben-Bausatz"
            - option "Wrackfracht 1 · Geborgenes Cutterchassis"
            - option "Wrackfracht 1 · Geborgenes Brecherchassis"
          - text: Menge in Stück
          - textbox "Transfermenge" [ref=e137]: "1"
          - combobox "Transferziel" [ref=e138]:
            - option "Ziel wählen" [selected]
          - button "Übertragen" [disabled] [ref=e139]
      - status [ref=e140]: Aktion bestätigt
    - region "Maschinen" [ref=e141]:
      - heading "Maschinen" [level=2] [ref=e142]
      - status
    - region "Stromversorgung" [ref=e143]:
      - heading "Stromversorgung" [level=2] [ref=e144]
      - generic [ref=e145]:
        - paragraph [ref=e157]: Aktion zurzeit nicht verfügbar
        - paragraph [ref=e158]: "Erzeugung: 0 W · Zuweisung: 0 W"
        - paragraph [ref=e159]: "Batterie: Keine bestätigte Energiemenge"
        - paragraph [ref=e160]: "Reserve: Keine bestätigte Energiemenge"
        - paragraph [ref=e161]: Stromanschlüsse werden an den Anlagen verbunden.
      - status
    - region "Bau und Technik" [ref=e151]:
      - heading "Bau und Technik" [level=2] [ref=e152]
      - generic [ref=e154]:
        - button "Trockene Werkstatt" [ref=e155]
        - button "Fluidtechnik" [ref=e156]
      - status
```

# Test source

```ts
  1  | import {expect,test,type BrowserContext,type CDPSession,type Page} from "@playwright/test";
  2  | import {mkdir,writeFile} from "node:fs/promises";
  3  | import path from "node:path";
  4  | const run=process.env.FP06_E2E_RUN_DIR;if(!run)throw Error("W09 requires own evidence run");
  5  | const native=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaPrototypePhysics!));
  6  | const ui=(page:Page)=>page.evaluate(()=>JSON.parse(document.body.dataset.hestiaFactoryUi!));
  7  | test.describe.serial("W09 normal finite heavy bootstrap transport",()=>{
  8  |  let context:BrowserContext,page:Page,keyboard:CDPSession;const events:unknown[]=[],errors:string[]=[];let origin:any;
  9  |  test.beforeAll(async({browser},info)=>{context=await browser.newContext({baseURL:info.project.use.baseURL});page=await context.newPage();keyboard=await context.newCDPSession(page);page.on("pageerror",error=>errors.push(error.message));await mkdir(run,{recursive:true});});
  10 |  test.afterAll(async()=>{if(page){await writeFile(path.join(run,"heavy-route-final.json"),JSON.stringify({native:await native(page).catch(()=>null),ui:await ui(page).catch(()=>null),events,errors},null,2)+"\n");}if(context)await context.close();});
  11 |  const press=async(key:string,ms:number)=>{
  12 |   const keyCode=({a:65,d:68,s:83,w:87} as Record<string,number>)[key]!,code="Key"+key.toUpperCase(),up={type:"keyUp" as const,modifiers:0,key,windowsVirtualKeyCode:keyCode,code,location:0};
  13 |   const down=keyboard.send("Input.dispatchKeyEvent",{type:"keyDown",modifiers:0,windowsVirtualKeyCode:keyCode,code,commands:[],key,text:key,unmodifiedText:key,autoRepeat:false,location:0,isKeypad:false});
  14 |   const released=new Promise<void>(resolve=>setTimeout(resolve,ms)).then(()=>keyboard.send("Input.dispatchKeyEvent",up));const failures:unknown[]=[];
  15 |   try{for(const r of await Promise.allSettled([down,released]))if(r.status==="rejected")failures.push(r.reason);}finally{try{await keyboard.send("Input.dispatchKeyEvent",up);}catch(error){failures.push(error);try{await context.close();}catch(error){failures.push(error);}}}
  16 |   if(failures.length===1)throw failures[0];if(failures.length)throw new AggregateError(failures,"Normal key release failed");
  17 |  };
  18 |  const caps={x:300,z:300};
  19 |  const walk=async(axis:"x"|"z",target:number)=>{
  20 |   for(let i=0;i<4;i++){const before=await native(page),v=before.player.position[axis];if(Math.abs(v-target)<=.08)break;const key=axis==="x"?(v>target?"d":"a"):(v>target?"s":"w"),ms=Math.max(25,Math.min(caps[axis],Math.round(Math.abs(v-target)/3*1000)));await press(key,ms);let after=before,stableReads=0;for(let read=0;read<4;read++){await page.waitForTimeout(100);const next=await native(page),stable=next.ticks>after.ticks&&Math.abs(next.player.position.x-after.player.position.x)<1e-6&&Math.abs(next.player.position.z-after.player.position.z)<1e-6;stableReads=stable?stableReads+1:0;after=next;if(stableReads>=2)break;}expect(stableReads,"Released movement must settle in fresh native snapshots before another gesture").toBeGreaterThanOrEqual(2);if((v-target)*(after.player.position[axis]-target)<0)caps[axis]=Math.max(25,Math.round(caps[axis]/2));events.push({axis,target,key,ms,before,after});await writeFile(path.join(run,"heavy-route-taps.json"),JSON.stringify(events,null,2)+"\n");}
  21 |  };
  22 |  test("Ready uses the unchanged real D07 source and one finite initial Cargo",async()=>{await page.goto("/factory.html");await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit",{timeout:20000});origin=await ui(page);expect(origin.inventory.reduce((n:number,c:any)=>n+c.massMg,0)).toBe(2984400000);expect((await native(page)).factoryFacilities.owners).toEqual([]);expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);});
  23 |  test("normal UI opens the finite Cargo without mutating custody",async()=>{await page.getByRole("button",{name:"Fracht öffnen",exact:true}).click();await expect.poll(async()=>(await ui(page)).interaction.cargoOpened).toBe(true);});
  24 |  test("ordinary Play walks to the source-checked heavy pickup stand",async()=>{await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(async()=>(await native(page)).player.status).toBe("Walking");await walk("x",-5.75);const n=await native(page);expect(n.player.position.x).toBeLessThan(-5.563);expect(n.player.position.x).toBeGreaterThan(-6.5);expect(n.player.grounded).toBe(true);});
  25 |  test("normal UI takes the complete finite341kg Former BOM at the actual supported stand",async()=>{await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();await page.getByRole("button",{name:"Aufnehmen: B07-BOM",exact:true}).click();await expect.poll(async()=>(await ui(page)).interaction.handling?.phase).toBe("Carrying");const state=await ui(page),n=await native(page);expect(state.interaction.handling.massMg).toBe(341000000);expect(n.factoryFacilities.carrier.nativeMassKg).toBeCloseTo(341,5);expect(n.factoryFacilities.carrier.colliderHandles).toHaveLength(5);expect(state.inventory.reduce((n:number,c:any)=>n+c.massMg,0)).toBe(2984400000);expect(state.inventory.find((c:any)=>c.role==="cargo").contents.some((s:any)=>s.itemId==="fp02.chassis.former")).toBe(false);});
  26 |  test("normal Play walks the same paired owner toward the natural west route",async()=>{await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(async()=>(await native(page)).player.status).toBe("Walking");await walk("x",-8.25);});
> 27 |  test("released normal corrections reach the natural west corridor with the actual341kg carrier",async()=>{await walk("x",-8.25);const n=await native(page);expect(n.player.position.x).toBeGreaterThan(-8.4);expect(n.player.position.x).toBeLessThan(-8.1);expect(n.factoryFacilities.carrier.phase).toBe("Carrying");});
     |                                                                                                                                                                                                                                           ^ Error: expect(received).toBeLessThan(expected)
  28 |  for(let step=0;step<6;step++)test(`normal paired walk south on the original terrain phase${step+1}`,async()=>{await walk("z",-1.5);});
  29 |  test("actual paired walk reaches the Former service approach without changing source terrain or payload",async()=>{await walk("z",-1.5);const n=await native(page);expect(Math.abs(n.player.position.z+1.5)).toBeLessThan(.15);expect(n.player.grounded).toBe(true);expect(n.factoryFacilities.carrier.nativeMassKg).toBeCloseTo(341,5);expect((await ui(page)).binding.terrainRevision).toBe(origin.binding.terrainRevision);});
  30 |  test("normal released corrections approach the closed local Former depot",async()=>{await walk("x",-6.25);});
  31 |  test("normal paired walk reaches the real supported local depot approach",async()=>{await walk("x",-6.25);const n=await native(page);expect(Math.abs(n.player.position.x+6.25)).toBeLessThan(.15);expect(Math.abs(n.player.position.z+1.5)).toBeLessThan(.15);});
  32 |  test("normal UI deposits the same paid body and all341kg locally without duplicating Cargo",async()=>{await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();await page.getByRole("button",{name:"Hier ablegen",exact:true}).click();await expect.poll(async()=>(await ui(page)).interaction.handling?.phase).toBe("Deposited");const n=await native(page),v=await ui(page);expect(n.factoryFacilities.carrier.nativeMassKg).toBeCloseTo(341,5);expect(v.inventory.reduce((n:number,c:any)=>n+c.massMg,0)).toBe(2984400000);expect(n.factoryFacilities.owners).toHaveLength(0);expect(errors).toEqual([]);await page.screenshot({path:path.join(run,"heavy-local-depot.png")});});
  33 | });
  34 | 
```