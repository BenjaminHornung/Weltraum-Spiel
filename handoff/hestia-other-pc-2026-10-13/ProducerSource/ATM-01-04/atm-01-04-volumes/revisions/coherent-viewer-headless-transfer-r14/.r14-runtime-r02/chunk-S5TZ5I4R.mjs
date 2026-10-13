import {
  validateFrame
} from "./chunk-6PZDKU43.mjs";

// src/borrowed-port.ts
var PORT_IDS = [
  "WEATHER",
  "FRAME",
  "OPTICS",
  "DEPTH",
  "GL_VOLUME",
  "TAKRAM",
  "MATERIAL",
  "RAIN",
  "WETNESS_WATER",
  "VELOCITY",
  "LIGHT_REACTIVITY",
  "HISTORY",
  "OUTPUT_VIEW"
];
var pending = (reasonCode) => ({ status: "Pending", reasonCode });
var unsupported = (reasonCode) => ({ status: "Unsupported", reasonCode });
var record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
var text = (v) => typeof v === "string" && v.length > 0;
var natural = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
var finite = (v) => typeof v === "number" && Number.isFinite(v);
var vector = (v, n) => Array.isArray(v) && v.length === n && Array.from(v).every(finite);
var digest = (v) => typeof v === "string" && /^sha256:[a-f0-9]{64}$/.test(v);
function reference(v) {
  return record(v) && text(v.sourceId) && text(v.absolutePath) && /^C:[\\/]IFI_SourceCode[\\/]/i.test(v.absolutePath) && natural(v.bytes) && v.bytes > 0 && typeof v.sha256 === "string" && /^[a-f0-9]{64}$/.test(v.sha256);
}
function currentFrame(v) {
  if (!record(v)) return pending("CURRENT_FRAME_MISSING");
  for (const k of ["viewSessionId", "frameId", "sourcePresentationRevision"]) {
    if (v[k] === void 0) return pending("CURRENT_FRAME_MISSING:" + k);
    if (!text(v[k])) return unsupported("CURRENT_FRAME_INVALID:" + k);
  }
  for (const k of ["resourceGeneration", "cameraEpoch", "projectionEpoch", "atlasEpoch"]) {
    if (v[k] === void 0) return pending("EPOCH_MISSING:" + k);
    if (!natural(v[k])) return unsupported("EPOCH_INVALID:" + k);
  }
  if (!digest(v.weatherSnapshotId) || !digest(v.opticsDigest) || !digest(v.atlasDigest) || !vector(v.originMeters, 3))
    return unsupported("CURRENT_FRAME_BINDING_INVALID");
  return null;
}
function coherentFrame(a, b) {
  if (!record(a)) return false;
  const keys = [
    "viewSessionId",
    "frameId",
    "sourcePresentationRevision",
    "resourceGeneration",
    "cameraEpoch",
    "projectionEpoch",
    "atlasEpoch",
    "weatherSnapshotId",
    "opticsDigest",
    "atlasDigest"
  ];
  return keys.every((k) => a[k] === b[k]) && vector(a.originMeters, 3) && a.originMeters.every((v, i) => v === b.originMeters[i]);
}
function image(v, current, owner, role) {
  if (!record(v)) return pending("IMAGE_MISSING:" + role);
  if (!text(owner)) return pending("PRODUCER_OWNER_MISSING:" + role);
  if (v.ownerId !== owner || v.disposalOwner !== "PRODUCER_ONLY") return unsupported("BORROWED_OWNERSHIP_INVALID:" + role);
  if (!text(v.resourceKey) || !text(v.format) || !natural(v.width) || !natural(v.height) || v.width < 1 || v.height < 1 || v.sampleCount !== 1 || !["WebGL", "WebGPU"].includes(String(v.backend))) return unsupported("IMAGE_METADATA_INVALID:" + role);
  const epoch = currentFrame(v.frame);
  if (epoch) return epoch;
  if (!coherentFrame(v.frame, current) || v.validUntil !== "FRAME_END_OR_OWNER_GENERATION_CHANGE")
    return unsupported("BORROWED_LEASE_STALE:" + role);
  return null;
}
function depth(v, current, owner) {
  if (!record(v)) return pending("DEPTH_MISSING");
  const header = image(v.image, current, owner, "depth");
  if (header) return header;
  for (const key of [
    "projectionKind",
    "clipDepthRange",
    "nearMeters",
    "farMeters",
    "reversedZ",
    "logarithmicDepth",
    "encoding",
    "writers",
    "backgroundValidity",
    "currentProjectionUnjittered",
    "currentView"
  ])
    if (v[key] === void 0) return pending("DEPTH_METADATA_MISSING:" + key);
  const im = v.image;
  if (!["Perspective", "Orthographic"].includes(String(v.projectionKind)) || !finite(v.nearMeters) || !finite(v.farMeters) || v.nearMeters <= 0 || v.farMeters <= v.nearMeters || typeof v.reversedZ !== "boolean" || v.logarithmicDepth !== false || v.encoding !== "NATIVE_SINGLE_SAMPLE_DEPTH_ATTACHMENT" || v.writers !== "OPAQUE_ONLY" || v.backgroundValidity !== "EXPLICIT_SKY_DISPOSITION" || !vector(v.currentProjectionUnjittered, 16) || !vector(v.currentView, 16) || v.clipDepthRange !== (im.backend === "WebGL" ? "MinusOneToOne" : "ZeroToOne")) return unsupported("DEPTH_CONVENTION_INVALID");
  return null;
}
function lighting(v) {
  if (!record(v)) return pending("LIGHTNING_LIGHT_PROJECTION_MISSING");
  for (const key of ["bindingRef", "revision", "eventId", "phase", "sourceStrength", "sunDirectionBody", "shadowAtlasLightingDigest"])
    if (v[key] === void 0) return pending("LIGHT_PROJECTION_MISSING:" + key);
  if (!reference(v.bindingRef) || !text(v.revision) || !["STEADY", "BEGIN", "CHANGE", "END"].includes(String(v.phase)) || !finite(v.sourceStrength) || v.sourceStrength < 0 || !vector(v.sunDirectionBody, 3) || Math.abs(Math.hypot(...v.sunDirectionBody) - 1) > 1e-8 || !digest(v.shadowAtlasLightingDigest) || v.eventId !== null && !text(v.eventId) || v.phase !== "STEADY" && v.eventId === null || v.eventId === "fixture.lightning") return unsupported("LIGHT_PROJECTION_INVALID_OR_COLLAPSED");
  return null;
}
function validateBorrowedPort(input) {
  const port = record(input) && PORT_IDS.includes(input.port) ? input.port : null;
  const fail = (issue) => ({ ...issue, port });
  if (!record(input) || port === null) return fail(unsupported("PORT_UNKNOWN"));
  if (!record(input.weather)) return fail(pending("WEATHER_READ_MISSING"));
  const weather = input.weather;
  if (weather.status === "Pending") return fail(text(weather.dependency) ? pending("WEATHER_PENDING:" + weather.dependency) : unsupported("WEATHER_DEPENDENCY_MISSING"));
  if (weather.status === "Unsupported" || weather.status === "UnknownCoverage")
    return fail(unsupported(text(weather.reasonCode) ? "WEATHER_" + weather.status + ":" + weather.reasonCode : "WEATHER_REASON_MISSING"));
  if (!["Known", "NoAtmosphere"].includes(String(weather.status))) return fail(unsupported("WEATHER_STATUS_INVALID"));
  if (weather.frozenResult === void 0) return fail(pending("FROZEN_WEATHER_BINDING_MISSING"));
  if (!reference(weather.frozenResult)) return fail(unsupported("FROZEN_WEATHER_BINDING_INVALID"));
  if (!record(input.sourceFrame)) return fail(pending("ATMOSPHERE_FRAME_MISSING"));
  let frame;
  try {
    frame = validateFrame(input.sourceFrame);
  } catch (error) {
    return fail(unsupported("ACTUAL_FRAME_REJECTED:" + (error instanceof Error ? error.message : "INVALID")));
  }
  if (frame.status !== weather.status) return fail(unsupported("WEATHER_FRAME_STATUS_MISMATCH"));
  if (port === "OPTICS") {
    if (!record(input.segment)) return fail(pending("OPTICAL_SEGMENT_MISSING"));
    const s = input.segment;
    if (!finite(s.T) || s.T < 0 || s.T > 1 || !vector(s.L, 3) || s.L.some((v2) => v2 < 0)) return fail(unsupported("OPTICAL_SEGMENT_INVALID"));
    if (frame.status === "NoAtmosphere" && (s.T !== 1 || s.L.some((v2) => v2 !== 0))) return fail(unsupported("NO_ATMOSPHERE_OPTICAL_SEGMENT_NONEMPTY"));
  }
  if (port === "WEATHER" || port === "FRAME" || port === "OPTICS")
    return { status: "ValidatedSourceOnly", port, temporalReady: false, execution: "NOT_RUN", selectedOption: null };
  const epoch = currentFrame(input.current);
  if (epoch) return fail(epoch);
  const current = input.current;
  if (input.currentEvidence === void 0) return fail(pending("CURRENT_FRAME_EVIDENCE_MISSING"));
  if (!reference(input.currentEvidence)) return fail(unsupported("CURRENT_FRAME_EVIDENCE_INVALID"));
  if (current.weatherSnapshotId !== frame.weatherSnapshotId || current.opticsDigest !== frame.opticsDigest || current.atlasEpoch !== frame.atlasEpoch || current.originMeters.some((v2, i) => v2 !== frame.originMeters[i])) return fail(unsupported("FRAME_ATLAS_ORIGIN_BINDING_MISMATCH"));
  if (!record(input.contribution)) return fail(pending("BORROWED_CONTRIBUTION_MISSING"));
  const c = input.contribution;
  const owners = record(input.producerOwners) ? input.producerOwners : {};
  const d = depth(c.depth, current, owners.depth);
  if (d) return fail(d);
  if (port === "DEPTH") return { status: "ValidatedSourceOnly", port, temporalReady: false, execution: "NOT_RUN", selectedOption: null };
  const hdr = image(c.hdrColor, current, owners.hdrColor, "hdrColor");
  if (hdr) return fail(hdr);
  if (c.colorSpace !== "LINEAR_HDR" || c.toneMapped !== false) return fail(unsupported("PRE_TONE_HDR_REQUIRED"));
  const hdrImage = c.hdrColor;
  const depthImage = c.depth.image;
  if (hdrImage.backend !== depthImage.backend || hdrImage.width !== depthImage.width || hdrImage.height !== depthImage.height)
    return fail(unsupported("COLOR_DEPTH_MISMATCH"));
  if ((port === "GL_VOLUME" || port === "TAKRAM") && hdrImage.backend !== "WebGL") return fail(unsupported("FROZEN_PORT_WEBGL_ONLY"));
  if (c.waterDepth === void 0) return fail(pending("WATER_DEPTH_DISPOSITION_MISSING"));
  if (c.waterStrategy !== "NEAREST_PLANAR_FRONT_BACK_ALPHA_PRESERVED") return fail(unsupported("TRANSPARENT_WATER_STRATEGY_UNSUPPORTED"));
  if (c.waterDepth !== null) {
    const w = image(c.waterDepth, current, owners.waterDepth, "waterDepth");
    if (w) return fail(w);
    const water = c.waterDepth;
    if (water.resourceKey === depthImage.resourceKey && water.ownerId === depthImage.ownerId) return fail(unsupported("WATER_IS_NOT_OPAQUE_DEPTH"));
    if (water.backend !== hdrImage.backend || water.width !== hdrImage.width || water.height !== hdrImage.height) return fail(unsupported("WATER_DEPTH_MISMATCH"));
  }
  if (!record(c.velocity) || c.velocity.availability === "MISSING") return fail(pending("GENUINE_VELOCITY_MISSING"));
  const v = c.velocity;
  if (v.availability !== "AVAILABLE") return fail(unsupported("VELOCITY_AVAILABILITY_INVALID"));
  const motion = image(v.image, current, owners.velocity, "velocity");
  if (motion) return fail(motion);
  const motionImage = v.image;
  if (motionImage.backend !== hdrImage.backend || motionImage.width !== hdrImage.width || motionImage.height !== hdrImage.height)
    return fail(unsupported("VELOCITY_IMAGE_MISMATCH"));
  if (v.convention !== "UNJITTERED_NDC_CURRENT_MINUS_PREVIOUS" || !text(v.previousFrameId) || v.previousFrameId === current.frameId || !vector(v.previousProjectionUnjittered, 16) || !vector(v.previousView, 16) || !reference(v.geometryDeformationOracle) || v.disocclusionPolicy !== "NO_PREVIOUS_COLOR_FOR_NEW_SURFACE") return fail(unsupported("VELOCITY_OR_PREVIOUS_FRAME_UNPROVEN"));
  if (!record(c.reactive) || c.reactive.availability === "MISSING") return fail(pending("REACTIVE_COVERAGE_MISSING"));
  const reactive = c.reactive;
  if (reactive.availability !== "AVAILABLE") return fail(unsupported("REACTIVE_AVAILABILITY_INVALID"));
  const r = image(reactive.image, current, owners.reactive, "reactive");
  if (r) return fail(r);
  const reactiveImage = reactive.image;
  if (reactiveImage.backend !== hdrImage.backend || reactiveImage.width !== hdrImage.width || reactiveImage.height !== hdrImage.height)
    return fail(unsupported("REACTIVE_IMAGE_MISMATCH"));
  if (reactive.channel !== "RED_0_TO_1" || !Array.isArray(reactive.includes) || reactive.includes.length === 0 || !reactive.includes.every((v2) => ["Water", "Volume", "Rain", "Lightning", "NewSurface"].includes(v2)) || !reference(reactive.coverageOracle))
    return fail(unsupported("REACTIVE_ORACLE_UNPROVEN"));
  const light = lighting(input.lighting);
  if (light) return fail(light);
  const reactiveLight = lighting(reactive.lighting);
  if (reactiveLight) return fail(reactiveLight);
  const l = input.lighting;
  const rl = reactive.lighting;
  if (c.waterDepth !== null && !reactive.includes.includes("Water") || frame.rain01 > 0 && !reactive.includes.includes("Rain") || frame.authoredCloudCoverage > 0 && !reactive.includes.includes("Volume") || l.phase !== "STEADY" && !reactive.includes.includes("Lightning"))
    return fail(unsupported("REACTIVE_EFFECT_COVERAGE_UNBOUND"));
  if (l.revision !== rl.revision || l.eventId !== rl.eventId || l.phase !== rl.phase || l.sourceStrength !== rl.sourceStrength || l.shadowAtlasLightingDigest !== rl.shadowAtlasLightingDigest || l.bindingRef.sha256 !== rl.bindingRef.sha256 || l.sunDirectionBody.some((v2, i) => v2 !== rl.sunDirectionBody[i])) return fail(unsupported("REACTIVE_LIGHT_BINDING_MISMATCH"));
  if (!record(input.history)) return fail(pending("PACKAGE_HISTORY_MISSING"));
  if (input.historyEvidence === void 0) return fail(pending("PACKAGE_HISTORY_CONTRACT_MISSING"));
  if (!reference(input.historyEvidence)) return fail(unsupported("PACKAGE_HISTORY_CONTRACT_INVALID"));
  const h = input.history;
  for (const key of ["generation", "valid", "inputResolution", "displayResolution", "cameraEpoch", "projectionEpoch", "sourceFrameId", "bufferOwner"])
    if (h[key] === void 0) return fail(pending("HISTORY_METADATA_MISSING:" + key));
  if (h.valid === false) return fail(pending("PACKAGE_HISTORY_INVALID"));
  if (h.valid !== true || !natural(h.generation) || h.bufferOwner !== "SELECTED_TEMPORAL_PACKAGE_ONLY" || h.cameraEpoch !== current.cameraEpoch || h.projectionEpoch !== current.projectionEpoch || !text(h.sourceFrameId) || !vector(h.inputResolution, 2) || !vector(h.displayResolution, 2) || !h.inputResolution.every((n) => natural(n) && n > 0) || !h.displayResolution.every((n) => natural(n) && n > 0) || h.inputResolution[0] !== hdrImage.width || h.inputResolution[1] !== hdrImage.height) return fail(unsupported("HISTORY_BINDING_INVALID"));
  return { status: "ValidatedSourceOnly", port, temporalReady: false, execution: "NOT_RUN", selectedOption: null };
}

export {
  PORT_IDS,
  validateBorrowedPort
};
