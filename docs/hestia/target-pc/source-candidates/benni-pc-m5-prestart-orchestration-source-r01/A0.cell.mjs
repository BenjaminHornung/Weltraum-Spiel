// SOURCE ONLY. Future execution requires a new human grant and Root-owned inputs.
const c = load("M5_PRESTART_A0_INPUT");
const spent = "call_f30a08a8ec0b4c53aec91a6cee248b8f:0";
const ps = "C:\\Users\\benni\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe";
const helper = "C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13\\.a0-runtime\\benni-pc-m5-prestart-orchestration-source-r01\\prestart.ps1";
const launch = "& 'C:\\Users\\benni\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe' -NoLogo -NoProfile -NonInteractive -NoExit -EncodedCommand JABFAHIAcgBvAHIAQQBjAHQAaQBvAG4AUAByAGUAZgBlAHIAZQBuAGMAZQA9ACcAUwB0AG8AcAAnADsAJABwAD0AWwBEAGkAYQBnAG4AbwBzAHQAaQBjAHMALgBQAHIAbwBjAGUAcwBzAF0AOgA6AEcAZQB0AEMAdQByAHIAZQBuAHQAUAByAG8AYwBlAHMAcwAoACkAOwB0AHIAeQB7AFsAQwBvAG4AcwBvAGwAZQBdADoAOgBPAHUAdAAuAFcAcgBpAHQAZQBMAGkAbgBlACgAJwBNADUAXwBFAE0AUABUAFkAXwBIAE8AUwBUAF8AUgBFAEEARABZADoAJwArACgAWwBvAHIAZABlAHIAZQBkAF0AQAB7AHAAaQBkAD0AJABQAEkARAA7AHAAcgBvAGMAZQBzAHMAUABhAHQAaAA9AFsARQBuAHYAaQByAG8AbgBtAGUAbgB0AF0AOgA6AFAAcgBvAGMAZQBzAHMAUABhAHQAaAA7AGMAcgBlAGEAdABpAG8AbgBVAHQAYwA9ACQAcAAuAFMAdABhAHIAdABUAGkAbQBlAC4AVABvAFUAbgBpAHYAZQByAHMAYQBsAFQAaQBtAGUAKAApAC4AVABvAFMAdAByAGkAbgBnACgAJwBvACcAKQA7AGMAcgBlAGEAdABpAG8AbgBGAGkAbABlAFQAaQBtAGUAPQAkAHAALgBTAHQAYQByAHQAVABpAG0AZQAuAFQAbwBGAGkAbABlAFQAaQBtAGUAVQB0AGMAKAApAC4AVABvAFMAdAByAGkAbgBnACgAKQA7AHYAZQByAHMAaQBvAG4APQAkAFAAUwBWAGUAcgBzAGkAbwBuAFQAYQBiAGwAZQAuAFAAUwBWAGUAcgBzAGkAbwBuAC4AVABvAFMAdAByAGkAbgBnACgAKQA7AGUAZABpAHQAaQBvAG4APQAkAFAAUwBWAGUAcgBzAGkAbwBuAFQAYQBiAGwAZQAuAFAAUwBFAGQAaQB0AGkAbwBuADsAZgByAGEAbQBlAHcAbwByAGsAPQBbAFIAdQBuAHQAaQBtAGUALgBJAG4AdABlAHIAbwBwAFMAZQByAHYAaQBjAGUAcwAuAFIAdQBuAHQAaQBtAGUASQBuAGYAbwByAG0AYQB0AGkAbwBuAF0AOgA6AEYAcgBhAG0AZQB3AG8AcgBrAEQAZQBzAGMAcgBpAHAAdABpAG8AbgA7AHAAbABhAHQAZgBvAHIAbQA9AFsARQBuAHYAaQByAG8AbgBtAGUAbgB0AF0AOgA6AE8AUwBWAGUAcgBzAGkAbwBuAC4AUABsAGEAdABmAG8AcgBtAC4AVABvAFMAdAByAGkAbgBnACgAKQA7AGMAbwByAGUATABpAGIAcgBhAHIAeQA9AFsAbwBiAGoAZQBjAHQAXQAuAEEAcwBzAGUAbQBiAGwAeQAuAEwAbwBjAGEAdABpAG8AbgA7AHUAdABjAD0AWwBEAGEAdABlAFQAaQBtAGUATwBmAGYAcwBlAHQAXQA6ADoAVQB0AGMATgBvAHcALgBUAG8AUwB0AHIAaQBuAGcAKAAnAG8AJwApAH0AfABDAG8AbgB2AGUAcgB0AFQAbwAtAEoAcwBvAG4AIAAtAEMAbwBtAHAAcgBlAHMAcwApACkAOwBbAEMAbwBuAHMAbwBsAGUAXQA6ADoATwB1AHQALgBGAGwAdQBzAGgAKAApAH0AZgBpAG4AYQBsAGwAeQB7ACQAcAAuAEQAaQBzAHAAbwBzAGUAKAApAH0A";
const payload = "$m5AttemptExit=1; try { & 'C:\\\\IFI_SourceCode\\\\Temp\\\\WeltraumSpiel\\\\artifacts\\\\hestia-target-pc-2026-10-13\\\\root-outer.ps1'; if ($null -ne $LASTEXITCODE) { $m5AttemptExit=[int]$LASTEXITCODE } } catch { [Console]::Error.WriteLine($_.Exception.ToString()) } finally { exit $m5AttemptExit }".replaceAll("\\\\", "\\") + "\r\n";
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
const r = { status: "HOLD", hostStarts: 0, payloadCalls: 0, exitRequests: 0, tools: [], metadataSessions: [], brokerHandles: "UNKNOWN", separateTtyEof: "UNKNOWN" };
let session, terminal = false, marker, payloadEndUtc;
function need(ok, why) { if (!ok) throw new Error(why); }
function appRemaining() { return c.appDeadlineEpochMs - Date.now(); }
async function meta(mode, extra = {}) {
  need(appRemaining() >= 10000, "Appturn remainder below exec Windows answer minimum");
  const responseEndUtc = mode === "OperatorWait" ? Number(marker.utcOrigin) + 120000 : Date.now() + 30000;
  const cmd = "& " + q(ps) + " -NoLogo -NoProfile -NonInteractive -File " + q(helper) +
    " -Mode " + q(mode) + " -InputJson " + q(JSON.stringify({ ...c, marker, ...extra }));
  let answer = await tools.exec_command({ cmd, shell: ps, login: false, workdir: c.cwd,
    yield_time_ms: Math.min(30000, appRemaining()), max_output_tokens: 5000 });
  r.tools.push({ mode, answer });
  let output = answer.output;
  const helperSession = answer.session_id;
  const handle = helperSession ? { sessionId: helperSession, terminal: false } : null;
  if (handle) r.metadataSessions.push(handle);
  while (answer.session_id) {
    const left = Math.min(appRemaining(), responseEndUtc - Date.now());
    need(left >= 5000, "Metadata terminal outside original native/UTC transport end");
    answer = await tools.write_stdin({ session_id: helperSession, chars: "",
      yield_time_ms: Math.min(5000, left), max_output_tokens: 5000 });
    r.tools.push({ mode: "MetadataTerminal", helperSession, answer });
    output += answer.output;
  }
  if (handle) handle.terminal = true;
  need(answer.exit_code === 0, "Metadata tool failed; no retry");
  return JSON.parse(output.trim());
}
try {
  need(c && c.appThread === "01a13648-c55b-7250-bf07-34921d70b43b" &&
    c.humanRef !== spent && c.humanRef && /^[0-9a-f]{64}$/.test(c.humanSha), "New explicit human binding required");
  need(appRemaining() >= 200000, "Insufficient unchanged Appturn lifetime");
  marker = await meta("Mark");
  r.marker = marker;
  const start = await tools.exec_command({ cmd: launch, shell: ps, login: false, tty: true,
    workdir: c.cwd, yield_time_ms: 10000, max_output_tokens: 3000 });
  r.hostStarts++; r.tools.push({ mode: "HostStart", answer: start });
  session = start.session_id;
  need(session && start.exit_code === undefined, "Exactly one live empty host required");
  const clean = start.output.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
  const match = clean.match(/M5_EMPTY_HOST_READY:(\{[^\r\n]*\})/);
  need(match, "Missing actual initial metadata");
  r.ready = JSON.parse(match[1]); r.sessionId = session;
  const waited = await meta("OperatorWait", { ready: r.ready, sessionId: session, rawLaunch: start });
  r.waited = waited;
  if (waited.accepted) {
    const admission = await meta("Admit", { ready: r.ready, sessionId: session });
    r.admission = admission;
    need(admission.accepted && admission.nativeElapsedMs <= 120000, "Native admission cutoff");
    // UTC is an additional earlier boundary, never a JS monotonic clock.
    need(Date.now() <= Number(marker.utcOrigin) + 120000 && appRemaining() >= 60000, "UTC/Appturn admission cutoff");
    r.payloadSentUtc = Date.now(); payloadEndUtc = Math.min(r.payloadSentUtc + 60000, c.appDeadlineEpochMs);
    r.payloadEndUtc = payloadEndUtc; r.payloadCalls++;
    const out = await tools.write_stdin({ session_id: session, chars: payload,
      yield_time_ms: Math.min(30000, payloadEndUtc - Date.now()), max_output_tokens: 12000 });
    r.tools.push({ mode: "Payload", answer: out });
    terminal = out.exit_code !== undefined;
    while (!terminal && Date.now() < payloadEndUtc) {
      // R04 owns unchanged native/UTC payload clocks. Terminal polling starts no metadata host.
      const remaining = Math.min(payloadEndUtc - Date.now(), appRemaining());
      if (remaining <= 0) break;
      const poll = await tools.write_stdin({ session_id: session, chars: "",
        yield_time_ms: Math.min(30000, remaining), max_output_tokens: 12000 });
      r.tools.push({ mode: "PayloadTerminalPoll", answer: poll });
      terminal = poll.exit_code !== undefined;
    }
    r.payloadTerminalWithin60 = terminal && Date.now() <= payloadEndUtc;
    r.status = r.payloadTerminalWithin60 ? "PAYLOAD_TERMINAL_OBSERVED_PENDING_ROOT_QUALIFICATION" : "HOLD_PAYLOAD_TRANSPORT_OR_TERMINAL_BOUND";
  } else {
    r.status = "HOLD_NO_TIMELY_ROOT_AUTHORITY";
  }
} catch (error) {
  r.failure = String(error); r.status = "HOLD";
} finally {
  if (session && !terminal) {
    r.exitRequestedUtc = Date.now(); r.exitRequests++;
    r.exitRequestedWithin120 = marker && Date.now() <= Number(marker.utcOrigin) + 120000;
    try {
      const remaining = Math.min(appRemaining(), r.payloadCalls ? payloadEndUtc - Date.now() :
        Number(marker.utcOrigin) + 150000 - Date.now());
      // yield is only answer waiting. It never kills or deadlines the process.
      const exit = await tools.write_stdin({ session_id: session, chars: "exit 0\r\n",
        yield_time_ms: Math.max(1, Math.min(30000, remaining)), max_output_tokens: 3000 });
      r.tools.push({ mode: "Exit", answer: exit }); terminal = exit.exit_code !== undefined;
      while (!terminal) {
        const left = Math.min(appRemaining(), (r.payloadCalls ? payloadEndUtc : Number(marker.utcOrigin) + 180000) - Date.now());
        if (left <= 0) break;
        const poll = await tools.write_stdin({ session_id: session, chars: "",
          yield_time_ms: Math.min(5000, left), max_output_tokens: 3000 });
        r.tools.push({ mode: "ExitTerminalPoll", answer: poll }); terminal = poll.exit_code !== undefined;
      }
    } catch (error) { r.cleanupFailure = String(error); }
  }
  r.terminalObserved = terminal; r.terminalObservedUtc = Date.now();
  if (r.payloadCalls && terminal && Date.now() <= payloadEndUtc && !r.failure && !r.cleanupFailure) {
    r.payloadTerminalWithin60 = true;
    r.status = "PAYLOAD_TERMINAL_OBSERVED_PENDING_ROOT_QUALIFICATION";
  }
  r.prestartWithin180 = !!marker && (r.payloadCalls > 0 ||
    (terminal && Date.now() <= Number(marker.utcOrigin) + 180000));
  if (!terminal || !r.prestartWithin180 || (r.payloadCalls === 0 && r.exitRequestedWithin120 !== true))
    r.status = "HOLD_TRANSPORT_OR_PRESTART_BOUND";
  for (const handle of r.metadataSessions.filter(h => !h.terminal)) {
    try {
      while (!handle.terminal) {
        const left = Math.min(appRemaining(), (r.payloadCalls ? payloadEndUtc : Number(marker.utcOrigin) + 180000) - Date.now());
        if (left < 5000) break;
        const poll = await tools.write_stdin({ session_id: handle.sessionId, chars: "",
          yield_time_ms: Math.min(5000, left), max_output_tokens: 5000 });
        r.tools.push({ mode: "MetadataFinallyTerminal", answer: poll });
        handle.terminal = poll.exit_code !== undefined;
      }
    } catch (error) { handle.failure = String(error); }
    if (!handle.terminal) r.status = "HOLD_UNOBSERVED_OWN_METADATA_TERMINAL";
  }
  if (r.ready && appRemaining() >= 10000 && (!r.payloadCalls || Date.now() + 10000 <= payloadEndUtc)) {
    try { r.finalNativeObservation = await meta("Observe", { ready: r.ready, sessionId: session }); }
    catch (error) { r.observationFailure = String(error); r.status = "HOLD"; }
  }
  store("M5_PRESTART_A0_RESULT", r); text(r);
}

