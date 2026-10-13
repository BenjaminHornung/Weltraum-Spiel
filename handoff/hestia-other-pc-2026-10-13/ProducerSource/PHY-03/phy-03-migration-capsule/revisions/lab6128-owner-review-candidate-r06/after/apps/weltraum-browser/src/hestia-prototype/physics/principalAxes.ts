import type { StructuralInertiaTensor } from "../../voxel/structural";

/** Deterministic symmetric 3x3 Jacobi solve; local tensor, never mesh bounds. */
export const hvpPrincipalAxes = (tensor: StructuralInertiaTensor) => {
  const original = [[tensor.xx,tensor.xy,tensor.xz],[tensor.xy,tensor.yy,tensor.yz],[tensor.xz,tensor.yz,tensor.zz]];
  if (original.some(row => row.some(value => !Number.isFinite(value)))) { throw new Error("Inertia must be finite"); }
  const scale = Math.max(...original.flat().map(Math.abs));
  if (!(scale > 0)) { throw new Error("Inertia must be positive definite"); }
  const a = original.map(row => row.map(value => value/scale));
  const v = [[1,0,0],[0,1,0],[0,0,1]];
  for (let iteration=0; iteration<32; iteration+=1) {
    let p=0; let q=1;
    for (const [i,j] of [[0,2],[1,2]]) {
      if (Math.abs(a[i!]![j!]!) > Math.abs(a[p]![q]!)) { p=i!;q=j!; }
    }
    if (Math.abs(a[p]![q]!) < 1e-14) { break; }
    const angle=.5*Math.atan2(2*a[p]![q]!,a[q]![q]!-a[p]![p]!);
    const c=Math.cos(angle);const s=Math.sin(angle);
    const pp=a[p]![p]!;const qq=a[q]![q]!;const pq=a[p]![q]!;
    a[p]![p]=c*c*pp-2*s*c*pq+s*s*qq;
    a[q]![q]=s*s*pp+2*s*c*pq+c*c*qq;
    a[p]![q]=0;a[q]![p]=0;
    for(let k=0;k<3;k+=1) {
      if(k!==p&&k!==q) {
        const kp=a[k]![p]!;const kq=a[k]![q]!;
        a[k]![p]=a[p]![k]=c*kp-s*kq;a[k]![q]=a[q]![k]=s*kp+c*kq;
      }
      const vp=v[k]![p]!;const vq=v[k]![q]!;
      v[k]![p]=c*vp-s*vq;v[k]![q]=s*vp+c*vq;
    }
  }
  const order=[0,1,2].sort((i,j)=>a[i]![i]!-a[j]![j]!||i-j);
  const moments=order.map(i=>a[i]![i]!);
  if(moments.some(value=>!(value>0)||!Number.isFinite(value*scale))) { throw new Error("Inertia must be positive definite"); }
  const columns=order.map(i=>[v[0]![i]!,v[1]![i]!,v[2]![i]!]);
  for(const column of columns) {
    const pivot=[0,1,2].sort((i,j)=>Math.abs(column[j]!)-Math.abs(column[i]!)||i-j)[0]!;
    if(column[pivot]!<0) { for(let i=0;i<3;i+=1) { column[i]=-column[i]!; } }
  }
  const [u,w,n]=columns as [number[],number[],number[]];
  const cross=[u[1]!*w[2]!-u[2]!*w[1]!,u[2]!*w[0]!-u[0]!*w[2]!,u[0]!*w[1]!-u[1]!*w[0]!];
  if(cross.reduce((sum,value,i)=>sum+value*n[i]!,0)<0) { for(let i=0;i<3;i+=1) { n[i]=-n[i]!; } }
  let residual=0;
  for(let i=0;i<3;i+=1) { for(let j=0;j<3;j+=1) {
    const reconstructed=columns.reduce((sum,column,k)=>sum+column[i]!*moments[k]!*column[j]!,0);
    residual=Math.max(residual,Math.abs(reconstructed-original[i]![j]!/scale));
  } }
  if(residual>1e-10) { throw new Error("Principal inertia reconstruction failed"); }
  const m=Array.from({length:3},(_,i)=>columns.map(column=>column[i]!));
  let x:number;let y:number;let z:number;let qw:number;
  const trace=m[0]![0]!+m[1]![1]!+m[2]![2]!;
  if(trace>0) {
    const s=2*Math.sqrt(trace+1);qw=s/4;x=(m[2]![1]!-m[1]![2]!)/s;y=(m[0]![2]!-m[2]![0]!)/s;z=(m[1]![0]!-m[0]![1]!)/s;
  } else {
    const i=[0,1,2].sort((l,r)=>m[r]![r]!-m[l]![l]!||l-r)[0]!;
    const j=(i+1)%3;const k=(i+2)%3;
    const s=2*Math.sqrt(1+m[i]![i]!-m[j]![j]!-m[k]![k]!);
    const vector=[0,0,0];vector[i]=s/4;vector[j]=(m[j]![i]!+m[i]![j]!)/s;vector[k]=(m[k]![i]!+m[i]![k]!)/s;
    [x,y,z]=vector as [number,number,number];qw=(m[k]![j]!-m[j]![k]!)/s;
  }
  const norm=Math.hypot(x,y,z,qw);const sign=qw<0?-1:1;
  if(!Number.isFinite(norm)||norm<.999999) { throw new Error("Invalid principal frame"); }
  return Object.freeze({ principalInertia:Object.freeze({x:moments[0]!*scale,y:moments[1]!*scale,z:moments[2]!*scale}),
    frame:Object.freeze({x:sign*x/norm,y:sign*y/norm,z:sign*z/norm,w:sign*qw/norm}),residual });
};
