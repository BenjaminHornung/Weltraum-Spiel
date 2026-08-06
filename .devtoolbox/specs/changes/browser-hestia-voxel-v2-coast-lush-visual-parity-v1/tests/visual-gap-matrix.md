# Visual Gap Matrix: Hestia Coast/Lush Parity V1

## Reference package audit

- Supplied directory: `docs/Konzeptart/Hestia`.
- All 22 PNG candidates decoded successfully. Six distinct natural landscape
  images were selected by the read-only visual audit; five city/industrial
  candidates and three concept-board candidates remain unselected.
- The originally announced `current/` and `target/` subdirectories were not
  present. Selected target copies are materialized under
  `apps/weltraum-browser/evidence/hestia-voxel-v2-coast-lush-visual-parity/reference/target`.

| Target role | Selected source filename → committed copy | Dimensions | SHA-256 | Evidence |
|---|---|---:|---|---|
| Coastal valley | `ChatGPT Image 28. Juli 2026, 15_38_28 (4).png` → `target-01-coastal-valley.png` | 1672×941 | `81dcb0afb0040fa4b7cefc53237ef626654e33c26cdffe370256b76b1cfa2e09` | Broad green valley, terraced limestone sides, coastal water and layered tree silhouettes |
| Archipelago / mountain | `ChatGPT Image 28. Juli 2026, 15_38_42 (5).png` → `target-02-archipelago-mountain.png` | 1672×941 | `3eb1dc89f71eb6962d599827b0c6e66f33cb0b318e2ce80551a64a61d1735136` | Central mountain island, smaller forested islands and bright lagoon water |
| Wetland / roots | `ChatGPT Image 28. Juli 2026, 15_38_41 (1).png` → `target-03-wetland-roots.png` | 1672×941 | `91ce98f904b2f07328bfb2983a06c21978f9066fe093b4be1c01f85f0b741d1a` | Rooted umbrella tree in shallow water with reeds, wet shore and submerged vegetation |
| Terraced coast | `ChatGPT Image 28. Juli 2026, 15_37_45 (5).png` → `target-04-terraced-coast.png` | 1672×941 | `2328f9185bd045c0bb963684db500ba6b5cab946d44ce73e352ea6d60001c7a9` | Stepped limestone terraces descend through pools/coast with dense vegetation landmarks |
| Lagoon channel | `ChatGPT Image 28. Juli 2026, 15_38_42 (4).png` → `target-05-lagoon-channel.png` | 1672×941 | `21fda7307c807bcba56364d55d6757fbfe99df5852837acfe7b7be88b32e9e01` | Turquoise channel leads toward open sea between irregular stepped banks |
| Forested island | `ChatGPT Image 28. Juli 2026, 15_37_44 (2).png` → `target-06-forested-island.png` | 1672×941 | `06ebf22cea9fe366df6f2647f53969c67a32bd2b9d990f4f3ae98356f90ebaa6` | Forested island mass, central ridge, umbrella canopies and surrounding water |

## Current/rejection baseline

The four copied current references are under
`apps/weltraum-browser/evidence/hestia-voxel-v2-coast-lush-visual-parity/reference/current`.
They remain rejection evidence only and are not target claims.

| Baseline view | Source/copy | Dimensions | SHA-256 |
|---|---|---:|---|
| Coast/lagoon vista | `current-01-coast-lagoon-vista.png` | 1920×1080 | `ddc437a5ef4265f73bf220f7a7e6f23bbb317c9be1e6635c068a7c4a47949e0b` |
| Inland river/valley vista | `current-02-inland-river-valley-vista.png` | 1920×1080 | `4d986a5337755fe3c4943aface0af147dfeaa93e1b4177ef13f974ce31cf1dfa` |
| First-person spawn | `current-03-first-person-spawn.png` | 1920×1080 | `102abc2eb771fbe9268d7f3e5aa315fb167503f3b9739666b7a2d313ed04bf57` |
| After terrain cut | `current-04-after-terrain-cut.png` | 1920×1080 | `d8d238e15d7922f2dc656dbfece6de39a74246ead9c0b7043cc9cc38c1cff5ea` |

## Strict current → target matrix

Scores are current baseline scores on a 0–5 scale, where 5 already matches the
reference direction and 0 is absent/contradictory. `[O]` is directly observable;
`[I]` is engineering inference only.

