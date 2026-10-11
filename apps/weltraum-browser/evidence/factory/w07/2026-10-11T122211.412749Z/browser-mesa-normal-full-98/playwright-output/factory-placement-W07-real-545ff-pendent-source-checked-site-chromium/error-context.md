# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: factory-placement.spec.ts >> W07 real player construction in one confirmed Factory session >> normal second-Cutter ghost moves seven quarter-grid steps toward the independent source-checked site
- Location: tests/e2e/factory-placement.spec.ts:126:3

# Error details

```
TypeError: Cannot read properties of null (reading 'request')
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
    - status [ref=e9]: "Physics: Paused · 6 bodies / 114 colliders · g=11.79 m/s² · Fallhöhe y=0.62 m · Player: Inspection (Boden)"
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
    - paragraph [ref=e47]: Wähle eine Bauvorschau. Die Werkstatt pausiert; Pfeile verschieben um 25 cm, R dreht, Escape verwirft. Wrackfracht öffnen, anschließend mit Spielen und WASD zum Bauplatz gehen. Bauteile bleiben bis zur Bestätigung in der endlichen Wrackfracht. Gemeinsames Speichern folgt.
    - button "Werkstatt pausieren" [disabled] [ref=e48]
    - button "Werkstatt fortsetzen" [ref=e49]
    - button "Wrackfracht öffnen" [ref=e50]
    - button "Zuschnitt vorschauen" [active] [ref=e51]
    - button "Batterie vorschauen" [ref=e52]
    - button "Verteiler vorschauen" [ref=e53]
    - button "Bauvorschau drehen" [ref=e54]
    - button "Bauvorschau verwerfen" [ref=e55]
    - button "Bau bestätigen" [ref=e56]
    - status [ref=e57]: Bau nicht möglich · FACILITY_OVERLAP
```

# Test source

