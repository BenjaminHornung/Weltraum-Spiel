import { describe, expect, it } from "vitest";
import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  SurfacePlayContractError,
  createSurfaceCapsuleSweepResult,
  createSurfaceCapsuleSweepQuery,
  createSurfaceCombatSnapshot,
  createSurfaceGroundContactResult,
  createSurfaceGroundContactQuery,
  createSurfaceImpactPresentationSnapshot,
  createSurfaceLineResult,
  createSurfaceLineQuery,
  createSurfacePlayHudSnapshot,
  createSurfacePlayIdentity,
  createSurfacePlayerCommand,
  createSurfacePlayerPresentationSnapshot,
  createSurfacePlayerSnapshot,
  createSurfaceRayResult,
  createSurfaceRayQuery,
  createSurfaceTargetPresentationSnapshot,
  createSurfaceTerrainPresentationSnapshot,
  createSurfaceVoxelEditRequest,
  createSurfaceVoxelEditResult,
  createSurfaceWeaponPresentationSnapshot,
  type SurfaceCollisionQueryPort,
  type SurfacePlayPresentationPorts
} from "../../src/surface-play/contracts";

const binding = {
  bodyId: "body.hestia",
  regionId: "region.hestia.landing",
  surfaceFrameId: "frame.surface.hestia.landing",
  regionRevision: 4,
  simulationTick: 120
} as const;

const capsule = { radiusMeters: 0.35, heightMeters: 1.8 };

