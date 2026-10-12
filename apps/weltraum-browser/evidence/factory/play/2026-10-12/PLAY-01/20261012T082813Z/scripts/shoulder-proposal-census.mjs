import {createHash} from 'node:crypto';
import {writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const app=process.cwd(),out=process.argv[2],sha=b=>createHash('sha256').update(b).digest('hex');
const {createServer}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')));
const server=await createServer({root:app,server:{middlewareMode:true}});
try{
 const f=await server.ssrLoadModule('/src/factory/fixtures/startSite.ts'),c=await server.ssrLoadModule('/src/hvp/hvpCoastSource.ts'),v=await server.ssrLoadModule('/src/hestia-prototype/presentation/vegetation.ts');
 const current=f.materializeFactoryStartSiteV2(),before=current.copySlots(),after=before.slice();
 const masks=[[.75,6,3,3.5],[8,15.5,3,3.5],[2,13,4.5,5]],original=f.FACTORY_START_SITE_V2_ADDITIONS;
 const within=(x,z,ms)=>ms.some(([e0,e1,n0,n1])=>12.5-z>=e0&&12.5-z<e1&&x+12.25>=n0&&x+12.25<n1);
 const rows=masks.map((mask,i)=>({id:'S'+(i+1),before:original[i],proposed:mask,addressedColumns:0,additionalColumns:0,changedColumns:new Set(),added:0,removed:0}));
 for(let z=0;z<256;z++)for(let x=0;x<256;x++){
  const wx=-16+(x+.5)*.125,wz=-16+(z+.5)*.125,m=rows.find(m=>within(wx,wz,[m.proposed]));if(!m)continue;
  m.addressedColumns++;if(!within(wx,wz,original))m.additionalColumns++;
  for(let y=0;y<128;y++)after[x+256*(y+128*z)]=+(y<=75);
 }
 const proposal=c.createHvpFactorySourceSnapshotV2(after),sparse=[],columns=new Set();let added=0,removed=0;
 for(let i=0;i<before.length;i++)if(before[i]!==after[i]){
  const x=i%256,y=Math.floor(i/256)%128,z=Math.floor(i/32768),wx=-16+(x+.5)*.125,wz=-16+(z+.5)*.125,m=rows.find(m=>within(wx,wz,[m.proposed])&&!within(wx,wz,original));
  if(!m||after[i]!==+(y<=75))throw Error('Diff escaped the three additional bands '+i);
  sparse.push([i,before[i],after[i]]);columns.add(x+256*z);m.changedColumns.add(x+256*z);
  if(before[i]===0){added++;m.added++;}else if(after[i]===0){removed++;m.removed++;}else throw Error('Unexpected material remap');
 }
 const readColumn=(x,z)=>within(x,z,masks)||f.inFactoryStartSite(x,z)?Object.freeze({topMeters:1.5,slot:1}):c.readHvpSourceColumnWorld(x,z);
 const profiles=[{version:'hvp-factory-vegetation-v1',readColumn:f.readFactorySourceColumnWorldV2},{version:'hvp-factory-vegetation-v1',readColumn}];
 const plantCensus=profiles.map(profile=>{
  const plan=v.planHvpVegetation(undefined,profile),invalid=plan.filter(p=>!v.isHvpPlantHabitat(p.kind,p.position.x,p.position.z,profile));
  const woodOwners=plan.filter(p=>p.kind==='tree').map(p=>{
   if(invalid.some(i=>i.id===p.id))return {id:p.id,invalid:true};
   const s=v.buildHvpPlant(p,profile);return {id:p.id,position:p.position,digest:s.digest,woodSlotsSha256:sha(s.wood.copySlots()),decorationPhysics:s.decorationPhysics};
  });return {plannedCount:plan.length,invalid,validCount:plan.length-invalid.length,woodOwners};
 });
 const capture=JSON.parse(await readFile(path.join(app,'evidence/factory/play/2026-10-12/PLAY-01/20261012T075906Z/normal-full-flow/15-battery-native-support-blocker.json'),'utf8'));
 const actor=capture.native.factoryFacilities.lastCarrierVeto.targetMm.map(n=>n/1000),center={x:actor[0],z:actor[2]-1};
 const top=(slots,x,z)=>{const ix=Math.floor((x+16)/.125),iz=Math.floor((z+16)/.125);for(let y=127;y>=0;y--)if(slots[ix+256*(y+128*iz)])return -8+(y+1)*.125;return -8;};
 const centerTop=top(before,center.x,center.z),samples=[];
 for(const dx of [-.25,.25])for(const dz of [-.25,.25])for(const sx of [-.06249,-.03125,0,.03125,.06249])for(const sz of [-.06249,-.03125,0,.03125,.06249]){
  const x=center.x+dx+sx,z=center.z+dz+sz,currentTop=top(before,x,z),proposalTop=top(after,x,z);samples.push({x,z,east:12.5-z,north:x+12.25,currentTop,proposalTop,currentLevelMatches:Math.abs(currentTop-centerTop)<=.002,proposalLevelMatches:Math.abs(proposalTop-top(after,center.x,center.z))<=.002});
 }
 const sparseBytes=Buffer.from(JSON.stringify(sparse)+'\n');await writeFile(path.join(out,'v2-to-shoulder-proposal-sparse-slot-diff.json'),sparseBytes);
 const report={schema:'hestia.fp06.play-source-proposal-census/v1',status:'READONLY_PROPOSAL_NOT_RUNTIME; OWNER_REVIEW_PENDING',currentDigest:current.sourceDigest,proposedDigestUnderExistingV2Header:proposal.sourceDigest,currentSlotsSha256:sha(before),proposedSlotsSha256:sha(after),slotCount:before.length,original15MasksUnchanged:true,restV2BytesUnchanged:true,currentAdditionalColumns:380,proposedAddressedColumns:rows.reduce((n,m)=>n+m.addressedColumns,0),additionalAddressedColumns:rows.reduce((n,m)=>n+m.additionalColumns,0),changedColumns:columns.size,changedSlots:sparse.length,added,removed,replaced:0,materialCreditMg:0,cellMeters:.125,addedAreaMm2:rows.reduce((n,m)=>n+m.additionalColumns,0)*15625,proposedTotalFlatColumns:4480+rows.reduce((n,m)=>n+m.addressedColumns,0),carrierFootColliderPolicyAndBudgetsUnchanged:true,perMask:rows.map(m=>({...m,changedColumns:m.changedColumns.size})),flora:{current:plantCensus[0],proposal:plantCensus[1],woodOwnersByteEqual:JSON.stringify(plantCensus[0].woodOwners)===JSON.stringify(plantCensus[1].woodOwners)},batteryFirstVetoSourceAnalysis:{actualNativeReason:capture.native.factoryFacilities.lastCarrierVeto.reason,actualPlayer:capture.native.player.position,actualTargetMm:capture.native.factoryFacilities.lastCarrierVeto.targetMm,carrierCenterAtTarget:center,centerTop,currentUnequalSamples:samples.filter(s=>!s.currentLevelMatches).length,proposalUnequalSamples:samples.filter(s=>!s.proposalLevelMatches).length,samples,limit:'Source-slot reconstruction of actual native sampling coordinates; captured veto has no blocking-collider/sample identifier. Not a live raycast or full cross-route proof; farther north gaps remain.'},sparseArtifact:{path:'v2-to-shoulder-proposal-sparse-slot-diff.json',bytes:sparseBytes.length,sha256:sha(sparseBytes)}};
 await writeFile(path.join(out,'shoulder-proposal-census.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,batteryFirstVetoSourceAnalysis:{...report.batteryFirstVetoSourceAnalysis,samples:'see JSON artifact'}}));
}finally{await server.close();}
