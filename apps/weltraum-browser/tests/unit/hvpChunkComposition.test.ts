import {expect,it} from "vitest";
import {BufferAttribute,BufferGeometry,Mesh,MeshBasicMaterial,Raycaster,Vector3} from "three";
import {meshHvpOccupancy,type HvpCompactMesh} from "../../src/hvp/hvpCoastMesher";
import {hvpChunkCoordinates} from "../../src/hestia-prototype/terrain/terrainChunkInput";
import {composeHvpTerrainColumnSteps} from "../../src/hestia-prototype/terrain/terrainChunkComposition";

const source={originMeters:{x:-16,y:-8,z:-16},sourceDigest:"12345678"};
const chunks=()=>{
  const m=new Map<number,HvpCompactMesh>();
  for(let z=0;z<2;z+=1){for(let y=0;y<4;y+=1){for(let x=0;x<2;x+=1){
    const id=x+y*8+z*32,[cx,cy,cz]=hvpChunkCoordinates(id);
    const at=(a:number,b:number,c:number)=>b+cy*32===10&&c+cz*32===10&&(a+cx*32===31||a+cx*32===32)?2:0;
    const mesh=meshHvpOccupancy({sizeX:32,sizeY:32,sizeZ:32,cellMeters:.125,
      originMeters:{x:-16+cx*4,y:-8+cy*4,z:-16+cz*4},slotAt:at,ghostSlotAt:at},
      {maxVisitedCells:32768,maxQuads:1000,maxVertices:4000,maxIndices:6000},source.sourceDigest,"hvp-terrain-chunk-v1",{ao:true});
    // The worker decoder binds full core coverage, including empty geometry.
    const min={x:-16+cx*4,y:-8+cy*4,z:-16+cz*4};m.set(id,{...mesh,boundsMeters:{min,max:{x:min.x+4,y:min.y+4,z:min.z+4}}});
  }}}
  return m;
};
it("rebases chunk geometry into one 8m column with unchanged material/AO surfaces and collision picking",()=>{
  const parts=chunks();let quoted=0,yields=0;
  const steps=composeHvpTerrainColumnSteps(parts,source,0,n=>{quoted+=n;});let mesh!:HvpCompactMesh;
  for(;;){const step=steps.next();if(step.done){mesh=step.value;break;}yields+=1;}
  expect(parts.size).toBe(16);expect(mesh.unitFaceCount).toBe(10);expect(mesh.faceCount).toBe(10);
  expect(mesh.materialRanges).toEqual([{slot:2,startIndex:0,indexCount:60}]);
  expect(mesh.boundsMeters).toEqual({min:{x:-16,y:-8,z:-16},max:{x:-8,y:8,z:-8}});
  expect(mesh.algorithmVersion).toBe("hvp-terrain-column-v1");expect(yields).toBeGreaterThan(0);
  expect(quoted).toBeGreaterThan(mesh.positions.byteLength+mesh.normals.byteLength+mesh.colors!.byteLength+mesh.indices.byteLength);
  const geometry=new BufferGeometry();geometry.setAttribute("position",new BufferAttribute(mesh.positions,3));geometry.setIndex(new BufferAttribute(mesh.indices,1));
  const material=new MeshBasicMaterial(),node=new Mesh(geometry,material);
  try{for(const x of [-12.0625,-11.9375]){
    const hits=new Raycaster(new Vector3(x,0,-14.6875),new Vector3(0,-1,0)).intersectObject(node);
    expect(hits.length).toBeGreaterThan(0);expect(hits[0]!.point.y).toBe(-6.625);
  }}finally{geometry.dispose();material.dispose();}
});
it("rejects missing coverage and reserves before aggregate allocation",()=>{
  const missing=chunks();missing.delete(8);
  expect(()=>{const s=composeHvpTerrainColumnSteps(missing,source,0,()=>{});for(;;){if(s.next().done){break;}}}).toThrow(/coverage/i);
  const sentinel=new Error("column budget");let steps=0;
  expect(()=>{const s=composeHvpTerrainColumnSteps(chunks(),source,0,()=>{throw sentinel;});for(;;){steps+=1;if(s.next().done){break;}}}).toThrow(sentinel);
  expect(steps).toBe(1);
});
