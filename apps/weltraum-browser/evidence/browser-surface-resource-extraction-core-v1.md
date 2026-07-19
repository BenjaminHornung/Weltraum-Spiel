# Browser Surface Resource Extraction Core v1 Evidence

- Route: `/`
- TestBridge absent: `true`
- Dynamic import: `/src/surface-extraction/index.ts`
- Flow: `scan -> prepare -> begin -> pulse 1 -> pulse 2 -> pulse 3 -> transfer -> depletion`
- Duplicate canonical bytes identical: `true`
- Duplicate signatures identical: `true`
- Canonical byte length: `1322`
- Scenario signature: `weltraum.surface-extraction/v1/fnv1a32:4237431e`
- Browser health console/page/request/HTTP errors: `0/0/0/0`
- Screenshots: not captured; this is a pure non-visual domain slice.

## Result

- Scan: node `resource-node:iron-silicate-vein`, resource `ore_iron_silicate`, confidence `0.92`.
- Pulses: #1=`1`, #2=`1`, #3=`1`.
- Final: session `Completed`, node `Depleted`, remaining `0`, drone quantity `3`.
- Intents: `9` event and `4` mission intents.

## Scope

- Pure TypeScript scan, preparation, session state, deterministic pulse, Resource Core transfer, depletion, and intent projection.
- Normal route only with TestBridge absent and a single dynamic import from the surface-extraction public barrel.
- No UI, renderer objects, physics simulation, DOM authority, global randomness, Date authority, Three.js, or second cargo engine.
