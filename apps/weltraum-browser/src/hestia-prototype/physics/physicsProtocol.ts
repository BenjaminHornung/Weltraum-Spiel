/** Ephemeral transport binding; never a Source, Save or native ownership proof. */
export const HVP_PHYSICS_PROTOCOL = "hvp-physics-owner-v3";
export interface HvpPhysicsBinding {
  readonly protocol: typeof HVP_PHYSICS_PROTOCOL;
  readonly incarnation: string;
}
