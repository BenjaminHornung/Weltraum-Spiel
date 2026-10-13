export const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const add = (a, b) => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (v, factor) => vec3(v.x * factor, v.y * factor, v.z * factor);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const magnitude = (v) => Math.hypot(v.x, v.y, v.z);
export const distance = (a, b) => magnitude(sub(a, b));
export const normalize = (v) => {
    const length = magnitude(v);
    return length <= 1e-9 ? vec3() : scale(v, 1 / length);
};
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const projectPointOnSegment = (point, start, end) => {
    const segment = sub(end, start);
    const lengthSq = dot(segment, segment);
    if (lengthSq <= 1e-9) {
        return start;
    }
    const t = clamp(dot(sub(point, start), segment) / lengthSq, 0, 1);
    return add(start, scale(segment, t));
};
export const roundVec = (v, decimals = 4) => {
    const factor = 10 ** decimals;
    return vec3(Math.round(v.x * factor) / factor, Math.round(v.y * factor) / factor, Math.round(v.z * factor) / factor);
};
