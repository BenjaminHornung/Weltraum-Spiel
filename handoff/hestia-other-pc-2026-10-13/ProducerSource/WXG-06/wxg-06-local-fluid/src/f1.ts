import {N,HZ,MAX_TICKS,MAX_EVENTS,Config,Event,Metrics,Snapshot,Vec,validateConfig,validateEvent,canonical,immutable,finite,tick,vector,index,center,mass,segmentDistance,balance} from './contracts.js';
class F1 {
 private density:Float64Array;private temperature:Float64Array;private current:number;private status:'Active'|'Invalidated'|'Evicted'='Active';private events:Event[]=[];private cursor=0;private origin:Vec=[0,0,0];private last:Metrics;
 constructor(private readonly c:Config){this.current=c.background.tick;this.density=new Float64Array(N**3);this.temperature=new Float64Array(N**3);for(let p=0;p<N**3;p++){this.density[p]=c.obstacle.coverage[p]===0?c.densityKgPerM3:0;this.temperature[p]=c.background.temperatureK;}this.last=this.metrics();}
 private metrics():Metrics{return {beforeKg:mass(this.density,this.c),afterKg:mass(this.density,this.c),sourceKg:0,boundaryKg:0,decayKg:0,redistributedKg:0,balanceErrorKg:0,divergenceBefore:null,divergenceAfter:null,projectionIterations:null,maxCfl:null,thermalBoundaryKCell:0,thermalSourceKCell:0,thermalDecayKCell:0,thermalBalanceErrorKCell:0};}
 enqueue(raw:Event):'ADMITTED'|'DUPLICATE'|'DISABLED' {this.active();const old=this.events.find(e=>e.id===raw.id);if(old){if(canonical(old)!==canonical(raw))throw Error('EVENT_CONFLICT');return 'DUPLICATE';}const e=validateEvent(raw,this.c,this.current);if(e.kind==='Nozzle'&&!e.active)return 'DISABLED';if(this.events.length>=MAX_EVENTS)throw Error('EVENT_BUDGET');this.events.push(e);this.events.sort((a,b)=>a.tick-b.tick||a.id.localeCompare(b.id));return 'ADMITTED';}
 private active():void{if(this.status!=='Active')throw Error(this.status);}
 step(at:number):void {
  this.active();tick(at);if(at!==this.current+1||at>this.c.background.tick+MAX_TICKS)throw Error('STEP_TICK');const m=this.metrics(),dt=1/HZ,decay=Math.exp(-this.c.decayPerSecond*dt);
  let heatBefore=0;for(const t of this.temperature)heatBefore+=t-this.c.background.temperatureK;
  try {
  for(const e of this.events.filter(e=>e.tick<at&&e.tick+e.durationTicks>=at)){
   const core:number[]=[],shell:number[]=[];for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){const p=index(i,j,k);if(this.c.obstacle.coverage[p]!==0)continue;const d=segmentDistance(center(this.c,i,j,k),e.from,e.to);if(d<e.radiusMeters)core.push(p);else if(d<2*e.radiusMeters)shell.push(p);}
   if(core.length===0)continue;let moved=0;if(shell.length){for(const p of core){const q=this.density[p]*0.1;this.density[p]-=q;moved+=q;}for(const p of shell)this.density[p]+=moved/shell.length;m.redistributedKg+=moved*this.c.cellMeters**3;}
   const kg=e.tracerKgPerSecond*dt;for(const p of core){this.density[p]+=kg/core.length/this.c.cellMeters**3;const heat=e.heatKPerSecond*dt/core.length;this.temperature[p]+=heat;m.thermalSourceKCell+=heat;}m.sourceKg+=kg;
  }
  for(let p=0;p<N**3;p++){const base=this.c.obstacle.coverage[p]===0?this.c.densityKgPerM3:0;const old=this.density[p];this.density[p]=base+(old-base)*decay;m.decayKg+=(this.density[p]-old)*this.c.cellMeters**3;const t=this.temperature[p];this.temperature[p]=this.c.background.temperatureK+(t-this.c.background.temperatureK)*decay;m.thermalDecayKCell+=this.temperature[p]-t;finite(this.density[p],0,1,'density');finite(this.temperature[p],150,1000,'temperature');}
  m.afterKg=mass(this.density,this.c);m.balanceErrorKg=balance(m.beforeKg,m.afterKg,m.sourceKg,0,m.decayKg);let heatAfter=0;for(const t of this.temperature)heatAfter+=t-this.c.background.temperatureK;m.thermalBalanceErrorKCell=heatAfter-heatBefore-m.thermalSourceKCell-m.thermalDecayKCell;if(Math.abs(m.thermalBalanceErrorKCell)>1e-7)throw Error('THERMAL_BALANCE');
  } catch(e){this.status='Invalidated';throw e;}
  this.last=m;this.current=at;this.cursor=this.events.filter(e=>e.tick<at).length;
 }
 invalidate(revision:number):void {this.active();tick(revision);if(revision<=this.c.obstacle.revision)throw Error('REVISION_NOT_NEW');this.status='Invalidated';}
 rebase(origin:Vec):void{vector(origin);this.origin=immutable([...origin] as unknown as Vec);}
 evict():void {this.active();this.status='Evicted';this.density=new Float64Array(0);this.temperature=new Float64Array(0);}
 snapshot():Snapshot{return immutable({mode:'F1',status:this.status,tick:this.current,frameId:this.c.background.frameId,w1SnapshotId:this.c.background.snapshotId,obstacleDigest:this.c.obstacle.digest,allocatedBytes:this.density.byteLength+this.temperature.byteLength,density:Array.from(this.density),temperature:Array.from(this.temperature),velocity:[],projectionInputVelocity:[],metrics:{...this.last},events:[...this.events],eventCursor:this.cursor,authority:'VisualOnly',presentationOrigin:this.origin});}
}
export async function createF1(c:Config):Promise<F1>{return new F1(await validateConfig(c));}
