# Later product integration candidate (NOT APPLIED)

Keep current AtmosphereDefinition unchanged. A0 may propose a separately versioned body-to-physics/optics reference table with bodyId and exact {id, version, digest} refs after actual data is supplied and reviewed. The current six fixture refs are synthetic laboratory values and must not be inserted into starterSystem as real planetary data.

Hestia needs approved gas composition, thermodynamic/condensible constants and saturation/radiation support; HighOxygen/Storms hazards alone supply none of those. Null atmospheres for Korus/Tharos/Pyra/Nereion/Aureon mean unknown product data, not the fixture classification. Gas/ice giants retain no-solid-surface pressure coordinates. Authoring/profile updates create new refs/digests and invalidate weather reads at the same tick; no in-place rewrite or shader-derived atmosphere truth.

An eventual patch must include actual profile sources/provenance, catalogue validation and Core/Save/Flight regressions. This spike produces no product diff, migration/schema execution, save rewrite, renderer/flight wind application or source authority cutover. WXG/ATM may consume the frozen candidate contract within their own scopes.
