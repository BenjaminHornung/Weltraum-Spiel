# Browser Planetary Environment Core v1 Evidence

- Route: `/`
- TestBridge absent: `true`
- Dynamic import: `/src/planetary-environment/index.ts`
- Fixtures: `6`
- Duplicate sample bytes identical: `true`
- Duplicate signatures identical: `true`
- Browser health console/page/request/HTTP errors: `0/0/0/0`
- Screenshots: not captured; this is a pure non-visual core slice.

## Samples

- `environment.airless-moon`: `Vacuum`, `Vacuum`, `ExtremeCold`, `Vacuum`, hazards `Vacuum,ExtremeCold,Radiation`, signature `fnv1a32:b53bc54e`
- `environment.thin-co2-moon`: `Valid`, `Thin`, `ExtremeCold`, `Toxic`, hazards `LowPressure,Hypoxia,ToxicAtmosphere,ExtremeCold,Radiation,Dust`, signature `fnv1a32:806b725e`
- `environment.earth-reference`: `Valid`, `Nominal`, `Temperate`, `Breathable`, hazards `none`, signature `fnv1a32:2aea2b46`
- `environment.high-pressure-toxic`: `Valid`, `Extreme`, `ExtremeHeat`, `Corrosive`, hazards `HighPressure,Hypoxia,ToxicAtmosphere,CorrosiveAtmosphere,ExtremeHeat,LowVisibility`, signature `fnv1a32:36b8a29c`
- `environment.hestia-wet-spore`: `Valid`, `Nominal`, `Temperate`, `Toxic`, hazards `ToxicAtmosphere,Spores,LowVisibility`, signature `fnv1a32:574023e4`
- `environment.unknown-exotic`: `Valid`, `Nominal`, `Temperate`, `Unknown`, hazards `Hypoxia,UnknownComposition`, signature `fnv1a32:75f3b5e1`

## Scope

- Pure TypeScript environment profiles, validation, analytic sampling, typed hazards, canonical bytes, and signatures.
- Normal route only with TestBridge absent and no UI interaction or screenshot dependency.
- No suit, surface, world generation, voxel, flight, celestial, spatial, renderer, Three.js, or runtime authority.
