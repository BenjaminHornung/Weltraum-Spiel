import { compactSupportReport, createTerrainComponentIndex } from "../../voxel/structural/componentIndex";
import type { HvpPreparedCut, HvpTerrainSnapshot } from "./cutPlan";
import { bindHvpSupportPlan, createHvpSupportPhaseCredits } from "./supportPlan";
import type { HvpCell } from "./picking";

export function createHvpLiveSupport(initial: HvpTerrainSnapshot) {
  let source = initial;
  let index = createTerrainComponentIndex(source);
  let center = "";
  let nearby: HvpCell[] = [];

  function bind(snapshot: HvpTerrainSnapshot) {
    if (snapshot !== source) {
      index.dispose();
      source = snapshot;
      index = createTerrainComponentIndex(snapshot);
      center = "";
      nearby = [];
    }
  }

  return {
    residentBytes: () => index.residentBytes(),
    dispose: () => { index.dispose(); nearby=[]; },
    /** Warm progressively around the player, independent of aim, tool and cut shape. */
    warmNear(snapshot: HvpTerrainSnapshot, position: Readonly<{x:number;y:number;z:number}>) {
      bind(snapshot);
      const meters = 16 * snapshot.cellMeters;
      const bx = Math.floor((position.x-snapshot.originMeters.x)/meters);
      const by = Math.floor((position.y-snapshot.originMeters.y)/meters);
      const bz = Math.floor((position.z-snapshot.originMeters.z)/meters);
      const key = bx + ":" + by + ":" + bz;
      if (key !== center) {
        center = key;
        nearby = [];
        for (let r=2; r>=0; r--) {
          for (let dz=-r; dz<=r; dz++) for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
            if (Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz)) !== r) continue;
            const x=bx+dx, y=by+dy, z=bz+dz;
            if (x>=0 && y>=0 && z>=0 && x*16<snapshot.sizeX && y*16<snapshot.sizeY && z*16<snapshot.sizeZ) nearby.push([x,y,z]);
          }
        }
      }
      const block = nearby.pop();
      if (block) index.warm([block]);
      return nearby.length;
    },
    analyze(cut: HvpPreparedCut, resident: number) {
      bind(cut.before);
      const result = index.prepareCompact(cut,{tryFloorColumn:true});
      const report = compactSupportReport(result);
      const fragments = report.fragments.map((fragment,i) => {
        const compact = result.fragments[i]!;
        return Object.freeze({...fragment, compactSource:Object.freeze({
          generation:cut.after.revision, cellCount:compact.cellCount, parts:compact.parts,
        })});
      });
      const phase = createHvpSupportPhaseCredits(report.workingBytes, resident + index.residentBytes());
      const plan = bindHvpSupportPlan(cut, {...report,fragments}, () => {}, phase);
      return {plan,counters:result.counters};
    },
    committed(cut: HvpPreparedCut, published: HvpTerrainSnapshot) {
      if (source !== cut.before || published !== cut.after) { bind(published); return; }
      index.commit(cut,published);
      source=published;
    },
  };
}
