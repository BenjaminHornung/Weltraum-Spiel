// inputs/rd/src/experiments/rain/index.ts
import { BoxGeometry, BufferAttribute as BufferAttribute2, BufferGeometry as BufferGeometry2, CircleGeometry, DoubleSide as DoubleSide2, DynamicDrawUsage, InstancedMesh, Matrix4 as Matrix43, Mesh as Mesh2, MeshBasicMaterial, Quaternion as Quaternion3, Raycaster, Vector3 as Vector33 } from "three";

// inputs/rd/src/contracts/validation.ts
var PRODUCT_READ_BASE = "b3c6523a94cd050f5a9a22dc27f4777fcc03363e";
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
function text(value) {
  requireValue(typeof value === "string" && value.length > 0 && value.length <= 1024, "Expected bounded text");
}
function id(value) {
  requireValue(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/.test(value), "Invalid stable ID");
}
function relativePath(value) {
  text(value);
  requireValue(!value.startsWith("/") && !value.includes("\\") && !value.includes(":") && value.split("/").every((part) => part !== "" && part !== "." && part !== ".."), "Unsafe relative path");
}
function digest(value) {
  requireValue(typeof value === "string" && /^[0-9a-f]{64}$/.test(value), "Expected full SHA-256");
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
function unique(values) {
  requireValue(new Set(values).size === values.length, "Duplicate identity");
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
function parseBoundedJson(bytes) {
  requireValue(bytes.byteLength <= MAX_MANIFEST_BYTES, "Manifest exceeds 1 MiB");
  requireValue(bytes.buffer instanceof ArrayBuffer, "Shared manifest buffer is not supported");
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
async function sha256(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// inputs/rd/src/contracts/fixture.ts
var imported = /* @__PURE__ */ new WeakMap();
var sizes = { uint8: 1, uint16: 2, uint32: 4, int32: 4, float32: 4, float64: 8 };
function validateSourceRefs(value, kind) {
  array(value);
  requireValue(value.length > 0, "Missing source provenance");
  for (const raw of value) {
    const ref = raw;
    if (ref.kind === "synthetic") {
      keys(ref, ["kind", "generatorPath", "generatorCodeSha256", "generatorVersion", "seed", "testOnly", "sourceDigest"]);
      relativePath(ref.generatorPath);
      digest(ref.generatorCodeSha256);
      integer(ref.seed);
      requireValue(ref.testOnly === true && kind !== "product-derived", "Synthetic data is explicitly test-only");
    } else {
      keys(ref, ["kind", "repository", "commit", "files", "generatorVersion", "sourceDigest"]);
      requireValue(ref.kind === "product" && ref.repository === "BenjaminHornung/Weltraum-Spiel" && ref.commit === PRODUCT_READ_BASE && kind !== "synthetic", "Unpinned product provenance");
      array(ref.files);
      requireValue(ref.files.length > 0, "Missing concrete source files");
      for (const file of ref.files) {
        keys(file, ["path", "sha256", "blobSha"], ["path", "sha256"]);
        relativePath(file.path);
        digest(file.sha256);
        if (file.blobSha !== void 0) {
          requireValue(/^[0-9a-f]{40}$/.test(file.blobSha), "Expected full blob SHA");
        }
      }
      unique(ref.files.map((file) => file.path));
    }
    text(ref.generatorVersion);
    if (ref.kind === "synthetic") {
      digest(ref.sourceDigest);
    } else {
      id(ref.sourceDigest);
    }
  }
}
function validateFrame(frame) {
  keys(frame, ["id", "originMeters", "rotationXyzw", "basis"]);
  id(frame.id);
  vector(frame.originMeters);
  vector(frame.rotationXyzw, 4);
  requireValue(frame.basis === "right-handed-y-up", "Invalid frame basis");
  requireValue(Math.abs(Math.hypot(...frame.rotationXyzw) - 1) <= 1e-6, "Rotation must be unit quaternion");
}
function validateManifest(value) {
  const fixture = value;
  keys(
    fixture,
    [
      "schema",
      "id",
      "kind",
      "sourceRefs",
      "units",
      "quantumMeters",
      "frame",
      "materials",
      "objects",
      "payloads",
      "voxelRegions",
      "attachments",
      "cameras",
      "sourceRevision",
      "presentation"
    ],
    ["schema", "id", "kind", "sourceRefs", "sourceRevision", "units", "quantumMeters", "frame", "materials", "objects", "payloads", "cameras"]
  );
  requireValue(fixture.schema === "hestia-rd-fixture-v1", "Unsupported fixture version");
  id(fixture.id);
  requireValue(fixture.kind === "synthetic" || fixture.kind === "product-derived", "Invalid fixture kind");
  validateSourceRefs(fixture.sourceRefs, fixture.kind);
  integer(fixture.sourceRevision);
  requireValue(fixture.kind !== "product-derived" || fixture.presentation !== void 0, "Product-derived control requires a bound presentation profile");
  if (fixture.presentation) {
    validatePresentation(fixture.presentation, fixture.sourceRefs);
  }
  requireValue(fixture.units === "meter", "Only meter units supported");
  finite(fixture.quantumMeters, Number.MIN_VALUE);
  validateFrame(fixture.frame);
  array(fixture.payloads);
  let bytes = 0;
  for (const payload of fixture.payloads) {
    keys(payload, ["id", "path", "elementType", "byteOrder", "length", "byteLength", "sha256"]);
    id(payload.id);
    relativePath(payload.path);
    digest(payload.sha256);
    integer(payload.length);
    integer(payload.byteLength);
    requireValue(Object.hasOwn(sizes, payload.elementType), "Unsupported element type");
    requireValue(payload.byteOrder === "little" || payload.byteOrder === "big", "Invalid byte order");
    requireValue(Number.isSafeInteger(payload.length * sizes[payload.elementType]) && payload.byteLength === payload.length * sizes[payload.elementType], "Invalid typed byte length");
    bytes += payload.byteLength;
    requireValue(Number.isSafeInteger(bytes) && bytes <= MAX_PAYLOAD_BYTES, "Scene payload exceeds 128 MiB");
  }
  unique(fixture.payloads.map((payload) => payload.id));
  unique(fixture.payloads.map((payload) => payload.path));
  array(fixture.materials);
  for (const material of fixture.materials) {
    keys(
      material,
      ["id", "role", "colorLinearRgb", "opacity", "depthWrite", "doubleSided"],
      fixture.kind === "product-derived" ? ["id", "role", "colorLinearRgb", "opacity", "depthWrite", "doubleSided"] : ["id", "role", "colorLinearRgb"]
    );
    id(material.id);
    id(material.role);
    vector(material.colorLinearRgb);
    material.colorLinearRgb.forEach((color) => {
      finite(color, 0, 1);
    });
    if (material.opacity !== void 0) {
      finite(material.opacity, 0, 1);
    }
    for (const flag of [material.depthWrite, material.doubleSided]) {
      requireValue(flag === void 0 || typeof flag === "boolean", "Invalid material flag");
    }
  }
  unique(fixture.materials.map((material) => material.id));
  array(fixture.objects);
  const materialIds = new Set(fixture.materials.map((material) => material.id));
  for (const object of fixture.objects) {
    keys(object, ["ownerId", "sourceRevision", "sourceNamespace", "sourceIds", "frame", "materialRoles", "meshes", "bounds"]);
    id(object.ownerId);
    integer(object.sourceRevision);
    id(object.sourceNamespace);
    array(object.sourceIds);
    object.sourceIds.forEach(id);
    unique(object.sourceIds);
    validateFrame(object.frame);
    array(object.materialRoles);
    object.materialRoles.forEach(id);
    requireValue(object.materialRoles.every((role) => fixture.materials.some((material) => material.role === role)), "Unknown material role");
    keys(object.bounds, ["min", "max"]);
    vector(object.bounds.min);
    vector(object.bounds.max);
    requireValue(object.bounds.min.every((min, axis) => min <= object.bounds.max[axis]), "Invalid geometric bounds");
    array(object.meshes);
    for (const mesh of object.meshes) {
      keys(mesh, ["positions", "indices", "materialId", "normals", "colors", "colorSpace", "presentationOnly"], ["positions", "indices", "materialId"]);
      const positions = fixture.payloads.find((payload) => payload.id === mesh.positions);
      const indices = fixture.payloads.find((payload) => payload.id === mesh.indices);
      requireValue(positions && ["float32", "float64"].includes(positions.elementType) && positions.length > 0 && positions.length % 3 === 0, "Invalid mesh positions");
      requireValue(indices && ["uint16", "uint32"].includes(indices.elementType) && indices.length % 3 === 0, "Invalid mesh indices");
      requireValue(materialIds.has(mesh.materialId), "Unknown mesh material");
      requireValue(mesh.presentationOnly === void 0 || typeof mesh.presentationOnly === "boolean", "Invalid presentation-only flag");
      for (const payloadId of [mesh.normals, mesh.colors]) {
        if (payloadId === void 0) {
          continue;
        }
        const payload = fixture.payloads.find((entry) => entry.id === payloadId);
        requireValue(payload && ["float32", "float64"].includes(payload.elementType) && payload.length === positions.length, "Invalid per-vertex payload");
      }
      requireValue(mesh.colors === void 0 ? mesh.colorSpace === void 0 : mesh.colorSpace === "linear-srgb", "Vertex-color payload needs explicit linear-sRGB binding");
    }
  }
  unique(fixture.objects.map((object) => object.ownerId));
  if (fixture.voxelRegions !== void 0) {
    array(fixture.voxelRegions);
    for (const region of fixture.voxelRegions) {
      keys(region, ["id", "ownerId", "originMeters", "dimensions", "occupancyPayload", "knownCoveragePayload"]);
      id(region.id);
      requireValue(fixture.objects.some((object) => object.ownerId === region.ownerId), "Missing voxel owner");
      vector(region.originMeters);
      vector(region.dimensions);
      region.dimensions.forEach((dimension) => {
        integer(dimension, 1);
      });
      const count = region.dimensions.reduce((total, dimension) => total * dimension, 1);
      integer(count, 1);
      requireValue(count <= MAX_PAYLOAD_BYTES, "Scene payload exceeds 128 MiB");
      requireValue(region.occupancyPayload !== region.knownCoveragePayload, "Coverage is separate from occupancy");
      for (const payloadId of [region.occupancyPayload, region.knownCoveragePayload]) {
        const payload = fixture.payloads.find((entry) => entry.id === payloadId);
        requireValue(payload?.elementType === "uint8" && payload.length === count, "Missing occupancy/knownCoverage payload");
      }
    }
    unique(fixture.voxelRegions.map((region) => region.id));
  }
  if (fixture.attachments !== void 0) {
    array(fixture.attachments);
    for (const attachment of fixture.attachments) {
      keys(attachment, ["id", "ownerId", "sourceIds", "supportOwnerId", "supportIds"]);
      id(attachment.id);
      const owner = fixture.objects.find((object) => object.ownerId === attachment.ownerId);
      const supportOwner = fixture.objects.find((object) => object.ownerId === attachment.supportOwnerId);
      requireValue(owner && supportOwner, "Missing attachment/source support owner");
      for (const [ids, binding] of [[attachment.sourceIds, owner], [attachment.supportIds, supportOwner]]) {
        array(ids);
        requireValue(ids.length > 0, "Missing source/support binding");
        ids.forEach(id);
        unique(ids);
        requireValue(ids.every((sourceId) => binding.sourceIds.includes(sourceId)), "Unknown source/support ID in owner namespace");
      }
    }
    unique(fixture.attachments.map((attachment) => attachment.id));
  }
  array(fixture.cameras);
  requireValue(fixture.cameras.length > 0, "Missing cameras");
  for (const camera of fixture.cameras) {
    keys(camera, ["id", "positionMeters", "targetMeters", "up", "verticalFovDegrees"]);
    id(camera.id);
    vector(camera.positionMeters);
    vector(camera.targetMeters);
    vector(camera.up);
    finite(camera.verticalFovDegrees, 1, 179);
    requireValue(Math.hypot(...camera.up) > 0 && camera.positionMeters.some((value2, axis) => value2 !== camera.targetMeters[axis]), "Degenerate camera");
  }
  unique(fixture.cameras.map((camera) => camera.id));
}
function validatePresentation(profile, refs) {
  keys(profile, ["id", "sourcePaths", "materialColorSpace", "outputColorSpace", "toneMapping", "exposure", "lighting", "background"]);
  id(profile.id);
  array(profile.sourcePaths);
  requireValue(profile.sourcePaths.length > 0, "Presentation must name its sources");
  profile.sourcePaths.forEach(relativePath);
  unique(profile.sourcePaths);
  requireValue(profile.sourcePaths.every((sourcePath) => refs.some((ref) => ref.kind === "product" ? ref.files.some((file) => file.path === sourcePath) : ref.generatorPath === sourcePath)), "Unbound presentation source");
  requireValue(profile.materialColorSpace === "linear-srgb" && profile.outputColorSpace === "srgb", "Explicit color-space binding required");
  requireValue(["none", "aces-filmic", "reinhard"].includes(profile.toneMapping), "Unsupported bound tone mapper");
  finite(profile.exposure, Number.MIN_VALUE);
  keys(profile.lighting, ["ambient", "key", "fill"]);
  for (const role of ["ambient", "key", "fill"]) {
    const light = profile.lighting[role];
    keys(light, role === "ambient" ? ["colorSrgb24", "groundColorSrgb24", "intensity", "positionMeters"] : ["colorSrgb24", "intensity", "positionMeters"]);
    integer(light.colorSrgb24);
    finite(light.colorSrgb24, 0, 16777215);
    finite(light.intensity, 0);
    vector(light.positionMeters);
    if (role === "ambient") {
      integer(profile.lighting.ambient.groundColorSrgb24);
      finite(profile.lighting.ambient.groundColorSrgb24, 0, 16777215);
    }
  }
  keys(profile.background, ["colorSrgb24", "fogNearMeters", "fogFarMeters"]);
  integer(profile.background.colorSrgb24);
  finite(profile.background.colorSrgb24, 0, 16777215);
  finite(profile.background.fogNearMeters, 0);
  finite(profile.background.fogFarMeters, Number.MIN_VALUE);
  requireValue(profile.background.fogNearMeters < profile.background.fogFarMeters, "Invalid bound fog range");
}
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
function validatePayloadContents(fixture, buffers) {
  for (const payload of fixture.payloads) {
    if (payload.elementType.startsWith("float")) {
      for (let index = 0; index < payload.length; index += 1) {
        finite(scalar(buffers.get(payload.id), payload, index));
      }
    }
  }
  for (const region of fixture.voxelRegions ?? []) {
    const occupancy = buffers.get(region.occupancyPayload);
    const coverage = buffers.get(region.knownCoveragePayload);
    for (let index = 0; index < occupancy.length; index += 1) {
      requireValue(occupancy[index] <= 1 && coverage[index] <= 1 && (occupancy[index] === 0 || coverage[index] === 1), "Invalid occupancy/coverage");
    }
  }
  for (const object of fixture.objects) {
    if (object.meshes.length === 0) {
      continue;
    }
    const min = [Infinity, Infinity, Infinity];
    const max2 = [-Infinity, -Infinity, -Infinity];
    for (const mesh of object.meshes) {
      const positions = fixture.payloads.find((payload) => payload.id === mesh.positions);
      const indices = fixture.payloads.find((payload) => payload.id === mesh.indices);
      if (mesh.colors) {
        const colors = fixture.payloads.find((payload) => payload.id === mesh.colors);
        for (let index = 0; index < colors.length; index += 1) {
          finite(scalar(buffers.get(colors.id), colors, index), 0, 1);
        }
      }
      for (let index = 0; index < positions.length; index += 1) {
        const value = scalar(buffers.get(positions.id), positions, index);
        const axis = index % 3;
        min[axis] = Math.min(min[axis], value);
        max2[axis] = Math.max(max2[axis], value);
      }
      for (let index = 0; index < indices.length; index += 1) {
        requireValue(scalar(buffers.get(indices.id), indices, index) < positions.length / 3, "Mesh index outside vertex data");
      }
    }
    requireValue(min.every((value, axis) => value === object.bounds.min[axis]) && max2.every((value, axis) => value === object.bounds.max[axis]), "Bounds do not match actual geometry");
  }
}
async function importFixture(manifestBytes, payloads = /* @__PURE__ */ new Map()) {
  const fixture = parseBoundedJson(manifestBytes);
  validateManifest(fixture);
  requireValue(payloads.size === fixture.payloads.length, "Unexpected/missing payloads");
  for (const payload of fixture.payloads) {
    const bytes = payloads.get(payload.id);
    requireValue(bytes instanceof Uint8Array && bytes.buffer instanceof ArrayBuffer && bytes.byteLength === payload.byteLength, "Payload size/buffer mismatch");
  }
  const buffers = /* @__PURE__ */ new Map();
  for (const payload of fixture.payloads) {
    const privateBytes = new Uint8Array(payload.byteLength);
    privateBytes.set(payloads.get(payload.id));
    buffers.set(payload.id, privateBytes);
  }
  for (const payload of fixture.payloads) {
    requireValue(await sha256(buffers.get(payload.id)) === payload.sha256, "Payload SHA-256 mismatch");
  }
  validatePayloadContents(fixture, buffers);
  const fixtureDigest = await sha256(new TextEncoder().encode(canonicalJson(fixture)));
  imported.set(fixture, { digest: fixtureDigest, buffers });
  return freezeJson(fixture);
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

// inputs/rd/src/contracts/result.ts
function validateMetric(value) {
  keys(value, ["status", "value", "unit", "reason"], ["status", "unit"]);
  const metric = value;
  text(metric.unit);
  if (metric.status === "measured" || metric.status === "estimated") {
    finite(metric.value, 0);
    if (metric.status === "estimated") {
      text(metric.reason);
    }
    if (metric.reason !== void 0) {
      text(metric.reason);
    }
  } else {
    requireValue(metric.status === "unsupported" || metric.status === "not-run", "Invalid measurement status");
    requireValue(!Object.hasOwn(metric, "value"), "Unavailable measurement must not have a value (including zero/null)");
    text(metric.reason);
  }
  return freezeJson(JSON.parse(canonicalJson(metric)));
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
function validateFacts(value) {
  keys(value, ["experimentId", "variantId", "backend", "fixtureDigest", "sourceRevision", "liveResources", "logicalCosts", "unsupportedFeatures", "errors"]);
  const facts = value;
  id(facts.experimentId);
  id(facts.variantId);
  text(facts.backend);
  requireValue(/^[0-9a-f]{64}$/.test(facts.fixtureDigest), "Invalid fixture digest");
  integer(facts.sourceRevision);
  for (const metrics of [facts.liveResources, facts.logicalCosts]) {
    Object.values(record(metrics)).forEach(validateMetric);
  }
  for (const messages of [facts.unsupportedFeatures, facts.errors]) {
    array(messages);
    messages.forEach(text);
  }
  return freezeJson(JSON.parse(canonicalJson(facts)));
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
var GPU_PROJECTION_TOLERANCE_METERS = 1e-5;
function projectFloat32(values) {
  requireValue(values instanceof Float32Array || values instanceof Float64Array, "Expected floating-point projection input");
  const projected = new Float32Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    projected[index] = values[index];
    requireValue(Number.isFinite(projected[index]) && Math.abs(projected[index] - values[index]) <= GPU_PROJECTION_TOLERANCE_METERS, "Float32 GPU projection exceeds declared 1e-5 tolerance");
  }
  return projected;
}

// inputs/rd/src/experiments/rain-shield/index.ts
import { Box3, Matrix4 as Matrix42, Quaternion as Quaternion2, Vector3 as Vector32 } from "three";
var RAIN_LIMITS = Object.freeze({ particles: 4096, splashes: 128, queries: 65536, indexedCells: 2e6, fieldSamples: 1024, raySteps: 512 });
function validateRainBudget(value) {
  for (const key of ["particles", "splashes", "queries"]) {
    integer(value[key]);
    requireValue(value[key] <= RAIN_LIMITS[key], `Rain ${key} budget exceeded`);
  }
}
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
function sampleRainTrajectory(seed, particleId, tick, velocityMps) {
  integer(seed);
  integer(particleId);
  integer(tick);
  vector(velocityMps);
  requireValue(seed <= 4294967295 && particleId < RAIN_LIMITS.particles && velocityMps[1] < 0 && Math.hypot(...velocityMps) <= 60, "Invalid bounded rain trajectory");
  let state = Math.imul((seed ^ particleId) >>> 0, 1664525) + 1013904223;
  const x = (state >>> 0) / 4294967296 * 4;
  state = Math.imul(state, 1664525) + 1013904223;
  const z = (state >>> 0) / 4294967296 * 4;
  state = Math.imul(state, 1664525) + 1013904223;
  const phase = (state >>> 0) / 4294967296;
  const period = 4 / -velocityMps[1], age = (tick / 60 + phase * period) % period;
  return Object.freeze([x + velocityMps[0] * age, 4 + velocityMps[1] * age, z + velocityMps[2] * age]);
}

// inputs/rd/src/experiments/rain/index.ts
function compareRainDepthProjection(control, candidate, quantumMeters) {
  finite(quantumMeters, Number.MIN_VALUE);
  requireValue(control.fixtureDigest === candidate.fixtureDigest && control.sourceRevision === candidate.sourceRevision && JSON.stringify(control.direction) === JSON.stringify(candidate.direction) && JSON.stringify(control.sourceFrame) === JSON.stringify(candidate.sourceFrame) && JSON.stringify(control.coverageBindings) === JSON.stringify(candidate.coverageBindings) && control.travelMeters === candidate.travelMeters && control.variant === "source-query" && candidate.variant === "depth-projection" && control.columns.length === candidate.columns.length && control.columns.length > 0 && control.columns.length <= RAIN_LIMITS.fieldSamples, "Rain comparison binding mismatch");
  finite(control.travelMeters, Number.MIN_VALUE, 32);
  vector(control.direction);
  requireValue(Math.abs(Math.hypot(...control.direction) - 1) < 1e-6 && control.direction[1] < 0, "Invalid comparison direction");
  for (const field of [control, candidate]) for (const column of field.columns) {
    vector(column.originMeters);
    requireValue(["solid", "air", "unknown"].includes(column.status), "Invalid comparison coverage status");
    requireValue(column.status !== "solid" || column.hitDistanceMeters !== void 0, "Solid comparison needs hit distance");
    requireValue(column.status !== "air" || column.hitDistanceMeters === void 0, "Air comparison cannot have hit distance");
    if (column.hitDistanceMeters !== void 0) finite(column.hitDistanceMeters, 0, field.travelMeters);
  }
  const failures = [];
  control.columns.forEach((column, i) => {
    const other = candidate.columns[i];
    requireValue(JSON.stringify(column.originMeters) === JSON.stringify(other.originMeters), "Rain emitter mismatch");
    if (column.status !== other.status || column.hitDistanceMeters !== void 0 && (other.hitDistanceMeters === void 0 || Math.abs(column.hitDistanceMeters - other.hitDistanceMeters) > quantumMeters / 4 + 1e-6)) failures.push(i);
  });
  return freezeJson({ decision: failures.length ? "REJECT" : "FUNCTIONAL_PARITY_ONLY", failedColumns: failures, toleranceMeters: quantumMeters / 4 + 1e-6 });
}
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
function createRainDepthProjection(fixture) {
  const meshes = [], material = new MeshBasicMaterial({ side: DoubleSide2 }), ray = new Raycaster();
  let disposed = false, geometryBytes = 0;
  try {
    for (const object of fixture.objects) for (const source of object.meshes) {
      const role = fixture.materials.find((m) => m.id === source.materialId).role;
      if (source.presentationOnly || ["foliage", "accent", "reed", "water-presentation"].includes(role)) continue;
      const geometry = new BufferGeometry2(), positions = projectFloat32(copyFixturePayload(fixture, source.positions)), indices = copyFixturePayload(fixture, source.indices);
      requireValue(indices instanceof Uint16Array || indices instanceof Uint32Array, "Invalid depth-projection indices");
      geometry.setAttribute("position", new BufferAttribute2(positions, 3));
      geometry.setIndex(new BufferAttribute2(indices, 1));
      geometryBytes += positions.byteLength + indices.byteLength;
      const mesh = new Mesh2(geometry, material), pose = ownerPose(fixture, object.ownerId);
      mesh.position.set(...pose.originMeters);
      mesh.quaternion.set(...pose.rotationXyzw);
      mesh.updateMatrixWorld();
      meshes.push(mesh);
    }
  } catch (error) {
    meshes.forEach((m) => m.geometry.dispose());
    material.dispose();
    throw error;
  }
  return Object.freeze({
    fixtureDigest: getFixtureDigest(fixture),
    sourceRevision: fixtureRevision(fixture),
    geometryBytes,
    sample(origin, direction, travelMeters) {
      requireValue(!disposed, "Depth projection disposed");
      vector(origin);
      const down = unitDown(direction);
      finite(travelMeters, Number.MIN_VALUE, 32);
      ray.set(new Vector33(...origin), new Vector33(...down));
      ray.near = 0;
      ray.far = travelMeters;
      return ray.intersectObjects(meshes, false)[0]?.distance;
    },
    dispose() {
      if (!disposed) {
        disposed = true;
        meshes.forEach((m) => m.geometry.dispose());
        meshes.length = 0;
        material.dispose();
      }
    }
  });
}
function buildRainColumns(index, velocityMps, columnsPerSide, depth) {
  integer(columnsPerSide, 1);
  requireValue(columnsPerSide <= 16 && columnsPerSide * columnsPerSide <= RAIN_LIMITS.fieldSamples, "Rain field sample budget exceeded");
  requireValue(index.regionCount > 0, "UNSUPPORTED: no source coverage for rain");
  const down = unitDown(velocityMps), q = index.quantumMeters;
  const height = index.bounds.max[1] - index.bounds.min[1] - q / 2, travel = height / -down[1], steps = Math.ceil(travel / (q / 4));
  finite(travel, Number.MIN_VALUE, 32);
  requireValue(steps <= RAIN_LIMITS.raySteps, "Rain ray-step budget exceeded");
  validateRainBudget({ particles: 0, splashes: 0, queries: columnsPerSide * columnsPerSide * (steps + 1) * index.regionCount });
  if (depth) requireValue(depth.fixtureDigest === index.fixtureDigest && depth.sourceRevision === index.sourceRevision, "Stale depth projection");
  const columns = [];
  let queries = 0;
  for (let z = 0; z < columnsPerSide; z++) for (let x = 0; x < columnsPerSide; x++) {
    const origin = [index.bounds.min[0] + (x + 0.5) / columnsPerSide * (index.bounds.max[0] - index.bounds.min[0]), index.bounds.max[1] - q / 4, index.bounds.min[2] + (z + 0.5) / columnsPerSide * (index.bounds.max[2] - index.bounds.min[2])];
    let hitDistance, unknown = false;
    for (let step = 0; step <= steps; step++) {
      const distance = travel * step / steps, point = origin.map((v, i) => v + down[i] * distance);
      const hit = index.sample(point);
      queries += index.regionCount;
      if (hit.status === "unknown") unknown = true;
      if (hit.status === "solid") {
        hitDistance = distance;
        break;
      }
    }
    if (depth) hitDistance = depth.sample(origin, down, travel);
    const hitPoint = hitDistance === void 0 ? void 0 : origin.map((v, i) => v + down[i] * hitDistance);
    columns.push({
      originMeters: origin,
      status: unknown ? "unknown" : hitDistance === void 0 ? "air" : "solid",
      ...hitDistance === void 0 ? {} : { hitDistanceMeters: hitDistance, hitPointMeters: hitPoint }
    });
  }
  return freezeJson({ fixtureDigest: index.fixtureDigest, sourceRevision: index.sourceRevision, sourceFrame: index.sourceFrame, coverageBindings: index.coverageBindings, direction: down, travelMeters: travel, columns, queries, variant: depth ? "depth-projection" : "source-query" });
}
async function mountThreeEffect2(context, preset) {
  requireValue(["source-query", "depth-projection", "unshielded-control"].includes(preset.id), "Unknown rain variant");
  const parameters = preset.parameters ?? {};
  requireValue(Object.keys(parameters).every((k) => ["particles", "splashes", "columns", "seed", "width", "height", "dpr"].includes(k)), "Unknown rain parameter");
  const numeric = (key, fallback) => {
    const value = parameters[key] ?? fallback;
    integer(value);
    return value;
  };
  const particles = numeric("particles", 768), splashCount = numeric("splashes", 64), columns = numeric("columns", 8), seed = numeric("seed", 23);
  requireValue(particles > 0 && columns > 0 && seed <= 4294967295 && columns <= 16, "Invalid bounded rain parameters");
  validateRainBudget({ particles, splashes: splashCount, queries: 0 });
  context.signal.throwIfAborted();
  let fixture = context.fixture, disposed = false, index, depth, field, directionKey = "";
  const geometry = new BoxGeometry(0.012, 0.09, 0.012), material = new MeshBasicMaterial({ color: 12639464, transparent: true, opacity: 0.72, depthWrite: false });
  const drops = new InstancedMesh(geometry, material, particles);
  drops.name = "rain-drops";
  drops.instanceMatrix.setUsage(DynamicDrawUsage);
  drops.frustumCulled = false;
  drops.count = 0;
  const splashGeometry = new CircleGeometry(0.06, 8), splashMaterial = new MeshBasicMaterial({ color: 12639464, transparent: true, opacity: 0.5, depthWrite: false, side: DoubleSide2 });
  const splashes = new InstancedMesh(splashGeometry, splashMaterial, splashCount);
  splashes.name = "rain-splashes";
  splashes.instanceMatrix.setUsage(DynamicDrawUsage);
  splashes.frustumCulled = false;
  splashes.count = 0;
  context.root.add(drops, splashes);
  const matrix = new Matrix43(), position = new Vector33(), scale = new Vector33(), rotation = new Quaternion3(), splashRotation = new Quaternion3().setFromAxisAngle(new Vector33(1, 0, 0), -Math.PI / 2);
  let view = freezeJson({ fixtureDigest: getFixtureDigest(fixture), sourceRevision: fixtureRevision(fixture), sourceFrame: fixture.frame, coverageBindings: rainCoverageBindings(fixture), tick: 0, direction: [0, -1, 0], coverage: "not-sampled", field: null, visibleParticles: 0, clippedParticles: 0, unknownParticles: 0, splashes: 0 });
  function active() {
    context.signal.throwIfAborted();
    requireValue(!disposed, "Rain effect disposed");
  }
  function clearSource() {
    index?.dispose();
    depth?.dispose();
    index = void 0;
    depth = void 0;
    field = void 0;
    directionKey = "";
  }
  function refresh(velocity) {
    index ??= createVoxelSourceIndex(fixture);
    if (preset.id === "depth-projection") depth ??= createRainDepthProjection(fixture);
    const key = JSON.stringify(velocity);
    if (key !== directionKey) {
      field = buildRainColumns(index, velocity, columns, depth);
      directionKey = key;
    }
  }
  function update(input) {
    active();
    const frame = createFrameInput(input);
    requireValue(frame.sourceRevision === fixtureRevision(fixture), "Stale rain source");
    const velocity = rainVelocityMps(frame.weather), down = unitDown(velocity), downVector = new Vector33(...down);
    let visible = 0, clipped = 0, unknown = 0, visibleSplashes = 0;
    if (frame.weather.rain01 > 0) {
      refresh(velocity);
      const speed = Math.hypot(...velocity), period = field.travelMeters / speed, population = Math.floor(particles * frame.weather.rain01);
      rotation.setFromUnitVectors(new Vector33(0, -1, 0), new Vector33(...down));
      for (let i = 0; i < population; i++) {
        const column = field.columns[i % field.columns.length], hash = Math.imul(seed ^ i, 1664525) + 1013904223 >>> 0;
        const distance = (frame.seconds / period + hash / 4294967296) % 1 * field.travelMeters;
        const isUnknown = column.status === "unknown", blocked = preset.id !== "unshielded-control" && column.hitDistanceMeters !== void 0 && distance >= column.hitDistanceMeters - 0.05;
        if (isUnknown) {
          unknown++;
          continue;
        }
        if (blocked) {
          clipped++;
          continue;
        }
        position.set(...column.originMeters).addScaledVector(downVector, distance);
        matrix.compose(position, rotation, scale.set(1, 1, 1));
        drops.setMatrixAt(visible++, matrix);
      }
      for (const column of field.columns) {
        if (visibleSplashes >= splashCount) break;
        if (column.status !== "solid" || !column.hitPointMeters) continue;
        const pulse = (frame.tick + visibleSplashes * 13) % 30 / 30;
        position.set(...column.hitPointMeters);
        position.y += 0.035;
        matrix.compose(position, splashRotation, scale.setScalar(0.3 + pulse));
        splashes.setMatrixAt(visibleSplashes++, matrix);
      }
    }
    drops.count = visible;
    splashes.count = visibleSplashes;
    drops.instanceMatrix.needsUpdate = true;
    splashes.instanceMatrix.needsUpdate = true;
    const activeField = frame.weather.rain01 > 0 ? field : void 0;
    view = freezeJson({
      fixtureDigest: getFixtureDigest(fixture),
      sourceRevision: fixtureRevision(fixture),
      sourceFrame: fixture.frame,
      coverageBindings: rainCoverageBindings(fixture),
      tick: frame.tick,
      direction: down,
      coverage: activeField ? activeField.columns.some((c) => c.status === "unknown") ? "partly-unknown" : "known" : "not-sampled",
      field: activeField ?? null,
      visibleParticles: visible,
      clippedParticles: clipped,
      unknownParticles: unknown,
      splashes: visibleSplashes
    });
  }
  return {
    setFrame: update,
    async replaceFixture(next) {
      active();
      getFixtureDigest(next);
      clearSource();
      fixture = next;
      drops.count = 0;
      splashes.count = 0;
      view = freezeJson({ ...view, fixtureDigest: getFixtureDigest(next), sourceRevision: fixtureRevision(next), sourceFrame: next.frame, coverageBindings: rainCoverageBindings(next), coverage: "not-sampled", field: null, visibleParticles: 0, clippedParticles: 0, unknownParticles: 0, splashes: 0 });
    },
    readRainView() {
      active();
      return view;
    },
    readFacts() {
      active();
      return validateFacts({
        experimentId: "RD-31",
        variantId: preset.id,
        backend: "Three-WebGLRenderer-WebGL2",
        fixtureDigest: getFixtureDigest(fixture),
        sourceRevision: fixtureRevision(fixture),
        liveResources: { geometries: { status: "measured", value: 2, unit: "count" }, materials: { status: "measured", value: 2, unit: "count" }, particles: { status: "measured", value: drops.count, unit: "count" }, splashes: { status: "measured", value: splashes.count, unit: "count" } },
        logicalCosts: { fieldQueries: { status: "estimated", value: field?.queries ?? 0, unit: "count", reason: "Conservative region-test count for last source/direction refresh, not per-particle queries" }, sourceIndexBytes: { status: "estimated", value: index?.copiedBytes ?? 0, unit: "byte", reason: "Private source occupancy/coverage buffers" }, depthProjectionBytes: { status: "estimated", value: depth?.geometryBytes ?? 0, unit: "byte", reason: "CPU mesh depth candidate buffers" }, instanceUploadBytes: { status: "estimated", value: drops.instanceMatrix.array.byteLength + splashes.instanceMatrix.array.byteLength, unit: "byte", reason: "Full reserved matrix attributes marked dirty without update ranges, including zero visible population; excludes native driver allocations" } },
        unsupportedFeatures: ["native-gpu-depth-projection-not-measured", "rain-shadow-art-owner-pending", ...view.coverage === "partly-unknown" ? ["rain-coverage-partly-unknown"] : [], ...preset.id === "unshielded-control" ? ["deliberately-incorrect-unshielded-control"] : []],
        errors: []
      });
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        clearSource();
        drops.removeFromParent();
        splashes.removeFromParent();
        drops.dispose();
        splashes.dispose();
        geometry.dispose();
        splashGeometry.dispose();
        material.dispose();
        splashMaterial.dispose();
      }
    }
  };
}

// inputs/rd/src/experiments/foliage-wind/index.ts
import { Group as Group3, Mesh as Mesh3, Quaternion as Quaternion4, Vector3 as Vector34 } from "three";
var MAX_WIND_ANGLE_RADIANS = 0.16;
function applyWindInputs(clusterId, tick, stiffness, weather, ownerRotationXyzw, reducedMotion = false) {
  id(clusterId);
  integer(tick);
  finite(stiffness, 0, 1);
  validateWeather(weather);
  vector(ownerRotationXyzw, 4);
  requireValue(Math.abs(Math.hypot(...ownerRotationXyzw) - 1) <= 1e-6, "Owner rotation must be unit quaternion");
  let hash = 2166136261;
  for (let i = 0; i < clusterId.length; i++) hash = Math.imul(hash ^ clusterId.charCodeAt(i), 16777619);
  const phase = (hash >>> 0) / 4294967296 * Math.PI * 2 + tick / 60 * 1.8;
  const localWind = new Vector34(...weather.windMps).applyQuaternion(new Quaternion4(...ownerRotationXyzw).invert());
  const response = reducedMotion ? 0 : (1 - stiffness) * (0.55 + 0.45 * Math.sin(phase)) * 0.035;
  const clamp = (value) => Math.max(-MAX_WIND_ANGLE_RADIANS, Math.min(MAX_WIND_ANGLE_RADIANS, value));
  return freezeJson({
    localWindMps: localWind.toArray(),
    angles: response === 0 ? { x: 0, z: 0 } : { x: clamp(localWind.z * response), z: clamp(-localWind.x * response) },
    phase
  });
}

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
function setWind(x, z) {
  materialUniforms.wind.value.set(x, z);
  glUniforms.wind.value.set(x, z);
}
function surfaceMaterial(api, node, data, water = false, leaf = false) {
  const base = new api.Color().setRGB(...data.colorLinearRgb, T.LinearSRGBColorSpace);
  const material = node ? new MeshStandardNodeMaterial() : new api.MeshStandardMaterial();
  material.color.copy(base);
  material.roughness = 0.92;
  material.metalness = 0;
  material.vertexColors = true;
  if (data.role === "emission") material.emissive.copy(base);
  material.side = api.DoubleSide;
  material.forceSinglePass = water;
  material.transparent = water;
  material.opacity = water ? 0.56 : 1;
  material.depthWrite = !water;
  if (leaf) material.alphaTest = 0.5;
  if (node) {
    const m = material;
    const p = positionWorld;
    const strata = sin(p.x.mul(1.7).add(p.y.mul(2.3))).mul(cos(p.z.mul(1.4).sub(p.y)));
    m.vertexColors = false;
    m.colorNode = vec3(base.r, base.g, base.b).mul(attribute("color", "vec3")).mul(attribute("labAo", "float")).mul(mix(float(1), float(0.62), attribute("labWetness", "float"))).mul(water ? float(1) : strata.mul(0.055).add(0.96));
    m.roughnessNode = mix(float(0.92), float(0.24), attribute("labWetness", "float"));
    if (leaf) {
      const q = uv().sub(0.5);
      const mask = float(1).sub(smoothstep(0.15, 0.22, q.x.mul(q.x).mul(2).add(q.y.mul(q.y))));
      m.opacityNode = mask;
      m.positionNode = vec3(
        positionLocal.x.add(materialUniforms.wind.y.mul(positionLocal.y)),
        positionLocal.y,
        positionLocal.z.sub(materialUniforms.wind.x.mul(positionLocal.y))
      );
    }
    if (water) {
      const ripple = normalize(vec3(
        sin(p.x.mul(3.1).add(p.z.mul(1.7))).mul(0.09).add(cos(p.z.mul(8)).mul(0.035)),
        1,
        cos(p.z.mul(3.7).sub(p.x.mul(1.3))).mul(0.08).add(sin(p.x.mul(7)).mul(0.03))
      ));
      m.normalNode = normalize(cameraViewMatrix.mul(vec4(ripple, 0)).xyz);
      const sight = normalize(cameraPosition.sub(p));
      const fresnel = pow(float(1).sub(sight.dot(ripple).clamp(0, 1)), 3);
      const glint = pow(max(reflect(vec3(28, -42, 18).normalize(), ripple).dot(sight), 0), 72);
      m.outputNode = vec4(mix(output.rgb, vec3(0.23, 0.48, 0.72), fresnel.mul(0.48)).add(vec3(0.75, 0.69, 0.48).mul(glint)), output.a);
    }
  } else {
    material.customProgramCacheKey = () => `gfx03-hvp-v1:${water}:${leaf}`;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = glUniforms.wind;
      shader.vertexShader = `attribute float labAo;attribute float labWetness;varying float vAo;varying float vWetness;varying vec3 vHvpWorld;varying vec2 vLabUv;uniform vec2 uWind;
${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
vAo=labAo;vWetness=labWetness;vLabUv=uv;${leaf ? "transformed.x+=uWind.y*position.y;transformed.z-=uWind.x*position.y;" : ""}`).replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvHvpWorld=(modelMatrix*vec4(transformed,1.0)).xyz;");
      shader.fragmentShader = `varying float vAo;varying float vWetness;varying vec3 vHvpWorld;varying vec2 vLabUv;
${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
diffuseColor.rgb*=vAo*mix(1.0,0.62,vWetness);${water ? "" : "float strata=sin(vHvpWorld.x*1.7+vHvpWorld.y*2.3)*cos(vHvpWorld.z*1.4-vHvpWorld.y);diffuseColor.rgb*=0.96+0.055*strata;"}${leaf ? "vec2 q=vLabUv-vec2(0.5);diffuseColor.a*=1.0-smoothstep(0.15,0.22,q.x*q.x*2.0+q.y*q.y);" : ""}`).replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=mix(0.92,0.24,vWetness);");
      if (water) shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
vec2 p=vHvpWorld.xz;vec3 ripple=normalize(vec3(0.09*sin(p.x*3.1+p.y*1.7)+0.035*cos(p.y*8.0),1.0,0.08*cos(p.y*3.7-p.x*1.3)+0.03*sin(p.x*7.0)));normal=normalize(mat3(viewMatrix)*ripple);`).replace("#include <opaque_fragment>", `vec3 sight=normalize(cameraPosition-vHvpWorld);float fresnel=pow(1.0-clamp(dot(sight,ripple),0.0,1.0),3.0);float glint=pow(max(dot(reflect(-normalize(vec3(-28.0,42.0,-18.0)),ripple),sight),0.0),72.0);outgoingLight=mix(outgoingLight,vec3(0.23,0.48,0.72),0.48*fresnel)+vec3(0.75,0.69,0.48)*glint;
#include <opaque_fragment>`);
    };
  }
  return material;
}

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
function windInputs(clusterId, tick, stiffness, wind, rotation, reducedMotion = false) {
  if (!clusterId || !Number.isSafeInteger(tick) || tick < 0 || !Number.isFinite(stiffness) || stiffness < 0 || stiffness > 1 || !wind.every(Number.isFinite) || !rotation.every(Number.isFinite) || Math.abs(Math.hypot(...rotation) - 1) > 1e-6) throw new Error("Invalid wind inputs");
  let hash = 2166136261;
  for (let i = 0; i < clusterId.length; i++) hash = Math.imul(hash ^ clusterId.charCodeAt(i), 16777619);
  const phase = (hash >>> 0) / 4294967296 * Math.PI * 2 + tick / 60 * 1.8;
  const local = new T2.Vector3(...wind).applyQuaternion(new T2.Quaternion(...rotation).invert());
  const response = reducedMotion ? 0 : (1 - stiffness) * (0.55 + 0.45 * Math.sin(phase)) * 0.035;
  const clamp = (v) => Math.max(-0.16, Math.min(0.16, v));
  return Object.freeze({ x: response === 0 ? 0 : clamp(local.z * response), z: response === 0 ? 0 : clamp(-local.x * response), phase });
}
function assertOwner(current, expected) {
  if (current.owner !== expected.owner || current.generation !== expected.generation) throw new Error("Stale owner projection");
}
function createDepthCameraPort(camera, depth, epoch, sourceBinding) {
  if (!Number.isSafeInteger(epoch) || epoch < 0 || !depth.isDepthTexture) throw new Error("Invalid presentation port");
  return Object.freeze({
    epoch,
    sourceBinding: Object.freeze({ ...sourceBinding }),
    depth,
    projection: Object.freeze(camera.projectionMatrix.elements.slice()),
    view: Object.freeze(camera.matrixWorldInverse.elements.slice()),
    materialProfiles: Object.freeze(["HVP-strata", "HVP-stationary-water", "RD14-rough-wet", "RD14-owner-local-wind"]),
    lightDepth: lightDepthPolicy,
    depthInterpretation: "native renderer clip convention; WebGPU [0,1], WebGL [-1,1]; opaque-only writers"
  });
}

// src/reuse.ts
function bindRestoredOrigin(material, origin) {
  const original = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    original(shader, renderer);
    shader.uniforms.uRestoredOrigin = origin;
    shader.vertexShader = "uniform vec3 uRestoredOrigin;\n" + shader.vertexShader.replace("vHvpWorld=(modelMatrix*vec4(transformed,1.0)).xyz;", "vHvpWorld=(modelMatrix*vec4(transformed,1.0)).xyz+uRestoredOrigin;");
    shader.fragmentShader = "uniform vec3 uRestoredOrigin;\n" + shader.fragmentShader.replace("cameraPosition-vHvpWorld", "cameraPosition+uRestoredOrigin-vHvpWorld");
  };
}

export {
  importFixture,
  getFixtureDigest,
  fixtureRevision,
  copyFixturePayload,
  ownerPose,
  createVoxelSourceIndex,
  sampleRainExposure,
  sampleRainTrajectory,
  compareRainDepthProjection,
  rainVelocityMps,
  rainDirection,
  createRainDepthProjection,
  buildRainColumns,
  mountThreeEffect2 as mountThreeEffect,
  applyWindInputs,
  WET_LIMITS,
  createWetnessPreset,
  DEFAULT_WETNESS_PRESET,
  sampleAnalyticWetness,
  createWetnessSourceCache,
  glUniforms,
  setWind,
  surfaceMaterial,
  windInputs,
  assertOwner,
  createDepthCameraPort,
  bindRestoredOrigin
};
