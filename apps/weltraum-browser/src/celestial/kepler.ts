import type { Vec3 } from "../core/vector";
import { failCelestial } from "./errors";
import type { OrbitDefinition, KeplerSolution, KeplerSolverOptions, RelativeOrbitalState } from "./types";
import { deepFreezeCelestial, requireFiniteNumber, requireFinitePositive } from "./validation";

const TWO_PI = Math.PI * 2;
const DEGREES_TO_RADIANS = Math.PI / 180;

export const DEFAULT_KEPLER_SOLVER_OPTIONS: KeplerSolverOptions = Object.freeze({
  toleranceRadians: 1e-13,
  maxIterations: 32
});

export const normalizeAngleRadians = (angleRadians: number): number => {
  requireFiniteNumber(angleRadians, "/angleRadians");
  const normalized = angleRadians % TWO_PI;
  return normalized < 0 ? normalized + TWO_PI : normalized;
};

const validateSolverOptions = (options: KeplerSolverOptions): KeplerSolverOptions => {
  const toleranceRadians = requireFinitePositive(options.toleranceRadians, "/solverOptions/toleranceRadians");
  const maxIterations = requireFinitePositive(options.maxIterations, "/solverOptions/maxIterations");
  if (!Number.isInteger(maxIterations)) {
    return failCelestial("InvalidOrbit", "/solverOptions/maxIterations", "Kepler maxIterations must be an integer.");
  }
  return { toleranceRadians, maxIterations };
};

export const solveEllipticKepler = (
  meanAnomalyRadians: number,
  eccentricity: number,
  options: KeplerSolverOptions = DEFAULT_KEPLER_SOLVER_OPTIONS
): KeplerSolution => {
  const normalizedMeanAnomalyRadians = normalizeAngleRadians(meanAnomalyRadians);
  requireFiniteNumber(eccentricity, "/eccentricity");
  if (eccentricity < 0 || eccentricity >= 1) {
    return failCelestial("InvalidOrbit", "/eccentricity", "Elliptic Kepler propagation requires 0 <= eccentricity < 1.");
  }
  const validatedOptions = validateSolverOptions(options);
  let eccentricAnomalyRadians = eccentricity < 0.8 ? normalizedMeanAnomalyRadians : Math.PI;

  for (let iteration = 1; iteration <= validatedOptions.maxIterations; iteration += 1) {
    const residual = eccentricAnomalyRadians - eccentricity * Math.sin(eccentricAnomalyRadians) - normalizedMeanAnomalyRadians;
    if (Math.abs(residual) <= validatedOptions.toleranceRadians) {
      return deepFreezeCelestial({
        eccentricAnomalyRadians,
        normalizedMeanAnomalyRadians,
        residualRadians: residual,
        iterations: iteration
      });
    }
    const derivative = 1 - eccentricity * Math.cos(eccentricAnomalyRadians);
    if (!Number.isFinite(derivative) || derivative === 0) {
      break;
    }
    eccentricAnomalyRadians -= residual / derivative;
  }

  return failCelestial(
    "KeplerConvergenceFailure",
    "/solverOptions/maxIterations",
    `Elliptic Kepler solver did not converge in ${validatedOptions.maxIterations} iterations.`
  );
};

export const orbitalPeriodSeconds = (semiMajorAxisMeters: number, parentMu: number): number => {
  const semiMajorAxis = requireFinitePositive(semiMajorAxisMeters, "/orbit/semiMajorAxisMeters");
  const mu = requireFinitePositive(parentMu, "/parentMu");
  return TWO_PI * Math.sqrt(semiMajorAxis ** 3 / mu);
};

