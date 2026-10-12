# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-dry-flow.spec.ts >> W09 normal finite heavy bootstrap transport >> normal UI takes the complete finite341kg Former BOM at the actual supported stand
- Location: tests/e2e/factory-dry-flow.spec.ts:25:2

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "Carrying"
Received: undefined

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic "HVP-02 readable coast viewport" [ref=e3]
  - region "Hestia coast and vegetation controls" [ref=e4]:
    - strong [ref=e5]: HVP-13 HESTIA COAST
    - status [ref=e6]: "State: Ready"
    - generic [ref=e7]: "Camera: C04-WIDE (Orbit)"
    - generic [ref=e8]: "Terrain faces: 46328 · vertices: 185312 · triangles: 92656 · scene: 170149 voxel quads / 341190 total tris (coast+flora+sky)"
    - status [ref=e9]: "Physics: Paused · 5 bodies / 81 colliders · g=11.79 m/s² · Fallhöhe y=0.62 m · Player: Inspection (Boden)"
    - status [ref=e10]: "Plasmacutter: Zelle · Idle · Kein Ziel innerhalb 4 m · 1/2/3, Linksklick · Terrain: SafeQuarry / Holz: Ast · F: Schieben (4 m / 15 N·s) · L-Körper bereit · Ast: Idle · Taste 2 + Linksklick · Fragment: Idle · 1 Zelle / 2 Box / 3 Kugel erneut schneiden"
    - status [ref=e11]: "Spielstand: Idle · Lokaler Hestia-Spielstand"
    - status [ref=e12]: "Ostregion: NotRequested · LOD 0.5 m · Kollision fehlt · Ruhende Fragmente: 0"
    - generic [ref=e13]:
      - button "Sitzung beenden" [ref=e14]
      - button "Spielen · WASD / Maus / Space" [ref=e15]
      - 'button "Perspektive: Ego (V)" [ref=e16]'
      - button "C01-EYE" [ref=e17]
      - button "C02-SHORE" [ref=e18]
      - button "C03-ROOTS" [ref=e19]
      - button "C04-WIDE" [ref=e20]
      - button "C05-Felsarm" [ref=e21]
      - button "Felsarm-Stütze prüfen (ohne Schnitt)" [ref=e22]
      - button "Stütze anvisieren (2 + Klick)" [ref=e23]
      - 'button "Neustart: Felsarm" [ref=e24]'
      - button "Neuer Bergungsauftrag" [ref=e25]
      - 'button "Neustart: Ostpfad" [ref=e26]'
      - button "Ostregion erneut versuchen" [ref=e27]
      - 'button "Ansicht: Schnittstelle" [ref=e28]'
      - button "L-Körper anvisieren (F)" [ref=e29]
      - button "Ast anvisieren (2 + Klick)" [ref=e30]
      - 'button "1: Zelle" [ref=e31]'
      - 'button "2: Box" [ref=e32]'
      - 'button "3: Kugel" [ref=e33]'
      - button "Spielstand speichern" [ref=e34]
      - button "Spielstand laden" [ref=e35]
      - button "Gespeicherte Sitzung neu öffnen" [ref=e36]
      - button "Reset view" [ref=e37]
      - 'button "Water: on" [ref=e38]'
      - 'button "Inspect: off" [ref=e39]'
      - button "Inspect-only ambient occlusion toggle" [pressed] [ref=e40]: "AO: on"
      - button "Physik fortsetzen" [ref=e41]
      - button "Fallkörper neu starten" [ref=e42]
      - button "Hide UI" [ref=e43]
  - region "Werkstatt" [ref=e44]:
    - strong [ref=e45]: Hestia · Werkstatt
    - status [ref=e46]: Werkstatt bereit · Pausiert
    - paragraph [ref=e47]: Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Schwere Chassis zuerst transportieren, bevor Anlagen den Weg belegen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht oder dem erreichbaren Transportdepot. Gemeinsames Speichern folgt.
    - button "Werkstatt pausieren" [disabled] [ref=e48]
    - button "Werkstatt fortsetzen" [ref=e49]
    - button "Wrackfracht öffnen" [ref=e50]
    - button "Zuschnitt vorschauen" [ref=e51]
    - button "Umformung vorschauen" [ref=e52]
    - button "Rohlager vorschauen" [ref=e53]
    - button "Produktlager vorschauen" [ref=e54]
    - button "Werkbank vorschauen" [ref=e55]
    - button "Neue Stütze platzieren" [ref=e56]
    - button "Batterie vorschauen" [ref=e57]
    - button "Verteiler vorschauen" [ref=e58]
    - button "Bauvorschau drehen" [ref=e59]
    - button "Bauvorschau verwerfen" [ref=e60]
    - button "Bau bestätigen" [ref=e61]
    - status [ref=e62]: 0 installierte Objekte · 2984.4 kg Gesamtmaterial
    - region "Fracht und Lager" [ref=e63]:
      - heading "Fracht und Lager" [level=2] [ref=e64]
      - generic [ref=e65]:
        - generic [ref=e67]:
          - heading "Wrackfracht 1" [level=3] [ref=e68]
          - paragraph [ref=e69]: 2984,4 kg / 4000 kg · Erreichbar
          - generic [ref=e70]:
            - paragraph [ref=e71]: "Falt-Windanlage 6 kW: 1 Stück · 350 kg"
            - paragraph [ref=e72]: "Falt-Windanlage 6 kW: 1 Stück · 350 kg"
            - paragraph [ref=e73]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
            - paragraph [ref=e74]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
            - paragraph [ref=e75]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
            - paragraph [ref=e76]: "PV-Faltarray 2 kWp: 1 Stück · 80 kg"
            - paragraph [ref=e77]: "Expeditionsakku 4 kWh: 1 Stück · 50 kg"
            - paragraph [ref=e78]: "40-kW-Verteiler: 1 Stück · 25 kg"
            - paragraph [ref=e79]: "Feldwerkbank: 1 Stück · 40 kg"
            - paragraph [ref=e80]: "Thermogeneratorkern: 1 Stück · 150 kg"
            - paragraph [ref=e81]: "Feldkabel: 40 m · 10 kg"
            - paragraph [ref=e82]: "Materialcontainer: 1 Stück · 60 kg"
            - paragraph [ref=e83]: "Materialcontainer: 1 Stück · 60 kg"
            - paragraph [ref=e84]: "Materialcontainer: 1 Stück · 60 kg"
            - paragraph [ref=e85]: "Fundamentschuh: 1 Stück · 12 kg"
            - paragraph [ref=e86]: "Fundamentschuh: 1 Stück · 12 kg"
            - paragraph [ref=e87]: "Fundamentschuh: 1 Stück · 12 kg"
            - paragraph [ref=e88]: "Fundamentschuh: 1 Stück · 12 kg"
            - paragraph [ref=e89]: "Fundamentschuh: 1 Stück · 12 kg"
            - paragraph [ref=e90]: "Fundamentschuh: 1 Stück · 12 kg"
            - paragraph [ref=e91]: "Geprüfter Schiffsstahl: 96 kg"
            - paragraph [ref=e92]: "Stahlprofile: 80 kg"
            - paragraph [ref=e93]: "Stahlblech: 60 kg"
            - paragraph [ref=e94]: "Rückgewinnungs-Elastomer: 16 kg"
            - paragraph [ref=e95]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e96]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e97]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e98]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e99]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e100]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e101]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e102]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e103]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e104]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e105]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e106]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e107]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e108]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e109]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e110]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e111]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e112]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e113]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e114]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e115]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e116]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e117]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e118]: "Passives 1-m-Bandmodul: 1 Stück · 5 kg"
            - paragraph [ref=e119]: "Maschinenantriebskern: 1 Stück · 2 kg"
            - paragraph [ref=e120]: "Maschinenantriebskern: 1 Stück · 2 kg"
            - paragraph [ref=e121]: "Maschinenantriebskern: 1 Stück · 2 kg"
            - paragraph [ref=e122]: "Maschinenantriebskern: 1 Stück · 2 kg"
            - paragraph [ref=e123]: "Maschinensteuerung: 1 Stück · 0,2 kg"
            - paragraph [ref=e124]: "Maschinensteuerung: 1 Stück · 0,2 kg"
            - paragraph [ref=e125]: "Maschinensteuerung: 1 Stück · 0,2 kg"
            - paragraph [ref=e126]: "Maschinensteuerung: 1 Stück · 0,2 kg"
            - paragraph [ref=e127]: "Maschinensteuerung: 1 Stück · 0,2 kg"
            - paragraph [ref=e128]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e129]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e130]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e131]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e132]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e133]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e134]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e135]: "Leitersatz: 1 Stück · 0,8 kg"
            - paragraph [ref=e136]: "Zuschnitt-Werkzeugkopf: 1 Stück · 3 kg"
            - paragraph [ref=e137]: "Umformwerkzeuge: 1 Stück · 4 kg"
            - paragraph [ref=e138]: "Brecherbacke: 1 Stück · 6 kg"
            - paragraph [ref=e139]: "Montage-Werkzeugsatz: 1 Stück · 3 kg"
            - paragraph [ref=e140]: "Kleinschürfer-Werkzeugkopf: 1 Stück · 5 kg"
            - paragraph [ref=e141]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
            - paragraph [ref=e142]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
            - paragraph [ref=e143]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
            - paragraph [ref=e144]: "Dedizierter Bandantrieb: 1 Stück · 6 kg"
            - paragraph [ref=e145]: "Reservegenerator-/Lagerkern: 1 Stück · 35 kg"
            - paragraph [ref=e146]: "Rotor-/Naben-Bausatz: 1 Stück · 40 kg"
            - paragraph [ref=e147]: "Geborgenes Cutterchassis: 1 Stück · 180 kg"
            - paragraph [ref=e148]: "Geborgenes Formerchassis: 1 Stück · 300 kg"
            - paragraph [ref=e149]: "Geborgenes Brecherchassis: 1 Stück · 450 kg"
          - 'button "Aufnehmen: C26-PACK" [ref=e150]'
          - 'button "Aufnehmen: C27-PACK" [ref=e151]'
          - 'button "Aufnehmen: B06-BOM" [ref=e152]'
          - 'button "Aufnehmen: B07-BOM" [ref=e153]'
          - 'button "Aufnehmen: BATTERY-PACK" [ref=e154]'
          - 'button "Aufnehmen: DISTRIBUTOR-PACK" [ref=e155]'
          - 'button "Aufnehmen: BENCH-PACK" [ref=e156]'
          - 'button "Aufnehmen: BIN-PACK" [ref=e157]'
          - 'button "Aufnehmen: BELT4" [ref=e158]'
          - 'button "Aufnehmen: CABLE40" [ref=e159]'
          - 'button "Aufnehmen: RAW8" [ref=e160]'
          - 'button "Aufnehmen: MONTAGE" [ref=e161]'
        - generic [ref=e162]:
          - button "Fracht öffnen" [ref=e163]
          - paragraph
        - generic [ref=e164]:
          - heading "Lokal übertragen" [level=3] [ref=e165]
          - combobox "Transferquelle" [ref=e166]:
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
            - option "Wrackfracht 1 · Maschinenantriebskern"
            - option "Wrackfracht 1 · Maschinensteuerung"
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
            - option "Wrackfracht 1 · Leitersatz"
            - option "Wrackfracht 1 · Zuschnitt-Werkzeugkopf"
            - option "Wrackfracht 1 · Umformwerkzeuge"
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
            - option "Wrackfracht 1 · Geborgenes Formerchassis"
            - option "Wrackfracht 1 · Geborgenes Brecherchassis"
          - text: Menge in Stück
          - textbox "Transfermenge" [ref=e167]: "1"
          - combobox "Transferziel" [ref=e168]:
            - option "Ziel wählen" [selected]
          - button "Übertragen" [disabled] [ref=e169]
      - status [ref=e170]: Aktion abgewiesen. Aktion zurzeit nicht verfügbar
    - region "Maschinen" [ref=e171]:
      - heading "Maschinen" [level=2] [ref=e172]
      - status
    - region "Stromversorgung" [ref=e173]:
      - heading "Stromversorgung" [level=2] [ref=e174]
      - generic [ref=e175]:
        - paragraph [ref=e176]: Aktion zurzeit nicht verfügbar
        - paragraph [ref=e177]: "Erzeugung: 0 W · Zuweisung: 0 W"
        - paragraph [ref=e178]: "Batterie: Keine bestätigte Energiemenge"
        - paragraph [ref=e179]: "Reserve: Keine bestätigte Energiemenge"
        - paragraph [ref=e180]: Stromanschlüsse werden an den Anlagen verbunden.
      - status
    - region "Bau und Technik" [ref=e181]:
      - heading "Bau und Technik" [level=2] [ref=e182]
      - generic [ref=e184]:
        - button "Trockene Werkstatt" [ref=e185]
        - button "Fluidtechnik" [ref=e186]
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
  20 |   for(let i=0;i<4;i++){const before=await native(page),v=before.player.position[axis];if(Math.abs(v-target)<=.08)break;const key=axis==="x"?(v>target?"d":"a"):(v>target?"s":"w"),ms=Math.max(25,Math.min(caps[axis],Math.round(Math.abs(v-target)/3*1000)));await press(key,ms);let after=await native(page);for(let read=0;read<3;read++){const next=await native(page),stable=next.ticks>after.ticks&&Math.abs(next.player.position[axis]-after.player.position[axis])<1e-6;after=next;if(stable)break;}if((v-target)*(after.player.position[axis]-target)<0)caps[axis]=Math.max(25,Math.round(caps[axis]/2));events.push({axis,target,key,ms,before,after});await writeFile(path.join(run,"heavy-route-taps.json"),JSON.stringify(events,null,2)+"\n");}
  21 |  };
  22 |  test("Ready uses the unchanged real D07 source and one finite initial Cargo",async()=>{await page.goto("/factory.html");await expect(page.locator("#factory-status")).toContainText("Werkstatt bereit",{timeout:20000});origin=await ui(page);expect(origin.inventory.reduce((n:number,c:any)=>n+c.massMg,0)).toBe(2984400000);expect((await native(page)).factoryFacilities.owners).toEqual([]);expect(await page.evaluate(()=>"TestBridge" in window)).toBe(false);});
  23 |  test("normal UI opens the finite Cargo without mutating custody",async()=>{await page.getByRole("button",{name:"Fracht öffnen",exact:true}).click();await expect.poll(async()=>(await ui(page)).interaction.cargoOpened).toBe(true);});
  24 |  test("ordinary Play walks to the source-checked heavy pickup stand",async()=>{await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(async()=>(await native(page)).player.status).toBe("Walking");await walk("x",-5.75);const n=await native(page);expect(n.player.position.x).toBeLessThan(-5.563);expect(n.player.position.x).toBeGreaterThan(-6.5);expect(n.player.grounded).toBe(true);});
