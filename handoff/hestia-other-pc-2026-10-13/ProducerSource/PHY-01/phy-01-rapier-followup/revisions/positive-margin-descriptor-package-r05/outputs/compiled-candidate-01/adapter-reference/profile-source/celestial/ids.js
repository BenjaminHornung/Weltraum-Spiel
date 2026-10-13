import { failCelestial } from "./errors";
const stableCelestialIdPattern = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;
export const isStableCelestialId = (value) => typeof value === "string" && stableCelestialIdPattern.test(value);
const createStableId = (value, path, label) => {
    if (!isStableCelestialId(value)) {
        return failCelestial("InvalidId", path, `${label} must be lowercase ASCII with dot- or underscore-separated alphanumeric segments.`);
    }
    return value;
};
export const createCelestialBodyId = (value, path = "/bodyId") => createStableId(value, path, "Celestial body ID");
export const createCelestialCatalogId = (value, path = "/catalogId") => createStableId(value, path, "Celestial catalog ID");