describe("surface-play contracts", () => {
  it("creates stable immutable region identity and player snapshots with defensive nested copies", () => {
    const identityInput = {
      bodyId: binding.bodyId,
      surfaceFrameId: binding.surfaceFrameId,
      regionId: binding.regionId,
      generatorVersion: "hestia.microvoxel.generator.v1",
      seed: "Hestia.Surface.Play.V1",
      regionRevision: binding.regionRevision
    };
    const first = createSurfacePlayIdentity(identityInput);
    const second = createSurfacePlayIdentity({ ...identityInput });
    expect(first).toEqual(second);
    expect(first.canonicalIdentity).toMatch(/^surface_region:[0-9a-f]{16}$/);
    expect(Object.isFrozen(first)).toBe(true);

    const positionMeters = { x: 1, y: 2, z: 3 };
    const inputCapsule = { ...capsule };
    const player = createSurfacePlayerSnapshot({
      playerId: "player.hestia.surveyor",
      surfaceFrameId: binding.surfaceFrameId,
      positionMeters,
      velocityMetersPerSecond: { x: 0, y: 0, z: 1 },
      yawRadians: 0.5,
      pitchRadians: -0.1,
      grounded: true,
      movementMode: "Walk",
      capsule: inputCapsule,
      simulationTick: binding.simulationTick
    });
    positionMeters.x = 99;
    inputCapsule.heightMeters = 99;
    expect(player.positionMeters.x).toBe(1);
    expect(player.capsule.heightMeters).toBe(1.8);
    expect(Object.isFrozen(player.positionMeters)).toBe(true);
    expect(Object.isFrozen(player.capsule)).toBe(true);
  });

  it("represents optional crouch explicitly and gives equal commands equal canonical identity", () => {
    const input = {
      playerId: "player.hestia.surveyor",
      surfaceFrameId: binding.surfaceFrameId,
      simulationTick: binding.simulationTick,
      moveAxes: { forward: 1, right: -0.25 },
      lookDeltaRadians: { yaw: 0.01, pitch: -0.02 },
      sprint: true,
      crouch: null,
      jump: false,
      fire: true,
      pointerLockIntent: "Request" as const,
      reset: "None" as const
    };
    const first = createSurfacePlayerCommand(input);
    const second = createSurfacePlayerCommand({ ...input, moveAxes: { ...input.moveAxes }, lookDeltaRadians: { ...input.lookDeltaRadians } });
    expect(first.commandId).toBe(second.commandId);
    expect(first.commandId).toMatch(/^surface_command:[0-9a-f]{16}$/);
    expect(first.crouch).toBeNull();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.moveAxes)).toBe(true);
  });

  it("binds ground, deterministic sweep, ray, and line queries to body/region/frame/revision/tick", () => {
    const ground = createSurfaceGroundContactQuery({
      ...binding,
      queryId: "query.ground.120",
      kind: "GroundContact",
      capsule,
      positionMeters: { x: 0, y: 2, z: 0 },
      maximumDistanceMeters: 0.2
    });
    const sweep = createSurfaceCapsuleSweepQuery({
      ...binding,
      queryId: "query.sweep.120",
      kind: "CapsuleSweep",
      capsule,
      startPositionMeters: { x: 0, y: 2, z: 0 },
      displacementMeters: { x: 0.1, y: -0.05, z: 0 }
    });
    const ray = createSurfaceRayQuery({
      ...binding,
      queryId: "query.ray.120",
      kind: "Ray",
      originMeters: { x: 0, y: 1.6, z: 0 },
      direction: { x: 0, y: 0, z: -1 },
      maximumDistanceMeters: 100
    });
    const line = createSurfaceLineQuery({
      ...binding,
      queryId: "query.line.120",
      kind: "Line",
      startMeters: { x: 0, y: 1, z: 0 },
      endMeters: { x: 0, y: 1, z: -10 }
    });
    for (const query of [ground, sweep, ray, line]) {
      expect(query).toMatchObject(binding);
      expect(Object.isFrozen(query)).toBe(true);
    }
  });

  it("projects combat state and ordered events without becoming damage authority", () => {
    const combat = createSurfaceCombatSnapshot({
      activeWeaponId: "weapon.pulse.cutter",
      energyJoules: 80,
      maximumEnergyJoules: 100,
      heatJoules: 10,
      maximumHeatJoules: 50,
      cooldownSeconds: 0.25,
      target: { targetId: "target.drone.survey.1", condition: "Damaged", integrity: 30, maximumIntegrity: 50 },
      latestFireResult: { status: "Accepted", commandId: "surface_command:0123456789abcdef", hit: "Target" },
      events: [
        { sequence: 1, eventId: "event.fire.1", kind: "FireAccepted", simulationTick: 119 },
        { sequence: 2, eventId: "event.damage.1", kind: "TargetDamaged", simulationTick: 120 }
      ],
      simulationTick: 120
    });
    expect(combat.target?.condition).toBe("Damaged");
    expect(combat.events.map((event) => event.sequence)).toEqual([1, 2]);
    expect(Object.isFrozen(combat.events)).toBe(true);
    expect(Object.isFrozen(combat.target)).toBe(true);
  });

  it("constrains voxel edits to quantized SubtractSphere and exact result discriminants", () => {
    const request = createSurfaceVoxelEditRequest({
      ...binding,
      commandId: "edit.pulse.120",
      operation: "SubtractSphere",
      centerQuantum: { x: 8, y: -2, z: 16 },
      quantumMeters: MICROVOXEL_BASE_QUANTUM_METERS,
      radiusMeters: 0.5
    });
    expect(request.operation).toBe("SubtractSphere");
    expect(Object.isFrozen(request.centerQuantum)).toBe(true);

    const applied = createSurfaceVoxelEditResult({
      status: "Applied",
      commandId: request.commandId,
      changedBrickIds: ["brick.hestia.001", "brick.hestia.002"],
      resultingRegionRevision: 5,
      resultingRegionHash: "fnv1a64-v1:0123456789abcdef"
    });
    const noChange = createSurfaceVoxelEditResult({
      status: "NoChange",
      commandId: request.commandId,
      changedBrickIds: [],
      resultingRegionRevision: 4,
      resultingRegionHash: "fnv1a64-v1:0123456789abcdef"
    });
    const rejected = createSurfaceVoxelEditResult({
      status: "Rejected",
      commandId: request.commandId,
      code: "StaleRevision",
      message: "Terrain changed before the edit was applied."
    });
    expect(applied).toMatchObject({ status: "Applied", changedBrickIds: ["brick.hestia.001", "brick.hestia.002"] });
    expect(noChange).toMatchObject({ status: "NoChange", changedBrickIds: [] });
    expect(rejected).toEqual({
      status: "Rejected",
      commandId: request.commandId,
      code: "StaleRevision",
      message: "Terrain changed before the edit was applied."
    });
    expect("resultingRegionRevision" in rejected).toBe(false);
    expect("resultingRegionHash" in rejected).toBe(false);
  });

  it("fails closed with typed errors for non-finite values, unsafe counters, invalid IDs, and invalid voxel receipts", () => {
    const expectError = (operation: () => unknown, code: string, path: string): void => {
      try {
        operation();
        throw new Error("Expected SurfacePlayContractError.");
      } catch (error) {
        expect(error).toBeInstanceOf(SurfacePlayContractError);
        expect((error as SurfacePlayContractError).code).toBe(code);
        expect((error as SurfacePlayContractError).path).toBe(path);
      }
    };
    expectError(() => createSurfacePlayIdentity({
      bodyId: "INVALID ID",
      surfaceFrameId: binding.surfaceFrameId,
      regionId: binding.regionId,
      generatorVersion: "hestia.microvoxel.generator.v1",
      seed: "seed",
      regionRevision: 0
    }), "InvalidIdentity", "identity.bodyId");
    expectError(() => createSurfacePlayerSnapshot({
      playerId: "player.hestia.surveyor",
      surfaceFrameId: binding.surfaceFrameId,
      positionMeters: { x: Number.NaN, y: 0, z: 0 },
      velocityMetersPerSecond: { x: 0, y: 0, z: 0 },
      yawRadians: 0,
      pitchRadians: 0,
      grounded: true,
      movementMode: "Walk",
      capsule,
      simulationTick: 0
    }), "InvalidNumber", "player.positionMeters.x");
    expectError(() => createSurfacePlayerCommand({
      playerId: "player.hestia.surveyor",
      surfaceFrameId: binding.surfaceFrameId,
      simulationTick: Number.MAX_SAFE_INTEGER + 1,
      moveAxes: { forward: 0, right: 0 },
      lookDeltaRadians: { yaw: 0, pitch: 0 },
      sprint: false,
      crouch: false,
      jump: false,
      fire: false,
      pointerLockIntent: "Unchanged",
      reset: "RecoveryOnly"
    }), "InvalidTick", "command.simulationTick");
    expectError(() => createSurfaceVoxelEditResult({
      status: "Applied",
      commandId: "edit.pulse.120",
      changedBrickIds: ["brick.hestia.002", "brick.hestia.001"],
      resultingRegionRevision: 5,
      resultingRegionHash: "fnv1a64-v1:0123456789abcdef"
    }), "InvalidVoxelEditResult", "voxelEditResult.changedBrickIds");
    expectError(() => createSurfaceVoxelEditResult({
      status: "NoChange",
      commandId: "edit.pulse.120",
      changedBrickIds: [],
      resultingRegionRevision: 5,
      resultingRegionHash: "fnv1a64:0123456789abcdef"
    }), "InvalidHash", "voxelEditResult.resultingRegionHash");
    expectError(() => createSurfaceRayQuery({
      ...binding,
      queryId: "query.ray.non-unit",
      kind: "Ray",
      originMeters: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: -2 },
      maximumDistanceMeters: 1
    }), "InvalidVector", "rayQuery.direction");
  });

  it("rejects sparse, accessor-backed, non-array, and oversized boundary collections", () => {
    const combatInput = {
      activeWeaponId: "weapon.pulse.cutter",
      energyJoules: 1,
      maximumEnergyJoules: 1,
      heatJoules: 0,
      maximumHeatJoules: 1,
      cooldownSeconds: 0,
      target: null,
      latestFireResult: null,
      events: [],
      simulationTick: 1
    };
    const voxelInput = {
      status: "Applied" as const,
      commandId: "edit.pulse.120",
      changedBrickIds: ["brick.hestia.001"],
      resultingRegionRevision: 5,
      resultingRegionHash: "fnv1a64-v1:0123456789abcdef"
    };
    const sparse = new Array(1);
    const accessor: unknown[] = [];
    Object.defineProperty(accessor, "0", { enumerable: true, get: () => "must.not.run" });
    accessor.length = 1;
    expect(() => createSurfaceCombatSnapshot({ ...combatInput, events: sparse } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceCombatSnapshot({ ...combatInput, events: accessor } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceCombatSnapshot({ ...combatInput, events: {} } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceVoxelEditResult({ ...voxelInput, changedBrickIds: sparse } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceVoxelEditResult({ ...voxelInput, changedBrickIds: accessor } as never)).toThrow(SurfacePlayContractError);
    expect(() => createSurfaceVoxelEditResult({ ...voxelInput, changedBrickIds: new Array(4097).fill("brick.hestia.001") } as never))
      .toThrow(SurfacePlayContractError);
  });

  it("creates owned immutable collision results and all presentation snapshots", () => {
    const contact = {
      pointMeters: { x: 1, y: 2, z: 3 },
      normal: { x: 0, y: 1, z: 0 },
      distanceMeters: 0.25,
      colliderId: "terrain.hestia.001"
    };
    const ground = createSurfaceGroundContactResult({ status: "Resolved", queryId: "query.ground.1", contact });
    const sweep = createSurfaceCapsuleSweepResult({ status: "Resolved", queryId: "query.sweep.1", fraction: 0.5, contact });
    const ray = createSurfaceRayResult({ status: "Resolved", queryId: "query.ray.1", contact });
    const line = createSurfaceLineResult({
      status: "Rejected",
      queryId: "query.line.1",
      code: "StaleRevision",
      message: "Terrain authority revision changed."
    });
    contact.pointMeters.x = 99;
    if (ground.status !== "Resolved") throw new Error("Expected resolved ground contact.");
    expect(ground.contact?.pointMeters.x).toBe(1);
    for (const result of [ground, sweep, ray, line]) expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(ground.contact?.normal)).toBe(true);

    const position = { x: 1, y: 2, z: 3 };
    const visibleBrickIds = ["brick.hestia.001"];
    const playerPresentation = createSurfacePlayerPresentationSnapshot({
      playerId: "player.hestia.surveyor", surfaceFrameId: binding.surfaceFrameId, positionMeters: position,
      yawRadians: 0, pitchRadians: 0, movementMode: "Walk"
    });
    const terrainPresentation = createSurfaceTerrainPresentationSnapshot({ ...binding, visibleBrickIds });
    const presentations = [
      playerPresentation,
      terrainPresentation,
      createSurfaceTargetPresentationSnapshot({
        targetId: "target.hestia.001", surfaceFrameId: binding.surfaceFrameId, positionMeters: position, condition: "Operational"
      }),
      createSurfaceWeaponPresentationSnapshot({
        weaponId: "weapon.pulse.cutter", ownerPlayerId: "player.hestia.surveyor", surfaceFrameId: binding.surfaceFrameId,
        muzzlePositionMeters: position, cooldownSeconds: 0, firing: false
      }),
      createSurfaceImpactPresentationSnapshot({
        impactId: "impact.hestia.001", surfaceFrameId: binding.surfaceFrameId, positionMeters: position,
        normal: { x: 0, y: 1, z: 0 }, kind: "Terrain", simulationTick: binding.simulationTick
      })
    ];
    position.x = 99;
    visibleBrickIds[0] = "brick.hestia.changed";
    for (const snapshot of presentations) expect(Object.isFrozen(snapshot)).toBe(true);
    expect(playerPresentation.positionMeters.x).toBe(1);
    expect(terrainPresentation.visibleBrickIds).toEqual(["brick.hestia.001"]);

    let getterInvoked = false;
    const accessorResult = {};
    Object.defineProperty(accessorResult, "status", {
      enumerable: true,
      get: () => {
        getterInvoked = true;
        return "Resolved";
      }
    });
    expect(() => createSurfaceRayResult(accessorResult as never)).toThrow(SurfacePlayContractError);
    expect(getterInvoked).toBe(false);

    class PresentationInput {
      public readonly playerId = "player.hestia.surveyor";
      public readonly surfaceFrameId = binding.surfaceFrameId;
      public readonly positionMeters = { x: 0, y: 0, z: 0 };
      public readonly yawRadians = 0;
      public readonly pitchRadians = 0;
      public readonly movementMode = "Walk" as const;
    }
    expect(() => createSurfacePlayerPresentationSnapshot(new PresentationInput())).toThrow(SurfacePlayContractError);
  });

  it("keeps HUD player-facing and presentation/collision ports renderer-independent", () => {
    const hud = createSurfacePlayHudSnapshot({
      mode: "SurfaceFirstPerson",
      movementMode: "Walk",
      grounded: true,
      energyJoules: 80,
      maximumEnergyJoules: 100,
      heatJoules: 10,
      maximumHeatJoules: 50,
      cooldownSeconds: 0,
      targetCondition: "Operational",
      latestAction: "Pulse Cutter ready",
      latestBlock: null
    });
    const forbidden = ["worker", "queue", "hash", "brick", "revision", "debug"];
    expect(Object.keys(hud).some((key) => forbidden.some((term) => key.toLowerCase().includes(term)))).toBe(false);
    expect(Object.isFrozen(hud)).toBe(true);

    const collisionPort: SurfaceCollisionQueryPort = {
      queryGroundContact: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
      sweepCapsule: (query) => ({ status: "Resolved", queryId: query.queryId, fraction: 1, contact: null }),
      queryRay: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null }),
      queryLine: (query) => ({ status: "Resolved", queryId: query.queryId, contact: null })
    };
    const presentation: SurfacePlayPresentationPorts = {
      presentPlayer: () => undefined,
      presentTerrain: () => undefined,
      presentTarget: () => undefined,
      presentWeapon: () => undefined,
      presentImpact: () => undefined
    };
    expect(Object.keys(collisionPort).sort()).toEqual(["queryGroundContact", "queryLine", "queryRay", "sweepCapsule"]);
    expect(Object.keys(presentation).sort()).toEqual(["presentImpact", "presentPlayer", "presentTarget", "presentTerrain", "presentWeapon"]);
  });
});
