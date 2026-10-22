async(page)=>{
 const h=page.context().browser(),s=h.__fp06Acceptance,p=s.p;
 s.networkFailures=[];p.on("requestfailed",r=>s.networkFailures.push({url:r.url(),error:r.failure()?.errorText}));
 h.__fp06ReadSlotProof=async target=>target.evaluate(async()=>{
 const dbs=await indexedDB.databases();if(!dbs.some(d=>d.name==="weltraum-hestia-factory-v1"))throw Error("Expected existing Factory database");
 const row=await new Promise((res,rej)=>{const q=indexedDB.open("weltraum-hestia-factory-v1");q.onerror=()=>rej(q.error);q.onupgradeneeded=()=>{q.transaction.abort();rej(Error("Unexpected database creation"));};q.onsuccess=()=>{const db=q.result,t=db.transaction("saveSlots","readonly"),r=t.objectStore("saveSlots").get("factory-primary");r.onerror=()=>rej(r.error);r.onsuccess=()=>res(r.result);t.oncomplete=()=>db.close();};});
 if(!row||!(row.payloadBytes instanceof Uint8Array))throw Error("Expected existing combined Save");
 const hash=await crypto.subtle.digest("SHA-256",row.payloadBytes);
 return {metadata:row.metadata,payloadSha256:[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,"0")).join("")};
 });
 await p.goto("http://127.0.0.1:5197/factory.html");
 await p.waitForFunction(()=>{const d=document.body.dataset,n=JSON.parse(d.hestiaPrototypePhysics||"null"),u=JSON.parse(d.hestiaFactoryUi||"null");return n?.status==="Paused"&&n.ticks===0&&u?.host?.confirmed&&u?.host?.persistence?.continueAvailable;},null,{timeout:20000});
 const before=await h.__fp06ReadSlotProof(p);
 if(before.metadata.recordRevision!==25||before.metadata.payloadBytes!==15121771||before.metadata.contentHash!=="sha256:15cd3e9d4b878b444ec9be84483183e8516bddfa2744a1884fc0baf9ced3ba82")throw Error("Primary slot differs from preserved Save25");
 const dialogs=[];
 p.once("dialog",async d=>{dialogs.push({type:d.type(),message:d.message()});if(d.type()==="confirm"&&d.message()==="Continue from the saved Factory checkpoint? Unsaved changes will be discarded.")await d.accept();else await d.dismiss();});
 await p.getByRole("button",{name:"Continue",exact:true}).click();
 const ready=()=>{const d=document.body.dataset,n=JSON.parse(d.hestiaPrototypePhysics||"null"),u=JSON.parse(d.hestiaFactoryUi||"null");return n?.status==="Paused"&&n.ticks===227986&&n?.factoryFacilities?.owners?.length===11&&u?.factorySteps===37997&&u?.host?.confirmed;};
 await p.waitForFunction(ready,null,{timeout:30000});
 const continued={state:await s.record("actual-continue"),dialogs,slotUnchanged:JSON.stringify(before)===JSON.stringify(await h.__fp06ReadSlotProof(p)),slotProof:before,url:p.url()};
 if(!continued.slotUnchanged)throw Error("Save25 changed during Continue");
 h.__fp06Save25Proof=before;
 await p.goto("http://127.0.0.1:5197/factory.html?factoryLoad=primary&hvpMeasure=1");
 await p.waitForFunction(ready,null,{timeout:30000});
 s.continued=continued;await p.evaluate(()=>window.__fp06PerfObserver.disconnect());
 return {state:await s.read(),continued};
}
