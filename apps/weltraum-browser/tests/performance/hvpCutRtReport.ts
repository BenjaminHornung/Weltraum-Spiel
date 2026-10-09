import {nearestRank} from "../e2e/hvp-performance-evidence";
import type {HvpPhysicsClock} from "../../src/hestia-prototype/physics/physicsWorker";
import {createHash} from "node:crypto";
import {lstat, mkdir, readFile, readdir, realpath, writeFile} from "node:fs/promises";
import path from "node:path";

export type HvpCutRtFailureStage = "preflight" | "browser-launch" | "attempt" | "cut" | "page-error" | "console-error"
  | "page-cleanup" | "browser-cleanup" | "final-inventory" | "artifact";

type HvpCutRtGpuInfo = {gpu: {devices: readonly {vendorId: number; deviceId: number; vendorString: string;
  deviceString: string; driverVendor: string; driverVersion: string}[]}};

/** Publish only the GPU identity/driver fields required by reference-device admission. */
export const projectHvpCutRtGpuInfo = (info: HvpCutRtGpuInfo) => ({gpu: {devices: info.gpu.devices.map(device => ({
  vendorId: device.vendorId, deviceId: device.deviceId, vendorString: device.vendorString,
  deviceString: device.deviceString, driverVendor: device.driverVendor, driverVersion: device.driverVersion
}))}});

/** Reporting boundary only: never serialize exception messages, stacks or launch/profile details. */
export const describeHvpCutRtFailure = (stage: HvpCutRtFailureStage, error: unknown) => {
  let type = "UnknownThrown", code: string | undefined;
  try {
    if (error instanceof Error) {
      const name = error.name;
      type = ["Error", "TypeError", "RangeError", "SyntaxError", "TimeoutError"].includes(name) ? name : "Error";
    }
    if (error !== null && typeof error === "object" && "code" in error) {
      const value = error.code;
      if (typeof value === "string" && ["EACCES", "EPERM", "ENOSPC", "ENOENT", "EEXIST", "EIO", "ETIMEDOUT", "ECONNREFUSED"].includes(value)) { code = value; }
    }
  } catch { type = "Error"; code = undefined; }
  return `${stage}: ${type}${code ? ` [${code}]` : ""}`;
};

/** Controlled action names retain the failing step without publishing arbitrary exception text. */
export const projectHvpCutRtOperationFailure=(operation:unknown,error:unknown)=>({
  operation:typeof operation==="string"&&["precondition","prepare-aim","prepare-play","prepare-tool","prepare-grounded",
    "prepare-body-aim","prepare-body-motion","prepare-preview","input","await-terminal","verify","await-health"].includes(operation)?operation:"UnknownOperation",
  problem:describeHvpCutRtFailure("cut",error)
});

const within = (root: string, file: string) => {
  const relative = path.relative(root, file);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};
const requireEvidenceDirectory = async (directory: string, app: string) => {
  const source = path.resolve("C:/IFI_SourceCode"), resolved = path.resolve(directory);
  if (!path.isAbsolute(directory) || !within(source, resolved) || within(app, resolved)) {
    throw new Error("Explicit external C:/IFI_SourceCode evidence directory required");
  }
  const actual = await realpath(resolved), actualApp = await realpath(app);
  if (path.relative(resolved, actual) !== "" || !within(source, actual) || within(actualApp, actual)) {
    throw new Error("Redirected evidence directory is not supported");
  }
  for (let ancestor = resolved; ; ancestor = path.dirname(ancestor)) {
    const entry = await lstat(ancestor);
    if (entry.isSymbolicLink() || !entry.isDirectory()) { throw new Error("Evidence ancestors must be ordinary directories"); }
    if (path.relative(source, ancestor) === "") { break; }
  }
};

