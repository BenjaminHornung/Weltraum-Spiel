$ErrorActionPreference='Stop'
$taskRoot='C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-Spike-ATM-01-04-2026-10-09/spikes/atm-01-04-volumes/revisions/full-optics-authorized-spawn-build-cpu-closure-r12'
$nodePath='C:/IFI_SourceCode/Utils/npm-tmp/opencode/node-v22.23.2-win-x64/node.exe'
$eventDir=$taskRoot+'/meta/events/01-source-build'
$keys=@('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_INSPECTOR_IPC','VSCODE_INSPECTOR_OPTIONS','ESBUILD_BINARY_PATH','ESBUILD_WORKER_THREADS','ESBUILD_MAX_BUFFER')
$blocked=@(foreach($key in $keys){if([Environment]::GetEnvironmentVariable($key,'Process')){$key}})
if($blocked.Count){throw ('PRENODE_NONEMPTY_KEYS:'+($blocked -join ','))}
$expected=@(
@{path=$nodePath;sha256='0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4';bytes=86997320},
@{path=$taskRoot+'/scripts/compile-r09.mjs';sha256='a3bdda1dc9ad9c92e758fe9d4642acbd10937a8c47ad407666568a4381d817cd';bytes=2629},
@{path=$taskRoot+'/node_modules/esbuild/lib/main.js';sha256='b090fe57c79c677256a242703ea07bb2191eced357bece2f9a25539443da070c';bytes=88698},
@{path=$taskRoot+'/node_modules/@esbuild/win32-x64/esbuild.exe';sha256='f0dd2091eaf58d11b96c64e0c4516f8ecf94486a28d2a8e7a968bd6770db3ffe';bytes=11375616})
foreach($e in $expected){$f=Get-Item -LiteralPath $e.path;if($f.PSIsContainer -or ($f.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $f.Length -ne $e.bytes -or (Get-FileHash -LiteralPath $e.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $e.sha256){throw 'IMMEDIATE_TOOL_DRIFT'}}
if(Test-Path -LiteralPath $eventDir){throw 'EVENT_ALREADY_EXISTS'}
if(Test-Path -LiteralPath ($taskRoot+'/dist')){throw 'OUTPUT_ALREADY_EXISTS'}
if(@(Get-ChildItem -LiteralPath ($taskRoot+'/.runtime') -File|Where-Object{$_.Name -match '^(optics|occlusion|timer|init|reuse|composer|weather-port).mjs$'}).Count){throw 'OUTPUT_ALREADY_EXISTS'}
$wrapperSha=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
$prelaunchSha=(Get-FileHash -LiteralPath ($taskRoot+'/meta/PRELAUNCH.json') -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.Directory]::CreateDirectory($eventDir)|Out-Null
$outFile=[IO.File]::Open($eventDir+'/stdout.raw',[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite)
$errFile=[IO.File]::Open($eventDir+'/stderr.raw',[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite)
$info=[Diagnostics.ProcessStartInfo]::new()
$info.FileName=$nodePath
$info.ArgumentList.Add('scripts/compile-r09.mjs')
$info.WorkingDirectory=$taskRoot
$info.UseShellExecute=$false
$info.CreateNoWindow=$true
$info.RedirectStandardOutput=$true
$info.RedirectStandardError=$true
$proc=[Diagnostics.Process]::new()
$proc.StartInfo=$info
$started=[DateTime]::UtcNow.ToString('o')
$actualExit=$null
$complete=$false
$captureComplete=$false
$startError=$null
$deadline=[Diagnostics.Stopwatch]::StartNew()
try{
 $didStart=$proc.Start()
 if(-not $didStart){throw 'PROCESS_START_RETURNED_FALSE'}
 $outTask=$proc.StandardOutput.BaseStream.CopyToAsync($outFile)
 $errTask=$proc.StandardError.BaseStream.CopyToAsync($errFile)
 $complete=$proc.WaitForExit([Math]::Max(0,90000-[int]$deadline.ElapsedMilliseconds))
 if($complete){
  $actualExit=$proc.ExitCode
  $pipes=[Threading.Tasks.Task]::WhenAll($outTask,$errTask)
  $captureComplete=$pipes.Wait([Math]::Max(0,90000-[int]$deadline.ElapsedMilliseconds))
  if($captureComplete){$pipes.GetAwaiter().GetResult()|Out-Null}
 }
}catch{$startError=$_.Exception.ToString()}
$outFile.Flush()
$errFile.Flush()
 $outFile.Dispose()
 $errFile.Dispose()
$event=[ordered]@{schema='atm.r12.actual-build-event.v1';binary=$nodePath;binarySha256=$expected[0].sha256;argv=@('scripts/compile-r09.mjs');cwd=$taskRoot;deadlineSeconds=90;startedAtUtc=$started;observedAtUtc=[DateTime]::UtcNow.ToString('o');parentExitObserved=$complete;rawCaptureComplete=$captureComplete;deadlineExpired=($deadline.ElapsedMilliseconds -ge 90000);actualExitCode=$actualExit;startOrCaptureError=$startError;ambientCheckedBeforeStart=$keys;ambientNonemptyKeyNames=$blocked;environmentMutation=$false;wrapperPath='meta/BUILD_WRAPPER.ps1';wrapperSha256=$wrapperSha;prelaunchPath='meta/PRELAUNCH.json';prelaunchSha256=$prelaunchSha;stdout='stdout.raw';stderr='stderr.raw';serviceChildExitCode=$null;physicalRetirement='UNVERIFIED_NO_QUERY_NO_KILL';stopServiceCalled=$false;retryCount=0;sandboxDisposition='A55_ONE_REQUIRE_ESCALATED_EXACT_COMMAND';status=$(if($complete -and $captureComplete -and $actualExit -eq 0 -and -not $startError){'SOURCE_EMIT_EXIT0'}else{'HOLD_NO_RETRY'})}
$stream=[IO.File]::Open($eventDir+'/event.json',[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$b=[Text.UTF8Encoding]::new($false).GetBytes(($event|ConvertTo-Json -Depth 8));$stream.Write($b)}finally{$stream.Dispose()}
$event|ConvertTo-Json -Depth 8
if($complete -and $captureComplete -and $actualExit -eq 0 -and -not $startError){exit 0}else{exit 3}

