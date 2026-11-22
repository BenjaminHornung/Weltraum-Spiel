export const HVP_PHYSICS_DT = 1 / 60;
export type HvpSimulationStatus = "Running" | "Paused" | "SimulationHold" | "Disposed";
export interface HvpTickCheckpoint {readonly ticks:number;readonly backlogSeconds:number;readonly discardedSeconds:number;readonly status:HvpSimulationStatus}

/** Fixed time belongs to simulation, never to render interpolation. */
export const createHvpTick = (step: (tick: number) => void, saved?:HvpTickCheckpoint) => {
  if(saved&&(!Number.isSafeInteger(saved.ticks)||saved.ticks<0||!Number.isFinite(saved.backlogSeconds)||saved.backlogSeconds<0
    ||saved.backlogSeconds>=HVP_PHYSICS_DT||!Number.isFinite(saved.discardedSeconds)||saved.discardedSeconds<0||saved.status!=="Paused")){
    throw new Error("Only a confirmed paused physics checkpoint can be restored");
  }
  let ticks = saved?.ticks??0;
  let backlogSeconds = saved?.backlogSeconds??0;
  let discardedSeconds = saved?.discardedSeconds??0;
  let status: HvpSimulationStatus = saved?"Paused":"Running";
  return {
    advance(seconds: number): void {
      if (!Number.isFinite(seconds) || seconds < 0) { throw new RangeError("Invalid physics elapsed time"); }
      if (status !== "Running") { return; }
      backlogSeconds += seconds;
      let count = 0;
      while (backlogSeconds + 1e-10 >= HVP_PHYSICS_DT && count < 4) {
        step(ticks);
        ticks += 1;
        count += 1;
        backlogSeconds = Math.max(0, backlogSeconds - HVP_PHYSICS_DT);
      }
      if (backlogSeconds + 1e-10 >= HVP_PHYSICS_DT) { status = "SimulationHold"; }
    },
    // A synchronous owner operation has exclusive access to this fixed tick. Preserve the
    // existing fractional backlog and a genuine SimulationHold across its publication.
    whileStopped<T>(run:()=>T):T {
      const running=status==="Running";
      if(running){status="Paused";}
      try{return run();}finally{if(running){status="Running";}}
    },
    pause(): void { if (status === "Running") { status = "Paused"; } },
    resume(): void {
      if (status === "Disposed") { return; }
      discardedSeconds += backlogSeconds;
      backlogSeconds = 0;
      status = "Running";
    },
    restoreSimulationHold(held:HvpTickCheckpoint):void {
      if(status!=="Paused"||held.status!=="SimulationHold"||held.ticks!==ticks||held.discardedSeconds!==discardedSeconds
        ||!Number.isFinite(held.backlogSeconds)||held.backlogSeconds+1e-10<HVP_PHYSICS_DT){
        throw new Error("Invalid stopped simulation recovery clock");
      }
      backlogSeconds=held.backlogSeconds;status="SimulationHold";
    },
    dispose(): void { status = "Disposed"; },
    read: () => Object.freeze({ ticks, backlogSeconds, discardedSeconds, status })
  };
};
