import {
  CombatContractError,
  advanceWeaponRuntimeState,
  createCanonicalCombatEventSequence,
  createCombatTarget,
  createDamagePacketFromHit,
  deepFreeze,
  deriveCombatId,
  fireWeapon,
  resolveBeamHit,
  scale,
  add,
  type CombatEvent,
  type CombatTargetSnapshot,
  type RayDelivery,
  type WeaponFireEvent
} from "../../combat";
import {
  createSurfaceCombatSnapshot,
  createSurfaceRayQuery,
  type SurfaceCombatEventSummaryInput,
  type SurfaceFireRejectionCode,
  type SurfaceWeaponReadiness
} from "../contracts";
import {
  HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_DELAY_SECONDS,
  HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_JOULES_PER_SECOND,
  HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
  HESTIA_PULSE_CUTTER_TERRAIN_EDIT_RADIUS_METERS,
  HESTIA_PULSE_CUTTER_V1,
  createHestiaPulseCutterState
} from "./surfacePulseCutter";
import {
  alertSurfaceSurveyDrone,
  applySurfaceSurveyDroneDamage,
  createSurfaceSurveyDrone,
  createSurfaceSurveyDroneProxy,
  createSurfaceSurveyDroneTarget,
  type SurfaceSurveyDroneMode
} from "./surfaceSurveyDrone";
import {
  createSurfaceImpactIntent,
  type SurfaceCombatExecutionInput,
  type SurfaceCombatFireProbe,
  type SurfaceCombatRaycastCandidate,
  type SurfaceCombatRaycastRequest,
  type SurfaceCombatRuntimeResult,
  type SurfaceCombatRuntimeState,
  type SurfaceImpactIntent,
  type SurfaceTargetTerrainRaycastPort,
  type SurfaceTerrainRaycastPort
} from "./surfaceCombatContracts";

const EPSILON = 1e-9;

export const createSurfaceCombatRuntimeState = (
  frameId: string,
  dronePositionMeters = { x: 0, y: 1.5, z: 20 }
): Readonly<SurfaceCombatRuntimeState> => deepFreeze({
  weapon: createHestiaPulseCutterState(),
  drone: createSurfaceSurveyDrone(frameId, dronePositionMeters),
  energyRecoveryDelayRemainingSeconds: 0,
  nextSurfaceEventSequence: 0
});

export const advanceSurfaceCombatRuntime = (
  state: Readonly<SurfaceCombatRuntimeState>,
  elapsedSeconds: number
): Readonly<SurfaceCombatRuntimeState> => {
  const weapon = advanceWeaponRuntimeState(state.weapon, elapsedSeconds, HESTIA_PULSE_CUTTER_V1);
  const delayBefore = state.energyRecoveryDelayRemainingSeconds;
  const recoverySeconds = Math.max(0, elapsedSeconds - delayBefore);
  const energy = weapon.energy === null
    ? null
    : Math.min(
        HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
        weapon.energy + recoverySeconds * HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_JOULES_PER_SECOND
      );
  return deepFreeze({
    ...state,
    weapon: {
      ...weapon,
      energy
    },
    energyRecoveryDelayRemainingSeconds: Math.max(0, delayBefore - elapsedSeconds)
  });
};

export const deriveSurfaceCombatWeaponReadiness = (
  state: Readonly<SurfaceCombatRuntimeState>
): Readonly<SurfaceWeaponReadiness> => {
  const currentEnergyJoules = state.weapon.energy ?? 0;
  const requiredEnergyJoules = HESTIA_PULSE_CUTTER_V1.energyPerShot ?? 0;
  const energyReadyInSeconds = currentEnergyJoules < requiredEnergyJoules
    ? state.energyRecoveryDelayRemainingSeconds
      + (requiredEnergyJoules - currentEnergyJoules) / HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_JOULES_PER_SECOND
    : 0;
  const heat = state.weapon.heat ?? 0;
  const heatProfile = HESTIA_PULSE_CUTTER_V1.heat;
  const heatReadyInSeconds = heatProfile !== null && heat + heatProfile.heatPerShot > heatProfile.maximumHeat
    ? (heat + heatProfile.heatPerShot - heatProfile.maximumHeat) / heatProfile.coolingPerSecond
    : 0;
  const nextShotReadyInSeconds = Math.max(
    state.weapon.cooldownSeconds,
    energyReadyInSeconds,
    heatReadyInSeconds
  );

  if (state.weapon.cooldownSeconds > 0) {
    return deepFreeze({ kind: "Cooldown" as const, nextShotReadyInSeconds });
  }
  if (currentEnergyJoules < requiredEnergyJoules) {
    return deepFreeze({
      kind: "EnergyInsufficient" as const,
      currentEnergyJoules,
      requiredEnergyJoules,
      recoveryDelayRemainingSeconds: state.energyRecoveryDelayRemainingSeconds,
      recoveryRateJoulesPerSecond: HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_JOULES_PER_SECOND,
      nextShotReadyInSeconds
    });
  }
  if (heatReadyInSeconds > 0) {
    return deepFreeze({ kind: "Overheated" as const, nextShotReadyInSeconds });
  }
  return deepFreeze({ kind: "Ready" as const, nextShotReadyInSeconds: 0 as const });
};

