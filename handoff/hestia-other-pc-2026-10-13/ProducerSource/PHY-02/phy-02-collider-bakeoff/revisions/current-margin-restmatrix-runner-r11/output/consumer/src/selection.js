import catalog from "../inputs/case-catalog.json" with { type: "json" };
export const fullCatalog = catalog.fullMatrix192;
export function selectCase(profile, kind, group, title) {
    const selected = fullCatalog.filter(c => c.profile === profile && c.kind === kind && c.group === group && c.title === title);
    if (selected.length !== 1)
        throw new Error("Unbound/duplicate case selection");
    return selected[0];
}
