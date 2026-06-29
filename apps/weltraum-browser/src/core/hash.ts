const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        if (key !== "planHash") {
          acc[key] = stableValue((value as Record<string, unknown>)[key]);
        }
        return acc;
      }, {});
  }

  return typeof value === "number" ? Number(value.toFixed(5)) : value;
};

export const stableStringify = (value: unknown): string => JSON.stringify(stableValue(value));

export const fnv1aHash = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const planHashFor = (planWithoutHash: unknown): string => fnv1aHash(stableStringify(planWithoutHash));
