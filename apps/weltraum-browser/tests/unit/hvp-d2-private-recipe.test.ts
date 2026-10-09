import {expect,it,vi} from "vitest";
import {writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps,type HvpRigidRecipeSpans} from "../../src/hestia-prototype/physics/rigidRecipe";
import {prepareHvpLocalBodyCut,prepareHvpLocalBodyCutOwnedHashSteps} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {createStructuralOwnerLedger,reconstructStructuralObjectInternal,isIssuedStructuralObject,createOwnedStructuralCellIndexSteps,ownedStructuralDerivationCandidateSteps,
  ownedStructuralReconstructionSteps,readOwnedPublishedCandidate,releaseOwnedStructuralDerivationCandidate,type OwnedPublishedWitness} from "../../src/voxel/structural/model";
import {structuralOwnedComponentClassificationSteps,prepareOwnedRigidComponentFactsSteps,prepareStructuralComponentFacts,readPreparedComponentFacts,transferPreparedComponentFactsSteps,bindOwnedPublishedClassification,
  type PreparedComponentFacts} from "../../src/voxel/structural/classificationSteps";
import {prepareStructuralGreedyRecipeFromFactsSteps,deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps} from "../../src/voxel/structural/physicsTransition";
import {borrowedHvpPlanSteps} from "../../src/hestia-prototype/physics/hvpPlanSteps";
import * as canonical from "../../src/voxel/structural/canonical";
import * as validation from "../../src/voxel/structural/validation";
import * as coordinates from "../../src/voxel/structural/coordinates";
import * as model from "../../src/voxel/structural/model";
import {ownedStructuralPlanCommandSteps,ownedStructuralCommandSteps,applyStructuralDestructionCommand} from "../../src/voxel/structural/commands";
import {STRUCTURAL_COMMAND_SCHEMA_VERSION} from "../../src/voxel/structural/types";
import {admitOwnedStructuralGraphSteps} from "../../src/voxel/structural/model";
import {sortedOwnedStructuralOccupiedEntrySteps,sortedIssuedStructuralOccupiedEntrySteps} from "../../src/voxel/structural/occupiedEntries";

const materials=[{materialId:1,densityKgPerCubicMeter:2400,structuralClass:"stone",destructible:true,tags:null},
  {materialId:3,densityKgPerCubicMeter:1500,structuralClass:"wood",destructible:true,tags:null}];
const rock:HvpStructuralCell[]=[];
for(let z=76;z<80;z++){for(let y=82;y<86;y++){for(let x=176;x<200;x++){rock.push({x,y,z,materialId:1});}}}
const drain=<T>(steps:Generator<unknown,T,unknown>):T=>{try{for(;;){const s=steps.next();if(s.done){return s.value;}}}finally{steps.return(undefined as never);}};
const error=(run:()=>unknown)=>{try{run();return null;}catch(e){return {name:(e as Error).name,message:(e as Error).message};}};

it("D2 private Recipe omits unused perVoxel and transition hash while matching whole canonical Recipes",()=>{
  const source=ingestHvpStructuralCells("d2-rock",rock,materials);
  const moving=prepareHvpLocalBodyCut(source,[180,84,76],"d2-moving",4,"Box").plan.parts[0]!.recipe.source;
  const sphere=prepareHvpLocalBodyCut(source,[180,84,76],"d2-sphere",4,"Sphere").plan.parts[0]!.recipe.source;
  expect(moving.bricks.reduce((n,b)=>n+b.cells.length,0)).toBe(352);
  for(const input of [source,moving,sphere,ingestHvpStructuralCells("d2-material",rock.map(c=>({...c,materialId:c.x<188?1:3})),materials)]){
    const spans:HvpRigidRecipeSpans={},ledger=createStructuralOwnerLedger(32*1024*1024);
    try{
      const actual=drain(prepareHvpRigidBodyOwnedHashSteps(input,spans,undefined,ledger.reserve));
      expect(JSON.stringify(actual)).toBe(JSON.stringify(prepareHvpRigidBody(input)));
      expect(spans).toMatchObject({transitionPerVoxelMs:0,transitionHashMs:0,preparedFactsReused:1});
      expect((spans as HvpRigidRecipeSpans&{transitionGreedyMs:number}).transitionGreedyMs).toBeGreaterThanOrEqual(0);
    }finally{ledger.release();}
  }
});

