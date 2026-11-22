export const PMD_PROFILE_ID = 'pmd.generated-global.candidate.v1' as const;
export const PMD_GENERATOR_VERSION = 'pmd.global-fbm3.v1' as const;
export const PMD_SEED = 'pmd.generated-global.r01' as const;
export const candidateProfile=(amplitudeMeters=2500)=>Object.freeze({id:PMD_PROFILE_ID,version:1,seed:PMD_SEED,amplitudeMeters,
  liquidEnvelope:'GeometricCandidateBelowDatum0' as const,materialPolicy:'ExplicitId0SolidRockAndUnusedAirSamples' as const});
export const PMD_PROVENANCE = Object.freeze({kind:'GeneratedCandidate' as const,
  note:'Candidate geography and geometric liquid envelope; not existing geography or physical inventory.'});
export const PMD_KNOWLEDGE = Object.freeze({physicalComposition:'UNKNOWN' as const,
  realReservoirInventory:'UNKNOWN' as const,biome:'UNKNOWN' as const});
