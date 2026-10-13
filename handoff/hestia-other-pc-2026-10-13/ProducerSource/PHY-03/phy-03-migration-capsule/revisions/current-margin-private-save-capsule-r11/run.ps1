param([Parameter(Mandatory)][ValidateSet('strict','emit','eight','contracts')][string]$Event)
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
if(!$root.StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase)){throw 'CIFI root required'}
$node='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe'
$tsc='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-PHY-03-2026-10-09/spikes/phy-03-migration-capsule/node_modules/@typescript/typescript-win32-x64/lib/tsc.exe'
function Bound($path){$f=[IO.FileInfo]::new($path);if(!$f.Exists){throw "Missing regular input: $path"};[ordered]@{path=$f.FullName;bytes=$f.Length;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}}
function NewJson($path,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 30));$s=[IO.File]::Open($path,[IO.FileMode]::CreateNew);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
$binary=if($Event-in@('strict','emit')){$tsc}else{$node}
$expected=if($binary-eq$tsc){'f9ecfbdc93753d2c972d66a8d0d75f5bd737fd4a5f88b422d9091ea282bcb2c7'}else{'0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'}
$tool=Bound $binary;if($tool.sha256-ne$expected){throw 'Tool byte drift'}
$argv=switch($Event){
  'strict' {@('--project','input/tsconfig.current.json','--noEmit','--pretty','false','--listFiles')}
  'emit' {@('--project','input/tsconfig.current.emit.json','--pretty','false','--listEmittedFiles')}
  'eight' {@('pure/run-eight.mjs')}
  'contracts' {@('pure/run-contracts.mjs')}
}
$runs=Join-Path $root 'runs';[IO.Directory]::CreateDirectory($runs)|Out-Null
$i=1;while([IO.Directory]::Exists((Join-Path $runs "$Event-$i"))){$i++}
$out=Join-Path $runs "$Event-$i";[IO.Directory]::CreateDirectory($out)|Out-Null
$inputs=@(Get-ChildItem -LiteralPath (Join-Path $root 'input') -File -Recurse|ForEach-Object {Bound $_.FullName})
if($Event-in@('eight','contracts')){$inputs+=@(Get-ChildItem -LiteralPath (Join-Path $root 'build/esm-r01') -File -Recurse|ForEach-Object {Bound $_.FullName});$inputs+=@(Get-ChildItem -LiteralPath (Join-Path $root 'pure') -File -Recurse|ForEach-Object {Bound $_.FullName})}
NewJson (Join-Path $out 'inputs.json') $inputs
$request=[ordered]@{binary=$tool;argv=$argv;cwd=$root;deadlineMs=60000;inputBinding=Bound (Join-Path $out 'inputs.json');launcher=Bound $PSCommandPath;sourceProfile='CURRENT196_F26_SOURCE_CUSTODY';nativeBrowserGpu='NOT_RUN'}
NewJson (Join-Path $out 'command.json') $request
$psi=[Diagnostics.ProcessStartInfo]::new();$psi.FileName=$binary;$psi.WorkingDirectory=$root;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
foreach($arg in $argv){$psi.ArgumentList.Add($arg)}
foreach($key in @('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_ENV','NODE_INSPECTOR_IPC')){$psi.Environment.Remove($key)|Out-Null}
$psi.Environment['GOMAXPROCS']='1';$temp=Join-Path $out 'temp';[IO.Directory]::CreateDirectory($temp)|Out-Null;$psi.Environment['TEMP']=$temp;$psi.Environment['TMP']=$temp
$p=[Diagnostics.Process]::new();$p.StartInfo=$psi;$start=[DateTimeOffset]::UtcNow.ToString('o');$startError=$null;$actualExit=$null;$timeout=$false
try{
  if(!$p.Start()){throw 'Child start returned false'}
  $stdout=$p.StandardOutput.ReadToEndAsync();$stderr=$p.StandardError.ReadToEndAsync()
  if(!$p.WaitForExit(60000)){$timeout=$true;throw 'Deadline exceeded; no kill/retry or exit fabrication'}
  $actualExit=$p.ExitCode
  [IO.File]::WriteAllText((Join-Path $out 'stdout.raw'),$stdout.GetAwaiter().GetResult(),[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText((Join-Path $out 'stderr.raw'),$stderr.GetAwaiter().GetResult(),[Text.UTF8Encoding]::new($false))
}catch{$startError=$_.Exception.Message}finally{
  $result=[ordered]@{event=$Event;started=$start;finished=[DateTimeOffset]::UtcNow.ToString('o');exit=$actualExit;timeout=$timeout;startError=$startError;deadlineMs=60000;stdout=if([IO.File]::Exists((Join-Path $out 'stdout.raw'))){Bound (Join-Path $out 'stdout.raw')}else{$null};stderr=if([IO.File]::Exists((Join-Path $out 'stderr.raw'))){Bound (Join-Path $out 'stderr.raw')}else{$null}}
  NewJson (Join-Path $out 'result.json') $result;$p.Dispose()
}
$result|ConvertTo-Json -Depth 8
if($timeout-or$null-eq$actualExit){exit 2};exit $actualExit
