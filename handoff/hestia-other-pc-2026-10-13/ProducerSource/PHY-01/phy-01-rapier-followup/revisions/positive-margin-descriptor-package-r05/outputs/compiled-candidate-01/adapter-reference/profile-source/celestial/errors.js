/** Stable fail-closed error contract shared by celestial data and pure math queries. */
export class CelestialError extends Error {
    code;
    path;
    constructor(code, path, message) {
        super(message);
        this.name = "CelestialError";
        this.code = code;
        this.path = path;
    }
}
export const failCelestial = (code, path, message) => {
    throw new CelestialError(code, path, message);
};
