param(
    [Parameter(Mandatory=$true)]
    [ValidatePattern('^strict-consumer-[0-9]{2}$')]
    [string]$RunId
)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedRoot=[IO.Path]::GetFullPath('C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-01-2026-10-09/spikes/phy-01-rapier-followup/revisions/positive-margin-production-source-consumer-r06')
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
if($plan.kind -notin @('GENUINE_SOURCE_COMPILER')){throw 'UNBOUND_EFFECT_KIND'}
foreach($row in $plan.inputs){
    $item=Get-Item -LiteralPath $row.path -ErrorAction Stop
    if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $row.bytes -or (Sha $row.path) -ne $row.sha256){throw "PRELAUNCH_INPUT_MISMATCH $($row.path)"}
}
$reviewPath=Join-Path $root ('reviews/'+$RunId+'.review.json')
$review=[IO.File]::ReadAllText($reviewPath)|ConvertFrom-Json
if($review.status -ne 'SOURCE_REVIEW_NO_BLOCKING_FINDINGS' -or $review.preflightSha256 -ne (Sha $preflightPath) -or $review.wrapperSha256 -ne (Sha $PSCommandPath)){throw 'SOURCE_REVIEW_NOT_BOUND'}
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
$launched=$false;$timedOut=$false;$exitCode=$null;$end=$null;$spawnError=$null;$timeoutObserved=$null
$stdoutPath=$run+'.stdout.log';$stderrPath=$run+'.stderr.log'
$options=[IO.FileOptions]::Asynchronous -bor [IO.FileOptions]::WriteThrough
$stdoutFile=[IO.FileStream]::new($stdoutPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite,1,$options)
$stderrFile=[IO.FileStream]::new($stderrPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite,1,$options)
try{
    $launched=$process.Start()
    $out=$process.StandardOutput.BaseStream.CopyToAsync($stdoutFile)
    $err=$process.StandardError.BaseStream.CopyToAsync($stderrFile)
    if($process.WaitForExit(60000)){
        $process.WaitForExit()
        $exitCode=$process.ExitCode
        $out.GetAwaiter().GetResult()|Out-Null
        $err.GetAwaiter().GetResult()|Out-Null
        $stdoutFile.Dispose();$stderrFile.Dispose()
        $end=[DateTimeOffset]::UtcNow.ToString('o')
    }else{
        $timedOut=$true
        $timeoutObserved=[DateTimeOffset]::UtcNow.ToString('o')
    }
}catch{
    $spawnError=$_.Exception.Message
    WriteNew ($run+'.exception.txt') $spawnError
    if(-not $launched){$stdoutFile.Dispose();$stderrFile.Dispose()}
    $end=[DateTimeOffset]::UtcNow.ToString('o')
}
function SnapshotPrefix([string]$path){
    $read=[IO.FileStream]::new($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
    $target=$path+'.observed-prefix'
    $write=[IO.FileStream]::new($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{
        $remaining=$read.Length
        $buffer=New-Object byte[] 65536
        while($remaining -gt 0){
            $count=$read.Read($buffer,0,[int][Math]::Min([long]$remaining,[long]$buffer.Length))
            if($count -eq 0){break}
            $write.Write($buffer,0,$count);$remaining-=$count
        }
    }finally{$read.Dispose();$write.Dispose()}
    $target
}
$streamsComplete=-not $timedOut -and -not $spawnError
if(-not $streamsComplete){
    $stdoutPath=SnapshotPrefix $stdoutPath
    $stderrPath=SnapshotPrefix $stderrPath
}
$receipt=[ordered]@{
    schema='hestia.phy01.a56.bound-programme.v1';runId=$RunId;kind=$plan.kind;binary=$plan.binary;argv=$plan.argv;cwd=$root;
    start=$start.ToString('o');endObserved=$end;timeoutObserved=$timeoutObserved;deadlineMs=60000;launched=$launched;exitCode=$exitCode;timeout=$timedOut;spawnError=$spawnError;
    preflightSha256=Sha $preflightPath;sourceReviewSha256=Sha $reviewPath;wrapperSha256=Sha $PSCommandPath;
    stdout=[ordered]@{path=[IO.Path]::GetFileName($stdoutPath);sha256=Sha $stdoutPath};
    stderr=[ordered]@{path=[IO.Path]::GetFileName($stderrPath);sha256=Sha $stderrPath};
    streamCompleteness=$(if($streamsComplete){'COMPLETE'}else{'OBSERVED_PREFIX_ONLY_CHILD_OR_READER_STATUS_UNRESOLVED'});
    liveStreams=$(if(-not $streamsComplete -and $launched){@($RunId+'.stdout.log',$RunId+'.stderr.log')}else{@()});
    effects=$plan.effects;descriptorBuildTool=$false;
    wasmEngine=0;physics=0;generatedModuleLoad=0;timeoutIsFuel=$false;retry=0;kill=0
}
WriteNew ($run+'.receipt.json') (($receipt|ConvertTo-Json -Depth 15)+[Environment]::NewLine)
$receipt|ConvertTo-Json -Depth 12
if($timedOut -or $spawnError){exit 90}
if($exitCode -ne 0){exit $exitCode}