> 25 |  test("normal UI takes the complete finite341kg Former BOM at the actual supported stand",async()=>{await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();await page.getByRole("button",{name:"Aufnehmen: B07-BOM",exact:true}).click();await expect.poll(async()=>(await ui(page)).interaction.handling?.phase).toBe("Carrying");const state=await ui(page),n=await native(page);expect(state.interaction.handling.massMg).toBe(341000000);expect(n.factoryFacilities.carrier.nativeMassKg).toBeCloseTo(341,5);expect(n.factoryFacilities.carrier.colliderHandles).toHaveLength(5);expect(state.inventory.reduce((n:number,c:any)=>n+c.massMg,0)).toBe(2984400000);expect(state.inventory.find((c:any)=>c.role==="cargo").contents.some((s:any)=>s.itemId==="fp02.chassis.former")).toBe(false);});
     |                                                                                                                                                                                                                                                                                                                                                                                  ^ Error: expect(received).toBe(expected) // Object.is equality
  26 |  test("normal Play walks the same paired owner toward the natural west route",async()=>{await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(async()=>(await native(page)).player.status).toBe("Walking");await walk("x",-8.25);});
  27 |  test("released normal corrections reach the natural west corridor with the actual341kg carrier",async()=>{await walk("x",-8.25);const n=await native(page);expect(n.player.position.x).toBeGreaterThan(-8.4);expect(n.player.position.x).toBeLessThan(-8.1);expect(n.factoryFacilities.carrier.phase).toBe("Carrying");});
  28 |  for(let step=0;step<6;step++)test(`normal paired walk south on the original terrain phase${step+1}`,async()=>{await walk("z",-1.5);});
  29 |  test("actual paired walk reaches the Former service approach without changing source terrain or payload",async()=>{await walk("z",-1.5);const n=await native(page);expect(Math.abs(n.player.position.z+1.5)).toBeLessThan(.15);expect(n.player.grounded).toBe(true);expect(n.factoryFacilities.carrier.nativeMassKg).toBeCloseTo(341,5);expect((await ui(page)).binding.terrainRevision).toBe(origin.binding.terrainRevision);});
  30 |  test("normal released corrections approach the closed local Former depot",async()=>{await walk("x",-6.25);});
  31 |  test("normal paired walk reaches the real supported local depot approach",async()=>{await walk("x",-6.25);const n=await native(page);expect(Math.abs(n.player.position.x+6.25)).toBeLessThan(.15);expect(Math.abs(n.player.position.z+1.5)).toBeLessThan(.15);});
  32 |  test("normal UI deposits the same paid body and all341kg locally without duplicating Cargo",async()=>{await page.keyboard.press("Escape");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();await page.getByRole("button",{name:"Hier ablegen",exact:true}).click();await expect.poll(async()=>(await ui(page)).interaction.handling?.phase).toBe("Deposited");const n=await native(page),v=await ui(page);expect(n.factoryFacilities.carrier.nativeMassKg).toBeCloseTo(341,5);expect(v.inventory.reduce((n:number,c:any)=>n+c.massMg,0)).toBe(2984400000);expect(n.factoryFacilities.owners).toHaveLength(0);expect(errors).toEqual([]);await page.screenshot({path:path.join(run,"heavy-local-depot.png")});});
  33 | });
  34 | 
```