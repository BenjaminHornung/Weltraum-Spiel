import {expect,it} from "vitest";
import {HVP_COAST_MATERIAL_REGISTRY,materializeHvpCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";
import {ingestHvpStructuralCells,type HvpStructuralCell} from "../../src/hestia-prototype/terrain/structuralIngest";
import {hvpRigidColliderBoxes,prepareHvpRigidBody,prepareHvpRigidBodyOwnedHashSteps} from "../../src/hestia-prototype/physics/rigidRecipe";
import {prepareHvpLocalBodyCut} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps} from "../../src/voxel/structural/physicsTransition";
import {deriveStructuralComponentClassification,deriveStructuralObjectMassProperties,
  deriveStructuralPhysicsTransition,deriveStructuralSingleComponentPhysicsPreparation} from "../../src/voxel/structural";
import {deriveStructuralComponentMassProperties,deriveStructuralSingleComponentMasses} from "../../src/voxel/structural/massProperties";
import {isIssuedStructuralObject} from "../../src/voxel/structural/model";

const materials=HVP_COAST_MATERIAL_REGISTRY.map(material=>({materialId:material.slot,
  densityKgPerCubicMeter:material.densityKgPerM3,structuralClass:material.role,destructible:true,tags:null}));
const budgets={maxVisitedCells:32768,maxConnectivityCells:32768,maxComponents:32,maxConnectivityFacts:262144};
const compare=(id:string,cells:readonly HvpStructuralCell[])=>{
  const source=ingestHvpStructuralCells(id,cells,materials);
  const recipe=prepareHvpRigidBody(source);
  const mass=deriveStructuralObjectMassProperties(source,{maxVisitedCells:budgets.maxVisitedCells});
  const classification=deriveStructuralComponentClassification(source,{maxVisitedCells:budgets.maxVisitedCells,
    maxComponents:budgets.maxComponents,maxIndexedFacts:budgets.maxConnectivityFacts});
  const motion={velocityMetersPerSecond:{x:0,y:0,z:0},angularVelocityRadPerSecond:{x:0,y:0,z:0}};
  const limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768};
  const plan=deriveStructuralPhysicsTransition(source,classification,motion,limits,budgets);
  expect(plan.status).toBe("Installed");
  if(plan.status!=="Installed"){throw new Error("Expected exact installed source");}
  expect(plan.dynamicBodies).toHaveLength(1);
  expect(recipe.mass).toEqual(mass);
  expect(recipe.colliders).toEqual(plan.dynamicBodies[0]!.greedyColliders);
  expect(deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,budgets,()=>{},()=>{}).transition).toEqual(plan);
  return {sourceHash:source.contentHash,massHash:mass.contentHash,
    componentContentHash:classification.components[0]!.componentContentHash,transitionHash:plan.contentHash,
    tensor:mass.inertiaTensorKgMetersSquared,boxes:hvpRigidColliderBoxes(recipe)};
};

it("freezes independent pre-change elbow and real authored 384-cell rock-arm results",()=>{
  const elbow=compare("v3-parity-elbow",[
    {x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}
  ]);
  expect(elbow).toEqual({sourceHash:"fnv1a64-v1:492f0884cb4e97bc",massHash:"fnv1a64-v1:cfb7b9904797189a",
    componentContentHash:"fnv1a64-v1:44ac71f7c36afe68",transitionHash:"fnv1a64-v1:1403b0a1b80486cf",
    tensor:{xx:0.08544921875,yy:0.08544921875,zz:0.13427734375,xy:0.0244140625,xz:0,yz:0},
    boxes:[{min:[0,0,0],max:[2,1,1]},{min:[0,1,0],max:[1,2,1]}]});
  const coast=prepareHvpCoastSource(materializeHvpCoastSource()),cells:HvpStructuralCell[]=[];
  for(let z=76;z<80;z+=1){for(let y=82;y<86;y+=1){for(let x=176;x<200;x+=1){
    const slot=coast.readSlot(x,y,z);
    if(slot===undefined||slot===0){throw new Error("Authored roof coverage changed");}
    cells.push({x,y,z,materialId:slot});
  }}}
  expect(cells).toHaveLength(384);
  const rock=compare("v3-parity-rock",cells);
  expect(rock).toEqual({sourceHash:"fnv1a64-v1:f8cfbfc86fa161d2",massHash:"fnv1a64-v1:1751b40b9225d06b",
    componentContentHash:"fnv1a64-v1:a5dc619618b1e9b1",transitionHash:"fnv1a64-v1:9cce122fdc2d9a32",
    tensor:{xx:70.39250587930478,yy:1335.8289819834174,zz:1334.5526621293047,
      xy:-1.894132653061224,xz:1.2627551020408136,yz:-1.8941326530612244},
    boxes:[{min:[176,82,76],max:[200,86,80]}]});
});

