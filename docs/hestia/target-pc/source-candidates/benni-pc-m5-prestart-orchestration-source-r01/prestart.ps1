# SOURCE ONLY. Parse for source checks; never invoke Issue during source qualification.
[CmdletBinding()]param(
 [Parameter(Mandatory)][ValidateSet('Mark','OperatorWait','RootWait','Issue','Admit','Observe')][string]$Mode,
 [Parameter(Mandatory)][string]$InputJson
)
$ErrorActionPreference='Stop'
$helperNativeStart=[Environment]::TickCount64
$helperUtcStart=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$d=$InputJson|ConvertFrom-Json -DateKind String -Depth 60
$base='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13'
$source='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime'
$managed='C:\Users\benni\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
$core='C:\Users\benni\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\System.Private.CoreLib.dll'
$inner=Join-Path $source 'benni-pc-m5-harmless-activation-source-r05'
$authorityPath=Join-Path $base 'M5_HARMLESS_RUNTIME_AUTHORITY.json'
$readyPath=Join-Path $d.runDir 'PRESTART_READY.json'
$acceptPath=Join-Path $d.runDir 'ROOT_PRESTART_ACCEPTANCE.json'
$spent='call_f30a08a8ec0b4c53aec91a6cee248b8f:0'
$fields='schema version humanMessageRef humanMessageSha256 authorizationClass scope retry candidateManifestSha256 packagePinsSha256 outerSourceSha256 dispatcherSourceSha256 runnerSourceSha256 actualAppThread actualAppTurn appStatus paseoAgent workspace notBeforeUtc expiresUtc'
$copies=@(
 @('root-outer.ps1','e4f142ef4406a102237b23dab42b136558c1ffa46c4d67e8bbe7c4dd7e0a05a2'),
 @('root-dispatch.ps1','939586e44519ef4f8285a16db69a0b88801d4de59113753545e06dc31301e9f9'),
 @('root-runner.ps1','7312bc523c2b7e38a5050df08ec517d815454a333d006544ee58ad6148b9281f'),
 @('RootOuterAtomicLauncher.cs','7a7334e72013dda3c2f2947292aca615f20137845747d1f45b507858ced83006'),
 @('RootOuterAtomicLauncher.dll','148f0ac69fc07651922b591e32d63660f874b88992d50ab4226908d1e1233b70')
)
function Need($ok,$why){if(-not $ok){throw ('HOLD:'+ $why)}}
function HelperEnd {
 $limit=if($Mode-eq 'OperatorWait'){110000}elseif($Mode-eq 'RootWait'){180000}else{30000}
 Need ([Environment]::TickCount64-$helperNativeStart-le $limit-and[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$helperUtcStart-le $limit) 'native helper original endpoints'
}
function Hash($path){HelperEnd;$v=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();HelperEnd;return $v}
function HashBytes([byte[]]$b){[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b)).ToLowerInvariant()}
function JsonBytes($o){[Text.UTF8Encoding]::new($false,$true).GetBytes(($o|ConvertTo-Json -Compress -Depth 60))}
function ReadJson($p){Get-Content -LiteralPath $p -Raw|ConvertFrom-Json -DateKind String -Depth 60}
function ExactPath($path){
 Need ([IO.Path]::IsPathFullyQualified($path)-and[IO.Path]::GetFullPath($path)-ceq $path) 'canonical path'
 $i=Get-Item -LiteralPath $path -Force
 while($null-ne $i){Need (-not($i.Attributes-band[IO.FileAttributes]::ReparsePoint)) 'no reparse';if($i-is[IO.FileInfo]){$i=$i.Directory}else{$i=$i.Parent}}
}
function Profile {
 Need ([Environment]::ProcessPath-ceq $managed-and$PSVersionTable.PSVersion.ToString()-ceq '7.6.5'-and[Runtime.InteropServices.RuntimeInformation]::FrameworkDescription-ceq '.NET 10.0.11'-and[Environment]::OSVersion.Platform-eq[PlatformID]::Win32NT-and[Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture-eq[Runtime.InteropServices.Architecture]::X64) 'qualified native metadata profile'
 Need ([object].Assembly.Location-ceq $core) 'actual CoreLib'
 ExactPath $managed;ExactPath $core
 Need ((Hash $managed)-ceq '362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139'-and(Hash $core)-ceq 'ed80a1a5dd066c0407ad59686f9af90a4f3e55dbf3e4c973b53cc8c9d0706f82') 'metadata host hashes'
 foreach($k in @('DOTNET_STARTUP_HOOKS','DOTNET_ADDITIONAL_DEPS','DOTNET_SHARED_STORE','DOTNET_ROOT','DOTNET_ROOT_X64','CORECLR_ENABLE_PROFILING','CORECLR_PROFILER','CORECLR_PROFILER_PATH','COR_ENABLE_PROFILING','COR_PROFILER','COR_PROFILER_PATH','COMPLUS_StartupHooks','PSExecutionPolicyPreference','__PSLockdownPolicy')){Need (-not(Test-Path -LiteralPath ('Env:\'+$k))) 'injection presence denied'}
}
function CheckInput {
 Need ($d.appThread-ceq '01a13648-c55b-7250-bf07-34921d70b43b'-and$d.cwd-ceq 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13') 'sole A0 identity'
 Need ([guid]::ParseExact($d.appTurn,'D').ToString('D')-ceq $d.appTurn) 'current turn GUID'
 Need ($d.paseoAgent-ceq '58fc7970-b84f-485d-8cd0-e577205823e9'-and$d.workspace-ceq 'wks_f2d458343a45c91e') 'Root-prepared owner binding'
 Need ($d.humanRef-cne $spent-and-not[string]::IsNullOrWhiteSpace($d.humanRef)-and$d.humanSha-cmatch '^[0-9a-f]{64}$') 'SPENT reference denied'
 Need ([long]$d.appDeadlineEpochMs-eq [Math]::Min([long]$d.appStartEpochMs+[long]$d.appBudgetMs,[long]$d.absoluteEndEpochMs)) 'unchanged earlier Appturn end'
 Need ([long]$d.appBudgetMs-gt 0-and[long]$d.appBudgetMs-le 720000) 'bounded Appturn'
 Need ($d.runDir.StartsWith('E:\DEV\Weltraum-Spiel\TARGET_PC\',[StringComparison]::OrdinalIgnoreCase)) 'fixed future evidence parent'
 ExactPath $d.runDir
}
function CheckGrant {
 ExactPath $d.grantPath;ExactPath $d.scopePath
 Need ((Hash $d.grantPath)-ceq $d.grantFileSha256-and(Hash $d.scopePath)-ceq $d.scopeSha256) 'Root-prepared exact input hashes'
 $g=ReadJson $d.grantPath
 Need ($g.reference-ceq $d.humanRef-and$g.reference-cne $spent-and$g.humanAnswerUtf8Sha256-ceq $d.humanSha-and$g.requestSha256-ceq $d.scopeSha256-and$g.authorization-ceq 'DIRECT_HUMAN_ONE_SETUP_AND_HARMLESS_SIX_ONCE'-and$g.retry-eq 0) 'genuine new direct once binding'
 Need ((HashBytes ([Text.UTF8Encoding]::new($false).GetBytes($g.answer)))-ceq $d.humanSha) 'exact human answer bytes'
}
function ClockData {
 $n=[Environment]::TickCount64;$u=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 [pscustomobject]@{native=$n.ToString();utc=$u.ToString();nativeElapsedMs=($n-[long]$script:marker.nativeOrigin);utcElapsedMs=($u-[long]$script:marker.utcOrigin)}
}
function AssertWindow([long]$limit){
 $x=ClockData
 Need ($x.nativeElapsedMs-ge 0-and$x.utcElapsedMs-ge 0-and$x.nativeElapsedMs-le $limit-and$x.utcElapsedMs-le $limit-and[long]$x.utc-lt [long]$d.appDeadlineEpochMs) 'original native UTC Appturn endpoints'
 return $x
}
function ObserveHost($r,[bool]$required=$true){
 $p=Get-Process -Id ([int]$r.pid) -ErrorAction SilentlyContinue
 if($null-eq $p){Need (-not $required) 'owned host absent';return [pscustomobject]@{absent=$true;pid=$r.pid}}
 try{
  $w=Get-CimInstance Win32_Process -Filter ('ProcessId = '+[int]$r.pid) -Property ProcessId,ParentProcessId -ErrorAction Stop
  $children=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId = '+[int]$r.pid) -Property ProcessId -ErrorAction Stop)
  Need ($p.StartTime.ToFileTimeUtc().ToString()-ceq $r.creationFileTime-and$p.MainModule.FileName-ceq $managed) 'independent host creation/image'
  if($required){
   $birth=[DateTimeOffset]::new($p.StartTime.ToUniversalTime()).ToUnixTimeMilliseconds()
   $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
   Need ([long]$script:marker.utcOrigin-le $birth-and$now-ge $birth-and$now-le $birth+180000) 'original mark before independent host birth and original host 180s end'
  }
  if($r.PSObject.Properties.Name-contains 'parentPid'){Need ($w.ParentProcessId-eq $r.parentPid) 'independent parent'}
  if($required){Need ($children.Count-eq 0) 'empty host direct children'}
  [pscustomobject]@{pid=$p.Id;creationFileTime=$p.StartTime.ToFileTimeUtc().ToString();creationUtc=$p.StartTime.ToUniversalTime().ToString('o');image=$p.MainModule.FileName;parentPid=$w.ParentProcessId;directChildren=$children.Count;absent=$false}
 }finally{$p.Dispose()}
}
function CheckCopies {
 foreach($pair in $copies){
  $p=Join-Path $base $pair[0];$s=Join-Path (Join-Path $source 'benni-pc-m5-root-runner-source-r04') $pair[0]
  ExactPath $p;ExactPath $s
  Need ((Hash $p)-ceq $pair[1]-and(Hash $s)-ceq $pair[1]-and([IO.FileInfo]$p).Length-eq([IO.FileInfo]$s).Length) 'five existing copies only'
 }
}
function CheckSources {
 Need ((Hash 'E:\DEV\Weltraum-Spiel\TARGET_PC\M5_EMPTY_TOOLHOST_ROOT_ACCEPTANCE-20261018.json')-ceq '90761df2b0ce247ca63b2de7273c88327426da8360c7805c07eb5f86a2d1f6a1') 'frozen Root baseline content identity'
 $a=ReadJson 'E:\DEV\Weltraum-Spiel\TARGET_PC\M5_EMPTY_TOOLHOST_ROOT_ACCEPTANCE-20261018.json'
 $rows=0;$physical=0
 foreach($g in $a.sourcePostPreflight.groups){
  $dir=Join-Path $source $g.name;$mp=Join-Path $dir $g.manifest
  Need ((Hash $mp)-ceq $g.sha256) 'original manifest'
  $m=ReadJson $mp
  Need (@($m.files).Count-eq $g.rows-and@(Get-ChildItem -LiteralPath $dir -File -Recurse -Force).Count-eq $g.physical) 'original membership/count'
  foreach($f in $m.files){$p=Join-Path $dir $f.path;ExactPath $p;Need (([IO.FileInfo]$p).Length-eq $f.bytes-and(Hash $p)-ceq $f.sha256) 'original source row'}
  $rows+=$g.rows;$physical+=$g.physical
 }
 Need ($rows-eq 296-and$physical-eq 304-and@($a.sourcePostPreflight.groups).Count-eq 8) 'original 304/296/8'
 $pin=Join-Path $inner 'QUAL_SOURCE_PINS.tsv'
 Need ((Hash $pin)-ceq 'add45dc1d3792464ef1844363afcc88bd75a02300f3f2d7885bb24c07d0a0279') '1309 pin manifest'
 $lines=[IO.File]::ReadAllLines($pin);Need ($lines.Count-eq 1309) '1309 pin count'
 foreach($line in $lines){$v=$line.Split([char]9);Need ($v.Count-eq 4) 'pin shape';ExactPath $v[1];Need (([IO.FileInfo]$v[1]).Length-eq[long]$v[2]-and(Hash $v[1])-ceq $v[3]) 'all source/tool pins'}
 CheckCopies
}
function ReadyData {
 $r=ReadJson $readyPath
 Need ($r.actualAppThread-ceq $d.appThread-and$r.actualAppTurn-ceq $d.appTurn-and$r.appDeadlineEpochMs-eq $d.appDeadlineEpochMs-and$r.humanRef-ceq $d.humanRef-and$r.humanSha-ceq $d.humanSha-and$r.hostStarts-eq 1-and$r.payloadCalls-eq 0) 'actual current READY binding'
 Need ($r.profile.version-ceq '7.6.5'-and$r.profile.framework-ceq '.NET 10.0.11'-and$r.profile.edition-ceq 'Core'-and$r.profile.coreLibrary-ceq $core) 'actual host profile'
 $script:marker=$r.marker
 Need ($script:marker.nativeOrigin-cmatch '^[0-9]+$'-and$script:marker.utcOrigin-cmatch '^[0-9]+$') 'original decimal clock provenance'
 return $r
}
function ReadAuthority([bool]$fullWindow=$true) {
 $raw=[IO.File]::ReadAllBytes($authorityPath);$j=[Text.Json.JsonDocument]::Parse([Text.UTF8Encoding]::new($false,$true).GetString($raw));$a=[ordered]@{}
 try{foreach($p in $j.RootElement.EnumerateObject()){Need (-not $a.Contains($p.Name)-and$p.Value.ValueKind-eq[Text.Json.JsonValueKind]::String) 'flat unique string authority';$a[$p.Name]=$p.Value.GetString()}}finally{$j.Dispose()}
 Need (($a.Keys-join ' ')-ceq $fields-and[Convert]::ToBase64String((JsonBytes $a))-ceq[Convert]::ToBase64String($raw)) 'closed 19 strings canonical authority'
 Need ($a.schema-ceq 'hestia.m5.authority.v2'-and$a.version-ceq '2'-and$a.authorizationClass-ceq 'DIRECT_HUMAN_RUNTIME_ONCE'-and$a.scope-ceq 'HARMLESS_SIX_ONCE'-and$a.retry-ceq '0') 'fixed authority contract'
 Need ($a.humanMessageRef-ceq $d.humanRef-and$a.humanMessageRef-cne $spent-and$a.humanMessageSha256-ceq $d.humanSha-and$a.actualAppThread-ceq $d.appThread-and$a.actualAppTurn-ceq $d.appTurn-and$a.appStatus-ceq 'LOADED_CURRENT_A0'-and$a.paseoAgent-ceq $d.paseoAgent-and$a.workspace-ceq $d.workspace) 'new exact identity and human authority'
 Need ($a.candidateManifestSha256-ceq '66ed0bef42dad88ab71dd54be82e62b28804117048701e2757d134d93b62fbc0'-and$a.packagePinsSha256-ceq 'add45dc1d3792464ef1844363afcc88bd75a02300f3f2d7885bb24c07d0a0279'-and$a.outerSourceSha256-ceq $copies[0][1]-and$a.dispatcherSourceSha256-ceq $copies[1][1]-and$a.runnerSourceSha256-ceq $copies[2][1]) 'frozen bindings'
 $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 $reserve=if($fullWindow){60000}else{0}
 Need ($a.notBeforeUtc-cmatch '^[0-9]+$'-and$a.expiresUtc-cmatch '^[0-9]+$'-and[long]$a.notBeforeUtc-le $now-and[long]$a.expiresUtc-ge $now+$reserve-and[long]$a.expiresUtc-le [long]$d.appDeadlineEpochMs) 'authority and original payload remainder'
 return [pscustomobject]@{value=$a;sha256=(HashBytes $raw)}
}
function ValidateAcceptance($r) {
 CheckGrant;CheckCopies
 $a=ReadAuthority;$x=ReadJson $acceptPath
 Need ($x.status-ceq 'PASS'-and$x.actualAppThread-ceq $d.appThread-and$x.actualAppTurn-ceq $d.appTurn-and$x.sessionId-eq $r.sessionId-and$x.pid-eq $r.host.pid-and$x.creationFileTime-ceq $r.host.creationFileTime-and$x.parentPid-eq $r.host.parentPid-and$x.authoritySha256-ceq $a.sha256-and$x.prestartReadySha256-ceq(Hash $readyPath)-and$x.humanMessageRef-ceq $d.humanRef-and$x.humanMessageSha256-ceq $d.humanSha-and$x.nativeOrigin-ceq $r.marker.nativeOrigin-and$x.utcOrigin-ceq $r.marker.utcOrigin-and$x.appDeadlineEpochMs-eq $d.appDeadlineEpochMs) 'Root acceptance exact current binding'
 [void](ObserveHost $r.host)
 return $a
}
function AssertLateGuard {
 [void](AssertWindow 120000)
 Need ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+70000-le [long]$d.appDeadlineEpochMs) 'full future payload Appturn rest'
 Need ($d.appSnapshot.thread-ceq $d.appThread-and$d.appSnapshot.turn-ceq $d.appTurn-and$d.appSnapshot.status-ceq 'inProgress'-and$d.appSnapshot.startedAt*1000-eq $d.appStartEpochMs-and$d.appSnapshot.cwd-ceq $d.cwd) 'Root-only actual independent App snapshot'
 $age=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-[long]$d.appSnapshot.observedUtc
 Need ($age-ge 0-and$age-le 10000) 'fresh independent App snapshot'
 CheckGrant;[void](ObserveHost $script:rootReady.host);CheckCopies
 [void](AssertWindow 120000)
}
function WriteNew($path,[byte[]]$bytes,[bool]$rootWrite) {
 if($rootWrite){AssertLateGuard}else{[void](AssertWindow 110000)}
 $h=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{
  if($rootWrite){AssertLateGuard}else{[void](AssertWindow 110000)}
  $h.Write($bytes,0,$bytes.Length)
  if($rootWrite){AssertLateGuard}else{[void](AssertWindow 110000)}
  $h.Flush($true)
 }finally{$h.Dispose()}
 if($rootWrite){AssertLateGuard}else{[void](AssertWindow 110000)}
 $actual=[IO.File]::ReadAllBytes($path)
 Need ([Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($bytes)) 'separate durable readback'
 if($rootWrite){AssertLateGuard}else{[void](AssertWindow 110000)}
}
Profile;CheckInput;CheckGrant
$script:marker=$d.marker
switch($Mode){
 'Mark' {
  CheckSources
  @{nativeOrigin=([Environment]::TickCount64).ToString();utcOrigin=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString();profile='MANAGED_PS_7.6.5_NET_10.0.11';nativeApi='System.Environment.TickCount64';utcApi='System.DateTimeOffset.UtcNow'}|ConvertTo-Json -Compress
 }
 'OperatorWait' {
  [void](AssertWindow 110000)
  Need ($d.ready.version-ceq '7.6.5'-and$d.ready.framework-ceq '.NET 10.0.11'-and$d.ready.coreLibrary-ceq $core) 'actual initial host metadata'
  $hostTuple=ObserveHost $d.ready
  $r=[ordered]@{schema='hestia.m5.prestart-ready.v2';actualAppThread=$d.appThread;actualAppTurn=$d.appTurn;appDeadlineEpochMs=$d.appDeadlineEpochMs;humanRef=$d.humanRef;humanSha=$d.humanSha;marker=$d.marker;sessionId=$d.sessionId;host=$hostTuple;profile=$d.ready;hostStarts=1;payloadCalls=0;rawLaunch=$d.rawLaunch}
  WriteNew $readyPath (JsonBytes $r) $false
  while($true){
   $x=ClockData
   if($x.nativeElapsedMs-ge 110000-or$x.utcElapsedMs-ge 110000-or[long]$x.utc-ge[long]$d.appDeadlineEpochMs){@{accepted=$false;nativeElapsedMs=$x.nativeElapsedMs;reason='NO_TIMELY_ROOT_AUTHORITY'}|ConvertTo-Json -Compress;break}
   if((Test-Path -LiteralPath $authorityPath)-and(Test-Path -LiteralPath $acceptPath)){
    [void](ValidateAcceptance ([pscustomobject]$r));$x=AssertWindow 110000
    @{accepted=$true;nativeElapsedMs=$x.nativeElapsedMs;authoritySha256=(Hash $authorityPath)}|ConvertTo-Json -Compress;break
   }
   Start-Sleep -Milliseconds 25
  }
 }
 'Admit' {
  $r=ReadyData
  Need ($r.sessionId-eq $d.sessionId-and$r.host.creationFileTime-ceq $d.ready.creationFileTime) 'same original session'
  [void](ValidateAcceptance $r);$x=AssertWindow 120000
  @{accepted=$true;nativeElapsedMs=$x.nativeElapsedMs;utc=$x.utc}|ConvertTo-Json -Compress
 }
 'RootWait' {
  $waitStart=[Environment]::TickCount64
  while(-not(Test-Path -LiteralPath $readyPath)){
   Need ([Environment]::TickCount64-$waitStart-lt 180000-and[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()+70000-lt[long]$d.appDeadlineEpochMs) 'Root bounded metadata wait'
   Start-Sleep -Milliseconds 25
  }
  $r=ReadyData;[void](AssertWindow 110000)
  $r|ConvertTo-Json -Compress -Depth 60
 }
 'Issue' {
  $script:rootReady=ReadyData
  Need ((HashBytes (JsonBytes $script:rootReady))-ceq(HashBytes (JsonBytes $d.ready))) 'same Root-read READY bytes'
  CheckSources;AssertLateGuard
  foreach($name in @('M5_HARMLESS_RUNTIME_AUTHORITY.json','M5_HARMLESS_OUTER_CLOCK.json','M5_HARMLESS_REVIEWED_PACKAGE.json','M5_HARMLESS_RUNTIME_CONTEXT.json','M5_HARMLESS_RUNTIME_GRANT.json','M5_HARMLESS_CONSUMED','M5_HARMLESS_DISPATCHED')){Need (-not(Test-Path -LiteralPath (Join-Path $base $name))) 'unoccupied one-shot slots'}
  Need (-not(Test-Path -LiteralPath $acceptPath)) 'no acceptance overwrite'
  $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $a=[ordered]@{schema='hestia.m5.authority.v2';version='2';humanMessageRef=[string]$d.humanRef;humanMessageSha256=[string]$d.humanSha;authorizationClass='DIRECT_HUMAN_RUNTIME_ONCE';scope='HARMLESS_SIX_ONCE';retry='0';candidateManifestSha256='66ed0bef42dad88ab71dd54be82e62b28804117048701e2757d134d93b62fbc0';packagePinsSha256='add45dc1d3792464ef1844363afcc88bd75a02300f3f2d7885bb24c07d0a0279';outerSourceSha256=$copies[0][1];dispatcherSourceSha256=$copies[1][1];runnerSourceSha256=$copies[2][1];actualAppThread=[string]$d.appThread;actualAppTurn=[string]$d.appTurn;appStatus='LOADED_CURRENT_A0';paseoAgent=[string]$d.paseoAgent;workspace=[string]$d.workspace;notBeforeUtc=($now-5000).ToString();expiresUtc=([Math]::Min($now+180000,[long]$d.appDeadlineEpochMs)).ToString()}
  Need (($a.Keys-join ' ')-ceq $fields) 'unchanged closed authority schema'
  WriteNew $authorityPath (JsonBytes $a) $true
  $r=$script:rootReady
  $acceptance=[ordered]@{schema='hestia.m5.warmhost-root-prestart-acceptance.v1';status='PASS';actualAppThread=$d.appThread;actualAppTurn=$d.appTurn;appDeadlineEpochMs=$d.appDeadlineEpochMs;sessionId=$r.sessionId;pid=$r.host.pid;creationFileTime=$r.host.creationFileTime;parentPid=$r.host.parentPid;authoritySha256=(Hash $authorityPath);prestartReadySha256=(Hash $readyPath);humanMessageRef=$d.humanRef;humanMessageSha256=$d.humanSha;nativeOrigin=$r.marker.nativeOrigin;utcOrigin=$r.marker.utcOrigin;appSnapshot=$d.appSnapshot;independentHostRecheckedBeforeAuthority=$true;original60PayloadBoundaryUnchanged=$true;retry=0;issuedUtc=[DateTimeOffset]::UtcNow.ToString('o')}
  WriteNew $acceptPath (JsonBytes $acceptance) $true
  @{status='ROOT_AUTHORITY_ISSUED_ONCE';authoritySha256=(Hash $authorityPath);acceptanceSha256=(Hash $acceptPath)}|ConvertTo-Json -Compress
 }
 'Observe' {
  $x=ClockData
  $owned=ObserveHost $d.ready $false
  $remaining=$null;$clockPath=Join-Path $base 'M5_HARMLESS_OUTER_CLOCK.json'
  if(Test-Path -LiteralPath $clockPath){
   $a=ReadAuthority $false;$clock=ReadJson $clockPath
   Need ($clock.authorityRecordSha256-ceq $a.sha256-and$clock.humanMessageSha256-ceq $d.humanSha-and$clock.nativeClockApi-ceq 'System.Environment.TickCount64') 'actual R04 original payload clock'
   $remaining=[Math]::Max(0,[Math]::Min([long]$clock.overallEnd-[long]$x.native,[long]$clock.utcEnd-[long]$x.utc))
  }
  @{nativeElapsedMs=$x.nativeElapsedMs;utc=$x.utc;ownHost=$owned;outerRemainingMs=$remaining}|ConvertTo-Json -Compress -Depth 8
 }
}

