import { add } from "../core/vector";
import { canonicalCelestialJson, celestialSignature } from "./canonical";
import { failCelestial } from "./errors";
import { propagateKeplerOrbit } from "./kepler";
import { CELESTIAL_SCHEMA_VERSION } from "./types";
import { deepFreezeCelestial, requireFiniteNumber } from "./validation";
const zeroVector = () => ({ x: 0, y: 0, z: 0 });
const absoluteState = (rootBodyId, positionMeters, velocityMetersPerSecond) => ({
    frame: {
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        kind: "AbsoluteSystem",
        referenceBodyId: rootBodyId,
        units: "meters"
    },
    positionMeters,
    velocityMetersPerSecond
});
const parentRelativeState = (parentBodyId, positionMeters, velocityMetersPerSecond) => ({
    frame: {
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        kind: "BodyCentered",
        referenceBodyId: parentBodyId,
        units: "meters"
    },
    positionMeters,
    velocityMetersPerSecond
});
export const createRootRuntimeState = (rootBody, requestedTimeSeconds) => {
    const requestedTime = requireFiniteNumber(requestedTimeSeconds, "/requestedTimeSeconds");
    if (rootBody.parentBodyId !== null || rootBody.orbit !== null) {
        return failCelestial("RootOrbitMismatch", `/bodies/${rootBody.bodyId}`, "Root runtime state requires a root body.");
    }
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        bodyId: rootBody.bodyId,
        requestedTimeSeconds: requestedTime,
        gravitationalParameterMu: rootBody.gravity.gravitationalParameterMu,
        physicalRadiusMeters: rootBody.radiusMeters,
        absoluteState: absoluteState(rootBody.bodyId, zeroVector(), zeroVector()),
        parentRelativeState: null
    });
};
export const propagateChildRuntimeState = (body, rootBodyId, parentState, epochSeconds, requestedTimeSeconds, options) => {
    const epoch = requireFiniteNumber(epochSeconds, "/epochSeconds");
    const requestedTime = requireFiniteNumber(requestedTimeSeconds, "/requestedTimeSeconds");
    if (body.parentBodyId === null || body.orbit === null || body.orbit.parentBodyId !== body.parentBodyId) {
        return failCelestial("ParentOrbitMismatch", `/bodies/${body.bodyId}/orbit`, "Child propagation requires a matching parent orbit.");
    }
    if (parentState.bodyId !== body.parentBodyId) {
        return failCelestial("ParentOrbitMismatch", `/bodies/${body.bodyId}/parentBodyId`, "Parent runtime state has the wrong body ID.");
    }
    if (parentState.requestedTimeSeconds !== requestedTime) {
        return failCelestial("FrameTimeMismatch", `/bodies/${body.bodyId}/requestedTimeSeconds`, "Parent and child states must use the same requested time.");
    }
    const relative = propagateKeplerOrbit(body.orbit, parentState.gravitationalParameterMu, epoch, requestedTime, options);
    const relativeState = parentRelativeState(body.parentBodyId, relative.positionMeters, relative.velocityMetersPerSecond);
    return deepFreezeCelestial({
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        bodyId: body.bodyId,
        requestedTimeSeconds: requestedTime,
        gravitationalParameterMu: body.gravity.gravitationalParameterMu,
        physicalRadiusMeters: body.radiusMeters,
        absoluteState: absoluteState(rootBodyId, add(parentState.absoluteState.positionMeters, relative.positionMeters), add(parentState.absoluteState.velocityMetersPerSecond, relative.velocityMetersPerSecond)),
        parentRelativeState: relativeState
    });
};
const ephemerisPayload = (ephemeris) => ({
    schemaVersion: ephemeris.schemaVersion,
    epochSeconds: ephemeris.epochSeconds,
    requestedTimeSeconds: ephemeris.requestedTimeSeconds,
    states: ephemeris.states
});
export const computeCatalogEphemeris = (catalog, input) => {
    const epochSeconds = requireFiniteNumber(input.epochSeconds, "/epochSeconds");
    const requestedTimeSeconds = requireFiniteNumber(input.requestedTimeSeconds, "/requestedTimeSeconds");
    const bodyById = catalog.indexes.bodyById;
    const computed = new Map();
    const compute = (bodyId) => {
        const existing = computed.get(bodyId);
        if (existing) {
            return existing;
        }
        const body = bodyById[bodyId];
        if (!body) {
            return failCelestial("InvalidCatalog", `/indexes/bodyById/${bodyId}`, `Catalog does not contain ${bodyId}.`);
        }
        const state = body.parentBodyId === null
            ? createRootRuntimeState(body, requestedTimeSeconds)
            : propagateChildRuntimeState(body, catalog.rootBodyId, compute(body.parentBodyId), epochSeconds, requestedTimeSeconds, input.solverOptions);
        computed.set(bodyId, state);
        return state;
    };
    const states = Object.freeze(catalog.bodies.map((body) => compute(body.bodyId)));
    const stateByBodyId = Object.create(null);
    for (const state of states) {
        Object.defineProperty(stateByBodyId, state.bodyId, {
            configurable: false,
            enumerable: true,
            value: state,
            writable: false
        });
    }
    Object.freeze(stateByBodyId);
    const base = {
        schemaVersion: CELESTIAL_SCHEMA_VERSION,
        epochSeconds,
        requestedTimeSeconds,
        states
    };
    return deepFreezeCelestial({
        ...base,
        stateByBodyId,
        canonicalJson: canonicalCelestialJson(ephemerisPayload(base)),
        signature: celestialSignature(ephemerisPayload(base))
    });
};
