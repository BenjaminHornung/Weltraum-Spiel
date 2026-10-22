$ErrorActionPreference='Stop'
$r=$PSScriptRoot;$start=[Environment]::TickCount64;$work=$start+25000;$end=$start+30000
$node='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
if((Get-FileHash $node).Hash.ToLowerInvariant()-cne'0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'){throw 'node pin'}
function NewJson($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10));$f=[IO.File]::Open((Join-Path $r $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$files=@(Get-ChildItem -LiteralPath $r -File -Filter '*.mjs'|Sort-Object Name)
$before=@(foreach($f in $files){@{path=$f.FullName;bytes=$f.Length;sha256=(Get-FileHash $f.FullName).Hash.ToLowerInvariant()}})
NewJson 'SYNTAX_ALL_COMMAND.json' @{executable=$node;arguments='--check <each fixed .mjs below>';selectedInputs=$before;workEnd=$work;overallEnd=$end}
$results=@()
foreach($f in $files){
 if([Environment]::TickCount64-ge$work){throw 'syntax work end'}
 $p=[Diagnostics.Process]::new();$p.StartInfo=[Diagnostics.ProcessStartInfo]::new();$p.StartInfo.FileName=$node;$p.StartInfo.ArgumentList.Add('--check');$p.StartInfo.ArgumentList.Add($f.FullName);$p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true
 foreach($n in @('NODE_OPTIONS','NODE_PATH')){[void]$p.StartInfo.Environment.Remove($n)}
 $h=$null;$closed=$false;$terminal=$false;$streams=$false;$code=$null;$out='';$err=''
 try{if(-not$p.Start()){throw 'syntax host start'};$h=$p.SafeHandle;$id=$p.Id;$o=$p.StandardOutput.ReadToEndAsync();$e=$p.StandardError.ReadToEndAsync();$terminal=$p.WaitForExit([int][Math]::Max(0,$work-[Environment]::TickCount64));if(-not$terminal){$p.Kill();$terminal=$p.WaitForExit([int][Math]::Max(0,$end-[Environment]::TickCount64))};if($terminal){$code=$p.ExitCode;$streams=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($o,$e),[int][Math]::Max(0,$end-[Environment]::TickCount64));if($streams){$out=$o.Result;$err=$e.Result}}}finally{$p.Dispose();$closed=$null-ne$h-and$h.IsClosed}
 $results+=@{path=$f.FullName;ownedProcessId=$id;terminalSignaled=$terminal;actualHandleClosed=$closed;streamsComplete=$streams;exitCode=$code;stdout=$out;stderr=$err}
 if(-not$terminal-or-not$streams-or-not$closed-or$code-ne0){break}
}
$unchanged=$true;foreach($f in $before){if(-not[IO.File]::Exists($f.path)-or([IO.FileInfo]$f.path).Length-ne$f.bytes-or(Get-FileHash $f.path).Hash.ToLowerInvariant()-cne$f.sha256){$unchanged=$false}}
$finish=[Environment]::TickCount64;$pass=$results.Count-eq$files.Count-and@($results|Where-Object{$_.exitCode -ne 0}).Count-eq0-and$unchanged-and$finish-le$end
NewJson 'SYNTAX_ALL_RESULT.json' @{pass=$pass;checked=$results.Count;elapsedMs=$finish-$start;withinDeadline=$finish-le$end;inputsUnchanged=$unchanged;results=$results;productionExecutions=0}
@{pass=$pass;checked=$results.Count;elapsedMs=$finish-$start;inputsUnchanged=$unchanged;productionExecutions=0}|ConvertTo-Json -Compress
if(-not$pass){exit 1}
