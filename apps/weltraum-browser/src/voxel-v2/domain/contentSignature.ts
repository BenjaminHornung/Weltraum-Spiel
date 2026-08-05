const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const UINT64_MASK = 0xffffffffffffffffn;

export const contentSignature = (bytes: Uint8Array): string => {
  let hash = FNV_OFFSET_64;
  for (const byte of bytes) hash = ((hash ^ BigInt(byte)) * FNV_PRIME_64) & UINT64_MASK;
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};
