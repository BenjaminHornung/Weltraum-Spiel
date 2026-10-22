[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
# This outer point precedes all record reads, hashing, loading and controller creation.
$entryTick=[Environment]::TickCount64
$entryUtc=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$packagePath='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_REVIEWED_PACKAGE.json'
$fixedRoot='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05'
if(-not[IO.File]::Exists($packagePath)){throw 'DATA_HOLD:Root package unissued'}
$package=[IO.File]::ReadAllText($packagePath)|ConvertFrom-Json -AsHashtable
if($package.schema-cne'hestia.m5.package.v1'-or$package.version-cne'1'-or$package.sourceRoot-cne$fixedRoot){throw 'DATA_HOLD:fixed Root package'}
$pins=Join-Path $fixedRoot 'QUAL_SOURCE_PINS.tsv'
if((Get-FileHash -LiteralPath $pins).Hash.ToLowerInvariant()-cne$package.packagePinsSha256){throw 'DATA_HOLD:independent expected source pins'}
$helper=Join-Path $fixedRoot 'root-contract.ps1'
$pin=@([IO.File]::ReadAllLines($pins)|Where-Object{$_ -like ('ACTIVATION_SOURCE:root-contract.ps1'+[char]9+'*')})
if($pin.Count-ne1){throw 'DATA_HOLD:one fixed contract pin'}
$v=$pin[0].Split([char]9)
if($v.Count-ne4-or$v[1]-cne$helper-or([IO.FileInfo]$helper).Length-ne[long]$v[2]-or(Get-FileHash -LiteralPath $helper).Hash.ToLowerInvariant()-cne$v[3]){throw 'DATA_HOLD:fixed contract bytes'}
. 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05\root-contract.ps1'

$r=Read-RootRecords
Check-HostProfile
$c=$r.Context
$clock=[ordered]@{issued=$entryTick;workEnd=$entryTick+48000;overallEnd=$entryTick+60000;utcIssued=$entryUtc;utcEnd=$entryUtc+60000}
if($c.clockMode-ceq'PREISSUED'){foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){$clock[$k]=Num $c[$k]};Need ($clock.issued-le$entryTick-and$clock.utcIssued-le$entryUtc) 'earlier actual Root endpoints'}
else{Need ($c.clockMode-ceq'HOST_ENTRY') 'explicit clock issuer';foreach($k in @('issued','workEnd','overallEnd','utcIssued','utcEnd')){Need ($c[$k]-ceq'HOST_CAPTURE') 'no caller endpoints'}}
$self=Read-ActualProcess $PID
Match-ActualProcess @{pid=$c.hostParentPid;creation=$c.hostParentCreation;image=$c.hostParentImage;parentPid=$c.hostParentParentPid} (Read-ActualProcess (Num $self.parentPid))
Check-RootPhase $r $clock 'host-preflight'
Check-PackageBytes $r $clock
Need ([IO.Directory]::Exists($script:ConsumedRoot)) 'Root consumed store unissued'
Need (-not(([IO.DirectoryInfo]$script:ConsumedRoot).Attributes-band[IO.FileAttributes]::ReparsePoint)) 'Root consumed store reparse'
$consumePath=Join-Path $script:ConsumedRoot ($r.Grant.grantId+'.json')
$spent=[ordered]@{schema='hestia.m5.consumed.v1';version='1';grantId=$r.Grant.grantId;contextRecordSha256=$r.ContextHash;packageRecordSha256=$r.PackageHash;grantRecordSha256=$r.GrantHash;hostPid=$self.pid;hostCreation=$self.creation;hostImage=$self.image;hostParentPid=$self.parentPid}
foreach($k in $clock.Keys){$spent[$k]=$clock[$k].ToString([Globalization.CultureInfo]::InvariantCulture)}
Check-RootPhase $r $clock 'host-before-consume'
Need (-not[IO.Directory]::Exists($c.suiteOutputRoot)-and-not[IO.File]::Exists($c.suiteOutputRoot)) 'fresh exclusive suite output'
# CreateNew is the sole consumption. Any later failure leaves this immutable record spent.
Check-OriginalClock $clock 'host-immediately-before-consumption-write'
$consume=[IO.File]::Open($consumePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$b=[Text.UTF8Encoding]::new($false).GetBytes(($spent|ConvertTo-Json -Compress));$consume.Write($b,0,$b.Length);$consume.Flush($true)}finally{$consume.Dispose()}
Check-RootPhase $r $clock 'host-after-consume'
$consumedHash=Sha $consumePath

# Only this fixed emitted host entry owns outer containment and the subject registry. No controller exists before it.
$state=[ordered]@{schema='hestia.m5.handoff.v3';version='3';grantId=$r.Grant.grantId;packageRecordSha256=$r.PackageHash;contextRecordSha256=$r.ContextHash;grantRecordSha256=$r.GrantHash;consumedSha256=$consumedHash;hostPid=$self.pid;hostCreation=$self.creation;hostImage=$self.image;hostParentPid=$self.parentPid;controllerPid='0';controllerCreation='0';subjectPid=$self.pid;subjectCreation=$self.creation;subjectParentPid=$self.parentPid;subjectImage=$self.image;role='RootHost';requestPath='NONE';requestSha256='NONE';scenario='NONE';nodeOrigin='NONE';suiteToken=$c.suiteToken;nativeOrigin=$c.nativeOrigin;registrationNonce='NONE';recordId='NONE';recordSha256='NONE'}
foreach($k in $clock.Keys){$state[$k]=$clock[$k].ToString([Globalization.CultureInfo]::InvariantCulture)}
Check-PackageBytes $r $clock
$dll=Join-Path $script:FixedSourceRoot 'HarmlessActivation.dll'
Need ((Sha $dll)-ceq$r.Package.dllSha256) 'Root expected host assembly'
Match-ActualProcess $self (Read-ActualProcess $PID)
Match-ActualProcess @{pid=$c.hostParentPid;creation=$c.hostParentCreation;image=$c.hostParentImage;parentPid=$c.hostParentParentPid} (Read-ActualProcess (Num $self.parentPid))
Check-OriginalClock $clock 'Root immediately-before-host-loader'
[void][Reflection.Assembly]::LoadFrom($dll)
Check-OriginalClock $clock 'Root after-host-loader'
$result=[Hestia.M5.Native24Source.Native24Family]::RunRootHandoffHost(($state|ConvertTo-Json -Compress))
Check-OriginalClock $clock 'Root after-owned-host'
exit $result
