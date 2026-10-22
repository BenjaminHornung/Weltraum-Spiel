$script:FixedSourceRoot='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05'
$script:RootPackagePath='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_REVIEWED_PACKAGE.json'
$script:RootContextPath='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_RUNTIME_CONTEXT.json'
$script:RootGrantPath='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_RUNTIME_GRANT.json'
$script:ConsumedRoot='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_CONSUMED'
$script:PSPath='C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'
$script:CoreHash='76a49f17e83f613bc8a5b55fc98830b764e7838265aacbdbcc8f46707f80a3c9'
function Need($ok,$reason){if(-not$ok){throw ('DATA_HOLD:'+ $reason)}}
function Sha([string]$path){Need ([IO.File]::Exists($path)) ('missing '+$path);Need (-not(([IO.FileInfo]$path).Attributes-band[IO.FileAttributes]::ReparsePoint)) 'reparse input';return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Num($s){Need ($s-is[string]-and$s-cmatch'^(0|[1-9][0-9]*)$') 'integer';return [long]::Parse($s,[Globalization.CultureInfo]::InvariantCulture)}
function Flat($path,$schema,$fields){
 Need ([IO.File]::Exists($path)) ('unissued '+$path)
 $text=[IO.File]::ReadAllText($path);Need ($text.Length-le65536) 'record bound'
 $doc=[Text.Json.JsonDocument]::Parse($text);$m=[ordered]@{}
 try{foreach($p in $doc.RootElement.EnumerateObject()){Need (-not$m.Contains($p.Name)-and$p.Value.ValueKind-eq[Text.Json.JsonValueKind]::String) 'duplicate/nonstring';$m[$p.Name]=$p.Value.GetString()}}finally{$doc.Dispose()}
 Need ($m.schema-ceq$schema-and$m.version-ceq'1') 'schema/version'
 $allowed=$fields.Split(' ');Need ($m.Count-eq$allowed.Count) 'unknown/missing fields'
 foreach($k in $allowed){Need ($m.Contains($k)-and-not[string]::IsNullOrWhiteSpace($m[$k])) ('missing '+$k)}
 return $m
}
function Read-RootRecords {
 $p=Flat $script:RootPackagePath 'hestia.m5.package.v1' 'schema version packageId ownerNative sourceRoot packagePinsSha256 nodeSha256 powerShellSha256 dllSha256 fixtureSha256 coreLibrarySha256 profile scenarios roles'
 $c=Flat $script:RootContextPath 'hestia.m5.context.v1' 'schema version contextId packageId packageRecordSha256 ownerNative ownerProcessId ownerCreation ownerImage ownerParentPid runnerId runnerProcessId runnerCreation runnerImage runnerParentPid paseoAgent workspace leaseId leaseExpiresUtc capacity outputExclusive outputCustodyId suiteToken nativeOrigin nativeClockDomain nativeClockApi utcClockApi clockMode issued workEnd overallEnd utcIssued utcEnd sourceRoot suiteOutputRoot hostParentPid hostParentCreation hostParentImage hostParentParentPid nodeOrigins bootStamp'
 $g=Flat $script:RootGrantPath 'hestia.m5.grant.v1' 'schema version grantId contextId contextRecordSha256 packageId scope authorizationClass humanMessageRef humanMessageSha256 retry suiteToken outputCustodyId notBeforeUtc expiresUtc'
 Need ($p.sourceRoot-ceq$script:FixedSourceRoot-and$c.sourceRoot-ceq$script:FixedSourceRoot) 'fixed source root'
 Need ($p.ownerNative-ceq'01a13648-c55b-7250-bf07-34921d70b43b'-and$c.ownerNative-ceq$p.ownerNative) 'owner'
 Need ($p.scenarios-ceq'nominal,unexpected-member,ipc-cancel,watchdog,premature-root-exit,supervisor-crash'-and$p.roles-ceq'Controller,Observer,Supervisor,root,child,grandchild,sibling,canary') 'population'
 Need ($p.profile-ceq'WINDOWS_PWSH7.6.4_NET10.0.10_GETTICKCOUNT64') 'profile'
 Need ($c.packageId-ceq$p.packageId-and$g.packageId-ceq$p.packageId-and$g.contextId-ceq$c.contextId) 'record IDs'
 Need ($c.packageRecordSha256-ceq(Sha $script:RootPackagePath)-and$g.contextRecordSha256-ceq(Sha $script:RootContextPath)) 'independent record hashes'
 Need ($g.scope-ceq'HARMLESS_SIX_ONCE'-and$g.authorizationClass-ceq'DIRECT_HUMAN_RUNTIME_ONCE'-and$g.retry-ceq'0') 'runtime grant scope'
 Need ($g.humanMessageRef-cne'call_f75fff55e3a34653b255fd83365457ca'-and$g.humanMessageRef-cnotmatch'(?i)r05|source'-and$g.humanMessageSha256-cmatch'^[0-9a-f]{64}$') 'source/r05 is not runtime authority'
 foreach($k in @('grantId')){[void][guid]::ParseExact($g[$k],'D')}
 foreach($k in @('contextId','packageId','leaseId','outputCustodyId','suiteToken','nativeOrigin','nativeClockDomain','runnerId','paseoAgent')){[void][guid]::ParseExact($c[$k],'D')}
 Need ($c.capacity-ceq'ONE_CONTROLLER_SIX_SERIAL_LANES_ACTIVE3'-and$c.outputExclusive-ceq'true'-and$c.workspace.StartsWith('wks_')) 'lease/capacity/custody'
 Need ($g.suiteToken-ceq$c.suiteToken-and$g.outputCustodyId-ceq$c.outputCustodyId) 'grant custody'
 Need ($c.suiteOutputRoot-ceq(Join-Path (Join-Path $script:FixedSourceRoot 'qualification-runs') $c.suiteToken)) 'fixed suite output'
 Need ($c.nativeClockApi-ceq'GetTickCount64'-and$c.utcClockApi-ceq'DateTimeOffset.UtcNow') 'clock APIs'
 Need ($c.nodeOrigins.Split(',').Count-eq6) 'six node origins';foreach($v in $c.nodeOrigins.Split(',')){[void][guid]::ParseExact($v,'D')}
 return [pscustomobject]@{Package=$p;Context=$c;Grant=$g;PackageHash=(Sha $script:RootPackagePath);ContextHash=(Sha $script:RootContextPath);GrantHash=(Sha $script:RootGrantPath)}
}
function Read-ActualProcess([long]$id){
 Need ($id-gt0-and$id-le[uint32]::MaxValue) 'selected process ID'
 $p=Get-Process -Id $id -ErrorAction Stop
 try{$w=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$id) -ErrorAction Stop;Need ($null-ne$w-and$w.ProcessId-eq$id) 'selected actual process'
 return [ordered]@{pid=$id.ToString();creation=$p.StartTime.ToFileTimeUtc().ToString();image=$p.MainModule.FileName;parentPid=$w.ParentProcessId.ToString()}}finally{$p.Dispose()}
}
function Match-ActualProcess($expected,$actual){
 foreach($k in @('pid','creation','image','parentPid')){Need ($null-ne$expected[$k]-and$expected[$k]-ceq$actual[$k]) ('actual process '+$k)}
}
function Check-HostProfile {
 Need ([Environment]::OSVersion.Platform-eq[PlatformID]::Win32NT-and$PSVersionTable.PSVersion.ToString()-ceq'7.6.4'-and[Runtime.InteropServices.RuntimeInformation]::FrameworkDescription-ceq'.NET 10.0.10') 'qualified Windows NET10 profile'
 Need ([Environment]::ProcessPath-ceq$script:PSPath-and(Sha ([object].Assembly.Location))-ceq$script:CoreHash) 'actual host/module bytes'
}
function Check-OriginalClock($clock,$phase){
 $n=[Environment]::TickCount64;$u=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
 Need ($clock.workEnd-$clock.issued-eq48000-and$clock.overallEnd-$clock.issued-eq60000-and$clock.overallEnd-$clock.workEnd-eq12000-and$clock.utcEnd-$clock.utcIssued-eq60000) 'original60/48/12'
 Need ($n-ge$clock.issued-and$n-le$clock.overallEnd-and$u-ge$clock.utcIssued-and$u-le$clock.utcEnd) ('original deadline '+$phase)
}
function Check-RootPhase($records,$clock,$phase){
 Need ($phase -cin @('host-preflight','after-package','host-before-consume','host-after-consume','host-before-controller','host-before-handoff','host-before-native-ack','host-after-cleanup','private-admission','powershell-before-loader','powershell-immediately-before-loader','powershell-after-loader')) 'unknown Root phase'
 Check-OriginalClock $clock ($phase+'-before-reads')
 $fresh=Read-RootRecords
 Need ($fresh.PackageHash-ceq$records.PackageHash-and$fresh.ContextHash-ceq$records.ContextHash-and$fresh.GrantHash-ceq$records.GrantHash) 'Root records changed'
 Check-HostProfile
 $c=$fresh.Context
 Match-ActualProcess @{pid=$c.ownerProcessId;creation=$c.ownerCreation;image=$c.ownerImage;parentPid=$c.ownerParentPid} (Read-ActualProcess (Num $c.ownerProcessId))
 Match-ActualProcess @{pid=$c.runnerProcessId;creation=$c.runnerCreation;image=$c.runnerImage;parentPid=$c.runnerParentPid} (Read-ActualProcess (Num $c.runnerProcessId))
 Need ((Num $c.leaseExpiresUtc)-ge$clock.utcEnd-and(Num $fresh.Grant.notBeforeUtc)-le$clock.utcIssued-and(Num $fresh.Grant.expiresUtc)-ge$clock.utcEnd) 'lease/grant original window'
 Need ($c.bootStamp-ceq((Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime.ToUniversalTime().ToFileTimeUtc().ToString())) 'actual boot clock origin'
 Check-OriginalClock $clock ($phase+'-after-reads')
}
function Check-PackageBytes($r,$clock){
 Check-OriginalClock $clock 'before-package'
 $p=$r.Package
 foreach($pair in @(@('packagePinsSha256',(Join-Path $script:FixedSourceRoot 'QUAL_SOURCE_PINS.tsv')),@('dllSha256',(Join-Path $script:FixedSourceRoot 'HarmlessActivation.dll')),@('fixtureSha256',(Join-Path $script:FixedSourceRoot 'harmless-fixture.mjs')),@('powerShellSha256',$script:PSPath),@('nodeSha256','C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'))){Need ($p[$pair[0]]-cmatch'^[0-9a-f]{64}$'-and(Sha $pair[1])-ceq$p[$pair[0]]) ('Root expected bytes '+$pair[0])}
 $rows=[IO.File]::ReadAllLines((Join-Path $script:FixedSourceRoot 'QUAL_SOURCE_PINS.tsv'));$originals=0
 foreach($row in $rows){$v=$row.Split([char]9);Need ($v.Count-eq4-and$v[1].StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase)) 'pin shape/root';Need (([IO.FileInfo]$v[1]).Length-eq(Num $v[2])-and(Sha $v[1])-ceq$v[3]) 'Root source pin';if($v[0].StartsWith('ORIGINAL:')){$originals++}}
 Need ($originals-eq1250-and$p.coreLibrarySha256-ceq$script:CoreHash) 'original roles/runtime profile'
 Check-RootPhase $r $clock 'after-package'
}
function Read-PrivateHandoff {
 $task=[Console]::In.ReadLineAsync();Need ($task.Wait(1000)) 'private stdin unavailable'
 $line=$task.Result;Need ($null-ne$line-and$line.Length-le32768) 'private frame bound'
 $frame=$line|ConvertFrom-Json -AsHashtable
 $doc=[Text.Json.JsonDocument]::Parse($line);$seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);try{foreach($p in $doc.RootElement.EnumerateObject()){Need ($seen.Add($p.Name)-and$p.Value.ValueKind-eq[Text.Json.JsonValueKind]::String) 'closed handoff duplicate/string'}}finally{$doc.Dispose()}
 $fields='schema version grantId packageRecordSha256 contextRecordSha256 grantRecordSha256 consumedSha256 hostPid hostCreation hostImage hostParentPid controllerPid controllerCreation subjectPid subjectCreation subjectParentPid subjectImage role requestPath requestSha256 scenario nodeOrigin issued workEnd overallEnd utcIssued utcEnd suiteToken nativeOrigin registrationNonce recordId recordSha256'.Split(' ');Need ($frame.Count-eq$fields.Count) 'closed handoff unknown fields';foreach($k in $fields){Need ($frame.ContainsKey($k)-and$frame[$k]-is[string]-and$frame[$k].Length-gt0) 'closed handoff missing field'}
 Need ($frame.schema-ceq'hestia.m5.handoff.v3'-and$frame.version-ceq'3') 'private handoff schema'
 return [pscustomobject]@{Line=$line;Frame=$frame}
}
function Verify-PrivateProof($raw,$role,$requestPath){
 $r=Read-RootRecords;$f=$raw.Frame
 $clock=[ordered]@{};foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){$clock[$k]=Num $f[$k]}
 Check-RootPhase $r $clock 'private-admission'
 Need ($f.role-ceq$role-and$f.requestPath-ceq$(if($role-ceq'Controller'){'NONE'}else{$requestPath})) 'fixed role/request'
 Need ($f.packageRecordSha256-ceq$r.PackageHash-and$f.contextRecordSha256-ceq$r.ContextHash-and$f.grantRecordSha256-ceq$r.GrantHash-and$f.grantId-ceq$r.Grant.grantId) 'independent Root correspondence'
 $consumed=Join-Path $script:ConsumedRoot ($r.Grant.grantId+'.json')
 Need ((Sha $consumed)-ceq$f.consumedSha256) 'actual Root host consumption'
 $spent=[IO.File]::ReadAllText($consumed)|ConvertFrom-Json -AsHashtable
 Need ($spent.schema-ceq'hestia.m5.consumed.v1'-and$spent.grantId-ceq$f.grantId-and$spent.contextRecordSha256-ceq$r.ContextHash) 'consumed scope/context'
 foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd','hostPid','hostCreation','hostImage','hostParentPid')){Need ($spent[$k]-ceq$f[$k]) ('same original host '+$k)}
 $self=Read-ActualProcess $PID
 Match-ActualProcess @{pid=$f.subjectPid;creation=$f.subjectCreation;image=$f.subjectImage;parentPid=$f.subjectParentPid} $self
 $host=Read-ActualProcess (Num $f.hostPid)
 Match-ActualProcess @{pid=$f.hostPid;creation=$f.hostCreation;image=$f.hostImage;parentPid=$f.hostParentPid} $host
 if($role-ceq'Controller'){Need ($self.parentPid-ceq$f.hostPid-and$self.pid-ceq$f.controllerPid-and$self.creation-ceq$f.controllerCreation) 'same owned controller'}
 else{$parent=Read-ActualProcess (Num $self.parentPid);Need ($parent.pid-ceq$f.controllerPid-and$parent.creation-ceq$f.controllerCreation-and$parent.parentPid-ceq$f.hostPid) 'own controller child';Need ((Sha $requestPath)-ceq$f.requestSha256) 'fixed request bytes'}
 Check-PackageBytes $r $clock
 return [pscustomobject]@{Expected=$r.Context;Root=$r;Clock=$clock;Raw=$raw;Role=$role;RequestPath=$requestPath;Verified=$true}
}
function Get-ExternalRootRuntimeVerifier {
 $v=[pscustomobject]@{}
 $v|Add-Member ScriptMethod VerifyPowerShellEntry {param($role,$request);if($null-eq$script:privateProof){$script:privateProof=Verify-PrivateProof (Read-PrivateHandoff) $role $request};Need ($script:privateProof.Role-ceq$role-and$script:privateProof.RequestPath-ceq$request) 'same fixed PS role';return $script:privateProof}
 $v|Add-Member ScriptMethod VerifyIndependentRootProof {param($p);$fresh=Verify-PrivateProof $p.Raw $p.Role $p.RequestPath;return $fresh.Verified}
 $v|Add-Member ScriptMethod VerifyCurrentPhase {param($p,$phase);Check-RootPhase $p.Root $p.Clock $phase;Need ((Sha (Join-Path $script:ConsumedRoot ($p.Root.Grant.grantId+'.json')))-ceq$p.Raw.Frame.consumedSha256) 'held same host consumption';Invoke-RootFreshProbe $p;Check-OriginalClock $p.Clock ($phase+'-terminal')}
 $v|Add-Member ScriptMethod VerifyLateLoaderProof {param($p);Verify-LateLoaderProof $p}
 $v|Add-Member ScriptMethod SameOriginalAuthority {param($a,$b);return $a.Raw.Line-ceq$b.Raw.Line}
 return $v
}