it("D2 private entry keys reuse the freshly validated canonical formatter while public issued cursors keep full validation",()=>{
  const source=ingestHvpStructuralCells("d2-entry-keys",rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  const owned=drain(admitOwnedStructuralGraphSteps(source,ledger.reserve));
  const expected=drain(sortedOwnedStructuralOccupiedEntrySteps(source,32768,ledger.reserve));
  const addressKey=vi.spyOn(canonical,"serializeStructuralCellAddress");
  try{
    expect(drain(sortedOwnedStructuralOccupiedEntrySteps(owned,32768,ledger.reserve))).toEqual(expected);
    expect(addressKey).not.toHaveBeenCalled();addressKey.mockClear();
    expect(drain(sortedOwnedStructuralOccupiedEntrySteps(source,32768,ledger.reserve))).toEqual(expected);
    expect(addressKey).not.toHaveBeenCalled();addressKey.mockClear();
    expect(drain(sortedIssuedStructuralOccupiedEntrySteps(source,32768))).toEqual(expected);
    expect(addressKey).toHaveBeenCalledTimes(384);
  }finally{addressKey.mockRestore();ledger.release();}
});

it("D2 facts-only preserves complete classifier errors for cell, Joint-fact and component caps",()=>{
  const seed=ingestHvpStructuralCells("d2-facts-cap",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}],materials);
  const ledger=createStructuralOwnerLedger(32*1024*1024),classified=drain(structuralOwnedComponentClassificationSteps(seed,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve));
  const cells=classified.components[0]!.occupiedCells;
  const jointSource=reconstructStructuralObjectInternal({objectId:seed.objectId,frame:seed.frame,source:seed.source,materials:seed.materials,
    bricks:seed.bricks,anchors:[],joints:[{jointId:"d2.cap-joint",jointClass:"weld",endpointA:{cell:cells[0],role:"primary"},endpointB:{cell:cells[1],role:"secondary"}}],
    objectRevision:seed.objectRevision,editRevision:seed.editRevision,commandEvidence:[]});
  const split=ingestHvpStructuralCells("d2-facts-cap-split",[{x:0,y:0,z:0,materialId:1},{x:3,y:0,z:0,materialId:1}],materials);
  const failure=(run:()=>unknown)=>{try{run();throw new Error("Expected cap failure");}catch(e){const value=e as Error&{code?:string;path?:string};return {name:value.name,message:value.message,code:value.code,path:value.path};}};
  try{
    for(const [source,budgets] of [[seed,{maxVisitedCells:1,maxComponents:32,maxIndexedFacts:262144}],
      [jointSource,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:1}],
      [split,{maxVisitedCells:32768,maxComponents:1,maxIndexedFacts:262144}]] as const){
      expect(failure(()=>drain(prepareOwnedRigidComponentFactsSteps(source,budgets,ledger.reserve))))
        .toEqual(failure(()=>drain(structuralOwnedComponentClassificationSteps(source,budgets,ledger.reserve))));
    }
  }finally{ledger.release();}
});

