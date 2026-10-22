import { describe, expect, it, vi } from "vitest";
import { Vector3 } from "three";
import { buildHvpPlant, planHvpVegetation, measureHvpWood, meshHvpVegetation, projectHvpVegetation } from "../../src/hestia-prototype/presentation/vegetation";
import { readHvpSourceColumnWorld } from "../../src/hvp/hvpCoastSource";
import { ThreeRenderBackend } from "../../src/render/three/backend/threeRenderBackend";
import { createHvpPresentationBackend } from "../../src/hvp/hvpBootstrap";
import { backendRevision, createMeshArtifact, createRenderCommand, frameId, renderCommandResult, representationKey } from "../../src/presentation";
import { createFactoryDecorFootprints, createFactoryDecorProjection } from "../../src/factory/presentation/factoryDecorProjection";

describe("HVP-03 authored vegetation", () => {
  it("keeps non-woody understorey below the player and broad leaves rooted near the ground", () => {
    const limits = { broadleaf: 0.875, reed: 1.375, violet: 1.125, amber: 1.625 };
    const measurements = [];
    for (const plant of planHvpVegetation().filter((p) => p.kind !== "tree")) {
      const source = buildHvpPlant(plant);
      const volume = source.decoration;
      let maximum = 0, occupied = 0, low = 0;
      for (let z = 0; z < volume.sizeZ; z += 1) {
        for (let x = 0; x < volume.sizeX; x += 1) {
          const ground = readHvpSourceColumnWorld(plant.position.x + volume.originMeters.x + (x + 0.5) * 0.125,
            plant.position.z + volume.originMeters.z + (z + 0.5) * 0.125).topMeters;
          for (let y = 0; y < volume.sizeY; y += 1) {
            if (volume.slotAt(x, y, z) === 0) { continue; }
            const height = plant.position.y + volume.originMeters.y + (y + 1) * 0.125 - ground;
            occupied += 1;
            maximum = Math.max(maximum, height);
            if (height <= 0.375) { low += 1; }
          }
        }
      }
      expect(source.wood).toBeNull();
      expect(source.decorationPhysics).toBe("none");
      expect(occupied).toBeGreaterThan(0);
      measurements.push({ id: plant.id, kind: plant.kind, maximum, lowRatio: low / occupied });
    }
    expect(measurements.filter((p) => p.maximum > limits[p.kind as keyof typeof limits]), "oversized understorey").toEqual([]);
    expect(measurements.filter((p) => p.kind === "broadleaf" && p.lowRatio < 0.45), "elevated mini-tree crowns rather than basal leaves").toEqual([]);
  });
  it("uses distinct branching architectures and one draw per decoration owner", () => {
    const trees = planHvpVegetation().filter((plant) => plant.kind === "tree").map(buildHvpPlant);
    expect(new Set(trees.map((tree) => tree.attachments.length)).size).toBeGreaterThanOrEqual(3);
    expect(trees[3]!.decoration.byteLength).toBeLessThan(trees[0]!.decoration.byteLength);
    for (const tree of trees) {
      const products = meshHvpVegetation(tree);
      const crown = products[1]!;
      expect(crown.profiles).toHaveLength(1);
      expect(crown.mesh.colors).not.toBeNull();
      expect(new Set(crown.mesh.colors).size).toBeGreaterThan(1);
    }
  }, 120_000);
  it.each(planHvpVegetation().filter((plant) => plant.kind === "tree"))("T01 $id has one face-connected wood component and terrain-bound root anchors", (hero) => {
    const source = buildHvpPlant(hero);
    const wood = source.wood!;
    const bytes = wood.copySlots();
    const visited = new Set<number>();
    const queue = [bytes.findIndex((slot) => slot !== 0)];
    const plane = wood.sizeX * wood.sizeY;
    for (let i = 0; i < queue.length; i += 1) {
      const index = queue[i]!;
      if (visited.has(index) || bytes[index] === 0) { continue; }
      visited.add(index);
      const x = index % wood.sizeX;
      const y = Math.floor(index / wood.sizeX) % wood.sizeY;
      const z = Math.floor(index / plane);
      for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
        const nx = x + dx!, ny = y + dy!, nz = z + dz!;
        if (nx >= 0 && nx < wood.sizeX && ny >= 0 && ny < wood.sizeY && nz >= 0 && nz < wood.sizeZ) {
          const next = nx + wood.sizeX * ny + plane * nz;
          if (bytes[next] !== 0 && !visited.has(next)) { queue.push(next); }
        }
      }
    }
    expect(visited.size).toBe(bytes.filter((slot) => slot !== 0).length);
    expect(source.anchors.length).toBeGreaterThanOrEqual(3);
    const assertAnchors = (slots: Uint8Array): void => {
      for (const anchor of source.anchors) {
        expect(slots[anchor.cell[0] + wood.sizeX * anchor.cell[1] + plane * anchor.cell[2]]).toBe(1);
      }
    };
    assertAnchors(bytes);
    for (const anchor of source.anchors) {
      expect(wood.slotAt(...anchor.cell)).toBe(1);
      const [x,y,z] = anchor.cell.map((q, axis) => q * 0.125 + [wood.originMeters.x, wood.originMeters.y, wood.originMeters.z][axis]!);
      expect(y! + hero.position.y).toBe(readHvpSourceColumnWorld(x! + hero.position.x + 0.0625, z! + hero.position.z + 0.0625).topMeters);
      const index = anchor.cell[0] + wood.sizeX * anchor.cell[1] + plane * anchor.cell[2];
      bytes[index] = 0;
      expect(() => assertAnchors(bytes)).toThrow();
      bytes[index] = 1;
      expect(wood.slotAt(...anchor.cell)).toBe(1);
    }
    for (const attachment of source.attachments) {
      expect(attachment.supportKind).toBe("wood");
      expect(attachment.supportOwnerId).toBe(hero.id);
      expect(wood.slotAt(...attachment.supportCell)).toBe(1);
    }
  }, 120_000);

  it("T02 keeps the central root arch genuinely empty rather than using a whole-tree collider", () => {
    const source = buildHvpPlant(planHvpVegetation().find((plant) => plant.id.endsWith("hero"))!);
    const wood = source.wood!;
    let samples = 0;
    for (let x = -0.375; x <= 0.375; x += 0.125) {
      for (let y = 0.25; y <= 1.875; y += 0.125) {
        for (let z = -0.375; z <= 0.375; z += 0.125) {
          expect(wood.slotAt(Math.round((x - wood.originMeters.x) * 8), Math.round((y - wood.originMeters.y) * 8), Math.round((z - wood.originMeters.z) * 8))).toBe(0);
          samples += 1;
        }
      }
    }
    expect(samples).toBeGreaterThan(100);
    // A collider filled over the volume's bounds would cover every probe above.
    expect(wood.originMeters.y).toBeLessThan(0.25);
    expect(wood.originMeters.y + wood.sizeY * 0.125).toBeGreaterThan(1.875);
    const probe = {min: {x:-0.375,y:0.25,z:-0.375}, max: {x:0.5,y:2,z:0.5}};
    const overlaps = (min: typeof probe.min, max: typeof probe.max) =>
      min.x < probe.max.x && max.x > probe.min.x && min.y < probe.max.y
      && max.y > probe.min.y && min.z < probe.max.z && max.z > probe.min.z;
    expect(() => expect(overlaps(wood.originMeters, {
      x:wood.originMeters.x+wood.sizeX*0.125,y:wood.originMeters.y+wood.sizeY*0.125,z:wood.originMeters.z+wood.sizeZ*0.125
    })).toBe(false)).toThrow();
  });

  it("T03/T04 has stable source-bound instances, wet habitats and an open salvage clearing", () => {
    const first = planHvpVegetation();
    expect(planHvpVegetation()).toEqual(first);
    expect(new Set(first.map((p) => p.id)).size).toBe(first.length);
    expect(first.filter((p) => p.kind === "tree").map((p) => p.variant).sort()).toEqual([0,1,2,3]);
    expect(new Set(first.map((p) => p.kind))).toEqual(new Set(["tree", "reed", "broadleaf", "violet", "amber"]));
    for (const plant of first) {
      const ground = readHvpSourceColumnWorld(plant.position.x + 0.0625, plant.position.z + 0.0625);
      expect(plant.position.y).toBe(ground.topMeters);
      expect(Math.hypot(plant.position.x + 9, plant.position.z + 9)).toBeGreaterThan(3);
      if (plant.kind === "reed") { expect(ground.topMeters).toBeLessThanOrEqual(0.25); }
      else { expect(ground.topMeters).toBeGreaterThan(0); }
      if (plant.kind !== "tree") {
        const attachment = buildHvpPlant(plant).attachments[0]!;
        expect(attachment.supportOwnerId).toBe("hvp:terrain");
        expect(attachment.supportKind).toBe("terrain");
        expect((attachment.supportCell[1]+1)*0.125-8).toBe(ground.topMeters);
        expect(attachment.supportCell[0]*0.125-16).toBe(plant.position.x);
        expect(attachment.supportCell[2]*0.125-16).toBe(plant.position.z);
      }
    }
    const entries = first.filter((p) => p.kind === "tree");
    const forward = entries.map((p) => buildHvpPlant(p).digest);
    expect([...entries].reverse().map((p) => buildHvpPlant(p).digest).reverse()).toEqual(forward);
    const leaves: Array<readonly [number,number]> = [];
    for (let z=-8;z<8;z+=1) {
      for (let x=-8;x<8;x+=1) { leaves.push([x,z]); }
    }
    const sorted = (plants: typeof first) => [...plants].sort((a,b)=>a.id.localeCompare(b.id));
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Frame/random-dependent vegetation"); });
    try {
      expect(sorted(leaves.flatMap((leaf)=>planHvpVegetation(leaf)))).toEqual(sorted(first));
      expect(sorted([...leaves].reverse().flatMap((leaf)=>planHvpVegetation(leaf)))).toEqual(sorted(first));
    } finally { random.mockRestore(); }
  }, 120_000);

  it("T04 rejects injected plants in open channel, dry reed habitat and the quiet clearing", () => {
    const hero=planHvpVegetation().find((p)=>p.kind==="tree")!;
    for (const [x,z,kind] of [[0,15.5,"tree"],[-9,-9,"broadleaf"],[8,7,"reed"]] as const) {
      const y=readHvpSourceColumnWorld(x+0.0625,z+0.0625).topMeters;
      expect(()=>buildHvpPlant({...hero,kind,position:{x,y,z}})).toThrow(/habitat/);
    }
  });

  it("T05 wood mass and COM are independent of cosmetic palette", () => {
    const plant = planHvpVegetation().find((p) => p.kind === "tree")!;
    const source = buildHvpPlant(plant);
    const measured = measureHvpWood(source.wood!);
    expect(measured.massKg).toBe(source.wood!.copySlots().filter((n) => n !== 0).length * 600 * 0.125 ** 3);
    const woodBefore=source.wood!.copySlots();
    const standard=meshHvpVegetation(source);
    const altered=meshHvpVegetation(source, [[0.6,0.2,0.6],[0.2,0.3,0.7],[0.7,0.2,0.1]]);
    expect(altered[1]!.mesh.colors).not.toEqual(standard[1]!.mesh.colors);
    expect(altered[0]!.profiles).toEqual(standard[0]!.profiles);
    expect(source.wood!.copySlots()).toEqual(woodBefore);
    expect(measureHvpWood(source.wood!)).toEqual(measured);
    expect(source.decorationPhysics).toBe("none");
    expect(source.attachments.every((a) => a.ownerId === plant.id)).toBe(true);
  });

  it("keeps Factory ground offsets and paid-footprint masks render-only", () => {
    const plant=planHvpVegetation().find(value=>value.kind!=="tree")!,source=buildHvpPlant(plant),volume=source.decoration;
    let target:{x:number;y:number;z:number}|undefined;
    for(let z=0;z<volume.sizeZ&&!target;z++)for(let y=0;y<volume.sizeY&&!target;y++)for(let x=0;x<volume.sizeX;x++){
      if(volume.slotAt(x,y,z)!==0){target={x,y,z};break;}
    }
    expect(target).toBeDefined();
    const rawSlots=volume.copySlots(),sourceDigest=source.digest,cell=volume.cellMeters;
    const shiftedProfile={version:"hvp-factory-vegetation-v1" as const,readColumn:(x:number,z:number)=>{
      const column=readHvpSourceColumnWorld(x,z);return {...column,topMeters:column.topMeters+cell};
    }};
    const empty=createFactoryDecorFootprints([]),shifted=createFactoryDecorProjection(source,shiftedProfile,empty);
    expect(shifted.occupancy.originMeters.y).toBe(volume.originMeters.y+cell);
    expect(shifted.occupancy.sizeY).toBe(volume.sizeY);
    expect(shifted.occupancy.slotAt(target!.x,target!.y,target!.z)).toBe(volume.slotAt(target!.x,target!.y,target!.z));

    const minX=source.instance.position.x+volume.originMeters.x+target!.x*cell;
    const minZ=source.instance.position.z+volume.originMeters.z+target!.z*cell;
    const footprints=createFactoryDecorFootprints([{instanceId:"paid-fixture",ownerWitness:"confirmed-owner-r1",
      boundsMm:{min:[Math.floor(minX*1000),-100_000,Math.floor(minZ*1000)],
        max:[Math.ceil((minX+cell)*1000),100_000,Math.ceil((minZ+cell)*1000)]}}]);
    const masked=createFactoryDecorProjection(source,shiftedProfile,footprints);
    expect(masked.occupancy.slotAt(target!.x,target!.y,target!.z)).toBe(0);
    expect(masked.occupancy.slotAt(Math.min(volume.sizeX-1,target!.x+1),target!.y,target!.z)).toBe(
      shifted.occupancy.slotAt(Math.min(volume.sizeX-1,target!.x+1),target!.y,target!.z));
    const standard=meshHvpVegetation(source)[0]!,projected=meshHvpVegetation(source,undefined,{decoration:masked.occupancy})[0]!;
    expect(projected.artifact.contentHash).not.toBe(standard.artifact.contentHash);
    expect(source.digest).toBe(sourceDigest);
    expect(volume.copySlots()).toEqual(rawSlots);
  });

  it("T06/T08 projects wood and decor from one owner and releases actual shared mesh handles over 20 cycles", () => {
    const plant = planHvpVegetation().find((p) => p.kind === "tree")!;
    const products = meshHvpVegetation(buildHvpPlant(plant));
    const before = projectHvpVegetation(products, [{ownerId:plant.id,position:plant.position,orientation:{x:0,y:0,z:0,w:1}}]);
    const moved = {x:plant.position.x+2,y:plant.position.y+3,z:plant.position.z-1};
    const after = projectHvpVegetation(products, [{ownerId:plant.id,position:moved,orientation:{x:0,y:1,z:0,w:0}}]);
    expect(after.map((p) => p.representationKey)).toEqual(before.map((p) => p.representationKey));
    expect(after.map((p) => p.positionRelative)).toEqual(products.map(()=>moved));
    expect(() => projectHvpVegetation(products, [])).toThrow(/Missing vegetation owner/);
    expect(() => projectHvpVegetation(products, [{ownerId:plant.id,position:moved,orientation:{x:0,y:0,z:0,w:0}}])).toThrow(/unit quaternion/);
    expect(() => projectHvpVegetation(products, [{ownerId:plant.id,position:{...moved,x:NaN},orientation:{x:0,y:0,z:0,w:1}}])).toThrow(/finite/);
    for(let cycle=0;cycle<20;cycle+=1) {
      const rendererDispose = vi.fn();
      const backend = new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:rendererDispose})});
      let transforms=before;
      const adapter=createHvpPresentationBackend(backend,()=>({position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},verticalFovDegrees:60,aspect:1,near:0.1,far:100}),representationKey("hvp:water"),()=>transforms);
      adapter.dispatch(createRenderCommand({kind:"InitializeBackend",backendRevision:backendRevision(0)}));
      for(const product of products) {
        adapter.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact:product.artifact,materialProfiles:product.profiles}));
      }
      expect(backend.representationRoot.children).toHaveLength(products.length);
      expect(backend.representationRoot.children.map((node)=>node.position.toArray())).toEqual(products.map(()=>[plant.position.x,plant.position.y,plant.position.z]));
      transforms=after;
      adapter.updateProjection();
      backend.scene.updateMatrixWorld(true);
      for (const node of backend.representationRoot.children) {
        const world=node.localToWorld(new Vector3(1,2,3));
        expect(world.toArray()).toEqual([moved.x-1,moved.y+2,moved.z-3]);
      }
      adapter.dispatch(createRenderCommand({kind:"DisposeBackend",backendRevision:backendRevision(0)}));
      adapter.dispatch(createRenderCommand({kind:"DisposeBackend",backendRevision:backendRevision(0)}));
      const diagnostics=backend.readDiagnostics();
      expect(diagnostics.geometryDisposals).toBe(diagnostics.geometryAllocations);
      expect(diagnostics.materialDisposals).toBe(diagnostics.materialAllocations);
      expect(backend.representationRoot.children).toHaveLength(0);
      expect(rendererDispose).toHaveBeenCalledTimes(1);
    }
  }, 120_000);

  it("reuses only an accepted identical projection core while refreshing visibility and invalidating uncertain references", () => {
    const plant = planHvpVegetation().find((p) => p.kind === "tree")!;
    const product = meshHvpVegetation(buildHvpPlant(plant))[0]!;
    const rendererDispose = vi.fn();
    const backend = new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:rendererDispose})});
    const originalDispatch = backend.dispatch.bind(backend);
    let alreadyAppliedNext = false, rejectProjectionNext = false;
    const dispatch = vi.spyOn(backend,"dispatch").mockImplementation(command=>{
      if(command.kind==="ApplyFrameProjection"&&alreadyAppliedNext){alreadyAppliedNext=false;return renderCommandResult("AlreadyApplied");}
      if(command.kind==="ApplyFrameProjection"&&rejectProjectionNext){rejectProjectionNext=false;return renderCommandResult("RejectedContentConflict","NotApplicable","InjectedProjectionFailure");}
      return originalDispatch(command);
    });
    const camera={position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},verticalFovDegrees:60,aspect:1,near:.1,far:100};
    const transform={representationKey:product.artifact.representationKey,positionRelative:{x:0,y:1,z:2},orientation:{x:0,y:0,z:0,w:1},scale:{x:1,y:1,z:1}};
    let transforms=[transform],cameraReads=0,transformReads=0;
    const adapter=createHvpPresentationBackend(backend,()=>{cameraReads++;return camera;},product.artifact.representationKey,()=>{transformReads++;return transforms;});
    const projectionCalls=()=>dispatch.mock.calls.filter(([command])=>command.kind==="ApplyFrameProjection");
    const visibilityCalls=()=>dispatch.mock.calls.filter(([command])=>command.kind==="ApplyVisibilityPlan");
    const publishAfter=(mutate:()=>void)=>{const before=projectionCalls().length;mutate();adapter.updateProjection();expect(projectionCalls()).toHaveLength(before+1);};
    try{
      adapter.dispatch(createRenderCommand({kind:"InitializeBackend",backendRevision:backendRevision(0)}));
      adapter.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact:product.artifact,materialProfiles:product.profiles}));
      const initialProjectionCount=projectionCalls().length,initialVisibilityCount=visibilityCalls().length;
      const readsBeforeNoop={camera:cameraReads,transforms:transformReads};
      adapter.updateProjection();
      expect(projectionCalls()).toHaveLength(initialProjectionCount);
      expect(visibilityCalls()).toHaveLength(initialVisibilityCount+1);
      expect(cameraReads).toBe(readsBeforeNoop.camera+1);
      expect(transformReads).toBe(readsBeforeNoop.transforms+1);
      const firstPlan=visibilityCalls().at(-1)![0];
      adapter.setWaterEnabled(false);
      expect(projectionCalls()).toHaveLength(initialProjectionCount);
      const hiddenPlan=visibilityCalls().at(-1)![0];
      if(firstPlan.kind!=="ApplyVisibilityPlan"||hiddenPlan.kind!=="ApplyVisibilityPlan")throw new Error("Visibility fixture did not publish plans");
      expect(hiddenPlan.plan.planRevision).toBeGreaterThan(firstPlan.plan.planRevision);
      expect(hiddenPlan.plan.hiddenRepresentationKeys).toContain(product.artifact.representationKey);
      adapter.setWaterEnabled(true);
      expect(projectionCalls()).toHaveLength(initialProjectionCount);

      publishAfter(()=>{camera.position.x=1;});
      publishAfter(()=>{camera.position.x=0;});
      publishAfter(()=>{camera.position.x=-0;});
      publishAfter(()=>{camera.position.y=1;});
      publishAfter(()=>{camera.position.z=2;});
      publishAfter(()=>{camera.orientation={x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2};});
      publishAfter(()=>{camera.orientation={x:Math.SQRT1_2,y:0,z:0,w:-Math.SQRT1_2};});
      publishAfter(()=>{camera.orientation={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2};});
      publishAfter(()=>{camera.orientation={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};});
      publishAfter(()=>{camera.verticalFovDegrees=61;});
      publishAfter(()=>{camera.aspect=1.1;});
      publishAfter(()=>{camera.near=.2;});
      publishAfter(()=>{camera.far=101;});
      publishAfter(()=>{transform.positionRelative.x=3;});
      publishAfter(()=>{transform.positionRelative.y=4;});
      publishAfter(()=>{transform.positionRelative.z=5;});
      publishAfter(()=>{transform.orientation={x:Math.SQRT1_2,y:0,z:0,w:Math.SQRT1_2};});
      publishAfter(()=>{transform.orientation={x:Math.SQRT1_2,y:0,z:0,w:-Math.SQRT1_2};});
      publishAfter(()=>{transform.orientation={x:0,y:Math.SQRT1_2,z:0,w:Math.SQRT1_2};});
      publishAfter(()=>{transform.orientation={x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2};});
      publishAfter(()=>{transform.scale.x=2;});
      publishAfter(()=>{transform.scale.y=3;});
      publishAfter(()=>{transform.scale.z=4;});
      const heldSnapshot=projectionCalls().at(-1)![0];
      if(heldSnapshot.kind!=="ApplyFrameProjection")throw new Error("Projection fixture did not publish a snapshot");
      const heldX=heldSnapshot.snapshot.representationTransforms[0]!.positionRelative.x;
      publishAfter(()=>{transform.positionRelative.x=6;});
      expect(heldSnapshot.snapshot.representationTransforms[0]!.positionRelative.x).toBe(heldX);
      const savedKey=transform.representationKey;
      publishAfter(()=>{transform.representationKey=representationKey("hvp:vegetation:other");});
      publishAfter(()=>{transform.representationKey=savedKey;});

      const memberArtifact=createMeshArtifact({...product.artifact,representationKey:representationKey("hvp:vegetation:extra-member")});
      const beforeMembership=projectionCalls().length;
      adapter.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact:memberArtifact,materialProfiles:product.profiles}));
      expect(projectionCalls()).toHaveLength(beforeMembership+1);
      adapter.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),representationKey:memberArtifact.representationKey,
        expectedSourceRevision:memberArtifact.sourceRevision,expectedArtifactRevision:memberArtifact.artifactRevision,expectedContentHash:memberArtifact.contentHash}));
      expect(projectionCalls()).toHaveLength(beforeMembership+2);

      const validX=camera.position.x,invalidCount=projectionCalls().length;
      camera.position.x=Number.NaN;
      expect(()=>adapter.updateProjection()).toThrow(/FrameProjectionSnapshot is invalid/);
      expect(projectionCalls()).toHaveLength(invalidCount);
      camera.position.x=validX;
      publishAfter(()=>{});

      alreadyAppliedNext=true;
      const beforeAlreadyApplied=projectionCalls().length;
      camera.position.z+=1;
      adapter.updateProjection();
      expect(projectionCalls()).toHaveLength(beforeAlreadyApplied+1);
      publishAfter(()=>{});
      rejectProjectionNext=true;
      const beforeRejected=projectionCalls().length;
      camera.position.z+=1;
      expect(()=>adapter.updateProjection()).toThrow(/HVP frame projection failed/);
      expect(projectionCalls()).toHaveLength(beforeRejected+1);
      publishAfter(()=>{});

      const acceptedProjection=projectionCalls().at(-1)![0];
      const forwardedCallIndex=projectionCalls().length;
      expect(adapter.dispatch(acceptedProjection).status).toBe("AlreadyApplied");
      const afterForwarded=projectionCalls().length;
      publishAfter(()=>{});
      expect(projectionCalls()).toHaveLength(afterForwarded+1);

      const beforeExplicitRelease=projectionCalls().length;
      adapter.releaseProjectionReference();
      publishAfter(()=>{});
      expect(projectionCalls()).toHaveLength(beforeExplicitRelease+1);

      const lastFrame=frameId("hvp:test:alternate-frame");
      const frameChangedArtifact=createMeshArtifact({...product.artifact,frameId:lastFrame,representationKey:representationKey("hvp:test:alternate-frame")});
      adapter.dispatch(createRenderCommand({kind:"RemoveRepresentation",backendRevision:backendRevision(0),representationKey:product.artifact.representationKey,
        expectedSourceRevision:product.artifact.sourceRevision,expectedArtifactRevision:product.artifact.artifactRevision,expectedContentHash:product.artifact.contentHash}));
      const beforeFrameChange=projectionCalls().length;
      adapter.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact:frameChangedArtifact,materialProfiles:product.profiles}));
      expect(projectionCalls()).toHaveLength(beforeFrameChange+1);
      const currentProjection=projectionCalls().at(-1)![0];
      if(currentProjection.kind!=="ApplyFrameProjection")throw new Error("Frame change did not publish a projection");
      expect(currentProjection.snapshot.frameId).toBe(lastFrame);
      const revisions=projectionCalls().filter((_,index)=>index!==forwardedCallIndex)
        .map(([command])=>command.kind==="ApplyFrameProjection"?command.snapshot.frameRevision:0);
      expect(revisions.every((revision,index)=>index===0||revision>revisions[index-1]!)).toBe(true);
      adapter.dispatch(createRenderCommand({kind:"ResetBackend",backendRevision:backendRevision(0),nextBackendRevision:backendRevision(1)}));
      const beforeResetRestore=projectionCalls().length;
      adapter.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(1),artifact:frameChangedArtifact,materialProfiles:product.profiles}));
      expect(projectionCalls()).toHaveLength(beforeResetRestore+1);
    }finally{
      adapter.releaseProjectionReference();
      const revision=backend.readDiagnostics().backendRevision;
      if(backend.readDiagnostics().backendState!=="Disposed")backend.dispatch(createRenderCommand({kind:"DisposeBackend",backendRevision:revision}));
    }
    expect(rendererDispose).toHaveBeenCalled();
  });

  it("T08 generates, admits and disposes the complete vegetation set over 20 cycles", () => {
    for (let cycle=0;cycle<20;cycle+=1) {
      const plants=planHvpVegetation();
      const products=plants.flatMap((p)=>meshHvpVegetation(buildHvpPlant(p)));
      expect(products.reduce((n,p)=>n+p.mesh.indices.length/3,0)).toBeLessThanOrEqual(280_520);
      expect(products.reduce((n,p)=>n+p.profiles.length,0)).toBeLessThanOrEqual(289);
      const rendererDispose=vi.fn();
      const backend=new ThreeRenderBackend({canvas:{} as HTMLCanvasElement,rendererFactory:()=>({setPixelRatio:()=>{},setSize:()=>{},render:()=>{},dispose:rendererDispose})});
      const transforms=projectHvpVegetation(products,plants.map((plant)=>({ownerId:plant.id,position:plant.position,orientation:{x:0,y:0,z:0,w:1}})));
      const adapter=createHvpPresentationBackend(backend,()=>({position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1},verticalFovDegrees:60,aspect:1,near:0.1,far:100}),representationKey("hvp:water"),()=>transforms);
      adapter.dispatch(createRenderCommand({kind:"InitializeBackend",backendRevision:backendRevision(0)}));
      for (const product of products) {
        adapter.dispatch(createRenderCommand({kind:"UpsertMeshArtifact",backendRevision:backendRevision(0),artifact:product.artifact,materialProfiles:product.profiles}));
      }
      expect(backend.representationRoot.children).toHaveLength(products.length);
      adapter.dispatch(createRenderCommand({kind:"DisposeBackend",backendRevision:backendRevision(0)}));
      const diagnostics=backend.readDiagnostics();
      expect(diagnostics.geometryDisposals).toBe(diagnostics.geometryAllocations);
      expect(diagnostics.materialDisposals).toBe(diagnostics.materialAllocations);
      expect(backend.representationRoot.children).toHaveLength(0);
      expect(rendererDispose).toHaveBeenCalledTimes(1);
    }
  }, 240_000);
});


it("W07 Factory vegetation retains every original owner except the exact two approved wood owners and uses coherent ground",()=>{
  const original=planHvpVegetation();
  const profile={version:"hvp-factory-vegetation-v1" as const,readColumn:(x:number,z:number)=>({topMeters:(x>=-10.75&&x< -1.75&&z>=-6.5&&z<12.5)?1.5:readHvpSourceColumnWorld(x,z).topMeters,slot:1})};
  const changed=planHvpVegetation(undefined,profile);
  expect(changed.map(p=>p.id)).toEqual(original.filter(p=>!p.id.endsWith("west-frame")&&!p.id.endsWith("north-young")).map(p=>p.id));
  expect(planHvpVegetation()).toEqual(original);
  for(const plant of changed)expect(plant.position.y).toBe(profile.readColumn(plant.position.x+.0625,plant.position.z+.0625).topMeters);
});
