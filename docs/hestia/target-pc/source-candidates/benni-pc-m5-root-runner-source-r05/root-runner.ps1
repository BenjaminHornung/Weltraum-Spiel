# SOURCE R04 ONLY: inherited atomic outer Job required; not installed or executed.
[CmdletBinding()]param()
$OriginManagedEntryNative=[Environment]::TickCount64
$OriginManagedEntryUtc=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$ExpectedProducerHostProfile='UNKNOWN'
$ExpectedProducerTimeOriginMicros='UNKNOWN'
$ErrorActionPreference='Stop'
$Base='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13'
$Source='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05'
$PowerShell='C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'
function Need($ok,$reason){if(-not$ok){throw ('SPENT_HOLD:'+ $reason)}}
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
function OuterClock($a){
 $o=ReadExternalOrigin $a $OriginManagedEntryNative $OriginManagedEntryUtc
 $c=ReadClosed (Join-Path $Base 'M5_HARMLESS_OUTER_CLOCK.json') 'schema version authorityRecordSha256 humanMessageSha256 clockMode clockOrigin nativeClockApi utcClockApi managedOuterOutsideCIFI dispatcherStartupIncluded issued workEnd overallEnd utcIssued utcEnd' 'hestia.m5.outer-clock.v1'
 Need ($c.authorityRecordSha256-ceq(HashBytes (Compact $a))-and$c.humanMessageSha256-ceq$a.humanMessageSha256) 'independent external authority binding'
 Need ($c.clockMode-ceq'PREISSUED'-and$c.clockOrigin-ceq('ROOT_EXTERNAL_ORIGIN_V1:'+(HashBytes (Compact $o)))-and$c.nativeClockApi-ceq$o.nativeClockApi-and$c.utcClockApi-ceq$o.utcClockApi-and$c.managedOuterOutsideCIFI-ceq'true'-and$c.dispatcherStartupIncluded-ceq'true') 'exact external origin hash/domains'
 Need ($c.issued-ceq$o.nativeIssued) 'original pre-start native origin'
 foreach($k in @('workEnd','overallEnd','utcIssued','utcEnd')){Need ($c[$k]-ceq$o[$k]) ('no managed reset '+$k)}
 Clock $c;return $c
}