```ts
  30  |     await expect.poll(async()=>(await readBuild(page)).ghost).toBeNull();
  31  |   });
  32  |   test("normal Cargo Open is idempotent in this same actual native session",async()=>{
  33  |     await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect.poll(async()=>(await readBuild(page)).cargo.opened).toBe(true);
  34  |     const first=await readNative(page);await page.getByRole("button",{name:"Wrackfracht öffnen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Wrackfracht geöffnet");expect((await readNative(page)).factoryFacilities.revision).toBe(first.factoryFacilities.revision);
  35  |   });
  36  |   const nativeWalkTaps:unknown[]=[];
  37  |   const walkPulseCaps={x:125,z:125};
  38  |   // Read-only source preflight bb709f… proves these complete flat hull windows;
  39  |   // actual native ground, Cargo LOS/reach and normal previews remain required.
  40  |   const sourceStandDepth=(x:number):readonly[number,number]=>x<=-6.35?[8.75,9.15]:x<=-6.225?[8.725,9.075]:[8.7,9];
  41  |   const tapToward=async(axis:"x"|"z",target:number,negativeKey:string,positiveKey:string)=>{
  42  |     for(let tap=0;tap<4;tap++){
  43  |       const before=await readNative(page),value=before.player.position[axis];
  44  |       const window=axis==="x"?[-6.4,-6.1] as const:sourceStandDepth(before.player.position.x);
  45  |       if(value>=window[0]&&value<=window[1])break;
  46  |       target=(window[0]+window[1])/2;
  47  |       const key=value>target?negativeKey:positiveKey;
  48  |       const capBeforeMs=walkPulseCaps[axis];
  49  |       const holdMs=Math.max(25,Math.min(capBeforeMs,Math.round(Math.abs(value-target)/3*1000)));
  50  |       const keyCode=({a:65,d:68,s:83,w:87} as Record<string,number>)[key];if(keyCode===undefined)throw new Error("Unsupported walking key");
  51  |       const code="Key"+key.toUpperCase();
  52  |       const upEvent={type:"keyUp" as const,modifiers:0,key,windowsVirtualKeyCode:keyCode,code,location:0};
  53  |       // Source-bound Chromium RawKeyboard payload, same Page target and trace.
  54  |       // Driver times measure this test runner, never DOM/native event time.
  55  |       const driverTimes:Record<string,number>={downIssuedMs:performance.now()};
  56  |       const down=keyboard.send("Input.dispatchKeyEvent",{type:"keyDown",modifiers:0,windowsVirtualKeyCode:keyCode,code,commands:[],key,text:key,unmodifiedText:key,autoRepeat:false,location:0,isKeypad:false}).then(()=>{driverTimes.downAckMs=performance.now();});
  57  |       const up=new Promise<void>(resolve=>setTimeout(resolve,holdMs)).then(async()=>{
  58  |         driverTimes.upIssuedMs=performance.now();await keyboard.send("Input.dispatchKeyEvent",upEvent);driverTimes.upAckMs=performance.now();
  59  |       });
  60  |       const failures:unknown[]=[];
  61  |       try{for(const result of await Promise.allSettled([down,up]))if(result.status==="rejected")failures.push(result.reason);}
  62  |       finally{
  63  |         // Fresh release after both requests settles any protocol-hook reordering.
  64  |         try{driverTimes.finalUpIssuedMs=performance.now();await keyboard.send("Input.dispatchKeyEvent",upEvent);driverTimes.finalUpAckMs=performance.now();}
  65  |         catch(releaseError){
  66  |           failures.push(releaseError);
  67  |           try{await context.close();}catch(closeError){failures.push(closeError);}
  68  |         }
  69  |       }
  70  |       if(failures.length===1)throw failures[0];
  71  |       if(failures.length>1)throw new AggregateError(failures,"Trusted keyboard gesture or final release failed");
  72  |       let after=await readNative(page);const releasedReads=[after];
  73  |       // Every key is already released. Observe bounded real tick/pose readbacks;
  74  |       // delayed neutral delivery must settle before the next corrective press.
  75  |       for(let read=0;read<3;read++){
  76  |         const next=await readNative(page);releasedReads.push(next);
  77  |         const stable=next.ticks>after.ticks&&Math.abs(next.player.position.x-after.player.position.x)<0.000001
  78  |           &&Math.abs(next.player.position.z-after.player.position.z)<0.000001;
  79  |         after=next;if(stable)break;
  80  |       }
  81  |       const overshotTarget=(value-target)*(after.player.position[axis]-target)<0;
  82  |       if(overshotTarget)walkPulseCaps[axis]=Math.max(25,Math.round(capBeforeMs/2));
  83  |       nativeWalkTaps.push({axis,target,sourceStandWindow:window,key,holdMs,capBeforeMs,capAfterMs:walkPulseCaps[axis],overshotTarget,driverTimes,beforePlayer:before.player,afterPlayer:after.player,beforeTicks:before.ticks,afterTicks:after.ticks,releasedReads});
  84  |       await writeFile(path.join(runDirectory(),"browser-native-walk-taps.json"),JSON.stringify(nativeWalkTaps,null,2)+"\n");
  85  |     }
  86  |   };
  87  |   test("normal Play acquires the same actual native Walking session",async()=>{
  88  |     await page.getByRole("button",{name:"Spielen · WASD / Maus / Space",exact:true}).click();await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("debug-scene");await expect.poll(async()=>(await readNative(page)).player.status).toBe("Walking");
  89  |   });
  90  |   test("at most four actual released D/A taps approach the source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");});
  91  |   test("at most four more released D/A taps confirm the actual source-checked west stand",async()=>{await tapToward("x",-6.25,"d","a");const native=await readNative(page);expect(native.player.position.x).toBeGreaterThanOrEqual(-6.4);expect(native.player.position.x).toBeLessThanOrEqual(-6.1);expect(native.player.grounded).toBe(true);});
  92  |   test("at most four actual released S/W taps approach the source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  93  |   test("at most four further released S/W taps continue the same native walk",async()=>{await tapToward("z",8.875,"s","w");});
  94  |   test("at most four further released S/W taps approach the actual Cutter stand",async()=>{await tapToward("z",8.875,"s","w");});
  95  |   test("at most four final released S/W taps confirm the actual source-checked Cutter stand",async()=>{await tapToward("z",8.875,"s","w");const native=await readNative(page),p=native.player.position,window=sourceStandDepth(p.x);expect(p.x).toBeGreaterThanOrEqual(-6.4);expect(p.x).toBeLessThanOrEqual(-6.1);expect(p.z).toBeGreaterThanOrEqual(window[0]);expect(p.z).toBeLessThanOrEqual(window[1]);expect(p.y).toBeGreaterThanOrEqual(2.38);expect(p.y).toBeLessThanOrEqual(2.44);expect(native.player.grounded).toBe(true);expect(native.factoryFacilities.cargo.accessible).toBe(true);
  96  |     const cargo=native.factoryFacilities.cargo.site.accessPointMm;expect(Math.hypot(p.x-cargo[0]/1000,p.y-cargo[1]/1000,p.z-cargo[2]/1000)).toBeLessThanOrEqual(4);
  97  |     expect(Math.hypot(-5.25-p.x,p.z-6.5)).toBeLessThanOrEqual(3);expect(Math.hypot(p.x+7.75,p.z-6.5)).toBeLessThanOrEqual(3);
  98  |   });
  99  |   test("Escape pauses the same walked session and native readback proves material and Cargo unchanged",async()=>{
  100 |     await page.keyboard.press("Escape");await expect.poll(async()=>(await readNative(page)).status).toBe("Paused");await page.getByRole("button",{name:"Zur Inspektionsansicht",exact:true}).click();
  101 |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeCargo.containers);expect(after.massMg).toBe(beforeCargo.massMg);expect(after.cargo.positionMm).toEqual(beforeCargo.cargo.positionMm);expect(nativeAfter.ticks).toBeGreaterThan(nativeBeforeCargo.ticks);expect(nativeAfter.player.position.z).toBeLessThan(9.2);expect(nativeAfter.player.position.x).toBeLessThanOrEqual(-6.1);expect(nativeAfter.player.grounded).toBe(true);expect(nativeAfter.factoryFacilities.cargo.accessible).toBe(true);
  102 |     const directory=runDirectory();await writeFile(path.join(directory,"browser-cargo-open-native-walk.json"),JSON.stringify({before:beforeCargo,after,nativeBefore:nativeBeforeCargo,nativeAfter,nativeWalkTaps},null,2)+"\n");
  103 |   });
  104 |   test("T030 real move, quarter-turn and Escape retire the ghost with no native or material mutation",async()=>{
  105 |     const before=await readBuild(page);
  106 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  107 |     const ghost=await readBuild(page);expect(ghost.ghost.request.quarterTurns).toBe(1);
  108 |     await page.keyboard.press("ArrowRight");await expect.poll(async()=> (await readBuild(page)).ghost.request.centerMm[0]).toBe(-6000);
  109 |     await page.keyboard.press("r");await expect.poll(async()=> (await readBuild(page)).ghost.request.quarterTurns).toBe(2);
  110 |     await page.keyboard.press("Escape");await expect.poll(async()=> (await readBuild(page)).ghost).toBeNull();
  111 |     const after=await readBuild(page);expect(after.containers).toEqual(before.containers);expect(after.massMg).toBe(before.massMg);expect(after.installations).toEqual([]);expect(after.reservations).toBe(0);
  112 |     const directory=runDirectory();await mkdir(directory,{recursive:true});await writeFile(path.join(directory,"browser-ghost-cancel.json"),JSON.stringify({before,after},null,2)+"\n");
  113 |   });
  114 |   test("T029 a real confirmed build publishes exactly one paid208kg Cutter",async({},info)=>{
  115 |     const nativeBefore=await readNative(page),before=await readBuild(page);
  116 |     expect(before.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo").contents.filter((s:any)=>s.resourceId==="fp02_chassis_cutter").reduce((n:number,s:any)=>n+s.quantity,0)).toBe(1);
  117 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("Bau bereit");
  118 |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect.poll(async()=> (await readBuild(page)).installations.length).toBe(1);
  119 |     await expect.poll(async()=> (await readBuild(page)).state).toBe("Ready");
  120 |     const state=await readBuild(page);expect(state.massMg).toBe(2_984_400_000);expect(state.installations[0].massMg).toBe(208_000_000);expect(state.reservations).toBe(0);
  121 |     const cargo=state.containers.find((c:any)=>c.containerId==="fp02_wreck_cargo");expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_profile").quantity).toBe(68_000_000);expect(cargo.contents.find((s:any)=>s.resourceId==="fp02_bulk_steel_sheet").quantity).toBe(50_000_000);expect(cargo.contents.some((s:any)=>s.resourceId==="fp02_chassis_cutter")).toBe(false);
  122 |     const installed=state.containers.find((c:any)=>c.containerId===state.installations[0].materialContainerId);expect(installed.massKg).toBe(208);expect(installed.contents.find((s:any)=>s.resourceId==="fp02_chassis_cutter").extensions["factory.source"].cargoId).toBe("C26");
  123 |     const nativeAfter=await readNative(page);expect(nativeAfter.factoryFacilities.owners).toHaveLength(1);expect(nativeAfter.factoryFacilities.owners[0].instanceId).toBe(state.installations[0].instanceId);expect(nativeAfter.bodyCount).toBe(nativeBefore.bodyCount+1);expect(nativeAfter.factoryFacilities.owners[0].colliderHandles.length).toBeGreaterThan(0);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBefore.factoryFacilities.cargo.bodyHandle);
  124 |     const directory=runDirectory(),capture=await page.screenshot();await info.attach("paid-native-cutter",{body:capture,contentType:"image/png"});await writeFile(path.join(directory,"paid-native-cutter.png"),capture);await writeFile(path.join(directory,"browser-paid-cutter.json"),JSON.stringify({before,state,nativeBefore,nativeAfter,errors},null,2)+"\n");expect(errors).toEqual([]);
  125 |   });
  126 |   test("normal second-Cutter ghost moves seven quarter-grid steps toward the independent source-checked site",async()=>{
  127 |     beforeSecond=await readBuild(page);nativeBeforeSecond=await readNative(page);
  128 |     await page.getByRole("button",{name:"Zuschnitt vorschauen",exact:true}).click();
  129 |     for(let step=0;step<7;step++)await page.keyboard.press("ArrowLeft");
> 130 |     await expect.poll(async()=>(await readBuild(page)).ghost.request.centerMm[0]).toBe(-8000);
      |                                                              ^ TypeError: Cannot read properties of null (reading 'request')
  131 |   });
  132 |   test("seven more actual ghost moves reach the disjoint supported site and specifically prove BOM_MISSING",async()=>{
  133 |     for(let step=0;step<7;step++)await page.keyboard.press("ArrowLeft");
  134 |     const state=await readBuild(page);expect(state.ghost.request.centerMm).toEqual([-9750,1500,5000]);expect(state.ghost.request.quarterTurns).toBe(1);
  135 |     await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  136 |   });
  137 |   test("finite C26 failed confirmation preserves the complete first installation and all actual native members",async()=>{
  138 |     await page.getByRole("button",{name:"Bau bestätigen",exact:true}).click();await expect(page.locator("#factory-build-status")).toContainText("BOM_MISSING");
  139 |     const after=await readBuild(page),nativeAfter=await readNative(page);expect(after.containers).toEqual(beforeSecond.containers);expect(after.installations).toEqual(beforeSecond.installations);expect(after.massMg).toBe(beforeSecond.massMg);expect(after.reservations).toBe(0);
  140 |     expect(nativeAfter.factoryFacilities.owners).toEqual(nativeBeforeSecond.factoryFacilities.owners);expect(nativeAfter.bodyCount).toBe(nativeBeforeSecond.bodyCount);expect(nativeAfter.colliderCount).toBe(nativeBeforeSecond.colliderCount);expect(nativeAfter.factoryFacilities.cargo.bodyHandle).toBe(nativeBeforeSecond.factoryFacilities.cargo.bodyHandle);
  141 |     await page.keyboard.press("Escape");
  142 |     await writeFile(path.join(runDirectory(),"browser-second-cutter-depletion.json"),JSON.stringify({before:beforeSecond,after,nativeBefore:nativeBeforeSecond,nativeAfter},null,2)+"\n");
  143 |   });
  144 |   test("Legacy persistence stays closed and actual disposal retires paid Facility projection and native World",async()=>{
  145 |     await page.locator("#hvp-save").click();await expect(page.locator("#hvp-save-status")).toContainText("Rejected");await expect(page.locator("#hvp-save-status")).toContainText("Factory");
  146 |     page.once("dialog",dialog=>{void dialog.accept();});await page.getByRole("button",{name:"Sitzung beenden",exact:true}).click();await expect(page.locator("#hvp-ended")).toContainText("Hestia-Sitzung beendet");await expect(page.locator("#factory-panel")).toHaveCount(0);await expect.poll(()=>page.workers().length).toBe(0);
  147 |     expect(await page.evaluate(()=>document.body.dataset.hestiaFactoryConstruction)).toBeUndefined();expect(errors).toEqual([]);
  148 |     const directory=runDirectory();await writeFile(path.join(directory,"browser-native-disposal.json"),await page.evaluate(()=>document.body.dataset.hestiaPrototypeDisposal!)+"\n");
  149 |   });
  150 | });
  151 | 
```