import { analyticalVolume, bindSource, setCell } from './fixtures.mjs';
export function makeCases() {
    const face = analyticalVolume(.125, [4, 1, 1], 'r12-face');
    setCell(face, [0, 0, 0], 1);
    setCell(face, [1, 0, 0], 2);
    const tie = analyticalVolume(.125, [3, 3, 1], 'r12-tie');
    setCell(tie, [1, 0, 0], 1);
    setCell(tie, [0, 1, 0], 2);
    setCell(tie, [1, 1, 0], 3);
    const unknown = analyticalVolume(.125, [4, 1, 1], 'r12-unknown');
    unknown.coverage = 'partial';
    setCell(unknown, [0, 0, 0], -1);
    setCell(unknown, [1, 0, 0], 2);
    bindSource(unknown);
    return [
        { id: 'FACE_POSITIVE', v: face, points: [[1 - 2 ** -26, .5, .5], [1 + 2 ** -26, .5, .5]], direction: [1, 0, 0], steps: 256, kinds: ['Hit', 'Hit'], cells: [[0, 0, 0], [1, 0, 0]], materials: [1, 2], normals: [[0, 0, 0], [0, 0, 0]] },
        { id: 'FACE_NEGATIVE', v: face, points: [[1 - 2 ** -26, .5, .5], [1 + 2 ** -26, .5, .5]], direction: [-1, 0, 0], steps: 256, kinds: ['Hit', 'Hit'], cells: [[0, 0, 0], [1, 0, 0]], materials: [1, 2], normals: [[0, 0, 0], [0, 0, 0]] },
        { id: 'NEAR_TIE_NORMAL', v: tie, points: [[.5, .5 - 2 ** -27, .5], [.5, .5 + 2 ** -27, .5]], direction: [Math.SQRT1_2, Math.SQRT1_2, 0], steps: 256, kinds: ['Hit', 'Hit'], cells: [[1, 0, 0], [0, 1, 0]], materials: [1, 2], normals: [[-1, 0, 0], [0, -1, 0]] },
        { id: 'UNKNOWN_HIT', v: unknown, points: [[1 - 2 ** -26, .5, .5], [1 + 2 ** -26, .5, .5]], direction: [1, 0, 0], steps: 257, kinds: ['Unknown', 'Hit'], cells: [[0, 0, 0], [1, 0, 0]], materials: [null, 2], normals: [[0, 0, 0], [0, 0, 0]] },
        { id: 'ZERO_BUDGET_IDENTITY', v: face, points: [[1 - 2 ** -26, .5, .5], [1 + 2 ** -26, .5, .5]], direction: [1, 0, 0], steps: 0, kinds: ['BudgetExceeded', 'BudgetExceeded'], cells: [[0, 0, 0], [1, 0, 0]], materials: [null, null], normals: [[0, 0, 0], [0, 0, 0]] }
    ];
}
export function originalPair(c) {
    return c.points.map((point, i) => ({ id: 'R12_' + c.id + '_' + i,
        origin: point.map((q, a) => c.v.origin[a] + q * c.v.cellMeters),
        direction: [...c.direction], maxDistance: 8, maxSteps: c.steps }));
}
