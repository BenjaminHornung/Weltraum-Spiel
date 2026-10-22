import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanetaryMacroSource,samplePlanetaryMacro,validatePlanetaryMacro} from '../dist/apps/weltraum-browser/src/world-generation/planetaryMacro.js';
import {pmdBody,pmdOtherBody,candidateProfile,createCandidateFrames} from './helpers.mjs';

import {transformPosition} from '../dist/apps/weltraum-browser/src/spatial/transforms.js';
import {
  FACES,
  add,
  cellAddress,
  cellArea,
  cellCenter,
  coordinates,
  cross,
  direction,
  dot,
  frame,
  scale,
  toBody,
  toTangent,
  unit
} from '../dist/.a0-runtime/benni-pc-pmd-normal-core-source-r01/src/geometry.js';

const FACE_NAMES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

test('generated PMD is globally identical across actual SurfaceFrames and cube seam representations',async()=>{
  const source=await createPlanetaryMacroSource(pmdBody,candidateProfile()),again=await createPlanetaryMacroSource(pmdBody,candidateProfile());
  assert.deepEqual(source,again);
  const a=createCandidateFrames(source,pmdBody,0,0,'pmd.frame.a'),b=createCandidateFrames(source,pmdBody,0.4,0.7,'pmd.frame.b');
  const point={x:source.radiusMeters+100,y:23,z:47};
  const localA=transformPosition(point,a.bodyFixed,a.surface),localB=transformPosition(point,b.bodyFixed,b.surface);
  const direct=samplePlanetaryMacro(source,point);
  for(const [frames,local] of [[a,localA],[b,localB]]) {
    const got=samplePlanetaryMacro(source,transformPosition(local,frames.surface,frames.bodyFixed));
    assert.ok(Math.abs(got.elevationMeters-direct.elevationMeters)<1e-6);
  }
  assert.notEqual(a.surface.frameId,b.surface.frameId);
  assert.deepEqual(samplePlanetaryMacro(source,direction('px',1,0)),samplePlanetaryMacro(source,direction('nz',-1,0)));
  assert.deepEqual(samplePlanetaryMacro(source,point),direct);
  assert.equal(source.bodyFixed.northAxis,'+Z');assert.equal(source.minimumElevationMeters,-2500);
  assert.equal(source.maximumElevationMeters,2500);
  assert.throws(()=>samplePlanetaryMacro(source,{x:0,y:0,z:0}));assert.throws(()=>samplePlanetaryMacro(source,{x:NaN,y:1,z:0}));
  const other=await createPlanetaryMacroSource(pmdOtherBody,candidateProfile()),otherFrames=createCandidateFrames(other,pmdOtherBody);
  assert.equal(other.radiusMeters,pmdOtherBody.radiusMeters);assert.equal(other.bodyId,pmdOtherBody.bodyId);
  assert.notEqual(other.longSeed,source.longSeed);assert.equal(otherFrames.surface.definition.anchor.bodyId,other.bodyId);
  assert.equal((await validatePlanetaryMacro(other,pmdOtherBody,candidateProfile())).digest,other.digest);
  await assert.rejects(()=>validatePlanetaryMacro(other,pmdBody,candidateProfile()),/PMD_SOURCE_MISMATCH/);
  assert.throws(()=>createCandidateFrames(other,pmdBody),/pmd.frameBody/);
});
const AXES = {
  px: { n: { x: 1, y: 0, z: 0 }, u: { x: 0, y: 0, z: -1 }, v: { x: 0, y: 1, z: 0 } },
  nx: { n: { x: -1, y: 0, z: 0 }, u: { x: 0, y: 0, z: 1 }, v: { x: 0, y: 1, z: 0 } },
  py: { n: { x: 0, y: 1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: -1 } },
  ny: { n: { x: 0, y: -1, z: 0 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 0, z: 1 } },
  pz: { n: { x: 0, y: 0, z: 1 }, u: { x: 1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } },
  nz: { n: { x: 0, y: 0, z: -1 }, u: { x: -1, y: 0, z: 0 }, v: { x: 0, y: 1, z: 0 } }
};

