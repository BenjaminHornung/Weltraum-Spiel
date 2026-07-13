import {
  CombatContractError,
  DAMAGE_TYPES,
  canonicalCombatJson,
  combatHash,
  createDamageableSnapshot,
  createHitResult,
  deepFreeze,
  deriveCombatId,
  deriveModuleStatus,
  nonNegative,
  parseCombatId,
  tick,
  type DamagePacket,
  type DamagePacketId,
  type DamagePayload,
  type DamageType,
  type DamageableModule,
  type DamageableSnapshot,
  type DisabledRecoverability,
  type EntityId,
  type HitId,
  type HitResult,
  type ModuleId,
  type ModuleRole,
  type WeaponId
} from "./contracts";
import { createDamageAppliedEvent, createModuleStateChangedEvent, createTargetDestroyedEvent, type CombatEvent } from "./events";

const validateDamageType = (value: DamageType): DamageType => {
  if (!DAMAGE_TYPES.includes(value)) throw new CombatContractError("InvalidEnum", "damageType", "is invalid.");
  return value;
};

export const createDamagePacketFromHit = (hit: Readonly<HitResult>, payload: Readonly<DamagePayload>): Readonly<DamagePacket> => {
  const validatedHit = createHitResult(hit);
  const stable = {
    sourceEntityId: parseCombatId<EntityId>(validatedHit.sourceEntityId, "hit.sourceEntityId"), targetEntityId: parseCombatId<EntityId>(validatedHit.targetEntityId, "hit.targetEntityId"),
    weaponId: parseCombatId<WeaponId>(validatedHit.weaponId, "hit.weaponId"), hitId: parseCombatId<HitId>(validatedHit.hitId, "hit.hitId"),
    moduleId: validatedHit.moduleId === null ? null : parseCombatId<ModuleId>(validatedHit.moduleId, "hit.moduleId"), damageType: validateDamageType(payload.damageType), rawDamage: nonNegative(payload.rawDamage, "payload.rawDamage"), tick: tick(validatedHit.tick, "hit.tick")
  };
  return deepFreeze({ packetId: deriveCombatId<DamagePacketId>("packet", stable), ...stable });
};

const effectFor = (module: DamageableModule): ModuleEffect | null => {
  if (module.role === "MainThrust" && module.status !== "Operational") return "MainThrustAuthorityReduced";
  if (module.role === "Rcs" && module.status !== "Operational") return "RcsAuthorityReduced";
  if (module.role === "Weapon" && (module.status === "Disabled" || module.status === "Destroyed")) return "WeaponDisabled";
  if (module.role === "Sensor" && module.status !== "Operational") return "SensorDegraded";
  if (module.role === "Cargo" && (module.status === "Disabled" || module.status === "Destroyed")) return "CargoBreach";
  return null;
};

export type ModuleEffect = "MainThrustAuthorityReduced" | "RcsAuthorityReduced" | "WeaponDisabled" | "SensorDegraded" | "CargoBreach";
export interface DamageApplicationResult {
  readonly before: Readonly<DamageableSnapshot>;
  readonly after: Readonly<DamageableSnapshot>;
  readonly armorDamage: number;
  readonly penetratingDamage: number;
  readonly hullDamage: number;
  readonly moduleDamage: number;
  readonly effects: readonly ModuleEffect[];
  readonly moduleRecoverability: DisabledRecoverability | null;
  readonly canonicalJson: string;
  readonly signature: string;
  readonly events: readonly Readonly<CombatEvent>[];
}

const asModuleInput = (module: DamageableModule, current = module.current) => ({
  moduleId: module.moduleId,
  role: module.role as ModuleRole,
  current,
  maximum: module.maximum,
  resistances: module.resistances,
  degradedThreshold: module.degradedThreshold,
  disabledThreshold: module.disabledThreshold,
  disabledRecoverability: module.disabledRecoverability
});

