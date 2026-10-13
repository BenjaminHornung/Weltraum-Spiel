param([Parameter(Mandatory=$true)][ValidatePattern('^(static-input|literal-proof)-[0-9]{2}$')][string]$RunId)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$preflightPath=Join-Path $root ('preflights/'+$RunId+'.json')
$plan=Get-Content -LiteralPath $preflightPath -Raw|ConvertFrom-Json
function Sha([string]$p){[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($p))).ToLowerInvariant()}
foreach($row in $plan.inputs){$item=Get-Item -LiteralPath $row.path;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $row.bytes -or (Sha $row.path) -ne $row.sha256){throw "PRELAUNCH_BYTES_DRIFT $($row.path)"}}
$raw=Join-Path $root ('raw/'+$RunId)
if(Test-Path -LiteralPath ($raw+'.receipt.json')){throw 'RUN_ID_ALREADY_USED'}
foreach($name in @('raw','results',('temp/'+$RunId))){[IO.Directory]::CreateDirectory((Join-Path $root $name))|Out-Null}
$psi=[Diagnostics.ProcessStartInfo]::new()
$psi.FileName=$plan.binary.path;$psi.WorkingDirectory=$root
$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true
$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
$psi.StandardOutputEncoding=[Text.Encoding]::UTF8;$psi.StandardErrorEncoding=[Text.Encoding]::UTF8
foreach($arg in $plan.argv){$psi.ArgumentList.Add([string]$arg)}
foreach($name in @('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_ENV','NODE_INSPECTOR_IPC')){$psi.Environment.Remove($name)|Out-Null}
foreach($name in @('TEMP','TMP','TMPDIR')){$psi.Environment[$name]=(Join-Path $root ('temp/'+$RunId))}
$process=[Diagnostics.Process]::new();$process.StartInfo=$psi
$start=[DateTime]::UtcNow.ToString('o');$end=$null;$exitCode=$null;$errorMessage=$null;$timeout=$false;$launched=$false
try{
 $launched=$process.Start();$out=$process.StandardOutput.ReadToEndAsync();$err=$process.StandardError.ReadToEndAsync()
 if($process.WaitForExit(60000)){$process.WaitForExit();$exitCode=$process.ExitCode;$stdout=$out.GetAwaiter().GetResult();$stderr=$err.GetAwaiter().GetResult();$end=[DateTime]::UtcNow.ToString('o')}
 else{$timeout=$true;$stdout='';$stderr='DEADLINE_HOLD; no kill; output tasks remain incomplete'}
}catch{$errorMessage=$_.Exception.Message;$stdout='';$stderr=$errorMessage;$end=[DateTime]::UtcNow.ToString('o')}
function NewText([string]$p,[string]$s){$b=[Text.Encoding]::UTF8.GetBytes($s);$f=[IO.File]::Open($p,[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
NewText ($raw+'.stdout.log') $stdout
NewText ($raw+'.stderr.log') $stderr
$receipt=[ordered]@{schema='hestia.phy01.r05.pure-data-programme.v1';runId=$RunId;binary=$plan.binary;argv=$plan.argv;cwd=$root;start=$start;endObserved=$end;deadlineMs=60000;launched=$launched;exitCode=$exitCode;timeout=$timeout;spawnError=$errorMessage;
 preflightSha256=Sha $preflightPath;stdout=[ordered]@{path=$RunId+'.stdout.log';sha256=Sha ($raw+'.stdout.log')};stderr=[ordered]@{path=$RunId+'.stderr.log';sha256=Sha ($raw+'.stderr.log')};
 effects='opaque byte/Source text decoding and static graph analysis only; child Node hooks removed; own temp/results/raw only';descriptorStarts=0;cliStarts=0;wasmEvaluation=0;physicsStarts=0;hostQueries=0;timeoutIsFuel=$false}
NewText ($raw+'.receipt.json') (($receipt|ConvertTo-Json -Depth 12)+[Environment]::NewLine)
([pscustomobject]$receipt)|ConvertTo-Json -Depth 10
if($timeout -or $errorMessage){exit 90}
if($exitCode -ne 0){exit $exitCode}