it("V3-02 preserves the full transition for a mixed-density multi-brick source with parent motion",()=>{
  const cells=[14,15,16,17,18].map(x=>({x,y:5,z:0,materialId:x<16?1:3}));
  const source=ingestHvpStructuralCells("v3-parity-multibrick",cells,materials);
  expect(source.bricks).toHaveLength(2);
  expect(new Set(cells.map(cell=>source.materials.find(material=>material.materialId===cell.materialId)!.densityKgPerCubicMeter)))
    .toEqual(new Set([2400,1500]));
  const motion={velocityMetersPerSecond:{x:1,y:0.5,z:-0.25},angularVelocityRadPerSecond:{x:0.3,y:-0.4,z:0.5}};
  const limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768};
  const classification=deriveStructuralComponentClassification(source,{maxVisitedCells:budgets.maxVisitedCells,
    maxComponents:budgets.maxComponents,maxIndexedFacts:budgets.maxConnectivityFacts});
  const old=deriveStructuralPhysicsTransition(source,classification,motion,limits,budgets);
  const strong=deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,budgets,()=>{},()=>{});
  expect(strong.transition).toEqual(old);
});

it("keeps original single-component rejection before generic transition and accepts frozen source lookalikes",()=>{
  const disconnected=ingestHvpStructuralCells("v3-parity-split",[
    {x:0,y:0,z:0,materialId:1},{x:5,y:0,z:0,materialId:1}],materials);
  expect(()=>prepareHvpRigidBody(disconnected)).toThrow("Rigid source requires one unanchored connected component");
  const anchored=ingestHvpStructuralCells("v3-parity-anchor",[{x:0,y:0,z:0,materialId:1}],materials,[{x:0,y:0,z:0}]);
  expect(()=>prepareHvpRigidBody(anchored)).toThrow("Rigid source requires one unanchored connected component");
  const source=ingestHvpStructuralCells("v3-parity-clone",[{x:0,y:0,z:0,materialId:1}],materials);
  expect(isIssuedStructuralObject(source)).toBe(true);
  expect(isIssuedStructuralObject(Object.freeze({...source}))).toBe(false);
  expect(isIssuedStructuralObject(new Proxy(source,{}))).toBe(false);
  const baseline=prepareHvpRigidBody(source);
  expect(prepareHvpRigidBody(Object.freeze({...source})).mass).toEqual(baseline.mass);
  expect(prepareHvpRigidBody(new Proxy(source,{})).colliders).toEqual(baseline.colliders);
});

it("V3-02 reuses only fresh issued mass and component results with the old summation order",()=>{
  const source=ingestHvpStructuralCells("v3-parity-strong",[
    {x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}],materials);
  const objectMass=deriveStructuralObjectMassProperties(source,{maxVisitedCells:budgets.maxVisitedCells});
  const classification=deriveStructuralComponentClassification(source,{maxVisitedCells:budgets.maxConnectivityCells,
    maxComponents:budgets.maxComponents,maxIndexedFacts:budgets.maxConnectivityFacts});
  const componentMass=deriveStructuralComponentMassProperties(source,classification.detachedComponents[0]!,budgets);
  const calls:string[]=[];
  const issued=deriveStructuralSingleComponentMasses(source,budgets,
    ()=>{calls.push("mass");},()=>{calls.push("classification");});
  expect(calls).toEqual(["mass","classification"]);
  expect(issued.objectMass).toEqual(objectMass);
  expect(issued.classification).toEqual(classification);
  expect(issued.componentMass).toEqual(componentMass);
  expect(()=>deriveStructuralSingleComponentMasses(Object.freeze({...source}),budgets,()=>{},()=>{})).toThrow(/issued/i);
});

