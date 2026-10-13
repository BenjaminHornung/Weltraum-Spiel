// src/wetness.ts
import * as T3 from "three";

// inputs/rd/src/experiments/rain/index.ts
import { BoxGeometry, BufferAttribute as BufferAttribute2, BufferGeometry as BufferGeometry2, CircleGeometry, DoubleSide as DoubleSide2, DynamicDrawUsage, InstancedMesh, Matrix4 as Matrix43, Mesh as Mesh2, MeshBasicMaterial, Quaternion as Quaternion3, Raycaster, Vector3 as Vector33 } from "three";

// inputs/rd/src/contracts/validation.ts
var MAX_MANIFEST_BYTES = 1024 * 1024;
var MAX_PAYLOAD_BYTES = 128 * 1024 * 1024;
function requireValue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
function record(value) {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value), "Expected JSON object");
  return value;
}
function keys(value, allowed, required = allowed) {
  const object = record(value);
  requireValue(Object.keys(object).every((key) => allowed.includes(key)), "Unknown field");
  requireValue(required.every((key) => Object.hasOwn(object, key)), "Missing field");
}
function array(value) {
  requireValue(Array.isArray(value), "Expected array");
}
function id(value) {
  requireValue(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(value), "Invalid stable ID");
}
function finite(value, min = -Infinity, max2 = Infinity) {
  requireValue(typeof value === "number" && Number.isFinite(value) && value >= min && value <= max2, "Invalid finite number");
}
function integer(value, min = 0) {
  finite(value, min);
  requireValue(Number.isSafeInteger(value), "Expected safe integer");
}
function vector(value, length = 3) {
  array(value);
  requireValue(value.length === length, "Invalid vector length");
  value.forEach((component) => {
    finite(component);
  });
}
function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const object = record(value);
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  const json = JSON.stringify(value);
  requireValue(json !== void 0, "Not JSON data");
  return json;
}
function freezeJson(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => {
      freezeJson(child);
    });
    Object.freeze(value);
  }
  return value;
}

// inputs/rd/src/contracts/fixture.ts
var imported = /* @__PURE__ */ new WeakMap();
var sizes = { uint8: 1, uint16: 2, uint32: 4, int32: 4, float32: 4, float64: 8 };
function scalar(bytes, payload, index) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = index * sizes[payload.elementType];
  const little = payload.byteOrder === "little";
  switch (payload.elementType) {
    case "uint8":
      return view.getUint8(offset);
    case "uint16":
      return view.getUint16(offset, little);
    case "uint32":
      return view.getUint32(offset, little);
    case "int32":
      return view.getInt32(offset, little);
    case "float32":
      return view.getFloat32(offset, little);
    case "float64":
      return view.getFloat64(offset, little);
  }
}
function getFixtureDigest(fixture) {
  const snapshot = imported.get(fixture);
  requireValue(snapshot, "Fixture must pass the import boundary");
  return snapshot.digest;
}
function fixtureRevision(fixture) {
  getFixtureDigest(fixture);
  return fixture.sourceRevision;
}
function copyFixturePayload(fixture, payloadId) {
  const snapshot = imported.get(fixture);
  requireValue(snapshot, "Fixture must pass the import boundary");
  const payload = fixture.payloads.find((entry) => entry.id === payloadId);
  requireValue(payload, "Unknown payload");
  const constructors = {
    uint8: Uint8Array,
    uint16: Uint16Array,
    uint32: Uint32Array,
    int32: Int32Array,
    float32: Float32Array,
    float64: Float64Array
  };
  const result = new constructors[payload.elementType](payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    result[index] = scalar(snapshot.buffers.get(payloadId), payload, index);
  }
  return result;
}

// inputs/rd/src/contracts/experiment.ts
function validateWeather(value) {
  keys(value, ["windMps", "rain01", "snow01", "cloud01"]);
  const weather = value;
  vector(weather.windMps);
  [weather.rain01, weather.snow01, weather.cloud01].forEach((component) => {
    finite(component, 0, 1);
  });
}
function createFrameInput(value) {
  keys(value, ["tick", "seconds", "paused", "cameraId", "sourceRevision", "weather"]);
  const frame = value;
  integer(frame.tick);
  integer(frame.sourceRevision);
  finite(frame.seconds, 0);
  requireValue(frame.seconds === frame.tick / 60 && typeof frame.paused === "boolean", "Time must come from controlled 60 Hz scenario ticks");
  id(frame.cameraId);
  validateWeather(frame.weather);
  return freezeJson(JSON.parse(canonicalJson(frame)));
}

