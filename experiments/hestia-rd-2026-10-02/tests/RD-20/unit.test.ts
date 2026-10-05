import { expect, it } from 'vitest';
import { buildPatchRecipe, buildPlantRecipe, validatePatchRecipe } from '../../src/experiments/foliage-shapes';
import './projection.test';

it('FOL01 three distinct connected wood silhouettes and a removed bridge isolate a real group', () => {
  const shapes = ['young', 'umbrella', 'buttress'] as const;
  const signatures = shapes.map((shape) => {
    const plant = buildPlantRecipe(shape, 23);
    const cells = new Set(plant.wood.map((c) => c.cell.join(','))); const seen = new Set<string>(); const stack = [plant.wood[0].cell];
    while (stack.length) { const p = stack.pop()!; const key = p.join(','); if (seen.has(key)) continue; seen.add(key);
      for (const d of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const n = p.map((v, i) => v + d[i]) as [number,number,number]; if (cells.has(n.join(',')) && !seen.has(n.join(','))) stack.push(n);
      }
    }
    expect(seen.size).toBe(cells.size); expect(plant.decor.length).toBeGreaterThanOrEqual(4);
    const withoutBridge = plant.wood.filter((c) => c.cell.join(',') !== '0,1,0');
    expect(withoutBridge.some((c) => c.cell.join(',') === '0,0,0')).toBe(true);
    expect(withoutBridge.some((c) => c.cell.join(',') === '0,2,0')).toBe(true);
    const isolated = new Set(withoutBridge.map((c) => c.cell.join(',')));
    for (const neighbor of ['1,0,0','-1,0,0','0,1,0','0,-1,0','0,0,1','0,0,-1']) expect(isolated.has(neighbor)).toBe(false);
    return JSON.stringify(plant.wood.map((c) => c.cell));
  });
  expect(new Set(signatures).size).toBe(3);
});
it('FOL02 root arches contain known empty cells, rather than an AABB substitute', () => {
  const plant = buildPlantRecipe('buttress', 23); const occupied = new Set(plant.wood.map((c) => c.cell.join(',')));
  expect(plant.emptyArchCells.length).toBeGreaterThan(0);
  for (const empty of plant.emptyArchCells) expect(occupied.has(empty.join(','))).toBe(false);
});
it('FOL03 habitat water/clearing/slope filters and reverse candidate order preserve seeded patch', () => {
  const candidates = [
    { id: 'land', positionMeters: [4,0,0], slope01: 0.1, water: false, clearing: false },
    { id: 'water', positionMeters: [0,0,0], slope01: 0, water: true, clearing: false },
    { id: 'clearing', positionMeters: [2,0,0], slope01: 0, water: false, clearing: true },
    { id: 'steep', positionMeters: [6,0,0], slope01: 0.9, water: false, clearing: false },
  ];
  const first = buildPatchRecipe({ seed: 23, density01: 1, maxSlope01: 0.4, candidates });
  expect(first).toEqual(buildPatchRecipe({ seed: 23, density01: 1, maxSlope01: 0.4, candidates: [...candidates].reverse() }));
  expect(first.plants.map((p) => p.id)).toEqual(['plant:land']);
  expect(first.undergrowth.map((p) => p.type).sort()).toEqual(['accent', 'reed']);
  expect(() => buildPatchRecipe({ seed: 23, density01: 2, maxSlope01: 0.4, candidates })).toThrow();
});
it('FOL04 support/source identities survive ordering and decor contributes no wood mass', () => {
  for (const shape of ['young','umbrella','buttress'] as const) {
    const plant = buildPlantRecipe(shape, 23); const source = new Set(plant.wood.map((c) => c.id));
    expect(plant.decor.every((d) => d.massKg === 0 && source.has(d.supportId))).toBe(true);
    expect(new Set(plant.decor.map((d) => d.id)).size).toBe(plant.decor.length);
  }
  const patch = buildPatchRecipe({ seed: 0, density01: 0, maxSlope01: 0.5, candidates: [] });
  expect(validatePatchRecipe(JSON.parse(JSON.stringify(patch)))).toEqual(patch);
  expect(() => validatePatchRecipe({ ...patch, schema: 'old' })).toThrow();
});
