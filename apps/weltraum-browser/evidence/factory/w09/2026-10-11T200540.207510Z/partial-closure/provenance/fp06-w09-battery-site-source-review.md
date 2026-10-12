# W09 battery site source review v1

Read-only geometry, no product/profile/terrain/yaw edits, CPU test/build/browser/Native jobs. Start 2026-10-11T23:44:55.881863+00:00→end 2026-10-11T23:51:28.285517+00:00; HEAD both `aa2e5d7c335453fc555a98ccd35e9f564c596e93`. Eight source/artifact files hashed; drift: none in the recorded window. Moving Integrator draft, not a final package seal. Root now authorizes routine pose/cable-job implementation; this review supplies no Native/LOS/route PASS.

**One concrete candidate:** battery center `[-2250,1500,2500]`mm, existing q1. Keep all paid feet, profile, height, pose convention, terrain union and budgets. Approved source maps east=12.5−worldZ, north=worldX+12.25; original distributor body mask `[E9,11; N9.5,10.5]` becomes worldX[-2.75,-1.75],Z[1.5,3.5]. Source mask materialization uniformly ends at1.5m inside that exact half-open union, not its overall bounding rectangle.

**Actual original-pose countercase:** current old battery z3.0/q1 needs world support bounding X[-2.75,-1.75],Z[2,4]m. Its +Z feet extend to4m, outside the existing mask above3.5m; retained Native178 reports their ground top1.25m while feet base stays1.5m. Thus support is not confirmed. Raising/shortening feet or extending the mask would change a different contract and is unnecessary for this candidate.

**Unchanged candidate feet/hull/service:** source battery feet are local x±.75,z±.375 with0.5×0.25m patches. Native q1 rotates[x,y,z]→[z,y,−x]. At z2.5, the four separate patch ranges are X[-2.75,-2.5] or[-2,-1.75] crossed with Z[1.5,2] or[3,3.5]; all lie in the existing body mask. Exact edge support checks must use existing interior sample margins. Full collision hull is X[-2.75,-1.75],Y[1.5,3],Z[1.5,3.5]. Metadata source dimensions[2,1,1.5] agree with actual boxes after source/runtime axis interpretation. Source battery service volume becomes X[-1.5,-.5],Y[1.5,2.5],Z[1.5,3.5]; preserve its full1m clearance. It lies east of the current machine/belt hulls, not through them. FP02§8.6 forwards energy-object visual dimensions to FP01; C03 remains the same50kg/4kWh item and same stored energy, not a second battery.

**Distributor separation constraint:** old distributor center[-2250,1500,2000]/q1 has hull/support Z[1,3], overlaps candidate battery Z[1.5,3.5] and shares its X/Y volume; southern feet also fall beyond the mask. It is invalid as a simultaneous default. Adjacent candidate[-3250,1500,2500]/q1 fits its feet into existing neighbor/service mask E9–11,N8.5–9.5; its hull only touches battery atX−2.75, but distributor service X[-2.25,-1.25],Z[1.5,3.5] overlaps the battery by0.5m. Hence adjacent-foot-fit is not an admissible second dock. No separate nearby full-service-clear distributor pose is proven here. Root explicitly says a separate distributor dock is not a first-loop prerequisite; keep its paid placement preview honest, do not hide overlap or expand the approved terrain.

**New exact native-socket cable jobs:** unchanged battery authoring socket[0,1,.5] rotates to `[-1750,2500,2500]`mm. Source-derived protected endpoints and ceil250mm Manhattan rule give:

| Target | socket world mm | raw Manhattan mm | paid cable mm |
|---|---|---:|---:|
| CUT | `[-5375, 2625, 5750]` | 7000 | 7000 |
| BELT | `[-5875, 2250, 3250]` | 5125 | 5250 |
| FORM | `[-4875, 2625, -1750]` | 7500 | 7500 |

Total19,750mm of the same finite40,000mm stock. Only closed technical jobs7000/5250/7500 need matching transport-choice labels/admission; no mass/CAS/carrier/budget or cargo freeze change. The old4750/6500/8000 job bindings must not be falsely reused for the new geometry.

**Readonly reach candidates, not actual Actor poses:** CUT/battery sphere intersection contains worldpoint[-3.5,2.17,4.25]m; BELT/battery contains[-3.375,2.17,3]m; FORM/battery contains[-3.375,2.17,.375]m. Each has Euclidean distance<3m to both relevant sockets and stays outside the listed machine/battery hulls. These are analytical candidates only. Actual capsule clearance, terrain-supported standing height, complete World membership, coverage, LOS, carrying/deposit access and normal native walk remain NOT_RUN; do not teleport or treat them as approved poses.

Source hash receipts: `/workspace/.cloud-setup/fp06-w09-battery-site-start.json` SHA `87e99310fd7884ebce6d050e5c174d8c2aff2f2c080c3b4fb1d93e917a09e31b`; `/workspace/.cloud-setup/fp06-w09-battery-site-end.json` SHA `bb251dab43aa68bbba2d42f404cafd965bf71e1db552163ded6c5dc075e922fd`. No global battery/profile/terrain decision accepted here; Native regression closure follows Integrator execution.