// inputs/rd/src/runner/threeHost.ts
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Matrix4,
  NoToneMapping,
  PerspectiveCamera,
  Quaternion,
  ReinhardToneMapping,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer
} from "three";
function ownerPose(fixture, ownerId) {
  getFixtureDigest(fixture);
  const object = fixture.objects.find((entry) => entry.ownerId === ownerId);
  if (!object) {
    return void 0;
  }
  const rootRotation = new Quaternion(...fixture.frame.rotationXyzw);
  const position = new Vector3(...object.frame.originMeters).applyQuaternion(rootRotation).add(new Vector3(...fixture.frame.originMeters));
  const rotation = rootRotation.multiply(new Quaternion(...object.frame.rotationXyzw));
  return Object.freeze({
    ownerId,
    sourceNamespace: object.sourceNamespace,
    sourceRevision: object.sourceRevision,
    originMeters: Object.freeze(position.toArray()),
    rotationXyzw: Object.freeze(rotation.toArray())
  });
}
var KEY_LIGHT_POSITION = Object.freeze([-10, 20, -10]);

// inputs/rd/src/experiments/three-control/index.ts
import { BufferAttribute, BufferGeometry, Color as Color2, DoubleSide, FrontSide, Group as Group2, LinearSRGBColorSpace, Mesh, MeshLambertMaterial } from "three";

