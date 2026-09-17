import {R} from "./rapierPort";
import type {HvpCollisionSector} from "./terrainColliders";
import {validateHvpNeighborCheckpoint,type HvpNeighborCheckpoint} from "../runtime/residency";

const within=(x:number,z:number,r=0)=>x+r>=16&&x-r<48&&z+r>=-16&&z-r<16;
type CollisionEntry={mesh:HvpCollisionSector;collider?:R.Collider};
/** Owns only the eastern region's static colliders; never removes a body owner. */
export const createHvpNeighborCollision=(world:R.World,baseSectorCount:number,safeTick:()=>boolean,
  restored?:{checkpoint:HvpNeighborCheckpoint;meshes:readonly HvpCollisionSector[]},primary?:Map<number,CollisionEntry>)=>{
  let current:HvpNeighborCheckpoint|null=null,meshes:readonly HvpCollisionSector[]=[],colliders:R.Collider[]=[];
  let held=false;
  type Stage={id:string;next:HvpNeighborCheckpoint;meshes:readonly HvpCollisionSector[];colliders:R.Collider[];
    before:Map<number,R.Collider>;committed:boolean;old:HvpNeighborCheckpoint|null;oldMeshes:readonly HvpCollisionSector[];oldColliders:R.Collider[];
    oldEdge:Map<number,CollisionEntry>;newEdge:Map<number,CollisionEntry>};
  let staged:Stage|undefined;
  const validate=(value:readonly HvpCollisionSector[],resident:boolean)=>{
    if(!Array.isArray(value)||value.length!==(resident?64:0)){throw new Error("Incomplete neighbour collision coverage");}
    let bytes=0;
    for(const [i,m]of value.entries()){
      const x=16+(i%8)*4,z=-16+Math.floor(i/8)*4;
      if(!(m.vertices instanceof Float32Array)||!(m.indices instanceof Uint32Array)||m.vertices.length%3||m.indices.length%3
        ||m.indices.some((n:number)=>n>=m.vertices.length/3)
        ||m.vertices.some((n:number,k:number)=>!Number.isFinite(n)||!Number.isInteger(n*8)||n<([x,-8,z][k%3]!)||n>([x+4,8,z+4][k%3]!))){throw new Error("Invalid neighbour collision geometry");}
      bytes+=m.vertices.byteLength+m.indices.byteLength;
    }
    if(bytes>8*1024*1024){throw new Error("Neighbour collision payload budget");}
    return bytes;
  };
  const pinned=(player?:Readonly<{x:number;y:number;z:number}>):boolean=>{
    if(player&&within(player.x,player.z,.3)){return true;}
    let result=false;
    world.bodies.forEach(body=>{if(!body.isDynamic()||!body.isEnabled()){return;}
      for(let i=0;i<body.numColliders();i+=1){const c=body.collider(i);if(c.isSensor()){continue;}
        const shape=c.shape;if(shape.type!==R.ShapeType.Cuboid){result=true;continue;}
        const h=(shape as R.Cuboid).halfExtents,q=c.rotation(),p=c.translation();
        const rx=Math.abs(1-2*(q.y*q.y+q.z*q.z))*h.x+Math.abs(2*(q.x*q.y-q.z*q.w))*h.y+Math.abs(2*(q.x*q.z+q.y*q.w))*h.z;
        const rz=Math.abs(2*(q.x*q.z-q.y*q.w))*h.x+Math.abs(2*(q.y*q.z+q.x*q.w))*h.y+Math.abs(1-2*(q.x*q.x+q.y*q.y))*h.z;
        if(p.x+rx>=16&&p.x-rx<48&&p.z+rz>=-16&&p.z-rz<16){result=true;}
      }
    });return result;
  };
  const cleanup=(s:Stage)=>{
    if([...s.before].some(([h,c])=>world.getCollider(h)!==c)){throw new Error("Old neighbour membership missing");}
    for(const c of s.oldColliders){c.setEnabled(true);}
    for(const [i,e]of s.oldEdge){e.collider?.setEnabled(true);primary!.set(i,e);}
    const added:R.Collider[]=[];world.colliders.forEach(c=>{if(!s.before.has(c.handle)){added.push(c);}});
    for(const c of added){world.removeCollider(c,true);}
    if(world.colliders.len()!==s.before.size){throw new Error("Neighbour rollback not proven");}
    current=s.old;meshes=s.oldMeshes;colliders=s.oldColliders;staged=undefined;world.updateSceneQueries();
  };
  const requireStage=(id:string)=>{if(!staged||staged.id!==id){throw new Error("Stale neighbour transaction");}return staged;};
  if(restored){
    const c=validateHvpNeighborCheckpoint(restored.checkpoint);if(c.baseSectorCount!==baseSectorCount){throw new Error("Neighbour sector ownership mismatch");}
    validate(restored.meshes,c.resident);current=Object.freeze({...c});meshes=restored.meshes;
    if(world.colliders.len()+meshes.filter(m=>m.indices.length>0).length>4096){throw new Error("Global collider budget");}
    for(const m of meshes){if(m.indices.length){colliders.push(world.createCollider(R.ColliderDesc.trimesh(m.vertices,m.indices).setFriction(.8).setRestitution(0)));}}
  }
  return {
    get busy(){return held||staged!==undefined;},get held(){return held;},pinned,
    checkpoint:()=>current,meshes:()=>meshes,
    read:()=>Object.freeze({checkpoint:current,state:held?"RecoveryHold":staged?(staged.committed?"CommittedHeld":"PreparedHeld"):"Idle",
      collisionReady:current?.resident===true,colliders:colliders.length,bytes:meshes.reduce((n,m)=>n+m.vertices.byteLength+m.indices.byteLength,0)}),
    prepare(id:string,next:HvpNeighborCheckpoint,value:readonly HvpCollisionSector[],player?:Readonly<{x:number;y:number;z:number}>,edge:readonly {index:number;mesh:HvpCollisionSector}[]=[]):void{
      if(held||staged||!safeTick()){throw new Error("Neighbour requires an idle held World");}
      validateHvpNeighborCheckpoint(next);
      if(!/^[A-Za-z0-9:_-]{1,128}$/.test(id)||next.baseSectorCount!==baseSectorCount||next.epoch<=(current?.epoch??0)){throw new Error("Stale neighbour generation");}
      if(!next.resident&&pinned(player)){throw new Error("Neighbour pinned by a live player/body");}
      validate(value,next.resident);
      const oldEdge=new Map<number,CollisionEntry>();
      if(edge.length!==(primary?8:0)){throw new Error("Missing primary seam collision");}
      for(const {index,mesh:m}of edge){
        const z=-16+Math.floor(index/8)*4;
        if(!Number.isSafeInteger(index)||index<0||index>=64||index%8!==7||oldEdge.has(index)||!primary?.has(index)
          ||!(m.vertices instanceof Float32Array)||!(m.indices instanceof Uint32Array)||m.vertices.length%3||m.indices.length%3
          ||m.indices.some(n=>n>=m.vertices.length/3)||m.vertices.some((n,k)=>!Number.isFinite(n)||!Number.isInteger(n*8)||n<([12,-8,z][k%3]!)||n>([16,8,z+4][k%3]!))){throw new Error("Invalid primary seam collision");}
        oldEdge.set(index,primary.get(index)!);
      }
      if(world.colliders.len()+value.filter(m=>m.indices.length>0).length+edge.filter(e=>e.mesh.indices.length>0).length>4096){throw new Error("Global collider budget");}
      const before=new Map<number,R.Collider>();world.colliders.forEach(c=>before.set(c.handle,c));
      const s:Stage={id,next:Object.freeze({...next}),meshes:value,colliders:[],before,committed:false,old:current,oldMeshes:meshes,oldColliders:colliders,oldEdge,newEdge:new Map()};staged=s;
      try{
        for(const m of value){if(m.indices.length){s.colliders.push(world.createCollider(R.ColliderDesc.trimesh(m.vertices,m.indices).setFriction(.8).setRestitution(0).setEnabled(false)));}}
        for(const {index,mesh}of edge){s.newEdge.set(index,{mesh,collider:mesh.indices.length?world.createCollider(R.ColliderDesc.trimesh(mesh.vertices,mesh.indices).setFriction(.8).setRestitution(0).setEnabled(false)):undefined});}
      }
      catch(error){try{cleanup(s);}catch{held=true;}throw new Error(`${held?"RecoveryHold: ":""}${String(error)}`);}
    },
    commit(id:string):void{const s=requireStage(id);for(const c of s.oldColliders){c.setEnabled(false);}for(const c of s.colliders){c.setEnabled(true);}
      for(const e of s.oldEdge.values()){e.collider?.setEnabled(false);}for(const [i,e]of s.newEdge){e.collider?.setEnabled(true);primary!.set(i,e);}
      current=s.next;meshes=s.meshes;colliders=s.colliders;s.committed=true;world.updateSceneQueries();},
    rollback(id:string):void{const s=requireStage(id);try{cleanup(s);}catch(error){held=true;throw new Error(`RecoveryHold: ${String(error)}`);}},
    finalize(id:string):void{const s=requireStage(id);if(!s.committed){throw new Error("Neighbour not committed");}
      try{for(const c of s.oldColliders){world.removeCollider(c,true);}for(const e of s.oldEdge.values()){if(e.collider){world.removeCollider(e.collider,true);}}
        const oldEdges=[...s.oldEdge.values()].filter(e=>e.collider).length,newEdges=[...s.newEdge.values()].filter(e=>e.collider).length;
        if(world.colliders.len()!==s.before.size-s.oldColliders.length-oldEdges+s.colliders.length+newEdges){throw new Error("Neighbour retirement not proven");}staged=undefined;}
      catch(error){held=true;throw new Error(`RecoveryHold: ${String(error)}`);}}
  };
};
