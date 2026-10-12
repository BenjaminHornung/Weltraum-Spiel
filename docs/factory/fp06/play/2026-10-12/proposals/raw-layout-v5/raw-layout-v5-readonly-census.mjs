import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const app='/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser';
const out=process.argv[2];
if(!out||!path.resolve(out).startsWith('/workspace/.cloud-setup/fp06-play-2026-10-12/PLAY-01/'))throw Error('Explicit own external evidence directory required');
if(process.cwd()!==app)throw Error('Unexpected cwd');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bindingPaths=[
 'src/factory/fixtures/startSite.ts','src/hvp/hvpCoastSource.ts','src/core/hash.ts',
 'src/factory/fixtures/cargoSite.ts','src/factory/construction/installationProfile.ts',
 'src/factory/construction/cargoHandlingProfile.ts','src/factory/construction/placement.ts',
 'src/factory/presentation/factoryAssets.ts','src/factory/catalog/fp02Catalog.ts',
 'src/factory/factoryEntry.ts','src/factory/session/factorySession.ts',
 'src/hestia-prototype/physics/factoryFacilitySession.ts',
 'src/hestia-prototype/presentation/vegetation.ts','src/hvp/hvpTerrain.ts',
 '../../art/factory/fp02/cutter/source.scene.json','../../art/factory/fp02/former/source.scene.json',
 '../../art/factory/fp01/power-kit/source.scene.json','package.json','package-lock.json'
];
const bindings=await Promise.all(bindingPaths.map(async p=>{const b=await readFile(path.join(app,p));return {path:p,bytes:b.length,sha256:sha(b)};}));
const {createServer}=await import(pathToFileURL(path.join(app,'node_modules/vite/dist/node/index.js')));
const server=await createServer({root:app,configFile:false,cacheDir:'/tmp/fp06-raw-layout-v5-readonly-census',server:{middlewareMode:true},optimizeDeps:{noDiscovery:true,include:[]}});
try{
 const sourceModule=await server.ssrLoadModule('/src/factory/fixtures/startSite.ts');
 // This constructor and its defensive slot copy are explicitly approved only
 // for this offline census. No World, Resources owner or Native actor is created.
 const base=sourceModule.materializeFactoryStartSiteV4();
 if(base.sourceDigest!=='913c0c46'||base.version!=='hvp-factory-startsite-v4')throw Error('Actual V4 baseline changed');
 const before=base.copySlots(),after=before.slice();
 if(before.length!==8388608)throw Error('Unexpected source slot count');
 const masks=[[2,6,5,5.5],[11,13,5,5.5]];
 const approvedMasks=[...sourceModule.FACTORY_START_SITE_MASKS,...sourceModule.FACTORY_START_SITE_V3_ADDITIONS,...sourceModule.FACTORY_START_SITE_V4_CONNECTORS];
 const contains=(mask,e,n)=>e>=mask[0]&&e<mask[1]&&n>=mask[2]&&n<mask[3];
 const perMask=masks.map((mask,i)=>({id:['RAW-CUTTER-NORTH-HALF-METRE','CUTTER-FORMER-REMAINING-NORTH-HALF-METRE'][i],mask,columns:0,changedColumns:0,changedSlots:0,airToSolid:0,solidToAir:0,solidToSolidRemap:0}));
 const columnSet=new Set(),columns=[];
 const histogram={};
 const index=(x,y,z)=>x+256*(y+128*z);
 for(let z=0;z<256;z++)for(let x=0;x<256;x++){
  const nativeX=-16+(x+.5)*.125,nativeZ=-16+(z+.5)*.125,east=12.5-nativeZ,north=nativeX+12.25;
  const m=perMask.find(m=>contains(m.mask,east,north));if(!m)continue;
  if(approvedMasks.some(mask=>contains(mask,east,north)))throw Error('New strip counted an existing V4 flat column');
  if(columnSet.has(x+256*z))throw Error('Duplicate proposed column');
  columnSet.add(x+256*z);m.columns++;
  const row={maskId:m.id,x,z,nativeCenterMeters:[nativeX,nativeZ],sourceCenterEastNorthMeters:[east,north],beforeTopMeters:-8,afterTopMeters:1.5,changedSlots:0,airToSolid:0,solidToAir:0,solidToSolidRemap:0,transitions:{}};
  for(let y=127;y>=0;y--)if(before[index(x,y,z)]!==0){row.beforeTopMeters=-8+(y+1)*.125;break;}
  for(let y=0;y<128;y++){
   const i=index(x,y,z),old=before[i],next=+(y<=75);after[i]=next;
   if(old===next)continue;
   row.changedSlots++;m.changedSlots++;
   const transition=`${old}->${next}`;
   row.transitions[transition]=(row.transitions[transition]??0)+1;histogram[transition]=(histogram[transition]??0)+1;
   const kind=old===0?'airToSolid':next===0?'solidToAir':'solidToSolidRemap';row[kind]++;m[kind]++;
  }
  if(row.changedSlots)m.changedColumns++;columns.push(row);
 }
 if(perMask.map(m=>m.columns).join(',')!=='128,64'||columnSet.size!==192)throw Error('Exact 3-square-metre mask count mismatch');
 const sparse=[];let outsideChanged=0;
 for(let i=0;i<before.length;i++)if(before[i]!==after[i]){
  const x=i%256,y=Math.floor(i/256)%128,z=Math.floor(i/32768);
  if(!columnSet.has(x+256*z))outsideChanged++;
  if(after[i]!==+(y<=75))throw Error('Candidate operation changed');
  // Full addressed coordinates and raw X-fastest index, ordered by raw index.
  sparse.push([i,x,y,z,before[i],after[i]]);
 }
 if(outsideChanged!==0)throw Error('Sparse diff escaped exact proposed columns');
 for(const b of bindings){const current=await readFile(path.join(app,b.path));if(sha(current)!==b.sha256)throw Error(`Concurrent source binding changed: ${b.path}`);}
 const sparseBytes=Buffer.from(JSON.stringify(sparse)+'\n');
 const perColumnBytes=Buffer.from(JSON.stringify(columns,null,2)+'\n');
 await mkdir(out,{recursive:false});
 await writeFile(path.join(out,'v4-to-proposed-v5-sparse-slot-diff.json'),sparseBytes);
 await writeFile(path.join(out,'per-column-census.json'),perColumnBytes);
 const totals=perMask.reduce((a,m)=>{for(const k of ['changedColumns','changedSlots','airToSolid','solidToAir','solidToSolidRemap'])a[k]+=m[k];return a;},{changedColumns:0,changedSlots:0,airToSolid:0,solidToAir:0,solidToSolidRemap:0});
 const receipt={schema:'hestia.play.readonly-source-proposal-census/v1',status:'UNGRANTED_GEOMETRY_PROPOSAL_ONLY',atUtc:new Date().toISOString(),node:process.version,
  invocation:{argv:process.argv,cwd:process.cwd()},executedSourceModules:['src/factory/fixtures/startSite.ts','src/hvp/hvpCoastSource.ts','src/core/hash.ts'],bindings,
  sourceFrame:{nativeX:'north-12.25',nativeZ:'12.5-east',nativeY:'height',originMeters:[-16,-8,-16],cellMeters:.125,dimensions:[256,128,256],index:'x+256*(y+128*z)'},
  actualBaseline:{version:base.version,sourceDigest:base.sourceDigest,seedName:base.seedName,registryDigest:base.registryDigest,initializationReceipt:base.initializationReceipt,rawSlotBytes:before.length,rawSlotsSha256:sha(before)},
  proposal:{name:'raw-storage-cargo-access-belt-floor-candidate-v5',runtimeVersion:'NOT_IMPLEMENTED',runtimeHeader:'NOT_IMPLEMENTED',runtimeSourceDigest:'NOT_COMPUTED_OR_CLAIMED',rawSlotsSha256:sha(after),newHalfOpenSourceMasks:masks,newColumns:192,newAreaMm2:3000000,newAreaSquareMeters:3,operation:'On an unpublished defensive copy only: slot[x+256*(y+128*z)] = (y<=75 ? 1 : 0) for exactly the 192 addressed columns',proposedUnionColumns:5880,proposedUnionAreaMm2:91875000,materialCreditMg:0,ownerTerrainAcceptance:'OWNER_REVIEW_PENDING'},
  existingV4NorthBeltStripExcluded:{mask:[9,11,5,5.5],columns:64,areaMm2:1000000},perMask,...totals,transitionCounts:histogram,
  slotPalette:{0:'known-air',1:'limestone-dry',2:'limestone-wet',3:'soil',4:'moss'},fullComparison:{slots:before.length,outsideChangedSlots:outsideChanged,statement:'Every slot outside the exact 192 proposed columns is byte-identical'},
  sparseArtifact:{path:'v4-to-proposed-v5-sparse-slot-diff.json',columns:['rawIndex','x','y','z','beforeSlot','afterSlot'],rows:sparse.length,bytes:sparseBytes.length,sha256:sha(sparseBytes)},perColumnArtifact:{path:'per-column-census.json',rows:columns.length,bytes:perColumnBytes.length,sha256:sha(perColumnBytes)},
  protectedFacts:{sourceFilesWritten:0,worldWrites:0,nativeActorWrites:0,resourcesWrites:0,colliderOrProfileMutations:0,headerMutations:0,budgetMutations:0,approvedMasksMutations:0,cargoGeometryMutations:0,vegetationSourceMutations:0,
   vegetationEvidence:'Source bytes are bound and unchanged during this read. No planner, habitat, plant/collider, Flora diff or Native acceptance was run or inferred.',nativeFloorSupportClearanceAndLineOfSight:'NOT_RUN',browser:'NOT_RUN',testsBuildProfiling:'NOT_RUN'},
  readonlyMathProbe20261012T133405Z:{startUtc:'2026-10-12T13:34:05.423Z',endUtc:'2026-10-12T13:34:06.273Z',internalElapsedSeconds:.849608135,exitCode:0,argv:['node','--input-type=module'],cwd:app,stdoutRawHash:'NOT_REPORTED_FULL_STDOUT_WAS_NOT_PERSISTED_AND_TOOL_OUTPUT_WAS_TRUNCATED',note:'Historical column/profile probe kept separate; the fresh census receipt does not rewrite or invent its raw output.'}};
 const json=Buffer.from(JSON.stringify(receipt,null,2)+'\n');
 await writeFile(path.join(out,'source-census.json'),json);
 console.log(JSON.stringify({status:receipt.status,baseDigest:base.sourceDigest,newColumns:192,newAreaSquareMeters:3,...totals,transitionCounts:histogram,beforeRawSlotsSha256:sha(before),afterRawSlotsSha256:sha(after),sparseArtifact:receipt.sparseArtifact,perColumnArtifact:receipt.perColumnArtifact,censusArtifact:{path:'source-census.json',bytes:json.length,sha256:sha(json)},protectedFacts:receipt.protectedFacts}));
}finally{await server.close();}
