// Portable, unchanged RD02 unit-face projection, shared by Node export and the lab workbench.
function at(volume, x, y, z) {
  const [sx, sy, sz] = volume.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
  return volume.slots[x + sx * (y + sy * z)];
}
function faces(volume, visit) {
  const [sx, sy, sz] = volume.dimensions;
  for (let z=0;z<sz;z++) for(let y=0;y<sy;y++) for(let x=0;x<sx;x++) {
    const slot=at(volume,x,y,z);if(!slot)continue;
    for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
      const neighbor=[x,y,z];neighbor[axis]+=sign;
      if(!at(volume,...neighbor))visit(slot,x,y,z,axis,sign);
    }
  }
}
export function faceCounts(volume) {
  const counts=new Map();faces(volume,slot=>counts.set(slot,(counts.get(slot)??0)+1));return counts;
}
// ponytail: unit faces for bounded lab controls; greedy remains a separately measured candidate.
export function meshUnitFaces(volume,quantum,counts=faceCounts(volume)) {
  const meshes=new Map([...counts].map(([slot,count])=>[slot,{id:`${volume.id}-slot-${slot}`,
    materialId:volume.materialIds[slot-1],positions:new Float32Array(count*12),normals:new Float32Array(count*12),indices:new Uint32Array(count*6),offset:0}]));
  faces(volume,(slot,x,y,z,axis,sign)=>{
    const mesh=meshes.get(slot),first=mesh.offset*4,u=(axis+1)%3,v=(axis+2)%3;
    const corners=sign===1?[[0,0],[1,0],[1,1],[0,1]]:[[0,0],[0,1],[1,1],[1,0]];
    for(let i=0;i<4;i++){
      const p=[x,y,z];p[axis]+=sign===1?1:0;p[u]+=corners[i][0];p[v]+=corners[i][1];
      for(let j=0;j<3;j++){mesh.positions[(first+i)*3+j]=volume.originMeters[j]+p[j]*quantum;mesh.normals[(first+i)*3+j]=axis===j?sign:0;}
    }
    mesh.indices.set([first,first+1,first+2,first,first+2,first+3],mesh.offset*6);mesh.offset++;
  });return [...meshes.values()];
}
