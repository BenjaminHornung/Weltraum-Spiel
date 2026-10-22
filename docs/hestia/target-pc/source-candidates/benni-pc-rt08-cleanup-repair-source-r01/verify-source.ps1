param([ValidateSet('RED','GREEN','SYNTAX_OPERATIONS','SYNTAX_SESSION','SYNTAX_TESTS','PARSE_MAIN')][string]$Phase,[ValidateSet('','_FINAL')][string]$Tag='')
$ErrorActionPreference='Stop';$root=$PSScriptRoot
$start=[Environment]::TickCount64;$appEnd=[DateTimeOffset]::Parse('2026-10-18T17:06:32.0610711Z');$remaining=[long]($appEnd-[DateTimeOffset]::UtcNow).TotalMilliseconds
if($remaining-le1000){throw 'fixed App endpoint reached'};$end=$start+[Math]::Min(60000,$remaining);$work=[Math]::Min($start+45000,$end-1000)
$node='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
if((Get-FileHash $node).Hash.ToLowerInvariant()-cne'0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'){throw 'pinned Node drift'}
$innerHost=[Environment]::ProcessPath;if($innerHost-cne'C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'){throw 'explicit CIFI host required'}
$argsFixed=@((Join-Path $root $(if($Phase-eq'RED'){'tests\cleanup-red.test.mjs'}else{'tests\operations.test.mjs'})))
if($Phase-eq'SYNTAX_OPERATIONS'){$argsFixed=@('--check',(Join-Path $root 'src\photo-operations.mjs'))}
if($Phase-eq'SYNTAX_SESSION'){$argsFixed=@('--check',(Join-Path $root 'src\session.mjs'))}
if($Phase-eq'SYNTAX_TESTS'){$argsFixed=@('--check',(Join-Path $root 'tests\operations.test.mjs'))}
if($Phase-eq'PARSE_MAIN'){$argsFixed=@((Join-Path $root 'parse-main.mjs'))}
function NewText($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes($value);$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b)}finally{$f.Dispose()}}
$original=Get-Content -LiteralPath (Join-Path $root 'ORIGINAL_INPUTS.json') -Raw|ConvertFrom-Json
$paths=@((Get-ChildItem -LiteralPath $root -Recurse -File).FullName)+@($original.path)+@($node,$innerHost)
if($Phase-eq'PARSE_MAIN'){$q=Get-Content -LiteralPath (Join-Path $root 'TYPESCRIPT_PARSER.json') -Raw|ConvertFrom-Json;$paths+=@($q.path,$q.packagePath)}
$before=@(foreach($p in $paths|Sort-Object -Unique){@{path=$p;bytes=([IO.FileInfo]$p).Length;sha256=(Get-FileHash $p).Hash.ToLowerInvariant()}})
NewText ($Phase+$Tag+'_COMMAND.json') (([ordered]@{executable=$node;arguments=$argsFixed;workingDirectory=$root;mode=$(if($Phase-eq'PARSE_MAIN'){'qualified TypeScript createSourceFile only; no resolve/import/emit'}else{'direct Node in-process node:test; no --test or product imports'});innerHost=$innerHost;selectedInputs=$before;startTick=$start;workEnd=$work;hardEnd=$end;appEnd=$appEnd.ToString('o')}|ConvertTo-Json -Depth 7)+[Environment]::NewLine)
$p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new();$p.StartInfo.FileName=$node;foreach($a in $argsFixed){$p.StartInfo.ArgumentList.Add($a)};$p.StartInfo.WorkingDirectory=$root;$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
foreach($n in @('NODE_OPTIONS','NODE_PATH')){[void]$p.StartInfo.Environment.Remove($n)}
$terminal=$false;$closed=$false;$streams=$false;$kill=$false;$exit=$null;$out='';$err='';$h=$null;$ownedId=$null;$created=$null
try{
 if(-not$p.Start()){throw 'owned verification start failed'};$h=$p.SafeHandle;$ownedId=$p.Id;$created=$p.StartTime.ToFileTimeUtc().ToString();$o=$p.StandardOutput.ReadToEndAsync();$e=$p.StandardError.ReadToEndAsync()
 $terminal=$p.WaitForExit([int][Math]::Max(0,$work-[Environment]::TickCount64))
 if(-not$terminal){$kill=$true;$p.Kill();$terminal=$p.WaitForExit([int][Math]::Max(0,$end-[Environment]::TickCount64))}
 if($terminal){$exit=$p.ExitCode;$streams=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($o,$e),[int][Math]::Max(0,$end-[Environment]::TickCount64));if($streams){$out=$o.Result;$err=$e.Result}}
}finally{$p.Dispose();$closed=$null-ne$h-and$h.IsClosed}
$unchanged=$true;foreach($f in $before){if(-not[IO.File]::Exists($f.path)-or([IO.FileInfo]$f.path).Length-ne$f.bytes-or(Get-FileHash $f.path).Hash.ToLowerInvariant()-cne$f.sha256){$unchanged=$false}}
$finish=[Environment]::TickCount64;$bounded=$out.Length-le131072-and$err.Length-le131072
NewText ($Phase+$Tag+'_STDOUT.txt') $out;NewText ($Phase+$Tag+'_STDERR.txt') $err
$result=[ordered]@{phase=$Phase;exitCode=$exit;ownedProcessId=$ownedId;ownedCreationFileTimeUtc=$created;terminalSignaled=$terminal;streamsComplete=$streams;actualHandleClosed=$closed;killAttempted=$kill;elapsedMs=$finish-$start;withinDeadline=$finish-le$end;withinAppEnd=[DateTimeOffset]::UtcNow-lt$appEnd;outputBounded=$bounded;selectedInputs=$before.Count;selectedInputsUnchanged=$unchanged;sourceOnly=$true;gpuRendererMainImports=0;productionExecutions=0}
NewText ($Phase+$Tag+'_RESULT.json') (($result|ConvertTo-Json -Depth 6)+[Environment]::NewLine);$result|ConvertTo-Json -Compress
$out-split'\r?\n'|Where-Object{$_-match'^# (tests|pass|fail)|^not ok|^# duration'}|Select-Object -Last 20
if(-not$terminal-or-not$streams-or-not$closed-or-not$unchanged-or-not$bounded-or$finish-gt$end){exit 2};exit $exit
