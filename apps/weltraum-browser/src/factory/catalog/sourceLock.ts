import {
  HVP_COAST_MATERIAL_REGISTRY, HVP_COAST_REGISTRY_DIGEST, HVP_COAST_SOURCE_VERSION,
  HVP_SOURCE_CELL_METERS
} from "../../hvp/hvpCoastSource";
import type { FactorySourceRef, FactoryTerrainSource } from "../contracts";

/** SHA-256 of uploaded, manifest-verified documents; not Resource/FNV signatures. */
export const FP02_SOURCE_REFS: readonly FactorySourceRef[] = Object.freeze([
  Object.freeze({ sourceId: "FP01", fileName: "HESTIA_FP01_EINSTIEG_ENERGIE_DETAILPLAN_2026-10-10.md", sha256: "ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c", status: "source-fixture" }),
  Object.freeze({ sourceId: "FP02", fileName: "HESTIA_FP02_PRODUKTIONSKETTEN_GEBAEUDE_LAYOUTS_DETAILPLAN_2026-10-10.md", sha256: "5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39", status: "source-fixture" }),
  Object.freeze({ sourceId: "FP03", fileName: "HESTIA_FP03_BAUEN_BLUEPRINTS_BAUAUTOMATION_DETAILPLAN_2026-10-10.md", sha256: "7d43e358ae7ead52da3996e85bc52906cb2584a42e0802fc4d1e959df1289cb1", status: "source-fixture" }),
  Object.freeze({ sourceId: "FP04", fileName: "HESTIA_FP04_AUTOMATION_ENERGIESELBSTSTAENDIGKEIT_DETAILPLAN_2026-10-10.md", sha256: "a04f8074afc4e1d5cd8d8eb948bb93f42cdc5a5cc73b3f2a077cb13e67e48570", status: "source-fixture" }),
  Object.freeze({ sourceId: "FP06", fileName: "HESTIA_FP06_PROTOTYPEN_TECHNISCHE_INTEGRATION_IMPLEMENTIERUNGSPAKETE_2026-10-10.md", sha256: "501bf5d80ee6dec9627e48ea27c271b3f964d21cde61ce9410be7eb77fa182ea", status: "source-fixture" })
]);

export const readFactoryTerrainSource = (): FactoryTerrainSource => {
  const limestone = HVP_COAST_MATERIAL_REGISTRY.find((entry) => entry.role === "limestone-dry");
  if (HVP_SOURCE_CELL_METERS !== 0.125 || limestone?.densityKgPerM3 !== 2_400
    || limestone.provenance !== "prototype-tuning-unapproved") {
    throw new Error("Factory terrain source lock changed; review the scale/profile binding");
  }
  return Object.freeze({ profileVersion: HVP_COAST_SOURCE_VERSION, registryDigest: HVP_COAST_REGISTRY_DIGEST,
    cellSizeMm: 125, limestoneDensityKgPerM3: 2400, densityProvenance: "prototype-tuning-unapproved", sourceRef: "src/hvp/hvpCoastSource.ts" });
};
