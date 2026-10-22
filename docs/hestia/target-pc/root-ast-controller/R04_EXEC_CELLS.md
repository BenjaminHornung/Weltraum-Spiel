# R04 feste Root-Exec-Zellen

Diese Quelle stellt keinen Antrag und erteilt keine Autorität. Root führt Zelle 1 vollständig **vor** einer künftigen Frage aus. Nach einer neuen tatsächlichen R04-Antwort speichert Root nur deren tatsächliche Question-ID und Reply-Daten serialisierbar; Zelle 2 ist dann der einzige kritische Root-Exec bis Ready und Abschluss.

## 1. Preload vor jeder künftigen Frage

```javascript
const packageRoot="E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\ROOT_AST_CRITICAL_CONTROLLER_SOURCE-20261021";
const gate=await tools.exec_command({shell:"C:\\IFI_SourceCode\\Utils\\PowerShell\\pwsh.exe",login:false,cmd:"& 'E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\ROOT_AST_CRITICAL_CONTROLLER_SOURCE-20261021\\R04_VERIFY_PREPARATION.ps1'",sandbox_permissions:"require_escalated",justification:"Run the fixed read-only R04 readiness gate, including pinned Git HEAD; no checkout or runtime execution.",yield_time_ms:10000,max_output_tokens:5000});
if(gate.exit_code!==0||!gate.output.includes("SOURCE_PREPARATION_ONLY_NO_RUNTIME_AUTHORITY"))throw new Error("R04_READINESS_GATE_FAILED:"+gate.output);
const ownerRead=await tools.mcp__codex_app__read_thread({threadId:"01a13648-c55b-7250-bf07-34921d70b43b",hostId:"local",turnLimit:1,includeOutputs:false,maxOutputCharsPerItem:200});if(ownerRead.isError)throw new Error("R04_OWNER_READ_FAILED");
const ownerState=JSON.parse(ownerRead.content.find(x=>x.type==="text")?.text||"null"),ownerThread=ownerState?.thread,ownerTurn=ownerState?.turns?.[0];if(ownerThread?.id!=="01a13648-c55b-7250-bf07-34921d70b43b"||ownerThread?.hostId!=="local"||ownerThread?.cwd!=="C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13"||!['idle','notLoaded'].includes(ownerThread?.status?.type)||ownerTurn?.id!=="01a15ecc-d7fc-7f23-8d7d-466bfe7f560f"||ownerTurn?.status!=="completed"||!Number.isFinite(ownerTurn?.startedAt)||!Number.isFinite(ownerTurn?.completedAt)||!Number.isFinite(ownerTurn?.durationMs))throw new Error("R04_OWNER_NOT_QUALIFIED_IDLE_WITH_COMPLETED_METADATA");
const cmd=`$ErrorActionPreference='Stop'
$u=[Text.UTF8Encoding]::new($false,$true)
$expected=@(
 @((Join-Path '${packageRoot}' 'R04_CONTROLLER.js'),16113,'78bda572c71c549fadb82a633f6a737aebfd2740075a7427292a0bf51510f7a1'),
 @((Join-Path '${packageRoot}' 'R04_TEMPLATE.json'),9400,'4955f76a7b6cb2981533451c2044020d4891ed3e1eae1726d73263abb808968a'),
 @((Join-Path '${packageRoot}' 'R04_A0_RUN_ONCE.ps1'),12926,'e8a65aca5845b8a042a8e1908eef03d5e04fc59c68504ca4a1fffc88b6964bfd'),
 @((Join-Path '${packageRoot}' 'R04_PREPARED_CACHE.json'),6776,'d6ecab29e0f92089274df6d4615935a59927ce82116e610d77f1d4a3a8b1cad9'),
 @((Join-Path '${packageRoot}' 'R04_VERIFY_PREPARATION.ps1'),17313,'f9f79d5c6fc4a1a7deff3258392653efa8af63ef06a4fb529535c561ed7f603a'),
 @('E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R03_INITIAL_CONSUMED-20261021.json',887,'599a312eac120fd67fbde34a0764be372571801eacaea31eec5fc285eba6ab67'),
 @('E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R03_ROOT_STOP-20261021.json',1773,'684820da0cb3940b1e7f6439d8db63394af3d9a3ec5d295716d8b0f9e0c09623')
)
$rows=@();$rawByPath=@{};foreach($x in $expected){$b=[IO.File]::ReadAllBytes($x[0]);$h=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b)).ToLowerInvariant();if($b.Length-ne$x[1]-or$h-cne$x[2]){throw ('SOURCE_PIN_MISMATCH:'+$x[0])};$full=[IO.Path]::GetFullPath($x[0]);$rawByPath[$full]=$u.GetString($b);$rows+=@([pscustomobject]@{path=$full;bytes=$b.Length;sha256=$h})}
$worktree='C:\\IFI_SourceCode\\Temp\\WeltraumSpiel\\.worktrees\\Hestia-A0-BenniPC-2026-10-13'
$pins=@(
 @('apps/weltraum-browser/src/render/three/backend/threeMaterialFactory.ts',5172,'fd0658244e613c684b1ecced904ad9ec4d6b823953490bd322cf12a572295542'),
 @('apps/weltraum-browser/tests/unit/renderBackendLifecycle.test.ts',44944,'6ab4b4d0acb0160411e651106ac8ee1a60cd13c960d5f3ea8a8cbd18ab2473d1'),
 @('.a0-runtime/benni-pc-core-material-poison-source-r01/ast-check.cjs',3458,'bba66c6a51ba19aea9c848251f7122e5ca883333dde103d273b3c4778abe0cd7'),
 @('.a0-runtime/benni-pc-core-material-poison-source-r01/Run-Check.ps1',3295,'e5d5f7ee00e7a6d3b7f14d240c5ff133c44e4230b87a99a3a543efdc8a8f6abe'),
 @('.a0-runtime/benni-pc-core-material-poison-source-r01/before/threeMaterialFactory.ts',5114,'9b259862c6534691773e2a7f7df7ed5c4696491243535844f69af84240fb1a6d'),
 @('.a0-runtime/benni-pc-core-material-poison-source-r01/before/renderBackendLifecycle.test.ts',44455,'23c796f32c182cc5ec0ca5ad3b200911d40dfe97d5f2ec430b3f8e9f73d651c9')
)
foreach($x in $pins){$p=[IO.Path]::GetFullPath((Join-Path $worktree $x[0]));$i=Get-Item $p;$h=(Get-FileHash $p -Algorithm SHA256).Hash.ToLowerInvariant();if($i.Length-ne$x[1]-or$h-cne$x[2]){throw ('INPUT_PIN_MISMATCH:'+$p)};$rows+=@([pscustomobject]@{path=$p;bytes=$i.Length;sha256=$h})}
$controls=@('E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R04_INITIAL_CONSUMED-20261021.json','E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R04_FINAL_EXECUTION_TASK-20261021.json','E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R04_HUMAN_APPROVAL-20261021.json','E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R04_GRANT_CONSUMED-20261021.json','E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R04_ROOT_READY-20261021.json.pending','E:\\DEV\\Weltraum-Spiel\\TARGET_PC\\CORE_MATERIAL_POISON_AST_R04_ROOT_READY-20261021.json')
foreach($p in $controls){if(Test-Path -LiteralPath $p){throw ('R04_RUNTIME_CONTROL_ALREADY_EXISTS:'+$p)}}
[pscustomobject]@{controllerRaw=$rawByPath[[IO.Path]::GetFullPath((Join-Path '${packageRoot}' 'R04_CONTROLLER.js'))];cacheRaw=$rawByPath[[IO.Path]::GetFullPath((Join-Path '${packageRoot}' 'R04_PREPARED_CACHE.json'))];sourcePins=$rows}|ConvertTo-Json -Depth 6 -Compress`;
const out=await tools.exec_command({shell:"C:\\IFI_SourceCode\\Utils\\PowerShell\\pwsh.exe",login:false,cmd,yield_time_ms:10000,max_output_tokens:30000});
if(out.exit_code!==0)throw new Error("R04_PRELOAD_FAILED:"+out.output);
const loaded=JSON.parse(out.output.trim()),cache=JSON.parse(loaded.cacheRaw);
cache.integrityVerified=true;cache.sourcePins=loaded.sourcePins;
const preparedRaw=JSON.stringify(cache),q=s=>"'"+s.replaceAll("'","''")+"'";
const sealCmd="$ErrorActionPreference='Stop';$u=[Text.UTF8Encoding]::new($false,$true);$c="+q(loaded.controllerRaw)+";$p="+q(preparedRaw)+";$cb=$u.GetBytes($c);$pb=$u.GetBytes($p);[pscustomobject]@{controllerBytes=$cb.Length;controllerSha=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($cb)).ToLowerInvariant();payloadBytes=$pb.Length;payloadSha=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($pb)).ToLowerInvariant()}|ConvertTo-Json -Compress";
const sealed=await tools.exec_command({shell:"C:\\IFI_SourceCode\\Utils\\PowerShell\\pwsh.exe",login:false,cmd:sealCmd,yield_time_ms:10000,max_output_tokens:1000});if(sealed.exit_code!==0)throw new Error("R04_SERIALIZED_SEAL_FAILED");const seal=JSON.parse(sealed.output.trim());
if(seal.controllerBytes!==16113||seal.controllerSha!=="78bda572c71c549fadb82a633f6a737aebfd2740075a7427292a0bf51510f7a1")throw new Error("R04_CONTROLLER_SINGLE_READ_SEAL_MISMATCH");
if(seal.payloadBytes!==9410||seal.payloadSha!=="65d5be881ee1318c1f23ce84ba89801c170760ef1a18fc6bf5873353199d2c58")throw new Error("R04_PREPARED_PAYLOAD_SEAL_MISMATCH");
store("hestiaAstR04ControllerSource",{raw:loaded.controllerRaw,bytes:seal.controllerBytes,sha256:seal.controllerSha});
store("hestiaAstR04PreparedPayload",{raw:preparedRaw,bytes:seal.payloadBytes,sha256:seal.payloadSha});
text(JSON.stringify({status:"R04_SOURCE_PRELOADED_NO_AUTHORITY",sourcePins:loaded.sourcePins.length,runtimeControls:0}));
```

