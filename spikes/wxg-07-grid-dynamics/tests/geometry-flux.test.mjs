import assert from 'node:assert/strict';
import test from 'node:test';
import { FACES, direction, frame, toBody, toTangent } from '../inputs/wxg/dist/src/geometry.js';
import { buildGrid } from '../dist/grid.js';

const radius = 17;
const wind = 23;
const axis = { x: 0.31, y: -0.47, z: 0.83 };
const areaTolerance = 2e-11;
const fluxTolerance = 5e-12;

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (v) => Math.hypot(v.x, v.y, v.z);
const unit = (v) => scale(v, 1 / norm(v));
const assertVectorClose = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual.x - expected.x) <= tolerance, `${message}: x ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= tolerance, `${message}: y ${actual.y} != ${expected.y}`);
  assert.ok(Math.abs(actual.z - expected.z) <= tolerance, `${message}: z ${actual.z} != ${expected.z}`);
};

function sphericalTriangleArea(a, b, c) {
  return 2 * Math.atan2(Math.abs(dot(a, cross(b, c))), 1 + dot(a, b) + dot(b, c) + dot(c, a));
}

function sphericalQuadArea(vertices) {
  return sphericalTriangleArea(vertices[0], vertices[1], vertices[2])
    + sphericalTriangleArea(vertices[0], vertices[2], vertices[3]);
}

function assertFrame(basis, normal, message) {
  assert.ok(Math.abs(norm(basis.normal) - 1) < 1e-12, `${message}: normal is not unit length`);
  assert.ok(Math.abs(norm(basis.u) - 1) < 1e-12, `${message}: u is not unit length`);
  assert.ok(Math.abs(norm(basis.v) - 1) < 1e-12, `${message}: v is not unit length`);
  assert.ok(Math.abs(dot(basis.normal, basis.u)) < 1e-12, `${message}: normal dot u`);
  assert.ok(Math.abs(dot(basis.normal, basis.v)) < 1e-12, `${message}: normal dot v`);
  assert.ok(Math.abs(dot(basis.u, basis.v)) < 1e-12, `${message}: u dot v`);
  assertVectorClose(basis.normal, normal, 1e-12, `${message}: normal`);
  assertVectorClose(cross(basis.u, basis.v), basis.normal, 1e-12, `${message}: handedness`);
}

function chartGroups(points) {
  const groups = new Map();
  for (const point of points) {
    const normal = direction(point.face, point.u, point.v);
    const key = [normal.x, normal.y, normal.z].map((value) => value.toFixed(12)).join(',');
    if (!groups.has(key)) groups.set(key, { normal, charts: [] });
    groups.get(key).charts.push({ face: point.face, basis: frame(point.face, point.u, point.v) });
  }
  return [...groups.values()];
}

function tangentProbe(normal) {
  const reference = Math.abs(normal.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  return unit(cross(normal, reference));
}

function checkChartTransitions(groups, expectedGroupCount, chartsPerGroup, label) {
  assert.equal(groups.length, expectedGroupCount, `${label}: unique directions`);
  for (const { normal, charts } of groups) {
    assert.equal(charts.length, chartsPerGroup, `${label}: incident face charts`);
    const bodyVector = tangentProbe(normal);
    assert.ok(Math.abs(dot(bodyVector, normal)) < 1e-12, `${label}: probe is tangent`);
    for (const from of charts) {
      assertFrame(from.basis, normal, `${label} ${from.face}`);
      const tangent = toTangent(from.basis, bodyVector);
      assertVectorClose(toBody(from.basis, tangent), bodyVector, 1e-12, `${label}: source roundtrip`);
      for (const to of charts) {
        const transferred = toBody(to.basis, toTangent(to.basis, toBody(from.basis, tangent)));
        assertVectorClose(transferred, bodyVector, 2e-12, `${label}: ${from.face} to ${to.face}`);
      }
    }
  }
}

function isCubeCorner(point) {
  const component = 1 / Math.sqrt(3);
  return Math.abs(Math.abs(point.x) - component) < 1e-12
    && Math.abs(Math.abs(point.y) - component) < 1e-12
    && Math.abs(Math.abs(point.z) - component) < 1e-12;
}

function cornerKey(point) {
  return `${Math.sign(point.x)}${Math.sign(point.y)}${Math.sign(point.z)}`;
}

function numericalOutwardFlux(edge, grid, segments = 128) {
  const a = edge.start;
  const b = edge.end;
  const angle = Math.atan2(norm(cross(a, b)), dot(a, b));
  const tangentAtStart = unit(add(b, scale(a, -dot(a, b))));
  const integrate = (index) => {
    const s = angle * index / segments;
    const point = add(scale(a, Math.cos(s)), scale(tangentAtStart, Math.sin(s)));
    const tangent = add(scale(a, -Math.sin(s)), scale(tangentAtStart, Math.cos(s)));
    const outwardConormal = cross(tangent, point);
    return dot(cross(grid.axis, point), outwardConormal) * grid.wind;
  };
  let sum = integrate(0) + integrate(segments);
  for (let index = 1; index < segments; index++) sum += (index % 2 ? 4 : 2) * integrate(index);
  return grid.radius * angle * sum / (3 * segments);
}

function assertFluxOracle(edge, grid, label) {
  const numeric = numericalOutwardFlux(edge, grid);
  const scaleForTolerance = Math.max(1, Math.abs(edge.flux), grid.radius * grid.wind * Math.atan2(norm(cross(edge.start, edge.end)), dot(edge.start, edge.end)));
  assert.ok(Math.abs(numeric - edge.flux) <= fluxTolerance * scaleForTolerance,
    `${label}: numerical ${numeric} != stored ${edge.flux}`);
}

test('tangent charts transfer body vectors across all 12 face seams and 8 cube corners', () => {
  const seams = [];
  const corners = [];
  for (const face of FACES) {
    seams.push({ face, u: -1, v: 0 }, { face, u: 1, v: 0 }, { face, u: 0, v: -1 }, { face, u: 0, v: 1 });
    for (const u of [-1, 1]) for (const v of [-1, 1]) corners.push({ face, u, v });
  }
  checkChartTransitions(chartGroups(seams), 12, 2, 'face seam');
  checkChartTransitions(chartGroups(corners), 8, 3, 'cube corner');
});

for (const n of [32, 48, 64]) {
  test(`${n}² cube-sphere geometry matches independent area, frame, and flux oracles`, () => {
    const grid = buildGrid(n, radius, wind, axis);
    assert.equal(grid.cells.length, 6 * n * n);
    assert.equal(grid.edges.length, 12 * n * n);

    let summedArea = 0;
    for (const [cellIndex, cell] of grid.cells.entries()) {
      const oracleArea = sphericalQuadArea(cell.vertices) * radius * radius;
      assert.ok(Math.abs(cell.area - oracleArea) <= areaTolerance * oracleArea,
        `cell ${cellIndex} area ${cell.area} != spherical-triangle oracle ${oracleArea}`);
      assertFrame(cell.basis, cell.center, `cell ${cellIndex}`);
      summedArea += cell.area;
    }
    assert.ok(Math.abs(summedArea - 4 * Math.PI * radius * radius) <= 2e-12 * 4 * Math.PI * radius * radius,
      `sphere area ${summedArea} != ${4 * Math.PI * radius * radius}`);

    for (const [edgeIndex, edge] of grid.edges.entries()) {
      assert.ok(edge.b >= 0, `edge ${edgeIndex} has no paired cell`);
      const owner = grid.cells[edge.a];
      const neighbor = grid.cells[edge.b];
      const ownerSide = owner.edges.indexOf(edgeIndex);
      const neighborSide = neighbor.edges.indexOf(edgeIndex);
      assert.notEqual(ownerSide, -1, `edge ${edgeIndex} missing from owner`);
      assert.notEqual(neighborSide, -1, `edge ${edgeIndex} missing from neighbor`);
      assert.equal(owner.signs[ownerSide], 1, `edge ${edgeIndex} owner orientation`);
      assert.equal(neighbor.signs[neighborSide], -1, `edge ${edgeIndex} neighbor orientation`);
      assert.equal(owner.face === neighbor.face, !edge.seam, `edge ${edgeIndex} seam flag`);
    }

    for (const [cellIndex, cell] of grid.cells.entries()) {
      let netOutflow = 0;
      let absoluteFlux = 0;
      for (let side = 0; side < cell.edges.length; side++) {
        const outwardFlux = cell.signs[side] * grid.edges[cell.edges[side]].flux;
        netOutflow += outwardFlux;
        absoluteFlux += Math.abs(outwardFlux);
      }
      assert.ok(Math.abs(netOutflow) <= 1e-12 * Math.max(1, absoluteFlux),
        `cell ${cellIndex} divergence ${netOutflow} from ${absoluteFlux} edge flux`);
    }

    const seamRepresentatives = new Map();
    const cornerRepresentatives = new Map();
    for (const edge of grid.edges) {
      if (edge.seam && !isCubeCorner(edge.start) && !isCubeCorner(edge.end)) {
        const faces = [grid.cells[edge.a].face, grid.cells[edge.b].face].sort().join('/');
        if (!seamRepresentatives.has(faces)) seamRepresentatives.set(faces, edge);
      }
      for (const point of [edge.start, edge.end]) {
        if (isCubeCorner(point) && !cornerRepresentatives.has(cornerKey(point))) cornerRepresentatives.set(cornerKey(point), edge);
      }
    }
    assert.equal(seamRepresentatives.size, 12, 'one non-corner seam edge per face pair');
    assert.equal(cornerRepresentatives.size, 8, 'one edge incident to each cube corner');
    for (const [faces, edge] of seamRepresentatives) assertFluxOracle(edge, grid, `${n} seam ${faces}`);
    for (const [corner, edge] of cornerRepresentatives) assertFluxOracle(edge, grid, `${n} corner ${corner}`);
  });
}
