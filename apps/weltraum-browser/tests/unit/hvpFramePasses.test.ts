import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { backendRevision, createFrameProjectionSnapshot, frameId, frameRevision } from "../../src/presentation";
import { ThreeRenderBackend } from "../../src/render/three/backend/threeRenderBackend";
import { CpuContactPass, type Ray, type Volume } from "../../src/ray/cpuContactPass";
import { createHvpFramePasses, type HvpFrameInputs } from "../../src/hestia-prototype/presentation/framePasses";
import { createHvpVisualRenderer } from "../../src/hestia-prototype/presentation/visualEffects";
import type { HvpWeatherFrame } from "../../src/weather/hvpWeather";
import contactFixture from "./fixtures/r1Contact/UNKNOWN_HIT.json";

const binding = {worldId: "world", sessionId: "session", epoch: 1, revision: 1, sourceDigest: "terrain"};
const weather: HvpWeatherFrame = Object.freeze({...binding, sampleTick: 120, weatherSnapshotId: "sample",
  windMps: [16, 0, -32] as const, extinctionPerM: 0.02, cloudCoverage: 0.65, rain01: 0.25,
  snow01: 0.5, temperatureK: 286, stormIds: [], exposure: "Open"});

function fixture() {
  const live: {input?: HvpFrameInputs; submit: boolean; onDraw?: () => void} = {input: {...binding, tick: 60, weather}, submit: true};
  const canvas = new EventTarget() as HTMLCanvasElement;
  const drawingBuffer = {drawingBufferWidth: 64, drawingBufferHeight: 64};
  const info = {render: {frame: 0}, memory: {geometries: 0, textures: 0}};
  const driver = {info, shadowMap: {}, capabilities: {maxTextureSize: 4096}, setDrawingBufferSize() {}, dispose() {},
    getContext: () => drawingBuffer,
    render: () => { live.onDraw?.(); if (live.submit) info.render.frame++; }} as unknown as THREE.WebGLRenderer;
  let active: ThreeRenderBackend | undefined;
  const passes = createHvpFramePasses(() => live.input, () => active);
  const backend = new ThreeRenderBackend({canvas, lightingMode: "None", rendererFactory:
    (element, options) => createHvpVisualRenderer(element, options, () => driver, undefined, false, undefined, passes)});
  active = backend;
  backend.dispatch({kind: "InitializeBackend", backendRevision: backendRevision(0)});
  backend.dispatch({kind: "ApplyFrameProjection", backendRevision: backendRevision(0), snapshot: createFrameProjectionSnapshot({
    frameId: frameId("local:camera"), frameRevision: frameRevision(1), cameraPositionRelative: {x: 0, y: 0, z: 4},
    cameraOrientation: {x: 0, y: 0, z: 0, w: 1}, representationTransforms: [],
    projectionParameters: {kind: "Perspective", verticalFovDegrees: 60, aspect: 1, near: 0.1, far: 100}})});
  const surface = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshLambertMaterial());
  backend.scene.add(surface);
  backend.scene.fog = new THREE.Fog(0xaaaaaa, 30, 100);
  const uniforms = () => (backend.scene.getObjectByName("hvp-presentation-sky") as THREE.Mesh<
    THREE.BufferGeometry, THREE.ShaderMaterial>).material.uniforms;
  const dispose = () => {
    backend.dispatch({kind: "DisposeBackend", backendRevision: backendRevision(0)});
    surface.geometry.dispose(); surface.material.dispose(); passes.dispose();
  };
  return {live, canvas, backend, passes, surface, uniforms, drawingBuffer, dispose};
}

