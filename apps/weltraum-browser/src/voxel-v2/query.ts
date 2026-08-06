export type VoxelV2View = "player" | "coast" | "archipelago" | "river";

const parameters = (search: string | URLSearchParams): URLSearchParams =>
  typeof search === "string" ? new URLSearchParams(search) : search;

export const isVoxelV2Query = (search: string | URLSearchParams): boolean => {
  const values = parameters(search).getAll("voxelV2");
  return values.length === 1 && values[0] === "1";
};

export const voxelV2DiagnosticsEnabled = (search: string | URLSearchParams): boolean => {
  const values = parameters(search).getAll("voxelV2Diagnostics");
  return values.length === 1 && values[0] === "1";
};

export const parseVoxelV2View = (search: string | URLSearchParams): VoxelV2View => {
  const values = parameters(search).getAll("voxelV2View");
  if (values.length === 0) return "player";
  if (values.length !== 1 || (values[0] !== "player" && values[0] !== "coast" && values[0] !== "archipelago" && values[0] !== "river")) {
    throw new Error("Invalid V2 presentation view.");
  }
  return values[0];
};
