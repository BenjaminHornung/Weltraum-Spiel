                                              

export const UNIVERSE_TICKS_PER_SECOND = 120;

                                                                        
                                                                    
                                                                      

                               
                                
                                      
 

                              
                                
 

                                   
                  
                     
                           
                     
                   
                                 

export class UniverseTimeError extends Error {
                  code                       ;
                  path        ;

         constructor(code                       , path        , message        ) {
    super(message);
    this.name = "UniverseTimeError";
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const createSimulationTick = (value         , path = "/tick")                 => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new UniverseTimeError("INVALID_TICK", path, "Simulation tick must be a nonnegative safe integer.");
  }
  return (Object.is(value, -0) ? 0 : value)                  ;
};

export const convertTicksToSeconds = (tick        )               => {
  const parsedTick = createSimulationTick(tick);
  const seconds = parsedTick / UNIVERSE_TICKS_PER_SECOND;
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/tick", "Simulation tick cannot be represented as Universe seconds.");
  }
  return seconds                ;
};

const assertSeconds = (seconds         )         => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    throw new UniverseTimeError("INVALID_SECONDS", "/seconds", "Seconds must be finite and nonnegative.");
  }
  return Object.is(seconds, -0) ? 0 : seconds;
};

export const convertSecondsToTicks = (seconds        , roundingMode                  )                 => {
  const parsedSeconds = assertSeconds(seconds);
  const unrounded = parsedSeconds * UNIVERSE_TICKS_PER_SECOND;
  if (!Number.isFinite(unrounded) || unrounded > Number.MAX_SAFE_INTEGER) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/seconds", "Seconds exceed the safe Universe tick range.");
  }

  let rounded        ;
  switch (roundingMode) {
    case "exact":
      if (!Number.isSafeInteger(unrounded)) {
        throw new UniverseTimeError("INEXACT_SECONDS", "/seconds", "Seconds do not map to an exact Universe tick.");
      }
      rounded = unrounded;
      break;
    case "floor":
      rounded = Math.floor(unrounded);
      break;
    case "ceil":
      rounded = Math.ceil(unrounded);
      break;
    case "nearest":
      rounded = Math.floor(unrounded + 0.5);
      break;
    default:
      throw new UniverseTimeError("INVALID_ROUNDING_MODE", "/roundingMode", "Universe time rounding mode is invalid.");
  }

  return createSimulationTick(rounded);
};

export const createUniverseClock = (initialTick         = 0)               => {
  const tick = createSimulationTick(initialTick);
  return Object.freeze({ tick, epochSeconds: convertTicksToSeconds(tick) });
};

export const createMissionTime = (initialTick         = 0)              =>
  Object.freeze({ tick: createSimulationTick(initialTick) });

export const validateUniverseTime = (value              , path = "")               => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UniverseTimeError("INCONSISTENT_UNIVERSE_TIME", path, "Universe time must be an object.");
  }
  const tick = createSimulationTick(value.tick, `${path}/tick`);
  const expectedSeconds = convertTicksToSeconds(tick);
  if (
    typeof value.epochSeconds !== "number" ||
    !Number.isFinite(value.epochSeconds) ||
    value.epochSeconds < 0 ||
    !Object.is(value.epochSeconds, expectedSeconds)
  ) {
    throw new UniverseTimeError(
      "INCONSISTENT_UNIVERSE_TIME",
      `${path}/epochSeconds`,
      "Universe epoch seconds must be derived exactly from the simulation tick."
    );
  }
  return Object.freeze({ tick, epochSeconds: expectedSeconds });
};

export const advanceUniverseTicks = (clock              , deltaTicks        )               => {
  const source = validateUniverseTime(clock);
  const delta = createSimulationTick(deltaTicks, "/deltaTicks");
  if (delta > Number.MAX_SAFE_INTEGER - source.tick) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/deltaTicks", "Universe tick advance exceeds MAX_SAFE_INTEGER.");
  }
  return createUniverseClock(source.tick + delta);
};

export const advanceUniverseSeconds = (
  clock              ,
  deltaSeconds        ,
  roundingMode                  
)               => advanceUniverseTicks(clock, convertSecondsToTicks(deltaSeconds, roundingMode));

export const advanceMissionTicks = (missionTime             , deltaTicks        )              => {
  const sourceTick = createSimulationTick(missionTime.tick, "/tick");
  const delta = createSimulationTick(deltaTicks, "/deltaTicks");
  if (delta > Number.MAX_SAFE_INTEGER - sourceTick) {
    throw new UniverseTimeError("TIME_OVERFLOW", "/deltaTicks", "Mission tick advance exceeds MAX_SAFE_INTEGER.");
  }
  return createMissionTime(sourceTick + delta);
};
