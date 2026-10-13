import {
  PORT_IDS,
  validateBorrowedPort
} from "./chunk-S5TZ5I4R.mjs";
import {
  validateFrame
} from "./chunk-6PZDKU43.mjs";

// src/temporal-boundary.ts
function prepareTemporalRequests(frame, frozenWeather, owners = {}) {
  const sourceFrame = validateFrame(frame);
  const weather = sourceFrame.status === "Known" ? { status: "Known", frozenResult: frozenWeather, authoredMask: null } : { status: "NoAtmosphere", frozenResult: frozenWeather };
  const results = PORT_IDS.map((port) => validateBorrowedPort({ ...owners[port], port, sourceFrame, weather }));
  return { results, completeActualBundles: 0, temporalReady: false, pipelineOptions: "BOTH_OPEN", resourceDisposal: "PRODUCER_ONLY" };
}
export {
  prepareTemporalRequests
};