it("V3-02 strong entry rejects smaller budgets and never accepts a forged source or mutable callback budgets",()=>{
  const source=ingestHvpStructuralCells("v3-parity-bound",[
    {x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}],materials);
  const motion={velocityMetersPerSecond:{x:0,y:0,z:0},angularVelocityRadPerSecond:{x:0,y:0,z:0}};
  const limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:3};
  const bounded={maxVisitedCells:3,maxConnectivityCells:3,maxComponents:1,maxConnectivityFacts:1};
  const classification=deriveStructuralComponentClassification(source,{maxVisitedCells:3,maxComponents:1,maxIndexedFacts:1});
  const old=deriveStructuralPhysicsTransition(source,classification,motion,limits,bounded);
  const callbacks:string[]=[];
  const strong=deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,bounded,
    ()=>{callbacks.push("mass");},()=>{callbacks.push("classification");});
  expect(callbacks).toEqual(["mass","classification"]);
  expect(strong.transition).toEqual(old);
  expect(()=>deriveStructuralSingleComponentPhysicsPreparation(Object.freeze({...source}),motion,limits,bounded,()=>{},()=>{})).toThrow(/issued/i);
  expect(()=>deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,{...bounded,maxVisitedCells:2},()=>{},()=>{})).toThrow(/mass budget/i);
  expect(()=>deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,{...bounded,maxConnectivityCells:2},()=>{},()=>{})).toThrow(/connectivity budget/i);
  const changed={...bounded};
  const nested=deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,changed,
    ()=>{changed.maxVisitedCells=1;changed.maxConnectivityCells=1;},()=>{});
  expect(nested.transition).toEqual(old);
});

it("keeps the public transition's original read order for a forged sparse fragment and a second-read component getter",()=>{
  const source=ingestHvpStructuralCells("v3-parity-public-order",[{x:0,y:0,z:0,materialId:1}],materials);
  const classification=deriveStructuralComponentClassification(source,{maxVisitedCells:budgets.maxVisitedCells,
    maxComponents:budgets.maxComponents,maxIndexedFacts:budgets.maxConnectivityFacts});
  const motion={velocityMetersPerSecond:{x:0,y:0,z:0},angularVelocityRadPerSecond:{x:0,y:0,z:0}};
  const limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768};
  const sentinel=new Error("second component occupiedCells read");
  const reads:string[]=[];
  const component=classification.detachedComponents[0]!;
  const forgedComponent=Object.defineProperty({...component},"occupiedCells",{enumerable:true,get:()=>{
    reads.push("component");
    if(reads.length>1){throw sentinel;}
    return component.occupiedCells;
  }});
  // A hole: the original `.map(...).sort()` keeps it, so the equality check passes and the original
  // second component read (for the fragment content hash) is reached and throws the sentinel.
  const forgedFragment={...classification.fragments[0]!,occupiedCells:new Array(1)};
  const forged={...classification,components:[forgedComponent],detachedComponents:[forgedComponent],fragments:[forgedFragment]};
  const before=source.contentHash;
  let caught:unknown;
  try{
    deriveStructuralPhysicsTransition(source,forged as unknown as typeof classification,motion,limits,budgets);
  }catch(error){caught=error;}
  expect(caught).toBe(sentinel);
  expect(reads).toEqual(["component","component"]);
  expect(source.contentHash).toBe(before);
});

