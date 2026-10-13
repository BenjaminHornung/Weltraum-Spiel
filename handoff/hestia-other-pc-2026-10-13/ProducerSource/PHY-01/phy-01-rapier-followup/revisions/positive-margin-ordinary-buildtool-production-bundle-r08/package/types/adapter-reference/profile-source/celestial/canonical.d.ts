export interface CelestialCanonicalArray extends ReadonlyArray<CelestialCanonicalValue> {
}
export interface CelestialCanonicalObject {
    readonly [key: string]: CelestialCanonicalValue;
}
export type CelestialCanonicalValue = null | boolean | number | string | CelestialCanonicalArray | CelestialCanonicalObject;
export declare const canonicalizeCelestialValue: (value: unknown) => CelestialCanonicalValue;
/** Byte-stable JSON with no numeric rounding or planner-field omissions. */
export declare const canonicalCelestialJson: (value: unknown) => string;
export declare const celestialSignature: (value: unknown) => string;
