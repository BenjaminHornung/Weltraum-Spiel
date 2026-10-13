export type Vec = readonly [number, number, number];
export const N=32, HZ=120, MAX_TICKS=240, MAX_EVENTS=64, MAX_BYTES=16*1024*1024;
export function finite(v:number,min:number,max:number,label:string):number {if(!Number.isFinite(v)||v<min||v>max)throw Error('RANGE:'+label);return v;}
export function tick(v:number):number {if(!Number.isSafeInteger(v)||v<0)throw Error('TICK');return v;}
export function keys(v:object,names:string[]):void {if(Object.keys(v).sort().join('|')!==names.sort().join('|'))throw Error('SCHEMA_KEYS');}
export function vector(v:Vec,max=1e9):void {if(!Array.isArray(v)||v.length!==3)throw Error('VECTOR');v.forEach(x=>finite(x,-max,max,'vector'));}
export function canonical(v:unknown):string {if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';}
export async function digest(v:unknown):Promise<string>{const b=new TextEncoder().encode(canonical(v)),h=await crypto.subtle.digest('SHA-256',b);return 'sha256:'+Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function immutable<T>(v:T):T {if(v!==null&&typeof v==='object'){for(const x of Object.values(v))immutable(x);Object.freeze(v);}return v;}
export interface Background {readonly snapshotId:string;readonly tick:number;readonly bodyId:string;readonly frameId:string;readonly epoch:string;readonly wind:Vec;readonly temperatureK:number;readonly positionMeters:Vec;readonly supportRadiusMeters:number;readonly original:Record<string,unknown>}
export async function fromW1(raw:Record<string,unknown>):Promise<Background>{
 if(raw.status!=='Known')throw Error('W1_UNAVAILABLE:'+raw.status);const {WeatherSnapshotId,...payload}=raw;
 if(await digest(payload)!==WeatherSnapshotId)throw Error('W1_DIGEST');const q=raw.query as Record<string,unknown>,s=raw.sample as {windBodyFixedMps:{x:number;y:number;z:number};temperatureK:number};
 if(q.frameKind!=='BodyFixed'||typeof q.bodyId!=='string'||typeof q.frameId!=='string')throw Error('W1_FRAME');
 const wind:Vec=[s.windBodyFixedMps.x,s.windBodyFixedMps.y,s.windBodyFixedMps.z];vector(wind,100);finite(s.temperatureK,150,1000,'temperature');tick(q.simulationTick as number);
 const pos=q.bodyFixedPositionMeters as {x:number;y:number;z:number},positionMeters:Vec=[pos.x,pos.y,pos.z];vector(positionMeters);const supportRadiusMeters=finite(raw.supportRadiusMeters as number,1,1e9,'support');
 return immutable({snapshotId:WeatherSnapshotId as string,tick:q.simulationTick as number,bodyId:q.bodyId,frameId:q.frameId,epoch:canonical(raw.binding),wind,temperatureK:s.temperatureK,positionMeters,supportRadiusMeters,original:structuredClone(raw)});
}
export interface Obstacle {readonly schema:'wxg06.obstacle/v1';readonly bodyId:string;readonly frameId:string;readonly worldId:string;readonly sessionId:string;readonly epoch:string;readonly sourceOwner:string;readonly revision:number;readonly materialProfile:string;readonly unit:'meters';readonly cellMeters:number;readonly origin:Vec;readonly coverage:readonly number[];readonly digest:string;readonly provenance:'SyntheticVoxelProjection'}
export interface Config {readonly grid:number;readonly maxBytes:number;readonly cellMeters:number;readonly origin:Vec;readonly background:Background;readonly obstacle:Obstacle;readonly decayPerSecond:number;readonly densityKgPerM3:number;readonly controlWind:Vec|null}
export function allocationBytes():number{return (9*N**3+9*(N+1)*N*N)*8+N**3;}
export async function validateConfig(raw:Config):Promise<Config>{
 if(raw.grid!==N||!Number.isSafeInteger(raw.maxBytes)||raw.maxBytes>MAX_BYTES||raw.maxBytes<allocationBytes())throw Error('BUDGET_BEFORE_ALLOCATION');
 finite(raw.cellMeters,0.5,100,'cell');vector(raw.origin);finite(raw.decayPerSecond,0,10,'decay');finite(raw.densityKgPerM3,0,1,'density');if(raw.controlWind!==null)vector(raw.controlWind,100);
 const o=raw.obstacle;if(!Array.isArray(o.coverage)||o.coverage.length!==N**3)throw Error('COVERAGE');
 if(o.schema!=='wxg06.obstacle/v1'||o.provenance!=='SyntheticVoxelProjection'||o.unit!=='meters'||o.bodyId!==raw.background.bodyId||o.frameId!==raw.background.frameId||o.epoch!==raw.background.epoch||o.cellMeters!==raw.cellMeters||canonical(o.origin)!==canonical(raw.origin))throw Error('OBSTACLE_BINDING');
 for(const key of ['worldId','sessionId','sourceOwner','materialProfile'] as const)if(typeof o[key]!=='string'||!o[key].length||o[key].length>128)throw Error('OBSTACLE_ID');tick(o.revision);
 if(o.sourceOwner!=='wxg06.synthetic-voxel'||o.worldId!=='wxg06.synthetic-world'||o.sessionId!=='wxg06.finite-session'||o.materialProfile!=='wxg06.closed-solid-or-unknown/v1')throw Error('UNPROVEN_OBSTACLE_SOURCE');
 for(let k=0;k<N;k++)for(let j=0;j<N;j++)for(let i=0;i<N;i++){const v=o.coverage[index(i,j,k)];if(v!==0&&v!==1&&v!==2)throw Error('COVERAGE_STATE');if(v!==0&&(i===0||j===0||k===0||i===N-1||j===N-1||k===N-1))throw Error('OUTER_COVERAGE_REQUIRED');}
 const {digest:od,...p}=o;if(await digest(p)!==od)throw Error('OBSTACLE_DIGEST');
 const b=await fromW1(raw.background.original);if(canonical(b)!==canonical(raw.background))throw Error('BACKGROUND_BINDING');
 const radius=Math.sqrt(3)*N*raw.cellMeters/2,distance=Math.hypot(...raw.origin.map((x,i)=>x+N*raw.cellMeters/2-b.positionMeters[i]));if(distance+radius>b.supportRadiusMeters)throw Error('W1_SPATIAL_SUPPORT');
 if((raw.controlWind??b.wind).reduce((s,x)=>s+Math.abs(x),0)/HZ/raw.cellMeters>0.8)throw Error('CFL_BEFORE_ALLOCATION');
 return immutable(structuredClone(raw));
}
export function index(i:number,j:number,k:number):number{return i+N*(j+N*k);}
export function center(c:Config,i:number,j:number,k:number):Vec{return [c.origin[0]+(i+0.5)*c.cellMeters,c.origin[1]+(j+0.5)*c.cellMeters,c.origin[2]+(k+0.5)*c.cellMeters];}
export function mass(a:Float64Array,c:Config):number {let m=0;for(const x of a)m+=x;return m*c.cellMeters**3;}
export interface Event {readonly id:string;readonly kind:'Trajectory'|'Nozzle'|'PressureImpulse';readonly tick:number;readonly durationTicks:number;readonly revision:number;readonly craftRevision:number;readonly frameId:string;readonly epoch:string;readonly sourceOwner:string;readonly from:Vec;readonly to:Vec;readonly radiusMeters:number;readonly speedMps:number;readonly tracerKgPerSecond:number;readonly heatKPerSecond:number;readonly massFlowKgPerSecond:number|null;readonly thrustN:number|null;readonly active:boolean}
export function validateEvent(e:Event,c:Config,at:number):Event {
 keys(e,['id','kind','tick','durationTicks','revision','craftRevision','frameId','epoch','sourceOwner','from','to','radiusMeters','speedMps','tracerKgPerSecond','heatKPerSecond','massFlowKgPerSecond','thrustN','active']);
 if(!['Trajectory','Nozzle','PressureImpulse'].includes(e.kind)||typeof e.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(e.id))throw Error('EVENT_SCHEMA');
 tick(e.tick);tick(e.durationTicks);tick(e.craftRevision);if(e.tick<at||e.tick>c.background.tick+MAX_TICKS||e.durationTicks<1||e.durationTicks>MAX_TICKS||e.tick+e.durationTicks>c.background.tick+MAX_TICKS)throw Error('EVENT_LIFETIME');
 if(e.frameId!==c.background.frameId||e.epoch!==c.background.epoch||e.revision!==c.obstacle.revision||e.craftRevision!==1||e.sourceOwner!=='wxg06.synthetic-signal')throw Error('STALE_EVENT');
 vector(e.from);vector(e.to);finite(e.radiusMeters,c.cellMeters,8*c.cellMeters,'radius');finite(e.speedMps,0,20,'speed');finite(e.tracerKgPerSecond,0,0.1,'source');finite(e.heatKPerSecond,0,100,'heat');
 for(const p of [e.from,e.to])if(p.some((x,i)=>x<c.origin[i]||x>c.origin[i]+N*c.cellMeters))throw Error('EVENT_OUTSIDE_VOLUME');
 if(typeof e.active!=='boolean')throw Error('ACTIVE');if(e.massFlowKgPerSecond!==null)finite(e.massFlowKgPerSecond,0,1,'massflow');if(e.thrustN!==null)finite(e.thrustN,0,1000,'thrust');
 const length=Math.hypot(...e.to.map((x,i)=>x-e.from[i]));if(e.kind==='Nozzle'&&e.active&&length===0)throw Error('NOZZLE_DIRECTION');
 return immutable(structuredClone(e));
}
export function segmentDistance(p:Vec,a:Vec,b:Vec):number {const d=b.map((x,i)=>x-a[i]),l=d.reduce((s,x)=>s+x*x,0),t=l===0?0:Math.max(0,Math.min(1,d.reduce((s,x,i)=>s+(p[i]-a[i])*x,0)/l));return Math.hypot(...p.map((x,i)=>x-a[i]-t*d[i]));}
export function balance(before:number,after:number,source:number,boundary:number,decay:number):number {const error=after-before-source-boundary-decay;if(Math.abs(error)>1e-8+1e-10*Math.abs(before))throw Error('TRACER_BALANCE:'+error);return error;}
export interface Metrics {beforeKg:number;afterKg:number;sourceKg:number;boundaryKg:number;decayKg:number;redistributedKg:number;balanceErrorKg:number;divergenceBefore:number|null;divergenceAfter:number|null;projectionIterations:number|null;maxCfl:number|null;thermalBoundaryKCell:number;thermalSourceKCell:number;thermalDecayKCell:number;thermalBalanceErrorKCell:number}
export interface Snapshot {readonly mode:'F1'|'F2';readonly status:'Active'|'Invalidated'|'Evicted';readonly tick:number;readonly frameId:string;readonly w1SnapshotId:string;readonly obstacleDigest:string;readonly allocatedBytes:number;readonly density:readonly number[];readonly temperature:readonly number[];readonly velocity:readonly (readonly number[])[];readonly projectionInputVelocity:readonly (readonly number[])[];readonly metrics:Metrics;readonly events:readonly Event[];readonly eventCursor:number;readonly authority:'VisualOnly';readonly presentationOrigin:Vec}
