import { englishFactoryText } from "./english";
import { createFp02CatalogInput, loadFactoryCatalog } from "../catalog/fp02Catalog";
import type { FactoryUiInventory } from "../session/hostPort";

type Stack = FactoryUiInventory["contents"][number];
export type FactoryItemSymbol = "stock" | "semi" | "profile" | "sheet" | "offcut" | "brace" | "wind" | "solar" | "battery" | "cable" | "container" | "bench" | "belt" | "drive" | "chassis" | "package";
const symbols: Readonly<Record<string, FactoryItemSymbol>> = Object.freeze({
  "fp02.bulk.steel_known": "stock", "fp02.bulk.steel_semi": "semi", "fp02.bulk.steel_profile": "profile", "fp02.bulk.steel_sheet": "sheet", "fp02.bulk.steel_offcut": "offcut",
  "fp02.comp.small_brace": "brace", "fp02.device.wind_pack_6kw": "wind", "fp02.device.pv_pack_2kwp": "solar", "fp02.device.battery_4kwh": "battery",
  "fp02.comp.field_cable": "cable", "fp02.comp.wiring_harness": "cable", "fp02.device.material_container": "container", "fp02.device.field_workbench": "bench",
  "fp02.comp.belt_module": "belt", "fp02.comp.machine_drive": "drive", "fp02.comp.belt_drive": "drive", "fp02.comp.drive_module": "drive",
  "fp02.chassis.cutter": "chassis", "fp02.chassis.former": "chassis", "fp02.chassis.crusher": "chassis",
});
export const factoryItemSymbol = (itemId: string): FactoryItemSymbol => Object.hasOwn(symbols, itemId) ? symbols[itemId]! : "package";

