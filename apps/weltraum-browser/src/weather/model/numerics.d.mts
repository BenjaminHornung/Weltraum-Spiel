export function normalizeIdentity(value: string): string;
export function threefry2x32(counter: readonly number[], key: readonly number[]): readonly number[];
export function tickCounter(tick: number): number[];
export function q16Smoothstep(value: number): number;
export function encodeNumbers(input: {u32:number; tick:number; f64:number}): Uint8Array;
export function decodeNumbers(bytes: Uint8Array): {u32:number; tick:number; f64:number};
