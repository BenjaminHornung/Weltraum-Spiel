import type {V3} from './optics';
export interface SolidBox {id:string;min:V3;max:V3}
export function firstSolid(origin:V3,direction:V3,boxes:readonly SolidBox[],limit:number):number|null {
 if(!origin.every(Number.isFinite)||!direction.every(Number.isFinite)||Math.abs(Math.hypot(...direction)-1)>1e-8||!Number.isFinite(limit)||limit<=0)throw Error('OCCLUSION_INPUT');
 let closest=Infinity;
 for(const box of boxes){
  if(!box.id||!box.min.every(Number.isFinite)||!box.max.every(Number.isFinite)||box.min.some((v,i)=>v>=box.max[i]))throw Error('SOLID_BOX');
  let a=0,b=limit;
  for(let i=0;i<3;i++){
   if(Math.abs(direction[i])<1e-12){if(origin[i]<box.min[i]||origin[i]>box.max[i]){b=-1;break;}continue;}
   const x=(box.min[i]-origin[i])/direction[i],y=(box.max[i]-origin[i])/direction[i];
   a=Math.max(a,Math.min(x,y));b=Math.min(b,Math.max(x,y));
  }
  if(b>=a&&a<closest)closest=a;
 }
 return closest===Infinity?null:closest;
}