// Original, closed illustrations of item form. No texture/world/collider proof,
// user-supplied markup, stats, loot rank or animation is encoded in these paths.
const forms: Readonly<Record<FactoryItemSymbol | "map" | "manual" | "pause", string>> = Object.freeze({
  stock: '<path d="M9 36 43 20 55 26 21 43Z M9 44 43 28 55 34 21 51Z" fill="#74827e"/><path d="m9 36 12 7v8L9 44Z" fill="#b6bdb8"/><path d="M9 28 43 12 55 18 21 35Z" fill="#c0c8c2"/><path d="m21 35 34-17v8L21 43Z" fill="#407a79"/>',
  semi: '<path d="M9 32 44 14 55 20 20 38Z" fill="#c0c8c2"/><path d="m9 32 11 6v16L9 48Z" fill="#8e9992"/><path d="m20 38 35-18v16L20 54Z" fill="#526662"/><path d="m28 34 0 16m10-21v16" stroke="#b6bdb8" stroke-width="2"/>',
  profile: '<path d="M11 29 41 13 53 19 43 24 43 39 53 44 23 59 11 53 21 48 21 34Z" fill="#8eaaa3"/><path d="m11 29 12 6 30-16M23 35v17l30-15M11 53l12 6" fill="none" stroke="#e0e5dc" stroke-width="2"/>',
  sheet: '<path d="M8 29 35 14 57 26 30 42Z M8 36 35 21 57 33 30 49Z M8 43 35 28 57 40 30 56Z" fill="#89968f" stroke="#30383d" stroke-width="2"/><path d="M8 22 35 7 57 19 30 35Z" fill="#c8cfc5"/><path d="m30 35 27-16v6L30 41Z" fill="#407a79"/>',
  offcut: '<path d="m9 37 16-20 11 15-14 8Z" fill="#bbc3b8"/><path d="m36 14 18 8-12 13-9-8Z" fill="#87998e"/><path d="m30 42 20-7 4 14-22 5Z" fill="#a1a99d"/><path d="m11 47 9-6 4 12-12 3Z" fill="#d8a94e"/>',
  brace: '<path d="M8 51 25 12h9l21 39h-9L28 22 17 51Z" fill="#abb6ab"/><path d="M18 40h29v7H18Z" fill="#407a79"/><path d="M5 51h16v7H5Zm38 0h16v7H43Z" fill="#687d73"/>',
  wind: '<path d="M29 28h7v27h12v5H18v-5h11Z" fill="#aab5a9"/><path d="m33 23-4-19h7l3 20ZM29 25 9 37l-4-6 22-13Zm8 0 18 12-3 6-22-17Z" fill="#c5ccc0"/><path d="M27 21h13v9H27Z" fill="#407a79"/>',
  solar: '<path d="m7 18 40-8 10 32-40 8Z" fill="#1d2e3c" stroke="#a4b8b1" stroke-width="3"/><path d="m20 15 10 32m3-35 10 32M10 28l39-8m-36 20 40-8" stroke="#407a79" stroke-width="2"/><path d="M20 49v8h26v-8" fill="none" stroke="#a4b8b1" stroke-width="3"/>',
  battery: '<path d="M13 15h36v40H13Z" fill="#aeb8ac"/><path d="M49 15h6v40h-6Z" fill="#61746c"/><path d="M19 8h8v7h-8Zm17 0h8v7h-8Z" fill="#d8a94e"/><path d="M20 25h22v4H20Zm0 12h22v12H20Z" fill="#407a79"/>',
  cable: '<path d="M15 16h30v31H15Z" fill="#455851"/><path d="M8 13h11v40H8Zm34 0h11v40H42Z" fill="#a9b5aa"/><path d="M22 17v29m6-29v29m6-29v29" stroke="#d8a94e" stroke-width="3"/><path d="m52 40 6 0v15h-8" fill="none" stroke="#d8a94e" stroke-width="3"/>',
  container: '<path d="M8 20 34 9 56 20 30 32Z" fill="#bbc3b7"/><path d="M8 20v30l22 10V32Z" fill="#7b8c81"/><path d="m30 32 26-12v30L30 60Z" fill="#49635b"/><path d="m12 28 14 6m9 5 16-7m-16 19 16-7" stroke="#d8a94e" stroke-width="3"/>',
  bench: '<path d="M7 20h50v10H7Z" fill="#bdc4b9"/><path d="M13 30h7v26h-7Zm31 0h7v26h-7Z" fill="#83938a"/><path d="M20 41h25v6H20Z" fill="#407a79"/><path d="M37 12h10v8H37Z" fill="#d8a94e"/>',
  belt: '<path d="m7 30 37-18 13 10-37 18Z" fill="#20362f" stroke="#a5b4a8" stroke-width="3"/><path d="m17 28 13 10m-2-16 13 10m-2-16 12 10" stroke="#61786c" stroke-width="2"/><path d="M13 38v16m33-25v18" stroke="#b0baad" stroke-width="5"/>',
  drive: '<path d="M22 11h19v8h9v9h7v13h-7v9h-9v8H22v-8h-9v-9H6V28h7v-9h9Z" fill="#7e968a"/><path d="M23 25h17v18H23Z" fill="#d8a94e"/><path d="M28 29h7v10h-7Z" fill="#30383d"/>',
  chassis: '<path d="M9 18h46v38H9Z" fill="none" stroke="#a7b6aa" stroke-width="7"/><path d="M22 20v33m20-33v33M13 35h37" stroke="#407a79" stroke-width="5"/><path d="M5 56h14v5H5Zm40 0h14v5H45Z" fill="#d8a94e"/>',
  package: '<path d="M10 18 32 8 54 18v34L32 62 10 52Z" fill="none" stroke="#aebcad" stroke-width="3"/><path d="m10 18 22 11 22-11M32 29v33" fill="none" stroke="#aebcad" stroke-width="3"/>',
  map: '<path d="m8 16 16-7 17 8 15-7v42l-15 7-17-8-16 7Z" fill="none" stroke="#b6bdb8" stroke-width="3"/><path d="M24 9v42m17-34v42m-15-28 8-8 11 7" fill="none" stroke="#407a79" stroke-width="3"/>',
  manual: '<path d="M12 9h35l8 8v42H12Z" fill="none" stroke="#b6bdb8" stroke-width="3"/><path d="M21 25h25M21 35h25M21 45h15" stroke="#407a79" stroke-width="4"/>',
  pause: '<path d="M15 12h12v42H15Zm22 0h12v42H37Z" fill="#b6bdb8"/>',
});
const icon = (doc: Document, shape: keyof typeof forms, label: string): HTMLElement => {
  const element = doc.createElement("span"); element.className = "factory-item-symbol";
  element.setAttribute("role", "img"); element.setAttribute("aria-label", englishFactoryText(label));
  // Only closed constant markup is inserted; external names/IDs use DOM setters.
  element.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">${forms[shape]}</svg>`;
  return element;
};
// Actual transparent Blender renders of the existing native models. Closed
// mappings preserve identity; imagery cannot add material, ports or authority.
const thumbnails: Readonly<Record<string, string>> = Object.freeze({
  "fp02.bulk.steel_known": "steel", "fp02.bulk.steel_semi": "semi", "fp02.bulk.steel_profile": "profile",
  "fp02.bulk.steel_sheet": "sheet", "fp02.bulk.steel_offcut": "offcut", "fp02.comp.small_brace": "brace",
  "fp02.device.battery_4kwh": "battery", "fp02.comp.field_cable": "cable", "fp02.device.material_container": "storage",
  "fp02.device.field_workbench": "bench", "fp02.comp.belt_module": "belt", "fp02.chassis.cutter": "cutter", "fp02.chassis.former": "former",
});
export const factoryItemIcon = (doc: Document, itemId: string, label: string): HTMLElement => {
  const element = icon(doc, factoryItemSymbol(itemId), label); element.dataset.factoryItem = itemId;
  if (Object.hasOwn(thumbnails, itemId)) {
    const image = doc.createElement("img"); image.src = `/factory/ui-ceramic-v1/${thumbnails[itemId]}.png`; image.alt = ""; image.width = 192; image.height = 192; image.decoding = "async";
    image.addEventListener("error", () => { element.replaceChildren(...icon(doc, factoryItemSymbol(itemId), label).children); }, { once: true });
    element.replaceChildren(image);
  }
  return element;
};
export const factoryToolIcon = (doc: Document, tool: string): HTMLElement => {
  const shapes: Record<string, keyof typeof forms> = { cargo: "container", build: "brace", machine: "chassis", power: "battery", technology: "drive", map: "map", help: "manual", pause: "pause" };
  const items: Readonly<Record<string, string>> = { cargo: "fp02.device.material_container", build: "fp02.comp.small_brace", machine: "fp02.chassis.cutter", power: "fp02.device.battery_4kwh" };
  const element = Object.hasOwn(items, tool) ? factoryItemIcon(doc, items[tool]!, "") : icon(doc, Object.hasOwn(shapes, tool) ? shapes[tool]! : "package", ""); element.setAttribute("aria-hidden", "true"); return element;
};

