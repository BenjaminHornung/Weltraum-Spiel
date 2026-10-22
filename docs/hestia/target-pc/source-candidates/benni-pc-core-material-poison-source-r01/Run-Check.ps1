param([Parameter(Mandatory)][string]$Label,[Parameter(Mandatory)][string]$Exe,[Parameter(Mandatory)][string[]]$CheckArgs,[int]$ExpectedExit=0)
$ErrorActionPreference='Stop'
$node='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
$tsc='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\m5-toolchain\node_modules\@typescript\typescript-win32-x64\lib\tsc.exe'
$expected=if($Exe-eq $node){'0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'}elseif($Exe-eq $tsc){'f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7'}else{throw 'QUALIFIED_TOOLS_ONLY'}
if((Get-FileHash -LiteralPath $Exe).Hash.ToLowerInvariant()-ne $expected){throw 'TOOL_PIN'}
$path=Join-Path $PSScriptRoot ('evidence/'+$Label+'.json')
if(Test-Path -LiteralPath $path){throw 'CHECK_RECEIPT_EXISTS'}
$watch=[Diagnostics.Stopwatch]::StartNew();$p=[Diagnostics.Process]::new();$terminal=$false;$safe=$null;$failure=$null;$started=$false
try{
 $p.StartInfo.FileName=$Exe;foreach($a in $CheckArgs){$p.StartInfo.ArgumentList.Add($a)}
 $p.StartInfo.WorkingDirectory=$PSScriptRoot;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
 $null=$p.StartInfo.Environment.Remove('NODE_OPTIONS');$null=$p.StartInfo.Environment.Remove('NODE_V8_COVERAGE')
 if(-not $p.Start()){throw 'OWN_START_FAILED'};$started=$true;$ownPid=$p.Id;$creation=$p.StartTime.ToFileTimeUtc().ToString();$safe=$p.SafeHandle
 $outTask=$p.StandardOutput.ReadToEndAsync();$errTask=$p.StandardError.ReadToEndAsync()
 if(-not $p.WaitForExit([Math]::Max(1,48000-[int]$watch.ElapsedMilliseconds))){$p.Kill($true);throw 'OWN_WORK_CUTOFF'}
 $terminal=$true;$code=$p.ExitCode
 if(-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($outTask,$errTask),[Math]::Max(1,59000-[int]$watch.ElapsedMilliseconds))){throw 'OWN_STREAM_CUTOFF'}
 $out=$outTask.Result;$err=$errTask.Result;$p.StandardOutput.Dispose();$p.StandardError.Dispose()
}catch{$failure=$_.Exception.ToString()}finally{if($started-and-not $terminal){try{if(-not $p.HasExited){$p.Kill($true)};$terminal=$p.WaitForExit([Math]::Max(1,59500-[int]$watch.ElapsedMilliseconds))}catch{}};$p.Dispose()}
$receipt=[ordered]@{label=$Label;command=@($Exe)+$CheckArgs;cwd=$PSScriptRoot;pid=$ownPid;creationFileTime=$creation;terminal=$terminal;exitCode=$code;expectedExit=$ExpectedExit;stdoutEof=($null-ne $outTask-and$outTask.IsCompletedSuccessfully);stderrEof=($null-ne $errTask-and$errTask.IsCompletedSuccessfully);safeHandleClosed=($null-ne $safe-and$safe.IsClosed);elapsedMs=$watch.ElapsedMilliseconds;stdout=$out;stderr=$err;failure=$failure}
$receipt.passed=($terminal-and$code-eq $ExpectedExit-and$receipt.stdoutEof-and$receipt.stderrEof-and$receipt.safeHandleClosed-and-not $failure-and$watch.ElapsedMilliseconds-le 60000)
$null=[IO.Directory]::CreateDirectory((Split-Path -Parent $path));$b=[Text.UTF8Encoding]::new($false).GetBytes(($receipt|ConvertTo-Json -Depth 8));$h=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$h.Write($b,0,$b.Length);$h.Flush($true)}finally{$h.Dispose()}
$receipt|ConvertTo-Json -Depth 8 -Compress
if(-not $receipt.passed){exit 1}

