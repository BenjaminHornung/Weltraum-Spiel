import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { HVP_SHADOW_REVISION_MAX_BYTES, sameHvpShadowRevision, type HvpShadowRevision } from "../../src/hestia-prototype/presentation/shadowRevision";
import { createHvpVisualRenderer, HVP_EFFECT_COST } from "../../src/hestia-prototype/presentation/visualEffects";

describe("HVP shadow revision comparator", () => {
  const revision = (): HvpShadowRevision => ({ light: ["light", 1, null],
    casters: [{ id: "a", values: ["geometry", 0, true, null, -0] }] });

  it("compares copied primitive values, not array identity", () => {
    expect(sameHvpShadowRevision(revision(), revision())).toBe(true);
  });

  it("detects light, membership, identity, value and tuple-length changes", () => {
    const before = revision();
    for (const changed of [
      { ...revision(), light: ["light", 2, null] },
      { ...revision(), casters: [] },
      { ...revision(), casters: [{ id: "b", values: before.casters[0]!.values }] },
      { ...revision(), casters: [{ id: "a", values: ["geometry", 1, true, null, -0] }] },
      { ...revision(), casters: [{ id: "a", values: ["geometry", 0, true, null] }] }
    ]) {
      expect(sameHvpShadowRevision(before, changed)).toBe(false);
    }
  });

  it("retains Object.is semantics rather than normalizing signed zero", () => {
    expect(sameHvpShadowRevision(revision(), { ...revision(),
      casters: [{ id: "a", values: ["geometry", 0, true, null, 0] }] })).toBe(false);
  });
});

const fixture = () => {
  const shadowMap = { enabled: false, type: THREE.BasicShadowMap, autoUpdate: true, needsUpdate: false };
  const updates: boolean[] = [];
  const render = vi.fn(() => { updates.push(shadowMap.needsUpdate); shadowMap.needsUpdate = false; });
  const release = vi.fn();
  const renderer = { shadowMap, render, dispose: release, setSize: vi.fn(), setPixelRatio: vi.fn(),
    localClippingEnabled: false, clippingPlanes: [], info: { render: { calls: 1, triangles: 12 }, memory: { geometries: 0, textures: 0 } }
  } as unknown as THREE.WebGLRenderer;
  const dataset: Record<string, string> = {};
  const canvas = { ownerDocument: { body: { dataset } } } as unknown as HTMLCanvasElement;
  const port = createHvpVisualRenderer(canvas, {}, () => renderer);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshLambertMaterial();
  const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
  mesh.name = "representation:hvp:fragment:test";
  group.add(mesh);
  const light = new THREE.DirectionalLight();
  light.castShadow = true;
  light.position.set(5, 10, 4);
  light.shadow.mapSize.set(1024, 1024);
  scene.add(group, light, light.target);
  const owned: { dispose(): void }[] = [geometry, material, light.shadow];
  const own = <T extends { dispose(): void }>(resource: T): T => { owned.push(resource); return resource; };
  const draw = () => { port.render(scene, camera); return updates.at(-1); };
  return { port, renderer, render, release, shadowMap, scene, camera, group, geometry, material, mesh, light, dataset, updates, own, draw,
    dispose: () => { port.dispose(); for (const resource of owned) { resource.dispose(); } scene.clear(); } };
};

