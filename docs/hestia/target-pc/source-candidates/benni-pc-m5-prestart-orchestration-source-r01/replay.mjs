// Pure deterministic replay of the actual final A0 cell. All tools and time are replaced.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const cell = fs.readFileSync(new URL('./A0.cell.mjs', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
const base = 1800000000000;
async function replay(timely) {
 let t=0, result, starts=0, payloads=0, exits=0, helperPolls=0, terminal=false;
 const cfg={appThread:'01a13648-c55b-7250-bf07-34921d70b43b',appTurn:'replay-only',humanRef:'new-replay-only-unissued',humanSha:'f'.repeat(64),appDeadlineEpochMs:base+600000,cwd:'SOURCE_REPLAY_NO_EFFECTS'};
 const ready={pid:42,creationFileTime:'1',version:'7.6.5',framework:'.NET 10.0.11'};
 const events=[];
 const tools={
  async exec_command(a){
   if(a.tty){starts++;events.push('host');return {session_id:42,output:'M5_EMPTY_HOST_READY:'+JSON.stringify(ready)+'\r\n'};}
   const mode=a.cmd.match(/-Mode '([^']+)'/)[1];
   events.push(mode);
   if(mode==='Mark')return {exit_code:0,output:JSON.stringify({nativeOrigin:'1000',utcOrigin:String(base)})};
   if(mode==='OperatorWait'){t=30000;return {session_id:77,output:''};}
   if(mode==='Admit'){t=119000;return {exit_code:0,output:JSON.stringify({accepted:true,nativeElapsedMs:119000})};}
   if(mode==='Observe')return {exit_code:0,output:JSON.stringify({ownHost:{absent:terminal},outerRemainingMs:null})};
   throw Error('Unexpected metadata '+mode);
  },
  async write_stdin(a){
   if(a.session_id===77){
    assert.equal(a.chars,'');helperPolls++;
    if(!timely){t=191698;return {exit_code:0,output:JSON.stringify({accepted:false,nativeElapsedMs:t})};}
    t=Math.min(110000,t+a.yield_time_ms);
    return t<110000?{session_id:77,output:''}:{exit_code:0,output:JSON.stringify({accepted:true,nativeElapsedMs:t})};
   }
   assert.equal(a.session_id,42);
   if(a.chars==='exit 0\r\n'){exits++;terminal=true;return {exit_code:0,output:''};}
   if(a.chars){
    assert.equal(t,119000);payloads++;assert.ok(a.chars.includes('root-outer.ps1'));
    assert.equal(a.yield_time_ms,30000);t+=a.yield_time_ms;
    return {session_id:42,output:'PAYLOAD_REPLAY_ONLY'};
   }
   // A 150s global cutoff would shorten this observable request and fail.
   assert.equal(t,149000);assert.equal(a.yield_time_ms,30000);
   t+=a.yield_time_ms;terminal=true;return {exit_code:0,output:'TERMINAL_REPLAY_ONLY'};
  }
 };
 class FakeDate extends Date { static now(){return base+t;} }
 await new AsyncFunction('tools','load','store','text','Date',cell)(tools,()=>cfg,(k,v)=>{if(k==='M5_PRESTART_A0_RESULT')result=v;},()=>{},FakeDate);
 assert.equal(starts,1);assert.ok(helperPolls>0);assert.ok(result.metadataSessions.every(x=>x.terminal));
 if(timely){
  assert.equal(payloads,1);assert.equal(exits,0);assert.equal(result.payloadEndUtc,base+179000);
  assert.equal(result.payloadTerminalWithin60,true);assert.equal(t,179000);
  assert.equal(result.status,'PAYLOAD_TERMINAL_OBSERVED_PENDING_ROOT_QUALIFICATION');
 }else{
  assert.equal(payloads,0);assert.equal(exits,1);assert.equal(result.prestartWithin180,false);
  assert.match(result.status,/HOLD/);
 }
 return {scenario:timely?'accepted_at_119s_full_179s_end':'missing_authority_actual_191698ms_trace',status:result.status,starts,payloads,exits,helperPolls,payloadEndMs:result.payloadEndUtc?result.payloadEndUtc-base:null,terminalMs:result.terminalObservedUtc-base,toolsCompletelyStubbed:true,fileOrProcessEffects:0};
}
console.log(JSON.stringify({source:'ACTUAL_FINAL_A0_CELL',scenarios:[await replay(false),await replay(true)]}));

