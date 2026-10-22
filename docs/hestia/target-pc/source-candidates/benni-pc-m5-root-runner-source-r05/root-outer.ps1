# SOURCE R04 ONLY. Fixed atomic managed outer; never executed by source checks.
[CmdletBinding()]param()
$OuterStopwatch=[Diagnostics.Stopwatch]::StartNew()
$t0=[Environment]::TickCount64
$u0=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$ErrorActionPreference='Stop'
$Base='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13'
$Source='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05'
$PowerShell='C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'
$ManagedPowerShell='C:\Users\benni\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe'
$ManagedCoreLibrary='C:\Users\benni\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\System.Private.CoreLib.dll'
$LauncherSourceSha256='7a7334e72013dda3c2f2947292aca615f20137845747d1f45b507858ced83006'
$LauncherDllSha256='148f0ac69fc07651922b591e32d63660f874b88992d50ab4226908d1e1233b70'
$OriginProducerSha256='1cfcf985388845150f3e1271bc6fe3415e714934211604771cc6220431782e6e'
$ExpectedProducerHostProfile='UNKNOWN'
$ExpectedProducerTimeOriginMicros='UNKNOWN'
function Need($ok,$reason){if(-not$ok){throw ('HOLD_CHECK:'+ $reason)}}
function HashBytes([byte[]]$b){return [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b)).ToLowerInvariant()}
function ExactPath($p){
 Need ([IO.Path]::IsPathFullyQualified($p)-and[IO.Path]::GetFullPath($p)-ceq$p-and$p.StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase)) 'fixed CIFI path'
 $i=Get-Item -LiteralPath $p -Force
 while($null-ne$i){Need (-not($i.Attributes-band[IO.FileAttributes]::ReparsePoint)) 'no reparse';if($i-is[IO.FileInfo]){$i=$i.Directory}else{$i=$i.Parent}}
}
function Bytes($p){ExactPath $p;$i=[IO.FileInfo]$p;Need ($i.Length-gt0-and$i.Length-le65536) 'bounded record bytes';return [IO.File]::ReadAllBytes($p)}
function Compact($d){return [Text.UTF8Encoding]::new($false,$true).GetBytes(($d|ConvertTo-Json -Compress -Depth 6))}
function ClosedBytes([byte[]]$b,$fields,$schema,$version='1'){
 Need ($b.Length-gt0-and$b.Length-le65536-and-not($b.Length-ge3-and$b[0]-eq239-and$b[1]-eq187-and$b[2]-eq191)) 'UTF8 no BOM bound'
 $text=[Text.UTF8Encoding]::new($false,$true).GetString($b);$doc=[Text.Json.JsonDocument]::Parse($text);$d=[ordered]@{}
 try{Need ($doc.RootElement.ValueKind-eq[Text.Json.JsonValueKind]::Object) 'flat object';foreach($p in $doc.RootElement.EnumerateObject()){Need (-not$d.Contains($p.Name)-and$p.Value.ValueKind-eq[Text.Json.JsonValueKind]::String) 'duplicate/type';$d[$p.Name]=$p.Value.GetString()}}finally{$doc.Dispose()}
 $keys=$fields.Split(' ');Need ($d.Count-eq$keys.Length-and$d.schema-ceq$schema-and$d.version-ceq$version) 'closed schema'
 Need (($d.Keys-join' ')-ceq$fields) 'exact canonical field order'
 foreach($k in $keys){Need ($d.Contains($k)-and-not[string]::IsNullOrWhiteSpace($d[$k])) ('field '+$k)}
 Need ([Convert]::ToBase64String((Compact $d))-ceq[Convert]::ToBase64String($b)) 'ordered compact canonical bytes';return $d
}
function ReadClosed($p,$fields,$schema,$version='1'){return ClosedBytes (Bytes $p) $fields $schema $version}
function Dec($s){Need ($s-is[string]-and$s-cmatch'^(0|[1-9][0-9]*)$') 'canonical decimal';return [long]::Parse($s,[Globalization.CultureInfo]::InvariantCulture)}
function GuidD($s){Need ([guid]::ParseExact($s,'D').ToString('D')-ceq$s) 'lowercase GUID-D'}
function Authority(){
 $a=ReadClosed (Join-Path $Base 'M5_HARMLESS_RUNTIME_AUTHORITY.json') 'schema version humanMessageRef humanMessageSha256 authorizationClass scope retry candidateManifestSha256 packagePinsSha256 outerSourceSha256 dispatcherSourceSha256 runnerSourceSha256 actualAppThread actualAppTurn appStatus paseoAgent workspace notBeforeUtc expiresUtc' 'hestia.m5.authority.v2' '2'
 Need ($a.authorizationClass-ceq'DIRECT_HUMAN_RUNTIME_ONCE'-and$a.scope-ceq'HARMLESS_SIX_ONCE'-and$a.retry-ceq'0') 'genuine direct runtime once required'
 Need ($a.actualAppThread-ceq'01a13648-c55b-7250-bf07-34921d70b43b'-and$a.appStatus-ceq'LOADED_CURRENT_A0'-and$a.workspace.StartsWith('wks_')) 'external loaded same A0'
 foreach($k in @('actualAppTurn','paseoAgent')){GuidD $a[$k]}
 foreach($k in @('humanMessageSha256','candidateManifestSha256','packagePinsSha256','outerSourceSha256','dispatcherSourceSha256','runnerSourceSha256')){Need ($a[$k]-cmatch'^[0-9a-f]{64}$') ('hash '+$k)}
 Need ($a.humanMessageRef-cne'call_f75fff55e3a34653b255fd83365457ca'-and$a.humanMessageRef-cnotmatch'(?i)r05|source') 'source/old human ref denied'
 [void](Dec $a.notBeforeUtc);[void](Dec $a.expiresUtc);return $a
}
function AddClock([long]$origin,[long]$delta){
 Need ($origin-ge0-and$delta-ge0-and$origin-le[long]::MaxValue-$delta) 'checked nonnegative Int64 clock addition'
 return [long]($origin+$delta)
}
function ExpectedOriginProducerHash($a){
 $p=Join-Path $Base 'root-outer.ps1';$bytes=Bytes $p
 Need ((HashBytes $bytes)-ceq$a.outerSourceSha256) 'independent expected outer source'
 $text=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)
 $m=[regex]::Matches($text,'(?m)^\$OriginProducerSha256=''([0-9a-f]{64})''\r?$')
 Need ($m.Count-eq1) 'one transitively pinned Producer source literal'
 return $m[0].Groups[1].Value
}
function ReadExternalOrigin($a,[long]$managedNative,[long]$managedUtc){
 $path=Join-Path $Base 'M5_HARMLESS_EXTERNAL_ORIGIN.json'
 $script:ExternalOriginSpent=[IO.File]::Exists($path)
 $fields='schema version authorityRecordSha256 humanMessageSha256 outerSourceSha256 producerSourceSha256 producerHostProfile platform nodeTimeOriginMicros clockMode nativeClockApi utcClockApi monotonicClockApi nativeIssued workEnd overallEnd utcIssued utcEnd monotonicIssuedMicros nativeBeforeWrite utcBeforeWrite monotonicBeforeWriteMicros'
 $o=ReadClosed $path $fields 'hestia.m5.external-origin.v1'
 foreach($k in @('authorityRecordSha256','humanMessageSha256','outerSourceSha256','producerSourceSha256')){Need ($o[$k]-cmatch'^[0-9a-f]{64}$') 'origin exact hash format'}
 Need ($o.authorityRecordSha256-ceq(HashBytes (Compact $a))-and$o.humanMessageSha256-ceq$a.humanMessageSha256-and$o.outerSourceSha256-ceq$a.outerSourceSha256-and$o.producerSourceSha256-ceq(ExpectedOriginProducerHash $a)) 'origin independent authority/source chain'
 # No trusted active Node image/version/runtime ID/timeOrigin binding exists in this source revision.
 Need ($ExpectedProducerHostProfile-cne'UNKNOWN'-and$ExpectedProducerTimeOriginMicros-cne'UNKNOWN'-and$o.producerHostProfile-ceq$ExpectedProducerHostProfile-and$o.nodeTimeOriginMicros-ceq$ExpectedProducerTimeOriginMicros) 'NODE_PROFILE_HOLD: genuine active runtime binding unavailable'
 Need ($o.platform-ceq'win32'-and$o.clockMode-ceq'PRESTART_NODE_PRODUCER'-and$o.nativeClockApi-ceq'node:os.uptime/libuv:GetTickCount64/FLOOR_ORIGIN_CEIL_OBSERVATION'-and$o.utcClockApi-ceq'Date.now'-and$o.monotonicClockApi-ceq'node:perf_hooks.performance.now') 'qualified original clock domains only'
 foreach($k in @('nodeTimeOriginMicros','nativeIssued','workEnd','overallEnd','utcIssued','utcEnd','monotonicIssuedMicros','nativeBeforeWrite','utcBeforeWrite','monotonicBeforeWriteMicros')){[void](Dec $o[$k])}
 $issued=Dec $o.nativeIssued;$utc=Dec $o.utcIssued
 Need ($issued-le[long]::MaxValue-60000-and$utc-le[long]::MaxValue-60000-and$issued%1000-eq0) 'checked floor-second original origin'
 Need ((Dec $o.workEnd)-$issued-eq48000-and(Dec $o.overallEnd)-$issued-eq60000-and(Dec $o.utcEnd)-$utc-eq60000) 'original external 48/60'
 Need ((Dec $a.notBeforeUtc)-le$utc-and(Dec $a.expiresUtc)-ge(Dec $o.utcEnd)) 'authority covers pre-start full interval'
 Need ((Dec $o.nativeBeforeWrite)-ge$issued-and(Dec $o.nativeBeforeWrite)-lt(Dec $o.workEnd)-and(Dec $o.utcBeforeWrite)-ge$utc-and(Dec $o.utcBeforeWrite)-lt($utc+48000)-and(Dec $o.monotonicBeforeWriteMicros)-ge(Dec $o.monotonicIssuedMicros)-and(Dec $o.monotonicBeforeWriteMicros)-(Dec $o.monotonicIssuedMicros)-lt48000000) 'original work still open at issuance'
 Need ($managedNative-ge$issued-and$managedNative-lt(Dec $o.workEnd)-and$managedUtc-ge$utc-and$managedUtc-lt($utc+48000)) 'pre-start origin <= actual managed entry < original work end'
 Need ([Environment]::TickCount64-ge$issued-and[Environment]::TickCount64-lt(Dec $o.workEnd)-and[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-ge$utc-and[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-lt($utc+48000)) 'actual admission within original work interval'
 return $o
}
function Clock($c){
 $n=[Environment]::TickCount64;$u=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 Need ($n-ge(Dec $c.issued)-and$n-le(Dec $c.overallEnd)-and$u-ge(Dec $c.utcIssued)-and$u-le(Dec $c.utcEnd)-and$OuterStopwatch.ElapsedMilliseconds-le60000) 'intersection of original native UTC and Stopwatch hard ends'
}
function Remaining($c,$work=$false){
 $nativeEnd=if($work){Dec $c.workEnd}else{Dec $c.overallEnd}
 $utcEnd=if($work){AddClock (Dec $c.utcIssued) 48000}else{Dec $c.utcEnd}
 $swEnd=if($work){48000}else{60000}
 return [int][Math]::Max(0,[Math]::Min([Math]::Min($nativeEnd-[Environment]::TickCount64,$utcEnd-[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()),$swEnd-$OuterStopwatch.ElapsedMilliseconds))
}
function ExactManagedTool($p){
 Need ($p-ceq$ManagedPowerShell-or$p-ceq$ManagedCoreLibrary) 'only two fixed managed tools outside CIFI'
 Need ([IO.Path]::IsPathFullyQualified($p)-and[IO.Path]::GetFullPath($p)-ceq$p) 'canonical managed path'
 $i=Get-Item -LiteralPath $p -Force
 while($null-ne$i){Need (-not($i.Attributes-band[IO.FileAttributes]::ReparsePoint)) 'no managed tool reparse';if($i-is[IO.FileInfo]){$i=$i.Directory}else{$i=$i.Parent}}
}
function CheckOuterProfile($a){
 Need ($PSCommandPath-ceq(Join-Path $Base 'root-outer.ps1')) 'fixed installed outer only'
 ExactPath $PSCommandPath
 Need ((Get-FileHash -LiteralPath $PSCommandPath).Hash.ToLowerInvariant()-ceq$a.outerSourceSha256) 'independently issued installed outer bytes'
 Need ([Environment]::ProcessPath-ceq$ManagedPowerShell-and$PSVersionTable.PSVersion.ToString()-ceq'7.6.5'-and$PSVersionTable.PSEdition-ceq'Core'-and[Runtime.InteropServices.RuntimeInformation]::FrameworkDescription-ceq'.NET 10.0.11'-and[Environment]::OSVersion.Platform-eq[PlatformID]::Win32NT-and[Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture-eq[Runtime.InteropServices.Architecture]::X64) 'actual managed Root profile outside CIFI'
 Need ([object].Assembly.Location-ceq$ManagedCoreLibrary-and[object].Assembly.GetName().Version.ToString()-ceq'10.0.0.0') 'exact managed CoreLib'
 ExactManagedTool $ManagedPowerShell;ExactManagedTool $ManagedCoreLibrary
 Need ((Get-FileHash -LiteralPath $ManagedPowerShell).Hash.ToLowerInvariant()-ceq'362a356ce7f0940ec74f73a8fc2c990a2cc24a38a11c90bbd8eca947110ad139') 'actual managed image hash'
 Need ((Get-FileHash -LiteralPath $ManagedCoreLibrary).Hash.ToLowerInvariant()-ceq'ed80a1a5dd066c0407ad59686f9af90a4f3e55dbf3e4c973b53cc8c9d0706f82') 'actual managed CoreLib hash'
 ExactPath $PowerShell
 Need ((Get-FileHash -LiteralPath $PowerShell).Hash.ToLowerInvariant()-ceq'db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f') 'separate pinned CIFI child host'
}
function CheckSources($a,$c){
 Clock $c
 foreach($path in @((Join-Path $Source 'SOURCE_MANIFEST_FINAL.json'),(Join-Path $Source 'QUAL_SOURCE_PINS.tsv'))){ExactPath $path}
 Need ((Get-FileHash -LiteralPath (Join-Path $Source 'SOURCE_MANIFEST_FINAL.json')).Hash.ToLowerInvariant()-ceq$a.candidateManifestSha256-and(Get-FileHash -LiteralPath (Join-Path $Source 'QUAL_SOURCE_PINS.tsv')).Hash.ToLowerInvariant()-ceq$a.packagePinsSha256) 'reviewed frozen candidate and pins'
 foreach($pair in @(@('root-outer.ps1','outerSourceSha256'),@('root-dispatch.ps1','dispatcherSourceSha256'),@('root-runner.ps1','runnerSourceSha256'))){$installed=Join-Path $Base $pair[0];ExactPath $installed;Need ((Get-FileHash -LiteralPath $installed).Hash.ToLowerInvariant()-ceq$a[$pair[1]]) 'all three reviewed installed source hashes'}
 foreach($line in [IO.File]::ReadAllLines((Join-Path $Source 'QUAL_SOURCE_PINS.tsv'))){$v=$line.Split([char]9);Need ($v.Count-eq4) 'fixed source/tool pin shape';ExactPath $v[1];Need (([IO.FileInfo]$v[1]).Length-eq(Dec $v[2])-and(Get-FileHash -LiteralPath $v[1]).Hash.ToLowerInvariant()-ceq$v[3]) 'actual frozen source/tool pins';Clock $c}
 Clock $c
}
function NewImmutable($path,[byte[]]$bytes,$fields,$schema){
 ExactPath ([IO.Path]::GetDirectoryName($path))
 $s=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 $script:OuterSpent=$true
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}
 $actual=Bytes $path
 Need ($actual.Length-eq$bytes.Length-and(HashBytes $actual)-ceq(HashBytes $bytes)-and[Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($bytes)) 'durable separate exact readback'
 [void](ClosedBytes $actual $fields $schema)
 return HashBytes $actual
}
function CheckLauncherBytes(){
 foreach($pair in @(@('RootOuterAtomicLauncher.cs',$LauncherSourceSha256,1048576),@('RootOuterAtomicLauncher.dll',$LauncherDllSha256,2097152))){
  $p=Join-Path $Base $pair[0];ExactPath $p;$file=[IO.FileInfo]$p
  Need ($file.Length-gt0-and$file.Length-le$pair[2]-and(Get-FileHash -LiteralPath $p).Hash.ToLowerInvariant()-ceq$pair[1]) 'fixed atomic launcher source/DLL bytes'
 }
}
function ReadLauncherDll(){
 $p=Join-Path $Base 'RootOuterAtomicLauncher.dll';ExactPath $p
 $h=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{
  Need ($h.Length-gt0-and$h.Length-le2097152) 'bounded launcher DLL'
  $bytes=[byte[]]::new([int]$h.Length);$at=0
  while($at-lt$bytes.Length){$n=$h.Read($bytes,$at,$bytes.Length-$at);Need ($n-gt0) 'complete launcher DLL';$at+=$n}
  Need ($h.ReadByte()-eq-1-and(HashBytes $bytes)-ceq$LauncherDllSha256) 'actual reread launcher DLL hash'
  return ,$bytes
 }finally{$h.Dispose()}
}
# ENTRY: only atomic native launcher after the durable one-shot; no managed Dispatcher start.
$script:OuterSpent=$false
$script:ExternalOriginSpent=$false
$failure=$null;$done=$null;$clockHash=$null;$assembly=$null
try{
 $a=Authority
 $origin=ReadExternalOrigin $a $t0 $u0
 $nativeIssued=Dec $origin.nativeIssued;$workEnd=Dec $origin.workEnd;$overallEnd=Dec $origin.overallEnd;$utcIssued=Dec $origin.utcIssued;$utcEnd=Dec $origin.utcEnd
 $c=[ordered]@{schema='hestia.m5.outer-clock.v1';version='1';authorityRecordSha256=(HashBytes (Compact $a));humanMessageSha256=$a.humanMessageSha256;clockMode='PREISSUED';clockOrigin=('ROOT_EXTERNAL_ORIGIN_V1:'+(HashBytes (Compact $origin)));nativeClockApi=$origin.nativeClockApi;utcClockApi=$origin.utcClockApi;managedOuterOutsideCIFI='true';dispatcherStartupIncluded='true';issued=$nativeIssued.ToString();workEnd=$workEnd.ToString();overallEnd=$overallEnd.ToString();utcIssued=$utcIssued.ToString();utcEnd=$utcEnd.ToString()}
 $ClockFields='schema version authorityRecordSha256 humanMessageSha256 clockMode clockOrigin nativeClockApi utcClockApi managedOuterOutsideCIFI dispatcherStartupIncluded issued workEnd overallEnd utcIssued utcEnd'
 [void](ClosedBytes (Compact $c) $ClockFields 'hestia.m5.outer-clock.v1')
 Need ((Dec $a.notBeforeUtc)-le$utcIssued-and(Dec $a.expiresUtc)-ge$utcEnd) 'Authority covers original full pre-start 60s window'
 Clock $c
 CheckOuterProfile $a
 CheckSources $a $c
 CheckLauncherBytes
 $clockPath=Join-Path $Base 'M5_HARMLESS_OUTER_CLOCK.json'
 $clockHash=NewImmutable $clockPath (Compact $c) $ClockFields 'hestia.m5.outer-clock.v1'
 Need ((Remaining $c $true)-gt0) 'original work budget after Clock publication'
 $launchBytes=ReadLauncherDll
 Clock $c
 $assembly=[Reflection.Assembly]::Load($launchBytes)
 $type=$assembly.GetType('Hestia.M5.RootOuterR04.RootOuterAtomicLauncher',$true,$false)
 $method=$type.GetMethod('RunDispatcher',[Reflection.BindingFlags]::Public-bor[Reflection.BindingFlags]::Static)
 Need ($null-ne$method) 'fixed atomic launcher method'
 $done=$method.Invoke($null,@([long]$nativeIssued,[long]$workEnd,[long]$overallEnd,[long]$utcIssued,[long]$utcEnd,$OuterStopwatch,[string]$a.dispatcherSourceSha256))
 Need ($null-ne$done-and$done.GetType().Assembly-eq$assembly-and$done.GetType().FullName-ceq'Hestia.M5.RootOuterR04.LaunchResult') 'actual closed launcher result type'
 Need ($done.Success-and$done.Created-and$done.Resumed-and$done.Terminal-and$done.ExitCode-eq0-and$done.StdoutEof-and$done.StderrEof-and$done.JobZero-and$done.HandlesClosed-and-not$done.PartialFrame-and$null-eq$done.Failure) ('atomic launch/closure HOLD: '+$done.Failure)
 Clock $c
}catch{$failure=$_.Exception}
$status=if($script:OuterSpent-or$script:ExternalOriginSpent){'SPENT_HOLD'}else{'HOLD'}
if($null-eq$failure){try{Clock $c;$status='PASS'}catch{$failure=$_.Exception}}
$proof=[ordered]@{outerStatus=$status;clockCreated=$script:OuterSpent;clockSha256=$clockHash;atomicLauncher=if($null-ne$done){$done}else{$null};nativeIssued=$nativeIssued;nativeWorkEnd=$workEnd;nativeOverallEnd=$overallEnd;utcIssued=$utcIssued;utcEnd=$utcEnd;stopwatchElapsedMs=$OuterStopwatch.ElapsedMilliseconds;runtimeQualification='NODE_PROFILE_HOLD';failure=if($null-eq$failure){$null}else{$failure.ToString()}}
Write-Output ($proof|ConvertTo-Json -Compress -Depth 6)
if($null-ne$failure){exit 1}
try{Clock $c}catch{Write-Output ('SPENT_HOLD:'+ $_.Exception.ToString());exit 1}
exit 0