// inputs/rd/src/experiments/rain-shield/index.ts
import { Box3, Matrix4 as Matrix42, Quaternion as Quaternion2, Vector3 as Vector32 } from "three";
var RAIN_LIMITS = Object.freeze({ particles: 4096, splashes: 128, queries: 65536, indexedCells: 2e6, fieldSamples: 1024, raySteps: 512 });
function rainCoverageBindings(fixture) {
  getFixtureDigest(fixture);
  return freezeJson((fixture.voxelRegions ?? []).map((r) => ({ regionId: r.id, ownerId: r.ownerId, payloadId: r.knownCoveragePayload, sha256: fixture.payloads.find((p) => p.id === r.knownCoveragePayload).sha256 })));
}
function createVoxelSourceIndex(fixture) {
  const fixtureDigest = getFixtureDigest(fixture), definitions = fixture.voxelRegions ?? [], quantumMeters = fixture.quantumMeters;
  const count = definitions.reduce((sum, r) => sum + r.dimensions[0] * r.dimensions[1] * r.dimensions[2], 0);
  requireValue(count <= RAIN_LIMITS.indexedCells, "UNSUPPORTED: bounded source-query index exceeds its declared cell budget");
  const box = new Box3();
  let copiedBytes = 0, disposed = false;
  let regions = definitions.map((r) => {
    const pose = ownerPose(fixture, r.ownerId);
    requireValue(pose, "staleOwner");
    const world = new Matrix42().compose(new Vector32(...pose.originMeters), new Quaternion2(...pose.rotationXyzw), new Vector32(1, 1, 1));
    const occupancy = copyFixturePayload(fixture, r.occupancyPayload), coverage = copyFixturePayload(fixture, r.knownCoveragePayload);
    requireValue(occupancy instanceof Uint8Array && coverage instanceof Uint8Array, "Invalid source-query byte format");
    copiedBytes += occupancy.byteLength + coverage.byteLength;
    box.union(new Box3(new Vector32(...r.originMeters), new Vector32(...r.originMeters.map((v, i) => v + r.dimensions[i] * fixture.quantumMeters))).applyMatrix4(world));
    return { definition: r, inverse: world.invert().elements, occupancy, coverage };
  });
  const bounds = freezeJson({ min: box.isEmpty() ? [0, 0, 0] : box.min.toArray(), max: box.isEmpty() ? [0, 0, 0] : box.max.toArray() });
  const coverageBindings = rainCoverageBindings(fixture);
  return Object.freeze({
    fixtureDigest,
    sourceRevision: fixtureRevision(fixture),
    quantumMeters: fixture.quantumMeters,
    regionCount: regions.length,
    copiedBytes,
    bounds,
    sourceFrame: fixture.frame,
    coverageBindings,
    sample(point) {
      requireValue(!disposed, "Source index disposed");
      vector(point);
      let known = false, unknown = false;
      for (const region of regions) {
        const e = region.inverse, r = region.definition, q = quantumMeters;
        const px = e[0] * point[0] + e[4] * point[1] + e[8] * point[2] + e[12], py = e[1] * point[0] + e[5] * point[1] + e[9] * point[2] + e[13], pz = e[2] * point[0] + e[6] * point[1] + e[10] * point[2] + e[14];
        const x = Math.floor((px - r.originMeters[0]) / q), y = Math.floor((py - r.originMeters[1]) / q), z = Math.floor((pz - r.originMeters[2]) / q);
        if (x < 0 || y < 0 || z < 0 || x >= r.dimensions[0] || y >= r.dimensions[1] || z >= r.dimensions[2]) continue;
        const offset = x + r.dimensions[0] * (y + r.dimensions[1] * z);
        if (region.coverage[offset] === 0) {
          unknown = true;
          continue;
        }
        known = true;
        if (region.occupancy[offset] !== 0) return freezeJson({ status: "solid", ownerId: r.ownerId, regionId: r.id, cell: [x, y, z] });
      }
      return Object.freeze({ status: unknown || !known ? "unknown" : "air" });
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        regions = [];
      }
    }
  });
}
function upstream(direction) {
  vector(direction);
  requireValue(direction[1] < 0, "Rain direction must be downward");
  const length = Math.hypot(...direction);
  requireValue(Number.isFinite(length) && length > 0, "Invalid rain direction");
  return direction.map((v) => -v / length);
}
function sampleRainExposure(index, receiver, direction, travelMeters, queryBudget = RAIN_LIMITS.queries) {
  integer(queryBudget, 1);
  requireValue(queryBudget <= RAIN_LIMITS.queries, "Rain per-ray query budget exceeded");
  vector(receiver);
  finite(travelMeters, Number.MIN_VALUE, 32);
  const ray = upstream(direction), steps = Math.ceil(travelMeters / (index.quantumMeters / 4));
  requireValue(steps <= RAIN_LIMITS.raySteps, "Rain ray-step budget exceeded");
  let unknown = false, queries = 0;
  const binding = {
    fixtureDigest: index.fixtureDigest,
    sourceRevision: index.sourceRevision,
    receiverMeters: [...receiver],
    direction: ray.map((v) => v === 0 ? 0 : -v),
    travelMeters,
    sourceFrame: index.sourceFrame,
    coverageBindings: index.coverageBindings
  };
  for (let step = 1; step <= steps; step++) {
    requireValue(queries + index.regionCount <= queryBudget, "Rain remaining query budget exceeded");
    const distance = travelMeters * step / steps, point = receiver.map((v, i) => v + ray[i] * distance);
    const hit = index.sample(point);
    queries += index.regionCount;
    if (hit.status === "solid") return freezeJson({ ...binding, status: "shielded", queries, hit });
    if (hit.status === "unknown") unknown = true;
  }
  return freezeJson({ ...binding, status: unknown ? "unknown" : "exposed", queries });
}

// inputs/rd/src/experiments/rain/index.ts
function unitDown(value) {
  vector(value);
  const length = Math.hypot(...value);
  requireValue(value[1] < 0 && length > 0 && length <= 60, "Rain direction must be bounded and downward");
  return value.map((v) => v / length);
}
function rainVelocityMps(weather) {
  validateWeather(weather);
  return Object.freeze([weather.windMps[0] * 0.2, -12, weather.windMps[2] * 0.2]);
}
function rainDirection(weather) {
  return Object.freeze(unitDown(rainVelocityMps(weather)));
}

// inputs/rd/src/experiments/foliage-wind/index.ts
import { Group as Group3, Mesh as Mesh3, Quaternion as Quaternion4, Vector3 as Vector34 } from "three";

// inputs/rd/src/experiments/wet-surface/index.ts
import { Group as Group4, Quaternion as Quaternion5, Vector3 as Vector36 } from "three";

// inputs/rd/src/experiments/material-light/index.ts
import { BufferAttribute as BufferAttribute4, Mesh as Mesh4, MeshBasicMaterial as MeshBasicMaterial2, MeshDepthMaterial, MeshNormalMaterial, MeshStandardMaterial, Plane, Vector3 as Vector35 } from "three";

