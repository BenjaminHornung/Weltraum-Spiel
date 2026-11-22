# HVP weather model sources

The normal Hestia PlanetaryMacro, starter celestial catalog, spatial frames and universe clock come from the browser application. WXG and CEL use their existing algorithms and data contracts through local module imports.

| Local files | Repository source |
| --- | --- |
| climate.ts, common.ts, geometry.ts, macro.ts, model-pin.ts, synoptic.ts, weather.ts | docs/hestia/target-pc/source-candidates/benni-pc-pmd-normal-core-source-r01/src |
| macroProfile.ts | Same candidate, world-generation/planetaryMacroProfile.ts |
| contracts.ts, contractsPin.ts, contractsTypes.ts | spikes/wxg-07-grid-dynamics/inputs/wxg/vendor/cel/src, originally contracts.ts, model-pin.ts and types.ts |
| numerics.mjs and its declaration | The same CEL package, vendor/plt/src |
| authoredCoast.json | Entry HestiaAuthoring in spikes/wxg-07-grid-dynamics/inputs/wxg/fixtures/authoring-inputs.json, limited to the bundle and climate parameters. The application supplies the catalog and world/session identities at runtime. |

The coast visual scenario places its local origin at the Hestia authoring query on the equator and prime meridian. East, up and south form the local right-handed axes. Atmospheric and optical parameters carry the upstream authoring assumptions. This fixture has no bound condensible species. The viewer's authored optical coverage is 0.3. Wind and extinction are sampled from WXG. Liquid and solid fluxes are projected separately when an input model supplies them. Only confirmed open terrain columns admit local precipitation.

The independent prior W1 sample at universe tick 120 produces weather snapshot 5ac049cdc449e467a5e9952e4c305370354599c8a72ce269751589b75280c4ad, temperature 282.7607693068899 K and 12 m/s east wind. The regression test checks these values at the original fixture world/session, with live world/session bindings exercised separately.
