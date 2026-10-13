import assert from "node:assert/strict";
export const results = [];
export function it(name, run) {
    try {
        run();
        results.push({ name, status: "PASS" });
    }
    catch (error) {
        results.push({ name, status: "FAIL", error });
        throw error;
    }
}
export function expect(actual) {
    return {
        toBe(expected) { assert.ok(Object.is(actual, expected)); },
        toEqual(expected) { assert.deepStrictEqual(actual, expected); },
        toBeUndefined() { assert.strictEqual(actual, undefined); },
        toThrow() { assert.strictEqual(typeof actual, "function"); assert.throws(actual); },
    };
}
