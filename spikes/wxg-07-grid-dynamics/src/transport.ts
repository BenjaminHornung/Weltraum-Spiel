import type {Grid} from './grid.js';
import {finitePositive} from './grid.js';
export const TICKS_PER_SECOND=120;
export const CHANNELS=['passive-moisture-kg-m2','passive-aerosol-kg-m2'] as const;
export interface Event {readonly tick:number;readonly priority:number;readonly sourceId:string;readonly commandId:string;readonly cell:number;readonly channel:number;readonly massKg:number}
export interface Policy {readonly source:readonly [number,number];readonly sink:readonly [number,number]}
export interface State {readonly tick:number;readonly cursor:number;readonly steps:number;readonly values:Float64Array;readonly added:readonly [number,number];readonly removed:readonly [number,number]}
export function tick(v:number):number{if(!Number.isSafeInteger(v)||v<0)throw Error('INVALID_TICK');return v;}
export function stepLimit(g:Grid,p:Policy):number{
  for(const v of [...p.source,...p.sink])finitePositive(v,'RATE',true);
  if(p.source.length!==2||p.sink.length!==2||[...p.source,...p.sink].some(v=>v>0.001))throw Error('RATE_RANGE');
  const maxSink=Math.max(...p.sink),rateLimit=g.maximumOutflowRate+maxSink;
  return Math.min(rateLimit===0?Infinity:0.8/rateLimit,g.wind===0?Infinity:0.8*g.minimumLength/(g.wind+g.waveSpeed));
}
export function selectStepTicks(g:Grid,p:Policy):number{
  const limit=stepLimit(g,p);
  const seconds=[3600,1800,1200,900,600,300,120,60,30,10,1,1/120].find(dt=>dt<=limit);
  if(seconds===undefined)throw Error('NO_STABLE_TICK');return Math.round(seconds*TICKS_PER_SECOND);
}
export function validateValues(v:Float64Array,count:number):void{
  if(!(v instanceof Float64Array)||v.length!==count*2)throw Error('STATE_LENGTH');
  for(const x of v)if(!Number.isFinite(x)||x<0||Object.is(x,-0))throw Error('INVALID_DENSITY');
}
export class Transport {
  readonly grid:Grid;readonly policy:Policy;readonly events:readonly Event[];readonly dtTicks:number;
  #neighbors:Int32Array;#incoming:Float64Array;#outgoing:Float64Array;
  constructor(grid:Grid,policy:Policy,events:readonly Event[]=[],dtTicks=selectStepTicks(grid,policy)){
    this.grid=grid;this.policy=Object.freeze({source:Object.freeze([...policy.source]) as readonly [number,number],sink:Object.freeze([...policy.sink]) as readonly [number,number]});
    const limit=stepLimit(grid,policy);tick(dtTicks);
    if(dtTicks===0||3600*TICKS_PER_SECOND%dtTicks!==0||dtTicks/TICKS_PER_SECOND>limit)throw Error('UNSTABLE_DT');this.dtTicks=dtTicks;
    const ids=new Set<string>();let prior:Event|undefined;
    for(const e of events){
      tick(e.tick);if(e.tick%dtTicks||!Number.isSafeInteger(e.priority)||e.priority<0||!e.sourceId||!e.commandId||!Number.isInteger(e.cell)||e.cell<0||e.cell>=grid.cells.length||![0,1].includes(e.channel))throw Error('INVALID_EVENT');
      finitePositive(e.massKg,'EVENT_MASS',true);if(e.massKg>1e16)throw Error('EVENT_RANGE');
      const compare=(a:Event,b:Event)=>a.tick-b.tick||a.priority-b.priority||(a.sourceId<b.sourceId?-1:a.sourceId>b.sourceId?1:0)||(a.commandId<b.commandId?-1:a.commandId>b.commandId?1:0);
      if(prior&&compare(prior,e)>=0)throw Error('EVENT_ORDER');if(ids.has(e.commandId))throw Error('DUPLICATE_EVENT');ids.add(e.commandId);prior=e;
    }
    this.events=Object.freeze(events.map(e=>Object.freeze({...e})));
    if(grid.cells.length!==6*grid.n*grid.n||grid.edges.length!==12*grid.n*grid.n)throw Error('UNKNOWN_COVERAGE');
    this.#neighbors=new Int32Array(grid.cells.length*4);this.#incoming=new Float64Array(grid.cells.length*4);this.#outgoing=new Float64Array(grid.cells.length);
    for(let i=0;i<grid.cells.length;i++){
      const c=grid.cells[i];finitePositive(c.area,'CELL_AREA');if(c.edges.length!==4||c.signs.length!==4)throw Error('UNKNOWN_COVERAGE');for(let side=0;side<4;side++){
        const e=grid.edges[c.edges[side]],q=e.flux*c.signs[side],j=i*4+side;
        if(!e||!Number.isFinite(q)||![1,-1].includes(c.signs[side])||(e.a!==i&&e.b!==i)||e.a<0||e.b<0||e.a>=grid.cells.length||e.b>=grid.cells.length)throw Error('UNKNOWN_COVERAGE');
        this.#neighbors[j]=e.a===i?e.b:e.a;this.#incoming[j]=Math.max(0,-q)/c.area;this.#outgoing[i]+=Math.max(0,q)/c.area;
      }
    }
    Object.freeze(this);
  }
  initial(values:Float64Array):State{validateValues(values,this.grid.cells.length);return this.applyEvents({tick:0,cursor:0,steps:0,values:values.slice(),added:[0,0],removed:[0,0]});}
  validate(s:State):void{
    tick(s.tick);tick(s.cursor);tick(s.steps);if(s.tick%this.dtTicks||s.steps!==s.tick/this.dtTicks||s.cursor!==this.events.filter(e=>e.tick<=s.tick).length)throw Error('STATE_CURSOR');
    validateValues(s.values,this.grid.cells.length);if(s.added.length!==2||s.removed.length!==2)throw Error('BUDGET_LENGTH');for(const v of [...s.added,...s.removed])finitePositive(v,'BUDGET',true);
  }
  private applyEvents(s:State):State{
    let cursor=s.cursor;const added:[number,number]=[...s.added];let values=s.values;
    while(cursor<this.events.length&&this.events[cursor].tick===s.tick){
      if(values===s.values)values=values.slice();const e=this.events[cursor++];values[e.cell*2+e.channel]+=e.massKg/this.grid.cells[e.cell].area;added[e.channel]+=e.massKg;
    }
    return {...s,cursor,values,added};
  }
  step(s:State,chunkSize=this.grid.cells.length,reverseChunks=false):State{
    this.validate(s);if(!Number.isInteger(chunkSize)||chunkSize<1)throw Error('CHUNK_SIZE');
    if(s.tick>Number.MAX_SAFE_INTEGER-this.dtTicks)throw Error('TIME_OVERFLOW');
    const old=s.values,next=new Float64Array(old.length),dt=this.dtTicks/TICKS_PER_SECOND;
    const chunks=Math.ceil(this.grid.cells.length/chunkSize);
    for(let chunk=0;chunk<chunks;chunk++){
      const begin=(reverseChunks?chunks-1-chunk:chunk)*chunkSize,end=Math.min(begin+chunkSize,this.grid.cells.length);
      for(let i=begin;i<end;i++)for(let k=0;k<2;k++){
        let inflow=0;for(let j=i*4;j<i*4+4;j++)inflow+=this.#incoming[j]*old[this.#neighbors[j]*2+k];
        const value=old[i*2+k]*(1-dt*(this.#outgoing[i]+this.policy.sink[k]))+dt*(inflow+this.policy.source[k]);
        if(!Number.isFinite(value)||value<0)throw Error('NUMERIC_FAILURE');next[i*2+k]=value===0?0:value;
      }
    }
    // Budget reductions keep global cell order regardless of worker/chunk partition.
    const added:[number,number]=[...s.added],removed:[number,number]=[...s.removed];
    for(let i=0;i<this.grid.cells.length;i++)for(let k=0;k<2;k++){
      added[k]+=dt*this.policy.source[k]*this.grid.cells[i].area;removed[k]+=dt*this.policy.sink[k]*old[i*2+k]*this.grid.cells[i].area;
    }
    for(const budget of [...added,...removed])finitePositive(budget,'BUDGET',true);
    return this.applyEvents({tick:s.tick+this.dtTicks,cursor:s.cursor,steps:s.steps+1,values:next,added,removed});
  }
  replay(s:State,target:number,chunkSize=this.grid.cells.length,reverseChunks=false):State{
    this.validate(s);tick(target);if(target<s.tick||target%this.dtTicks)throw Error('UNALIGNED_TARGET');
    let current=s;while(current.tick<target)current=this.step(current,chunkSize,reverseChunks);return current;
  }
}
export function totalMass(g:Grid,values:Float64Array):[number,number]{validateValues(values,g.cells.length);const out:[number,number]=[0,0];for(let i=0;i<g.cells.length;i++)for(let k=0;k<2;k++)out[k]+=values[i*2+k]*g.cells[i].area;return out;}
