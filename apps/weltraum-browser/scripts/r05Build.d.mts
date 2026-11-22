export function readR05Bundle(appRoot: string, profile: { labArtifactId: string; wasmSha256: string }, buildRoot?: string): Promise<{
  labArtifactId: string;
  worker: string;
  workerSha256: string;
  binary: string;
  wasmSha256: string;
}>;