const surfaceRejectionFor = (
  blocker: string | null
): SurfaceFireRejectionCode => {
  switch (blocker) {
    case "CooldownActive": return "Cooldown";
    case "EnergyInsufficient": return "InsufficientEnergy";
    case "Overheated": return "Overheated";
    case "TargetInvalid":
    case "NoTarget":
    case "OutOfRange":
    case "OutsideArc":
    case "NotAligned": return "InvalidTarget";
    default: return "AuthorityRefused";
  }
};

const targetCondition = (
  mode: SurfaceSurveyDroneMode
): "Operational" | "Damaged" | "Disabled" | "Destroyed" => {
  if (mode === "Destroyed") return "Destroyed";
  if (mode === "Damaged") return "Damaged";
  return "Operational";
};

const buildSnapshot = (
  state: Readonly<SurfaceCombatRuntimeState>,
  latestFireResult: Parameters<typeof createSurfaceCombatSnapshot>[0]["latestFireResult"],
  events: readonly SurfaceCombatEventSummaryInput[],
  simulationTick: number
) => createSurfaceCombatSnapshot({
  activeWeaponId: HESTIA_PULSE_CUTTER_V1.weaponId,
  energyJoules: state.weapon.energy ?? 0,
  maximumEnergyJoules: HESTIA_PULSE_CUTTER_MAXIMUM_ENERGY_JOULES,
  heatJoules: state.weapon.heat ?? 0,
  maximumHeatJoules: HESTIA_PULSE_CUTTER_V1.heat?.maximumHeat ?? 0,
  cooldownSeconds: state.weapon.cooldownSeconds,
  readiness: deriveSurfaceCombatWeaponReadiness(state),
  target: {
    targetId: state.drone.damageable.targetEntityId,
    condition: targetCondition(state.drone.mode),
    integrity: state.drone.damageable.armor.current + state.drone.damageable.hull.current,
    maximumIntegrity: state.drone.damageable.armor.maximum + state.drone.damageable.hull.maximum
  },
  latestFireResult,
  events,
  simulationTick
});

const surfaceEvent = (
  state: Readonly<SurfaceCombatRuntimeState>,
  offset: number,
  eventId: string,
  kind: SurfaceCombatEventSummaryInput["kind"],
  simulationTick: number
): SurfaceCombatEventSummaryInput => ({
  sequence: state.nextSurfaceEventSequence + offset,
  eventId,
  kind,
  simulationTick
});

const blockedResult = (
  input: SurfaceCombatExecutionInput,
  code: SurfaceFireRejectionCode,
  message: string
): Readonly<SurfaceCombatRuntimeResult> => {
  const eventId = deriveCombatId<string>("surface-fire-rejected", {
    commandId: input.command.commandId,
    code,
    tick: input.command.simulationTick
  });
  const events = [surfaceEvent(input.state, 0, eventId, "FireRejected", input.command.simulationTick)];
  const state = deepFreeze({
    ...input.state,
    nextSurfaceEventSequence: input.state.nextSurfaceEventSequence + events.length
  });
  return deepFreeze({
    kind: "BlockedFire" as const,
    state,
    snapshot: buildSnapshot(state, {
      status: "Rejected",
      commandId: input.command.commandId,
      code,
      message
    }, events, input.command.simulationTick),
    combatEvents: [],
    impactIntent: null,
    hitPointMeters: null,
    hitNormal: null
  });
};

const validateBinding = (
  input: SurfaceCombatExecutionInput
): Readonly<SurfaceCombatRuntimeResult> | null => {
  const frameId = input.binding.surfaceFrameId;
  if (
    input.player.surfaceFrameId !== frameId
    || input.command.surfaceFrameId !== frameId
    || String(input.pose.frameId) !== String(frameId)
    || input.state.drone.frameId !== frameId
  ) return blockedResult(input, "FrameMismatch", "Surface combat frame does not match the authoritative binding.");
  if (
    input.player.simulationTick !== input.command.simulationTick
    || input.binding.simulationTick !== input.command.simulationTick
  ) return blockedResult(input, "AuthorityRefused", "Surface combat tick does not match the authoritative binding.");
  if (input.player.playerId !== input.command.playerId) {
    return blockedResult(input, "AuthorityRefused", "Surface fire command player does not match the snapshot.");
  }
  return null;
};

