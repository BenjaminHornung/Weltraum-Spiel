import {
  CombatContractError,
  MODULE_STATUSES,
  canonicalCombatJson,
  combatHash,
  createHitResult,
  deepFreeze,
  deriveCombatId,
  lexicalCompare,
  nonNegative,
  parseCombatId,
  safeInteger,
  tick as parseTick,
  vec3,
  type DamagePacket,
  type EntityId,
  type EventId,
  type FrameId,
  type HitResult,
  type ModuleId,
  type ModuleStatus,
  type ProjectileId,
  type Vec3,
  type WeaponId
} from "./contracts";

export const COMBAT_EVENT_PHASES = ["WeaponFire", "ProjectileSpawned", "ProjectileExpired", "Hit", "DamageApplied", "ModuleStateChanged", "TargetDestroyed"] as const;
export type CombatEventPhase = typeof COMBAT_EVENT_PHASES[number];

interface CombatEventBase {
  readonly eventId: EventId;
  readonly phase: CombatEventPhase;
  readonly tick: number;
  readonly sourceEntityId: EntityId | null;
  readonly targetEntityId: EntityId | null;
  readonly weaponId: WeaponId | null;
  readonly projectileId: ProjectileId | null;
  readonly moduleId: ModuleId | null;
}
export interface WeaponFireEvent extends CombatEventBase { readonly phase: "WeaponFire"; readonly shotSequence: number }
export interface ProjectileSpawnedEvent extends CombatEventBase { readonly phase: "ProjectileSpawned"; readonly frameId: FrameId; readonly position: Readonly<Vec3> }
export interface ProjectileExpiredEvent extends CombatEventBase { readonly phase: "ProjectileExpired"; readonly frameId: FrameId; readonly position: Readonly<Vec3>; readonly reason: "Lifetime" | "Range" }
export interface HitEvent extends CombatEventBase { readonly phase: "Hit"; readonly hit: Readonly<HitResult> }
export interface DamageAppliedEvent extends CombatEventBase { readonly phase: "DamageApplied"; readonly packetId: string; readonly armorDamage: number; readonly hullDamage: number; readonly moduleDamage: number }
export interface ModuleStateChangedEvent extends CombatEventBase { readonly phase: "ModuleStateChanged"; readonly previousStatus: ModuleStatus; readonly currentStatus: ModuleStatus }
export interface TargetDestroyedEvent extends CombatEventBase { readonly phase: "TargetDestroyed"; readonly packetId: string }
export type CombatEvent = WeaponFireEvent | ProjectileSpawnedEvent | ProjectileExpiredEvent | HitEvent | DamageAppliedEvent | ModuleStateChangedEvent | TargetDestroyedEvent;

type EventWithoutId<T extends CombatEvent> = Omit<T, "eventId">;
const createEvent = <T extends CombatEvent>(event: EventWithoutId<T>): Readonly<T> => {
  const normalized = {
    ...event,
    tick: parseTick(event.tick, "event.tick"),
    sourceEntityId: event.sourceEntityId === null ? null : parseCombatId<EntityId>(event.sourceEntityId, "event.sourceEntityId"),
    targetEntityId: event.targetEntityId === null ? null : parseCombatId<EntityId>(event.targetEntityId, "event.targetEntityId"),
    weaponId: event.weaponId === null ? null : parseCombatId<WeaponId>(event.weaponId, "event.weaponId"),
    projectileId: event.projectileId === null ? null : parseCombatId<ProjectileId>(event.projectileId, "event.projectileId"),
    moduleId: event.moduleId === null ? null : parseCombatId<ModuleId>(event.moduleId, "event.moduleId")
  };
  const eventId = deriveCombatId<EventId>("event", normalized);
  return deepFreeze({ ...normalized, eventId } as T);
};

const requiredId = <T extends string>(value: unknown, path: string): T => parseCombatId<T>(value, path);
const requiredNull = (value: unknown, path: string): null => {
  if (value !== null) throw new CombatContractError("InvalidEventIdentity", path, "must be null for this event phase.");
  return null;
};
const moduleStatus = (value: unknown, path: string): ModuleStatus => {
  if (typeof value !== "string" || !MODULE_STATUSES.includes(value as ModuleStatus)) throw new CombatContractError("InvalidEnum", path, "must be a valid Module status.");
  return value as ModuleStatus;
};