export const createHvpCutRtEvidenceDirectory = async (root: string, app: string, name: string) => {
  await requireEvidenceDirectory(root, app);
  if (!name || path.basename(name) !== name || name === "." || name === "..") { throw new Error("Invalid evidence session name"); }
  const candidate = path.join(root, name);
  await mkdir(candidate);
  await requireEvidenceDirectory(candidate, app);
  return candidate;
};

export const writeHvpCutRtArtifact = async (directory: string, app: string, name: string, value: unknown) => {
  await requireEvidenceDirectory(directory, app);
  if (!name || path.basename(name) !== name || name === "." || name === "..") { throw new Error("Invalid evidence artifact name"); }
  await writeFile(path.join(directory, name), JSON.stringify(value, null, 2), {flag: "wx"});
};

export const inventoryHvpCutRtFiles = async (root: string, app: string): Promise<{path: string; sha256: string}[]> => {
  if (!within(app, root)) { throw new Error("Inventory must remain app-relative"); }
  const files: {path: string; sha256: string}[] = [];
  for (const entry of await readdir(root, {withFileTypes: true})) {
    const file = path.join(root, entry.name);
    if (entry.isSymbolicLink()) { throw new Error("Measurement source/build symlink is not supported"); }
    if (entry.isDirectory()) { files.push(...await inventoryHvpCutRtFiles(file, app)); }
    else if (entry.isFile()) { files.push({path: path.relative(app, file).replaceAll("\\", "/"), sha256: createHash("sha256").update(await readFile(file)).digest("hex")}); }
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
};

type BoundFile={path:string;bytes:number;sha256:string};
const boundRows=(value:unknown):BoundFile[]=>{
  if(!Array.isArray(value)||value.length===0||value.length>4096){throw new Error("Invalid product binding rows");}
  const seen=new Set<string>();
  for(const row of value){if(!row||typeof row.path!=="string"||row.path.length>512||row.path.includes("\\")||path.isAbsolute(row.path)
    ||row.path.split("/").some((part:string)=>part===".."||part==="."||part==="")||seen.has(row.path)
    ||!Number.isSafeInteger(row.bytes)||row.bytes<0||row.bytes>256*1024*1024||typeof row.sha256!=="string"||! /^[a-f0-9]{64}$/.test(row.sha256)){
    throw new Error("Invalid product binding row");}seen.add(row.path);}
  return value as BoundFile[];
};
// Matches the existing Python binder's json.dumps(rows, sort_keys=True) byte grammar.
const boundRowsHash=(rows:readonly BoundFile[])=>{
  const quoted=(value:string)=>JSON.stringify(value).replace(/[\u007f-\uffff]/g,c=>`\\u${c.charCodeAt(0).toString(16).padStart(4,"0")}`);
  return createHash("sha256").update(`[${rows.map(r=>`{"bytes": ${r.bytes}, "path": ${quoted(r.path)}, "sha256": ${quoted(r.sha256)}}`).join(", ")}]`).digest("hex");
};

/** Fresh actual HTTP bytes; historic baseline Source provenance stays explicitly historic. */
export const verifyHvpCutProductBinding=async(options:{app:string;buildRoot:string;servedReceiptPath:string;baseUrl:string;currentSource:boolean})=>{
  const wt=path.resolve(options.app,"../.."),url=new URL(options.baseUrl);
  if(url.protocol!=="http:"||!["127.0.0.1","localhost"].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=="/"){
    throw new Error("Product binding requires an explicit local preview root");}
  const ordinaryFile=async(file:string)=>{
    if(!within(wt,file)||!within(path.resolve("C:/IFI_SourceCode"),file)){throw new Error("Product binding path escapes workspace");}
    const entry=await lstat(file);
    if(entry.isSymbolicLink()||!entry.isFile()||(await realpath(file)).toLowerCase()!==path.resolve(file).toLowerCase()){
      throw new Error("Product binding requires ordinary local files");}
    return readFile(file);
  };
  const receiptBytes=await ordinaryFile(options.servedReceiptPath);
  if(receiptBytes.length>4*1024*1024){throw new Error("Product binding metadata too large");}
  const receipt=JSON.parse(receiptBytes.toString("utf8"));
  if(receipt.classification!=="NORMAL_PRODUCT_SERVED_BYTE_PROOF_NOT_GAME_QUALIFICATION"||receipt.normalProduct!==true||typeof receipt.sourceBinding!=="string"){
    throw new Error("Missing normal product served binding");}
  const sourcePath=path.resolve(wt,receipt.sourceBinding),sourceBytes=await ordinaryFile(sourcePath);
  if(sourceBytes.length>4*1024*1024){throw new Error("Source binding metadata too large");}
  const source=JSON.parse(sourceBytes.toString("utf8")),sourceRows=boundRows(source.source),builtRows=boundRows(receipt.built);
  const appPrefix=path.relative(wt,options.app).replaceAll("\\","/");
  if(sourceRows.some(row=>!row.path.startsWith(`${appPrefix}/src/`)&&!row.path.startsWith(`${appPrefix}/public/`)
    &&!["package.json","package-lock.json","tsconfig.json","vite.config.ts"].some(name=>row.path===`${appPrefix}/${name}`))){
    throw new Error("Source binding contains non-product paths");}
  if(boundRowsHash(sourceRows)!==source.sourceManifestHash||source.sourceManifestHash!==receipt.sourceManifestHash
    ||boundRowsHash(builtRows)!==receipt.buildManifestHash||sourceRows.length!==receipt.sourceFiles||builtRows.length!==receipt.servedFiles){
    throw new Error("Product binding manifest drift");}
  if(options.currentSource){
    const all=[...await inventoryHvpCutRtFiles(path.join(options.app,"src"),options.app),...await inventoryHvpCutRtFiles(path.join(options.app,"public"),options.app)];
    const expectedPaths=[...all.map(row=>`${appPrefix}/${row.path}`),...["package.json","package-lock.json","tsconfig.json","vite.config.ts"].map(name=>`${appPrefix}/${name}`)].sort();
    if(JSON.stringify(sourceRows.map(row=>row.path).sort())!==JSON.stringify(expectedPaths)){throw new Error("Current Source binding is incomplete");}
    for(const row of sourceRows){const bytes=await ordinaryFile(path.resolve(wt,row.path));
      if(bytes.length!==row.bytes||createHash("sha256").update(bytes).digest("hex")!==row.sha256){throw new Error("Current Source differs from bound product");}}
  }
  const inventory=await inventoryHvpCutRtFiles(options.buildRoot,options.app);
  const expected=builtRows.map(r=>({path:path.relative(options.app,path.resolve(options.buildRoot,r.path)).replaceAll("\\","/"),sha256:r.sha256}))
    .sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  if(JSON.stringify(inventory)!==JSON.stringify(expected)){throw new Error("Frozen build inventory drift");}
  for(const row of builtRows){const local=await ordinaryFile(path.resolve(options.buildRoot,row.path));
    const response=await fetch(new URL(row.path.split("/").map(encodeURIComponent).join("/"),url),{signal:AbortSignal.timeout(20_000),redirect:"error"});
    if(response.status!==200){throw new Error("Preview did not serve bound product file");}
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(local.length!==row.bytes||bytes.length!==row.bytes||createHash("sha256").update(local).digest("hex")!==row.sha256
      ||createHash("sha256").update(bytes).digest("hex")!==row.sha256){throw new Error("Preview bytes differ from frozen build");}
  }
  return {sourceManifestHash:source.sourceManifestHash as string,buildManifestHash:receipt.buildManifestHash as string,
    sourceProvenance:options.currentSource?"CURRENT_SOURCE_BYTES_VERIFIED":"HISTORICAL_SOURCE_BINDING",servedFiles:builtRows.length,
    servedReceiptSha256:createHash("sha256").update(receiptBytes).digest("hex"),sourceBindingSha256:createHash("sha256").update(sourceBytes).digest("hex")};
};

export const persistHvpCutRtReport = async (directory: string | undefined, app: string, report: {artifactFailures: string[]},
  attach: (body: Buffer) => Promise<unknown>) => {
  if (directory) {
    try { await writeHvpCutRtArtifact(directory, app, "report.json", report); return; }
    catch (error) { report.artifactFailures.push(describeHvpCutRtFailure("artifact", error)); }
  }
  try { await attach(Buffer.from(JSON.stringify(report, null, 2))); }
  catch (error) {
    report.artifactFailures.push(describeHvpCutRtFailure("artifact", error));
    throw new Error("Cut report attachment failed; artifact failure is not a successful run");
  }
};

const cutVariants = [
  {id: "quarry-box", scenario: "quarry", mode: 2, motion: "static"},
  {id: "quarry-sphere", scenario: "quarry", mode: 3, motion: "static"},
  {id: "rock-arm", scenario: "rock-arm", mode: 2, motion: "static"},
  {id: "body-box-moving", scenario: "body-box", mode: 2, motion: "moving"},
  {id: "body-box-sleeping", scenario: "body-box", mode: 2, motion: "sleeping"},
  {id: "body-sphere-moving", scenario: "body-sphere", mode: 3, motion: "moving"},
  {id: "body-sphere-sleeping", scenario: "body-sphere", mode: 3, motion: "sleeping"}
] as const;
export type HvpCutRtVariant = (typeof cutVariants)[number];

/** The runner consumes these exact sessions before any preflight or browser effect. */
export const planHvpCutRtSeries = (value?: string) => {
  const classification = value ?? "diagnostic";
  if (classification !== "diagnostic" && classification !== "qualification" && classification !== "measurement") {
    throw new Error("Unknown cut series classification");
  }
  const schedule = Object.freeze(classification === "measurement" ? [34, 33, 33] : classification === "qualification" ? [3] : [1]);
  const sessions = cutVariants.flatMap(variant => (["cold", "warm"] as const).flatMap(temperature =>
    schedule.map((attempts, index) => Object.freeze({variant: Object.freeze(variant), temperature, session: index + 1, attempts}))));
  return Object.freeze({classification, schedule, sessions: Object.freeze(sessions), doNotUseForAcceptance: classification !== "measurement"});
};

export interface HvpCutSample {
  readonly commandId: string;
  readonly scenario: "quarry" | "rock-arm" | "body-box" | "body-sphere";
  readonly temperature: "cold" | "warm";
  readonly outcome: "Applied" | "NoOp" | "Rejected" | "RecoveryHold" | "Timeout";
  readonly inputMs: number;
  readonly appliedMs: number | null;
  readonly firstCommittedRenderSubmitMs: number | null;
  readonly holdMs: number | null;
  readonly sourceGenerationBefore: number;
  readonly sourceGenerationAfter: number | null;
  readonly reason: string;
}

const scenarios = ["quarry", "rock-arm", "body-box", "body-sphere"] as const;
const temperatures = ["cold", "warm"] as const;
const outcomeCounts = () => ({Applied: 0, NoOp: 0, Rejected: 0, RecoveryHold: 0, Timeout: 0});
const finite = (value: number) => Number.isFinite(value) && value >= 0;
const generation = (value: number) => Number.isSafeInteger(value) && value >= 0;
const summary = (values: readonly number[]) => values.length === 0 ? null : {
  count: values.length, p50: nearestRank(values, .5), p95: nearestRank(values, .95),
  p99: nearestRank(values, .99), max: values.reduce((max, value) => Math.max(max, value), 0)
};

export interface HvpCutRawEntry {
  readonly name: string;
  readonly start: number;
  readonly duration: number;
  readonly detail: {readonly data?: Readonly<Record<string, unknown>>} | null;
}

export interface HvpCutRtAttemptRecord {
  attempt: number;
  status: "not-run" | "preparing" | "failed" | "completed";
  result: {readonly sample: HvpCutSample | null; readonly problems: readonly string[];
    readonly raw: {readonly entries: readonly HvpCutRawEntry[]; readonly dropped: number}} | null;
  warmup: HvpCutRtAttemptRecord["result"];
  problems: string[];
}
export interface HvpCutRtSessionEvidence {
  readonly variantId: HvpCutRtVariant["id"];
  readonly temperature: HvpCutSample["temperature"];
  readonly session: number;
  readonly failure: string | null;
  readonly records: readonly HvpCutRtAttemptRecord[];
}

/** Descriptive fourteen-population report; missing sessions/attempts never become zero-time cuts. */
export const summarizeHvpCutRtSessions = (series: ReturnType<typeof planHvpCutRtSeries>, reports: readonly HvpCutRtSessionEvidence[]) => {
  const seen = new Set<string>();
  for (const report of reports) {
    const session = series.sessions.find(value => value.variant.id === report.variantId
      && value.temperature === report.temperature && value.session === report.session);
    const key = `${report.variantId}/${report.temperature}/${report.session}`;
    if (!session || seen.has(key) || report.records.length !== session.attempts) {
      throw new Error("Cut evidence must bind one exact planned session and all its attempt records");
    }
    seen.add(key);
    for (let index = 0; index < report.records.length; index += 1) {
      const record = report.records[index];
      if (!record || record.attempt !== index + 1 || !["not-run", "preparing", "failed", "completed"].includes(record.status)) {
        throw new Error("Invalid planned cut attempt record");
      }
      if (record.result?.sample && (record.result.sample.scenario !== session.variant.scenario
        || record.result.sample.temperature !== session.temperature)) {
        throw new Error("Cut sample belongs to a different planned population");
      }
    }
  }
  const populations = cutVariants.flatMap(variant => (["cold", "warm"] as const).map(temperature => {
    const planned = series.sessions.filter(value => value.variant.id === variant.id && value.temperature === temperature);
    const received = reports.filter(value => value.variantId === variant.id && value.temperature === temperature);
    const records = received.flatMap(value => value.records);
    const samples = records.flatMap(record => record.result?.sample ? [record.result.sample] : []);
    const results = records.flatMap(record => record.result ? [record.result] : []);
    const plannedAttempts = planned.reduce((count, value) => count + value.attempts, 0);
    const descriptive = summarizeHvpCuts(samples);
    return {variantId: variant.id, temperature, plannedSessions: planned.length, reportedSessions: received.length,
      missingSessions: planned.length - received.length, plannedAttempts,
      notRun: plannedAttempts - records.length + records.filter(record => record.status === "not-run").length,
      preparing: records.filter(record => record.status === "preparing").length,
      failed: records.filter(record => record.status === "failed").length,
      completed: records.filter(record => record.status === "completed").length,
      missingSamples: plannedAttempts - samples.length, warmups: records.filter(record => record.warmup !== null).length,
      preconditionFailures: records.filter(record => record.status === "failed" && record.result === null).length,
      failures: received.flatMap(value => value.failure === null ? [] : [value.failure]),
      observedDrops: results.length === 0 ? null : results.reduce((count, result) => count + result.raw.dropped, 0),
      records, invalid: descriptive.invalid,
      summary: descriptive.groups.find(group => group.scenario === variant.scenario && group.temperature === temperature)!};
  }));
  return {acceptance: "NOT_ASSESSED" as const, classification: series.classification,
    doNotUseForAcceptance: series.doNotUseForAcceptance, plannedSessions: series.sessions.length,
    plannedAttempts: series.sessions.reduce((count, value) => count + value.attempts, 0), populations};
};

/** One already-scoped document/attempt. Missing input is not replaced by the automation clock. */
export function readHvpCutMarkers(entries: readonly HvpCutRawEntry[], commandId: string, body: boolean) {
  const prefix = body ? "hvp.cutBody" : "hvp.cut";
  const statuses = ["Applied", "NoOp", "Rejected", "RecoveryHold"] as const;
  const problems: string[] = [];
  const matching = entries.filter(entry => entry.detail?.data?.commandId === commandId);
  const one = (values: readonly HvpCutRawEntry[], label: string) => {
    if (values.length > 1) { problems.push(`Duplicate ${label} marker`); }
    const value = values.length === 1 ? values[0] : undefined;
    if (value && (!finite(value.start) || !finite(value.duration) || !Number.isFinite(value.start + value.duration))) {
      problems.push(`Invalid ${label} timing`); return undefined;
    }
    return value;
  };
  const input = one(matching.filter(entry => entry.name === `${prefix}InputMs`), "input");
  const terminal = one(matching.filter(entry => statuses.some(status => entry.name === `${prefix}InputTo${status}Ms`)), "terminal");
  const render = one(matching.filter(entry => entry.name === `${prefix}FirstCommittedRenderSubmitMs`), "render");
  if (!input) { problems.push("Missing exact input marker"); }
  else if (input.duration !== 0) { problems.push("Input marker is not an instant"); }
  const outcome = terminal ? statuses.find(status => terminal.name === `${prefix}InputTo${status}Ms`)! : null;
  if (terminal && terminal.start !== input?.start) { problems.push("Terminal belongs to a different input time"); }
  if (render && (outcome !== "Applied" || render.start !== input?.start
    || render.start + render.duration < terminal!.start + terminal!.duration)) {
    problems.push("Render is not after this Applied input");
  }
  return {inputMs: input?.start ?? null, outcome,
    appliedMs: outcome === "Applied" ? terminal!.start + terminal!.duration : null,
    firstCommittedRenderSubmitMs: outcome === "Applied" && render ? render.start + render.duration : null,
    renderBinding: render?.detail?.data ?? null, problems};
}

/** The worker's last clock is evidence only for its exact, completed Body command. */
export const readHvpBodyHoldForCommand=(clock:Pick<HvpPhysicsClock,"lastBodyHoldMs"|"lastBodyCommandId"|"lastBodyManualPause">|null,
  commandId:string):number|null=>{
  if(clock?.lastBodyCommandId!==commandId||clock.lastBodyManualPause!==false){return null;}
  const value=clock.lastBodyHoldMs;
  return typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;
};

/** A cached healthy status is not evidence for an endpoint published later. */
export const isHvpCutHealthFresh=(health:Readonly<{publishedOrigin?:number;publishedAt?:number;timingSinkFailures?:number|null}>|null,
  origin:number,endpoint:number):boolean=>
  health!==null&&Number.isFinite(origin)&&origin>=0&&Number.isFinite(endpoint)&&endpoint>=0
  &&health.publishedOrigin===origin&&typeof health.publishedAt==="number"&&Number.isFinite(health.publishedAt)
  &&health.publishedAt>=endpoint&&health.timingSinkFailures===0;

/** Descriptive only: runtime/source binding, planned attempts and device eligibility belong to the runner. */
export function summarizeHvpCuts(samples: readonly HvpCutSample[]) {
  if (!Array.isArray(samples)) {
    throw new Error("Cut samples must be an array");
  }
  const groups = scenarios.flatMap(scenario => temperatures.map(temperature => ({
    scenario, temperature, attempts: 0, outcomes: outcomeCounts(), invalidCount: 0,
    completeApplied: 0, incompleteApplied: 0,
    missing: {applied: 0, committedRender: 0, sourceGenerationAfter: 0, hold: 0},
     applied: [] as number[], render: [] as number[], appliedRender: [] as number[], hold: [] as number[]
  })));
  const outcomes = outcomeCounts();
  const invalid: {index: number; commandId: string | null; reasons: string[]}[] = [];
  let unknownOutcomes = 0, unclassifiedAttempts = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const row: HvpCutSample | undefined = samples[index];
    if (row === null || typeof row !== "object") {
      invalid.push({index, commandId: null, reasons: ["Invalid sample record"]});
      unknownOutcomes += 1;
      unclassifiedAttempts += 1;
      continue;
    }
    const group = groups.find(g => g.scenario === row.scenario && g.temperature === row.temperature);
    if (group) {
      group.attempts += 1;
    } else {
      unclassifiedAttempts += 1;
    }
    const reasons: string[] = [];
    if (!group) {
      reasons.push("Unknown scenario or temperature");
    }
    if (Object.hasOwn(outcomes, row.outcome)) {
      outcomes[row.outcome] += 1;
      if (group) {
        group.outcomes[row.outcome] += 1;
      }
    } else {
      unknownOutcomes += 1;
      reasons.push("Unknown outcome");
    }
    if (typeof row.commandId !== "string" || row.commandId.length === 0 || row.commandId.length > 128
      || typeof row.reason !== "string") {
      reasons.push("Invalid command identity or reason");
    }
    if (!finite(row.inputMs) || (row.appliedMs !== null && !finite(row.appliedMs))
      || (row.firstCommittedRenderSubmitMs !== null && !finite(row.firstCommittedRenderSubmitMs))
      || (row.holdMs !== null && !finite(row.holdMs))) {
      reasons.push("Invalid timing measurement");
    }
    if (finite(row.inputMs) && ((row.appliedMs !== null && finite(row.appliedMs) && row.appliedMs < row.inputMs)
      || (row.firstCommittedRenderSubmitMs !== null && finite(row.firstCommittedRenderSubmitMs)
        && row.firstCommittedRenderSubmitMs < (row.appliedMs ?? row.inputMs)))) {
      reasons.push("Reversed input/Applied/render timeline");
    }
    if (!generation(row.sourceGenerationBefore)
      || (row.sourceGenerationAfter !== null && (!generation(row.sourceGenerationAfter)
        || row.sourceGenerationAfter < row.sourceGenerationBefore))) {
      reasons.push("Invalid source generation");
    }
    if (row.outcome !== "Applied" && (row.appliedMs !== null || row.firstCommittedRenderSubmitMs !== null)) {
      reasons.push("Non-Applied outcome has success timestamps");
    }
    if (reasons.length > 0 || group === undefined) {
      invalid.push({index, commandId: typeof row.commandId === "string" ? row.commandId : null, reasons});
      if (group) {
        group.invalidCount += 1;
      }
      continue;
    }
    if (row.holdMs === null) {
      group.missing.hold += 1;
    } else {
      group.hold.push(row.holdMs);
    }
    if (row.outcome !== "Applied") {
      continue;
    }
    if (row.appliedMs === null) {
      group.missing.applied += 1;
    } else {
      group.applied.push(row.appliedMs - row.inputMs);
    }
    if (row.firstCommittedRenderSubmitMs === null) {
      group.missing.committedRender += 1;
    } else {
      group.render.push(row.firstCommittedRenderSubmitMs - row.inputMs);
    }
    if(row.appliedMs!==null&&row.firstCommittedRenderSubmitMs!==null){
      group.appliedRender.push(row.firstCommittedRenderSubmitMs-row.appliedMs);
    }
    if (row.sourceGenerationAfter === null) {
      group.missing.sourceGenerationAfter += 1;
    }
    if (row.appliedMs === null || row.firstCommittedRenderSubmitMs === null || row.sourceGenerationAfter === null) {
      group.incompleteApplied += 1;
    } else {
      group.completeApplied += 1;
    }
  }
  return {
    acceptance: "NOT_ASSESSED" as const, attempts: samples.length, outcomes, unknownOutcomes, unclassifiedAttempts, invalid,
    groups: groups.map(({applied, render, appliedRender, hold, ...group}) => ({...group,
      inputToAppliedMs: summary(applied), inputToCommittedRenderMs: summary(render),
      appliedToCommittedRenderMs:summary(appliedRender),holdMs: summary(hold)}))
  };
}
