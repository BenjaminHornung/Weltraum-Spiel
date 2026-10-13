param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^(processor|candidate-build)-[0-9]{2}$')]
    [string]$RunId
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRoot=[IO.Path]::GetFullPath('C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-01-2026-10-09/spikes/phy-01-rapier-followup/revisions/positive-margin-descriptor-package-r05')
if($root -ne $expectedRoot){throw 'WRONG_WRITE_LEASE'}
$preflightPath=Join-Path $root ('preflights/'+$RunId+'.json')
$plan=[IO.File]::ReadAllText($preflightPath)|ConvertFrom-Json -Depth 40
function Sha([string]$path){
    [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($path))).ToLowerInvariant()
}
function WriteNew([string]$path,[string]$text){
    $resolved=[IO.Path]::GetFullPath($path)
    if(-not $resolved.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'WRITE_OUTSIDE_LEASE'}
    $bytes=[Text.UTF8Encoding]::new($false).GetBytes($text)
    $file=[IO.File]::Open($resolved,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$file.Write($bytes,0,$bytes.Length)}finally{$file.Dispose()}
}
if($plan.runId -ne $RunId -or $plan.cwd -ne $root -or $plan.deadlineMs -ne 60000){throw 'UNBOUND_PROGRAMME'}
if($plan.kind -notin @('EXACT_A52_DESCRIPTOR_PROCESSOR','GENUINE_SOURCE_COMPILER')){throw 'UNBOUND_EFFECT_KIND'}
foreach($row in $plan.inputs){
    $item=Get-Item -LiteralPath $row.path -ErrorAction Stop
    if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $row.bytes -or (Sha $row.path) -ne $row.sha256){throw "PRELAUNCH_INPUT_MISMATCH $($row.path)"}
}
$reviewPath=Join-Path $root ('reviews/'+$RunId+'.review.json')
$review=[IO.File]::ReadAllText($reviewPath)|ConvertFrom-Json
if($review.status -ne 'SOURCE_REVIEW_NO_BLOCKING_FINDINGS' -or $review.preflightSha256 -ne (Sha $preflightPath) -or $review.wrapperSha256 -ne (Sha $PSCommandPath)){throw 'SOURCE_REVIEW_NOT_BOUND'}
if($plan.kind -eq 'EXACT_A52_DESCRIPTOR_PROCESSOR'){
    if($RunId -ne 'processor-01'){throw 'ONLY_ONE_PROCESSOR_RUN'}
    $authority=[IO.File]::ReadAllText((Join-Path $root 'inputs/authority/A52_PHY01_CONSISTENT_MARGIN_PACKAGE_R05_INPUT.json'))|ConvertFrom-Json
    $proposal=[IO.File]::ReadAllText((Join-Path $root 'inputs/preflight-controls/PACKAGE_REQUIRED_DISPOSITION.json'))|ConvertFrom-Json
    if($plan.binary.path -ne $proposal.programme.binary.path -or $plan.binary.sha256 -ne $authority.preciseDescriptorBuildDisposition.binarySha256 -or ($plan.argv|ConvertTo-Json -Compress) -ne ($proposal.programme.argv|ConvertTo-Json -Compress)){throw 'EXACT_PROCESSOR_DISPOSITION_MISMATCH'}
}
foreach($output in $plan.mustBeAbsent){
    $resolved=[IO.Path]::GetFullPath($output)
    if(-not $resolved.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $resolved)){throw 'OUTPUT_NOT_ABSENT_OR_OUTSIDE_LEASE'}
}
$run=Join-Path $root ('raw/'+$RunId)
[IO.Directory]::CreateDirectory((Join-Path $root 'raw'))|Out-Null
$temp=Join-Path $root ('temp/'+$RunId)
[IO.Directory]::CreateDirectory($temp)|Out-Null
WriteNew ($run+'.start-intent.json') (([ordered]@{runId=$RunId;preflightSha256=Sha $preflightPath;singleAttempt=$true}|ConvertTo-Json)+[Environment]::NewLine)
$psi=[Diagnostics.ProcessStartInfo]::new()
$psi.FileName=$plan.binary.path
$psi.WorkingDirectory=$root
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$true
$psi.RedirectStandardOutput=$true
$psi.RedirectStandardError=$true
$psi.StandardOutputEncoding=[Text.Encoding]::UTF8
$psi.StandardErrorEncoding=[Text.Encoding]::UTF8
foreach($arg in $plan.argv){$psi.ArgumentList.Add([string]$arg)}
foreach($name in $plan.removeChildEnvironment){$psi.Environment.Remove([string]$name)|Out-Null}
foreach($name in @('TEMP','TMP','TMPDIR')){$psi.Environment[$name]=$temp}
$process=[Diagnostics.Process]::new()
$process.StartInfo=$psi
$start=[DateTimeOffset]::UtcNow
$launched=$false;$timedOut=$false;$exitCode=$null;$end=$null;$spawnError=$null
try{
    $launched=$process.Start()
    $out=$process.StandardOutput.ReadToEndAsync()
    $err=$process.StandardError.ReadToEndAsync()
    if($process.WaitForExit(60000)){
        $process.WaitForExit()
        $exitCode=$process.ExitCode
        $stdout=$out.GetAwaiter().GetResult()
        $stderr=$err.GetAwaiter().GetResult()
        $end=[DateTimeOffset]::UtcNow.ToString('o')
    }else{
        $timedOut=$true
        $stdout=''
        $stderr='DEADLINE_HOLD: child not killed; stdout/stderr tasks incomplete, child exit unknown; no retry or later process.'
    }
}catch{
    $spawnError=$_.Exception.Message
    $stdout='';$stderr=$spawnError
    $end=[DateTimeOffset]::UtcNow.ToString('o')
}
WriteNew ($run+'.stdout.log') $stdout
WriteNew ($run+'.stderr.log') $stderr
$receipt=[ordered]@{
    schema='hestia.phy01.a52.bound-programme.v1';runId=$RunId;kind=$plan.kind;binary=$plan.binary;argv=$plan.argv;cwd=$root;
    start=$start.ToString('o');endObserved=$end;deadlineMs=60000;launched=$launched;exitCode=$exitCode;timeout=$timedOut;spawnError=$spawnError;
    preflightSha256=Sha $preflightPath;sourceReviewSha256=Sha $reviewPath;wrapperSha256=Sha $PSCommandPath;
    stdout=[ordered]@{path=$RunId+'.stdout.log';sha256=Sha ($run+'.stdout.log')};
    stderr=[ordered]@{path=$RunId+'.stderr.log';sha256=Sha ($run+'.stderr.log')};
    streamCompleteness=$(if($timedOut){'INCOMPLETE_CHILD_STATUS_UNRESOLVED'}else{'COMPLETE'});
    effects=$plan.effects;descriptorBuildTool=$($plan.kind -eq 'EXACT_A52_DESCRIPTOR_PROCESSOR');
    wasmEngine=0;physics=0;generatedModuleLoad=0;timeoutIsFuel=$false;retry=0;kill=0
}
WriteNew ($run+'.receipt.json') (($receipt|ConvertTo-Json -Depth 15)+[Environment]::NewLine)
$receipt|ConvertTo-Json -Depth 12
if($timedOut -or $spawnError){exit 90}
if($exitCode -ne 0){exit $exitCode}
