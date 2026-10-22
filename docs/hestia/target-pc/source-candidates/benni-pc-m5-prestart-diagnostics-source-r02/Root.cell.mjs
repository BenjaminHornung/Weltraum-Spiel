// SOURCE ONLY. Root alone prepares M5_PRESTART_ROOT_INPUT after a new human grant.
const c = load("M5_PRESTART_ROOT_INPUT");
const ps = "C:\\Users\\benni\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe";
const helper = "C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13\\.a0-runtime\\benni-pc-m5-prestart-diagnostics-source-r01\\prestart.ps1";
const q = s => "'" + String(s).replaceAll("'", "''") + "'";
const evidence = [];
const ownSessions = [];
async function invoke(mode, extra = {}) {
  const remaining = c.appDeadlineEpochMs - Date.now();
  if (remaining < 10000) throw new Error("Root Appturn remainder below exec answer minimum");
  const cmd = "& " + q(ps) + " -NoLogo -NoProfile -NonInteractive -File " + q(helper) +
    " -Mode " + q(mode) + " -InputJson " + q(JSON.stringify({ ...c, ...extra }));
  const issueEvidence = mode === "Issue" ? { mode, appSnapshot: extra.appSnapshot,
    toolCallStartedUtc: Date.now() } : null;
  if (issueEvidence) evidence.push(issueEvidence);
  let answer;
  try {
    answer = await tools.exec_command({ cmd, shell: ps, login: false, workdir: c.cwd,
      yield_time_ms: Math.min(30000, remaining), max_output_tokens: 5000 });
  } catch (error) {
    if (issueEvidence) issueEvidence.toolError = String(error);
    throw error;
  } finally {
    if (issueEvidence) issueEvidence.toolCallEndedUtc = Date.now();
  }
  if (issueEvidence) issueEvidence.answer = answer;
  else evidence.push({ mode, answer });
  if (answer.session_id) {
    const handle = { sessionId: answer.session_id, terminal: false };
    ownSessions.push(handle);
    let output = answer.output;
    // Native wait has its own immutable deadline; empty observations only.
    let next = answer;
    while (next.session_id) {
      const left = c.appDeadlineEpochMs - Date.now();
      if (left < 5000) throw new Error("Root native wait unobserved at Appturn end");
      next = await tools.write_stdin({ session_id: answer.session_id, chars: "",
        yield_time_ms: Math.min(5000, left), max_output_tokens: 5000 });
      evidence.push({ mode: "RootNativeTerminal", answer: next });
      output += next.output;
    }
    handle.terminal = true;
    if (next.exit_code !== 0) throw new Error("Root native wait/issuer failed");
    return JSON.parse(output.trim());
  }
  if (answer.exit_code !== 0) throw new Error("Root native wait/issuer failed");
  return JSON.parse(answer.output.trim());
}
try {
  if (!c || c.humanRef === "call_f30a08a8ec0b4c53aec91a6cee248b8f:0") throw new Error("Spent human reference denied");
  // Operational readiness only; no armed/authority record is written here.
  text({ status: "ROOT_CONTROLLER_WAITING_NOT_AUTHORITY" });
  const ready = await invoke("RootWait");
  const raw = await tools.mcp__codex_app__read_thread({ threadId: c.appThread, turnLimit: 1,
    includeOutputs: false, maxOutputCharsPerItem: 100 });
  const doc = JSON.parse(raw.content.find(x => x.type === "text").text);
  const turn = doc.turns[0];
  evidence.push({ mode: "AppSnapshotGuard", observedUtc: Date.now(),
    observed: { threadId: doc?.thread?.id ?? null, cwd: doc?.thread?.cwd ?? null,
      threadStatusType: doc?.thread?.status?.type ?? null, turnId: turn?.id ?? null,
      turnStatus: turn?.status ?? null, startedAt: turn?.startedAt ?? null },
    comparisons: { threadIdMatches: doc?.thread?.id === c.appThread,
      cwdMatches: doc?.thread?.cwd === c.cwd, threadStatusActive: doc?.thread?.status?.type === "active",
      turnIdMatches: turn?.id === c.appTurn, turnInProgress: turn?.status === "inProgress",
      startedAtMatches: turn?.startedAt * 1000 === c.appStartEpochMs } });
  if (doc.thread.id !== c.appThread || doc.thread.cwd !== c.cwd ||
    doc.thread.status.type !== "active" || turn.id !== c.appTurn || turn.status !== "inProgress" ||
    turn.startedAt * 1000 !== c.appStartEpochMs) throw new Error("Independent current App snapshot drift");
  const result = await invoke("Issue", { ready, appSnapshot: { thread: doc.thread.id, turn: turn.id,
    status: turn.status, startedAt: turn.startedAt, cwd: doc.thread.cwd, observedUtc: Date.now() } });
  text(result);
} catch (error) { text({ status: "HOLD_NO_RETRY", failure: String(error) }); }
finally {
  for (const h of ownSessions.filter(x => !x.terminal)) {
    while (!h.terminal && c.appDeadlineEpochMs - Date.now() >= 5000) {
      try {
        const out = await tools.write_stdin({ session_id: h.sessionId, chars: "",
          yield_time_ms: Math.min(5000, c.appDeadlineEpochMs - Date.now()), max_output_tokens: 5000 });
        evidence.push({ mode: "RootFinallyTerminal", answer: out });
        h.terminal = out.exit_code !== undefined;
      } catch (error) { h.failure = String(error); break; }
    }
  }
  store("M5_PRESTART_ROOT_TOOL_EVIDENCE", { evidence, ownSessions, brokerHandles: "UNKNOWN", separateTtyEof: "UNKNOWN" });
}