## 2. Einziger post-reply Root-Exec

Root setzt unmittelbar aus der tatsächlichen neuen Frage/Antwort ausschließlich `hestiaAstR04ExpectedQuestionItemId` und `hestiaAstR04DirectReply` als serialisierbare Daten. Danach:

```javascript
const source=load("hestiaAstR04ControllerSource");
const payload=load("hestiaAstR04PreparedPayload");
if(!source||!payload||typeof source.raw!=="string"||typeof payload.raw!=="string"||!Number.isInteger(source.bytes)||!Number.isInteger(payload.bytes)||!/^[0-9a-f]{64}$/.test(source.sha256)||!/^[0-9a-f]{64}$/.test(payload.sha256))throw new Error("HOLD_R04_SERIALIZED_CACHE_MISSING");
const sha256Ascii=input=>{const K=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];let bytes=[];for(let i=0;i<input.length;i++){const c=input.charCodeAt(i);if(c>127)throw new Error("HOLD_R04_NON_ASCII_SERIALIZED_SOURCE");bytes.push(c)}const bitLen=bytes.length*8;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push(i>=4?0:(bitLen>>>(i*8))&255);let H=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],w=new Array(64),rotr=(x,n)=>(x>>>n)|(x<<(32-n));for(let o=0;o<bytes.length;o+=64){for(let i=0;i<16;i++)w[i]=((bytes[o+i*4]<<24)|(bytes[o+i*4+1]<<16)|(bytes[o+i*4+2]<<8)|bytes[o+i*4+3])>>>0;for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rotr(a,7)^rotr(a,18)^(a>>>3),s1=rotr(b,17)^rotr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}let [a,b,c,d,e,f,g,h]=H;for(let i=0;i<64;i++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=rotr(a,2)^rotr(a,13)^rotr(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}H=[(H[0]+a)>>>0,(H[1]+b)>>>0,(H[2]+c)>>>0,(H[3]+d)>>>0,(H[4]+e)>>>0,(H[5]+f)>>>0,(H[6]+g)>>>0,(H[7]+h)>>>0]}return H.map(x=>x.toString(16).padStart(8,"0")).join("")};
if(sha256Ascii("abc")!=="ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")throw new Error("HOLD_R04_PURE_SHA_SELF_CHECK");
if(source.raw.length!==source.bytes||payload.raw.length!==payload.bytes||sha256Ascii(source.raw)!==source.sha256||sha256Ascii(payload.raw)!==payload.sha256||source.bytes!==16113||source.sha256!=="78bda572c71c549fadb82a633f6a737aebfd2740075a7427292a0bf51510f7a1"||payload.bytes!==9410||payload.sha256!=="65d5be881ee1318c1f23ce84ba89801c170760ef1a18fc6bf5873353199d2c58")throw new Error("HOLD_R04_SERIALIZED_CACHE_DRIFT");
const prepared=JSON.parse(payload.raw);if(prepared.schema!=="hestia.ast-r04.prepared-cache.v1"||prepared.integrityVerified!==true||!Array.isArray(prepared.sourcePins)||prepared.sourcePins.length===0)throw new Error("HOLD_R04_SERIALIZED_PAYLOAD_INVALID");
const controller=new Function("tools","text","load",source.raw);
const controllerLoad=key=>key==="hestiaAstR04PreparedCache"?prepared:load(key);
await controller(tools,text,controllerLoad);
```

Nach Root-Ready beobachtet der Controller nur denselben Turn; es gibt keinen zweiten `send_message_to_thread`-Aufruf.