export const applyDamage = (packetInput: Readonly<DamagePacket>, damageableInput: Readonly<DamageableSnapshot>): Readonly<DamageApplicationResult> => {
  const packet = deepFreeze({
    packetId: parseCombatId<DamagePacketId>(packetInput.packetId, "packet.packetId"), sourceEntityId: parseCombatId<EntityId>(packetInput.sourceEntityId, "packet.sourceEntityId"),
    targetEntityId: parseCombatId<EntityId>(packetInput.targetEntityId, "packet.targetEntityId"), weaponId: parseCombatId<WeaponId>(packetInput.weaponId, "packet.weaponId"), hitId: parseCombatId<HitId>(packetInput.hitId, "packet.hitId"),
    moduleId: packetInput.moduleId === null ? null : parseCombatId<ModuleId>(packetInput.moduleId, "packet.moduleId"), damageType: validateDamageType(packetInput.damageType), rawDamage: nonNegative(packetInput.rawDamage, "packet.rawDamage"), tick: tick(packetInput.tick, "packet.tick")
  });
  const before = createDamageableSnapshot({
    targetEntityId: damageableInput.targetEntityId,
    armor: damageableInput.armor,
    hull: damageableInput.hull,
    modules: damageableInput.modules.map((module) => asModuleInput(module))
  });
  if (packet.targetEntityId !== before.targetEntityId) throw new CombatContractError("TargetMismatch", "packet.targetEntityId", "must match damageable target.");
  const selected = packet.moduleId === null ? null : before.modules.find((module) => module.moduleId === packet.moduleId);
  if (packet.moduleId !== null && selected === undefined) throw new CombatContractError("UnknownModule", "packet.moduleId", "must identify an existing target module.");

  const armorReduced = packet.rawDamage * (1 - before.armor.resistances[packet.damageType]);
  const armorDamage = Math.min(before.armor.current, armorReduced);
  const penetratingDamage = Math.max(0, armorReduced - armorDamage);
  const hullDamage = Math.min(before.hull.current, penetratingDamage * (1 - before.hull.resistances[packet.damageType]));
  const moduleDamage = selected === null || selected === undefined ? 0 : Math.min(selected.current, penetratingDamage * (1 - selected.resistances[packet.damageType]));
  const after = createDamageableSnapshot({
    targetEntityId: before.targetEntityId,
    armor: { ...before.armor, current: Math.max(0, before.armor.current - armorDamage) },
    hull: { ...before.hull, current: Math.max(0, before.hull.current - hullDamage) },
    modules: before.modules.map((module) => asModuleInput(module, module.moduleId === selected?.moduleId ? Math.max(0, module.current - moduleDamage) : module.current))
  });
  const afterModule = selected === null || selected === undefined ? null : after.modules.find((module) => module.moduleId === selected.moduleId) ?? null;
  const effects = afterModule === null ? [] : [effectFor(afterModule)].filter((effect): effect is ModuleEffect => effect !== null);
  const events: CombatEvent[] = [createDamageAppliedEvent(packet, armorDamage, hullDamage, moduleDamage)];
  if (selected !== null && selected !== undefined && afterModule !== null && selected.status !== afterModule.status) events.push(createModuleStateChangedEvent(packet, selected.status, afterModule.status));
  if (before.hull.current > 0 && after.hull.current === 0) events.push(createTargetDestroyedEvent(packet));
  const semantic = { packetId: packet.packetId, before, after, armorDamage, penetratingDamage, hullDamage, moduleDamage, effects, moduleRecoverability: afterModule === null ? null : afterModule.status === "Destroyed" ? "RequiresReplacement" : afterModule.status === "Disabled" ? afterModule.disabledRecoverability : null, events };
  const canonicalJson = canonicalCombatJson(semantic);
  return deepFreeze({ ...semantic, canonicalJson, signature: combatHash(semantic) });
};

export const statusForIntegrity = deriveModuleStatus;
