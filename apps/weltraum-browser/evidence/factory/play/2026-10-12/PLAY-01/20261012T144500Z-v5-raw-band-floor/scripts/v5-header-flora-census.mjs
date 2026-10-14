import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const out=process.argv[2],server=await createServer({server:{middlewareMode:true}});
try{
 const f=await server.ssrLoadModule('/src/factory/fixtures/startSite.ts'),v=await server.ssrLoadModule('/src/hestia-prototype/presentation/vegetation.ts');
 const a=f.materializeFactoryStartSiteV4(),b=f.materializeFactoryStartSiteV5();
 const p4={version:'hvp-factory-vegetation-v1',readColumn:f.readFactorySourceColumnWorldV4},p5={version:'hvp-factory-vegetation-v1',readColumn:f.readFactorySourceColumnWorldV5};
 const plants4=v.planHvpVegetation(undefined,p4),plants5=v.planHvpVegetation(undefined,p5);
 const invalid4=plants4.filter(p=>!v.isHvpPlantHabitat(p.kind,p.position.x,p.position.z,p4)),invalid5=plants5.filter(p=>!v.isHvpPlantHabitat(p.kind,p.position.x,p.position.z,p5));
 const derived=(plants,profile)=>plants.filter(p=>v.isHvpPlantHabitat(p.kind,p.position.x,p.position.z,profile)).map(p=>{const source=v.buildHvpPlant(p,profile);return {id:p.id,digest:source.digest,wood:source.wood!==null,decorationPhysics:source.decorationPhysics};});
 const sources4=derived(plants4,p4),sources5=derived(plants5,p5);
 const result={version:b.version,sourceDigest:b.sourceDigest,rawSlotsSha256:createHash('sha256').update(b.copySlots()).digest('hex'),initializationReceipt:b.initializationReceipt,
  v4Digest:a.sourceDigest,plannedCounts:[plants4.length,plants5.length],plannerBytesIdentical:JSON.stringify(plants4)===JSON.stringify(plants5),invalid4,invalid5,validSourceCounts:[sources4.length,sources5.length],derivedSourceBytesIdentical:JSON.stringify(sources4)===JSON.stringify(sources5),actualWoodOwners:sources5.filter(p=>p.wood),policy:'Pure initial Source/Header/Flora comparison, no World/Native/Material write or credit; final Owner review pending'};
 await writeFile(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({...result,actualWoodOwners:result.actualWoodOwners.length}));
 if(!result.plannerBytesIdentical||!result.derivedSourceBytesIdentical||invalid5.length!==1||invalid5[0].id!=='hvp:flora:bed-52-220'||sources5.length!==96)throw Error('V5 derived Flora changed outside exact admitted scope');
}finally{await server.close();}
