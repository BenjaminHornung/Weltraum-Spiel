import { canonicalizeJsonValue } from "../../resources/serialization";
import type { FactoryEnergy, FactoryPowerSuccess } from "./factoryPower";
export interface FactoryPowerReadView {
  readonly binding: FactoryPowerSuccess["binding"];
  readonly tickStartUs: string; readonly tickEndUs: string;
  readonly nameplateMilliWatt: string; readonly requestedMilliWatt: string; readonly allocatedMilliWatt: string;
  readonly sourcePotentialMilliWatt: FactoryEnergy; readonly sourceActualMilliWatt: FactoryEnergy;
  readonly storedEnergy: FactoryEnergy | null;
  readonly grants: FactoryPowerSuccess["grants"]; readonly balance: FactoryPowerSuccess["balance"];
}
const gcd=(a:bigint,b:bigint):bigint=>{while(b) {const r=a%b;a=b;b=r;}return a;};
/** Presentation only; exact units stay explicit, no clock, mutation or command. */
export const readFactoryPower=(step:FactoryPowerSuccess):FactoryPowerReadView=>{
  const duration=BigInt(step.tickEndUs)-BigInt(step.tickStartUs);
  const rate=(energy:FactoryEnergy):FactoryEnergy=>{
    const n=BigInt(energy.n)*1_000_000n,d=BigInt(energy.d)*duration,g=gcd(n,d);
    return {n:String(n/g),d:String(d/g)};
  };
  return canonicalizeJsonValue({binding:step.binding,tickStartUs:step.tickStartUs,tickEndUs:step.tickEndUs,
    nameplateMilliWatt:step.nameplateMilliWatt,
    requestedMilliWatt:String(step.grants.reduce((s,g)=>s+BigInt(g.requiredMilliWatt),0n)),
    allocatedMilliWatt:String(step.grants.reduce((s,g)=>s+BigInt(g.allocatedMilliWatt),0n)),
    sourcePotentialMilliWatt:rate(step.balance.sourcePotential),sourceActualMilliWatt:rate(step.balance.sourceActual),
    storedEnergy:step.nextState.battery?.storedEnergy??null,grants:step.grants,balance:step.balance}) as unknown as FactoryPowerReadView;
};