function Assert-ClosedPacket($line){
 Need ($line.Length-le65536-and$line.Contains([char]9)) 'closed subject line'
 $i=$line.IndexOf([char]9);$header=$line.Substring(0,$i);$text=$line.Substring($i+1)
 $schemas=@{M5_SUBJECT_REGISTER_V1='hestia.m5.subject.register.v1';M5_SUBJECT_ACK_V1='hestia.m5.subject.ack.v1';M5_SUBJECT_RETIRE_V1='hestia.m5.subject.retire.v1';M5_SUBJECT_CLOSED_V1='hestia.m5.subject.closed.v1'}
 Need ($schemas.ContainsKey($header)) 'closed subject header'
 $d=$text|ConvertFrom-Json -AsHashtable;$keys=$(if($header-in@('M5_SUBJECT_ACK_V1','M5_SUBJECT_CLOSED_V1')){'schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd recordId recordSha256 observedNative observedUtc registryCount response'}else{'schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd'}).Split(' ')
 $doc=[Text.Json.JsonDocument]::Parse($text);$seen=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal);try{foreach($p in $doc.RootElement.EnumerateObject()){Need ($seen.Add($p.Name)-and$p.Value.ValueKind-eq[Text.Json.JsonValueKind]::String) 'duplicate/type subject'}}finally{$doc.Dispose()}
 Need ($d.Count-eq$keys.Count-and$d.schema-ceq$schemas[$header]-and$d.version-ceq'1') 'subject closed schema';foreach($k in $keys){Need ($d.ContainsKey($k)-and$d[$k]-is[string]-and$d[$k].Length-gt0) 'subject closed field'}
 Need ($(if($header-in@('M5_SUBJECT_RETIRE_V1','M5_SUBJECT_CLOSED_V1')){$d.mode-ceq'RETIRE'}else{$d.mode-cin@('REGISTER','PRECHECK','PROBE')})) 'subject closed mode'

 foreach($k in @('registrationNonce','probeNonce','grantId')){Need ($d[$k]-cmatch'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') ('subject nonce '+$k)}
 foreach($k in 'pid creation parentPid creatorPid creatorCreation handleOwnerPid handleOwnerCreation sourceHandle controllerPid controllerCreation hostPid hostCreation issued workEnd overallEnd utcIssued utcEnd ordinal'.Split(' ')){Need ($d[$k]-cmatch'^(0|[1-9][0-9]*)$') ('subject integer '+$k)}
 if($header-ceq'M5_SUBJECT_ACK_V1'){Need ($d.response-ceq@{REGISTER='REGISTERED';PRECHECK='PRECHECKED';PROBE='PROBED'}[$d.mode]) 'subject ACK mode response'}
 if($header-ceq'M5_SUBJECT_CLOSED_V1'){Need ($d.response-ceq'RETIRED') 'subject CLOSED response'}
 return [pscustomobject]@{Header=$header;Data=$d}
}
function Invoke-RootFreshProbe($proof){
 $f=$proof.Raw.Frame;$id=$f.subjectPid+'-'+$f.subjectCreation+'-'+$f.registrationNonce;Need ($id-ceq$f.recordId) 'derived subject path'
 $path=Join-Path (Join-Path $script:ConsumedRoot ($proof.Root.Grant.grantId+'.subjects')) ($id+'.json')
 Need ((Sha $path)-ceq$f.recordSha256) 'Root immutable subject bytes'
 $record=Assert-ClosedPacket ('M5_SUBJECT_REGISTER_V1'+[char]9+[IO.File]::ReadAllText($path));$d=$record.Data
 Need ($d.pid-ceq$f.subjectPid-and$d.creation-ceq$f.subjectCreation-and$d.parentPid-ceq$f.subjectParentPid) 'actual Root subject creation/parent'
 $nonce=[guid]::NewGuid().ToString('D');$d.mode='PROBE';$d.probeNonce=$nonce;$line='M5_SUBJECT_REGISTER_V1'+[char]9+($d|ConvertTo-Json -Compress);[void](Assert-ClosedPacket $line)
 $before=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();Check-OriginalClock $proof.Clock 'PS probe-before'
 [Console]::Out.WriteLine($line);[Console]::Out.Flush();$task=[Console]::In.ReadLineAsync();$left=[Math]::Min(1000,[Math]::Max(0,$proof.Clock.overallEnd-[Environment]::TickCount64));Need ($task.Wait([int]$left)) 'PS Root probe original deadline'
 $r=Assert-ClosedPacket $task.Result;Need ($r.Header-ceq'M5_SUBJECT_ACK_V1'-and$r.Data.mode-ceq'PROBE'-and$r.Data.response-ceq'PROBED') 'actual Root PROBE ACK'
 foreach($k in 'schema version mode grantId packageHash contextHash consumedHash suiteToken registrationNonce probeNonce pid creation parentPid image creatorPid creatorCreation creatorImage handleOwnerPid handleOwnerCreation handleOwnerImage sourceHandle role scenario ordinal requestPath requestSha256 controllerPid controllerCreation hostPid hostCreation nativeOrigin issued workEnd overallEnd utcIssued utcEnd'.Split(' ')){if($k-cne'schema'){Need ($r.Data[$k]-ceq$d[$k]) ('Root exact probe echo '+$k)}}
 Need ($r.Data.recordId-ceq$id-and$r.Data.recordSha256-ceq$f.recordSha256-and(Num $r.Data.observedUtc)-ge$before-and(Num $r.Data.observedUtc)-le[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) 'actual current Root-held probe'
 Check-OriginalClock $proof.Clock 'PS probe-after'
}
function Verify-LateLoaderProof($proof){
 # All slow record/source hashes first. Then fresh held-handle probe and actual identities immediately before loader.
 [void](Verify-PrivateProof $proof.Raw $proof.Role $proof.RequestPath)
 Invoke-RootFreshProbe $proof
 $f=$proof.Raw.Frame
 Match-ActualProcess @{pid=$f.hostPid;creation=$f.hostCreation;image=$f.hostImage;parentPid=$f.hostParentPid} (Read-ActualProcess (Num $f.hostPid))
 $controller=Read-ActualProcess (Num $f.controllerPid)
 Need ($controller.creation-ceq$f.controllerCreation-and$controller.parentPid-ceq$f.hostPid-and$controller.image-ceq$script:PSPath) 'late actual controller'
 Match-ActualProcess @{pid=$f.subjectPid;creation=$f.subjectCreation;image=$f.subjectImage;parentPid=$f.subjectParentPid} (Read-ActualProcess $PID)
 Check-OriginalClock $proof.Clock 'PS immediately-before-loader'
}
