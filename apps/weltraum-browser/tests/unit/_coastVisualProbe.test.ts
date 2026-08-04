import { it } from "vitest";
import { resolveHestiaSurfacePlayWorld } from "../../src/surface-play/surfacePlayBootstrap";
import { HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG } from "../../src/surface-play/surfacePlayConfig";

it("probe", () => {
  const world = resolveHestiaSurfacePlayWorld(HESTIA_SURFACE_PLAY_COAST_LUSH_CONFIG, "hestia.coast-lush.surface-play.preview.v1");
  const water = world.environment.waterPatches;
  console.log(JSON.stringify({anchor: world.anchorCenterMeters, waterCount: water.length, shore: water.filter((p) => p.source === "Shore").length, wet: water.filter((p) => p.source === "WetDepression").length, water: water.map((p) => ({x:p.positionMeters.x,y:p.positionMeters.y,z:p.positionMeters.z,source:p.source}))}, null, 2));
});
