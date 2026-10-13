// src/composer.ts
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
function freezeJson(value) {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => {
      freezeJson(child);
    });
    Object.freeze(value);
  }
  return value;
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
var KEY_LIGHT_POSITION = Object.freeze([-10, 20, -10]);

// inputs/rd/src/experiments/three-control/index.ts
import { BufferAttribute, BufferGeometry, Color as Color2, DoubleSide, FrontSide, Group as Group2, LinearSRGBColorSpace, Mesh, MeshLambertMaterial } from "three";

// inputs/rd/src/experiments/rain-shield/index.ts
import { Box3, Matrix4 as Matrix42, Quaternion as Quaternion2, Vector3 as Vector32 } from "three";
var RAIN_LIMITS = Object.freeze({ particles: 4096, splashes: 128, queries: 65536, indexedCells: 2e6, fieldSamples: 1024, raySteps: 512 });

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

// src/optics.ts
var finite2 = (v, min = 0, max2 = Infinity) => {
  if (!Number.isFinite(v) || v < min || v > max2) throw Error("OPTICAL_RANGE");
  return v;
};
var vector2 = (v) => {
  if (!Array.isArray(v) || v.length !== 3 || ![...v].every(Number.isFinite)) throw Error("VECTOR");
  return v;
};
function integrate(sigma, length, steps, source) {
  finite2(length);
  finite2(steps, 1, 1024);
  if (!Number.isInteger(steps)) throw Error("STEPS");
  vector2(source);
  source.forEach((v) => finite2(v));
  let T4 = 1;
  const L = [0, 0, 0], ds = length / steps;
  for (let i = 0; i < steps; i++) {
    const extinction = finite2(sigma((i + 0.5) * ds)), segmentT = Math.exp(-extinction * ds);
    for (let c = 0; c < 3; c++) L[c] += T4 * source[c] * -Math.expm1(-extinction * ds);
    T4 *= segmentT;
  }
  return { T: T4, L };
}
function shellInterval(origin, direction, radius, outer) {
  vector2(origin);
  vector2(direction);
  finite2(radius, Number.MIN_VALUE);
  finite2(outer, radius);
  if (outer <= radius) throw Error("OPTICAL_RANGE");
  if (Math.abs(Math.hypot(...direction) - 1) > 1e-8) throw Error("DIRECTION_UNIT");
  const dot = origin.reduce((s, v, i) => s + v * direction[i], 0), r2 = origin.reduce((s, v) => s + v * v, 0);
  const hit = (r) => {
    const disc = dot * dot - r2 + r * r;
    return disc < 0 ? null : [-dot - Math.sqrt(disc), -dot + Math.sqrt(disc)];
  };
  const outside = hit(outer);
  if (!outside || outside[1] <= 0) return null;
  const start = Math.max(0, outside[0]);
  let end = outside[1];
  const ground = hit(radius);
  if (ground && ground[1] >= start) {
    if (ground[0] >= start) end = Math.min(end, ground[0]);
    else if (r2 <= radius * radius && dot < 0) return null;
  }
  return end > start ? [start, end] : null;
}
function density(p, coverage) {
  vector2(p);
  finite2(coverage, 0, 1);
  const edge = Math.max(0, 1 - Math.abs((p[1] - 20) / 12)) * Math.max(0, 1 - Math.abs(p[0] / 80)) * Math.max(0, 1 - Math.abs(p[2] / 80));
  const lobes = 0.65 + 0.35 * Math.sin(p[0] * 0.13 + p[1] * 0.21) * Math.cos(p[2] * 0.11 - p[1] * 0.17);
  return coverage * edge * lobes * 0.11;
}
function buildLut(profile, rows = 16, width = 32) {
  finite2(profile.radius, 1);
  finite2(profile.height, 1);
  finite2(profile.scaleHeight, 1);
  finite2(profile.sigma);
  finite2(rows, 2, 128);
  finite2(width, 2, 256);
  if (!Number.isInteger(rows) || !Number.isInteger(width)) throw Error("LUT_SIZE");
  const values = new Float32Array(rows * width);
  for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) {
    const altitude = y / (rows - 1) * profile.height, mu = x / (width - 1), o = [0, profile.radius + altitude, 0], d = [Math.sqrt(1 - mu * mu), mu, 0];
    const segment = shellInterval(o, d, profile.radius, profile.radius + profile.height);
    values[y * width + x] = segment ? integrate((s) => profile.sigma * Math.exp(-(Math.hypot(d[0] * s, o[1] + d[1] * s) - profile.radius) / profile.scaleHeight), segment[1], 128, [0, 0, 0]).T : 1;
  }
  return { ...profile, width, rows, values };
}
function createHistory() {
  let previous = null, disposed = false, resources = 2;
  return {
    get resources() {
      return resources;
    },
    set(frame) {
      if (disposed) throw Error("DISPOSED");
      vector2(frame.origin);
      finite2(frame.height, -1e3);
      for (const id2 of ["weather", "profile", "macro", "model", "optics"]) if (typeof frame[id2] !== "string" || !frame[id2]) throw Error("HISTORY_BINDING");
      for (const id2 of ["source", "atlas", "epoch"]) if (!Number.isSafeInteger(frame[id2]) || frame[id2] < 0) throw Error("HISTORY_EPOCH");
      if (frame.lightning !== null && (typeof frame.lightning !== "string" || !frame.lightning)) throw Error("LIGHTNING");
      const signature = (v) => JSON.stringify({ ...v, height: 0 });
      const result = !previous ? "FIRST" : signature(frame) !== signature(previous) || Math.abs(frame.height - previous.height) > 100 ? "RESET" : "CURRENT";
      previous = structuredClone(frame);
      return result;
    },
    acceptAtlas(epoch) {
      if (disposed || !previous || epoch !== previous.atlas) throw Error("STALE_ATLAS");
    },
    contextLost() {
      previous = null;
      resources = 0;
    },
    dispose() {
      disposed = true;
      previous = null;
      resources = 0;
    }
  };
}
function skyProfile(frame) {
  return { radius: frame.bodyRadiusMeters, height: 6e4, scaleHeight: 8e3, sigma: frame.status === "NoAtmosphere" ? 0 : 1e-5 + frame.weatherExtinctionPerM };
}
function validateFrame(frame) {
  if (!frame || !["Known", "NoAtmosphere"].includes(frame.status) || typeof frame.bodyId !== "string" || !frame.bodyId || !frame.binding || typeof frame.binding !== "object") throw Error("FRAME_STATUS");
  if (!/^sha256:[a-f0-9]{64}$/.test(frame.weatherSnapshotId) || !/^sha256:[a-f0-9]{64}$/.test(frame.opticsDigest)) throw Error("FRAME_DIGEST");
  const binding = frame.binding;
  for (const key of ["worldId", "sessionId", "sourceEpoch", "sourceOwner", "sourceRevision", "sourceDigest", "atmosphereEpoch", "authorityRevision", "eventCursor", "eventDigest"]) if (typeof binding[key] !== "string" || !binding[key]) throw Error("WEATHER_BINDING:" + key);
  if (binding.simulationTick !== frame.simulationTick) throw Error("WEATHER_TICK_BINDING");
  for (const key of ["profile", "model", "climateNormals"]) {
    const ref = binding[key];
    if (!ref || typeof ref.id !== "string" || !Number.isSafeInteger(ref.version) || !/^sha256:[a-f0-9]{64}$/.test(ref.digest ?? "")) throw Error("WEATHER_REFERENCE:" + key);
  }
  for (const n of [frame.simulationTick, frame.sourceRevision, frame.atlasEpoch]) if (!Number.isSafeInteger(n) || n < 0) throw Error("FRAME_TICK");
  finite2(frame.bodyRadiusMeters, 1);
  vector2(frame.bodyNormal);
  if (Math.abs(Math.hypot(...frame.bodyNormal) - 1) > 1e-8) throw Error("BODY_NORMAL");
  vector2(frame.originMeters);
  vector2(frame.windMps);
  finite2(frame.weatherExtinctionPerM);
  finite2(frame.authoredCloudCoverage, 0, 1);
  finite2(frame.rain01, 0, 1);
  if (!Array.isArray(frame.stormIds) || !frame.stormIds.every((s) => typeof s === "string" && s.length > 0) || new Set(frame.stormIds).size !== frame.stormIds.length) throw Error("STORM_IDS");
  if (frame.status === "NoAtmosphere" && (frame.weatherExtinctionPerM !== 0 || frame.authoredCloudCoverage !== 0 || frame.rain01 !== 0)) throw Error("NO_ATMOSPHERE_OPTICS");
  const detached = structuredClone(frame);
  const freeze = (v) => {
    if (v && typeof v === "object") {
      Object.freeze(v);
      for (const child of Object.values(v)) freeze(child);
    }
  };
  freeze(detached);
  return detached;
}

