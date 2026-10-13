import {threefry2x32,tickCounter,q16Smoothstep} from '../vendor/cel/vendor/plt/src/numerics.mjs';
import {createSimulationTick,immutable,number} from './common';
import {unit,cross,add,scale,dot} from './geometry';
import type {Vec3} from './geometry';
import type {Digest} from './common';
export const EPOCH_TICKS=7_200_000;
export interface SynopticObject {
  readonly id:string;readonly kind:'Front'|'Vortex';readonly bornTick:number;readonly lifetimeTicks:number;
  readonly centerBodyFixed:Vec3;readonly trajectoryOrigin:Vec3;readonly trajectoryDrift:Vec3;readonly envelopeQ16:number;
  readonly pressureFraction:number;readonly thermalAmplitudeK:number;readonly windAmplitudeMps:number;
}
const smooth=(x:number)=>q16Smoothstep(Math.round(Math.max(0,Math.min(1,x))*65536))/65536;
export function periodicForcing(tick:number,periodTicks:number):number {
  createSimulationTick(tick);if(!Number.isSafeInteger(periodTicks)||periodTicks<120)throw Error('PERIOD_TICKS');
  const phase=Number(BigInt(tick)%BigInt(periodTicks))/periodTicks;
  return phase<0.5?2*smooth(phase*2)-1:1-2*smooth((phase-0.5)*2);
}
export function synopticObjects(profileDigest:Digest,tick:number,allowVortices:boolean):readonly SynopticObject[] {
  createSimulationTick(tick);if(!/^sha256:[a-f0-9]{64}$/.test(profileDigest)||typeof allowVortices!=='boolean')throw Error('SYNOPTIC_PROFILE');
  const key=[Number.parseInt(profileDigest.slice(7,15),16),Number.parseInt(profileDigest.slice(15,23),16)];
  const epoch=BigInt(tick)/BigInt(EPOCH_TICKS);const out:SynopticObject[]=[];
  for(let offset=-2;offset<=0;offset++) {
    const e=epoch+BigInt(offset);if(e<0n)continue;
    for(let slot=0;slot<2;slot++) {
      if(slot===1&&!allowVortices)continue;
      const words=tickCounter(Number(e));const rand=threefry2x32(words,[(key[0]^(slot*0x9e3779b9))>>>0,key[1]]);
      const a=rand[0]/4294967296,b=rand[1]/4294967296;
      const born=e*BigInt(EPOCH_TICKS)+BigInt(Math.floor(a*EPOCH_TICKS/4));
      const age=BigInt(tick)-born;const lifetime=2*EPOCH_TICKS;
      if(age<0n||age>=BigInt(lifetime))continue;
      const phase=Number(age)/lifetime;
      const origin=unit({x:2*a-1,y:b-0.5,z:0.3+Math.abs(a-b)});
      const drift=scale(cross({x:0,y:1,z:0},origin),0.8*(b<0.5?-1:1));
      const envelopeQ16=Math.round(smooth(Math.min(1,phase*4))*smooth(Math.min(1,(1-phase)*4))*65536);
      out.push({id:`${profileDigest}/epoch.${e}/slot.${slot}`,kind:slot===0?'Front':'Vortex',bornTick:Number(born),lifetimeTicks:lifetime,
        centerBodyFixed:unit(add(origin,scale(drift,phase))),trajectoryOrigin:origin,trajectoryDrift:drift,envelopeQ16,
        pressureFraction:slot===0?0.01:-0.01,thermalAmplitudeK:(2*a-1)*3,windAmplitudeMps:2+2*b});
    }
  }
  return immutable(out.sort((a,b)=>a.id.localeCompare(b.id)));
}
export function sampleSynoptic(objects:readonly SynopticObject[],normal:Vec3) {
  const n=unit(normal);let pressureFraction=0,temperatureDeltaK=0,aerosolDelta=0;let wind={x:0,y:0,z:0};const activeIds=[];
  for(const o of objects) {
    const spatial=o.kind==='Vortex'?smooth((dot(n,o.centerBodyFixed)-0.85)/0.15):smooth(1-Math.abs(dot(n,o.centerBodyFixed))/0.2);
    const weight=spatial*o.envelopeQ16/65536;
    pressureFraction+=o.pressureFraction*weight;temperatureDeltaK+=o.thermalAmplitudeK*weight;aerosolDelta+=0.0002*weight;
    wind=add(wind,scale(cross(o.centerBodyFixed,n),o.windAmplitudeMps*weight));if(weight>0)activeIds.push(o.id);
  }
  number(pressureFraction,-0.06,0.06,'pressure residual');number(aerosolDelta,0,0.0012,'aerosol source');
  return immutable({pressureFraction,temperatureDeltaK,aerosolDelta,wind,activeIds:activeIds.sort(),budget:{maximumObjects:6,pressureResidualBound:0.06,maximumAddedAerosolMixingRatio:0.0012,conservation:'NOT_A_CONSERVATIVE_GCM'}});
}
