import {expect,it} from "vitest";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {reconstructStructuralObjectInternal} from "../../src/voxel/structural/model";
import {mapStructuralAuthorPointToWorld} from "../../src/voxel/structural";
import {hvpObjectLocalCenterOfMass,prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidRecipe";
import {prepareHvpLocalBodyCut,readHvpBodyCells} from "../../src/hestia-prototype/physics/bodyCutPlan";
import {meshHvpBodyCells} from "../../src/hestia-prototype/presentation/terrainFragment";
import {meshHvpOwnedBodyCellsSteps} from "../../src/hestia-prototype/presentation/bodyMeshAdmission";
import {pickHvpCell} from "../../src/hestia-prototype/terrain/picking";

const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"wood",destructible:true,tags:null}];
const identity={x:0,y:0,z:0,w:1};
const drain=<T>(steps:Generator<string,T,unknown>):T=>{for(;;){const s=steps.next();if(s.done){return s.value;}}};

it.each([-16,16,0])("keeps global mass and local cut/render coordinates distinct at origin %s",(originX)=>{
  const seed=ingestHvpStructuralCells("negative-frame-"+originX,[{x:originX,y:0,z:0,materialId:1},{x:originX+1,y:0,z:0,materialId:1}],materials);
  const source=reconstructStructuralObjectInternal({objectId:seed.objectId,
    frame:{...seed.frame,objectOriginQuantum:{x:originX,y:0,z:0}},source:seed.source,materials:seed.materials,
    bricks:seed.bricks,anchors:seed.anchors,joints:seed.joints,objectRevision:seed.objectRevision,editRevision:seed.editRevision,commandEvidence:seed.commandEvidence});
  const recipe=prepareHvpRigidBody(source),global=recipe.mass.centerOfMassMeters!;
  expect(recipe.mass.totalMassKg).toBe(2);
  expect(global).toEqual({x:originX*.125+.125,y:.0625,z:.0625});
  const local=hvpObjectLocalCenterOfMass(source,global);
  expect(local).toEqual({x:.125,y:.0625,z:.0625});
  if(originX===0){expect(local).toBe(global);}
  else{expect(local).not.toBe(global);}
  expect(recipe.mass.centerOfMassMeters).toBe(global);
  expect(readHvpBodyCells(source)).toEqual([{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1}]);

  const contact={x:originX*.125+.0625,y:.0625,z:.0625};
  const picked=pickHvpCell({sizeX:2,sizeY:1,sizeZ:1,cellMeters:.125,originMeters:{x:0,y:0,z:0},
    readSlot:(x,y,z)=>y===0&&z===0&&(x===0||x===1)?1:0},
    [contact.x-global.x+local.x,contact.y-global.y+local.y,contact.z-global.z+local.z],[0,0,1],.01);
  expect(picked.kind).toBe("Hit");
  if(picked.kind!=="Hit"){throw new Error("Expected the first local cell");}
  expect(picked.cell).toEqual([0,0,0]);

  const cut=prepareHvpLocalBodyCut(source,[0,0,0],"negative-frame-cut-"+originX,1,"Box");
  expect(cut.plan.preCutCenter).toEqual(local);
  expect(cut.plan.parts).toHaveLength(1);
  expect(cut.plan.removedMassKg).toBe(1);
  const child=cut.plan.parts[0]!;
  const childWorld=mapStructuralAuthorPointToWorld(identity,global,cut.plan.preCutCenter,child.recipe.mass.centerOfMassMeters!);
  const removedWorld=mapStructuralAuthorPointToWorld(identity,global,cut.plan.preCutCenter,cut.removedMass.centerOfMassMeters!);
  expect(childWorld.x).toBe(originX*.125+.1875);
  expect(removedWorld.x).toBe(originX*.125+.0625);
  if(originX===-16){expect(childWorld.x).toBe(-1.8125);expect(removedWorld.x).toBe(-1.9375);}

  const cells=readHvpBodyCells(source),mesh=meshHvpBodyCells(cells,local,source.contentHash);
  const owned=drain(meshHvpOwnedBodyCellsSteps(cells,local,source.contentHash));
  expect(owned).toEqual(mesh);
  expect(mesh.boundsMeters.min.x).toBe(-.125);
  expect(mesh.boundsMeters.max.x).toBe(.125);
});
