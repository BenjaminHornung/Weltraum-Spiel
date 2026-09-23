import { describe, expect, it, vi } from "vitest";
import { createHvpCutObservation, measureHvpCut, measureHvpCutAsync, type HvpCutSpan, type HvpCutRenderFacts } from "../../src/hestia-prototype/runtime/cutTrace";
import { createHvpTerrainRoot } from "../../src/hestia-prototype/terrain/cutPlan";
import { renderCommandResult } from "../../src/presentation/renderCommands";

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe("HVP cut trace", () => {
  it("returns disabled sync values and errors without reading the clock", () => {
    const now = vi.spyOn(performance, "now");
    const origin = vi.spyOn(performance, "timeOrigin", "get");
    const value = { result: 7 };
    const original = new Error("disabled failure");
    try {
      expect(measureHvpCut(undefined, "disabled-value", "main", "prepare", () => value)).toBe(value);
      let caught: unknown;
      try {
        measureHvpCut(undefined, "disabled-error", "main", "prepare", () => {
          throw original;
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(now).not.toHaveBeenCalled();
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("records one enabled sync span and preserves the value reference", () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(12).mockReturnValueOnce(19);
    const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(1000);
    const spans: HvpCutSpan[] = [];
    const value = { result: 7 };
    let runs = 0;
    try {
      const returned = measureHvpCut(spans.push.bind(spans), "command-1", "support", "compile", () => {
        runs += 1;
        return value;
      });
      expect(returned).toBe(value);
      expect(runs).toBe(1);
      expect(spans).toEqual([{ commandId: "command-1", thread: "support", phase: "compile", origin: 1000, start: 12, duration: 7 }]);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("preserves a sync error when the diagnostic sink throws", () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(20).mockReturnValueOnce(25);
    const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(2000);
    const original = new Error("source failure");
    const sink = vi.fn(() => {
      throw new Error("sink failure");
    });
    try {
      let caught: unknown;
      try {
        measureHvpCut(sink, "command-2", "body", "prepare", () => {
          throw original;
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(sink).toHaveBeenCalledTimes(1);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("preserves a successful sync value when the diagnostic sink throws", () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(26).mockReturnValueOnce(31);
    const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(2500);
    const value = { result: 11 };
    const sink = vi.fn(() => {
      throw new Error("sink failure");
    });
    let runs = 0;
    try {
      const returned = measureHvpCut(sink, "command-2-success", "main", "publish", () => {
        runs += 1;
        return value;
      });
      expect(returned).toBe(value);
      expect(runs).toBe(1);
      expect(sink).toHaveBeenCalledTimes(1);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("emits no async span while a deferred operation is pending", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(30).mockReturnValueOnce(44);
    const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(3000);
    const operation = deferred<number>();
    const spans: HvpCutSpan[] = [];
    let runs = 0;
    try {
      const pending = measureHvpCutAsync(spans.push.bind(spans), "command-3", "physics", "native", () => {
        runs += 1;
        return operation.promise;
      });
      await Promise.resolve();
      expect(spans).toHaveLength(0);
      expect(runs).toBe(1);
      expect(now).toHaveBeenCalledTimes(1);
      operation.resolve(17);
      await expect(pending).resolves.toBe(17);
      expect(spans).toEqual([{ commandId: "command-3", thread: "physics", phase: "native", origin: 3000, start: 30, duration: 14 }]);
      expect(runs).toBe(1);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("preserves an async rejection when the diagnostic sink throws", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(40).mockReturnValueOnce(49);
    const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(4000);
    const operation = deferred<number>();
    const original = new Error("async source failure");
    const sink = vi.fn(() => {
      throw new Error("async sink failure");
    });
    try {
      const pending = measureHvpCutAsync(sink, "command-4", "main", "finalize", () => operation.promise);
      operation.reject(original);
      await expect(pending).rejects.toBe(original);
      expect(sink).toHaveBeenCalledTimes(1);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("preserves a successful async value when the diagnostic sink throws", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValueOnce(50).mockReturnValueOnce(58);
    const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(5000);
    const operation = deferred<{ result: number }>();
    const value = { result: 29 };
    const sink = vi.fn(() => {
      throw new Error("async sink failure");
    });
    let runs = 0;
    try {
      const pending = measureHvpCutAsync(sink, "command-4-success", "support", "finalize", () => {
        runs += 1;
        return operation.promise;
      });
      expect(runs).toBe(1);
      operation.resolve(value);
      await expect(pending).resolves.toBe(value);
      expect(runs).toBe(1);
      expect(sink).toHaveBeenCalledTimes(1);
      expect(now).toHaveBeenCalledTimes(2);
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("returns the disabled async value without clock reads", async () => {
    const now = vi.spyOn(performance, "now");
    const origin = vi.spyOn(performance, "timeOrigin", "get");
    const operation = deferred<{ result: number }>();
    const value = { result: 23 };
    try {
      const pending = measureHvpCutAsync(undefined, "disabled-async", "main", "publish", () => operation.promise);
      operation.resolve(value);
      await expect(pending).resolves.toBe(value);
      expect(now).not.toHaveBeenCalled();
      expect(origin).not.toHaveBeenCalled();
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  it("preserves a disabled async rejection without reading either clock value", async () => {
    const now = vi.spyOn(performance, "now");
    const origin = vi.spyOn(performance, "timeOrigin", "get");
    const operation = deferred<number>();
    const original = new Error("disabled async failure");
    try {
      const pending = measureHvpCutAsync(undefined, "disabled-async-error", "physics", "cleanup", () => operation.promise);
      operation.reject(original);
      await expect(pending).rejects.toBe(original);
      expect(now).not.toHaveBeenCalled();
      expect(origin).not.toHaveBeenCalled();
    } finally {
      origin.mockRestore();
      now.mockRestore();
    }
  });

  const makeRoot = (id = "observation") => createHvpTerrainRoot({ sizeX: 16, sizeY: 16, sizeZ: 16,
    cellMeters: 0.125, originMeters: { x: 0, y: 0, z: 0 }, sourceDigest: "12345678", readSlot: () => 1 }, id, 0);
  const makeFacts = (root: ReturnType<typeof makeRoot>, active = ["hvp:terrain:s0"], visible = active,
    nativeGeneration = root.read().revision, recoveryHold = false): HvpCutRenderFacts => ({ root: root.read(), nativeGeneration,
    recoveryHold, activeTerrainKeys: active, visibleTerrainKeys: visible });
  const submitted = (commandId = "cut-1", start = performance.now()): HvpCutSpan => ({ commandId, thread: "main", phase: "cutSubmittedMs", origin: performance.timeOrigin, start, duration: 0 });
  const terminal = (phase: "cutTotalAppliedMs" | "cutTotalNoOpMs" | "cutTotalRejectedMs" | "cutTotalRecoveryHoldMs",
    commandId = "cut-1", start = performance.now(), duration = 5): HvpCutSpan => ({ commandId, thread: "main", phase, origin: performance.timeOrigin, start, duration });
  const observerFixture = () => {
    const root = makeRoot();
    let facts = makeFacts(root);
    let readFailure = false;
    const sink = { record: vi.fn() };
    const observer = createHvpCutObservation(sink, () => { if (readFailure) { throw new Error("frame failure"); } return facts; });
    return { root, sink, observer, setFacts: (next: HvpCutRenderFacts) => { facts = next; }, setReadFailure: (value: boolean) => { readFailure = value; } };
  };

  describe("P07 body observation", () => {
    const bodyFixture=()=>{
      const root=makeRoot("body-observation"),id="moving-cut-1";
      let body={outcome:Object.freeze({id,status:"Applied"}),nativeState:"Idle",nativeSequence:1,
        receipt:{id,status:"Applied",parentId:"parent",children:["child"]},
        children:[{ownerId:"child",sourceDigest:"fnv1a64-v1:0123456789abcdef",renderKey:"child"}],
        activeKeys:["child"],visibleKeys:["child"]};
      let frame=makeFacts(root);
      const sink={record:vi.fn()},readFrame=vi.fn((bodyId?:string)=>({...frame,...(bodyId===undefined?{}:{body})}));
      const observer=createHvpCutObservation(sink,readFrame);
      const apply=()=>{observer.confirm(()=>{observer.trace({...submitted(id),phase:"cutBodySubmittedMs"});});
        observer.trace({...submitted(id),phase:"cutBodyTotalAppliedMs"});};
      return {root,id,sink,observer,readFrame,apply,body:()=>body,setBody:(next:typeof body)=>{body=next;},setFrame:(next:HvpCutRenderFacts)=>{frame=next;}};
    };

    it("binds body input and an actual matching render separately from the unchanged terrain generation",()=>{
      const f=bodyFixture();f.apply();
      expect(f.observer.read()).toMatchObject({inputCount:0,pendingRender:true});
      expect(f.readFrame).toHaveBeenCalledWith(f.id);
      expect(f.sink.record).toHaveBeenCalledWith("cutBodyInputToAppliedMs",expect.any(Number),expect.any(Number),expect.objectContaining({commandId:f.id}));
      const result=renderCommandResult("Accepted"),render=vi.fn(()=>result);
      expect(f.observer.render(render)).toBe(result);f.observer.render(render);
      const markers=f.sink.record.mock.calls.filter(c=>c[0]==="cutBodyFirstCommittedRenderSubmitMs");
      expect(markers).toHaveLength(1);expect(markers[0]![3]).toMatchObject({savedRevision:0,nativeGeneration:0,
        bodySequence:1,parentId:"parent",children:f.body().children,activeBodyKeys:["child"],outcomeIdentityMatches:true});
      expect(f.sink.record.mock.calls.some(c=>c[0]==="cutFirstCommittedRenderSubmitMs")).toBe(false);
      expect(render).toHaveBeenCalledTimes(2);f.observer.dispose();
    });

    it("permits a confirmed complete body removal without fabricating a child",()=>{
      const f=bodyFixture();f.setBody({...f.body(),receipt:{...f.body().receipt,children:[]},children:[],activeKeys:[],visibleKeys:[]});
      f.apply();expect(f.observer.read().pendingRender).toBe(true);f.observer.render(()=>renderCommandResult("Accepted"));
      expect(f.sink.record.mock.calls.find(c=>c[0]==="cutBodyFirstCommittedRenderSubmitMs")?.[3]).toMatchObject({children:[],activeBodyKeys:[]});
      f.observer.dispose();
    });

    it.each(["restored outcome","native sequence","native command","native status","native pending","child digest","child key","visible parent","missing child","root restore"])("rejects a pending body render after %s changes",change=>{
      const f=bodyFixture();f.apply();expect(f.observer.read().pendingRender).toBe(true);const b=f.body();
      if(change==="restored outcome"){f.setBody({...b,outcome:Object.freeze({...b.outcome})});}
      if(change==="native sequence"){f.setBody({...b,nativeSequence:2});}
      if(change==="native command"){f.setBody({...b,receipt:{...b.receipt,id:"other"}});}
      if(change==="native status"){f.setBody({...b,receipt:{...b.receipt,status:"CommittedHeld"}});}
      if(change==="native pending"){f.setBody({...b,nativeState:"Preparing"});}
      if(change==="child digest"){f.setBody({...b,children:[{...b.children[0]!,sourceDigest:"fnv1a64-v1:fedcba9876543210"}]});}
      if(change==="child key"){f.setBody({...b,children:[{...b.children[0]!,renderKey:"other"}],activeKeys:["other"],visibleKeys:["other"]});}
      if(change==="visible parent"){f.setBody({...b,visibleKeys:["child","parent"]});}
      if(change==="missing child"){f.setBody({...b,children:[]});}
      if(change==="root restore"){f.setFrame(makeFacts(makeRoot("restored-body-root")));}
      const render=vi.fn(()=>renderCommandResult("Accepted"));f.observer.render(render);
      expect(render).toHaveBeenCalledTimes(1);expect(f.observer.read().pendingRender).toBe(false);
      expect(f.sink.record.mock.calls.some(c=>c[0]==="cutBodyFirstCommittedRenderSubmitMs")).toBe(false);f.observer.dispose();
    });

    it.each(["missing facts","too many children","duplicate child","oversized key","invalid digest"])("never captures malformed body facts: %s",change=>{
      const f=bodyFixture(),b=f.body();
      if(change==="missing facts"){f.readFrame.mockImplementation(()=>makeFacts(f.root));}
      if(change==="too many children"){f.setBody({...b,children:new Array(33).fill(b.children[0]!)});}
      if(change==="duplicate child"){f.setBody({...b,children:[...b.children,...b.children],receipt:{...b.receipt,children:["child","child"]}});}
      if(change==="oversized key"){f.setBody({...b,activeKeys:["x".repeat(257)]});}
      if(change==="invalid digest"){f.setBody({...b,children:[{...b.children[0]!,sourceDigest:"not-a-source-digest"}]});}
      f.apply();expect(f.observer.read().pendingRender).toBe(false);expect(f.observer.read().dropped).toBeGreaterThan(0);f.observer.dispose();
    });

    it("keeps unavailable and throwing body renders honest and preserves result/error identity",()=>{
      const f=bodyFixture();f.apply();const unavailable=renderCommandResult("BackendUnavailable");
      expect(f.observer.render(()=>unavailable)).toBe(unavailable);expect(f.observer.read().pendingRender).toBe(true);
      const error=new Error("body renderer");expect(()=>f.observer.render(()=>{throw error;})).toThrow(error);
      expect(f.observer.read().pendingRender).toBe(true);f.observer.render(()=>renderCommandResult("Accepted"));
      expect(f.sink.record.mock.calls.filter(c=>c[0]==="cutBodyFirstCommittedRenderSubmitMs")).toHaveLength(1);f.observer.dispose();
    });

    it("invalidates a terrain candidate before checking an ineligible body Applied event",()=>{
      const f=observerFixture();f.observer.confirm(()=>f.observer.trace(submitted("terrain")));
      f.observer.trace({...submitted("terrain"),phase:"cutTotalAppliedMs"});expect(f.observer.read().pendingRender).toBe(true);
      f.observer.trace({...submitted(""),phase:"cutBodyTotalAppliedMs"});expect(f.observer.read().pendingRender).toBe(false);
      expect(f.observer.read().dropReasons.superseded).toBe(1);f.observer.dispose();
    });

    it("keeps colliding terrain/body identifiers separate and removes rejected body input",()=>{
      const f=bodyFixture();f.observer.confirm(()=>{f.observer.trace(submitted("same"));f.observer.trace({...submitted("same"),phase:"cutBodySubmittedMs"});});
      expect(f.observer.read().inputCount).toBe(2);
      f.observer.trace({...submitted("same"),phase:"cutTotalRejectedMs"});expect(f.observer.read().inputCount).toBe(1);
      f.observer.trace({...submitted("same"),phase:"cutBodyTotalRecoveryHoldMs"});expect(f.observer.read().inputCount).toBe(0);
      expect(f.sink.record.mock.calls.filter(c=>c[0]==="cutBodyInputToRecoveryHoldMs")).toHaveLength(1);f.observer.dispose();
    });

    it("does not recreate body state after reentrant disposal from the input sink",()=>{
      const f=bodyFixture();f.sink.record.mockImplementation(metric=>{if(metric==="cutBodyInputToAppliedMs"){f.observer.dispose();}});
      f.apply();expect(f.observer.read()).toMatchObject({disposed:true,inputCount:0,pendingRender:false});
    });
  });

  describe("cut observation", () => {
    it.each([false, true])("P07 retains the exact input timestamp before a possibly timed-out command (body=%s)", body => {
      const f=observerFixture(),id="pending-input";
      const now=vi.spyOn(performance,"now").mockReturnValue(10);
      try {
        f.observer.confirm(()=>{
          now.mockReturnValue(17);
          f.observer.trace({...submitted(id,17),phase:body?"cutBodySubmittedMs":"cutSubmittedMs"});
        });
        const name=body?"cutBodyInputMs":"cutInputMs";
        expect(f.sink.record).toHaveBeenCalledWith(name,10,0,expect.objectContaining({commandId:id,start:10,duration:0}));
        expect(f.observer.read()).toMatchObject({inputCount:1,pendingRender:false});
        f.observer.trace({...submitted(id,17),phase:body?"cutBodySubmittedMs":"cutSubmittedMs"});
        expect(f.sink.record.mock.calls.filter(call=>call[0]===name)).toHaveLength(1);
        expect(f.sink.record.mock.calls.some(call=>String(call[0]).includes("InputTo"))).toBe(false);
      } finally { now.mockRestore();f.observer.dispose(); }
    });

    it.each(["throw", "dispose"]) ("P07 input-marker sink %s cannot alter the operation or recreate released input", action => {
      const f=observerFixture();let calls=0;
      f.sink.record.mockImplementation(name=>{
        if(name!=="cutInputMs"){return;}
        if(action==="throw"){throw new Error("input diagnostic sink");}
        f.observer.dispose();
      });
      try {
        expect(()=>f.observer.confirm(()=>{f.observer.trace(submitted());calls+=1;})).not.toThrow();
        expect(calls).toBe(1);
        expect(f.observer.read().inputCount).toBe(action==="dispose"?0:1);
        expect(f.observer.read().disposed).toBe(action==="dispose");
        if(action==="throw"){expect(f.observer.read().dropReasons.diagnosticFailure).toBe(1);}
      } finally { f.observer.dispose(); }
    });

    it("binds actual synchronous input and records each terminal outcome once", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      expect(fixture.observer.read().inputCount).toBe(1);
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      expect(fixture.observer.read().inputCount).toBe(0);
      expect(fixture.sink.record).toHaveBeenCalledWith("cutInputToAppliedMs", expect.any(Number), expect.any(Number), expect.any(Object));
      expect(fixture.observer.read()).toMatchObject({ inputCount: 0, pendingRender: true });
      const noInput = observerFixture();
      noInput.observer.trace(terminal("cutTotalNoOpMs", "no-input"));
      expect(noInput.sink.record).not.toHaveBeenCalledWith("cutInputToNoOpMs", expect.anything(), expect.anything(), expect.anything());
      expect(noInput.observer.read().dropReasons.missingInput).toBe(1);
    });

    it.each([
      ["Applied", "cutInputToAppliedMs"],
      ["NoOp", "cutInputToNoOpMs"],
      ["Rejected", "cutInputToRejectedMs"],
      ["RecoveryHold", "cutInputToRecoveryHoldMs"]
    ] as const)("records the %s input interval", (status, metric) => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted(`outcome-${status}`)); });
      fixture.observer.trace(terminal(`cutTotal${status}Ms` as "cutTotalAppliedMs" | "cutTotalNoOpMs" | "cutTotalRejectedMs" | "cutTotalRecoveryHoldMs", `outcome-${status}`));
      expect(fixture.sink.record).toHaveBeenCalledWith(metric, expect.any(Number), expect.any(Number), expect.any(Object));
      expect(fixture.observer.read().inputCount).toBe(0);
      expect(fixture.observer.read().dropReasons.missingInput).toBe(0);
    });

    it("binds before synchronous targeting and preserves the original operation result", () => {
      const now = vi.spyOn(performance, "now").mockReturnValueOnce(10).mockReturnValueOnce(17);
      const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(1000);
      const fixture = observerFixture();
      const value = { targeted: true };
      try {
        let returned: typeof value | undefined;
        fixture.observer.confirm(() => {
          returned = value;
          fixture.observer.trace(submitted("targeted", 17));
        });
        fixture.observer.trace(terminal("cutTotalRejectedMs", "targeted", 20, 5));
        expect(returned).toBe(value);
        expect(fixture.sink.record).toHaveBeenCalledWith("cutInputToRejectedMs", 10, 15, expect.any(Object));
      } finally {
        origin.mockRestore();
        now.mockRestore();
      }
    });

    it("preserves confirm error identity and restores nested input scope", () => {
      const fixture = observerFixture();
      const original = new Error("confirm failure");
      let caught: unknown;
      try {
        fixture.observer.confirm(() => {
          fixture.observer.trace(submitted("outer-before"));
          try {
            fixture.observer.confirm(() => {
              fixture.observer.trace(submitted("inner"));
              throw original;
            });
          } catch (error) {
            caught = error;
          }
          fixture.observer.trace(submitted("outer-after"));
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
      expect(fixture.observer.read().inputCount).toBe(3);
    });

    it("keeps nine input records bounded and rejects duplicate bindings without overwriting", () => {
      const fixture = observerFixture();
      for (let index = 0; index < 9; index += 1) {
        fixture.observer.confirm(() => { fixture.observer.trace(submitted(`cut-${index}`)); });
      }
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("cut-overflow")); });
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("cut-0", 99)); });
      expect(fixture.observer.read().inputCount).toBe(9);
      expect(fixture.observer.read().dropReasons.overflow).toBe(1);
      expect(fixture.observer.read().dropReasons.invalidSpan).toBe(1);
    });

    it("does not rebind after a submitted sink disposes the observer", () => {
      let observer!: ReturnType<typeof createHvpCutObservation>;
      const sink = { record: vi.fn((metric: string) => { if (metric === "cutSubmittedMs") { observer.dispose(); } }) };
      const root = makeRoot();
      observer = createHvpCutObservation(sink, () => makeFacts(root));
      observer.confirm(() => { observer.trace(submitted("disposed-submit")); });
      expect(observer.read()).toMatchObject({ inputCount: 0, disposed: true });
    });

    it("does not recreate a pending render after an input-latency sink disposes it", () => {
      let observer!: ReturnType<typeof createHvpCutObservation>;
      const sink = { record: vi.fn((metric: string) => { if (metric === "cutInputToAppliedMs") { observer.dispose(); } }) };
      const root = makeRoot();
      observer = createHvpCutObservation(sink, () => makeFacts(root));
      observer.confirm(() => { observer.trace(submitted("disposed-applied")); });
      observer.trace(terminal("cutTotalAppliedMs", "disposed-applied"));
      expect(observer.read()).toMatchObject({ inputCount: 0, pendingRender: false, disposed: true });
    });

    it("invalidates an old Applied candidate before replacement eligibility is checked", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("old")); });
      fixture.observer.trace(terminal("cutTotalAppliedMs", "old"));
      expect(fixture.observer.read().pendingRender).toBe(true);
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("new")); });
      fixture.observer.trace(terminal("cutTotalAppliedMs", "new", -1));
      expect(fixture.observer.read().pendingRender).toBe(false);
      expect(fixture.observer.read().dropReasons.superseded).toBe(1);
      expect(fixture.observer.read().dropReasons.invalidSpan).toBe(1);
    });

    it("invalidates an old candidate before an invalid Applied id is inspected", () => {
      for (const commandId of ["", "x".repeat(129)]) {
        const fixture = observerFixture();
        fixture.observer.confirm(() => { fixture.observer.trace(submitted("old")); });
        fixture.observer.trace(terminal("cutTotalAppliedMs", "old"));
        fixture.observer.trace({ ...terminal("cutTotalAppliedMs", commandId), commandId });
        expect(fixture.observer.read().pendingRender).toBe(false);
      }
    });

    it("prevents a reentrant render from attributing an old candidate during Applied relay", () => {
      let observer!: ReturnType<typeof createHvpCutObservation>;
      const root = makeRoot();
      let reentrantResult: ReturnType<typeof renderCommandResult> | undefined;
      const sink = { record: vi.fn((metric: string, _start: number, _duration: number, detail: unknown) => {
        if (metric === "cutTotalAppliedMs" && (detail as { commandId?: string }).commandId === "replacement") {
          reentrantResult = observer.render(() => renderCommandResult("Accepted"));
        }
      }) };
      observer = createHvpCutObservation(sink, () => makeFacts(root));
      observer.confirm(() => { observer.trace(submitted("old")); });
      observer.trace(terminal("cutTotalAppliedMs", "old"));
      observer.trace(terminal("cutTotalAppliedMs", "replacement"));
      expect(reentrantResult?.status).toBe("Accepted");
      expect(sink.record.mock.calls.filter(([metric]) => metric === "cutFirstCommittedRenderSubmitMs")).toHaveLength(0);
      expect(observer.read().pendingRender).toBe(false);
    });

    it.each(["sink", "readFrame"] as const)("does not let a newer Applied event resurrect an older candidate through %s reentrancy", mode => {
      const root = makeRoot();
      let observer!: ReturnType<typeof createHvpCutObservation>;
      let fired = false;
      const sink = { record: vi.fn((metric: string, _start: number, _duration: number) => {
        if (mode === "sink" && metric === "cutInputToAppliedMs" && !fired) {
          fired = true;
          observer.trace(terminal("cutTotalAppliedMs", "newer"));
        }
      }) };
      let reads = 0;
      observer = createHvpCutObservation(sink, () => {
        reads += 1;
        if (mode === "readFrame" && reads === 1 && !fired) {
          fired = true;
          observer.trace(terminal("cutTotalAppliedMs", "newer"));
        }
        return makeFacts(root);
      });
      observer.confirm(() => { observer.trace(submitted("older")); });
      observer.trace(terminal("cutTotalAppliedMs", "older"));
      expect(observer.read().pendingRender).toBe(false);
      expect(observer.read().dropReasons.missingInput).toBeGreaterThan(0);
    });

    it("does not create a render candidate without an Applied marker", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      const result = renderCommandResult("Accepted");
      expect(fixture.observer.render(() => result)).toBe(result);
      expect(fixture.observer.read().pendingRender).toBe(false);
      expect(fixture.sink.record).not.toHaveBeenCalledWith("cutFirstCommittedRenderSubmitMs", expect.anything(), expect.anything(), expect.anything());
    });

    it("requires exact root, native, active, visible and recovery facts for one Accepted render", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      const result = renderCommandResult("Accepted");
      expect(fixture.observer.render(() => result)).toBe(result);
      expect(fixture.observer.read().pendingRender).toBe(false);
      expect(fixture.sink.record).toHaveBeenCalledWith("cutFirstCommittedRenderSubmitMs", expect.any(Number), expect.any(Number), expect.objectContaining({ commandId: "cut-1" }));
      expect(fixture.observer.render(() => renderCommandResult("Accepted"))).toEqual(renderCommandResult("Accepted"));
    });

    it("excludes post-read cost from the successful render latency", () => {
      const now = vi.spyOn(performance, "now").mockReturnValueOnce(10).mockReturnValueOnce(30).mockReturnValueOnce(40).mockReturnValueOnce(1000);
      const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(1000);
      const root = makeRoot();
      const facts = makeFacts(root);
      const sink = { record: vi.fn() };
      let reads = 0;
      const observer = createHvpCutObservation(sink, () => {
        reads += 1;
        if (reads === 3) {
          performance.now();
        }
        return facts;
      });
      try {
        observer.confirm(() => { observer.trace(submitted("clock-bound", 10)); });
        observer.trace(terminal("cutTotalAppliedMs", "clock-bound", 20, 5));
        const result = renderCommandResult("Accepted");
      expect(observer.render(() => result)).toBe(result);
      expect(sink.record).toHaveBeenCalledWith("cutFirstCommittedRenderSubmitMs", 10, 30, expect.any(Object));
      } finally {
        origin.mockRestore();
        now.mockRestore();
      }
    });

    it("does not resurrect a superseded pending observation after temporary rollback", () => {
      const root = makeRoot();
      const originalFacts = makeFacts(root);
      let facts = originalFacts;
      const sink = { record: vi.fn() };
      const observer = createHvpCutObservation(sink, () => facts);
      observer.confirm(() => { observer.trace(submitted("temporary")); });
      observer.trace(terminal("cutTotalAppliedMs", "temporary"));
      facts = makeFacts(root, ["hvp:terrain:s1"], ["hvp:terrain:s1"]);
      expect(observer.render(() => renderCommandResult("Accepted")).status).toBe("Accepted");
      facts = originalFacts;
      expect(observer.render(() => renderCommandResult("Accepted")).status).toBe("Accepted");
      expect(sink.record.mock.calls.filter(([metric]) => metric === "cutFirstCommittedRenderSubmitMs")).toHaveLength(0);
      expect(observer.read().pendingRender).toBe(false);
      expect(observer.read().dropReasons.superseded).toBe(1);
    });

    it("keeps BackendUnavailable pending, rejects mismatches, and distinguishes a new Root identity", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      expect(fixture.observer.render(() => renderCommandResult("BackendUnavailable"))).toMatchObject({ status: "BackendUnavailable" });
      expect(fixture.observer.read().pendingRender).toBe(true);
      fixture.setFacts(makeFacts(fixture.root, ["hvp:terrain:s0", "hvp:terrain:s1"], ["hvp:terrain:s0", "hvp:terrain:s1"]));
      expect(fixture.observer.render(() => renderCommandResult("Accepted"))).toMatchObject({ status: "Accepted" });
      expect(fixture.observer.read().pendingRender).toBe(false);
      const replacement = observerFixture();
      replacement.observer.confirm(() => { replacement.observer.trace(submitted()); });
      replacement.observer.trace(terminal("cutTotalAppliedMs"));
      replacement.setFacts(makeFacts(makeRoot("replacement")));
      replacement.observer.render(() => renderCommandResult("Accepted"));
      expect(replacement.observer.read().dropReasons.superseded).toBe(1);
    });

    it("emits exactly one success after BackendUnavailable when facts remain unchanged", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      const unavailable = renderCommandResult("BackendUnavailable");
      expect(fixture.observer.render(() => unavailable)).toBe(unavailable);
      const accepted = renderCommandResult("Accepted");
      expect(fixture.observer.render(() => accepted)).toBe(accepted);
      expect(fixture.sink.record.mock.calls.filter(([metric]) => metric === "cutFirstCommittedRenderSubmitMs")).toHaveLength(1);
      expect(fixture.observer.read().pendingRender).toBe(false);
    });

    it("rejects native, recovery and stale-extra-visible mismatches", () => {
      for (const factsChange of [
        (root: ReturnType<typeof makeRoot>) => makeFacts(root, ["hvp:terrain:s0"], ["hvp:terrain:s0", "hvp:terrain:s1"]),
        (root: ReturnType<typeof makeRoot>) => makeFacts(root, ["hvp:terrain:s0"], ["hvp:terrain:s0"], root.read().revision + 1),
        (root: ReturnType<typeof makeRoot>) => makeFacts(root, ["hvp:terrain:s0"], ["hvp:terrain:s0"], root.read().revision, true)
      ]) {
        const fixture = observerFixture();
        fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
        fixture.observer.trace(terminal("cutTotalAppliedMs"));
        fixture.setFacts(factsChange(fixture.root));
        fixture.observer.render(() => renderCommandResult("Accepted"));
        expect(fixture.observer.read().pendingRender).toBe(false);
        expect(fixture.observer.read().dropReasons.superseded + fixture.observer.read().dropReasons.invalidFrame).toBeGreaterThan(0);
      }
    });

    it("preserves render result and thrown identity across pre/post, clock and sink failures", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      fixture.setReadFailure(true);
      const result = renderCommandResult("Accepted");
      expect(fixture.observer.render(() => result)).toBe(result);
      const throwing = observerFixture();
      throwing.sink.record.mockImplementation(() => { throw new Error("sink failure"); });
      throwing.observer.confirm(() => { throwing.observer.trace(submitted()); });
      throwing.observer.trace(terminal("cutTotalAppliedMs"));
      expect(throwing.observer.read().pendingRender).toBe(true);
      const original = new Error("renderer failure");
      expect(() => throwing.observer.render(() => { throw original; })).toThrowError(original);
      throwing.observer.dispose();
      expect(() => throwing.observer.render(() => result)).not.toThrow();
    });

    it("guards pre and post comparison faults while preserving callback count and throw identity", () => {
      const root = makeRoot();
      const base = makeFacts(root);
      const makeFault = () => {
        const original = new Error("comparison getter failure");
        let reads = 0;
        const facts = { ...base, get activeTerrainKeys() {
          reads += 1;
          if (reads > 1) {
            throw original;
          }
          return ["hvp:terrain:s0"];
        } };
        return { facts, original };
      };
      let preReads = 0;
      const preFault = makeFault();
      const preSink = { record: vi.fn() };
      const pre = createHvpCutObservation(preSink, () => {
        preReads += 1;
        return preReads === 1 ? base : preFault.facts;
      });
      pre.confirm(() => { pre.trace(submitted("pre-fault")); });
      pre.trace(terminal("cutTotalAppliedMs", "pre-fault"));
      let preRuns = 0;
      const preResult = renderCommandResult("Accepted");
      expect(pre.render(() => { preRuns += 1; return preResult; })).toBe(preResult);
      expect(preRuns).toBe(1);

      let postReads = 0;
      const postFault = makeFault();
      const post = createHvpCutObservation({ record: vi.fn() }, () => {
        postReads += 1;
        return postReads < 3 ? base : postFault.facts;
      });
      post.confirm(() => { post.trace(submitted("post-fault")); });
      post.trace(terminal("cutTotalAppliedMs", "post-fault"));
      let postRuns = 0;
      const postResult = renderCommandResult("Accepted");
      expect(post.render(() => { postRuns += 1; return postResult; })).toBe(postResult);
      expect(postRuns).toBe(1);

      let throwReads = 0;
      const throwing = createHvpCutObservation({ record: vi.fn() }, () => {
        throwReads += 1;
        return throwReads === 1 ? base : preFault.facts;
      });
      throwing.confirm(() => { throwing.trace(submitted("throw-fault")); });
      throwing.trace(terminal("cutTotalAppliedMs", "throw-fault"));
      const original = new Error("renderer failure");
      let caught: unknown;
      try {
        throwing.render(() => { throw original; });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(original);
    });

    it("does not emit success after a post-probe disposal", () => {
      const root = makeRoot();
      const facts = makeFacts(root);
      let reads = 0;
      const sink = { record: vi.fn() };
      let observer!: ReturnType<typeof createHvpCutObservation>;
      observer = createHvpCutObservation(sink, () => {
        reads += 1;
        if (reads === 3) {
          observer.dispose();
        }
        return facts;
      });
      observer.confirm(() => { observer.trace(submitted("post-dispose")); });
      observer.trace(terminal("cutTotalAppliedMs", "post-dispose"));
      observer.render(() => renderCommandResult("Accepted"));
      expect(observer.read().disposed).toBe(true);
      expect(sink.record.mock.calls.filter(([metric]) => metric === "cutFirstCommittedRenderSubmitMs")).toHaveLength(0);
    });

    it("calls render once when pre-read fails and keeps a later accepted result exact", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      fixture.setReadFailure(true);
      const result = renderCommandResult("Accepted");
      let runs = 0;
      expect(fixture.observer.render(() => { runs += 1; return result; })).toBe(result);
      expect(runs).toBe(1);
      expect(fixture.observer.read().dropReasons.invalidFrame).toBe(1);
    });

    it("does not claim success when the clock or WeakRef is unavailable", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted()); });
      fixture.observer.trace(terminal("cutTotalAppliedMs"));
      const now = vi.spyOn(performance, "now").mockImplementation(() => { throw new Error("clock"); });
      try {
        const result = renderCommandResult("Accepted");
        expect(fixture.observer.render(() => result)).toBe(result);
        expect(fixture.observer.read().pendingRender).toBe(false);
      } finally {
        now.mockRestore();
      }

      const collected = observerFixture();
      collected.observer.confirm(() => { collected.observer.trace(submitted()); });
      collected.observer.trace(terminal("cutTotalAppliedMs"));
      const originalDeref = Object.getOwnPropertyDescriptor(WeakRef.prototype, "deref");
      try {
        Object.defineProperty(WeakRef.prototype, "deref", { configurable: true, value: () => undefined });
        collected.observer.render(() => renderCommandResult("Accepted"));
        expect(collected.observer.read().dropReasons.collectedRoot).toBe(1);
      } finally {
        if (originalDeref) {
          Object.defineProperty(WeakRef.prototype, "deref", originalDeref);
        } else {
          delete (WeakRef.prototype as { deref?: unknown }).deref;
        }
      }
    });

    it("validates bounded keys and raw span timing without retaining invalid payload", () => {
      const fixture = observerFixture();
      fixture.observer.trace({ ...submitted(), origin: -1 });
      fixture.observer.trace({ ...submitted("bad-phase"), phase: "bad phase" });
      fixture.observer.trace({ ...submitted("valid"), phase: "cutTotalRejectedMs" });
      expect(fixture.observer.read().dropReasons.invalidSpan).toBe(2);
      fixture.setFacts(makeFacts(fixture.root, new Array(65).fill("hvp:terrain:s0"), ["hvp:terrain:s0"]));
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("valid")); });
      fixture.observer.trace(terminal("cutTotalAppliedMs", "valid"));
      expect(fixture.observer.read().dropReasons.overflow).toBeGreaterThan(0);
    });

    it("rejects negative translated times before retaining or recording terminal input", () => {
      const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(1000);
      const now = vi.spyOn(performance, "now").mockReturnValue(10);
      try {
        const submittedFixture = observerFixture();
        submittedFixture.observer.confirm(() => { submittedFixture.observer.trace({ ...submitted("negative-submit", 50), origin: 900 }); });
        expect(submittedFixture.observer.read().inputCount).toBe(0);

        const terminalFixture = observerFixture();
        terminalFixture.observer.confirm(() => { terminalFixture.observer.trace(submitted("negative-terminal", 10)); });
        terminalFixture.observer.trace({ ...terminal("cutTotalRejectedMs", "negative-terminal", 50, 100), origin: 900 });
        expect(terminalFixture.sink.record).not.toHaveBeenCalledWith("cutInputToRejectedMs", expect.anything(), expect.anything(), expect.anything());
        expect(terminalFixture.observer.read().inputCount).toBe(0);
      } finally {
        origin.mockRestore();
        now.mockRestore();
      }
    });

    it("rejects overflowing confirm time and terminal endpoints while cleaning known ids", () => {
      const origin = vi.spyOn(performance, "timeOrigin", "get").mockReturnValue(Number.MAX_VALUE);
      const now = vi.spyOn(performance, "now").mockReturnValue(Number.MAX_VALUE);
      try {
        const confirmFixture = observerFixture();
        confirmFixture.observer.confirm(() => { confirmFixture.observer.trace({ ...submitted("overflow-confirm", 0), origin: Number.MAX_VALUE }); });
        expect(confirmFixture.observer.read().inputCount).toBe(0);

        origin.mockReturnValue(1000);
        now.mockReturnValue(10);
        const terminalFixture = observerFixture();
        terminalFixture.observer.confirm(() => { terminalFixture.observer.trace(submitted("overflow-terminal", 0)); });
        expect(terminalFixture.observer.read().inputCount).toBe(1);
        terminalFixture.observer.trace({ ...terminal("cutTotalRejectedMs", "overflow-terminal", Number.MAX_VALUE, 0), origin: Number.MAX_VALUE });
        expect(terminalFixture.observer.read().inputCount).toBe(0);
        expect(terminalFixture.observer.read().dropReasons.invalidSpan).toBeGreaterThan(0);
        expect(terminalFixture.sink.record).not.toHaveBeenCalledWith("cutInputToRejectedMs", expect.anything(), expect.anything(), expect.anything());
      } finally {
        origin.mockRestore();
        now.mockRestore();
      }
    });

    it("lets replay and conflict markers relay without rebinding input", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => {
        fixture.observer.trace(submitted("replay"));
        fixture.observer.trace({ ...submitted("replay"), phase: "cutIdempotencyReplayMs" });
        fixture.observer.trace({ ...submitted("replay"), phase: "cutIdempotencyConflictMs" });
      });
      expect(fixture.observer.read().inputCount).toBe(1);
      expect(fixture.observer.read().dropReasons.invalidSpan).toBe(0);
      fixture.observer.trace(terminal("cutTotalRejectedMs", "replay"));
      expect(fixture.observer.read().inputCount).toBe(0);
    });

    it("replaces old pending observations for missing-input and oversized Applied events", () => {
      const missing = observerFixture();
      missing.observer.confirm(() => { missing.observer.trace(submitted("old")); });
      missing.observer.trace(terminal("cutTotalAppliedMs", "old"));
      missing.observer.trace(terminal("cutTotalAppliedMs", "missing"));
      expect(missing.observer.read().pendingRender).toBe(false);
      expect(missing.observer.read().dropReasons.missingInput).toBe(1);

      const oversized = observerFixture();
      oversized.observer.confirm(() => { oversized.observer.trace(submitted("old")); });
      oversized.observer.trace(terminal("cutTotalAppliedMs", "old"));
      oversized.observer.confirm(() => { oversized.observer.trace(submitted("oversized")); });
      oversized.setFacts(makeFacts(oversized.root, new Array(65).fill("hvp:terrain:s0"), ["hvp:terrain:s0"]));
      oversized.observer.trace(terminal("cutTotalAppliedMs", "oversized"));
      expect(oversized.observer.read().pendingRender).toBe(false);
      expect(oversized.observer.read().dropReasons.overflow).toBeGreaterThan(0);
    });

    it("cleans terminal input for invalid raw timing and ignores late samples after dispose", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("invalid-terminal")); });
      fixture.observer.trace({ ...terminal("cutTotalRejectedMs", "invalid-terminal"), duration: -1 });
      expect(fixture.observer.read().inputCount).toBe(0);
      expect(fixture.observer.read().dropReasons.invalidSpan).toBe(1);
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("disposed")); });
      fixture.observer.dispose();
      fixture.observer.trace(terminal("cutTotalAppliedMs", "disposed"));
      expect(fixture.observer.read()).toMatchObject({ inputCount: 0, pendingRender: false, disposed: true });
      expect(fixture.observer.read().dropReasons.disposed).toBe(1);
    });

    it("counts both pending and input state when disposed", () => {
      const fixture = observerFixture();
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("pending")); });
      fixture.observer.trace(terminal("cutTotalAppliedMs", "pending"));
      fixture.observer.confirm(() => { fixture.observer.trace(submitted("queued")); });
      fixture.observer.dispose();
      expect(fixture.observer.read().dropReasons.disposed).toBe(2);
      expect(fixture.observer.read().dropped).toBe(2);
    });
  });
});
