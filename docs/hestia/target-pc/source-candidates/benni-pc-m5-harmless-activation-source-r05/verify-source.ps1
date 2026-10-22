param([ValidateSet('RED','GREEN','AST','SYNTAX','EMIT','PRESERVE','ALL','METADATA','R04_RED','R04_GREEN','R05_RED','R05_GREEN')][string]$Phase,[ValidateSet('','_FINAL','_SEALED','_FINAL2','_CLOSURE')][string]$Tag='')
$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$start=[Environment]::TickCount64;$work=$start+$(if($Phase-eq'EMIT'){45000}else{25000});$end=$start+$(if($Phase-eq'EMIT'){60000}else{30000})
function NewText($name,$text){$b=[Text.UTF8Encoding]::new($false).GetBytes($text);$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$node='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe';$pwsh='C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'
if((Get-FileHash $node).Hash.ToLowerInvariant()-cne'0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'-or(Get-FileHash $pwsh).Hash.ToLowerInvariant()-cne'db6dd81183fe57d22e03b911ec9a30a2fd7c40542e97743615355a6fb44f458f'){throw 'tool pin drift'}
$exe=$node;$argsFixed=@((Join-Path $root 'r03-source-checks.mjs'),$(if($Phase-eq'RED'){'../benni-pc-m5-harmless-activation-source-r02'}else{'.'}))
if($Phase-eq'R04_RED'-or$Phase-eq'R04_GREEN'){$argsFixed=@((Join-Path $root 'r04-source-checks.mjs'),$(if($Phase-eq'R04_RED'){'../benni-pc-m5-harmless-activation-source-r03'}else{'.'}))}
if($Phase-eq'R05_RED'-or$Phase-eq'R05_GREEN'){$argsFixed=@((Join-Path $root 'r05-source-checks.mjs'),$(if($Phase-eq'R05_RED'){'../benni-pc-m5-harmless-activation-source-r04'}else{'.'}))}
if($Phase-eq'ALL'){$argsFixed=@((Join-Path $root 'all-pure-checks.mjs'))}
if($Phase-eq'AST'){$exe=$pwsh;$argsFixed=@('-NoProfile','-NonInteractive','-File',(Join-Path $root 'static-ast-check.ps1'))}
if($Phase-eq'EMIT'){$exe=$pwsh;$argsFixed=@('-NoProfile','-NonInteractive','-File',(Join-Path $root 'compile-only-reviewed.ps1'))}
if($Phase-eq'SYNTAX'){$argsFixed=@('--check',(Join-Path $root 'harmless-fixture.mjs'))}
if($Phase-eq'METADATA'){$exe=$pwsh;$argsFixed=@('-NoProfile','-NonInteractive','-File',(Join-Path $root 'source-metadata.ps1'))}
if($Phase-eq'PRESERVE'){$exe=$pwsh;$argsFixed=@('-NoProfile','-NonInteractive','-File',(Join-Path $root 'preservation-check.ps1'))}
$inputs=@(Get-ChildItem -LiteralPath $root -Recurse -File)
if($Phase-eq'RED'-or$Phase-eq'R04_RED'-or$Phase-eq'R05_RED'){$inputs+=@(Get-ChildItem -LiteralPath (Join-Path (Split-Path $root -Parent) $(if($Phase-eq'R05_RED'){'benni-pc-m5-harmless-activation-source-r04'}elseif($Phase-eq'R04_RED'){'benni-pc-m5-harmless-activation-source-r03'}else{'benni-pc-m5-harmless-activation-source-r02'})) -Recurse -File)}
if($Phase-eq'ALL'){foreach($d in @('benni-pc-m5-harmless-activation-source-r02','benni-pc-native24-harmless-qualification-source-r03','benni-pc-native24-harmless-qualification-source-r02')){$inputs+=@(Get-ChildItem -LiteralPath (Join-Path (Split-Path $root -Parent) $d) -Recurse -File)}}
$before=@(foreach($f in $inputs|Sort-Object FullName -Unique){[ordered]@{path=$f.FullName;bytes=$f.Length;sha256=(Get-FileHash -LiteralPath $f.FullName).Hash.ToLowerInvariant()}})
NewText ($Phase+$Tag+'_COMMAND.json') (($([ordered]@{phase=$Phase;executable=$exe;arguments=$argsFixed;selectedInputs=$before;startTick=$start;workDeadline=$work;hardDeadline=$end;payloadExecutions=0})|ConvertTo-Json -Depth 8)+[Environment]::NewLine)
$p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new();$p.StartInfo.FileName=$exe;foreach($a in $argsFixed){$p.StartInfo.ArgumentList.Add($a)}
$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.WorkingDirectory=$root
foreach($n in @('NODE_OPTIONS','NODE_PATH','DOTNET_STARTUP_HOOKS','DOTNET_ADDITIONAL_DEPS','DOTNET_SHARED_STORE','COR_ENABLE_PROFILING','CORECLR_ENABLE_PROFILING')){[void]$p.StartInfo.Environment.Remove($n)}
$terminal=$false;$closed=$false;$streams=$false;$kill=$false;$exit=$null;$out='';$err='';$h=$null
try{if(-not$p.Start()){throw 'verification host start failed'};$h=$p.SafeHandle;$ownedId=$p.Id;$o=$p.StandardOutput.ReadToEndAsync();$e=$p.StandardError.ReadToEndAsync();$terminal=$p.WaitForExit([int][Math]::Max(0,$work-[Environment]::TickCount64));if(-not$terminal){$kill=$true;$p.Kill();$terminal=$p.WaitForExit([int][Math]::Max(0,$end-[Environment]::TickCount64))}
if($terminal){$exit=$p.ExitCode;$streams=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($o,$e),[int][Math]::Max(0,$end-[Environment]::TickCount64));if($streams){$out=$o.Result;$err=$e.Result}}}finally{$p.Dispose();$closed=$null-ne$h-and$h.IsClosed}
$unchanged=$true;foreach($f in $before){if(-not[IO.File]::Exists($f.path)-or([IO.FileInfo]$f.path).Length-ne$f.bytes-or(Get-FileHash $f.path).Hash.ToLowerInvariant()-cne$f.sha256){$unchanged=$false}}
$finish=[Environment]::TickCount64
NewText ($Phase+$Tag+'_STDOUT.txt') $out;NewText ($Phase+$Tag+'_STDERR.txt') $err
$result=[ordered]@{phase=$Phase;exitCode=$exit;elapsedMs=$finish-$start;withinDeadline=$finish-le$end;ownedProcessId=$ownedId;terminalSignaled=$terminal;actualHandleClosed=$closed;streamsComplete=$streams;killAttempted=$kill;selectedInputCount=$before.Count;selectedInputsUnchanged=$unchanged;sourceOnly=$true;payloadExecutions=0;runtimeGrant='NONE_HOLD'}
NewText ($Phase+$Tag+'_RESULT.json') (($result|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
$result|ConvertTo-Json -Compress
$out -split '\r?\n'|Where-Object{$_.StartsWith('FAIL')-or$_.StartsWith('{')}|Select-Object -Last 14
if(-not$terminal-or-not$closed-or-not$streams-or-not$unchanged-or$finish-gt$end){exit 2};exit $exit
