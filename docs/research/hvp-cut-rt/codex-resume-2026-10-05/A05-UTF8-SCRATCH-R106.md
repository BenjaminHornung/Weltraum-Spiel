# Native UTF8 scratch, actual normal input

Measured R105 profile attributed substantial Main time to TextEncoder allocations and GC. Existing presentation canonical writer now retains one512-byte scratch; native encodeInto is used only for <=128UTF16 units (at most384UTF8 bytes), then the unchanged8-byte length header and all written bytes are folded. Longer strings use the unchanged encode branch. No new codec/cache/hash/source authority or dropped validator.

MeaningfulRED: independent complete hash oracle passed but encode allocation control returned18 instead of3. Current whole6file population56/56 PASS, native3.9385401s; full TypeScript0 in2.6678296s, production build0 in2.8612474s. Every Native job0/outer1 and exact process creation absence within2.9s; whole sources474+test bindings486 unchanged during each run. Tests include UTF8length127/128/129, BMP, emoji, lone surrogates, NUL, long-short-empty alternation. Read-only design review ACCEPT.

Fresh own Page, onecollector, actual normal Rockarm cut: R105scalar baseline Applied2536.2001953/render2550.1000977ms; R106UTF8 Applied2065.1000977/render2074.1999512ms. Source1652.4->1297.2ms, Compile480.4->386.5ms; NativePrepare202.3ms and Graphics122.6ms remain. Same removed64/transferred384/mass1722.65625kg/source70d85a5593bd44c9/root26d5308d; Running, raw0drops. Actual raw A05-actual-support-utf8-r106.DATA.json. DIAGNOSTIC_FAIL250, not42/1400 acceptance; browserDPR1.0000000149011612 remains ineligible for formal numeric proof.

R105actualBody384->352 fresh normal Load/Impulse/CurrentPoseCut: owner578.3ms, Applied854.4997559/render884.2998047ms, correct child sourcec05b830d110a061f/currentroot/native/render identity; FAIL250. Preserved A05-actual-body-r105.DATA.json. Full B2/B3 and A07 remain OPEN.
