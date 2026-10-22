param([string]$Label,[string]$ArgsFile)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$q=Get-Content (Join-Path $root 'QUALIFIED_INPUTS.json') -Raw|ConvertFrom-Json -AsHashtable
$exe=$q.qualifiedNode.path
if((Get-FileHash $exe).Hash.ToLowerInvariant() -ne $q.qualifiedNode.sha256){throw 'qualified Node drift'}
$argv=@(Get-Content (Join-Path $root $ArgsFile) -Raw|ConvertFrom-Json)
function NewText($n,$v){$b=[Text.UTF8Encoding]::new($false).GetBytes($v);$f=[IO.File]::Open((Join-Path $root $n),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length);$f.Flush($true)}finally{$f.Dispose()}}
$start=[DateTime]::UtcNow;$tick=[Environment]::TickCount64;$work=$tick+1500000;$end=$tick+1560000
$p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new();$p.StartInfo.FileName=$exe
foreach($a in $argv){$p.StartInfo.ArgumentList.Add([string]$a)}
$p.StartInfo.WorkingDirectory=$root;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true
$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
$p.StartInfo.Environment.Clear()
foreach($name in @('SystemRoot','WINDIR','ComSpec','PATHEXT','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS')){$v=[Environment]::GetEnvironmentVariable($name);if($v){$p.StartInfo.Environment[$name]=$v}}
$windows=[Environment]::GetEnvironmentVariable('SystemRoot')
$p.StartInfo.Environment['PATH']=(Split-Path $exe -Parent)+';'+(Join-Path $windows 'System32')
$temp=Join-Path $root 'tmp';$null=[IO.Directory]::CreateDirectory($temp)
$p.StartInfo.Environment['TEMP']=$temp;$p.StartInfo.Environment['TMP']=$temp
NewText ($Label+'_COMMAND.json') (([ordered]@{executable=$exe;sha256=$q.qualifiedNode.sha256;arguments=$argv;workingDirectory=$root;startUtc=$start.ToString('o');workBudgetMs=1500000;totalBudgetMs=1560000;environmentCleared=$true;environmentKeys=@($p.StartInfo.Environment.Keys|Sort-Object);installerReused=$false}|ConvertTo-Json -Depth 6))
$started=$false;$handle=$null;$ownedId=$null;$terminal=$false;$streams=$false;$ot=$null;$et=$null;$out='';$err='';$code=$null;$timedOut=$false;$primary=$null;$cleanup=[Collections.Generic.List[string]]::new()
try{
 if(-not $p.Start()){throw 'process did not start'}
 $started=$true;$ownedId=$p.Id;$handle=$p.SafeHandle
 NewText ($Label+'_OWN_PID.json') (([ordered]@{ownedProcessId=$ownedId;startedUtc=[DateTime]::UtcNow.ToString('o');totalEndTick=$end;scope='this created process and its own compiler service descendants'}|ConvertTo-Json))
 $ot=$p.StandardOutput.ReadToEndAsync();$et=$p.StandardError.ReadToEndAsync()
 $terminal=$p.WaitForExit([int][Math]::Max(0,$work-[Environment]::TickCount64))
 if(-not $terminal){$timedOut=$true}
}catch{$primary=$_.ToString()}
finally{
 if($started){
  try{if($null -eq $ownedId){$ownedId=$p.Id};if($null -eq $handle){$handle=$p.SafeHandle}}catch{$cleanup.Add($_.ToString())}
  try{if($null -eq $ot){$ot=$p.StandardOutput.ReadToEndAsync()};if($null -eq $et){$et=$p.StandardError.ReadToEndAsync()}}catch{$cleanup.Add($_.ToString())}
  try{
   if(-not $terminal){if(-not $p.HasExited){$p.Kill($true)};$terminal=$p.WaitForExit([int][Math]::Max(0,$end-[Environment]::TickCount64))}
   if($terminal){$code=$p.ExitCode}
  }catch{$cleanup.Add($_.ToString())}
  try{
   if($null -ne $ot -and $null -ne $et){$streams=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($ot,$et),[int][Math]::Max(0,$end-[Environment]::TickCount64));if($streams){$out=$ot.GetAwaiter().GetResult();$err=$et.GetAwaiter().GetResult()}}
  }catch{$streams=$false;$cleanup.Add($_.ToString())}
 }
 try{$p.Dispose()}catch{$cleanup.Add($_.ToString())}
}
NewText ($Label+'_STDOUT.txt') $out;NewText ($Label+'_STDERR.txt') $err
$closed=$null -ne $handle -and $handle.IsClosed
$pass=$started -and $terminal -and $streams -and $closed -and -not $timedOut -and $null -eq $primary -and $cleanup.Count -eq 0 -and $code -eq 0 -and [Environment]::TickCount64 -le $end
$r=[ordered]@{passed=$pass;startUtc=$start.ToString('o');endUtc=[DateTime]::UtcNow.ToString('o');elapsedMs=[Environment]::TickCount64-$tick;within1560000Ms=([Environment]::TickCount64 -le $end);ownedProcessId=$ownedId;exitCode=$code;terminalSignaled=$terminal;streamsComplete=$streams;actualHandleClosed=$closed;timedOut=$timedOut;primaryError=$primary;cleanupErrors=@($cleanup);exceptionPathHasBoundedKillWaitDrainDispose=$true}
NewText ($Label+'_RESULT.json') ($r|ConvertTo-Json -Depth 7)
$r|ConvertTo-Json -Depth 7 -Compress
if(-not $pass){exit 2}

