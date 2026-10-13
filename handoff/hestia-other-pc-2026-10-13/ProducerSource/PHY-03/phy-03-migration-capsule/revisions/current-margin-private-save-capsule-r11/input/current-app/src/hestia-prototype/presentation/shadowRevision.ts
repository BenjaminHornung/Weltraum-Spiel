/** Logical primitive payload per snapshot; current and next snapshots coexist. */
export const HVP_SHADOW_REVISION_MAX_BYTES = 256 * 1024;

export type HvpShadowAtom = string | number | boolean | null;
export interface HvpShadowCasterRevision {
  readonly id: string;
  readonly values: readonly HvpShadowAtom[];
}
export interface HvpShadowRevision {
  readonly light: readonly HvpShadowAtom[];
  readonly casters: readonly HvpShadowCasterRevision[];
}

export function sameHvpShadowRevision(a: HvpShadowRevision, b: HvpShadowRevision): boolean {
  const equal = (x: readonly HvpShadowAtom[], y: readonly HvpShadowAtom[]) =>
    x.length === y.length && x.every((value, index) => Object.is(value, y[index]));
  return equal(a.light, b.light) && a.casters.length === b.casters.length
    && a.casters.every((caster, index) => caster.id === b.casters[index]!.id && equal(caster.values, b.casters[index]!.values));
}
