import { beforeAll, describe, expect, it, vi } from "vitest";
import { createHvpHud, type HvpHudActions } from "../../src/hvp/hvpHud";
import { createHvpPhysicsSession } from "../../src/hestia-prototype/physics/session";
import { createHvpSalvageLoop } from "../../src/hestia-prototype/gameplay/salvageLoop";

type Writes = { textContent: number; setAttribute: number; disabled: number; hidden: number; dataset: number; style: number };
const emptyWrites = (): Writes => ({ textContent: 0, setAttribute: 0, disabled: 0, hidden: 0, dataset: 0, style: 0 });

// Count setter invocations, including equal-value assignments. MutationObserver
// alone would miss redundant property writes. Keep instrumentation out of runtime.
class CountingElement extends EventTarget {
  id = "";
  readonly children: CountingElement[] = [];
  readonly attributes = new Map<string, string>();
  readonly dataset: Record<string, string>;
  readonly style: Record<string, string>;
  parent?: CountingElement;
  #text = "";
  #disabled = false;
  #hidden = false;
  constructor(readonly tagName: string, readonly writes: Writes) {
    super();
    const track = (kind: "dataset" | "style") => new Proxy<Record<string, string>>({}, {
      set: (target, key, value) => { writes[kind] += 1; return Reflect.set(target, key, value); }
    });
    this.dataset = track("dataset");
    this.style = track("style");
  }
  get textContent(): string { return this.#text; }
  set textContent(value: string) { this.writes.textContent += 1; this.#text = value; }
  get disabled(): boolean { return this.#disabled; }
  set disabled(value: boolean) { this.writes.disabled += 1; this.#disabled = value; }
  get hidden(): boolean { return this.#hidden; }
  set hidden(value: boolean) { this.writes.hidden += 1; this.#hidden = value; }
  append(...children: CountingElement[]): void {
    children.forEach(child => { child.parent = this; });
    this.children.push(...children);
  }
  setAttribute(name: string, value: string): void { this.writes.setAttribute += 1; this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  remove(): void {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = undefined;
  }
}

let physicsFixture: ReturnType<HvpHudActions["readPhysics"]>;
beforeAll(async () => {
  // Obtain the complete real snapshot shape once, without a worker or bootstrap.
  const session = await createHvpPhysicsSession([], { x: 0, y: 8, z: 0 }, 9.81,
    { spawn: { x: 0, y: 1, z: 0 }, coverage: [{ minX: -16, maxX: 16, minZ: -16, maxZ: 16 }] },
    { x: 2, y: 2, z: 0 }, { x: 4, y: 2, z: 0 });
  try { physicsFixture = session.read(); } finally { session.dispose(); }
});

const harness = () => {
  const writes = emptyWrites();
  const body = new CountingElement("body", writes), host = new CountingElement("main", writes);
  body.append(host);
  body.dataset.hestiaPrototypeCamera = "C01-EYE";
  const view: {
    physics: ReturnType<HvpHudActions["readPhysics"]>;
    tool: ReturnType<HvpHudActions["readTool"]>;
    save: ReturnType<HvpHudActions["readSave"]>;
    salvage: ReturnType<HvpHudActions["readSalvage"]>;
    neighbor: ReturnType<HvpHudActions["readNeighbor"]>;
    dormancy: ReturnType<HvpHudActions["readDormancy"]>;
    support: ReturnType<HvpHudActions["readSupport"]>;
    aim: ReturnType<HvpHudActions["readAimScreen"]>;
    thirdPerson: boolean;
  } = {
    physics: { ...physicsFixture, status: "Running", player: { ...physicsFixture.player!, status: "Walking" } },
    tool: { mode: "Zelle", edges: 0, issued: 0, message: "Kein Ziel innerhalb 4 m", state: "Idle", queued: 0, receipts: 0,
      last: undefined, structural: { state: "Ready", issued: 0, last: null }, moving: { state: "Idle", issued: 0, last: null } },
    save: { state: "Idle", message: "Bereit", revision: null },
    salvage: createHvpSalvageLoop("hud-test").read(),
    neighbor: { state: "Ready", epoch: 1, wanted: true, pinned: false, lod: .125, collisionReady: true, transitions: 3,
      busy: false, recoveryHold: false, error: "", key: "east", renderLod: .125, proxyOnly: false, sourceDigest: "12345678",
      sourceBytes: 0, checkpointBytes: 0, cacheBytes: 0, cacheEntries: 0, cacheHits: 0, cacheMisses: 0, adoptions: 0, stale: 0 },
    dormancy: { busy: false, recoveryHold: false, error: "", changes: 0 },
    support: { state: "Ready", cells: 384, massKg: 1722.65625, fragments: 1, message: "Stütze bestätigt" },
    aim: { x: 50, y: 50, visible: true }, thirdPerson: false
  };
  const actions: HvpHudActions = {
    setPreset: vi.fn(), resetCamera: vi.fn(), readWaterEnabled: vi.fn(() => true), setWaterEnabled: vi.fn(),
    readInspectEnabled: vi.fn(() => false), setInspectEnabled: vi.fn(), readAoEnabled: vi.fn(() => true), setAoEnabled: vi.fn(),
    readPhysics: vi.fn(() => view.physics), physicsCommand: vi.fn(async () => {}), play: vi.fn(),
    readThirdPerson: vi.fn(() => view.thirdPerson), readAimScreen: vi.fn(() => view.aim), togglePlayerView: vi.fn(),
    readTool: vi.fn(() => view.tool), selectTool: vi.fn(), aimImpulse: vi.fn(), aimBranch: vi.fn(), previewSupport: vi.fn(),
    aimRock: vi.fn(), restartRock: vi.fn(), readSupport: vi.fn(() => view.support), readSave: vi.fn(() => view.save),
    save: vi.fn(), load: vi.fn(), loadNewSession: vi.fn(), readSalvage: vi.fn(() => view.salvage), restartSalvage: vi.fn(),
    readNeighbor: vi.fn(() => view.neighbor), readDormancy: vi.fn(() => view.dormancy), retryNeighbor: vi.fn(),
    restartEast: vi.fn(), endSession: vi.fn()
  };
  const hud = createHvpHud({ host: host as unknown as HTMLElement,
    documentPort: { body, createElement: (tag: string) => new CountingElement(tag, writes) } as unknown as Document, actions });
  const find = (id: string): CountingElement => {
    const visit = (node: CountingElement): CountingElement | undefined => {
      if (node.id === id) return node;
      for (const child of node.children) { const found = visit(child); if (found) return found; }
    };
    const result = visit(body); if (!result) throw new Error(`Missing HUD element ${id}`); return result;
  };
  const resetCounts = () => {
    Object.assign(writes, emptyWrites());
    for (const action of Object.values(actions)) vi.mocked(action).mockClear();
  };
  const reads = () => Object.fromEntries(["readPhysics", "readTool", "readSave", "readSalvage", "readNeighbor", "readDormancy",
    "readSupport", "readThirdPerson", "readAimScreen"].map(name => [name, vi.mocked(actions[name as keyof HvpHudActions]).mock.calls.length]));
  resetCounts();
  return { hud, body, host, view, actions, writes, find, resetCounts, reads };
};

describe("HVP HUD frame hotpath", () => {
  // Phase A at b3c6523a94cd050f5a9a22dc27f4777fcc03363e, before the fix:
  // identical second call: text=15, setAttribute=0, disabled=32, hidden=6,
  // dataset=1, style=3; readPhysics=2, readThirdPerson=2, other reads=1 each.
  // Reproduce with this test against that HUD; the zero-write assertion fails.
  it("measures an identical snapshot twice without redundant mutations on the second call", () => {
    const h = harness();
    try {
      h.hud.updatePhysics();
      const first = { writes: { ...h.writes }, reads: h.reads() };
      h.resetCounts(); h.hud.updatePhysics();
      console.info("HVP HUD mutations", JSON.stringify({ first, repeated: { writes: h.writes, reads: h.reads() } }));
      expect(h.writes).toEqual(emptyWrites());
      expect(h.reads()).toEqual({ readPhysics: 1, readTool: 1, readSave: 1, readSalvage: 1, readNeighbor: 1,
        readDormancy: 1, readSupport: 1, readThirdPerson: 1, readAimScreen: 1 });
      // Fresh wrapper identities with equal displayed values must also be inert.
      h.view.save = { ...h.view.save }; h.view.tool = { ...h.view.tool }; h.view.physics = { ...h.view.physics };
      h.resetCounts(); h.hud.updatePhysics(); expect(h.writes).toEqual(emptyWrites());
    } finally { h.hud.dispose(); }
  });

  it("projects changed physics, impulse feedback and aim on the very next update", () => {
    const h = harness();
    try {
      h.hud.updatePhysics();
      h.view.physics = { ...h.view.physics, status: "Paused", bodyCount: 7,
        player: { ...h.view.physics.player!, grounded: true, status: "Inspection" },
        lastImpulse: { status: "Applied", target: "hvp:physics:inertia", reason: "Solver contact impulse" } };
      h.view.aim = { x: 40, y: 60, visible: false };
      h.hud.updatePhysics();
      expect(h.find("hvp-physics-status").textContent).toContain("Physics: Paused · 7 bodies");
      expect(h.find("hvp-physics-status").textContent).toContain("Player: Inspection (Boden)");
      expect(h.find("hvp-physics-pause").textContent).toBe("Physik fortsetzen");
      expect(h.find("hvp-mode").textContent).toBe("Camera: C01-EYE (Orbit)");
      expect(h.find("hvp-hud").hidden).toBe(false);
      expect(h.find("hvp-interaction").hidden).toBe(true);
      expect(h.find("hvp-interaction-feedback").textContent).toContain("Stoß ausgelöst");
      expect(h.find("hvp-aim-reticle").hidden).toBe(true);
      expect(h.find("hvp-aim-reticle").style).toMatchObject({ left: "40%", top: "60%" });
    } finally { h.hud.dispose(); }
  });

  it("updates tool results and removes obsolete support text", () => {
    const h = harness();
    try {
      h.hud.updatePhysics();
      h.view.tool = { ...h.view.tool, mode: "Box 0,5 m", message: "Schnitt bestätigt", state: "Applied",
        last: { commandId: "cut-1", status: "Applied", revision: 1, removedCells: 8, reason: "8 Zellen entfernt" },
        structural: { state: "Ready", issued: 1, last: { id: "branch-1", status: "Applied", reason: "Ast gelöst" } },
        moving: { state: "Idle", issued: 1, last: { id: "moving-1", status: "Applied", reason: "Fragment geschnitten" } } };
      h.view.support = { ...h.view.support, state: "Idle" }; h.hud.updatePhysics();
      const text = h.find("hvp-tool-status").textContent;
      expect(text).toContain("Box 0,5 m · Applied · 8 Zellen entfernt");
      expect(text).toContain("Ast: Applied · Ast gelöst");
      expect(text).toContain("Fragment: Applied · Fragment geschnitten");
      expect(text).not.toContain("Stützvorschau");
      expect(h.find("hvp-cut-feedback").textContent).toBe("Box 0,5 m · Linksklick: Schnitt bestätigt");
      expect(h.find("hvp-cut-feedback").getAttribute("aria-live")).toBe("polite");
    } finally { h.hud.dispose(); }
  });

  it.each(["terrain", "structural", "moving"] as const)("shows Pending and RecoveryHold from %s with recovery priority", source => {
    const h = harness();
    const setState = (state: "Pending" | "RecoveryHold") => {
      h.view.tool = source === "terrain" ? { ...h.view.tool, state }
        : { ...h.view.tool, [source]: { ...h.view.tool[source]!, state } };
    };
    try {
      h.hud.updatePhysics(); setState("Pending"); h.hud.updatePhysics();
      expect(h.find("hvp-cut-feedback").textContent).toContain("Schneiden …");
      setState("RecoveryHold"); h.view.tool = { ...h.view.tool, state: source === "terrain" ? "RecoveryHold" : "Pending" };
      h.hud.updatePhysics();
      expect(h.find("hvp-cut-feedback").textContent).toBe("Schnitt angehalten: Wiederherstellung nicht bestätigt.");
    } finally { h.hud.dispose(); }
  });

  it.each(["Saving", "Loading", "RecoveryHold", "Saved", "Rejected"])("projects save %s and re-enables controls immediately", state => {
    const h = harness();
    try {
      h.hud.updatePhysics(); h.view.save = { state, message: "Neuer Stand", revision: 3 }; h.hud.updateSave();
      const blocked = ["Saving", "Loading", "RecoveryHold"].includes(state);
      for (const id of ["hvp-save", "hvp-load", "hvp-play", "hvp-player-view", "hvp-salvage-play", "hvp-salvage-save", "hvp-salvage-restart"]) {
        expect(h.find(id).disabled, id).toBe(blocked);
      }
      expect(h.find("hvp-hide-ui").disabled).toBe(false);
      expect(h.find("hvp-save-status").textContent).toBe(`Spielstand: ${state} · Neuer Stand · r3`);
      expect(JSON.parse(h.body.dataset.hestiaPrototypeSave!)).toEqual(h.view.save);
      // Same object, changed primitive: identity caching must not keep stale text.
      Reflect.set(h.view.save, "message", "Bereit"); Reflect.set(h.view.save, "state", "Idle"); Reflect.set(h.view.save, "revision", null);
      h.hud.updatePhysics();
      expect(h.find("hvp-save").disabled).toBe(false);
      expect(h.find("hvp-salvage-save").disabled).toBe(false);
      expect(h.find("hvp-save-status").textContent).toBe("Spielstand: Idle · Bereit");
      expect(JSON.parse(h.body.dataset.hestiaPrototypeSave!)).toEqual(h.view.save);
    } finally { h.hud.dispose(); }
  });

  it("projects both directions of the third-person toggle", () => {
    const h = harness();
    try {
      h.hud.updatePhysics(); h.view.thirdPerson = true; h.hud.updatePhysics();
      expect(h.find("hvp-player-view").textContent).toBe("Perspektive: 3. Person (V)");
      expect(h.find("hvp-mode").textContent).toContain("Third Person");
      h.view.thirdPerson = false; h.hud.updatePhysics();
      expect(h.find("hvp-player-view").textContent).toBe("Perspektive: Ego (V)");
      expect(h.find("hvp-mode").textContent).toContain("First Person");
    } finally { h.hud.dispose(); }
  });

  it("projects salvage Save, Completed, target loss and absence immediately", () => {
    const h = harness();
    try {
      h.hud.updatePhysics();
      expect(h.find("hvp-salvage-panel").hidden).toBe(false);
      expect(h.find("hvp-salvage-save").hidden).toBe(true);
      h.view.salvage = { ...h.view.salvage!, stage: "Save", instruction: "Bergung speichern",
        mission: { ...h.view.salvage!.mission, objectiveStates: h.view.salvage!.mission.objectiveStates.map((o, i) =>
          i < 3 ? { ...o, state: "Completed" as const } : o) } };
      h.hud.updatePhysics();
      expect(h.find("hvp-salvage-instruction").textContent).toBe("Bergung speichern");
      expect(h.find("hvp-salvage-panel").children.find(child => child.tagName === "div")!.textContent).toContain("3/4");
      expect(h.find("hvp-salvage-save").hidden).toBe(false);
      expect(h.find("hvp-salvage-play").hidden).toBe(true);
      h.view.salvage = { ...h.view.salvage, stage: "Completed", instruction: "Bergung gesichert", targetLost: true };
      h.hud.updatePhysics();
      expect(h.find("hvp-salvage-save").hidden).toBe(true);
      expect(h.find("hvp-salvage-instruction").textContent).toContain("verändert oder verloren");
      h.view.salvage = { ...h.view.salvage, targetLost: false }; h.hud.updatePhysics();
      expect(h.find("hvp-salvage-instruction").textContent).toBe("Bergung gesichert");
      h.view.salvage = null; h.hud.updatePhysics();
      expect(h.find("hvp-salvage-panel").hidden).toBe(true);
    } finally { h.hud.dispose(); }
  });

  it("updates reticle target color and recovers visibility after hiding the UI", () => {
    const h = harness();
    try {
      h.hud.updatePhysics();
      h.view.physics = { ...h.view.physics, impulseTarget: { kind: "Dynamic", target: "hvp:physics:inertia", distanceMeters: 2,
        massKg: 35, point: { x: 2, y: 1, z: 0 } } };
      h.hud.updatePhysics();
      expect(h.find("hvp-aim-reticle").style.background).toBe("#9ce8bf");
      expect(h.find("hvp-interaction-target").textContent).toContain("35.0 kg · 2.0 m");
      h.find("hvp-hide-ui").dispatchEvent(new Event("click")); h.hud.updatePhysics();
      expect(h.find("hvp-hide-ui").getAttribute("aria-pressed")).toBe("true");
      expect(h.find("hvp-aim-reticle").hidden).toBe(true);
      expect(h.find("hvp-salvage-panel").hidden).toBe(true);
      h.find("hvp-hide-ui").dispatchEvent(new Event("click"));
      h.view.physics = { ...h.view.physics, impulseTarget: { ...h.view.physics.impulseTarget, kind: "Fixed" } };
      h.hud.updatePhysics();
      expect(h.find("hvp-aim-reticle").style.background).toBe("#f2f4ec");
      expect(h.find("hvp-aim-reticle").hidden).toBe(false);
      expect(h.find("hvp-salvage-panel").hidden).toBe(false);
      expect(h.find("hvp-hide-ui").getAttribute("aria-pressed")).toBe("false");
    } finally { h.hud.dispose(); }
  });

  it("restores the current physics display after a command error", async () => {
    const h = harness();
    try {
      h.hud.updatePhysics(); vi.mocked(h.actions.physicsCommand).mockRejectedValueOnce(new Error("Command failed"));
      h.find("hvp-physics-pause").dispatchEvent(new Event("click"));
      await vi.waitFor(() => expect(h.find("hvp-physics-status").textContent).toBe("Physics error: Command failed"));
      h.hud.updatePhysics(); expect(h.find("hvp-physics-status").textContent).toContain("Physics: Running");
    } finally { h.hud.dispose(); }
  });

  it("does not publish a late command rejection after disposal", async () => {
    const h = harness();
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
    h.hud.updatePhysics(); vi.mocked(h.actions.physicsCommand).mockReturnValueOnce(pending);
    h.find("hvp-physics-pause").dispatchEvent(new Event("click")); h.hud.dispose(); h.resetCounts();
    reject(new Error("Late rejection")); await pending.catch(() => {});
    expect(h.writes).toEqual(emptyWrites());
  });

  it("updates neighbor, dormancy and input errors without leaving old suffixes", () => {
    const h = harness();
    try {
      h.hud.updatePhysics(); h.view.neighbor = { ...h.view.neighbor!, busy: true, proxyOnly: true, collisionReady: false, error: "Ostfehler" };
      h.view.dormancy = { ...h.view.dormancy!, busy: true, error: "Residencyfehler" };
      h.body.dataset.hestiaPrototypeInputError = "Maus nicht übernommen"; h.hud.updatePhysics();
      expect(h.find("hvp-neighbor-status").textContent).toBe("Ostregion: Ready (Pending) · LOD 0.125 m (Checkpoint-Projektion) · Kollision fehlt · Ostfehler · Ruhende Fragmente: 0 (Pending) · Residencyfehler");
      expect(h.find("hvp-physics-status").textContent).toContain("Maus nicht übernommen");
      h.view.neighbor = null; h.view.dormancy = null; delete h.body.dataset.hestiaPrototypeInputError; h.hud.updatePhysics();
      expect(h.find("hvp-neighbor-status").textContent).toBe("");
      expect(h.find("hvp-physics-status").textContent).not.toContain("Maus nicht übernommen");
    } finally { h.hud.dispose(); }
  });

  it("does not read actions or update retained DOM nodes after disposal", () => {
    const h = harness(); h.hud.updatePhysics(); h.hud.dispose(); h.resetCounts();
    h.hud.updatePhysics(); h.hud.updateSave();
    expect(h.writes).toEqual(emptyWrites());
    expect(Object.values(h.reads())).toEqual(Array(9).fill(0));
    expect(h.host.children).toHaveLength(0); expect(h.hud.listenerCount).toBe(0);
  });
});