export const createWeaponFireEvent = (input: Omit<WeaponFireEvent, "eventId" | "phase">): Readonly<WeaponFireEvent> => createEvent<WeaponFireEvent>({
  tick: input.tick,
  sourceEntityId: requiredId<EntityId>(input.sourceEntityId, "event.sourceEntityId"), targetEntityId: requiredId<EntityId>(input.targetEntityId, "event.targetEntityId"),
  weaponId: requiredId<WeaponId>(input.weaponId, "event.weaponId"), projectileId: requiredNull(input.projectileId, "event.projectileId"),
  moduleId: requiredNull(input.moduleId, "event.moduleId"), shotSequence: safeInteger(input.shotSequence, "event.shotSequence"), phase: "WeaponFire"
});
export const createProjectileSpawnedEvent = (input: Omit<ProjectileSpawnedEvent, "eventId" | "phase">): Readonly<ProjectileSpawnedEvent> => createEvent<ProjectileSpawnedEvent>({
  tick: input.tick,
  sourceEntityId: requiredId<EntityId>(input.sourceEntityId, "event.sourceEntityId"), targetEntityId: requiredId<EntityId>(input.targetEntityId, "event.targetEntityId"),
  weaponId: requiredId<WeaponId>(input.weaponId, "event.weaponId"), projectileId: requiredId<ProjectileId>(input.projectileId, "event.projectileId"),
  moduleId: requiredNull(input.moduleId, "event.moduleId"), frameId: parseCombatId<FrameId>(input.frameId, "event.frameId"), position: vec3(input.position, "event.position"), phase: "ProjectileSpawned"
});
export const createProjectileExpiredEvent = (input: Omit<ProjectileExpiredEvent, "eventId" | "phase">): Readonly<ProjectileExpiredEvent> => {
  if (input.reason !== "Lifetime" && input.reason !== "Range") throw new CombatContractError("InvalidEnum", "event.reason", "must be Lifetime or Range.");
  return createEvent<ProjectileExpiredEvent>({
    tick: input.tick, targetEntityId: requiredNull(input.targetEntityId, "event.targetEntityId"),
    sourceEntityId: requiredId<EntityId>(input.sourceEntityId, "event.sourceEntityId"), weaponId: requiredId<WeaponId>(input.weaponId, "event.weaponId"),
    projectileId: requiredId<ProjectileId>(input.projectileId, "event.projectileId"), moduleId: requiredNull(input.moduleId, "event.moduleId"), frameId: parseCombatId<FrameId>(input.frameId, "event.frameId"),
    position: vec3(input.position, "event.position"), reason: input.reason, phase: "ProjectileExpired"
  });
};
export const createHitEvent = (hitInput: Readonly<HitResult>): Readonly<HitEvent> => {
  const hit = createHitResult(hitInput);
  return createEvent<HitEvent>({
    phase: "Hit", tick: hit.tick, sourceEntityId: hit.sourceEntityId, targetEntityId: hit.targetEntityId,
    weaponId: hit.weaponId, projectileId: hit.projectileId, moduleId: hit.moduleId, hit
  });
};
export const createDamageAppliedEvent = (packet: Readonly<DamagePacket>, armorDamage: number, hullDamage: number, moduleDamage: number): Readonly<DamageAppliedEvent> => createEvent<DamageAppliedEvent>({
  phase: "DamageApplied", tick: packet.tick, sourceEntityId: requiredId<EntityId>(packet.sourceEntityId, "event.sourceEntityId"), targetEntityId: requiredId<EntityId>(packet.targetEntityId, "event.targetEntityId"),
  weaponId: requiredId<WeaponId>(packet.weaponId, "event.weaponId"), projectileId: null, moduleId: packet.moduleId, packetId: parseCombatId(packet.packetId, "event.packetId"), armorDamage: nonNegative(armorDamage, "event.armorDamage"), hullDamage: nonNegative(hullDamage, "event.hullDamage"), moduleDamage: nonNegative(moduleDamage, "event.moduleDamage")
});
export const createModuleStateChangedEvent = (packet: Readonly<DamagePacket>, previousStatus: ModuleStatus, currentStatus: ModuleStatus): Readonly<ModuleStateChangedEvent> => {
  const moduleId = requiredId<ModuleId>(packet.moduleId, "event.moduleId");
  return createEvent<ModuleStateChangedEvent>({
    phase: "ModuleStateChanged", tick: packet.tick, sourceEntityId: requiredId<EntityId>(packet.sourceEntityId, "event.sourceEntityId"), targetEntityId: requiredId<EntityId>(packet.targetEntityId, "event.targetEntityId"),
    weaponId: requiredId<WeaponId>(packet.weaponId, "event.weaponId"), projectileId: null, moduleId,
    previousStatus: moduleStatus(previousStatus, "event.previousStatus"), currentStatus: moduleStatus(currentStatus, "event.currentStatus")
  });
};
export const createTargetDestroyedEvent = (packet: Readonly<DamagePacket>): Readonly<TargetDestroyedEvent> => createEvent<TargetDestroyedEvent>({
  phase: "TargetDestroyed", tick: packet.tick, sourceEntityId: requiredId<EntityId>(packet.sourceEntityId, "event.sourceEntityId"), targetEntityId: requiredId<EntityId>(packet.targetEntityId, "event.targetEntityId"),
  weaponId: requiredId<WeaponId>(packet.weaponId, "event.weaponId"), projectileId: null, moduleId: packet.moduleId, packetId: parseCombatId(packet.packetId, "event.packetId")
});

