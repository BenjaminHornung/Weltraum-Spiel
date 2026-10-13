import { results } from "./assertions.js";
import "./cases.js";
import "./ownership-cases.js";
if (results.length !== 23)
    throw new Error("Expected exactly23 independent source/mock cases");
console.log(JSON.stringify({ classification: "CPU_SOURCE_MOCK_NOT_NATIVE", count: results.length, results, native24: "NOT_RUN", physicalHeap: "UNPROVEN" }));