// shaders/volume.frag.glsl
var volume_frag_default = "precision highp float;\nprecision highp sampler3D;\nin vec2 vUv;\nuniform sampler2D opaqueColor,opaqueDepth,waterColor,waterDepth,skyLut;\nuniform sampler3D cloudAtlas;\nuniform mat4 inverseProjection,cameraWorld;\nuniform vec3 originOffset,sunDirection;\nuniform float radiusMeters,skyHeight,skyScaleHeight,rayleighPerM,miePerM,cloudCoverage,fogPerM,lightning,farLimit,waterOpacity;\nuniform int steps,skyMode,defect;\nout vec4 result;\nvec3 point(float z){vec4 p=inverseProjection*vec4(vUv*2.0-1.0,z*2.0-1.0,1.0);p/=p.w;return (cameraWorld*p).xyz+originOffset;}\nfloat opticalDensity(vec3 p){\n vec3 uv=(p-vec3(-80.0,8.0,-80.0))/vec3(160.0,24.0,160.0);\n float cloud=all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))?texture(cloudAtlas,uv).r*cloudCoverage:0.0;\n float fog=p.y>=0.0&&p.y<=8.0?fogPerM*exp(-p.y/5.0):0.0;\n return defect==1?0.0:cloud+fog;\n}\nbool clipSlab(float o,float d,float lo,float hi,inout float a,inout float b){\n if(d==0.0)return o>=lo&&o<=hi;\n float x=(lo-o)/d,y=(hi-o)/d;\n a=max(a,min(x,y));b=min(b,max(x,y));\n return b>a;\n}\nvec4 march(vec3 o,vec3 d,float a,float b){\n if(!clipSlab(o.x,d.x,-80.0,80.0,a,b)||!clipSlab(o.y,d.y,0.0,32.0,a,b)||!clipSlab(o.z,d.z,-80.0,80.0,a,b))return vec4(0.0,0.0,0.0,1.0);\n if(b<=a)return vec4(0.0,0.0,0.0,1.0);\n vec3 L=vec3(0.0);float T=1.0,ds=max(0.0,b-a)/float(steps);\n for(int i=0;i<96;i++){if(i>=steps)break;vec3 p=o+d*(a+(float(i)+0.5)*ds);float sigma=opticalDensity(p);\n  float t=exp(-sigma*ds);\n  // One bounded sun optical-depth integral per voxel is baked into alpha of the immutable atlas.\n  vec3 uv=(p-vec3(-80.0,8.0,-80.0))/vec3(160.0,24.0,160.0);\n  float shadow=all(greaterThanEqual(uv,vec3(0.0)))&&all(lessThanEqual(uv,vec3(1.0)))?texture(cloudAtlas,uv).g:1.0;\n  vec3 source=vec3(0.32,0.43,0.48)*(0.3+0.7*shadow)+vec3(lightning);\n  L+=T*source*(1.0-t);T*=t;\n }\n return vec4(L,T);\n}\nvec3 sky(vec3 o,vec3 d){\n vec3 bodyOrigin=o+vec3(0.0,radiusMeters,0.0);\n float radialDistance=length(bodyOrigin),altitude=max(0.0,radialDistance-radiusMeters),mu=dot(d,normalize(bodyOrigin)),day=smoothstep(-0.08,0.08,sunDirection.y);\n float b=dot(bodyOrigin,d),disc=b*b+(radiusMeters+skyHeight)*(radiusMeters+skyHeight)-dot(bodyOrigin,bodyOrigin);\n if(disc<=0.0)return vec3(0.006,0.008,0.014);\n float start=max(0.0,-b-sqrt(disc)),end=max(0.0,-b+sqrt(disc));\n float groundDisc=b*b+radiusMeters*radiusMeters-dot(bodyOrigin,bodyOrigin);\n if(groundDisc>=0.0){float groundEnter=-b-sqrt(groundDisc);if(groundEnter>=start)end=min(end,groundEnter);}\n float opticalDepth=0.0,ds=(end-start)/32.0;\n for(int i=0;i<32;i++){float s=start+(float(i)+0.5)*ds,h=sqrt((radiusMeters+altitude)*(radiusMeters+altitude)+s*s+2.0*(radiusMeters+altitude)*mu*s)-radiusMeters;opticalDepth+=(rayleighPerM+miePerM)*exp(-max(h,0.0)/skyScaleHeight)*ds;}\n float T=exp(-opticalDepth);\n if(skyMode==1&&rayleighPerM+miePerM>0.0&&mu>=0.0&&altitude<=skyHeight){vec2 size=vec2(textureSize(skyLut,0));T=texture(skyLut,(vec2(mu,altitude/skyHeight)*(size-1.0)+0.5)/size).r;}\n float cosine=dot(d,sunDirection),phase=0.75*(1.0+cosine*cosine);\n return vec3(0.006,0.008,0.014)*T+day*vec3(0.35,0.48,0.65)*phase*(1.0-T)+day*vec3(8.0)*smoothstep(0.9998,1.0,cosine)*T;\n}\nvoid main(){\n vec3 o=cameraWorld[3].xyz+originOffset,d=normalize(point(1.0)-o);\n float raw=texture(opaqueDepth,vUv).r,wd=texture(waterDepth,vUv).r;\n float distance=raw<1.0?min(length(point(raw)-o),farLimit):farLimit;\n vec3 background=raw<1.0?texture(opaqueColor,vUv).rgb:sky(o,d);\n if(skyMode==2)background=texture(opaqueColor,vUv).rgb;\n bool hasWater=wd<1.0;float wDistance=hasWater?length(point(wd)-o):distance;\n hasWater=hasWater&&wDistance<distance;\n float split=hasWater?wDistance:distance;\n if(defect==2)split=hasWater?max(0.0,distance-wDistance):distance;\n vec4 front=march(o,d,0.0,split),back=march(o,d,split,distance);\n vec3 behind=back.rgb+back.a*background;\n vec4 water=texture(waterColor,vUv);\n vec3 middle=hasWater?water.rgb+(1.0-water.a)*behind:behind;\n vec3 color=front.rgb+front.a*middle;\n if(defect==3)color=march(o,d,0.0,distance).rgb+march(o,d,0.0,distance).a*color;\n result=vec4(color,1.0);\n}\n";

