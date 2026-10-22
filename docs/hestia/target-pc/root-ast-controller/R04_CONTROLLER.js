async function executeR04(tools, text, load) {
  const cache = load("hestiaAstR04PreparedCache");
  const reply = load("hestiaAstR04DirectReply");
  const expectedQuestionItemId = load("hestiaAstR04ExpectedQuestionItemId");
  if (!cache || cache.schema !== "hestia.ast-r04.prepared-cache.v1" || cache.status !== "PRELOADED_SOURCE_ONLY_NO_AUTHORITY" || !cache.integrityVerified) throw new Error("HOLD_R04_CACHE_MISSING_OR_UNVERIFIED");
  if (!Array.isArray(cache.sourcePins) || cache.sourcePins.length === 0 || cache.sourcePins.some(x => !x.path || !Number.isInteger(x.bytes) || !/^[0-9a-f]{64}$/.test(x.sha256))) throw new Error("HOLD_R04_CACHE_PINS_INVALID");
  const oldQuestionCallIds = new Set(["call_cf1f33842b8b4ec0ab389519c038342b", "call_f30158c63d7d4a89ae96a25993496081", "call_fa23d8dee57841c88a794f14d300faa6", "call_1e53fac611fb474992903fc38827bccf", "call_392873b8b8ae4f39bca54c96f0cb2255", "call_5614e5cf87614c769b4ab405dd4b0ca0", "call_a2a72f2f2f794a1286d241bcda7bfdd2"]);
  let triple = null; try { triple = JSON.parse(reply?.questionItemId); } catch {}
  if (!Array.isArray(triple) || triple.length !== 3 || triple[0] !== "request_user_input_async" || triple[2] !== 0 || typeof triple[1] !== "string" || !triple[1].startsWith("call_") || oldQuestionCallIds.has(triple[1]) ||
      typeof expectedQuestionItemId !== "string" || reply?.questionItemId !== expectedQuestionItemId || reply?.source !== "DIRECT_CURRENT_HUMAN_REPLY" || reply?.scope !== "CORE_MATERIAL_POISON_AST_R04_ONCE" || reply?.answer !== "JA_CORE_MATERIAL_POISON_AST_R04_ONCE" || reply?.approved !== true) throw new Error("HOLD_NO_MATCHING_NEW_DIRECT_R04_APPROVAL");

  const clockMs = async () => { const r = await tools.clock__curr_time({}); const n = Date.parse(r.current_time); if (!Number.isFinite(n)) throw new Error("HOLD_INVALID_CLOCK"); return n; };
  const psQuote = s => "'" + s.replaceAll("'", "''") + "'";
  const writeOnce = async (path, value, label) => {
    const raw = JSON.stringify(value, null, 2) + "\n";
    const cmd = "$ErrorActionPreference='Stop';$p=" + psQuote(path) + ";$raw=" + psQuote(raw) + ";$u=[Text.UTF8Encoding]::new($false,$true);$b=$u.GetBytes($raw);$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($b,0,$b.Length);$s.Flush($true)}finally{$s.Dispose()};$r=[IO.File]::ReadAllBytes($p);$h=(Get-FileHash $p -Algorithm SHA256).Hash.ToLowerInvariant();if($u.GetString($r)-cne$raw){throw 'READBACK'};[pscustomobject]@{path=$p;bytes=$r.Length;sha256=$h;rawText=$raw}|ConvertTo-Json -Compress";
    const out = await tools.exec_command({shell:cache.pwsh,login:false,cmd,yield_time_ms:10000,max_output_tokens:10000});
    if (out.exit_code !== 0) throw new Error("STOP_" + label + ":" + (out.output || ""));
    const pin = JSON.parse(out.output.trim()); if (pin.path !== path || pin.rawText !== raw || !/^[0-9a-f]{64}$/.test(pin.sha256)) throw new Error("STOP_" + label + "_READBACK"); return pin;
  };

  const t0 = await clockMs();
  const rootEnd = t0 + 900000;
  const initial = {schema:"hestia.core-material-poison-ast-r04-initial-consumption.v1",status:"SPENT_INITIAL_CONSUMPTION_AWAITING_REAL_A0_BINDING",questionItemId:reply.questionItemId,answer:reply.answer,approved:true,source:reply.source,scope:reply.scope,consumedUtc:new Date(t0).toISOString(),templatePath:cache.template.path,templateSha256:cache.template.sha256,rootStartedEpochMs:t0,rootAbsoluteEndEpochMs:rootEnd,attempts:1,retry:0,retryPermitted:false};
  const initialPin = await writeOnce(cache.controls.initial, initial, "INITIAL_CONSUMPTION");
  const recheckRows=cache.sourcePins.map((p,i)=>"@("+psQuote(p.path)+","+p.bytes+","+psQuote(p.sha256)+")").join(",");
  const recheckCmd="$ErrorActionPreference='Stop';$rows=@("+recheckRows+");foreach($x in $rows){$i=Get-Item -LiteralPath $x[0];$h=(Get-FileHash $x[0] -Algorithm SHA256).Hash.ToLowerInvariant();if($i.Length-ne$x[1]-or$h-cne$x[2]){throw ('FRESH_SOURCE_PIN_MISMATCH:'+$x[0])}};'SOURCE_RECHECK_PASS'";
  const recheck=await tools.exec_command({shell:cache.pwsh,login:false,cmd:recheckCmd,yield_time_ms:10000,max_output_tokens:500});
  if(recheck.exit_code!==0||!recheck.output.includes("SOURCE_RECHECK_PASS"))throw new Error("STOP_FRESH_SOURCE_RECHECK");
  if (await clockMs() >= Math.min(t0 + 90000, rootEnd)) throw new Error("STOP_BEFORE_SINGLE_DISPATCH_DEADLINE");
  const sent = await tools.mcp__codex_app__send_message_to_thread({threadId:cache.owner.app,hostId:"local",prompt:cache.a0Prompt});
  if (sent.isError) throw new Error("STOP_SINGLE_DISPATCH_FAILED");
  const sentObj = JSON.parse(sent.content.find(x=>x.type==="text")?.text || "null"); if (sentObj?.threadId !== cache.owner.app) throw new Error("STOP_SINGLE_DISPATCH_OWNER_MISMATCH");

  let poll, latest, delay = 1000;
  for (;;) {
    const now = await clockMs(); if (now >= Math.min(t0 + 90000, rootEnd)) throw new Error("STOP_BINDING_DEADLINE");
    const snap = await tools.mcp__codex_app__wait_threads({targets:[{threadId:cache.owner.app,hostId:"local"}],timeoutMs:0}); if (snap.isError) throw new Error("STOP_BINDING_SNAPSHOT");
    const data = JSON.parse(snap.content.find(x=>x.type==="text")?.text || "null"); poll=data?.polls?.[0]; latest=poll?.latestTurn;
    if (poll?.thread?.id && poll.thread.id !== cache.owner.app) throw new Error("STOP_FOREIGN_OWNER");
    if (poll?.thread?.hostId !== undefined && poll.thread.hostId !== "local") throw new Error("STOP_FOREIGN_HOST");
    if (latest?.id === cache.spentR03.previousTurnId && latest.status !== "completed") throw new Error("STOP_LAST_G01_NOT_COMPLETED");
    if (latest && latest.id !== cache.spentR03.previousTurnId) { if (typeof poll.cursor !== "string") throw new Error("STOP_NEW_TURN_CURSOR_INVALID"); if (latest.status !== "inProgress") throw new Error("STOP_NEW_TURN_NOT_IN_PROGRESS"); break; }
    await new Promise(resolve=>setTimeout(resolve,delay)); delay=Math.min(delay*2,5000);
  }
  const read = await tools.mcp__codex_app__read_thread({threadId:cache.owner.app,hostId:"local",turnLimit:1,includeOutputs:false,maxOutputCharsPerItem:200}); if (read.isError) throw new Error("STOP_BINDING_READ");
  const rt=JSON.parse(read.content.find(x=>x.type==="text")?.text||"null"), thread=rt?.thread, turn=rt?.turns?.[0];
  if (thread?.id!==cache.owner.app || thread?.hostId!=="local" || thread?.cwd!==cache.owner.cwd || thread?.status?.type!=="active" || turn?.id!==latest?.id || turn?.status!=="inProgress" || !Number.isFinite(turn?.startedAt)) throw new Error("STOP_TURN_OWNER_BINDING");
  const actualStart=turn.startedAt*1000, nowBound=await clockMs(); if (!Number.isSafeInteger(actualStart) || actualStart<t0 || actualStart>nowBound || nowBound>=t0+90000) throw new Error("STOP_TURN_CLOCK_BINDING");
  const head=await tools.exec_command({shell:cache.pwsh,login:false,cmd:cache.headCommand,sandbox_permissions:"require_escalated",justification:"Read the pinned same-A0 HEAD without optional locks; no Git writes.",yield_time_ms:10000,max_output_tokens:200});
  if(head.exit_code!==0||head.output.trim()!==cache.owner.head)throw new Error("STOP_HEAD_DRIFT");
  const appEnd=Math.min(actualStart+600000,rootEnd); if(await clockMs()>=appEnd)throw new Error("STOP_APP_DEADLINE");
  const owner={app:cache.owner.app,cwd:cache.owner.cwd,head:cache.owner.head,hostId:"local",turnId:turn.id,startedAtUnixSeconds:turn.startedAt,actualStartEpochMs:actualStart,appDeadlineEpochMs:appEnd,rootAbsoluteEndEpochMs:rootEnd};
  const task={schema:"hestia.core-material-poison-ast-r04-final-task.v1",status:"FINAL_TASK_BOUND_AWAITING_ROOT_READY",attempt:"CORE_MATERIAL_POISON_AST_R04",scope:cache.scope,owner,initialConsumption:{path:initialPin.path,sha256:initialPin.sha256},sourcePins:cache.sixInputs,runner:cache.runner,retry:0,retryPermitted:false};
  const taskPin=await writeOnce(cache.controls.task,task,"FINAL_TASK");
  const approval={schema:"hestia.core-material-poison-ast-r04-human-approval.v1",status:"DIRECT_INITIAL_R04_AUTHORITY_BOUND_TO_FINAL_TASK",questionItemId:reply.questionItemId,answer:reply.answer,approved:true,scope:reply.scope,taskSha256:taskPin.sha256,initialConsumptionSha256:initialPin.sha256,turnId:turn.id,ownerApp:cache.owner.app,appDeadlineEpochMs:appEnd};
  const approvalPin=await writeOnce(cache.controls.approval,approval,"APPROVAL");
  const consumed={schema:"hestia.core-material-poison-ast-r04-final-consumption.v1",status:"SPENT_FINAL_GRANT_ROOT_READY_PENDING",attempt:"CORE_MATERIAL_POISON_AST_R04",scope:cache.scope,taskSha256:taskPin.sha256,approvalSha256:approvalPin.sha256,initialConsumptionSha256:initialPin.sha256,turnId:turn.id,ownerApp:cache.owner.app,cwd:owner.cwd,head:owner.head,actualStartEpochMs:actualStart,appDeadlineEpochMs:appEnd,rootAbsoluteEndEpochMs:rootEnd,attempts:1,retry:0,retryPermitted:false};
  const consumedPin=await writeOnce(cache.controls.consumption,consumed,"CONSUMPTION");
  const ready={schema:"hestia.core-material-poison-ast-r04-root-ready.v1",status:"ROOT_READY_FINAL_CHAIN_FULLY_READ_BACK",attempt:"CORE_MATERIAL_POISON_AST_R04",scope:cache.scope,taskSha256:taskPin.sha256,approvalSha256:approvalPin.sha256,initialConsumptionSha256:initialPin.sha256,finalConsumptionSha256:consumedPin.sha256,turnId:turn.id,ownerApp:cache.owner.app,cwd:owner.cwd,head:owner.head,actualStartEpochMs:actualStart,appDeadlineEpochMs:appEnd,rootAbsoluteEndEpochMs:rootEnd};
  const beforeReady=await clockMs(); if(beforeReady>=Math.min(t0+90000,appEnd))throw new Error("STOP_READY_DEADLINE");
  const pendingPin=await writeOnce(cache.controls.readyPending,ready,"READY_PENDING");
  if(await clockMs()>=Math.min(t0+90000,appEnd))throw new Error("STOP_READY_PUBLISH_DEADLINE");
  const chainPins=[initialPin,taskPin,approvalPin,consumedPin,pendingPin];
  const chainChecks=chainPins.map((p,i)=>"$p"+i+"="+psQuote(p.path)+";$b"+i+"=[IO.File]::ReadAllBytes($p"+i+");$h"+i+"=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b"+i+")).ToLowerInvariant();$x"+i+"=$u.GetString($b"+i+");if($b"+i+".Length -ne "+p.bytes+" -or $h"+i+" -cne "+psQuote(p.sha256)+" -or $x"+i+" -cne "+psQuote(p.rawText)+"){throw 'FRESH_CHAIN_READBACK_"+i+"'}").join(";");
  const moveCmd="$ErrorActionPreference='Stop';$u=[Text.UTF8Encoding]::new($false,$true);"+chainChecks+";$p="+psQuote(cache.controls.readyPending)+";$r="+psQuote(cache.controls.ready)+";$n=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();if($n -ge "+(t0+90000)+" -or $n -ge "+appEnd+"){throw 'READY_MOVE_DEADLINE'};if(Test-Path $r){throw 'READY_EXISTS'};[IO.File]::Move($p,$r,$false);$h=(Get-FileHash $r -Algorithm SHA256).Hash.ToLowerInvariant();[pscustomobject]@{path=$r;sha256=$h}|ConvertTo-Json -Compress";
  const moved=await tools.exec_command({shell:cache.pwsh,login:false,cmd:moveCmd,yield_time_ms:10000,max_output_tokens:500}); if(moved.exit_code!==0)throw new Error("STOP_READY_PUBLISH"); const movedPin=JSON.parse(moved.output.trim()); if(movedPin.sha256!==pendingPin.sha256)throw new Error("STOP_READY_HASH");const readyPin={path:movedPin.path,bytes:pendingPin.bytes,sha256:movedPin.sha256,rawText:pendingPin.rawText};

  let cursor=poll.cursor;
  for(;;){const n=await clockMs();if(n>=rootEnd)throw new Error("STOP_ROOT_CLOSEOUT_DEADLINE");const w=await tools.mcp__codex_app__wait_threads({targets:[{threadId:cache.owner.app,hostId:"local",afterCursor:cursor}],timeoutMs:Math.min(60000,rootEnd-n)});if(w.isError)throw new Error("STOP_CLOSEOUT_WAIT");const d=JSON.parse(w.content.find(x=>x.type==="text")?.text||"null"),p=d?.polls?.[0];if(p?.thread?.id!==cache.owner.app||p?.thread?.hostId!==owner.hostId||p?.latestTurn?.id!==turn.id)throw new Error("STOP_CLOSEOUT_TURN_CHANGED");cursor=p.cursor||cursor;if(p.latestTurn.status==="completed"){if(p.latestTurn.completedAt*1000>appEnd||p.latestTurn.durationMs>600000)throw new Error("STOP_APP_COMPLETED_LATE");break;}if(p.latestTurn.status!=="inProgress")throw new Error("STOP_APP_ATTENTION");}
  const terminalRead=await tools.mcp__codex_app__read_thread({threadId:cache.owner.app,hostId:"local",turnLimit:1,includeOutputs:false,maxOutputCharsPerItem:200});if(terminalRead.isError)throw new Error("STOP_TERMINAL_READ");
  const terminalData=JSON.parse(terminalRead.content.find(x=>x.type==="text")?.text||"null"),terminalThread=terminalData?.thread,terminalTurn=terminalData?.turns?.[0];
  if(terminalThread?.id!==cache.owner.app||terminalThread?.cwd!==cache.owner.cwd||terminalThread?.hostId!=="local"||terminalTurn?.id!==turn.id||terminalTurn?.status!=="completed"||!Number.isFinite(terminalTurn.startedAt)||!Number.isFinite(terminalTurn.completedAt)||!Number.isFinite(terminalTurn.durationMs)||terminalTurn.startedAt!==turn.startedAt||terminalTurn.completedAt*1000>appEnd||terminalTurn.durationMs>600000)throw new Error("STOP_TERMINAL_METADATA_INVALID");
  const evidenceRoot=cache.owner.cwd+"\\.a0-runtime\\benni-pc-core-material-poison-ast-once-r04",receiptPath=evidenceRoot+"\\evidence\\CORE_MATERIAL_POISON_AST.json",resultPath=evidenceRoot+"\\evidence\\CORE_MATERIAL_POISON_AST_A0_RESULT.json";
  const evidencePaths=[receiptPath,resultPath,taskPin.path,approvalPin.path,initialPin.path,consumedPin.path,cache.controls.ready];
  const evidenceCmd="$ErrorActionPreference='Stop';$u=[Text.UTF8Encoding]::new($false,$true);$paths=@("+evidencePaths.map(psQuote).join(",")+");$rows=@();foreach($p in $paths){$b=[IO.File]::ReadAllBytes($p);$rows+=@([pscustomobject]@{path=$p;bytes=$b.Length;sha256=(Get-FileHash $p -Algorithm SHA256).Hash.ToLowerInvariant();rawText=$u.GetString($b)})};$rows|ConvertTo-Json -Depth 4 -Compress";
  const evidenceRead=await tools.exec_command({shell:cache.pwsh,login:false,cmd:evidenceCmd,yield_time_ms:10000,max_output_tokens:20000});if(evidenceRead.exit_code!==0)throw new Error("STOP_EVIDENCE_READBACK");const evidence=JSON.parse(evidenceRead.output.trim());if(!Array.isArray(evidence)||evidence.length!==7||evidence.some(x=>!Number.isSafeInteger(x.bytes)||x.bytes<=0||!/^[0-9a-f]{64}$/.test(x.sha256)||typeof x.rawText!=="string"))throw new Error("STOP_EVIDENCE_SHAPE");
  const expectedControls=[taskPin,approvalPin,initialPin,consumedPin,readyPin];for(let i=0;i<expectedControls.length;i++){const actual=evidence[i+2],expected=expectedControls[i];if(actual.path!==expected.path||actual.bytes!==expected.bytes||actual.sha256!==expected.sha256||actual.rawText!==expected.rawText)throw new Error("STOP_CONTROL_HASH_DRIFT");}
  const receipt=JSON.parse(evidence[0].rawText),a0Result=JSON.parse(evidence[1].rawText);if(receipt.label!=="CORE_MATERIAL_POISON_AST"||receipt.terminal!==true||receipt.exitCode!==0||receipt.expectedExit!==0||receipt.stdoutEof!==true||receipt.stderrEof!==true||receipt.safeHandleClosed!==true||receipt.passed!==true||!Number.isFinite(receipt.elapsedMs)||receipt.elapsedMs>60000||receipt.failure!==null)throw new Error("STOP_RECEIPT_FAILED");
  const stdout=JSON.parse(receipt.stdout);if(stdout.status!=="PASS_STATIC_ONLY"||stdout.compiler!=="5.9.3"||stdout.parseErrors!==0||stdout.firstAcquireStatementSameExistingPoisonGuard!==true||stdout.remainingAcquireUnchanged!==true||stdout.allOtherFactoryMembersUnchanged!==true||stdout.existingTestCountUnchanged!==true||stdout.extendedCases!==1||stdout.addedCaseStatements!==5||stdout.productImports!==false||stdout.methodsExecuted!==false||stdout.tests!=="NOT_RUN"||stdout.reproduction!=="NOT_RUN")throw new Error("STOP_STATIC_STDOUT_INVALID");
  if(a0Result.status!=="PASS_STATIC_ONLY"||a0Result.turnId!==turn.id||a0Result.appDeadlineEpochMs!==appEnd||a0Result.payloadInvocationCount!==1||a0Result.toolExitCode!==0||a0Result.sourcePinsPassed!==6||a0Result.recorderCopyReadbackPassed!==true||a0Result.m5CopyPinsPassed!==5||a0Result.m5AbsentSlotsPassed!==8||a0Result.g01Accepted!==true)throw new Error("STOP_A0_RESULT_INVALID");
  if(await clockMs()>rootEnd)throw new Error("STOP_ROOT_CLOSEOUT_AFTER_DEADLINE");
  text(JSON.stringify({status:"R04_STATIC_AST_PASS_ACTUAL_APP_COMPLETED",sendCount:1,readySha256:readyPin.sha256,turnId:turn.id,appDeadlineEpochMs:appEnd,rootAbsoluteEndEpochMs:rootEnd,receiptSha256:evidence[0].sha256,resultSha256:evidence[1].sha256}));
}

return executeR04(tools, text, load);