it("D2 private plan command omits only the unused Result hash and preserves the complete issued Source/evidence",()=>{
  const source=ingestHvpStructuralCells("d2-private-command",rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  const command={schemaVersion:STRUCTURAL_COMMAND_SCHEMA_VERSION,commandId:"d2-private-command",targetObjectId:source.objectId,
    expectedObjectRevision:source.objectRevision,resultingObjectRevision:source.objectRevision+1,expectedAdaptiveSource:source.source,
    sequence:source.objectRevision+1,actor:"hvp.player",source:"hvp.plasma",materialFilter:null,kind:"SubtractBox",
    shape:{kind:"box",space:"object-local-quantum",boundsQuantum:{min:{x:180,y:84,z:76},max:{x:184,y:88,z:80}}},
    budgets:{maxVisitedBricks:8,maxVisitedCells:32768,maxSelectedCells:512,maxChangedCells:512,maxConnectivityCells:32768,
      maxConnectivityFacts:262144,maxComponents:32,maxMassCells:32768}};
  try{
    const expected=drain(ownedStructuralCommandSteps(source,command,ledger.reserve));
    const NativeFreeze=Object.freeze,freeze=vi.spyOn(Object,"freeze").mockImplementation(value=>{
      const p=value as Record<string,unknown>;
      // Canonical hash projections are deliberately hashless; only an issued Source graph is the regression.
      if(p&&p.schemaVersion==="structural-microvoxel-result-v1"&&p.status==="Applied"&&!Object.hasOwn(p,"resultHash")&&isIssuedStructuralObject(p.object)){
        throw new Error("Unexpected public hashless Result freeze");
      }return NativeFreeze(value);
    });
    try{expect(applyStructuralDestructionCommand(source,command)).toEqual(expected);}finally{freeze.mockRestore();}
    let preparedSource:unknown;
    const validated=vi.spyOn(validation,"structuralDestructionCommandValidationSteps");
    const projected=vi.spyOn(coordinates,"globalQuantumForStructuralCell");
    try{
      expect(applyStructuralDestructionCommand(source,command)).toEqual(expected);
      expect(validated).toHaveBeenCalledTimes(1);expect(projected).toHaveBeenCalled();validated.mockClear();projected.mockClear();
      const actual=drain(ownedStructuralPlanCommandSteps(source,command,ledger.reserve,(value)=>{preparedSource=value;}));
      expect(validated).toHaveBeenCalledTimes(1);
      expect(projected).toHaveBeenCalledTimes(actual.object.bricks.reduce((n,brick)=>n+brick.cells.length,0));
      const {resultHash,...payload}=expected;
      expect(resultHash).toMatch(/^fnv1a64-v1:/);expect(actual).toEqual(payload);expect(actual).not.toHaveProperty("resultHash");
      expect(actual.object.commandEvidence).toEqual(expected.object.commandEvidence);
      expect(actual.object.contentHash).toBe(expected.object.contentHash);expect(actual.object.evidenceHash).toBe(expected.object.evidenceHash);
      expect(preparedSource).toBe(actual.object);
    }finally{projected.mockRestore();validated.mockRestore();}
  }finally{ledger.release();}
});

it("D2 fresh private Recipe derives connectivity facts without unused canonical Component or Fragment hashes",()=>{
  const source=ingestHvpStructuralCells("d2-facts-only",rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  const hash=vi.spyOn(canonical,"structuralCanonicalHashSteps");
  try{
    const expected=prepareHvpRigidBody(source);hash.mockClear();
    expect(JSON.stringify(drain(prepareHvpRigidBodyOwnedHashSteps(source,undefined,undefined,ledger.reserve)))).toBe(JSON.stringify(expected));
    const unused=hash.mock.calls.filter(([value])=>{
      const p=value as Record<string,unknown>;return String(p.schemaVersion).includes("component")||String(p.schemaVersion).includes("fragment")
        ||Object.hasOwn(p,"activeAnchors")||Object.hasOwn(p,"sourceAdaptiveAuthorityDigest");
    });
    expect(unused).toHaveLength(0);
  }finally{hash.mockRestore();ledger.release();}
});

it("D2 publisher proof expires before command credits can retire and rejects altered publication inputs",()=>{
  const source=ingestHvpStructuralCells("d2-publisher",rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  const candidate=drain(ownedStructuralDerivationCandidateSteps(source,source.bricks,source.objectRevision,source.editRevision,ledger.reserve));
  let escaped:OwnedPublishedWitness|undefined;
  try{
    const classification=drain(structuralOwnedComponentClassificationSteps(candidate,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve));
    const input={objectId:candidate.objectId,frame:candidate.frame,source:candidate.source,materials:candidate.materials,bricks:candidate.bricks,
      anchors:candidate.anchors,joints:candidate.joints,objectRevision:candidate.objectRevision,editRevision:candidate.editRevision,commandEvidence:[]};
    expect(()=>drain(ownedStructuralReconstructionSteps(source,{...input,bricks:[...input.bricks]},ledger.reserve,candidate))).toThrow(/exact live derivation candidate/);
    const published=drain(ownedStructuralReconstructionSteps(source,input,ledger.reserve,candidate,witness=>{
      escaped=witness;expect(readOwnedPublishedCandidate(witness)).toBe(candidate);
      expect(bindOwnedPublishedClassification(witness)).toBe(classification);
      expect(()=>bindOwnedPublishedClassification(witness)).toThrow(/Missing exact owned preliminary/);
    }));
    expect(()=>readOwnedPublishedCandidate(escaped!)).toThrow(/Expired/);
    expect(readPreparedComponentFacts(prepareStructuralComponentFacts(published,classification,classification.components[0]!),published))
      .toBe(classification.components[0]);
  }finally{releaseOwnedStructuralDerivationCandidate(candidate);ledger.release();}
});

it("D2 numeric indexing yields for an empty brick before allocating the next",()=>{
  const seed=ingestHvpStructuralCells("d2-empty-brick",[{x:0,y:0,z:0,materialId:1}],materials);
  const source=reconstructStructuralObjectInternal({objectId:seed.objectId,frame:seed.frame,source:seed.source,materials:seed.materials,
    bricks:seed.bricks.map(b=>({...b,cells:[]})),anchors:[],joints:[],objectRevision:seed.objectRevision,editRevision:seed.editRevision,commandEvidence:[]});
  const ledger=createStructuralOwnerLedger(32*1024*1024),steps=createOwnedStructuralCellIndexSteps(source,ledger.reserve);
  try{expect(steps.next().done).toBe(false);steps.return(undefined as never);}finally{steps.return(undefined as never);ledger.release();}
});

it("D2 numeric cell index does not expose owned storage through a replaced typed-array constructor",()=>{
  const source=ingestHvpStructuralCells("d2-index-private",[{x:0,y:0,z:0,materialId:1}],materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  const address=drain(structuralOwnedComponentClassificationSteps(source,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve)).components[0]!.occupiedCells[0]!;
  const Native=Uint16Array;let retained:Uint16Array|undefined;
  const replacement=function(length:number){retained=new Native(length);return retained;};
  try{
    globalThis.Uint16Array=replacement as unknown as Uint16ArrayConstructor;
    const project=drain(createOwnedStructuralCellIndexSteps(source,ledger.reserve));
    expect(retained).toBeUndefined();expect(project(address)).toEqual({x:0,y:0,z:0,materialId:1});
  }finally{globalThis.Uint16Array=Native;ledger.release();}
});

it("D2 keeps real Joint recipes identical and binds changed Joint state even at equal revision",()=>{
  const seed=ingestHvpStructuralCells("d2-joint",[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}],materials);
  const component=drain(structuralOwnedComponentClassificationSteps(seed,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},()=>{})).components[0]!;
  const joint={jointId:"d2.joint",jointClass:"weld",endpointA:{cell:component.occupiedCells[0]!,role:"primary"},endpointB:{cell:component.occupiedCells[1]!,role:"secondary"}};
  const make=(jointClass:string)=>reconstructStructuralObjectInternal({objectId:seed.objectId,frame:seed.frame,source:seed.source,
    materials:seed.materials,bricks:seed.bricks,anchors:[],joints:[{...joint,jointClass}],objectRevision:seed.objectRevision,editRevision:seed.editRevision,commandEvidence:[]});
  const source=make("weld"),changed=make("hinge"),ledger=createStructuralOwnerLedger(32*1024*1024);
  try{
    expect(JSON.stringify(drain(prepareHvpRigidBodyOwnedHashSteps(source,undefined,undefined,ledger.reserve)))).toBe(JSON.stringify(prepareHvpRigidBody(source)));
    const classified=drain(structuralOwnedComponentClassificationSteps(source,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve));
    const facts=prepareStructuralComponentFacts(source,classified,classified.components[0]!);
    expect(()=>readPreparedComponentFacts(facts,changed)).toThrow(/binding/);
    expect(drain(transferPreparedComponentFactsSteps(facts,source,seed,ledger.reserve))).toBeUndefined();
  }finally{ledger.release();}
});

it.each(["Box","Sphere"] as const)("D2 %s owner plan reuses complete child partitions with full plan equality",brush=>{
  const source=ingestHvpStructuralCells(`d2-owner-${brush}`,rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  const recipes:HvpRigidRecipeSpans[]=[],probe={ingest:undefined,recipe:(spans:HvpRigidRecipeSpans)=>recipes.push(spans)};
  // Live measurement is provided through the mature probe interface.
  Object.defineProperty(probe,"ingest",{get:()=>({trace:()=>{},commandId:`d2-${brush}`,thread:"physics" as const})});
  const receiptName=brush==="Box"?process.env.HVP_OWNER_HASH_RECEIPT:undefined;
  const rows:Array<{ordinal:number;nextCalls:number;activeNextElapsedMs:number;complete:boolean;digest:string|null}>=[];
  const aggregate=()=>({calls:0,nextCalls:0,activeNextElapsedMs:0,completed:0});
  const publication=aggregate(),materialsMap=aggregate(),bricksMap=aggregate(),voxelStateValidation=aggregate(),evidenceValidation=aggregate(),evidenceHash=aggregate();
  const probes:Array<{mockRestore:()=>void}>=[];let inParentPublication=false;
  const observeNext=<Y,T,N>(steps:Generator<Y,T,N>,row:ReturnType<typeof aggregate>,parent=false)=>{
    row.calls+=1;const next=steps.next.bind(steps);
    steps.next=(...args)=>{const previous=inParentPublication;if(parent){inParentPublication=true;}
      const start=performance.now();row.nextCalls+=1;
      try{const value=next(...args);if(value.done){row.completed+=1;}return value;}
      finally{row.activeNextElapsedMs+=performance.now()-start;inParentPublication=previous;}};
    return steps;
  };
  let measurementPassed=false,hash:ReturnType<typeof vi.spyOn>|undefined;
  try{
    const expected=prepareHvpLocalBodyCut(source,[180,84,76],`d2-${brush}`,4,brush);
    const parentRecipe=prepareHvpRigidBody(source);
    if(receiptName!==undefined){
      if(!/^owner-content-hash-r\d+\.json$/.test(receiptName)){throw new Error("Invalid owner hash receipt name");}
      const reconstruction=model.ownedStructuralReconstructionSteps,map=validation.structuralMapSteps,
        state=validation.validateStructuralVoxelState,evidence=validation.structuralCommandEvidenceSemanticsSteps,hashEvidence=canonical.structuralEvidenceHashSteps;
      probes.push(vi.spyOn(model,"ownedStructuralReconstructionSteps").mockImplementation((...args)=>{
        const steps=reconstruction(...args);return args[0]===source&&args[3]!==undefined?observeNext(steps,publication,true):steps;
      }));
      probes.push(vi.spyOn(validation,"structuralMapSteps").mockImplementation((...args)=>{
        const steps=map(...args),row=inParentPublication?(args[1]==="materials"?materialsMap:args[1]==="bricks"?bricksMap:undefined):undefined;
        return row===undefined?steps:observeNext(steps,row);
      }));
      probes.push(vi.spyOn(validation,"validateStructuralVoxelState").mockImplementation((...args)=>{
        if(!inParentPublication){return state(...args);}const start=performance.now();voxelStateValidation.calls+=1;
        try{const value=state(...args);voxelStateValidation.completed+=1;return value;}
        finally{voxelStateValidation.activeNextElapsedMs+=performance.now()-start;}
      }));
      probes.push(vi.spyOn(validation,"structuralCommandEvidenceSemanticsSteps").mockImplementation((...args)=>{
        const steps=evidence(...args);return inParentPublication?observeNext(steps,evidenceValidation):steps;
      }));
      probes.push(vi.spyOn(canonical,"structuralEvidenceHashSteps").mockImplementation((...args)=>{
        const steps=hashEvidence(...args);return inParentPublication?observeNext(steps,evidenceHash):steps;
      }));
      const original=canonical.structuralObjectContentHashSteps;
      hash=vi.spyOn(canonical,"structuralObjectContentHashSteps").mockImplementation((object,reserve)=>{
        const steps=original(object,reserve);if(reserve===undefined||object.objectId!==source.objectId){return steps;}
        if(rows.length>=2){throw new Error("Unexpected parent content-hash population");}
        const row={ordinal:rows.length+1,nextCalls:0,activeNextElapsedMs:0,complete:false,digest:null as string|null};rows.push(row);
        const next=steps.next.bind(steps);
        steps.next=(...args)=>{const start=performance.now();row.nextCalls+=1;
          try{const value=next(...args);if(value.done){row.complete=true;row.digest=value.value;}return value;}
          finally{row.activeNextElapsedMs+=performance.now()-start;}};
        return steps;
      });
    }
    const actual=drain(prepareHvpLocalBodyCutOwnedHashSteps(source,[180,84,76],`d2-${brush}`,4,brush,probe,parentRecipe,ledger.reserve));
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(recipes.length).toBeGreaterThan(0);
    for(const spans of recipes){expect(spans).toMatchObject({classifyMs:0,componentPartitionReused:1,transitionHashMs:0,transitionPerVoxelMs:0});}
    if(receiptName!==undefined){
      expect(rows).toHaveLength(2);expect(rows.every(row=>row.complete&&row.nextCalls>0&&Number.isFinite(row.activeNextElapsedMs)&&row.activeNextElapsedMs>=0)).toBe(true);
      expect(rows.map(row=>row.digest)).toEqual([actual.plan.after.contentHash,actual.plan.after.contentHash]);
      for(const row of [publication,materialsMap,bricksMap,evidenceValidation,evidenceHash]){
        expect(row).toMatchObject({calls:1,completed:1});expect(row.nextCalls).toBeGreaterThan(0);
        expect(Number.isFinite(row.activeNextElapsedMs)&&row.activeNextElapsedMs>=0).toBe(true);
      }
      const cells=actual.plan.after.bricks.reduce((n,b)=>n+b.cells.length,0);
      expect(voxelStateValidation).toMatchObject({calls:cells,completed:cells});
      expect(Number.isFinite(voxelStateValidation.activeNextElapsedMs)&&voxelStateValidation.activeNextElapsedMs>=0).toBe(true);measurementPassed=true;
    }
  }finally{
    hash?.mockRestore();for(const spy of probes){spy.mockRestore();}ledger.release();
    if(receiptName!==undefined&&/^owner-content-hash-r\d+\.json$/.test(receiptName)){
      const text=JSON.stringify({classification:"ACTIVE_CURSOR_ELAPSED_MICRODIAGNOSTIC_NOT_GAME_CPU_ACCEPTANCE",status:measurementPassed?"PASS":"FAIL",
        sourceCells:rock.length,expectedHashCalls:2,phases:["derivation","publication"],rows,
        publicationBreakdown:{publication,materialsMap,bricksMap,voxelStateValidation,evidenceValidation,evidenceHash},
        timingMeaning:"Publication includes all child spans; voxelStateValidation is contained in bricksMap. Active next elapsed includes observer overhead and descheduling, not pure CPU."},null,2);
      if(Buffer.byteLength(text+"\n")>8192){throw new Error("Hash receipt exceeds bound");}
      writeFileSync(resolve("../..",".devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/tests/D2",receiptName),text+"\n",{flag:"wx"});
    }
  }
});

it("D2 removes clock calls belonging to omitted transition work while retaining the continuous deadline wrapper",()=>{
  const source=ingestHvpStructuralCells("d2-clock",rock,materials),clock=vi.spyOn(performance,"now").mockReturnValue(0);
  const oldLedger=createStructuralOwnerLedger(32*1024*1024),newLedger=createStructuralOwnerLedger(32*1024*1024);
  try{
    const zero={x:0,y:0,z:0},budgets={maxVisitedCells:32768,maxConnectivityCells:32768,maxComponents:32,maxConnectivityFacts:262144};
    drain(borrowedHvpPlanSteps(deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps(source,{velocityMetersPerSecond:zero,angularVelocityRadPerSecond:zero},
      {maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768},budgets,()=>{},()=>{},oldLedger.reserve),"oldRecipe"));
    const before=clock.mock.calls.length;clock.mockClear();
    drain(prepareHvpRigidBodyOwnedHashSteps(source,{},undefined,newLedger.reserve));
    expect(clock.mock.calls.length).toBeLessThan(before);
  }finally{clock.mockRestore();oldLedger.release();newLedger.release();}
});

it("D2 transfers a validated complete child partition and rejects changed material or cells",()=>{
  const parent=ingestHvpStructuralCells("d2-partition-parent",rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  try{
    const classification=drain(structuralOwnedComponentClassificationSteps(parent,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve));
    const facts=prepareStructuralComponentFacts(parent,classification,classification.components[0]!);
    const child=ingestHvpStructuralCells("d2-partition-child",rock,materials);
    const transferred=drain(transferPreparedComponentFactsSteps(facts,parent,child,ledger.reserve))!;
    expect(transferred.sourceIdentity).toBe(child);expect(transferred.componentCells).toHaveLength(384);
    expect(drain(prepareStructuralGreedyRecipeFromFactsSteps(child,transferred,384,ledger.reserve))).toEqual(prepareHvpRigidBody(child).colliders);
    for(const changed of [ingestHvpStructuralCells("d2-partition-changed",rock.slice(1),materials),
      ingestHvpStructuralCells("d2-partition-changed",rock.map(c=>({...c,materialId:3})),materials),
      ingestHvpStructuralCells("d2-partition-changed",rock,materials.map(m=>({...m,densityKgPerCubicMeter:m.densityKgPerCubicMeter+1})))] ){
      expect(()=>drain(transferPreparedComponentFactsSteps(facts,parent,changed,ledger.reserve))).toThrow(/child partition/);
    }
    expect(()=>drain(transferPreparedComponentFactsSteps({...facts},parent,child,ledger.reserve))).toThrow(/binding/);
  }finally{ledger.release();}
});

it("D2 rejects a genuine component proof that covers only part of its issued Source",()=>{
  const source=ingestHvpStructuralCells("d2-partial",[{x:0,y:0,z:0,materialId:1},{x:3,y:0,z:0,materialId:1}],materials);
  const ledger=createStructuralOwnerLedger(32*1024*1024);
  try{
    const classification=drain(structuralOwnedComponentClassificationSteps(source,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve));
    const facts=prepareStructuralComponentFacts(source,classification,classification.components[0]!);
    expect(()=>drain(prepareStructuralGreedyRecipeFromFactsSteps(source,facts,facts.componentCells.length,ledger.reserve)))
      .toThrow("Rigid source requires one unanchored connected component");
  }finally{ledger.release();}
});

it("D2 preserves empty, anchored, disconnected and NoChange failures before any Recipe issuance",()=>{
  const seed=ingestHvpStructuralCells("d2-empty",[{x:0,y:0,z:0,materialId:1}],materials);
  const empty=reconstructStructuralObjectInternal({objectId:seed.objectId,frame:seed.frame,source:seed.source,
    materials:seed.materials,bricks:[],anchors:[],joints:[],objectRevision:seed.objectRevision,editRevision:seed.editRevision,commandEvidence:[]});
  const inputs=[empty,
    ingestHvpStructuralCells("d2-anchor",[{x:0,y:0,z:0,materialId:1}],materials,[{x:0,y:0,z:0}]),
    ingestHvpStructuralCells("d2-split",[{x:0,y:0,z:0,materialId:1},{x:3,y:0,z:0,materialId:1}],materials)];
  for(const input of inputs){
    const ledger=createStructuralOwnerLedger(32*1024*1024);
    try{expect(error(()=>drain(prepareHvpRigidBodyOwnedHashSteps(input,undefined,undefined,ledger.reserve))))
      .toEqual(error(()=>prepareHvpRigidBody(input)));}finally{ledger.release();}
  }
  const source=ingestHvpStructuralCells("d2-nochange",rock,materials);
  expect(()=>prepareHvpLocalBodyCut(source,[184,88,76],"d2-nochange",4,"Box")).toThrow("Structural cut NoChange");
});

it("D2 rejects every altered fact binding, clones, proxies, and equal-revision different material/anchor/joint states",()=>{
  const source=ingestHvpStructuralCells("d2-facts",rock,materials),ledger=createStructuralOwnerLedger(32*1024*1024);
  try{
    const classification=drain(structuralOwnedComponentClassificationSteps(source,{maxVisitedCells:32768,maxComponents:32,maxIndexedFacts:262144},ledger.reserve));
    const component=classification.components[0]!,facts=prepareStructuralComponentFacts(source,classification,component);
    expect(readPreparedComponentFacts(facts,source)).toBe(component);
    for(const altered of [{...facts},new Proxy(facts,{}),{...facts,sourceIdentity:Object.freeze({...source})},
      {...facts,revision:facts.revision+1},{...facts,materialAnchorJointDigest:"forged"},
      {...facts,componentCells:Object.freeze([...facts.componentCells])},{...facts,algorithmVersion:"wrong"}]){
      expect(()=>readPreparedComponentFacts(altered as PreparedComponentFacts,source)).toThrow("Invalid prepared component facts binding");
    }
    const changed=ingestHvpStructuralCells("d2-facts",rock.map(c=>({...c,materialId:3})),materials);
    const anchored=ingestHvpStructuralCells("d2-facts",rock,materials,[rock[0]!]);
    for(const other of [changed,anchored,Object.freeze({...source}),new Proxy(source,{})]){
      expect(other.objectRevision).toBe(source.objectRevision);
      expect(()=>readPreparedComponentFacts(facts,other)).toThrow("Invalid prepared component facts binding");
    }
    expect(()=>prepareStructuralComponentFacts(source,{...classification},component)).toThrow(/exact private source classification/);
    expect(()=>prepareStructuralComponentFacts(source,classification,{...component})).toThrow(/exact private source classification/);
  }finally{ledger.release();}
});