// shaders/fullscreen.vert.glsl
var fullscreen_vert_default = "out vec2 vUv;\nvoid main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}\n";

// shaders/output.frag.glsl
var output_frag_default = "uniform sampler2D colorBuffer;\nin vec2 vUv;\nout vec4 result;\nvoid main(){\n vec3 x=texture(colorBuffer,vUv).rgb;\n // One display transform; all preceding targets are linear HDR.\n x=clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);\n result=vec4(mix(12.92*x,1.055*pow(x,vec3(1.0/2.4))-0.055,step(vec3(0.0031308),x)),1.0);\n}\n";

// src/timer.ts
function createDiagnosticTimer(gl) {
  const extension = gl?.getExtension("EXT_disjoint_timer_query_webgl2");
  const pending = [], results = [];
  let issued = 0, disposed = false;
  return {
    measure(name, work) {
      if (disposed || !gl || !extension || issued >= 48) return work();
      const query = gl.createQuery();
      if (!query) return work();
      issued++;
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
      try {
        return work();
      } finally {
        gl.endQuery(extension.TIME_ELAPSED_EXT);
        pending.push({ name, query });
      }
    },
    poll() {
      if (!gl || !extension) return;
      const disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      for (let i = pending.length - 1; i >= 0; i--) {
        const item = pending[i];
        if (disjoint || gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) {
          const ns = disjoint ? null : gl.getQueryParameter(item.query, gl.QUERY_RESULT);
          results.push({ name: item.name, status: disjoint ? "DISJOINT" : typeof ns === "number" && Number.isFinite(ns) ? "DIAGNOSTIC" : "UNAVAILABLE", milliseconds: typeof ns === "number" && Number.isFinite(ns) ? ns / 1e6 : null });
          gl.deleteQuery(item.query);
          pending.splice(i, 1);
        }
      }
    },
    read() {
      return { status: !gl || !extension ? "UNAVAILABLE" : results.length ? "DIAGNOSTIC_UNQUALIFIED" : "PENDING", results: [...results], maxQueries: 48, referenceAcceptance: false };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (gl) for (const item of pending) gl.deleteQuery(item.query);
      pending.length = 0;
    }
  };
}