const aimTarget = (
  kind: "terrain" | "structural" | "miss",
  ray: Readonly<RayDelivery>,
  position: Readonly<{ x: number; y: number; z: number }>
): Readonly<CombatTargetSnapshot> => createCombatTarget({
  targetId: `surface-aim:${kind}`,
  ownerId: "surface-owner:environment",
  frameId: ray.frameId,
  tick: ray.tick,
  position,
  velocity: { x: 0, y: 0, z: 0 },
  targetable: true,
  lifecycle: "Active"
});

const probeRay = (
  input: SurfaceCombatExecutionInput
): Readonly<RayDelivery> => deepFreeze({
  kind: "Beam" as const,
  sourceEntityId: input.pose.sourceEntityId,
  weaponId: HESTIA_PULSE_CUTTER_V1.weaponId,
  frameId: input.pose.frameId,
  tick: input.command.simulationTick,
  shotSequence: input.state.weapon.shotSequence + 1,
  origin: input.pose.muzzlePosition,
  direction: input.pose.muzzleDirection,
  maximumDistanceMeters: HESTIA_PULSE_CUTTER_V1.maximumRangeMeters,
  payload: {
    damageType: HESTIA_PULSE_CUTTER_V1.damageType,
    rawDamage: HESTIA_PULSE_CUTTER_V1.rawDamage
  }
});

const canonicalEvents = (
  events: readonly Readonly<CombatEvent>[]
): readonly Readonly<CombatEvent>[] => createCanonicalCombatEventSequence(events).events;

const fireEventFrom = (
  events: readonly Readonly<CombatEvent>[]
): Readonly<WeaponFireEvent> => {
  const event = events.find((candidate): candidate is WeaponFireEvent => candidate.phase === "WeaponFire");
  if (event === undefined) throw new Error("Accepted Pulse Cutter fire did not emit WeaponFire.");
  return event;
};

export const probeSurfaceCombatFire = (
  input: SurfaceCombatExecutionInput
): Readonly<SurfaceCombatFireProbe> => {
  const bindingRejection = validateBinding(input);
  if (bindingRejection !== null) {
    const fireResult = bindingRejection.snapshot.latestFireResult;
    if (fireResult?.status !== "Rejected") {
      throw new Error("Surface combat binding rejection has no rejection facts.");
    }
    return Object.freeze({
      kind: "Blocked" as const,
      code: fireResult.code,
      message: fireResult.message
    });
  }
  const ray = probeRay(input);
  return Object.freeze({
    kind: "Candidate" as const,
    ray,
    candidate: input.raycast.query({
      binding: input.binding,
      ray,
      targets: [createSurfaceSurveyDroneTarget(input.state.drone, input.command.simulationTick)],
      proxies: [createSurfaceSurveyDroneProxy(input.state.drone)]
    })
  });
};

