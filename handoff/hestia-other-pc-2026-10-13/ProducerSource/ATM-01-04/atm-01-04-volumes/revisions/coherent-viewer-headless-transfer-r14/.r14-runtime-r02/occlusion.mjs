// src/occlusion.ts
function firstSolid(origin, direction, boxes, limit) {
  if (!Array.isArray(origin) || origin.length !== 3 || ![...origin].every(Number.isFinite) || !Array.isArray(direction) || direction.length !== 3 || ![...direction].every(Number.isFinite) || Math.abs(Math.hypot(...direction) - 1) > 1e-8 || !Number.isFinite(limit) || limit <= 0) throw Error("OCCLUSION_INPUT");
  let closest = Infinity;
  for (const box of boxes) {
    if (typeof box.id !== "string" || !box.id || !Array.isArray(box.min) || box.min.length !== 3 || ![...box.min].every(Number.isFinite) || !Array.isArray(box.max) || box.max.length !== 3 || ![...box.max].every(Number.isFinite) || box.min.some((v, i) => v >= box.max[i])) throw Error("SOLID_BOX");
    let a = 0, b = limit;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(direction[i]) < 1e-12) {
        if (origin[i] < box.min[i] || origin[i] > box.max[i]) {
          b = -1;
          break;
        }
        continue;
      }
      const x = (box.min[i] - origin[i]) / direction[i], y = (box.max[i] - origin[i]) / direction[i];
      a = Math.max(a, Math.min(x, y));
      b = Math.min(b, Math.max(x, y));
    }
    if (b >= a && a < closest) closest = a;
  }
  return closest === Infinity ? null : closest;
}
export {
  firstSolid
};