// src/init.ts
function disposeOwned(actions) {
  const errors = [];
  for (const action of [...actions].reverse()) try {
    action();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, "ATM_CLEANUP_FAILED");
}

// src/composer.ts
function createVolumePort(renderer, scene, camera, water, initial) {
  let frame = validateFrame(initial), disposed = false, lost = false, epoch = 1, lightningId = null, mode = 0, defect = 0;
  const savedFog = scene.fog, owned = [() => {
    scene.fog = savedFog;
  }];
  scene.fog = null;
  const own = (value) => {
    owned.push(() => value.dispose());
    return value;
  };
  try {
    let active2 = function() {
      if (disposed) throw Error("VOLUME_DISPOSED");
    };
    var active = active2;
    const context = renderer.getContext?.() ?? null;
    let timer = createDiagnosticTimer(context && "beginQuery" in context ? context : null), uploaded = false;
    owned.push(() => timer.dispose());
    const history = own(createHistory()), targets = [];
    const make = (depth = true) => {
      const target = own(new T3.WebGLRenderTarget(1, 1, { type: T3.HalfFloatType, format: T3.RGBAFormat, depthBuffer: depth }));
      if (depth) target.depthTexture = new T3.DepthTexture(1, 1, T3.UnsignedIntType);
      targets.push(target);
      return target;
    };
    const opaque = make(), waterColor = make(), waterDepth = make(), hdr = make(false);
    const waterScene = new T3.Scene(), waterCopy = water.clone(true);
    owned.push(() => waterScene.clear());
    waterScene.add(waterCopy);
    scene.traverse((o) => {
      if (o.isLight) waterScene.add(o.clone());
    });
    const depthMaterial = own(new T3.MeshDepthMaterial({ side: T3.DoubleSide }));
    depthMaterial.colorWrite = false;
    const fullScene = new T3.Scene(), fullCamera = new T3.Camera(), geometry = own(new T3.PlaneGeometry(2, 2));
    owned.push(() => fullScene.clear());
    const lut = buildLut(skyProfile(frame), 32, 64);
    const skyMap = own(new T3.DataTexture(lut.values, lut.width, lut.rows, T3.RedFormat, T3.FloatType));
    skyMap.minFilter = skyMap.magFilter = T3.LinearFilter;
    skyMap.needsUpdate = true;
    const n = 32, atlasData = new Float32Array(n * n * n * 2);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const p = [-80 + 160 * (x + 0.5) / n, 8 + 24 * (y + 0.5) / n, -80 + 160 * (z + 0.5) / n], i = ((z * n + y) * n + x) * 2;
      atlasData[i] = density(p, 1);
      let depth = 0;
      for (let s = 0; s < 16; s++) depth += density([p[0] - 0.4 * s * 3, p[1] + 0.8 * s * 3, p[2] - 0.4472135955 * s * 3], 1) * 3;
      atlasData[i + 1] = Math.exp(-depth);
    }
    const atlas = own(new T3.Data3DTexture(atlasData, n, n, n));
    atlas.format = T3.RGFormat;
    atlas.type = T3.FloatType;
    atlas.minFilter = atlas.magFilter = T3.LinearFilter;
    atlas.needsUpdate = true;
    const uniforms = {
      opaqueColor: { value: opaque.texture },
      opaqueDepth: { value: opaque.depthTexture },
      waterColor: { value: waterColor.texture },
      waterDepth: { value: waterDepth.depthTexture },
      cloudAtlas: { value: atlas },
      skyLut: { value: skyMap },
      inverseProjection: { value: camera.projectionMatrixInverse },
      cameraWorld: { value: camera.matrixWorld },
      originOffset: { value: new T3.Vector3(...frame.originMeters) },
      sunDirection: { value: new T3.Vector3(-0.4, 0.8, -0.4472135955) },
      radiusMeters: { value: frame.bodyRadiusMeters },
      skyHeight: { value: 6e4 },
      skyScaleHeight: { value: 8e3 },
      rayleighPerM: { value: 1e-5 },
      miePerM: { value: frame.weatherExtinctionPerM },
      cloudCoverage: { value: frame.authoredCloudCoverage },
      fogPerM: { value: frame.status === "Known" ? 0.025 : 0 },
      lightning: { value: 0 },
      farLimit: { value: 5e5 },
      waterOpacity: { value: 0.56 },
      steps: { value: 64 },
      skyMode: { value: 0 },
      defect: { value: 0 }
    };
    const rainCoverage = { value: frame.authoredCloudCoverage };
    const material = own(new T3.ShaderMaterial({ glslVersion: T3.GLSL3, vertexShader: fullscreen_vert_default, fragmentShader: volume_frag_default, uniforms, depthTest: false, depthWrite: false, toneMapped: false }));
    const output2 = own(new T3.ShaderMaterial({ glslVersion: T3.GLSL3, vertexShader: fullscreen_vert_default, fragmentShader: output_frag_default, uniforms: { colorBuffer: { value: hdr.texture } }, depthTest: false, depthWrite: false, toneMapped: false }));
    const quad = new T3.Mesh(geometry, material);
    quad.frustumCulled = false;
    fullScene.add(quad);
    const onLost = (e) => {
      e.preventDefault();
      lost = true;
      uploaded = false;
      try {
        timer.dispose();
      } finally {
        history.contextLost();
      }
    };
    const onRestored = () => {
      const nextTimer = createDiagnosticTimer(context && "beginQuery" in context ? context : null);
      timer = nextTimer;
      epoch++;
      uploaded = false;
      atlas.needsUpdate = true;
      skyMap.needsUpdate = true;
      history.contextLost();
      lost = false;
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);
    owned.push(() => renderer.domElement.removeEventListener("webglcontextlost", onLost));
    renderer.domElement.addEventListener("webglcontextrestored", onRestored);
    owned.push(() => renderer.domElement.removeEventListener("webglcontextrestored", onRestored));
    return {
      setFrame(input) {
        active2();
        const next = validateFrame(input);
        if (next.atlasEpoch !== frame.atlasEpoch) throw Error("STALE_ATLAS");
        if (next.bodyId !== frame.bodyId || next.bodyRadiusMeters !== frame.bodyRadiusMeters || next.opticsDigest !== frame.opticsDigest || JSON.stringify(next.bodyNormal) !== JSON.stringify(frame.bodyNormal)) throw Error("REBUILD_OPTICS_REQUIRED");
        if (skyProfile(next).sigma !== skyProfile(frame).sigma) {
          skyMap.image.data = buildLut(skyProfile(next), 32, 64).values;
          skyMap.needsUpdate = true;
          uploaded = false;
        }
        frame = next;
      },
      setMode(sky, wrong = 0) {
        active2();
        if (![0, 1, 2, 3].includes(sky) || ![0, 1, 2, 3].includes(wrong)) throw Error("MODE");
        mode = sky;
        defect = wrong;
      },
      lightning(id2) {
        active2();
        if (id2 !== null && (typeof id2 !== "string" || !id2)) throw Error("LIGHTNING");
        lightningId = id2;
      },
      resize(w, h) {
        active2();
        if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0) throw Error("VOLUME_SIZE");
        for (const target of targets) target.setSize(w, h);
        epoch++;
      },
      render(takram, overlay) {
        active2();
        if (lost) return { status: "CONTEXT_LOST" };
        camera.updateMatrixWorld();
        const binding = frame.binding;
        const state = history.set({
          weather: frame.weatherSnapshotId,
          profile: binding.profile?.digest ?? "bound",
          macro: binding.macroGeography?.digest ?? "NONE",
          model: binding.model?.digest ?? "bound",
          optics: frame.opticsDigest,
          source: frame.sourceRevision,
          atlas: frame.atlasEpoch,
          epoch,
          origin: frame.originMeters,
          height: camera.position.y + frame.originMeters[1],
          lightning: lightningId
        });
        history.acceptAtlas(frame.atlasEpoch);
        const borrowed = createDepthCameraPort(camera, opaque.depthTexture, epoch, { weatherSnapshotId: frame.weatherSnapshotId, ...frame.binding });
        if (borrowed.epoch !== epoch) throw Error("BORROWED_EPOCH");
        const target = renderer.getRenderTarget(), clear = renderer.getClearColor(new T3.Color()), alpha = renderer.getClearAlpha(), oldBackground = scene.background, autoClear = renderer.autoClear, waterVisible = water.visible;
        try {
          if (!uploaded) {
            timer.measure("atlas-and-lut-upload", () => {
              renderer.initTexture(atlas);
              renderer.initTexture(skyMap);
            });
            uploaded = true;
          }
          renderer.setClearColor(0, 0);
          water.visible = false;
          scene.background = null;
          timer.measure("opaque-hdr", () => {
            renderer.setRenderTarget(opaque);
            renderer.clear();
            renderer.render(scene, camera);
          });
          uniforms.opaqueColor.value = takram ? timer.measure("takram-cloud-aerial", takram) : opaque.texture;
          water.getWorldPosition(waterCopy.position);
          water.getWorldQuaternion(waterCopy.quaternion);
          water.getWorldScale(waterCopy.scale);
          waterCopy.updateMatrixWorld();
          timer.measure("water-color", () => {
            renderer.setRenderTarget(waterColor);
            renderer.clear();
            renderer.render(waterScene, camera);
          });
          timer.measure("water-depth", () => {
            waterScene.overrideMaterial = depthMaterial;
            renderer.setRenderTarget(waterDepth);
            renderer.clear();
            renderer.render(waterScene, camera);
            waterScene.overrideMaterial = null;
          });
          uniforms.originOffset.value.set(...frame.originMeters);
          uniforms.lightning.value = frame.status === "Known" && lightningId !== null ? 2 : 0;
          uniforms.skyMode.value = takram ? 2 : mode;
          uniforms.cloudCoverage.value = takram || mode === 3 || frame.status === "NoAtmosphere" ? 0 : frame.authoredCloudCoverage;
          rainCoverage.value = frame.status === "NoAtmosphere" ? 0 : frame.authoredCloudCoverage;
          uniforms.fogPerM.value = mode === 3 || frame.status === "NoAtmosphere" ? 0 : 0.025;
          uniforms.miePerM.value = frame.weatherExtinctionPerM;
          uniforms.rayleighPerM.value = frame.status === "NoAtmosphere" ? 0 : 1e-5;
          uniforms.steps.value = mode === 3 ? 16 : 64;
          uniforms.defect.value = defect;
          timer.measure("volumes-water-composite", () => {
            quad.material = material;
            renderer.setRenderTarget(hdr);
            renderer.clear();
            renderer.render(fullScene, fullCamera);
          });
          if (overlay) timer.measure("depth-aware-rain", () => {
            renderer.autoClear = false;
            renderer.render(overlay, camera);
            renderer.autoClear = true;
          });
          timer.measure("tone-map-output", () => {
            quad.material = output2;
            renderer.setRenderTarget(target);
            renderer.render(fullScene, fullCamera);
          });
          timer.poll();
          return { status: "RENDERED", history: state, epoch, weatherSnapshotId: frame.weatherSnapshotId, stormIds: frame.stormIds };
        } finally {
          water.visible = waterVisible;
          scene.background = oldBackground;
          renderer.autoClear = autoClear;
          renderer.setClearColor(clear, alpha);
          renderer.setRenderTarget(target);
          waterScene.overrideMaterial = null;
        }
      },
      rainUniforms: { uOpaqueDepth: { value: opaque.depthTexture }, uWaterDepth: { value: waterDepth.depthTexture }, uAtlas: { value: atlas }, uInvProjection: { value: camera.projectionMatrixInverse }, uCameraWorld: { value: camera.matrixWorld }, uViewport: { value: new T3.Vector2() }, uCloudCoverage: rainCoverage, uFog: uniforms.fogPerM, uOrigin: uniforms.originOffset },
      diagnostics() {
        return { ownedTargets: disposed ? 0 : targets.length, disposed, lost, epoch, lightningId, atlasUploadPending: !uploaded, actualAdapter: null, gpuTimer: timer.read(), borrowedDepth: "NOT_DISPOSED", historyResources: history.resources, historyResourcesKind: "LOGICAL_METADATA_ONLY_NO_TEMPORAL_BUFFERS", temporalAccumulation: "DISABLED_REACTIVE_VALIDATION_ONLY" };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        disposeOwned(owned);
      }
    };
  } catch (error) {
    disposed = true;
    try {
      disposeOwned(owned);
    } catch (cleanup) {
      throw new AggregateError([error, cleanup], "VOLUME_INIT_AND_CLEANUP_FAILED", { cause: error });
    }
    throw error;
  }
}
export {
  createVolumePort
};