export const executeSurfaceCombatFire = (
  input: SurfaceCombatExecutionInput
): Readonly<SurfaceCombatRuntimeResult> => {
  const probe = probeSurfaceCombatFire(input);
  if (probe.kind === "Blocked") return blockedResult(input, probe.code, probe.message);
  const { ray, candidate } = probe;
  if (candidate.kind === "Blocked") {
    return blockedResult(input, candidate.code, candidate.message);
  }
  if (candidate.kind === "DetachedBodyHit") {
    return blockedResult(
      input,
      "DetachedBodyImmutable",
      "Falling and resting Structural bodies are immutable in this Surface Play slice."
    );
  }
  if (candidate.kind === "StructuralPrepareHit") {
    return blockedResult(
      input,
      "AuthorityRefused",
      "Structural preparation is not an accepted combat fire."
    );
  }

  const target = candidate.kind === "CombatTargetHit"
    ? candidate.target
    : candidate.kind === "TerrainHit"
      ? aimTarget("terrain", ray, candidate.point)
      : candidate.kind === "StructuralHit"
        ? aimTarget("structural", ray, candidate.point)
        : aimTarget("miss", ray, add(ray.origin, scale(ray.direction, ray.maximumDistanceMeters)));
  const fired = fireWeapon({
    capability: HESTIA_PULSE_CUTTER_V1,
    state: input.state.weapon,
    pose: input.pose,
    target,
    tick: input.command.simulationTick,
    policy: {
      relation: candidate.kind === "CombatTargetHit" ? "Hostile" : "Neutral",
      friendlyFire: "Denied",
      permission: "Allowed"
    },
    lineOfFire: "Clear"
  });
  if (!fired.accepted || fired.delivery?.kind !== "Beam") {
    return blockedResult(
      input,
      surfaceRejectionFor(fired.evaluation.primaryReason),
      `Pulse Cutter fire blocked: ${fired.evaluation.primaryReason ?? "AuthorityRefused"}.`
    );
  }

  const fireEvent = fireEventFrom(fired.events);
  let drone = input.state.drone;
  let combatEvents: readonly Readonly<CombatEvent>[] = fired.events;
  let impactIntent: Readonly<SurfaceImpactIntent> | null = null;
  let hitPointMeters: Readonly<{ x: number; y: number; z: number }> | null = null;
  let hitNormal: Readonly<{ x: number; y: number; z: number }> | null = null;

  if (candidate.kind === "CombatTargetHit") {
    const resolved = resolveBeamHit(fired.delivery.ray, [candidate.proxy], input.command.simulationTick);
    if (resolved === null) throw new Error("Authoritative Combat proxy disappeared during same-tick Beam resolution.");
    const packet = createDamagePacketFromHit(resolved.hit, fired.delivery.ray.payload);
    const applied = applySurfaceSurveyDroneDamage(alertSurfaceSurveyDrone(drone), packet);
    drone = applied.drone;
    combatEvents = [...fired.events, resolved.event, ...applied.damage.events];
    hitPointMeters = resolved.hit.point;
    hitNormal = resolved.hit.normal;
  } else if (candidate.kind === "TerrainHit" || candidate.kind === "StructuralHit") {
    impactIntent = createSurfaceImpactIntent({
      sourceWeaponId: HESTIA_PULSE_CUTTER_V1.weaponId,
      fireEventId: fireEvent.eventId,
      frameId: input.pose.frameId,
      simulationTick: input.command.simulationTick,
      hitPointMeters: candidate.point,
      hitNormal: candidate.normal,
      energyDamageScalar: HESTIA_PULSE_CUTTER_V1.rawDamage,
      suggestedEditRadiusMeters: candidate.kind === "TerrainHit"
        ? HESTIA_PULSE_CUTTER_TERRAIN_EDIT_RADIUS_METERS
        : candidate.suggestedEditRadiusMeters
    });
    hitPointMeters = candidate.point;
    hitNormal = candidate.normal;
  }

  const orderedCombatEvents = canonicalEvents(combatEvents);
  const summaries: SurfaceCombatEventSummaryInput[] = [
    surfaceEvent(input.state, 0, fireEvent.eventId, "FireAccepted", input.command.simulationTick)
  ];
  for (const event of orderedCombatEvents) {
    if (event.phase === "DamageApplied") {
      summaries.push(surfaceEvent(input.state, summaries.length, event.eventId, "TargetDamaged", event.tick));
    } else if (event.phase === "TargetDestroyed") {
      summaries.push(surfaceEvent(input.state, summaries.length, event.eventId, "TargetDestroyed", event.tick));
    }
  }
  if (impactIntent !== null) {
    if (candidate.kind === "TerrainHit") {
      summaries.push(surfaceEvent(input.state, summaries.length, impactIntent.intentId, "TerrainHit", input.command.simulationTick));
    } else if (candidate.kind === "StructuralHit") {
      summaries.push(surfaceEvent(
        input.state,
        summaries.length,
        deriveCombatId<string>("surface-structural-hit", {
          fireEventId: fireEvent.eventId,
          objectId: candidate.objectId,
          structuralCommandId: candidate.structuralCommandId
        }),
        "StructuralHit",
        input.command.simulationTick
      ));
      summaries.push(surfaceEvent(
        input.state,
        summaries.length,
        deriveCombatId<string>("surface-structural-damaged", {
          fireEventId: fireEvent.eventId,
          objectId: candidate.objectId,
          structuralCommandId: candidate.structuralCommandId
        }),
        "StructuralDamaged",
        input.command.simulationTick
      ));
      if (candidate.supportResult === "Detached") {
        summaries.push(surfaceEvent(
          input.state,
          summaries.length,
          deriveCombatId<string>("surface-structural-detached", {
            fireEventId: fireEvent.eventId,
            objectId: candidate.objectId,
            structuralCommandId: candidate.structuralCommandId
          }),
          "StructuralDetached",
          input.command.simulationTick
        ));
      }
    }
  }

  const state = deepFreeze({
    weapon: fired.state,
    drone,
    energyRecoveryDelayRemainingSeconds: HESTIA_PULSE_CUTTER_ENERGY_RECOVERY_DELAY_SECONDS,
    nextSurfaceEventSequence: input.state.nextSurfaceEventSequence + summaries.length
  });
  const hit = candidate.kind === "CombatTargetHit"
    ? "Target"
    : candidate.kind === "TerrainHit"
      ? "Terrain"
      : candidate.kind === "StructuralHit"
        ? "Structural"
        : "None";
  return deepFreeze({
    kind: candidate.kind,
    state,
    snapshot: buildSnapshot(state, {
      status: "Accepted",
      commandId: input.command.commandId,
      hit
    }, summaries, input.command.simulationTick),
    combatEvents: orderedCombatEvents,
    impactIntent,
    hitPointMeters,
    hitNormal
  });
};

