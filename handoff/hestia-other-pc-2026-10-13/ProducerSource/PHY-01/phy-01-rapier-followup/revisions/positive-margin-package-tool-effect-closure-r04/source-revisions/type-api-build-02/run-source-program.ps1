param([Parameter(Mandatory=$true)][ValidateSet('prepare-source-01','type-api-build-01','type-api-build-02')][string]$RunId)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$preflightPath=Join-Path $root ('preflights/'+$RunId+'.json')
$preflight=Get-Content -LiteralPath $preflightPath -Raw|ConvertFrom-Json
$plan=@($preflight.programmes|Where-Object {$_.runId -eq $RunId})
if($plan.Count -ne 1){throw 'UNBOUND_PROGRAMME'}
$plan=$plan[0]
function Sha([string]$path){[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([IO.File]::ReadAllBytes($path))).ToLowerInvariant()}
foreach($inputRow in $plan.inputs){
    $path=$inputRow.path
    $item=Get-Item -LiteralPath $path
    if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.Length -ne $inputRow.bytes -or (Sha $path) -ne $inputRow.sha256){throw "PRELAUNCH_INPUT_MISMATCH $path"}
}
$run=Join-Path $root ('raw/'+$RunId)
if(Test-Path -LiteralPath ($run+'.receipt.json')){throw 'RUN_ID_EXISTS'}
[IO.Directory]::CreateDirectory((Join-Path $root 'raw'))|Out-Null
[IO.Directory]::CreateDirectory((Join-Path $root 'temp/'+$RunId))|Out-Null
$psi=[Diagnostics.ProcessStartInfo]::new()
$psi.FileName=$plan.binary.path
$psi.WorkingDirectory=$root
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$true
$psi.RedirectStandardOutput=$true
$psi.RedirectStandardError=$true
$psi.StandardOutputEncoding=[Text.Encoding]::UTF8
$psi.StandardErrorEncoding=[Text.Encoding]::UTF8
foreach($arg in $plan.argv){$psi.ArgumentList.Add([string]$arg)}
foreach($name in @('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_ENV','NODE_INSPECTOR_IPC','TS_GO_DEBUG_STACK_LIMIT')){$psi.Environment.Remove($name)|Out-Null}
foreach($name in @('TEMP','TMP','TMPDIR')){$psi.Environment[$name]=(Join-Path $root ('temp/'+$RunId))}
$process=[Diagnostics.Process]::new()
$process.StartInfo=$psi
$start=[DateTime]::UtcNow
$launched=$false;$timedOut=$false;$exitCode=$null;$end=$null;$spawnError=$null
try {
    $launched=$process.Start()
    $out=$process.StandardOutput.ReadToEndAsync()
    $err=$process.StandardError.ReadToEndAsync()
    if($process.WaitForExit(60000)){
        $process.WaitForExit()
        $exitCode=$process.ExitCode
        $stdout=$out.GetAwaiter().GetResult()
        $stderr=$err.GetAwaiter().GetResult()
        $end=[DateTime]::UtcNow.ToString('o')
    } else {
        $timedOut=$true;$stdout='';$stderr='DEADLINE_HOLD: child not killed; output tasks remain incomplete.'
    }
} catch {
    $spawnError=$_.Exception.Message;$stdout='';$stderr=$spawnError
    $end=[DateTime]::UtcNow.ToString('o')
}
function WriteNew([string]$path,[string]$text){$b=[Text.Encoding]::UTF8.GetBytes($text);$f=[IO.File]::Open($path,[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
WriteNew ($run+'.stdout.log') $stdout
WriteNew ($run+'.stderr.log') $stderr
$receipt=[ordered]@{
    schema='hestia.phy01.r04.source-programme.v1';runId=$RunId;binary=$plan.binary;argv=$plan.argv;cwd=$root;
    start=$start.ToString('o');endObserved=$end;deadlineMs=60000;launched=$launched;exitCode=$exitCode;
    timeout=$timedOut;spawnError=$spawnError;physicsExecuted=$false;wasmEvaluated=$false;candidateModulesLoaded=$false;
    environment='inherited Windows environment; named Node hooks and TS_GO_DEBUG_STACK_LIMIT removed only in child; temp only in R04';
    stdout=[ordered]@{path=$RunId+'.stdout.log';sha256=Sha ($run+'.stdout.log')};
    stderr=[ordered]@{path=$RunId+'.stderr.log';sha256=Sha ($run+'.stderr.log')};
    preflightSha256=Sha $preflightPath
}
WriteNew ($run+'.receipt.json') (($receipt|ConvertTo-Json -Depth 10)+[Environment]::NewLine)
([pscustomobject]$receipt)|ConvertTo-Json -Depth 8
if($timedOut -or $spawnError){exit 90}
if($exitCode -ne 0){exit $exitCode}
