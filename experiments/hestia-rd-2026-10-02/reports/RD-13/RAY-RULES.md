# Frozen CPU/native ray qualification rules

Initial axis ceiling 64; slots 1..7, exact X-fast original addressing.
F01 `coast-crop` window lower inclusive `[32,0,16]`, upper exclusive
`[96,64,80]`; 64x64x64, original crop offset `[64,48,64]`, native offset
`[96,48,80]`, quantum 0.125 m, selected local box `[-4,-2,-6]..[4,6,2]`.
Camera binding `C02-SHORE`: position `[-2,1.25,-6]`, target `[1,-0.5,-2]`,
FOV55. Other original cameras remain selectable; selection never follows them.
Source slot SHA `561b1ea853ee6377ec78337016725d6771f178e734925dd0d6d3a33ec7056c0a`;
recipe SHA `e65416ef10e7e07a72bdd2129cd2a26523d5ffbbe293a27f3542957ec17b5df8`.
Label selected F01 projection; original water, omitted vegetation, no face AO.

World ray direction is unit length. Composed owner world pose is applied once;
grid direction is not renormalized, so t remains world metres. Explicit zero
slabs; floor negatives; exact negative boundary chooses preceding cell. Clamp
only at proven volume entry. Zero-length/grazing intervals are rejected. Test
first cell before stepping. Advance all tied axes, X/Y/Z priority only for
reported normal. Inside occupied starts return exposed contiguous-run exit,
not t=0 or material-internal faces. Entry opposes travel, exit follows travel;
normal is world transformed. Exhaustion is a fault, not miss. Open Unknown
faces invent no solid; in-box uncertain traversal and outside Unknown remain
separate diagnostics, never clearance. Preserve original source sidedness.

Oracle: analytical per-cell AABB intervals; merge touching occupied intervals
and select entry/exit; separate Unknown intervals. Not a DDA transcription.
Analytical CPU position/t/normal tolerance 1e-9; canonical payload exact.
Float32 projection 1e-5 m. Future native hit/normal/depth tolerances respectively
1e-5 m / 1e-5 component / 2e-5 depth; slot/cell/status exact. No post-result tuning.
Fault controls: constant miss, wrong slot/normal, stale snapshot, Unknown collapse,
proxy depth. Missing native format/extension remains UNSUPPORTED/non-green.