const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const add3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const cross3 = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});
const normalized = (v) => {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
};
const close = (actual, expected, tolerance = 1e-12) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};
const vectorClose = (actual, expected, tolerance = 1e-12) => {
  close(actual.x, expected.x, tolerance);
  close(actual.y, expected.y, tolerance);
  close(actual.z, expected.z, tolerance);
};
const pointOnFace = (face, u, v) => {
  const axes = AXES[face];
  return normalized(add3(add3(axes.n, scale3(axes.u, u)), scale3(axes.v, v)));
};
const chartOnFace = (face, point) => {
  const axes = AXES[face];
  const denominator = dot3(point, axes.n);
  return { face, u: dot3(point, axes.u) / denominator, v: dot3(point, axes.v) / denominator };
};
const dominantFace = (point) => {
  const x = Math.abs(point.x);
  const y = Math.abs(point.y);
  const z = Math.abs(point.z);
  if (x >= y && x >= z) return point.x >= 0 ? 'px' : 'nx';
  if (y >= z) return point.y >= 0 ? 'py' : 'ny';
  return point.z >= 0 ? 'pz' : 'nz';
};
const independentFrame = (face, u, v) => {
  const normal = pointOnFace(face, u, v);
  const sourceU = AXES[face].u;
  const projectedU = add3(sourceU, scale3(normal, -dot3(sourceU, normal)));
  const tangentU = normalized(projectedU);
  return { normal, u: tangentU, v: cross3(normal, tangentU) };
};

test('face directions and inverse coordinates match an independent Cartesian face table', () => {
  assert.deepEqual(FACES, FACE_NAMES);
  assert.equal(Object.isFrozen(FACES), true);
  const samples = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const face of FACE_NAMES) {
    for (const [u, v] of samples) {
      const expected = pointOnFace(face, u, v);
      const actual = direction(face, u, v);
      vectorClose(actual, expected);
      const specified = coordinates(actual, face);
      assert.equal(specified.face, face);
      close(specified.u, u);
      close(specified.v, v);
      const automatic = coordinates(actual);
      assert.equal(automatic.face, dominantFace(expected));
      vectorClose(direction(automatic.face, automatic.u, automatic.v), expected);
    }
  }
});

test('all twelve seams agree in physical direction and reproject winds through each local frame', () => {
  const seams = [];
  for (let i = 0; i < FACE_NAMES.length; i += 1) {
    for (let j = i + 1; j < FACE_NAMES.length; j += 1) {
      const faceA = FACE_NAMES[i];
      const faceB = FACE_NAMES[j];
      if (dot3(AXES[faceA].n, AXES[faceB].n) !== 0) continue;
      const freeAxis = ['x', 'y', 'z'].find((axis) => AXES[faceA].n[axis] === 0 && AXES[faceB].n[axis] === 0);
      seams.push({ faceA, faceB, freeAxis });
    }
  }
  assert.equal(seams.length, 12);

  let rotatedComponentsObserved = false;
  for (const { faceA, faceB, freeAxis } of seams) {
    const alongSeam = { x: 0, y: 0, z: 0, [freeAxis]: 1 };
    for (const t of [-1, 0, 1]) {
      const raw = add3(add3(AXES[faceA].n, AXES[faceB].n), scale3(alongSeam, t));
      const physical = normalized(raw);
      for (const face of [faceA, faceB]) {
        const expected = chartOnFace(face, physical);
        const actual = coordinates(physical, face);
        close(actual.u, expected.u);
        close(actual.v, expected.v);
        vectorClose(direction(face, actual.u, actual.v), physical);
      }
      if (t !== 0) continue;
      const wind = alongSeam;
      const chartA = chartOnFace(faceA, physical);
      const chartB = chartOnFace(faceB, physical);
      const localFrameA = frame(faceA, chartA.u, chartA.v);
      const localFrameB = frame(faceB, chartB.u, chartB.v);
      const componentsA = toTangent(localFrameA, wind);
      const componentsB = toTangent(localFrameB, wind);
      vectorClose(toBody(localFrameA, componentsA), wind);
      vectorClose(toBody(localFrameB, componentsB), wind);
      if (Math.hypot(componentsA.u - componentsB.u, componentsA.v - componentsB.v) > 1e-9) {
        rotatedComponentsObserved = true;
      }
    }
  }
  assert.equal(rotatedComponentsObserved, true, 'seam tangent components must use each face frame');
});