const rotatePerifocalVector = (vector: Vec3, orbit: OrbitDefinition): Vec3 => {
  const longitude = orbit.longitudeOfAscendingNodeDegrees * DEGREES_TO_RADIANS;
  const inclination = orbit.inclinationDegrees * DEGREES_TO_RADIANS;
  const periapsis = orbit.argumentOfPeriapsisDegrees * DEGREES_TO_RADIANS;
  const cosLongitude = Math.cos(longitude);
  const sinLongitude = Math.sin(longitude);
  const cosInclination = Math.cos(inclination);
  const sinInclination = Math.sin(inclination);
  const cosPeriapsis = Math.cos(periapsis);
  const sinPeriapsis = Math.sin(periapsis);

  const xAxis = {
    x: cosLongitude * cosPeriapsis - sinLongitude * sinPeriapsis * cosInclination,
    y: sinLongitude * cosPeriapsis + cosLongitude * sinPeriapsis * cosInclination,
    z: sinPeriapsis * sinInclination
  };
  const yAxis = {
    x: -cosLongitude * sinPeriapsis - sinLongitude * cosPeriapsis * cosInclination,
    y: -sinLongitude * sinPeriapsis + cosLongitude * cosPeriapsis * cosInclination,
    z: cosPeriapsis * sinInclination
  };
  return {
    x: xAxis.x * vector.x + yAxis.x * vector.y,
    y: xAxis.y * vector.x + yAxis.y * vector.y,
    z: xAxis.z * vector.x + yAxis.z * vector.y
  };
};

const validateOrbitForPropagation = (orbit: OrbitDefinition): void => {
  requireFinitePositive(orbit.semiMajorAxisMeters, "/orbit/semiMajorAxisMeters");
  requireFiniteNumber(orbit.eccentricity, "/orbit/eccentricity");
  if (orbit.eccentricity < 0 || orbit.eccentricity >= 1) {
    return failCelestial("InvalidOrbit", "/orbit/eccentricity", "Elliptic propagation requires 0 <= eccentricity < 1.");
  }
  requireFiniteNumber(orbit.inclinationDegrees, "/orbit/inclinationDegrees");
  requireFiniteNumber(orbit.longitudeOfAscendingNodeDegrees, "/orbit/longitudeOfAscendingNodeDegrees");
  requireFiniteNumber(orbit.argumentOfPeriapsisDegrees, "/orbit/argumentOfPeriapsisDegrees");
  requireFiniteNumber(orbit.meanAnomalyAtEpochDegrees, "/orbit/meanAnomalyAtEpochDegrees");
};

export const propagateKeplerOrbit = (
  orbit: OrbitDefinition,
  parentMu: number,
  epochSeconds: number,
  requestedTimeSeconds: number,
  options: KeplerSolverOptions = DEFAULT_KEPLER_SOLVER_OPTIONS
): RelativeOrbitalState => {
  validateOrbitForPropagation(orbit);
  const mu = requireFinitePositive(parentMu, "/parentMu");
  const epoch = requireFiniteNumber(epochSeconds, "/epochSeconds");
  const requestedTime = requireFiniteNumber(requestedTimeSeconds, "/requestedTimeSeconds");
  const semiMajorAxis = orbit.semiMajorAxisMeters;
  const eccentricity = orbit.eccentricity;
  const meanMotionRadiansPerSecond = Math.sqrt(mu / semiMajorAxis ** 3);
  const meanAnomalyRadians = normalizeAngleRadians(
    orbit.meanAnomalyAtEpochDegrees * DEGREES_TO_RADIANS + meanMotionRadiansPerSecond * (requestedTime - epoch)
  );
  const solution = solveEllipticKepler(meanAnomalyRadians, eccentricity, options);
  const cosine = Math.cos(solution.eccentricAnomalyRadians);
  const sine = Math.sin(solution.eccentricAnomalyRadians);
  const sqrtOneMinusEccentricitySquared = Math.sqrt(1 - eccentricity ** 2);
  const eccentricRadiusFactor = 1 - eccentricity * cosine;
  const eccentricAnomalyRate = meanMotionRadiansPerSecond / eccentricRadiusFactor;
  const positionMeters = rotatePerifocalVector(
    {
      x: semiMajorAxis * (cosine - eccentricity),
      y: semiMajorAxis * sqrtOneMinusEccentricitySquared * sine,
      z: 0
    },
    orbit
  );
  const velocityMetersPerSecond = rotatePerifocalVector(
    {
      x: -semiMajorAxis * sine * eccentricAnomalyRate,
      y: semiMajorAxis * sqrtOneMinusEccentricitySquared * cosine * eccentricAnomalyRate,
      z: 0
    },
    orbit
  );

  return deepFreezeCelestial({
    positionMeters,
    velocityMetersPerSecond,
    orbitalPeriodSeconds: orbitalPeriodSeconds(semiMajorAxis, mu),
    meanMotionRadiansPerSecond,
    meanAnomalyRadians,
    eccentricAnomalyRadians: solution.eccentricAnomalyRadians,
    solverIterations: solution.iterations
  });
};