| Category | Current 0–5 | Current → target evidence | Required change |
|---|---:|---|---|
| Macro composition | 1/5 | **[O]** Current `01/02` show a floating rectangular platform with repeated ring terraces; targets show connected full-bleed valleys, coast, archipelago and island masses. | Islands, valleys, mountain mass and depth layers |
| Visible world size | 1/5 | **[O]** Current world is a small slab surrounded by empty sky; targets fill the frame with landscape and horizon depth. | Mid/Far descriptor proxies to ~500m, no edge |
| Terrain forms | 1/5 | **[O]** Current geometry is regular stepped/ring terrain; targets show irregular limestone cliffs, shelves, mesas and erosion. | Irregular cliffs, shelves, erosion forms |
| Coast / hydrology | 1/5 | **[O]** Current water reads as moat/flat rectangle; targets show channels, lagoons, shore bands and depth transitions. | Connected lagoon/river/channel topology |
| Material readability | 1/5 | **[O]** Current surfaces are flat saturated green/brown/cyan with dark bands; targets separate pale limestone, sand, wet strata and vegetation. | Moisture/slope/strata/tint families |
| Tree silhouettes | 2/5 | **[O]** Current trees are block-built but mostly rounded repeated crowns; targets require broad umbrellas, roots, asymmetry and vines. | Umbrella, buttress, coast and mangrove archetypes |
| Ground vegetation | 1/5 | **[O]** Current colored rods are uniformly scattered and technical; targets use grouped reeds, roots, flowers and wetland accents. | Clustered supported reeds/grass/spires/flowers/vines |
| Water | 1/5 | **[O]** Current water has little depth/shore breakup; targets have layered turquoise channel water, shallows and glint. | Circular horizon pass, depth/shore/Fresnel/glint |
| Sky / clouds | 0/5 | **[O]** Current baseline is a blank cyan gradient; targets have cloud structure and a readable horizon. | Sky dome, low-poly cloud clusters, horizon gradient |
| Light / shadow / AO | 1/5 | **[O]** Current shadows are hard/dark; targets use warm key, cool fill, soft contact shading and controlled AO. | Material-aware shared shader, warm key/cool fill/AO |
| Atmospheric depth | 0/5 | **[O]** Current captures lack distance haze and foreground/midground/background separation. | Mid/Far haze and clear foreground/mid/background |
| First-person readability | 1/5 | **[O]** First-person exists, but debug JSON/status/crosshair/instructions dominate the capture. | Human-scale path, framed vegetation, no debug beauty HUD |
| Visible world boundaries | 0/5 | **[O]** Current `01/02` expose outer rectangular platform, water slab and underside/edge conditions. | No rectangular edge, void or water-plane border |
| Render budget | 1/5 | **[I]** Baseline is coarse but has no proof of budget for target density; source shows one material/geometry per chunk. | Region batching and bounded instances before density |

## Mandatory final rubric — baseline scores

The final candidate must score at least 4/5 in every category and no category may
score 0–2. The repository owner is the final visual gate.

| Rubric category | Baseline score | Final score | Evidence |
|---|---:|---:|---|
| Wide world / no boundary | 0/5 | PENDING | Rectangular slab edge visible; final must remove it. |
| Credible coast/lagoon/river | 1/5 | PENDING | Flat/moat water; final must provide connected channels. |
| Macro/meso/micro forms | 1/5 | PENDING | Mostly uniform coarse blocks; final needs all three scales. |
| Bright rock/soil/wetness separation | 1/5 | PENDING | Flat saturated materials; final needs readable families. |
| Umbrella/root tree direction | 2/5 | PENDING | Rounded repeated crowns; final needs archetype silhouettes. |
| Grouped rich vegetation | 1/5 | PENDING | Isolated rods; final needs supported clusters. |
| Water depth/shore/reflection | 1/5 | PENDING | Minimal depth/shore cues; final needs layered water. |
| Sky/cloud/haze depth | 0/5 | PENDING | Empty gradient; final needs clouds and atmosphere. |
| Fine block scale | 2/5 | PENDING | Blocks visible but face/cube detail weak. |
| First-person readability | 1/5 | PENDING | Technical overlays dominate. |
| No debug/diorama feel | 0/5 | PENDING | Slab and diagnostics dominate. |
| Overall art-direction convergence | 1/5 | PENDING | Functional technical prototype only. |

## Final candidate evidence

- Candidate: `apps/weltraum-browser/evidence/hestia-voxel-v2-coast-lush-visual-parity/iteration-23-candidate`.
- Five 1920×1080 PNGs are decoded and SHA-256 recorded in `manifest.json`; the
  manifest reports zero browser errors.
- Technical evidence shows no rectangular coastal slab edge, broader
  archipelago/wetland framing, deterministic first-person terrain cuts and no
  visible debug HUD in Beauty captures.
- Final 0–5 scores remain `PENDING` until the repository owner compares the
  candidate against the six mapped target references. The mandatory rubric is
  not self-approved by implementation or test evidence.