describe("shared HVP render frame", () => {
  it("drives the sky and surface shader of the actual HVP renderer with the submitted weather binding", () => {
    const f = fixture();
    try {
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()?.frame).toBe(f.backend.readSubmittedFrameMetadata());
      expect(f.passes.readSubmitted()?.weather).toBe(weather);
      const sky = f.uniforms();
      expect(sky.cloudCoverage.value).toBe(0.65);
      expect(sky.precipitation.value.toArray()).toEqual([0.25, 0.5]);
      const shader = {uniforms: {} as Record<string, THREE.IUniform>, ...{
        vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader}};
      f.surface.material.onBeforeCompile(shader as Parameters<THREE.Material["onBeforeCompile"]>[0], {} as THREE.WebGLRenderer);
      expect(shader.fragmentShader).toContain("hvpExtinctionPerM*distance(cameraPosition,vHvpWorld)");
      expect(shader.uniforms.hvpExtinctionPerM.value).toBe(0.02);
      f.live.input = {...binding, tick: 120, weather};
      f.backend.renderFrame();
      expect(sky.cloudOffset.value.toArray()).toEqual([-16 / 256, 32 / 256]);
      f.backend.renderFrame();
      expect(sky.cloudOffset.value.toArray()).toEqual([-16 / 256, 32 / 256]);
      f.live.input = {...binding, tick: 120, weather: {...weather, revision: 2}};
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()?.weather).toBeUndefined();
      expect(sky.cloudCoverage.value).toBe(-1);
      expect(sky.precipitation.value.toArray()).toEqual([0, 0]);
      expect(shader.uniforms.hvpExtinctionPerM.value).toBe(0);
    } finally { f.dispose(); }
  });

  it("withdraws skipped, reset, lost-context, future-time and in-flight stale frames", () => {
    const f = fixture();
    try {
      f.backend.renderFrame();
      f.live.submit = false;
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.live.submit = true;
      f.live.onDraw = () => {f.live.input = {...binding, tick: 61, weather};};
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.live.onDraw = undefined;
      f.live.input = {...binding, tick: 10, weather};
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()?.weather).toBeUndefined();
      f.canvas.dispatchEvent(new Event("webglcontextlost"));
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.canvas.dispatchEvent(new Event("webglcontextrestored"));
      f.live.input = {...binding, tick: 60, weather};
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()?.frame.previous).toBeNull();
      f.passes.reset();
      expect(f.passes.readSubmitted()).toBeUndefined();
    } finally { f.dispose(); }
  });

  it("rechecks the actual camera pose, projection and GL output for deferred readers", () => {
    const f = fixture();
    try {
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()).toBeDefined();
      f.backend.camera.position.x++;
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()).toBeDefined();
      f.backend.camera.zoom = 2;
      f.backend.camera.updateProjectionMatrix();
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()).toBeDefined();
      f.drawingBuffer.drawingBufferHeight++;
      expect(f.passes.readSubmitted()).toBeUndefined();
      f.backend.renderFrame();
      expect(f.passes.readSubmitted()).toBeDefined();
      f.backend.resizeViewport(320,240);
      expect(f.passes.readSubmitted()).toBeUndefined();
    } finally { f.dispose(); }
  });

  it("composes only same-draw and same-source real BVH contacts and linear color inputs", async () => {
    const f = fixture(), volume = structuredClone(contactFixture.volume) as Volume;
    const pass = new CpuContactPass(f.backend, () => ({coordinateFrameId: "local:camera", projectionRevision: 1, owners: [volume.binding]}));
    pass.setEnabled(true);
    try {
      expect(await pass.refresh([volume])).toBe(true);
      f.live.input = {...binding, tick: 60, weather, contact: {...binding, pass}};
      f.backend.renderFrame();
      const frame = f.passes.readSubmitted()!.frame, rgba = (r: number, g: number, b: number) => Float32Array.of(r, g, b, 1);
      const tile = {frame, width: 1, height: 1, direct: rgba(.5,.5,.5), indirect: rgba(1,1,1),
        emissive: rgba(.25,.25,.25), raster: rgba(1.75,1.75,1.75)};
      const surface = {pixel: 0, role: "opaque" as const, ray: contactFixture.rays[1] as Ray};
      expect([...f.passes.composeContact(tile, [surface])]).toEqual([.75,.75,.75,1]);
      f.live.input = {...f.live.input, contact: {...binding, revision: 2, pass}};
      expect(f.passes.composeContact(tile, [surface])).toBe(tile.raster);
      f.live.input = {...f.live.input, contact: {...binding, pass}};
      f.backend.renderFrame();
      expect(f.passes.composeContact(tile, [surface])).toBe(tile.raster);
      const newer = {...tile, frame: f.passes.readSubmitted()!.frame};
      const invalidate = {...surface, get ray() { f.live.input = undefined; return surface.ray; }};
      expect(f.passes.composeContact(newer, [invalidate])).toBe(tile.raster);
      expect(frame.attachmentPublication).toBe("UNAVAILABLE");
    } finally { pass.dispose(); f.dispose(); }
  });
});