const validateCombatEvent = (input: CombatEvent): Readonly<CombatEvent> => {
  if (input === null || typeof input !== "object") throw new CombatContractError("InvalidEvent", "event", "must be an object.");
  let validated: Readonly<CombatEvent>;
  switch (input.phase) {
    case "WeaponFire": validated = createWeaponFireEvent(input); break;
    case "ProjectileSpawned": validated = createProjectileSpawnedEvent(input); break;
    case "ProjectileExpired": validated = createProjectileExpiredEvent(input); break;
    case "Hit": validated = createHitEvent(input.hit); break;
    case "DamageApplied": {
      const packet = { packetId: input.packetId, sourceEntityId: input.sourceEntityId, targetEntityId: input.targetEntityId, weaponId: input.weaponId, hitId: "hit:event-validation", moduleId: input.moduleId, damageType: "Kinetic" as const, rawDamage: 0, tick: input.tick } as DamagePacket;
      validated = createDamageAppliedEvent(packet, input.armorDamage, input.hullDamage, input.moduleDamage); break;
    }
    case "ModuleStateChanged": {
      const packet = { packetId: "packet:event-validation", sourceEntityId: input.sourceEntityId, targetEntityId: input.targetEntityId, weaponId: input.weaponId, hitId: "hit:event-validation", moduleId: input.moduleId, damageType: "Kinetic" as const, rawDamage: 0, tick: input.tick } as DamagePacket;
      validated = createModuleStateChangedEvent(packet, input.previousStatus, input.currentStatus); break;
    }
    case "TargetDestroyed": {
      const packet = { packetId: input.packetId, sourceEntityId: input.sourceEntityId, targetEntityId: input.targetEntityId, weaponId: input.weaponId, hitId: "hit:event-validation", moduleId: input.moduleId, damageType: "Kinetic" as const, rawDamage: 0, tick: input.tick } as DamagePacket;
      validated = createTargetDestroyedEvent(packet); break;
    }
    default: throw new CombatContractError("InvalidEnum", "event.phase", "must be a canonical Combat event phase.");
  }
  const suppliedId = parseCombatId<EventId>(input.eventId, "event.eventId");
  for (const key of ["phase", "tick", "sourceEntityId", "targetEntityId", "weaponId", "projectileId", "moduleId"] as const) {
    if (input[key] !== validated[key]) throw new CombatContractError("EventContractMismatch", `event.${key}`, "does not match the validated event payload.");
  }
  if (suppliedId !== validated.eventId) throw new CombatContractError("EventIdentityMismatch", "event.eventId", "does not match the validated event payload.");
  return validated;
};

const phaseRank = new Map<CombatEventPhase, number>(COMBAT_EVENT_PHASES.map((phase, index) => [phase, index]));
const compareText = (a: string | null, b: string | null): number => lexicalCompare(a ?? "", b ?? "");
export const sortCombatEvents = (input: readonly CombatEvent[]): readonly Readonly<CombatEvent>[] => deepFreeze(input.map(validateCombatEvent).sort((a, b) =>
  a.tick - b.tick
  || (phaseRank.get(a.phase) ?? Number.MAX_SAFE_INTEGER) - (phaseRank.get(b.phase) ?? Number.MAX_SAFE_INTEGER)
  || compareText(a.sourceEntityId, b.sourceEntityId)
  || compareText(a.targetEntityId, b.targetEntityId)
  || compareText(a.weaponId, b.weaponId)
  || compareText(a.projectileId, b.projectileId)
  || compareText(a.moduleId, b.moduleId)
  || compareText(a.eventId, b.eventId)
));

export interface CanonicalCombatEventSequence { readonly events: readonly Readonly<CombatEvent>[]; readonly canonicalJson: string; readonly signature: string }
export const createCanonicalCombatEventSequence = (input: readonly CombatEvent[]): Readonly<CanonicalCombatEventSequence> => {
  const events = sortCombatEvents(input);
  const canonicalJson = canonicalCombatJson(events);
  return deepFreeze({ events, canonicalJson, signature: combatHash(events) });
};

export const assertEventId = (value: unknown): EventId => parseCombatId<EventId>(value, "event.eventId");