const rejectionFromTerrain = (
  code: string
): "FrameMismatch" | "StaleRevision" | "AuthorityRefused" => {
  if (code === "FrameMismatch") return "FrameMismatch";
  if (code === "StaleRevision") return "StaleRevision";
  return "AuthorityRefused";
};

export const createCombatCoreSurfaceRaycastPort = (
  terrain: SurfaceTerrainRaycastPort
): SurfaceTargetTerrainRaycastPort => ({
  query: (request: Readonly<SurfaceCombatRaycastRequest>): SurfaceCombatRaycastCandidate => {
    const activeTargets = new Map(
      request.targets
        .filter((target) => target.targetable && target.lifecycle === "Active" && target.frameId === request.ray.frameId)
        .map((target) => [target.targetId, target])
    );
    const validProxies = request.proxies.filter((proxy) => activeTargets.has(proxy.entityId));
    let combatHit: ReturnType<typeof resolveBeamHit>;
    try {
      combatHit = resolveBeamHit(request.ray, validProxies, request.binding.simulationTick);
    } catch (error) {
      if (error instanceof CombatContractError) {
        return deepFreeze({
          kind: "Blocked" as const,
          code: error.code === "FrameMismatch" ? "FrameMismatch" as const : "AuthorityRefused" as const,
          message: error.message
        });
      }
      throw error;
    }
    const terrainResult = terrain.queryTerrain(request.binding, request.ray);
    if (terrainResult.status === "Rejected") {
      return deepFreeze({
        kind: "Blocked" as const,
        code: rejectionFromTerrain(terrainResult.code),
        message: terrainResult.message
      });
    }
    const terrainContact = terrainResult.contact;
    if (
      combatHit !== null
      && (terrainContact === null || combatHit.hit.distanceMeters <= terrainContact.distanceMeters + EPSILON)
    ) {
      const target = activeTargets.get(combatHit.hit.targetEntityId);
      const proxy = validProxies.find((candidate) => candidate.proxyId === combatHit?.hit.proxyId);
      if (target === undefined || proxy === undefined) {
        return deepFreeze({
          kind: "Blocked" as const,
          code: "AuthorityRefused" as const,
          message: "Combat hit did not resolve to the supplied authoritative target/proxy."
        });
      }
      return deepFreeze({
        kind: "CombatTargetHit" as const,
        target,
        proxy,
        point: combatHit.hit.point,
        normal: combatHit.hit.normal,
        distanceMeters: combatHit.hit.distanceMeters
      });
    }
    if (terrainContact !== null) {
      return deepFreeze({
        kind: "TerrainHit" as const,
        colliderId: terrainContact.colliderId,
        point: terrainContact.pointMeters,
        normal: terrainContact.normal,
        distanceMeters: terrainContact.distanceMeters
      });
    }
    return deepFreeze({ kind: "Miss" as const });
  }
});

export const createSurfaceTerrainRaycastAdapter = (
  queryRay: (query: ReturnType<typeof createSurfaceRayQuery>) => ReturnType<SurfaceTerrainRaycastPort["queryTerrain"]>
): SurfaceTerrainRaycastPort => ({
  queryTerrain: (binding, ray) => queryRay(createSurfaceRayQuery({
    ...binding,
    queryId: deriveCombatId<string>("surface-ray-query", {
      frameId: ray.frameId,
      tick: ray.tick,
      origin: ray.origin,
      direction: ray.direction,
      maximumDistanceMeters: ray.maximumDistanceMeters
    }),
    kind: "Ray",
    originMeters: ray.origin,
    direction: ray.direction,
    maximumDistanceMeters: ray.maximumDistanceMeters
  }))
});
