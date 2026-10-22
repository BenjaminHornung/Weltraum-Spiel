import {requireRuntimeGrant} from '../benni-pc-native24-source-r01/diagnostic-boundary.mjs';
requireRuntimeGrant();

const {default: fs} = await import('node:fs');
const {default: path} = await import('node:path');
const {pathToFileURL} = await import('node:url');
const {createHash} = await import('node:crypto');
if (!process.send || !process.connected) throw new Error("Actual owned Node IPC child required");
const request = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const bytes = fs.readFileSync(request.input.path);
if (bytes.length !== request.input.bytes || createHash("sha256").update(bytes).digest("hex") !== request.input.sha256)
  throw new Error("Child input binding drift");
const input = JSON.parse(bytes);
let context, started = false, cancelled = false;
const send = message => new Promise((resolve, reject) => process.send({...message, token: request.token}, error => error ? reject(error) : resolve()));

process.on("message", async message => {
  if (message?.token !== request.token) return;
  if (message.type === "cancel") {
    cancelled = true;
    if (context) await context.cancelCurrentRun("keyboard-input");
    return;
  }
  if (message.type !== "start" || started) return;
  started = true;
  let primary, primaryPresent = false, closeResolved = false;
  try {
    const {createVitest} = await import(pathToFileURL(input.frameworkNode.path).href);
    context = await createVitest("test", {
      root: request.cwd, config: path.join(request.cwd, "native24.vitest.config.mjs"), configLoader: "native",
      watch: false, testNamePattern: request.pattern, reporters: ["json"],
      outputFile: request.report, api: false, teardownTimeout: 60000
    }, {cacheDir: path.join(request.cwd, "cache")});
    await send({type: "framework-ready", profile: request.profile, kind: request.kind});
    if (!cancelled) await context.start([]);
  } catch (error) {
    primaryPresent = true; primary = error;
  } finally {
    try { if (context) { await context.close(); closeResolved = true; } }
    catch (error) { if (!primaryPresent) { primaryPresent = true; primary = error; } }
    await send({type: "terminal", primaryPresent,
      error: primaryPresent ? String(primary) : null, cancelled, closeResolved,
      exit: primaryPresent || cancelled ? 1 : process.exitCode ?? 0,
      cleanup: "FRAMEWORK_CLOSE_RETURN_ONLY_NO_OS_FAMILY_PROOF"});
    process.exitCode = primaryPresent || cancelled ? 1 : process.exitCode ?? 0;
    process.disconnect();
  }
});
