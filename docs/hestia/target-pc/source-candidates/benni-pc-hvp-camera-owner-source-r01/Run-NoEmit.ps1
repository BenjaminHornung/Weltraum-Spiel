param([string]$Label,[string]$Config)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$exe='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\m5-toolchain\node_modules\@typescript\typescript-win32-x64\lib\tsc.exe'
if((Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant() -ne 'f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7'){throw 'compiler drift'}
function NewText($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes($value);$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$start=[DateTime]::UtcNow;$tick=[Environment]::TickCount64;$work=$tick+45000;$end=$tick+60000
$argv=@('--project',(Join-Path $root $Config),'--pretty','false')
NewText ($Label+'_COMMAND.json') (([ordered]@{executable=$exe;arguments=$argv;configSha256=(Get-FileHash (Join-Path $root $Config)).Hash.ToLowerInvariant();startUtc=$start.ToString('o');workBudgetMs=45000;totalBudgetMs=60000;testExecutions=0}|ConvertTo-Json -Depth 5))
$p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new();$p.StartInfo.FileName=$exe
foreach($a in $argv){$p.StartInfo.ArgumentList.Add($a)}
$p.StartInfo.WorkingDirectory=$root;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
foreach($n in @('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_ENV','NODE_INSPECTOR_IPC')){$null=$p.StartInfo.Environment.Remove($n)}
$handle=$null;$signaled=$false;$streams=$false;$exitCode=$null;$out='';$err='';$ownedId=$null;$timedOut=$false
try{
 if(-not $p.Start()){throw 'compiler not started'};$handle=$p.SafeHandle;$ownedId=$p.Id;$ot=$p.StandardOutput.ReadToEndAsync();$et=$p.StandardError.ReadToEndAsync()
 $signaled=$p.WaitForExit([int][Math]::Max(0,$work-[Environment]::TickCount64))
 if(-not $signaled){$timedOut=$true;$p.Kill();$signaled=$p.WaitForExit([int][Math]::Max(0,$end-[Environment]::TickCount64))}
 if($signaled){$exitCode=$p.ExitCode;$streams=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($ot,$et),[int][Math]::Max(0,$end-[Environment]::TickCount64));if($streams){$out=$ot.Result;$err=$et.Result}}
}finally{$p.Dispose()}
NewText ($Label+'_STDOUT.txt') $out;NewText ($Label+'_STDERR.txt') $err
$diagnostics=@($out -split '\r?\n'|Where-Object{$_ -match 'error TS[0-9]+'})
$result=[ordered]@{exitCode=$exitCode;semanticPass=($exitCode -eq 0 -and -not $timedOut);startUtc=$start.ToString('o');endUtc=[DateTime]::UtcNow.ToString('o');elapsedMs=[Environment]::TickCount64-$tick;within60000Ms=([Environment]::TickCount64 -le $end);ownedProcessId=$ownedId;terminalSignaled=$signaled;actualHandleClosed=($null -ne $handle -and $handle.IsClosed);streamsComplete=$streams;timedOut=$timedOut;diagnosticCount=$diagnostics.Count;diagnostics=$diagnostics;testExecutions=0;applicationMethodsInvoked=0;emission=$false}
NewText ($Label+'_RESULT.json') ($result|ConvertTo-Json -Depth 5)
$result|ConvertTo-Json -Depth 5 -Compress
if(-not $signaled -or -not $streams -or -not $handle.IsClosed -or $timedOut){exit 2}
exit $exitCode
