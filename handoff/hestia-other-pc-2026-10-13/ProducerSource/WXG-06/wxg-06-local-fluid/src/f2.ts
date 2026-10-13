import {N,HZ,MAX_TICKS,MAX_EVENTS,Config,Event,Metrics,Snapshot,Vec,validateConfig,validateEvent,canonical,immutable,finite,tick,vector,index,center,mass,segmentDistance,balance,allocationBytes} from './contracts.js';
const F=(N+1)*N*N;
const face=(a:number,p:readonly number[]):number=>p[a]+(N+1)*(p[(a+1)%3]+N*p[(a+2)%3]);
class F2 {
 private density:Float64Array;private temperature:Float64Array;private rhoNext:Float64Array;private heatNext:Float64Array;
 private u:Float64Array[];private adv:Float64Array[];private projectionInput:Float64Array[];private p:Float64Array;private r:Float64Array;private d:Float64Array;private q:Float64Array;private div:Float64Array;private mask:Uint8Array;
 private current:number;private status:'Active'|'Invalidated'|'Evicted'='Active';private events:Event[]=[];private cursor=0;private origin:Vec=[0,0,0];private last:Metrics;
 constructor(private readonly c:Config){
  this.current=c.background.tick;this.mask=Uint8Array.from(c.obstacle.coverage);this.density=new Float64Array(N**3);this.temperature=new Float64Array(N**3);this.rhoNext=new Float64Array(N**3);this.heatNext=new Float64Array(N**3);
  this.u=Array.from({length:3},()=>new Float64Array(F));this.adv=Array.from({length:3},()=>new Float64Array(F));this.projectionInput=Array.from({length:3},()=>new Float64Array(F));this.p=new Float64Array(N**3);this.r=new Float64Array(N**3);this.d=new Float64Array(N**3);this.q=new Float64Array(N**3);this.div=new Float64Array(N**3);
  for(let p=0;p<N**3;p++){this.density[p]=this.mask[p]===0?c.densityKgPerM3:0;this.temperature[p]=c.background.temperatureK;}
  for(let a=0;a<3;a++)this.u[a].fill(this.wind()[a]);this.boundaries(this.u);this.last=this.metrics();this.project(this.last);
 }
 private wind():Vec{return this.c.controlWind??this.c.background.wind;}
 private free(p:readonly number[]):boolean{return p.every(x=>x>=0&&x<N)&&this.mask[index(p[0],p[1],p[2])]===0;}
 private faces(fn:(a:number,p:number[],f:number)=>void):void {for(let a=0;a<3;a++)for(let z=0;z<N;z++)for(let y=0;y<N;y++)for(let x=0;x<=N;x++){const p=[0,0,0];p[a]=x;p[(a+1)%3]=y;p[(a+2)%3]=z;fn(a,p,face(a,p));}}
 private open(a:number,p:readonly number[]):boolean {const l=[...p];l[a]--;return (p[a]===0||this.free(l))&&(p[a]===N||this.free(p));}
 private boundaries(v:Float64Array[]):void {this.faces((a,p,f)=>{if(!this.open(a,p))v[a][f]=0;else if(p[a]===0||p[a]===N)v[a][f]=this.wind()[a];});}
 private metrics():Metrics {const m=mass(this.density,this.c);return {beforeKg:m,afterKg:m,sourceKg:0,boundaryKg:0,decayKg:0,redistributedKg:0,balanceErrorKg:0,divergenceBefore:0,divergenceAfter:0,projectionIterations:0,maxCfl:0,thermalBoundaryKCell:0,thermalSourceKCell:0,thermalDecayKCell:0,thermalBalanceErrorKCell:0};}
 private divergence():number {let sum=0,count=0;const h=this.c.cellMeters;for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){const p=[i,j,k],cell=index(i,j,k);if(this.mask[cell]!==0){this.div[cell]=0;continue;}let v=0;for(let a=0;a<3;a++){const right=[...p];right[a]++;v+=(this.u[a][face(a,right)]-this.u[a][face(a,p)])/h;}this.div[cell]=v;sum+=v*v;count++;}return Math.sqrt(sum/count);}
 private multiply(v:Float64Array,out:Float64Array):void {const h2=this.c.cellMeters**2;for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){const p=[i,j,k],cell=index(i,j,k);if(this.mask[cell]!==0){out[cell]=0;continue;}let s=0;for(let a=0;a<3;a++)for(const sign of [-1,1]){const n=[...p];n[a]+=sign;if(this.free(n))s+=(v[cell]-v[index(n[0],n[1],n[2])])/h2;}out[cell]=s;}}
 private dot(a:Float64Array,b:Float64Array):number {let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
 private project(m:Metrics):void {
  this.projectionInput.forEach((v,a)=>v.set(this.u[a]));
  m.divergenceBefore=this.divergence();m.divergenceAfter=m.divergenceBefore;if(m.divergenceBefore<=1e-8)return;
  let compatibility=0;for(const x of this.div)compatibility+=x;if(Math.abs(compatibility)>1e-7)throw Error('PROJECTION_INCOMPATIBLE_BOUNDARY');
  this.p.fill(0);for(let i=0;i<this.r.length;i++)this.d[i]=this.r[i]=-this.div[i];let rr=this.dot(this.r,this.r),initial=rr;
  for(let step=0;step<256&&rr>initial*1e-8;step++){
   this.multiply(this.d,this.q);const dq=this.dot(this.d,this.q);if(dq<=0||!Number.isFinite(dq))throw Error('PROJECTION_BREAKDOWN');const alpha=rr/dq;
   for(let i=0;i<this.p.length;i++){this.p[i]+=alpha*this.d[i];this.r[i]-=alpha*this.q[i];}const next=this.dot(this.r,this.r),beta=next/rr;for(let i=0;i<this.d.length;i++)this.d[i]=this.r[i]+beta*this.d[i];rr=next;m.projectionIterations=step+1;
  }
  this.faces((a,p,f)=>{if(p[a]>0&&p[a]<N&&this.open(a,p)){const l=[...p];l[a]--;this.u[a][f]-=(this.p[index(p[0],p[1],p[2])]-this.p[index(l[0],l[1],l[2])])/this.c.cellMeters;}});
  this.boundaries(this.u);m.divergenceAfter=this.divergence();if(m.divergenceAfter>m.divergenceBefore*0.1+1e-8)throw Error('PROJECTION_NOT_CONVERGED');
 }
 private sample(a:number,pos:readonly number[]):number {
  const v=pos.map((x,i)=>(x-this.c.origin[i])/this.c.cellMeters-(i===a?0:0.5));const max=v.map((_,i)=>i===a?N:N-1),l=v.map((x,i)=>Math.max(0,Math.min(max[i],Math.floor(x)))),t=v.map((x,i)=>Math.max(0,Math.min(1,x-l[i])));
  const value=(x:number,y:number,z:number):number=>this.u[a][face(a,[Math.min(max[0],l[0]+x),Math.min(max[1],l[1]+y),Math.min(max[2],l[2]+z)])];
  const lerp=(x:number,y:number,t:number):number=>x+(y-x)*t;
  return lerp(lerp(lerp(value(0,0,0),value(1,0,0),t[0]),lerp(value(0,1,0),value(1,1,0),t[0]),t[1]),lerp(lerp(value(0,0,1),value(1,0,1),t[0]),lerp(value(0,1,1),value(1,1,1),t[0]),t[1]),t[2]);
 }
 private traceFree(start:readonly number[],end:readonly number[]):boolean {const steps=Math.max(1,Math.ceil(Math.hypot(...start.map((x,i)=>x-end[i]))/this.c.cellMeters*2));for(let s=0;s<=steps;s++){const p=start.map((x,i)=>Math.floor((x+(end[i]-x)*s/steps-this.c.origin[i])/this.c.cellMeters));if(p.some(x=>x<0||x>=N))continue;if(!this.free(p))return false;}return true;}
 private advectVelocity():void {
  this.faces((a,p,f)=>{if(!this.open(a,p)){this.adv[a][f]=0;return;}const at=p.map((x,i)=>this.c.origin[i]+(x+(i===a?0:0.5))*this.c.cellMeters),back=at.map((x,i)=>x-this.sample(i,at)/HZ);this.adv[a][f]=this.traceFree(at,back)?this.sample(a,back):this.u[a][f];});
  const old=this.u;this.u=this.adv;this.adv=old;this.boundaries(this.u);
 }
 private source(e:Event,m:Metrics):void {
  const cells:number[]=[];for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(this.free([i,j,k])&&segmentDistance(center(this.c,i,j,k),e.from,e.to)<e.radiusMeters)cells.push(index(i,j,k));
  if(!cells.length)return;const kg=e.tracerKgPerSecond/HZ;for(const p of cells){this.density[p]+=kg/cells.length/this.c.cellMeters**3;const heat=e.heatKPerSecond/HZ/cells.length;this.temperature[p]+=heat;m.thermalSourceKCell+=heat;}m.sourceKg+=kg;
  const direction=e.to.map((x,i)=>x-e.from[i]),len=Math.hypot(...direction);this.faces((a,p,f)=>{if(!this.open(a,p)||p[a]===0||p[a]===N)return;const at=p.map((x,i)=>this.c.origin[i]+(x+(i===a?0:0.5))*this.c.cellMeters),d=segmentDistance(at as unknown as Vec,e.from,e.to);if(d>=e.radiusMeters)return;
   if(e.kind==='PressureImpulse'){const radial=at.map((x,i)=>x-e.from[i]),r=Math.hypot(...radial);if(r>0)this.u[a][f]+=e.speedMps/HZ*radial[a]/r*(1-r/e.radiusMeters);}else if(len>0)this.u[a][f]+=e.speedMps/HZ*direction[a]/len*(1-d/e.radiusMeters);
  });
 }
 private transport(m:Metrics):void {
  this.rhoNext.set(this.density);for(let p=0;p<N**3;p++)this.heatNext[p]=this.temperature[p]-this.c.background.temperatureK;
  const dt=1/HZ,h=this.c.cellMeters;let maxCfl=0;
  for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){if(!this.free([i,j,k]))continue;const p=[i,j,k];let sum=0;for(let a=0;a<3;a++){const r=[...p];r[a]++;sum+=Math.max(0,-this.u[a][face(a,p)])+Math.max(0,this.u[a][face(a,r)]);}maxCfl=Math.max(maxCfl,sum*dt/h);}
  m.maxCfl=maxCfl;if(maxCfl>0.8)throw Error('CFL_BUDGET');
  this.faces((a,p,f)=>{if(!this.open(a,p))return;const l=[...p];l[a]--;const li=p[a]===0?-1:index(l[0],l[1],l[2]),ri=p[a]===N?-1:index(p[0],p[1],p[2]),u=this.u[a][f];
   const donor=u>=0?li:ri,rho=donor<0?this.c.densityKgPerM3:this.density[donor],heat=donor<0?0:this.temperature[donor]-this.c.background.temperatureK,dr=dt/h*u*rho,dh=dt/h*u*heat;
   if(li>=0){this.rhoNext[li]-=dr;this.heatNext[li]-=dh;}else{m.boundaryKg+=dr*h**3;m.thermalBoundaryKCell+=dh;}
   if(ri>=0){this.rhoNext[ri]+=dr;this.heatNext[ri]+=dh;}else{m.boundaryKg-=dr*h**3;m.thermalBoundaryKCell-=dh;}
  });
  const decay=Math.exp(-this.c.decayPerSecond*dt);for(let p=0;p<N**3;p++){const before=this.rhoNext[p],base=this.mask[p]===0?this.c.densityKgPerM3:0;this.density[p]=base+(before-base)*decay;m.decayKg+=(this.density[p]-before)*h**3;this.temperature[p]=this.c.background.temperatureK+this.heatNext[p]*decay;m.thermalDecayKCell+=this.heatNext[p]*(decay-1);finite(this.density[p],0,1,'density');finite(this.temperature[p],150,1000,'temperature');}
 }
 private active():void{if(this.status!=='Active')throw Error(this.status);}
 enqueue(raw:Event):'ADMITTED'|'DUPLICATE'|'DISABLED' {this.active();const old=this.events.find(e=>e.id===raw.id);if(old){if(canonical(old)!==canonical(raw))throw Error('EVENT_CONFLICT');return 'DUPLICATE';}const e=validateEvent(raw,this.c,this.current);if(e.kind==='Nozzle'&&!e.active)return 'DISABLED';if(this.events.length>=MAX_EVENTS)throw Error('EVENT_BUDGET');this.events.push(e);this.events.sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id));return 'ADMITTED';}
 step(at:number):void {
  this.active();tick(at);if(at!==this.current+1||at>this.c.background.tick+MAX_TICKS)throw Error('STEP_TICK');const m=this.metrics();let heatBefore=0;for(const t of this.temperature)heatBefore+=t-this.c.background.temperatureK;
  try{for(const e of this.events.filter(e=>e.tick<at&&e.tick+e.durationTicks>=at))this.source(e,m);this.advectVelocity();this.project(m);for(const v of this.u)for(const x of v)finite(x,-100,100,'velocity');this.transport(m);m.afterKg=mass(this.density,this.c);m.balanceErrorKg=balance(m.beforeKg,m.afterKg,m.sourceKg,m.boundaryKg,m.decayKg);let heatAfter=0;for(const t of this.temperature)heatAfter+=t-this.c.background.temperatureK;m.thermalBalanceErrorKCell=heatAfter-heatBefore-m.thermalSourceKCell-m.thermalBoundaryKCell-m.thermalDecayKCell;if(Math.abs(m.thermalBalanceErrorKCell)>1e-7)throw Error('THERMAL_BALANCE');}
  catch(e){this.status='Invalidated';throw e;}
  this.last=m;this.current=at;this.cursor=this.events.filter(e=>e.tick<at).length;
 }
 invalidate(revision:number):void{this.active();tick(revision);if(revision<=this.c.obstacle.revision)throw Error('REVISION_NOT_NEW');this.status='Invalidated';}
 rebase(origin:Vec):void{vector(origin);this.origin=immutable([...origin] as unknown as Vec);}
 evict():void{this.active();this.status='Evicted';this.density=this.temperature=this.rhoNext=this.heatNext=this.p=this.r=this.d=this.q=this.div=new Float64Array(0);this.u=[];this.adv=[];this.projectionInput=[];this.mask=new Uint8Array(0);}
 snapshot():Snapshot{return immutable({mode:'F2',status:this.status,tick:this.current,frameId:this.c.background.frameId,w1SnapshotId:this.c.background.snapshotId,obstacleDigest:this.c.obstacle.digest,allocatedBytes:this.status==='Evicted'?0:allocationBytes(),density:Array.from(this.density),temperature:Array.from(this.temperature),velocity:this.u.map(v=>Array.from(v)),projectionInputVelocity:this.projectionInput.map(v=>Array.from(v)),metrics:{...this.last},events:[...this.events],eventCursor:this.cursor,authority:'VisualOnly',presentationOrigin:this.origin});}
}
export async function createF2(c:Config):Promise<F2>{return new F2(await validateConfig(c));}
