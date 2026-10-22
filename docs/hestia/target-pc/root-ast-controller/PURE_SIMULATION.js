async function simulate(controllerRaw, preparedCache) {
  const baseReply={questionItemId:'["request_user_input_async","call_r04_new",0]',source:"DIRECT_CURRENT_HUMAN_REPLY",scope:"CORE_MATERIAL_POISON_AST_R04_ONCE",answer:"JA_CORE_MATERIAL_POISON_AST_R04_ONCE",approved:true};
  const run=async({cache=preparedCache,reply=baseReply,expected=baseReply.questionItemId,clocks=[100000],foreignOwner=false,wrongTurn=false,foreignPollHost=false,omitPollCursor=false,previousTurnInProgress=false,terminalHost="local",invalidEvidenceRow=-1,changedControlRawText=false,resultOverrides={}}={})=>{
    const effects=[];let clockIndex=0,waitCount=0,readCount=0,pendingSha="a".repeat(64),output="";const pinByPath={};
    const fakeTools={
      clock__curr_time:async()=>({current_time:new Date(clocks[Math.min(clockIndex++,clocks.length-1)]).toISOString()}),
      exec_command:async({cmd})=>{if(cmd===cache?.headCommand)return{exit_code:0,output:cache.owner.head};if(cmd.includes("SOURCE_RECHECK_PASS"))return{exit_code:0,output:"SOURCE_RECHECK_PASS"};if(cmd.includes("$paths=@(")){const stdout={status:"PASS_STATIC_ONLY",compiler:"5.9.3",parseErrors:0,firstAcquireStatementSameExistingPoisonGuard:true,remainingAcquireUnchanged:true,allOtherFactoryMembersUnchanged:true,existingTestCountUnchanged:true,extendedCases:1,addedCaseStatements:5,productImports:false,methodsExecuted:false,tests:"NOT_RUN",reproduction:"NOT_RUN"};const receipt={label:"CORE_MATERIAL_POISON_AST",terminal:true,exitCode:0,expectedExit:0,stdoutEof:true,stderrEof:true,safeHandleClosed:true,passed:true,elapsedMs:1000,failure:null,stdout:JSON.stringify(stdout)};const result={status:"PASS_STATIC_ONLY",turnId:"turn-r04",appDeadlineEpochMs:700000,payloadInvocationCount:1,toolExitCode:0,sourcePinsPassed:6,recorderCopyReadbackPassed:true,m5CopyPinsPassed:5,m5AbsentSlotsPassed:8,g01Accepted:true,...resultOverrides};const rows=[{path:"receipt",bytes:1,sha256:"c".repeat(64),rawText:JSON.stringify(receipt)},{path:"result",bytes:1,sha256:"d".repeat(64),rawText:JSON.stringify(result)},pinByPath[cache.controls.task],pinByPath[cache.controls.approval],pinByPath[cache.controls.initial],pinByPath[cache.controls.consumption],{...pinByPath[cache.controls.readyPending],path:cache.controls.ready}];if(invalidEvidenceRow>=0)rows[invalidEvidenceRow].sha256=null;if(changedControlRawText)rows[2].rawText+="changed";return{exit_code:0,output:JSON.stringify(rows)}};if(cmd.includes("[IO.File]::Move")){effects.push("ready-publish");return{exit_code:0,output:JSON.stringify({path:cache.controls.ready,sha256:pendingSha})}};const pm=cmd.match(/\$p='((?:''|[^'])*)';\$raw='([\s\S]*)';\$u=/);if(!pm)throw new Error("FAKE_UNEXPECTED_EXEC");const path=pm[1].replaceAll("''","'"),raw=pm[2].replaceAll("''","'");const label=path.includes("INITIAL_CONSUMED")?"initial":path.includes("FINAL_EXECUTION_TASK")?"task":path.includes("HUMAN_APPROVAL")?"approval":path.includes("GRANT_CONSUMED")?"consumption":path.endsWith(".pending")?"ready-pending":"write";effects.push(label);const sha=(label==="ready-pending"?pendingSha:"b".repeat(64)),pin={path,bytes:raw.length,sha256:sha,rawText:raw};pinByPath[path]=pin;return{exit_code:0,output:JSON.stringify(pin)}},
      mcp__codex_app__send_message_to_thread:async()=>{effects.push("send");return{content:[{type:"text",text:JSON.stringify({threadId:preparedCache.owner.app})}] }},
      mcp__codex_app__wait_threads:async()=>{waitCount++;if(waitCount===1){const thread={id:foreignOwner?"foreign":preparedCache.owner.app,hostId:foreignPollHost?"foreign":"local",status:{type:"active"}},latestTurn=previousTurnInProgress?{id:cache.spentR03.previousTurnId,status:"inProgress",startedAt:100}:{id:"turn-r04",status:"inProgress",startedAt:100},poll={...(omitPollCursor?{}:{cursor:"c1"}),thread,latestTurn};return{content:[{type:"text",text:JSON.stringify({polls:[poll]})}]}};return{content:[{type:"text",text:JSON.stringify({polls:[{cursor:"c2",thread:{id:preparedCache.owner.app,hostId:terminalHost,status:{type:"idle"}},latestTurn:{id:"turn-r04",status:"completed",startedAt:100,completedAt:101,durationMs:1000}}]})}] }},
      mcp__codex_app__read_thread:async()=>{readCount++;return{content:[{type:"text",text:JSON.stringify({thread:{id:preparedCache.owner.app,hostId:"local",cwd:preparedCache.owner.cwd,status:{type:readCount===1?"active":"idle"}},turns:[readCount===1?{id:wrongTurn?"wrong-turn":"turn-r04",status:"inProgress",startedAt:100}:{id:"turn-r04",status:"completed",startedAt:100,completedAt:101,durationMs:1000}]})}]}}
    };
    const values={hestiaAstR04PreparedCache:cache,hestiaAstR04DirectReply:reply,hestiaAstR04ExpectedQuestionItemId:expected};
    try{const fn=new Function("tools","text","load",controllerRaw);await fn(fakeTools,x=>{output+=String(x)},k=>values[k]);return{ok:true,effects,output};}catch(error){return{ok:false,effects,error:String(error)}}
  };
  const missing=await run({cache:null});
  const disturbed=await run({cache:{...preparedCache,integrityVerified:false}});
  const emptyPins=await run({cache:{...preparedCache,sourcePins:[]}});
  const corruptPins=await run({cache:{...preparedCache,sourcePins:[{path:"x",bytes:1,sha256:"bad"}]}});
  const expired=await run({clocks:[100000,190000]});
  const postSendDeadline=await run({clocks:[100000,100001,190000]});
  const wrongOwner=await run({foreignOwner:true,clocks:[100000,100001,100002]});
  const wrongTurn=await run({wrongTurn:true,clocks:[100000,100001,100002]});
  const questionIdFor=id=>JSON.stringify(["request_user_input_async",id,0]),replyFor=id=>({reply:{...baseReply,questionItemId:questionIdFor(id)},expected:questionIdFor(id)});
  const nonCallId=await run(replyFor("old-style-question-id"));
  const reusedCallIds=await Promise.all(["call_cf1f33842b8b4ec0ab389519c038342b","call_f30158c63d7d4a89ae96a25993496081","call_fa23d8dee57841c88a794f14d300faa6","call_1e53fac611fb474992903fc38827bccf","call_392873b8b8ae4f39bca54c96f0cb2255","call_5614e5cf87614c769b4ab405dd4b0ca0","call_a2a72f2f2f794a1286d241bcda7bfdd2"].map(id=>run(replyFor(id))));
  const foreignPollHost=await run({foreignPollHost:true});
  const missingNewTurnCursor=await run({omitPollCursor:true});
  const unfinishedLastG01Turn=await run({previousTurnInProgress:true});
  const foreignCloseoutHost=await run({terminalHost:"foreign"});
  const missingEvidenceSha=await run({invalidEvidenceRow:1});
  const changedControlRawText=await run({changedControlRawText:true});
  const missingM5CopyProof=await run({resultOverrides:{m5CopyPinsPassed:4}});
  const missingM5AbsentProof=await run({resultOverrides:{m5AbsentSlotsPassed:7}});
  const missingG01Proof=await run({resultOverrides:{g01Accepted:false}});
  const valid=await run({clocks:[100000,100001,100002,100003,100004,100005,100006,100007,100008,100009]});
  if(missing.effects.length||disturbed.effects.length||emptyPins.effects.length||corruptPins.effects.length)throw new Error("CACHE_GUARD_ALLOWED_EFFECT");
  if(expired.effects.includes("send")||expired.effects.includes("ready-publish"))throw new Error("EXPIRED_ALLOWED_DISPATCH_OR_READY");
  if(postSendDeadline.effects.filter(x=>x==="send").length!==1||postSendDeadline.effects.includes("ready-publish"))throw new Error("POST_SEND_DEADLINE_READY_GUARD_FAILED");
  if(!wrongOwner.effects.includes("send")||wrongOwner.effects.includes("ready-publish"))throw new Error("WRONG_OWNER_READY_GUARD_FAILED");
  if(!wrongTurn.effects.includes("send")||wrongTurn.effects.includes("ready-publish"))throw new Error("WRONG_TURN_READY_GUARD_FAILED");
  if(nonCallId.ok||nonCallId.effects.length||reusedCallIds.some(x=>x.ok||x.effects.length))throw new Error("QUESTION_CALL_ID_GUARD_FAILED");
  if(foreignPollHost.ok||foreignPollHost.effects.includes("ready-publish")||missingNewTurnCursor.ok||missingNewTurnCursor.effects.includes("ready-publish")||unfinishedLastG01Turn.ok||unfinishedLastG01Turn.effects.includes("ready-publish"))throw new Error("NEW_TURN_BINDING_GUARD_FAILED");
  if(foreignCloseoutHost.ok||!foreignCloseoutHost.effects.includes("ready-publish"))throw new Error("CLOSEOUT_HOST_GUARD_FAILED");
  if(missingEvidenceSha.ok||!missingEvidenceSha.error.includes("STOP_EVIDENCE_SHAPE")||changedControlRawText.ok||!changedControlRawText.error.includes("STOP_CONTROL_HASH_DRIFT"))throw new Error("EVIDENCE_READBACK_GUARD_FAILED");
  if(missingM5CopyProof.ok||!missingM5CopyProof.error.includes("STOP_A0_RESULT_INVALID")||missingM5AbsentProof.ok||!missingM5AbsentProof.error.includes("STOP_A0_RESULT_INVALID")||missingG01Proof.ok||!missingG01Proof.error.includes("STOP_A0_RESULT_INVALID"))throw new Error("A0_ACCEPTANCE_PROOF_GUARD_FAILED");
  if(!valid.ok||valid.effects.filter(x=>x==="send").length!==1||valid.effects.at(-1)!=="ready-publish")throw new Error("VALID_SINGLE_SEND_READY_LAST_FAILED");
  return{status:"PURE_V8_SIMULATION_PASS",missingCache:missing,disturbedCache:disturbed,emptyPins,corruptPins,expired,postSendDeadline,wrongOwner,wrongTurn,questionId:{nonCallId,reusedCallCount:reusedCallIds.length},newTurnBinding:{foreignPollHost,missingNewTurnCursor,unfinishedLastG01Turn},foreignCloseoutHost,evidenceReadback:{missingEvidenceSha,changedControlRawText},a0Proof:{missingM5CopyProof,missingM5AbsentProof,missingG01Proof},valid};
}
return simulate;