test('all eight cube corners invert on each incident face with deterministic x/y/z tie priority', () => {
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const corner = normalized({ x: sx, y: sy, z: sz });
        const expectedDefault = dominantFace(corner);
        assert.equal(coordinates(corner).face, expectedDefault);
        for (const face of FACE_NAMES) {
          if (dot3(corner, AXES[face].n) <= 0) {
            assert.throws(() => coordinates(corner, face), /does not face/);
            continue;
          }
          const chart = coordinates(corner, face);
          close(Math.abs(chart.u), 1);
          close(Math.abs(chart.v), 1);
          vectorClose(direction(face, chart.u, chart.v), corner);
        }
      }
    }
  }
});

test('frames are right-handed and tangent/body conversion preserves physical vectors', () => {
  const samples = [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]];
  const bodyVector = { x: 0.4, y: -0.2, z: 0.7 };
  for (const face of FACE_NAMES) {
    for (const [u, v] of samples) {
      const actual = frame(face, u, v);
      const expected = independentFrame(face, u, v);
      vectorClose(actual.normal, expected.normal);
      vectorClose(actual.u, expected.u);
      vectorClose(actual.v, expected.v);
      close(dot3(actual.normal, actual.u), 0);
      close(dot3(actual.normal, actual.v), 0);
      close(dot3(actual.u, actual.v), 0);
      close(Math.hypot(actual.normal.x, actual.normal.y, actual.normal.z), 1);
      close(Math.hypot(actual.u.x, actual.u.y, actual.u.z), 1);
      close(Math.hypot(actual.v.x, actual.v.y, actual.v.z), 1);
      vectorClose(cross3(actual.u, actual.v), actual.normal);

      const local = { u: 0.37, v: -0.61 };
      const expectedBody = add3(scale3(expected.u, local.u), scale3(expected.v, local.v));
      vectorClose(toBody(actual, local), expectedBody);
      const expectedLocal = { u: dot3(expected.u, bodyVector), v: dot3(expected.v, bodyVector) };
      const actualLocal = toTangent(actual, bodyVector);
      close(actualLocal.u, expectedLocal.u);
      close(actualLocal.v, expectedLocal.v);
      vectorClose(toBody(actual, actualLocal), add3(scale3(expected.u, expectedLocal.u), scale3(expected.v, expectedLocal.v)));
    }
  }
});

test('cell addressing and centers use inclusive outer edges and the declared grid level', () => {
  for (let level = 0; level <= 6; level += 1) {
    const resolution = 2 ** level;
    const candidates = [...new Set([0, Math.floor(resolution / 2), resolution - 1])];
    for (const face of FACE_NAMES) {
      for (const x of candidates) {
        for (const y of candidates) {
          const center = cellCenter(face, level, x, y);
          const point = coordinates(center, face);
          close(point.u, -1 + (2 * x + 1) / resolution);
          close(point.v, -1 + (2 * y + 1) / resolution);
          assert.deepEqual(cellAddress(center, level), { face, level, x, y });
        }
      }
    }
  }

  for (const [u, v, expectedX, expectedY] of [
    [-1, 0, 0, 2], [1, 0, 3, 2], [0, -1, 2, 0], [0, 1, 2, 3]
  ]) {
    assert.deepEqual(cellAddress(direction('px', u, v), 2), { face: 'px', level: 2, x: expectedX, y: expectedY });
  }
  assert.deepEqual(cellAddress(direction('px', 1, 1), 0), { face: 'px', level: 0, x: 0, y: 0 });
});