// inputs/rd/src/experiments/wet-surface/index.ts
var WET_LIMITS = Object.freeze({ surfaceSamples: 8192, queriesPerRefresh: 2e6, historyEvents: 64, maxTick: 3600 });
var presets = /* @__PURE__ */ new WeakSet();
function createWetnessPreset(input) {
  keys(input, ["schema", "id", "sourcePolicy", "model", "wettingPerSecond", "dryingPerSecond", "rainHistory"]);
  const raw = input;
  requireValue(raw.schema === "hestia-rd-wetness-v1" && raw.sourcePolicy === "reset-at-snapshot" && raw.model === "current-exposure-analytic", "Unsupported wetness version/model/source policy");
  id(raw.id);
  finite(raw.wettingPerSecond, 0, 1);
  finite(raw.dryingPerSecond, 0, 1);
  array(raw.rainHistory);
  requireValue(raw.rainHistory.length > 0 && raw.rainHistory.length <= WET_LIMITS.historyEvents, "Wetness history budget exceeded");
  let previous = -1;
  for (const event of raw.rainHistory) {
    keys(event, ["tick", "rain01"]);
    integer(event.tick);
    finite(event.rain01, 0, 1);
    requireValue(event.tick > previous && event.tick <= WET_LIMITS.maxTick, "Wetness history must be sorted/bounded");
    previous = event.tick;
  }
  requireValue(raw.rainHistory[0].tick === 0, "Wetness history needs initial input");
  const preset = freezeJson({ ...raw, rainHistory: raw.rainHistory.map((e) => ({ ...e })) });
  presets.add(preset);
  return preset;
}
var DEFAULT_WETNESS_PRESET = createWetnessPreset({
  schema: "hestia-rd-wetness-v1",
  id: "analytic-frozen-replay",
  sourcePolicy: "reset-at-snapshot",
  model: "current-exposure-analytic",
  wettingPerSecond: 0.35,
  dryingPerSecond: 0.08,
  rainHistory: [{ tick: 0, rain01: 0 }, { tick: 240, rain01: 0.8 }, { tick: 900, rain01: 0 }]
});
function sampleWetnessRainInput(preset, tick) {
  requireValue(presets.has(preset), "Wetness preset must pass validation");
  integer(tick);
  requireValue(tick <= WET_LIMITS.maxTick, "Wetness tick budget exceeded");
  let rain = 0;
  for (const event of preset.rainHistory) {
    if (event.tick > tick) break;
    rain = event.rain01;
  }
  return rain;
}
function sampleAnalyticWetness(preset, tick, sourceStartTick, exposure) {
  requireValue(presets.has(preset), "Wetness preset must pass validation");
  integer(tick);
  integer(sourceStartTick);
  requireValue(tick <= WET_LIMITS.maxTick && sourceStartTick <= tick, "Invalid wetness source epoch/time");
  requireValue(["shielded", "exposed", "unknown"].includes(exposure), "Invalid wetness exposure");
  let wetness = 0;
  for (let i = 0; i < preset.rainHistory.length; i++) {
    const begin = Math.max(sourceStartTick, preset.rainHistory[i].tick), end = Math.min(tick, preset.rainHistory[i + 1]?.tick ?? tick);
    if (end <= begin) continue;
    const rain = preset.rainHistory[i].rain01;
    wetness = Math.max(0, Math.min(1, wetness + (exposure === "exposed" ? rain * preset.wettingPerSecond : 0) * (end - begin) / 60 - (1 - rain) * preset.dryingPerSecond * (end - begin) / 60));
  }
  return freezeJson({ wetness01: exposure === "unknown" ? 0 : wetness, qualification: exposure === "unknown" ? "unknown" : "known" });
}
function createWetnessSourceCache(fixture) {
  const digest2 = getFixtureDigest(fixture), revision = fixtureRevision(fixture), index = createVoxelSourceIndex(fixture);
  let cache = /* @__PURE__ */ new Map(), directionKey = "", disposed = false;
  return {
    copiedSourceBytes: index.copiedBytes,
    evaluate(input, preset, sourceStartTick, points) {
      requireValue(!disposed, "Wetness cache disposed");
      const frame = createFrameInput(input);
      requireValue(frame.sourceRevision === revision, "Stale wetness source");
      integer(sourceStartTick);
      requireValue(sourceStartTick <= frame.tick, "Wetness source epoch is in the future");
      requireValue(presets.has(preset), "Wetness preset must pass validation");
      requireValue(points.length <= WET_LIMITS.surfaceSamples, "Wetness surface sample budget exceeded");
      requireValue(frame.weather.rain01 === sampleWetnessRainInput(preset, frame.tick), "Current rain input differs from the declared wetness history");
      const direction = rainDirection(frame.weather), key = JSON.stringify(direction);
      if (key !== directionKey) {
        cache.clear();
        directionKey = key;
      }
      const maxTravel = (index.bounds.max[1] - index.bounds.min[1] + index.quantumMeters / 4) / -direction[1], maxSteps = Math.ceil(maxTravel / (index.quantumMeters / 4));
      requireValue(maxSteps <= 512, "Wetness source ray-step budget exceeded");
      const potentialQueries = points.length * maxSteps * index.regionCount;
      let queries = 0;
      const next = /* @__PURE__ */ new Map(), ids = /* @__PURE__ */ new Set();
      const transforms = /* @__PURE__ */ new Map();
      const samples = points.map((point) => {
        keys(point, ["id", "ownerId", "positionLocalMeters", "normalLocal"]);
        id(point.id);
        id(point.ownerId);
        vector(point.positionLocalMeters);
        vector(point.normalLocal);
        requireValue(!ids.has(point.id), "Duplicate wetness surface ID");
        ids.add(point.id);
        requireValue(Math.abs(Math.hypot(...point.normalLocal) - 1) < 1e-6, "Wetness face normal must be unit length");
        let transform = transforms.get(point.ownerId);
        if (!transform) {
          const owner2 = ownerPose(fixture, point.ownerId);
          requireValue(owner2, "staleOwner");
          transform = { owner: owner2, rotation: new Quaternion5(...owner2.rotationXyzw), origin: new Vector36(...owner2.originMeters) };
          transforms.set(point.ownerId, transform);
        }
        const { owner, rotation, origin } = transform;
        const normal = new Vector36(...point.normalLocal).applyQuaternion(rotation), receiver = new Vector36(...point.positionLocalMeters).applyQuaternion(rotation).add(origin).addScaledVector(normal, index.quantumMeters / 4);
        const world = receiver.toArray(), pointKey = JSON.stringify([point.ownerId, world]);
        let exposure = cache.get(pointKey);
        if (!exposure) {
          const travel = (index.bounds.max[1] - index.quantumMeters / 4 - world[1]) / -direction[1];
          if (travel <= 0) exposure = freezeJson({ status: "unknown", fixtureDigest: digest2, sourceRevision: revision, queries: 0, receiverMeters: world, direction, travelMeters: 0, sourceFrame: fixture.frame, coverageBindings: index.coverageBindings });
          else exposure = sampleRainExposure(index, world, direction, travel, Math.min(RAIN_LIMITS.queries, WET_LIMITS.queriesPerRefresh - queries));
          queries += exposure.queries;
        }
        next.set(pointKey, exposure);
        const value = sampleAnalyticWetness(preset, frame.tick, sourceStartTick, exposure.status);
        return freezeJson({ id: point.id, ownerId: point.ownerId, ownerRevision: owner.sourceRevision, receiverWorldMeters: world, exposure: exposure.status, ...value });
      });
      requireValue(queries <= WET_LIMITS.queriesPerRefresh, "Wetness refresh exceeded source query budget");
      cache = next;
      return freezeJson({
        fixtureDigest: digest2,
        sourceRevision: revision,
        sourceFrame: fixture.frame,
        coverageBindings: rainCoverageBindings(fixture),
        frame,
        direction,
        sourceStartTick,
        sourcePolicy: preset.sourcePolicy,
        model: preset.model,
        samples,
        unknownSamples: samples.filter((s) => s.qualification === "unknown").length,
        refreshQueries: queries,
        potentialQueries,
        copiedSourceBytes: index.copiedBytes
      });
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        cache.clear();
        index.dispose();
      }
    }
  };
}