function Clock($c){$n=[Environment]::TickCount64;$u=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();Need ($n-ge(Dec $c.issued)-and$n-le(Dec $c.overallEnd)-and$u-ge(Dec $c.utcIssued)-and$u-le(Dec $c.utcEnd)) 'both unchanged outer endpoints'}
function NewImmutable($path,[byte[]]$bytes,$fields,$schema){
 ExactPath ([IO.Path]::GetDirectoryName($path))
 # Every preexisting slot, including a valid one, is SPENT_HOLD; never delete/repair.
 $s=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}
 # Only closed + separately reopened exact durable readback permits continuation.
 $actual=Bytes $path;Need ($actual.Length-eq$bytes.Length-and(HashBytes $actual)-ceq(HashBytes $bytes)-and[Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($bytes)) 'durable exact readback'
 [void](ClosedBytes $actual $fields $schema);return HashBytes $actual
}
function Observe([long]$id){
 $p=Get-Process -Id $id -ErrorAction Stop
 try{$w=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$id) -Property ProcessId,ParentProcessId -ErrorAction Stop;Need ($null-ne$w-and$w.ProcessId-eq$id) 'actual selected process';return [ordered]@{pid=$id.ToString();creation=$p.StartTime.ToFileTimeUtc().ToString();image=$p.MainModule.FileName;parentPid=$w.ParentProcessId.ToString()}}finally{$p.Dispose()}
}
function Match($a,$b){foreach($k in @('pid','creation','image','parentPid')){Need ($a[$k]-ceq$b[$k]) ('actual tuple '+$k)}}
function CheckSources($a,$c){
 Clock $c;Need ((Get-FileHash (Join-Path $Source 'SOURCE_MANIFEST_FINAL.json')).Hash.ToLowerInvariant()-ceq$a.candidateManifestSha256-and(Get-FileHash (Join-Path $Source 'QUAL_SOURCE_PINS.tsv')).Hash.ToLowerInvariant()-ceq$a.packagePinsSha256) 'reviewed candidate/pins'
 foreach($pair in @(@('root-outer.ps1','outerSourceSha256'),@('root-dispatch.ps1','dispatcherSourceSha256'),@('root-runner.ps1','runnerSourceSha256'))){$installed=Join-Path $Base $pair[0];ExactPath $installed;Need ((Get-FileHash -LiteralPath $installed).Hash.ToLowerInvariant()-ceq$a[$pair[1]]) 'reviewed byte-exact installed afterimage'}
 foreach($line in [IO.File]::ReadAllLines((Join-Path $Source 'QUAL_SOURCE_PINS.tsv'))){$v=$line.Split([char]9);Need ($v.Count-eq4-and([IO.FileInfo]$v[1]).Length-eq(Dec $v[2])-and(Get-FileHash $v[1]).Hash.ToLowerInvariant()-ceq$v[3]) 'actual source/tool pins'}
 Need ([Environment]::ProcessPath-ceq$PowerShell-and$PSVersionTable.PSVersion.ToString()-ceq'7.6.4'-and[Runtime.InteropServices.RuntimeInformation]::FrameworkDescription-ceq'.NET 10.0.10') 'qualified actual host';Clock $c
}
function Remaining($c,$work=$false){
 $nativeEnd=if($work){Dec $c.workEnd}else{Dec $c.overallEnd}
 return [int][Math]::Max(0,[Math]::Min($nativeEnd-[Environment]::TickCount64,(Dec $c.utcEnd)-[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()))
}
function Pump($s){
 if($s.eof-or$s.broken){return}
 if($null-eq$s.pending){$s.pending=$s.reader.ReadAsync($s.buffer,0,$s.buffer.Length)}
 if($s.pending.IsCompleted){
  $n=$s.pending.GetAwaiter().GetResult();$s.pending=$null
  if($n-eq0){$s.eof=$true}else{Need ($s.data.Length+$n-le1048576) 'bounded stdout/stderr';[void]$s.data.Append($s.buffer,0,$n)}
 }
}
function Drain($child,$c,$work){
 while((Remaining $c $work)-gt0){
  foreach($name in @('stdout','stderr')){
   $s=$child.channels[$name];if($null-eq$s.reader-or$s.broken){continue}
   try{Pump $s}catch{$s.broken=$true;$child.abort=$true;$child.errors.Add($_.Exception);throw}
  }
  try{$child.terminal=$child.process.HasExited}catch{$child.errors.Add($_.Exception);break}
  $complete=$true;foreach($name in @('stdout','stderr')){$s=$child.channels[$name];if(-not($s.eof-or$s.broken-or$null-eq$s.reader)){$complete=$false}}
  if($child.terminal-and$complete){break}
  Start-Sleep -Milliseconds 1
 }
}
function BeginChild($kind,$c,$custody){
 Clock $c;Need ((Remaining $c $true)-gt0) 'original work cutoff before child'
 $path=if($kind-ceq'Runner'){Join-Path $Base 'root-runner.ps1'}elseif($kind-ceq'Handoff'){Join-Path $Source 'root-handoff.ps1'}else{throw 'SPENT_HOLD: fixed role only'}
 $p=[Diagnostics.Process]::new()
 $child=@{process=$p;started=$false;handle=$null;pid=$null;creation=$null;terminal=$false;streams=$false;handleClosed=$false;exitCode=$null;errors=[Collections.Generic.List[Exception]]::new();channels=@{}}
 foreach($name in @('stdout','stderr')){$child.channels[$name]=@{reader=$null;buffer=[char[]]::new(4096);pending=$null;data=[Text.StringBuilder]::new();eof=$false;broken=$false}}
 $custody.child=$child
 try{
  $p.StartInfo.FileName=$PowerShell
  foreach($arg in @('-NoProfile','-NonInteractive','-File',$path)){$p.StartInfo.ArgumentList.Add($arg)}
  $p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.WorkingDirectory=$Base
  $custody.startAttempted=$true
  Need ($p.Start()) 'fixed child start'
  $child.started=$true
  $custody.started=$true
  $child.handle=$p.SafeHandle
  $child.pid=$p.Id
  $child.creation=$p.StartTime.ToFileTimeUtc().ToString()
  $child.channels.stdout.reader=$p.StandardOutput
  $child.channels.stderr.reader=$p.StandardError
  return $child
 }catch{
  $primary=$_.Exception
  if($child.started){
   $owned=$child;$child=$null;$owned.abort=$true;
   try{[void](FinishChild $owned $c)}catch{$primary=[AggregateException]::new($primary,$_.Exception)}
  }else{try{$p.Dispose()}catch{$primary=[AggregateException]::new($primary,$_.Exception)}}
  throw $primary
 }
}
function FinishChild($child,$c){
 $errors=$child.errors
 Need (-not$child.finishStarted) 'one finisher per child';$child.finishStarted=$true
 if($child.abort){try{$child.process.Kill()}catch{$errors.Add($_.Exception)}}
 try{
  # Metadata failures still own a started Process; acquire each remaining stream independently.
  foreach($name in @('stdout','stderr')){
   $s=$child.channels[$name]
   if($null-eq$s.reader){try{$s.reader=if($name-ceq'stdout'){$child.process.StandardOutput}else{$child.process.StandardError}}catch{$s.broken=$true;$child.abort=$true;$errors.Add($_.Exception)}}
  }
  if(-not$child.abort){try{Drain $child $c $true}catch{$child.abort=$true;if(-not$errors.Contains($_.Exception)){$errors.Add($_.Exception)}}}
 }finally{
  # Each cleanup action is independent and uses only the unchanged native/UTC endpoints.
  $live=$true
  try{$live=-not$child.process.HasExited}catch{$errors.Add($_.Exception)}
  if($live){try{$child.process.Kill()}catch{$errors.Add($_.Exception)}}
  try{$child.terminal=$child.process.WaitForExit((Remaining $c))}catch{$errors.Add($_.Exception)}
  try{Drain $child $c $false}catch{$errors.Add($_.Exception)}
  foreach($name in @('stdout','stderr')){
   $s=$child.channels[$name]
   try{if($null-ne$s.reader){$s.reader.Dispose();$s.closed=$true}}catch{$errors.Add($_.Exception)}
   try{if($null-ne$s.pending){Need ($s.pending.Wait((Remaining $c))) 'pending stream settles before original end';[void]$s.pending.GetAwaiter().GetResult()}}catch{$errors.Add($_.Exception)}
  }
  $child.streams=$child.channels.stdout.eof-and$child.channels.stderr.eof-and$child.channels.stdout.closed-and$child.channels.stderr.closed
  try{Need ($child.terminal) 'actual child terminal';$child.exitCode=$child.process.ExitCode;if($child.exitCode-ne0){$errors.Add([Exception]::new('child exit '+$child.exitCode))}}catch{$errors.Add($_.Exception)}
  if($null-eq$child.handle){try{$child.handle=$child.process.SafeHandle}catch{$errors.Add($_.Exception)}}
  try{$child.process.Dispose();$child.processDisposed=$true}catch{$errors.Add($_.Exception)}
  try{if($null-ne$child.handle){$child.handle.Dispose();$child.handleClosed=$child.handle.IsClosed-and$child.processDisposed}}catch{$errors.Add($_.Exception)}
 }
 if(-not$child.terminal){$errors.Add([Exception]::new('child terminal unproven'))}
 if(-not$child.streams){$errors.Add([Exception]::new('both stream EOF unproven'))}
 if(-not$child.handleClosed){$errors.Add([Exception]::new('actual SafeHandle close unproven'))}
 if($errors.Count){throw [AggregateException]::new($errors)}
 Clock $c
 return @{stdout=$child.channels.stdout.data.ToString();stderr=$child.channels.stderr.data.ToString();terminal=$child.terminal;streams=$child.streams;handleClosed=$child.handleClosed;exitCode=$child.exitCode}
}
function NewRecord($path,$bytes,$fields,$schema){
 $pending=$path+'.pending';[void](NewImmutable $pending $bytes $fields $schema)
 [IO.File]::Move($pending,$path,$false)
 $back=Bytes $path;Need ((HashBytes $back)-ceq(HashBytes $bytes)) 'atomic no-overwrite record readback';return HashBytes $back
}
function CheckAncestry($slot){
 $self=Observe $PID
 $dispatcher=Observe $(if($null-eq$slot){Dec $self.pid}else{Dec $self.parentPid})
 if($null-ne$slot){Match @{pid=$slot.dispatcherPid;creation=$slot.dispatcherCreation;image=$slot.dispatcherImage;parentPid=$slot.dispatcherParentPid} $dispatcher;Need ($self.parentPid-ceq$dispatcher.pid) 'Runner direct dispatcher parent'}
 Need ($dispatcher.image-ceq$PowerShell) 'fixed dispatcher image'
 $managed=Observe (Dec $dispatcher.parentPid)
 $backend=Observe (Dec $managed.parentPid)
 Need ($dispatcher.parentPid-ceq$managed.pid-and$managed.parentPid-ceq$backend.pid) 'Runner Dispatcher managedPS shared backend chain'
 Match $self (Observe (Dec $self.pid))
 Match $dispatcher (Observe (Dec $dispatcher.pid))
 Match $managed (Observe (Dec $managed.pid))
 Match $backend (Observe (Dec $backend.pid))
 # Observed backend association is shared, never exclusive logical A0 authority.
 return @{self=$self;dispatcher=$dispatcher;managed=$managed;backend=$backend}
}
function ValidateSlot($a,$c){
 $fields='schema version authorityRecordSha256 outerClockSha256 humanMessageRef humanMessageSha256 candidateManifestSha256 packagePinsSha256 dispatcherSourceSha256 runnerSourceSha256 actualAppThread actualAppTurn paseoAgent workspace dispatchId dispatcherPid dispatcherCreation dispatcherImage dispatcherParentPid issued workEnd overallEnd utcIssued utcEnd'
 $s=ReadClosed (Join-Path (Join-Path $Base 'M5_HARMLESS_DISPATCHED') ($a.humanMessageSha256+'.json')) $fields 'hestia.m5.dispatch.v1'
 Need ($s.authorityRecordSha256-ceq(HashBytes (Compact $a))-and$s.outerClockSha256-ceq(HashBytes (Compact $c))) 'authority and external clock slot hashes'
 foreach($k in @('humanMessageRef','humanMessageSha256','candidateManifestSha256','packagePinsSha256','dispatcherSourceSha256','runnerSourceSha256','actualAppThread','actualAppTurn','paseoAgent','workspace')){Need ($s[$k]-ceq$a[$k]) ('slot '+$k)}
 foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){Need ($s[$k]-ceq$c[$k]) ('no reset '+$k)}
 foreach($k in @('dispatcherPid','dispatcherCreation','dispatcherParentPid')){[void](Dec $s[$k])}
 Need ($s.dispatcherImage-ceq$PowerShell) 'slot fixed dispatcher image';GuidD $s.dispatchId;return $s
}
function RecheckChain($chain){
 foreach($role in @('self','dispatcher','managed','backend')){Match $chain[$role] (Observe (Dec $chain[$role].pid))}
}
function ReservationPaths($ctx){
 GuidD $ctx.leaseId;GuidD $ctx.outputCustodyId
 return @((Join-Path $Base 'M5_HARMLESS_CAPACITY.lock'),(Join-Path $Base ('M5_HARMLESS_LEASE_'+$ctx.leaseId+'.lock')),(Join-Path $Base ('M5_HARMLESS_CUSTODY_'+$ctx.outputCustodyId+'.lock')))
}
function ReservationBytes($slotHash){Need ($slotHash-cmatch'^[0-9a-f]{64}$') 'slot hash bytes';return [Text.Encoding]::ASCII.GetBytes($slotHash)}
function AssertHeld($held,$ctx,$slotHash,$c){
 Clock $c;$paths=ReservationPaths $ctx;$expected=ReservationBytes $slotHash
 Need ($held.Count-eq3) 'exactly three retained reservations'
 for($i=0;$i-lt3;$i++){
  $h=$held[$i];ExactPath $paths[$i]
  Need ($h.Name-ceq$paths[$i]-and-not$h.SafeFileHandle.IsClosed-and-not$h.SafeFileHandle.IsInvalid-and$h.Length-eq$expected.Length) 'held exact path open bytes length'
  $h.Position=0;$actual=[byte[]]::new($expected.Length);Need ($h.Read($actual,0,$actual.Length)-eq$actual.Length) 'held complete byte read'
  Need ([Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($expected)) 'held exact slot hash bytes';Clock $c
 }
}
function CheckReservations($ctx,$slotHash,$parent,$c){
 $paths=ReservationPaths $ctx;$expected=ReservationBytes $slotHash;$errors=[Collections.Generic.List[Exception]]::new()
 foreach($path in $paths){
  $h=$null;$probe=$null
  try{
   Clock $c;ExactPath $path
   $h=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
   Need ($h.Name-ceq$path-and$h.Length-eq$expected.Length) 'Runner fixed reservation path/length'
   $actual=[byte[]]::new($expected.Length);Need ($h.Read($actual,0,$actual.Length)-eq$actual.Length-and[Convert]::ToBase64String($actual)-ceq[Convert]::ToBase64String($expected)) 'Runner reservation slotHash bytes'
   $exclusive=$false
   try{$probe=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::ReadWrite)}catch [IO.IOException]{$native=[ComponentModel.Win32Exception]::new($_.Exception.HResult-band65535);Need ($native.NativeErrorCode-eq32) 'actual sharing violation only';$exclusive=$true}
   Need ($exclusive) 'live reservation excludes another writer'
  }catch{$errors.Add($_.Exception)}finally{
   if($null-ne$probe){try{$probe.Dispose()}catch{$errors.Add($_.Exception)}}
   if($null-ne$h){try{$safe=$h.SafeFileHandle;$h.Dispose();Need ($safe.IsClosed) 'Runner reservation read handle closed'}catch{$errors.Add($_.Exception)}}
  }
 }
 Match $parent (Observe (Dec $parent.pid));Clock $c
 if($errors.Count){throw [AggregateException]::new($errors)}
}
function TrustedHandoffProof($text,$a,$c,$expectedHost,$records){
 $line=@($text-split'\r?\n'|Where-Object{$_-like'{"rootHost":true,*'})
 Need ($line.Count-eq1-and$line[0].Length-le65536) 'one bounded fixed Root proof'
 $doc=[Text.Json.JsonDocument]::Parse($line[0]);$seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 try{
  foreach($p in $doc.RootElement.EnumerateObject()){Need ($seen.Add($p.Name)) 'duplicate Root proof'}
  Need ($seen.Count-eq8-and$seen.Contains('failure')) 'exact Root proof fields'
  foreach($k in @('rootHost','pass','controllerTerminal','jobZero','registryZero','streamsComplete','handlesClosed')){Need ($doc.RootElement.GetProperty($k).ValueKind-eq[Text.Json.JsonValueKind]::True) ('pinned Root proof '+$k)}
  Need ($doc.RootElement.GetProperty('failure').ValueKind-eq[Text.Json.JsonValueKind]::Null) 'Root proof no hidden error'
 }finally{$doc.Dispose()}
 $spent=ReadClosed (Join-Path (Join-Path $Base 'M5_HARMLESS_CONSUMED') ($records.Grant.grantId+'.json')) 'schema version grantId contextRecordSha256 packageRecordSha256 grantRecordSha256 hostPid hostCreation hostImage hostParentPid issued workEnd overallEnd utcIssued utcEnd' 'hestia.m5.consumed.v1'
 Need ($spent.hostPid-ceq$expectedHost.pid.ToString()-and$spent.hostCreation-ceq$expectedHost.creation-and$spent.hostImage-ceq$expectedHost.image-and$spent.hostParentPid-ceq$expectedHost.parentPid) 'same actually retained handoff tuple'
 Need ($spent.grantId-ceq$records.Grant.grantId-and$spent.packageRecordSha256-ceq$records.PackageHash-and$spent.contextRecordSha256-ceq$records.ContextHash-and$spent.grantRecordSha256-ceq$records.GrantHash) 'actual fixed record chain'
 foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){Need ($spent[$k]-ceq$c[$k]) 'unchanged proof endpoints'}
 $dir=Join-Path (Join-Path $Base 'M5_HARMLESS_CONSUMED') ($records.Grant.grantId+'.subjects');ExactPath $dir
 $allFiles=@(Get-ChildItem -LiteralPath $dir -File -Force)
 Need (@(Get-ChildItem -LiteralPath $dir -Force).Count-eq$allFiles.Count) 'no subject subdirectories'
 foreach($f in $allFiles){ExactPath $f.FullName;Need ($f.Name-cmatch'\.json$') 'only exact registry JSON entries'}
 $initial=@($allFiles|Where-Object{$_.Name-cnotmatch'\.closed\.json$'})
 Need ($initial.Count-gt0-and$allFiles.Count-eq($initial.Count*2)) 'exact initial/closed population'
 $initialIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 $closedIds=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
 foreach($f in $initial){
  Clock $c
  $record=Assert-ClosedPacket ('M5_SUBJECT_REGISTER_V1'+[char]9+[Text.UTF8Encoding]::new($false,$true).GetString((Bytes $f.FullName)))
  $v=$record.Data;$id=$v.pid+'-'+$v.creation+'-'+$v.registrationNonce
  Need ($v.packageHash-ceq$records.PackageHash-and$v.contextHash-ceq$records.ContextHash-and$v.consumedHash-ceq(HashBytes (Compact $spent))-and$v.suiteToken-ceq$records.Context.suiteToken-and$v.nativeOrigin-ceq$records.Context.nativeOrigin-and$v.hostPid-ceq$expectedHost.pid.ToString()-and$v.hostCreation-ceq$expectedHost.creation) 'registry belongs to exact consumed Root chain'
  Need ($f.Name-ceq($id+'.json')-and$initialIds.Add($id)) 'one derived initial identity'
  $closedPath=Join-Path $dir ($id+'.closed.json')
  $closed=Assert-ClosedPacket ('M5_SUBJECT_CLOSED_V1'+[char]9+[Text.UTF8Encoding]::new($false,$true).GetString((Bytes $closedPath)))
  $z=$closed.Data
  Need ($z.recordId-ceq$id-and$z.recordSha256-ceq(HashBytes (Bytes $f.FullName))-and$z.grantId-ceq$records.Grant.grantId-and$closedIds.Add($id)) 'closed packet identity/hash pairing'
  foreach($k in $v.Keys){if($k-cnotin@('schema','mode','probeNonce')){Need ($z[$k]-ceq$v[$k]) ('closed stable echo '+$k)}}
  foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){Need ($z[$k]-ceq$c[$k]) 'registry original clock'}
 }
 Need ($closedIds.SetEquals($initialIds)) 'exact one-to-one registry sets'
 CheckSources $a $c;Clock $c
}
# ENTRY: read-only admission until actual dispatcher records and custody checks succeed.
$a=Authority
$c=OuterClock $a
$slot=ValidateSlot $a $c
$parent=CheckAncestry $slot
Need ($parent.dispatcher.pid-ceq$slot.dispatcherPid) 'wrong-parent direct runner denied'
$self=$parent.self
while(-not[IO.File]::Exists((Join-Path $Base 'M5_HARMLESS_RUNTIME_GRANT.json'))){Clock $c;Need ((Remaining $c $true)-gt0) 'preflight bounded wait';RecheckChain $parent;Start-Sleep -Milliseconds 1}
CheckSources $a $c
. 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05\root-contract.ps1'
$records=Read-RootRecords
$chain=CheckAncestry $slot
Match @{pid=$records.Context.runnerProcessId;creation=$records.Context.runnerCreation;image=$records.Context.runnerImage;parentPid=$records.Context.runnerParentPid} $chain.self
$owner=@{pid=$records.Context.ownerProcessId;creation=$records.Context.ownerCreation;image=$records.Context.ownerImage;parentPid=$records.Context.ownerParentPid}
Match $owner $chain.backend
Need ($records.Context.ownerNative-ceq$a.actualAppThread-and$records.Context.paseoAgent-ceq$a.paseoAgent-and$records.Context.workspace-ceq$a.workspace) 'external logical Authority separate from shared backend association'
Need ($records.Context.hostParentPid-ceq$self.pid-and$records.Context.hostParentCreation-ceq$self.creation-and$records.Context.hostParentImage-ceq$self.image-and$records.Context.hostParentParentPid-ceq$self.parentPid) 'Runner equals Context hostParent'
foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){Need ($records.Context[$k]-ceq$c[$k]) 'same original clock'}
Need ($records.Context.clockMode-ceq'PREISSUED') 'never HOST_ENTRY'
Check-RootPhase $records $c 'host-preflight'
Check-PackageBytes $records $c
$slotHash=HashBytes (Compact $slot)
CheckReservations $records.Context $slotHash $chain.dispatcher $c
$child=$null;$custody=@{started=$false;child=$null};$failure=$null
try{
 $chain=CheckAncestry $slot
 RecheckChain $parent
 CheckReservations $records.Context $slotHash $chain.dispatcher $c
 $child=BeginChild 'Handoff' $c $custody
 $expectedHost=@{pid=$child.pid;creation=$child.creation;image=$PowerShell;parentPid=$PID.ToString()}
 $owned=$child;$child=$null;
 $done=FinishChild $owned $c
 TrustedHandoffProof $done.stdout $a $c $expectedHost $records
 Clock $c
}catch{$failure=$_.Exception}
finally{
 if($null-ne$child){$owned=$child;$child=$null;$owned.abort=$true;try{[void](FinishChild $owned $c)}catch{if($null-ne$failure){$failure=[AggregateException]::new($failure,$_.Exception)}else{$failure=$_.Exception}}}
}
if($null-ne$failure){Write-Output ('SPENT_HOLD:'+ $failure.ToString());exit 1}
Write-Output $done.stdout;exit 0