const catalog = loadFactoryCatalog(createFp02CatalogInput());
export interface FactoryItemGroup {
  readonly key: string; readonly itemId: string; readonly name: string; readonly quantityBasis: Stack["quantityBasis"];
  readonly quantityUnits: number; readonly massMg: number; readonly freshProduction: boolean; readonly stacks: readonly Stack[];
}
/** Display totals only. Commands still select one original stack or admitted
 * profile; groups are never converted into fabricated source-lot authority. */
export const groupFactoryItems = (container: FactoryUiInventory, catalogDigest: string): readonly FactoryItemGroup[] => {
  const groups = new Map<string, { key: string; itemId: string; name: string; quantityBasis: Stack["quantityBasis"]; quantityUnits: number; massMg: number; freshProduction: boolean; stacks: Stack[] }>();
  for (const stack of container.contents) {
    const item = catalogDigest === catalog.catalogDigest ? catalog.items.find(i => i.sourceId === stack.itemId && i.quantityBasis === stack.quantityBasis) : undefined;
    const identity = item ? [container.id, container.role, item.sourceId, item.version, item.digest, stack.quantityBasis, stack.freshProduction] : [container.id, container.role, stack.stackId];
    let key = JSON.stringify(identity), group = groups.get(key);
    if (group && (!Number.isSafeInteger(group.quantityUnits + stack.quantityUnits) || !Number.isSafeInteger(group.massMg + stack.massMg))) { key = JSON.stringify([...identity, stack.stackId]); group = undefined; }
    if (group) { group.quantityUnits += stack.quantityUnits; group.massMg += stack.massMg; group.stacks.push(stack); }
    else groups.set(key, { key, itemId: stack.itemId, name: englishFactoryText(stack.name), quantityBasis: stack.quantityBasis, quantityUnits: stack.quantityUnits, massMg: stack.massMg, freshProduction: stack.freshProduction, stacks: [stack] });
  }
  return Object.freeze([...groups.values()].map(g => Object.freeze({ ...g, stacks: Object.freeze(g.stacks) })));
};
const profileLabels: Readonly<Record<string, string>> = Object.freeze({
  "C26-PACK": "Cutter chassis", "C27-PACK": "Former chassis", "B06-BOM": "Cutter kit", "B07-BOM": "Former kit",
  "BATTERY-PACK": "Battery", "DISTRIBUTOR-PACK": "Distributor", "BENCH-PACK": "Workbench", "BIN-PACK": "Material container",
  BELT4: "Belt line · 4 m", CABLE40: "Cable pack · 40 m", CABLE4750: "Cable · 4.75 m", CABLE6500: "Cable · 6.5 m", CABLE8000: "Cable · 8 m", CABLE7000: "Cable · 7 m", CABLE5250: "Cable · 5.25 m", CABLE7500: "Cable · 7.5 m",
  RAW8: "Steel batch · 8 kg", MONTAGE: "Brace materials", BRACE: "New brace",
});
export const factoryProfileLabel = (profileId: string, fallback: string): string => Object.hasOwn(profileLabels, profileId) ? profileLabels[profileId]! : englishFactoryText(fallback);
