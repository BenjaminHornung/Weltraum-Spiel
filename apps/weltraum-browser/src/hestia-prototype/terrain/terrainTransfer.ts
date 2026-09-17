import {HVP_COAST_MATERIAL_REGISTRY} from "../../hvp/hvpCoastSource";
import {assertHvpSupportCurrent,type HvpSupportPlan} from "./supportPlan";
import type {createHvpTerrainRoot} from "./cutPlan";
import type {HvpPreparedCut} from "./cutPlan";

/** The authored rock support is the explicit initial undercut policy, not every cliff. */
export const isHvpRockArmCut=(cut:HvpPreparedCut):boolean=>cut.changed.length>0&&cut.changed.every(({cell:[x,y,z]})=>{
  const wx=cut.before.originMeters.x+(x+.5)*.125,wy=cut.before.originMeters.y+(y+.5)*.125,wz=cut.before.originMeters.z+(z+.5)*.125;
  return wx>=6&&wx<6.5&&wz>=-6.5&&wz< -6&&wy>=.125&&wy<2.25;
});

/** One root generation for direct removal plus ownership transfer; pure until commit. */
export const prepareHvpTerrainTransfer=(root:ReturnType<typeof createHvpTerrainRoot>,support:HvpSupportPlan)=>{
  assertHvpSupportCurrent(support,root.read());
  if(support.fragments.length===0){throw new Error("No detached component to transfer");}
  const count=support.fragments.reduce((n,f)=>n+f.cells.length,0);
  if(count>32_768){throw new Error("Transfer cell BudgetExceeded");}
  const cells=support.fragments.flatMap(f=>f.cells);
  const plan=root.prepareTransfer(support.cut,cells);
  const materialRemovedKg=support.cut.changed.reduce((mass,c)=>mass+HVP_COAST_MATERIAL_REGISTRY.find(m=>m.slot===c.before)!.densityKgPerM3*.125**3,0);
  return Object.freeze({plan,support,fragments:support.fragments,directRemovedCells:support.cut.changed.length,
    transferredCells:count,materialRemovedKg,transferredMassKg:support.fragments.reduce((mass,f)=>mass+f.massKg,0)});
};
