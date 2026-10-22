import { createFixtureBundle } from '../dist/src/fixtures.js';
import { contentDigest, exactRef } from '../dist/src/contracts.js';
import { IMPLEMENTATION_DIGEST } from '../dist/src/model-pin.js';
export const fixtures=()=>createFixtureBundle(IMPLEMENTATION_DIGEST);
export const mutable=structuredClone;
export async function rebind(f) {
  const reseal=async p=>{const {digest,...payload}=p;return {...payload,digest:await contentDigest(payload)};};
  f.physics=await reseal(f.physics);f.optics.physics=exactRef(f.physics);f.optics=await reseal(f.optics);
  f.profile.physics=exactRef(f.physics);f.profile.optics=exactRef(f.optics);
  f.profile.climateNormals.digest=await contentDigest(f.climate);
  if(f.geography!==null)f.profile.macroGeography.digest=await contentDigest(f.geography);
  f.profile=await reseal(f.profile);f.binding.profile=exactRef(f.profile);f.binding.model=exactRef(f.profile.model);
  f.binding.climateNormals=exactRef(f.profile.climateNormals);f.binding.macroGeography=f.profile.macroGeography;
  f.binding.sourceDigest=await contentDigest(f.records);f.binding.eventDigest=await contentDigest(f.events);
  return f;
}
