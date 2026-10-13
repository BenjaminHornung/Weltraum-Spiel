const stableValue = (value) => {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
            if (key !== "planHash") {
                acc[key] = stableValue(value[key]);
            }
            return acc;
        }, {});
    }
    return typeof value === "number" ? Number(value.toFixed(5)) : value;
};
/**
 * Produces a recursively cloned, key-sorted, immutable JSON payload. Route
 * locks use this alongside planHashFor so a caller cannot retain mutable
 * vectors, target envelopes, validation data, or motion snapshots by
 * reference after a plan is accepted for execution.
 */
const canonicalCloneAndDeepFreezeValue = (value, seen) => {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new RangeError("Canonical locked payload values must be finite.");
        }
        return value;
    }
    if (value === undefined) {
        return undefined;
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) {
            throw new RangeError("Canonical locked payloads cannot contain cycles.");
        }
        seen.add(value);
        try {
            return Object.freeze(value.map((entry) => canonicalCloneAndDeepFreezeValue(entry, seen)));
        }
        finally {
            // A locked route may intentionally reuse a value (for example its target)
            // in more than one branch. Track the active traversal path, not every
            // previously visited object, so shared acyclic values are cloned safely.
            seen.delete(value);
        }
    }
    if (typeof value === "object") {
        if (seen.has(value)) {
            throw new RangeError("Canonical locked payloads cannot contain cycles.");
        }
        seen.add(value);
        try {
            const source = value;
            const clone = {};
            for (const key of Object.keys(source).sort()) {
                const entry = source[key];
                if (entry !== undefined) {
                    clone[key] = canonicalCloneAndDeepFreezeValue(entry, seen);
                }
            }
            return Object.freeze(clone);
        }
        finally {
            seen.delete(value);
        }
    }
    throw new RangeError("Canonical locked payloads must be JSON-serializable.");
};
export const canonicalCloneAndDeepFreeze = (value) => canonicalCloneAndDeepFreezeValue(value, new WeakSet());
export const stableStringify = (value) => JSON.stringify(stableValue(value));
export const fnv1aHash = (input) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
};
export const planHashFor = (planWithoutHash) => fnv1aHash(stableStringify(planWithoutHash));
