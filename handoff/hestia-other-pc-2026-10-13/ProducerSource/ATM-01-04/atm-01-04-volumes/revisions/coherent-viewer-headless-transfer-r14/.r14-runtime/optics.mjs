// src/optics.ts
var finite = (v, min = 0, max = Infinity) => {
  if (!Number.isFinite(v) || v < min || v > max) throw Error("OPTICAL_RANGE");
  return v;
};
var vector = (v) => {
  if (!Array.isArray(v) || v.length !== 3 || ![...v].every(Number.isFinite)) throw Error("VECTOR");
  return v;
};
function integrate(sigma, length, steps, source) {
  finite(length);
  finite(steps, 1, 1024);
  if (!Number.isInteger(steps)) throw Error("STEPS");
  vector(source);
  source.forEach((v) => finite(v));
  let T = 1;
  const L = [0, 0, 0], ds = length / steps;
  for (let i = 0; i < steps; i++) {
    const extinction = finite(sigma((i + 0.5) * ds)), segmentT = Math.exp(-extinction * ds);
    for (let c = 0; c < 3; c++) L[c] += T * source[c] * -Math.expm1(-extinction * ds);
    T *= segmentT;
  }
  return { T, L };
}
function composeWater(front, back, background, water, alpha) {
  finite(alpha, 0, 1);
  vector(background);
  vector(water);
  for (const segment of [front, back]) {
    finite(segment.T, 0, 1);
    vector(segment.L).forEach((v) => finite(v));
  }
  return background.map((c, i) => front.L[i] + front.T * (alpha * water[i] + (1 - alpha) * (back.L[i] + back.T * c)));
}
function shellInterval(origin, direction, radius, outer) {
  vector(origin);
  vector(direction);
  finite(radius, Number.MIN_VALUE);
  finite(outer, radius);
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
  vector(p);
  finite(coverage, 0, 1);
  const edge = Math.max(0, 1 - Math.abs((p[1] - 20) / 12)) * Math.max(0, 1 - Math.abs(p[0] / 80)) * Math.max(0, 1 - Math.abs(p[2] / 80));
  const lobes = 0.65 + 0.35 * Math.sin(p[0] * 0.13 + p[1] * 0.21) * Math.cos(p[2] * 0.11 - p[1] * 0.17);
  return coverage * edge * lobes * 0.11;
}
function buildLut(profile, rows = 16, width = 32) {
  finite(profile.radius, 1);
  finite(profile.height, 1);
  finite(profile.scaleHeight, 1);
  finite(profile.sigma);
  finite(rows, 2, 128);
  finite(width, 2, 256);
  if (!Number.isInteger(rows) || !Number.isInteger(width)) throw Error("LUT_SIZE");
  const values = new Float32Array(rows * width);
  for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) {
    const altitude = y / (rows - 1) * profile.height, mu = x / (width - 1), o = [0, profile.radius + altitude, 0], d = [Math.sqrt(1 - mu * mu), mu, 0];
    const segment = shellInterval(o, d, profile.radius, profile.radius + profile.height);
    values[y * width + x] = segment ? integrate((s) => profile.sigma * Math.exp(-(Math.hypot(d[0] * s, o[1] + d[1] * s) - profile.radius) / profile.scaleHeight), segment[1], 128, [0, 0, 0]).T : 1;
  }
  return { ...profile, width, rows, values };
}
function sampleLut(lut, altitude, mu) {
  finite(altitude, 0, lut.height);
  finite(mu, 0, 1);
  const x = mu * (lut.width - 1), y = altitude / lut.height * (lut.rows - 1), ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const at = (a, b) => lut.values[Math.min(b, lut.rows - 1) * lut.width + Math.min(a, lut.width - 1)];
  return (at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx) * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
}
function createHistory() {
  let previous = null, disposed = false, resources = 2;
  return {
    get resources() {
      return resources;
    },
    set(frame) {
      if (disposed) throw Error("DISPOSED");
      vector(frame.origin);
      finite(frame.height, -1e3);
      for (const id of ["weather", "profile", "macro", "model", "optics"]) if (typeof frame[id] !== "string" || !frame[id]) throw Error("HISTORY_BINDING");
      for (const id of ["source", "atlas", "epoch"]) if (!Number.isSafeInteger(frame[id]) || frame[id] < 0) throw Error("HISTORY_EPOCH");
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
function rebaseFrame(frame, shift) {
  vector(shift);
  return validateFrame({ ...frame, originMeters: frame.originMeters.map((v, i) => v + shift[i]) });
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
  finite(frame.bodyRadiusMeters, 1);
  vector(frame.bodyNormal);
  if (Math.abs(Math.hypot(...frame.bodyNormal) - 1) > 1e-8) throw Error("BODY_NORMAL");
  vector(frame.originMeters);
  vector(frame.windMps);
  finite(frame.weatherExtinctionPerM);
  finite(frame.authoredCloudCoverage, 0, 1);
  finite(frame.rain01, 0, 1);
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
export {
  buildLut,
  composeWater,
  createHistory,
  density,
  integrate,
  rebaseFrame,
  sampleLut,
  shellInterval,
  skyProfile,
  validateFrame
};
