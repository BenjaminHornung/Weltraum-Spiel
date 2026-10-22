param([string]$Label,[string]$Selection,[string]$Target)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$repo='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13'
$exe='C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe'
if((Get-Item $exe).Length -ne 91648 -or (Get-FileHash $exe).Hash.ToLowerInvariant() -ne 'e9f7e4baa0da1c21ffc3c2c2a644459b1a38dced56dfc7846e16f801645d520f'){throw 'python drift'}
function NewText($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes($value);$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$start=[DateTime]::UtcNow;$tick=[Environment]::TickCount64;$work=$tick+45000;$end=$tick+60000
$argv=@('-I','-S','-B',(Join-Path $root 'host_check.py'),$repo,$Selection,$Target)
NewText ($Label+'_COMMAND.json') (([ordered]@{executable=$exe;sha256=(Get-FileHash $exe).Hash.ToLowerInvariant();arguments=$argv;startUtc=$start.ToString('o');workBudgetMs=45000;totalBudgetMs=60000;realBlender=$false;runtimeRuns=0}|ConvertTo-Json -Depth 5))
$p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new();$p.StartInfo.FileName=$exe
foreach($a in $argv){$p.StartInfo.ArgumentList.Add($a)}
$p.StartInfo.WorkingDirectory=$repo;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
foreach($n in @('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONINSPECT')){$null=$p.StartInfo.Environment.Remove($n)}
$handle=$null;$signaled=$false;$streams=$false;$exitCode=$null;$out='';$err='';$ownedId=$null;$timedOut=$false
try{
 if(-not $p.Start()){throw 'host check not started'};$handle=$p.SafeHandle;$ownedId=$p.Id;$ot=$p.StandardOutput.ReadToEndAsync();$et=$p.StandardError.ReadToEndAsync()
 $signaled=$p.WaitForExit([int][Math]::Max(0,$work-[Environment]::TickCount64))
 if(-not $signaled){$timedOut=$true;$p.Kill();$signaled=$p.WaitForExit([int][Math]::Max(0,$end-[Environment]::TickCount64))}
 if($signaled){$exitCode=$p.ExitCode;$streams=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($ot,$et),[int][Math]::Max(0,$end-[Environment]::TickCount64));if($streams){$out=$ot.Result;$err=$et.Result}}
}finally{$p.Dispose()}
NewText ($Label+'_STDOUT.txt') $out;NewText ($Label+'_STDERR.txt') $err
$result=[ordered]@{exitCode=$exitCode;passed=($exitCode -eq 0 -and -not $timedOut);startUtc=$start.ToString('o');endUtc=[DateTime]::UtcNow.ToString('o');elapsedMs=[Environment]::TickCount64-$tick;within60000Ms=([Environment]::TickCount64 -le $end);ownedProcessId=$ownedId;terminalSignaled=$signaled;actualHandleClosed=($null -ne $handle -and $handle.IsClosed);streamsComplete=$streams;timedOut=$timedOut;realBlender=$false;runtimeRuns=0}
NewText ($Label+'_RESULT.json') ($result|ConvertTo-Json -Depth 5)
$result|ConvertTo-Json -Depth 5 -Compress
if(-not $signaled -or -not $streams -or -not $handle.IsClosed -or $timedOut){exit 2}
exit $exitCode

