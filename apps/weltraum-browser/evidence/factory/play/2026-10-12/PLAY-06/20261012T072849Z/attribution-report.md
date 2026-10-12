# PLAY-06 bounded attribution

Fresh Node v22.23.3 / npm10.9.8. All nine sourcebindings and the original6563-byte case block (SHA ce1fb626500b8b05fcbd255f574f4a0597d1ebd864dab82d74a98dbd64951cd1, offset22431) match before and after. Both original paid-band cases ran in existing order with the original5000ms limit. No test overlay or product/config/timeout changes. These are pure composition tests; Native transition and browser hardware are NOT_PRESENT / NOT_RUN.

The one baseline returned exit1: 1PASS,1timeout,32skipped. Output case5649ms; wrapper9.452156s; raw1094 bytes/SHA5858158390c46af3a9d2861a2cc95f3c6a9f4ed98af91016bac128c9d94baf4d. The one V8 profile also returned exit1: output5847ms, wrapper9.811333s, raw993 bytes/SHAc10cbcbd7c33b0e90ad2c18f3d6c3bf905769a9e699c8f4f84aea959d89f7fba. Profiling overhead is separate and neither outcome is PerformancePASS. Every earlier FAIL remains preserved.

Worker12453 sampled9.375844s. Disjoint self hot functions: serializeCanonicalJson3.326589s, canonicalize0.950111s, defineCanonicalProperty0.939959s. The Dryslice canonicalJson self0.730756s is another distinct sample category.

Inclusive values overlap and must not be added: prepareDryFactoryStep6.080233s, advanceFactoryBelt3.027832s, assertMaterialSnapshots2.452453s, assertFactoryBeltState1.681431s, W08 inputBytes0.896356s. Material-validation samples assigned once by nearest Factory caller show1.663020s under assertFactoryBeltState,0.638120s under reservations.assertView and0.150235s under recipeAdmission.validateMaterial. Canonical samples assigned once by nearest Factory caller show1.855160s in assertMaterialSnapshots,0.845086s in Dryslice canonicalJson,0.560807s in W08 inputBytes. These support H1: repeated W08 full snapshot validation/canonical material projection is a measured cost. They do not establish that any proposed cache is safe or enough to pass.

The separate parent12428 profile sampled9.766350s and92.67%idle; it is never added to worker samples. Exact profiles, hashes, weighted method and complete ranked functions are in v8-profile-attribution.json.

Budget consumed: one baseline and one profile; zero runtime candidates authorized. No further measurement or optimization performed. A minimal sourcebound candidate requires a new exact Root grant. Final hardware and owner acceptance remain pending.