describe("HVP shadow collector through the real visual adapter", () => {
  it("does not invalidate for a static frame, camera movement or receiver-only changes", () => {
    const f = fixture();
    try {
      const receiver = new THREE.Mesh(f.geometry, f.material);
      receiver.name = "representation:hvp:terrain:s0:r0";
      const tool = new THREE.Mesh(f.geometry, f.material);
      tool.name = "representation:hvp:tool:preview:1";
      const water = new THREE.Mesh(f.geometry, f.material);
      water.name = "representation:hvp:water";
      f.scene.add(receiver, tool, water);
      expect(f.draw()).toBe(true);
      expect(f.draw()).toBe(false);
      f.camera.position.z = 20;
      receiver.geometry = f.own(f.geometry.clone());
      receiver.position.x = 3; tool.position.y = 4; water.position.z = 5;
      expect(f.draw()).toBe(false);
      f.scene.remove(receiver, tool, water);
      expect(f.draw()).toBe(false);
      expect(f.mesh.castShadow).toBe(true);
      expect(receiver.receiveShadow).toBe(true);
      expect([receiver.castShadow, tool.castShadow, water.castShadow]).toEqual([false, false, false]);
    } finally { f.dispose(); }
  });

  it("copies the world matrix and tracks visible birth, hide and removal", () => {
    const f = fixture();
    try {
      f.draw();
      const matrix = f.mesh.matrixWorld.elements;
      f.mesh.position.x = 3;
      expect(f.draw()).toBe(true);
      expect(f.mesh.matrixWorld.elements).toBe(matrix);
      expect(f.draw()).toBe(false);
      f.mesh.visible = false;
      expect(f.draw()).toBe(true);
      f.group.remove(f.mesh);
      expect(f.draw()).toBe(false); // It already stopped contributing to the previous depth pass.
      f.mesh.visible = true; f.group.add(f.mesh);
      expect(f.draw()).toBe(true);
      f.group.remove(f.mesh);
      expect(f.draw()).toBe(true);
      expect(f.draw()).toBe(false);
    } finally { f.dispose(); }
  });

  it("uses effective parent visibility and main-camera layers", () => {
    const f = fixture();
    try {
      f.draw(); f.group.visible = false;
      expect(f.draw()).toBe(true);
      f.mesh.position.y = 4;
      expect(f.draw()).toBe(false);
      f.group.visible = true;
      expect(f.draw()).toBe(true);
      f.mesh.layers.set(1);
      expect(f.draw()).toBe(true);
      expect(f.draw()).toBe(false);
      f.camera.layers.enable(1);
      expect(f.draw()).toBe(true);
    } finally { f.dispose(); }
  });

  it.each([
    ["geometry replacement", (f: ReturnType<typeof fixture>) => { f.mesh.geometry = f.own(f.geometry.clone()); }],
    ["position upload", (f: ReturnType<typeof fixture>) => { f.geometry.getAttribute("position").needsUpdate = true; }],
    ["position identity", (f: ReturnType<typeof fixture>) => { f.geometry.setAttribute("position", f.geometry.getAttribute("position").clone()); }],
    ["index upload", (f: ReturnType<typeof fixture>) => { f.geometry.index!.needsUpdate = true; }],
    ["draw range", (f: ReturnType<typeof fixture>) => { f.geometry.setDrawRange(0, 6); }],
    ["groups", (f: ReturnType<typeof fixture>) => { f.geometry.groups[0]!.count = 3; }],
    ["material version", (f: ReturnType<typeof fixture>) => { f.material.needsUpdate = true; }],
    ["material side", (f: ReturnType<typeof fixture>) => { f.material.side = THREE.DoubleSide; }],
    ["shadow side", (f: ReturnType<typeof fixture>) => { f.material.shadowSide = THREE.FrontSide; }],
    ["alpha test", (f: ReturnType<typeof fixture>) => { f.material.alphaTest = .5; }],
    ["material visibility", (f: ReturnType<typeof fixture>) => { f.material.visible = false; }],
    ["light position", (f: ReturnType<typeof fixture>) => { f.light.position.x += 1; }],
    ["light target", (f: ReturnType<typeof fixture>) => { f.light.target.position.z = 2; }],
    ["light visibility", (f: ReturnType<typeof fixture>) => { f.light.visible = false; }],
    ["shadow projection", (f: ReturnType<typeof fixture>) => { f.light.shadow.camera.left -= 1; f.light.shadow.camera.updateProjectionMatrix(); }],
    ["shadow camera up", (f: ReturnType<typeof fixture>) => { f.light.shadow.camera.up.set(1, 0, 0); }],
    ["shadow bias", (f: ReturnType<typeof fixture>) => { f.light.shadow.bias = .01; }],
    ["shadow map size", (f: ReturnType<typeof fixture>) => { f.light.shadow.mapSize.x = 512; }]
  ] as const)("invalidates for %s and settles after that change", (name, change) => {
    const f = fixture();
    try {
      if (name === "groups") { f.mesh.material = [f.material]; }
      f.draw(); change(f); expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
    }
    finally { f.dispose(); }
  });

  it("tracks texture identity, uploads and UV transforms without hashing pixels", () => {
    const f = fixture();
    try {
      f.draw();
      const texture = f.own(new THREE.Texture());
      f.material.alphaMap = texture; f.material.alphaTest = .5;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      texture.needsUpdate = true;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      texture.offset.x = .25;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      f.geometry.getAttribute("uv").needsUpdate = true;
      expect(f.draw()).toBe(true);
    } finally { f.dispose(); }
  });

  it("distinguishes an absent group material index from index zero", () => {
    const f = fixture();
    try {
      f.mesh.material = [f.material]; f.geometry.clearGroups(); f.geometry.addGroup(0, 36, 0);
      f.draw();
      delete f.geometry.groups[0]!.materialIndex;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      f.geometry.groups[0]!.materialIndex = 0;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
    } finally { f.dispose(); }
  });

  it("copies global and local clipping planes", () => {
    const f = fixture();
    try {
      const global = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
      const local = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      f.renderer.clippingPlanes = [global]; f.renderer.localClippingEnabled = true;
      f.material.clipShadows = true; f.material.clippingPlanes = [local];
      f.draw(); expect(f.draw()).toBe(false);
      global.constant = 1;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      local.normal.z = 1;
      expect(f.draw()).toBe(true);
    } finally { f.dispose(); }
  });

  it("keeps a pending external request and does not accept a revision after a render error", () => {
    const f = fixture();
    try {
      f.draw(); f.shadowMap.needsUpdate = true;
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      f.mesh.position.x = 2;
      const original = new Error("actual-render-failure");
      f.render.mockImplementationOnce(() => { f.shadowMap.needsUpdate = false; throw original; });
      expect(() => f.port.render(f.scene, f.camera)).toThrow(original);
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
    } finally { f.dispose(); }
  });

  it.each(["morph", "custom depth", "shader", "shadow hook", "changed compile hook", "instanced geometry", "instanced mesh", "skinned mesh", "scene hook"] as const)("stays conservatively dirty for untracked %s", kind => {
    const f = fixture();
    try {
      f.draw();
      if (kind === "morph") { f.mesh.morphTargetInfluences = [1]; }
      else if (kind === "custom depth") { f.mesh.customDepthMaterial = f.own(new THREE.MeshDepthMaterial()); }
      else if (kind === "shader") { f.mesh.material = f.own(new THREE.ShaderMaterial()); }
      else if (kind === "shadow hook") { f.mesh.onBeforeShadow = () => undefined; }
      else if (kind === "instanced geometry") {
        const geometry = f.own(new THREE.InstancedBufferGeometry()); geometry.instanceCount = 1;
        for (const name of ["position", "normal", "uv"]) { geometry.setAttribute(name, f.geometry.getAttribute(name)); }
        geometry.setIndex(f.geometry.index); f.mesh.geometry = geometry;
      }
      else if (kind === "instanced mesh") { f.group.remove(f.mesh); f.group.add(f.own(new THREE.InstancedMesh(f.geometry, f.material, 1))); }
      else if (kind === "skinned mesh") { f.group.remove(f.mesh); f.group.add(new THREE.SkinnedMesh(f.geometry, f.material)); }
      else if (kind === "scene hook") { f.scene.onBeforeRender = () => undefined; }
      else { f.material.onBeforeCompile = () => undefined; }
      for (let i = 1; i < 60; i += 1) { expect(f.draw()).toBe(true); }
      expect(JSON.parse(f.dataset.hestiaPrototypeFrameDiagnostics!)).toMatchObject({ shadowCache: "unsupported", shadowRevisionBytes: 0 });
    } finally { f.dispose(); }
  });

  it("caches a static 128-mesh scene at the observed default-scene scale", () => {
    const f = fixture();
    try {
      // The production scene reports128 geometries. Treat all128 as casters here,
      // rather than assuming the smaller one-mesh fixture represents that scale.
      for (let i = 1; i < 128; i += 1) { f.group.add(new THREE.Mesh(f.geometry, f.material)); }
      expect(f.draw()).toBe(true);
      for (let i = 1; i < 60; i += 1) { expect(f.draw()).toBe(false); }
      const diagnostics = JSON.parse(f.dataset.hestiaPrototypeFrameDiagnostics!);
      expect(diagnostics).toMatchObject({ shadowCache: "reused", shadowUpdated: false });
      expect(diagnostics.shadowRevisionBytes).toBeGreaterThan(64 * 1024);
      expect(diagnostics.shadowRevisionBytes).toBeLessThanOrEqual(HVP_SHADOW_REVISION_MAX_BYTES);
    } finally { f.dispose(); }
  });

  it("does not cache duplicate IDs or a truncated over-budget revision", () => {
    const f = fixture();
    try {
      const duplicate = new THREE.Mesh(f.geometry, f.material); duplicate.uuid = f.mesh.uuid;
      f.group.add(duplicate);
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(true);
      f.group.remove(duplicate);
      const extras: THREE.Mesh[] = [];
      for (let i = 0; i < 400; i += 1) { const mesh = new THREE.Mesh(f.geometry, f.material); extras.push(mesh); f.group.add(mesh); }
      for (let i = 2; i < 60; i += 1) { expect(f.draw()).toBe(true); }
      expect(JSON.parse(f.dataset.hestiaPrototypeFrameDiagnostics!)).toMatchObject({ shadowCache: "budget-exceeded", shadowRevisionBytes: 0 });
      f.group.remove(...extras);
      expect(f.draw()).toBe(true); expect(f.draw()).toBe(false);
      expect(HVP_EFFECT_COST.cpuBytes).toBe(16384 + 65536 + 2 * HVP_SHADOW_REVISION_MAX_BYTES);
    } finally { f.dispose(); }
  });

  it("reports separate CPU preparation/render costs and disposes its scene-owned state", () => {
    const f = fixture();
    try {
      for (let i = 0; i < 60; i += 1) { f.draw(); }
      const diagnostics = JSON.parse(f.dataset.hestiaPrototypeFrameDiagnostics!);
      expect(diagnostics).toMatchObject({ shadowCache: "reused", shadowUpdated: false, shadowMapSize: 1024, fullscreenTargets: 0 });
      expect(diagnostics.scenePreparationMs).toBeGreaterThanOrEqual(0);
      expect(diagnostics.renderSubmitMs).toBeGreaterThanOrEqual(0);
      expect(diagnostics.shadowRevisionBytes).toBeGreaterThan(0);
      expect(diagnostics.shadowRevisionBytes).toBeLessThanOrEqual(HVP_SHADOW_REVISION_MAX_BYTES);
      f.port.dispose(); f.port.dispose(); f.port.render(f.scene, f.camera);
      expect(f.release).toHaveBeenCalledTimes(1);
      expect(f.render).toHaveBeenCalledTimes(60);
      expect(f.scene.getObjectByName("hvp-presentation-sky")).toBeUndefined();
    } finally { f.dispose(); }
  });
});
