export function childTerminal(fields,stdout,stderr,declaredChildPid){
  return {...fields,declaredChildPid:declaredChildPid??null,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)};
}
export function appendChildBytes(chunks,bytes,maxBytes=8*1024*1024){
  const retained=chunks.reduce((sum,chunk)=>sum+chunk.length,0),remaining=maxBytes-retained;
  if(remaining>0)chunks.push(Buffer.from(bytes.subarray(0,remaining)));
  return bytes.length>remaining;
}
export function receiveChild(owner,lane,child,readRecords){
  try{owner.accept(lane,{...child,records:readRecords()});return null;}
  catch(error){owner.stop("CHILD_OBSERVATION_READ_FAILURE");return String(error);}
}
export function createBatchOwner(cases) {
  if (!Array.isArray(cases) || cases.length !== 24 || new Set(cases.map(c => c.id)).size !== 24)
    throw new Error("Native24 exact unique catalog required");
  const lanes = [];
  for (const profile of ["legacy-impulse-v1", "gyroscopic-v1"]) {
    for (const kind of ["triangles", "multi-cuboid", "voxels"]) {
      const selected = cases.filter(c => c.profile === profile && c.kind === kind);
      if (selected.length !== 4 || selected.some(c => c.gyro !== (profile === "gyroscopic-v1"))
        || selected.filter(c => c.population === "PREPARED18").length !== 3
        || selected.filter(c => c.population === "ORIGINAL6_ASSERTIONS").length !== 1)
        throw new Error("Native24 profile/population drift");
      lanes.push(Object.freeze({profile, kind, cases: Object.freeze(selected)}));
    }
  }
  const results = [];
  let cursor = 0, poisoned = false, stopReason = null;
  const stop = reason => { poisoned = true; stopReason ??= reason; };
  return Object.freeze({
    next() {
      if (poisoned) throw new Error("Native24 batch poisoned");
      return lanes[cursor] ?? null;
    },
    accept(lane, child) {
      if (poisoned || lane !== lanes[cursor]) throw new Error("Native24 child order/reuse rejected");
      if (!child || ![0, 1].includes(child.exit) || child.timeout || child.setupFailure
        || !Array.isArray(child.records) || child.records.length !== lane.cases.length) {
        stop("CHILD_SETUP_TIMEOUT_OR_INCOMPLETE_OUTPUT"); return;
      }
      const expected = new Map(lane.cases.map(c => [c.id, c]));
      for (const row of child.records) {
        const descriptor = expected.get(row?.caseId);
        if (!descriptor || row.profile !== lane.profile || row.kind !== lane.kind || row.gyro !== descriptor.gyro) {
          stop("CHILD_IDENTITY_OR_PROFILE_DRIFT"); return;
        }
        expected.delete(row.caseId);
        if (row.acquisition?.status !== "PASS" || row.acquired !== true
          || !["PASS", "FAIL"].includes(row.primary?.status)
          || typeof row.primaryPresent !== "boolean"
          || row.primaryPresent !== (row.primary.status === "FAIL")
          || row.cleanup?.status !== "PASS" || row.releaseAttempts !== 1
          || row.disposition !== "RELEASED" || !Array.isArray(row.stopCauses) || row.stopCauses.length !== 0) {
          stop("ACQUISITION_NATIVE_TRAP_CLEANUP_OR_UNQUALIFIED_RELEASE"); return;
        }
      }
      const failedPrimary=child.records.some(row=>row.primary.status==="FAIL");
      if((child.exit===0&&failedPrimary)||(child.exit===1&&!failedPrimary)){
        stop("CHILD_EXIT_PRIMARY_INCONSISTENCY");return;
      }
      results.push(Object.freeze({profile:lane.profile,kind:lane.kind,exit:child.exit,records:child.records}));
      cursor++;
    },
    stop,
    read: () => Object.freeze({completedLanes:cursor,poisoned,stopReason,
      status:poisoned?"HOLD":cursor===lanes.length?"COMPLETE_SOURCE_PROTOCOL":"PENDING",
      results:Object.freeze([...results]),nativeAcceptance:false,heap:"UNSUPPORTED"})
  });
}
