import type { FactoryCatalog, FactoryTerm } from "../contracts";
import type { FactoryVector } from "./installationProfile";
import { validateFactoryAmount, safeBigIntNumber } from "../material/quantity";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";

/** Closed technical S0 transport envelopes, never authored installed geometry or density. */
export interface CargoHandlingProfile {
  readonly version: "fp06-handling-s0-v1";
  readonly profileId: string;
  readonly catalogDigest: string;
  readonly terms: readonly FactoryTerm[];
  readonly massMg: number;
  readonly capacityMm3: number;
  readonly sizeMm: FactoryVector;
  readonly sourceRefs: readonly string[];
  readonly canonicalJson: string;
  readonly digest: string;
}
const singleItems: Readonly<Record<string, string>> = Object.freeze({
  "C26-PACK": "fp02.chassis.cutter", "C27-PACK": "fp02.chassis.former", "WIND-PACK": "fp02.device.wind_pack_6kw",
  "PV-PACK": "fp02.device.pv_pack_2kwp", "BATTERY-PACK": "fp02.device.battery_4kwh", "DISTRIBUTOR-PACK": "fp02.device.distribution_40kw",
  "BENCH-PACK": "fp02.device.field_workbench", "BIN-PACK": "fp02.device.material_container", "FOOT-PACK": "fp02.comp.foundation_foot", "BRACE": "fp02.comp.small_brace"
});
/** Closed measured socket routes; historical jobs remain stable, never a caller-sized body. */
export const FACTORY_CLOSED_CABLE_JOBS=Object.freeze({CABLE4750:4750,CABLE6500:6500,CABLE8000:8000,CABLE7000:7000,CABLE5250:5250,CABLE7500:7500,CABLE5000:5000,CABLE5750:5750,CABLE7750:7750,CABLE2750:2750,CABLE8500:8500});
const freeze = <T>(value: T): T => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
/** Profile capacity is the CEILING of an exact source-packed rational sum, not a rounded material quantity. */
export const readCargoHandlingProfile = (catalog: FactoryCatalog, profileId: string): CargoHandlingProfile | undefined => {
  let terms: readonly FactoryTerm[];
  if (Object.hasOwn(singleItems, profileId)) terms = [{ itemId: singleItems[profileId]!, quantityUnits: 1 }];
  else if (profileId === "B06-BOM" || profileId === "B07-BOM") {
    const device = catalog.devices.find(d => d.sourceId === profileId.slice(0, 3)); if (!device) return undefined;
    terms = device.bom;
  } else if (profileId === "BELT4") terms = [{ itemId: "fp02.comp.belt_module", quantityUnits: 4 }, { itemId: "fp02.comp.belt_drive", quantityUnits: 1 }];
  else if (profileId === "CABLE40") terms = [{ itemId: "fp02.comp.field_cable", quantityUnits: 40_000 }];
  else if (Object.hasOwn(FACTORY_CLOSED_CABLE_JOBS,profileId)) terms = [{ itemId: "fp02.comp.field_cable", quantityUnits: FACTORY_CLOSED_CABLE_JOBS[profileId as keyof typeof FACTORY_CLOSED_CABLE_JOBS] }];
  else if (profileId === "RAW8") terms = [{ itemId: "fp02.bulk.steel_known", quantityUnits: 8_000_000 }];
  else if (profileId === "MONTAGE") terms = [{ itemId: "fp02.bulk.steel_profile", quantityUnits: 4_000_000 }, { itemId: "fp02.bulk.steel_sheet", quantityUnits: 2_000_000 }];
  else return undefined;
  let numerator = 0n, denominator = 1n, mass = 0n;
  const refs = new Set<string>(["FP01:5:heavy-module-handling", "FP02:6.4", "accepted:D11-native-handling-v1"]);
  if(Object.hasOwn(FACTORY_CLOSED_CABLE_JOBS,profileId))refs.add(["CABLE2750","CABLE8500"].includes(profileId)?"fp06-technical-s0-closed-native-socket-cable-jobs-v4":["CABLE5000","CABLE5750","CABLE7750"].includes(profileId)?"fp06-technical-s0-closed-native-socket-cable-jobs-v3":["CABLE7000","CABLE5250","CABLE7500"].includes(profileId)?"fp06-technical-s0-closed-native-socket-cable-jobs-v2":"fp06-technical-s0-closed-native-socket-cable-jobs-v1");
  for (const term of terms) {
    const amount = validateFactoryAmount(term.itemId, term.quantityUnits, catalog);
    const item = catalog.items.find(i => i.sourceId === term.itemId)!;
    if (item.volumeProfile.kind === "unknown") return undefined;
    const profile = item.volumeProfile;
    numerator = numerator * BigInt(profile.denominatorUnits) + BigInt(term.quantityUnits) * BigInt(profile.numeratorMm3) * denominator;
    denominator *= BigInt(profile.denominatorUnits);
    mass += BigInt(amount.massMg); profile.sourceRefs.forEach(ref => refs.add(ref));
  }
  const heavy = profileId === "C27-PACK" || profileId === "B07-BOM" || profileId === "WIND-PACK";
  const light = profileId === "RAW8" || profileId === "MONTAGE" || profileId === "BRACE" || Object.hasOwn(FACTORY_CLOSED_CABLE_JOBS,profileId);
  const data = { version: "fp06-handling-s0-v1" as const, profileId, catalogDigest: catalog.catalogDigest, terms,
    massMg: safeBigIntNumber(mass, "HandlingMass"), capacityMm3: safeBigIntNumber((numerator + denominator - 1n) / denominator, "HandlingVolume"),
    sizeMm: (light ? [500, 1000, 500] : heavy ? [1000, 1000, 1500] : [1000, 1000, 1000]) as FactoryVector,
    sourceRefs: [...refs].sort() };
  return freeze({ ...data, canonicalJson: canonicalJson(data), digest: canonicalSignature(data) });
};