// inputs/gfx/src/materials.ts
import * as T from "three";
import { MeshStandardNodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";
import { attribute, cameraPosition, cameraViewMatrix, float, max, mix, normalize, output, positionLocal, positionWorld, pow, reflect, sin, cos, smoothstep, texture, uniform, uv, vec3, vec4 } from "three/tsl";
var materialUniforms = { wind: uniform(new T.Vector2()), wetness: uniform(0.4) };
var glUniforms = { wind: { value: new T.Vector2() }, wetness: { value: 0.4 } };

// inputs/gfx/src/port.ts
import * as T2 from "three";
var lightDepthPolicy = Object.freeze({
  sun: [-28, 42, -18],
  sunIntensity: 2.1,
  ambient: 0.65,
  linearHdr: true,
  exposure: 1.05,
  toneMapping: "ACESFilmic once at final output",
  waterDepthWrite: false,
  waterStrategy: "single planar DoubleSide forceSinglePass; opaque depth test; transparent back-to-front sort",
  volumeStrategy: "bounded transparent single-layer optical candidate; not an ATM volume solver"
});

// src/wetness.ts
function createViewerWetness(fixture, meshes, rain01) {
  const preset = createWetnessPreset({ ...DEFAULT_WETNESS_PRESET, id: "atm-bound-current-rain", rainHistory: [{ tick: 0, rain01 }] });
  let current = fixture, cache = createWetnessSourceCache(fixture), sourceStartTick = 0, disposed = false;
  const update = (tick, weather, origin) => {
    if (disposed) throw Error("WETNESS_DISPOSED");
    if (current.objects.length !== 1) throw Error("WETNESS_SOURCE_OWNER_UNSUPPORTED");
    const owner = ownerPose(current, current.objects[0].ownerId);
    if (!owner) throw Error("WETNESS_SOURCE_OWNER_MISSING");
    const inverse = new T3.Quaternion(...owner.rotationXyzw).invert(), base = new T3.Vector3(...owner.originMeters), shift = new T3.Vector3(...origin);
    const points = [], surfaces = [];
    meshes.forEach((mesh, index) => {
      if (!mesh.visible) return;
      mesh.updateWorldMatrix(true, false);
      const p = mesh.geometry.getAttribute("position"), n = mesh.geometry.getAttribute("normal"), wet = mesh.geometry.getAttribute("labWetness"), indices = mesh.geometry.index;
      if (!p || !n || !wet || p.count % 4 !== 0 || n.count !== p.count || wet.count !== p.count || !indices || indices.count !== p.count / 4 * 6) throw Error("WETNESS_QUAD_SOURCE_UNSUPPORTED");
      const start = points.length;
      for (let first = 0; first < p.count; first += 4) {
        const face = first / 4;
        for (let i = 0; i < 6; i++) {
          const v = indices.getX(face * 6 + i);
          if (v < first || v >= first + 4) throw Error("WETNESS_QUAD_SOURCE_UNSUPPORTED");
        }
        const center = new T3.Vector3();
        for (let i = 0; i < 4; i++) center.add(new T3.Vector3().fromBufferAttribute(p, first + i));
        center.multiplyScalar(0.25).applyMatrix4(mesh.matrixWorld).add(shift).sub(base).applyQuaternion(inverse);
        const normal = new T3.Vector3().fromBufferAttribute(n, first).transformDirection(mesh.matrixWorld).applyQuaternion(inverse);
        points.push({ id: `atm.receiver.${index}.face.${face}`, ownerId: owner.ownerId, positionLocalMeters: center.toArray(), normalLocal: normal.toArray() });
      }
      surfaces.push({ mesh, start, faces: p.count / 4 });
    });
    if (points.length > WET_LIMITS.surfaceSamples) throw Error("WETNESS_SAMPLE_BUDGET");
    const result = cache.evaluate({ tick, seconds: tick / 60, paused: false, cameraId: "near", sourceRevision: fixtureRevision(current), weather }, preset, sourceStartTick, points);
    for (const surface of surfaces) {
      const wet = surface.mesh.geometry.getAttribute("labWetness");
      for (let face = 0; face < surface.faces; face++) for (let vertex = 0; vertex < 4; vertex++) wet.setX(face * 4 + vertex, result.samples[surface.start + face].wetness01);
      wet.needsUpdate = true;
    }
    return result;
  };
  return {
    update,
    replace(next, tick) {
      if (disposed) throw Error("WETNESS_DISPOSED");
      if (!Number.isSafeInteger(tick) || tick < 0 || tick > WET_LIMITS.maxTick) throw Error("WETNESS_SOURCE_TICK");
      const nextCache = createWetnessSourceCache(next);
      cache.dispose();
      cache = nextCache;
      current = next;
      sourceStartTick = tick;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cache.dispose();
    }
  };
}
export {
  createViewerWetness
};