it("B1 owner hash route issues the exact child352 transition, recipe and labels of the generic route",()=>{
  const coast=prepareHvpCoastSource(materializeHvpCoastSource()),cells:HvpStructuralCell[]=[];
  for(let z=76;z<80;z+=1){for(let y=82;y<86;y+=1){for(let x=176;x<200;x+=1){
    cells.push({x,y,z,materialId:coast.readSlot(x,y,z)!});
  }}}
  const source=ingestHvpStructuralCells("v3-parity-rock",cells,materials);
  expect(source.contentHash).toBe("fnv1a64-v1:f8cfbfc86fa161d2");
  const child=prepareHvpLocalBodyCut(source,[180,84,76],"p0-box384",4,"Box").plan.parts[0]!.recipe.source;
  expect(child.contentHash).toBe("fnv1a64-v1:5b8c2e0e4b93d69c");
  const motion={velocityMetersPerSecond:{x:0,y:0,z:0},angularVelocityRadPerSecond:{x:0,y:0,z:0}};
  const limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768};
  const generic=deriveStructuralSingleComponentPhysicsPreparation(child,motion,limits,budgets,()=>{},()=>{});
  const steps=deriveStructuralSingleComponentPhysicsPreparationOwnedHashSteps(child,motion,limits,budgets,()=>{},()=>{});
  const labels:string[]=[];
  let step=steps.next();
  while(!step.done){labels.push(step.value);step=steps.next();}
  expect(step.value).toEqual(generic);
  expect(step.value.transition.contentHash).toBe("fnv1a64-v1:aa78d1531921ebf7");
  // One payload step, then many bounded hash batches (never the whole 32 KB in one step).
  expect(labels.filter(label=>label==="transitionPayload")).toHaveLength(1);
  expect(labels.filter(label=>label==="transitionHash").length).toBeGreaterThan(8);
  expect(labels.indexOf("transitionPayload")).toBeLessThan(labels.indexOf("transitionHash"));
  const recipeSteps=prepareHvpRigidBodyOwnedHashSteps(child);
  const recipeLabels=new Set<string>();
  let recipeStep=recipeSteps.next();
  while(!recipeStep.done){recipeLabels.add(recipeStep.value);recipeStep=recipeSteps.next();}
  const baseline=prepareHvpRigidBody(child);
  expect(recipeStep.value.mass).toEqual(baseline.mass);
  expect(recipeStep.value.axes).toEqual(baseline.axes);
  expect(recipeStep.value.colliders).toEqual(baseline.colliders);
  expect(recipeStep.value.source).toBe(child);
  expect([...recipeLabels].sort()).toEqual(["childClassificationCells","childHash","childTransitionPayload"]);
});

it("B1 generic public preparation keeps the old hash route when a callback patches Array[Symbol.species]",()=>{
  const source=ingestHvpStructuralCells("v3-parity-species",[
    {x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:0,y:1,z:0,materialId:1}],materials);
  const motion={velocityMetersPerSecond:{x:0,y:0,z:0},angularVelocityRadPerSecond:{x:0,y:0,z:0}};
  const limits={maxFragments:1,maxCollidersPerFragment:64,maxVoxelsPerFragment:32768};
  const baseline=deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,budgets,()=>{},()=>{});
  const original=Object.getOwnPropertyDescriptor(Array,Symbol.species)!;
  let speciesReads=0,readsAfterClassification=0;
  try{
    const patched=deriveStructuralSingleComponentPhysicsPreparation(source,motion,limits,budgets,()=>{},()=>{
      Object.defineProperty(Array,Symbol.species,{configurable:true,get(){speciesReads+=1;return Array;}});
    });
    readsAfterClassification=speciesReads;
    expect(patched).toEqual(baseline);
    expect(patched.transition.contentHash).toBe(baseline.transition.contentHash);
  }finally{
    Object.defineProperty(Array,Symbol.species,original);
  }
  // The patch is observed by the unchanged generic transition/hash work after the callback.
  expect(readsAfterClassification).toBeGreaterThan(0);
  expect(Object.getOwnPropertyDescriptor(Array,Symbol.species)).toEqual(original);
});