test('exact solid-angle cell areas sum to a sphere and match the rectangle oracle', () => {
  const radius = 3.75;
  const primitive = (u, v) => Math.atan2(u * v, Math.sqrt(1 + u * u + v * v));
  for (let level = 0; level <= 6; level += 1) {
    const resolution = 2 ** level;
    let sum = 0;
    for (const face of FACE_NAMES) {
      for (let x = 0; x < resolution; x += 1) {
        for (let y = 0; y < resolution; y += 1) {
          sum += cellArea(face, level, x, y, radius);
        }
      }
    }
    close(sum / (4 * Math.PI * radius * radius), 1, 1e-12);
  }

  const level = 3;
  const x = 2;
  const y = 5;
  const resolution = 2 ** level;
  const u0 = -1 + (2 * x) / resolution;
  const u1 = -1 + (2 * (x + 1)) / resolution;
  const v0 = -1 + (2 * y) / resolution;
  const v1 = -1 + (2 * (y + 1)) / resolution;
  const expected = (primitive(u1, v1) - primitive(u0, v1) - primitive(u1, v0) + primitive(u0, v0)) * radius ** 2;
  close(cellArea('nz', level, x, y, radius), expected, 1e-14);
});

test('vector, face, coordinate, level, cell, and radius inputs reject malformed values', () => {
  assert.deepEqual(add({ x: 1, y: 2, z: 3 }, { x: -1, y: 1, z: 2 }), { x: 0, y: 3, z: 5 });
  assert.deepEqual(scale({ x: 1, y: -2, z: 3 }, 2), { x: 2, y: -4, z: 6 });
  assert.equal(dot({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }), 32);
  assert.deepEqual(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 });
  assert.deepEqual(unit({ x: 1e308, y: 1e308, z: 0 }), normalized({ x: 1, y: 1, z: 0 }));

  assert.throws(() => add({ x: NaN, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }));
  assert.throws(() => scale({ x: 0, y: 0, z: 0 }, Infinity));
  assert.throws(() => dot({ x: 0, y: 0, z: 0 }, { x: 0, y: Infinity, z: 0 }));
  assert.throws(() => cross({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: NaN }));
  assert.throws(() => unit({ x: 0, y: 0, z: 0 }));
  assert.throws(() => coordinates({ x: 0, y: 0, z: 0 }));
  assert.throws(() => coordinates({ x: NaN, y: 0, z: 0 }));
  assert.throws(() => direction('unknown', 0, 0));
  assert.throws(() => direction('px', 1.0001, 0));
  assert.throws(() => frame('px', 0, -1.0001));
  assert.throws(() => coordinates({ x: 1, y: 0, z: 0 }, 'nx'));
  assert.throws(() => coordinates({ x: 1, y: 2, z: 0 }, 'px'));

  for (const level of [-1, 1.5, 7, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
    assert.throws(() => cellAddress({ x: 1, y: 0, z: 0 }, level));
    assert.throws(() => cellCenter('px', level, 0, 0));
    assert.throws(() => cellArea('px', level, 0, 0, 1));
  }
  assert.throws(() => cellCenter('bad', 0, 0, 0));
  assert.throws(() => cellCenter('px', 2, -1, 0));
  assert.throws(() => cellCenter('px', 2, 4, 0));
  assert.throws(() => cellCenter('px', 2, 0.5, 0));
  assert.throws(() => cellArea('px', 2, 0, 4, 1));
  for (const radius of [0, -1, NaN, Infinity]) assert.throws(() => cellArea('px', 0, 0, 0, radius));
});
