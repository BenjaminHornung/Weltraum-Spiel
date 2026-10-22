$ErrorActionPreference='Stop'
$root=$PSScriptRoot
$source=Join-Path $root 'Native24Family.cs'
$companion=Join-Path $root 'HarmlessQualification.cs'
$admission=Join-Path $root 'ActivationAdmission.cs'
$verifier=Join-Path $root 'RootRuntimeVerifier.cs'
$protocol=Join-Path $root 'SubjectProtocol.cs'
$registry=Join-Path $root 'RootSubjectRegistry.cs'
$client=Join-Path $root 'RootSubjectClient.cs'
$rootHostSource=Join-Path $root 'RootHost.cs'
$output=Join-Path $root 'HarmlessActivation.dll'
if(Test-Path $output){throw 'Fresh emit output required'}
function NewJson($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 8));$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$before=@([AppDomain]::CurrentDomain.GetAssemblies()|ForEach-Object{if(-not $_.IsDynamic){$_.Location}}|Sort-Object -CaseSensitive)
NewJson 'COMPILE_FINAL_ASSEMBLIES_BEFORE.json' $before
$diagnostic=$null
try{Add-Type -LiteralPath @($source,$companion,$admission,$verifier,$protocol,$registry,$client,$rootHostSource) -OutputAssembly $output -OutputType Library -ErrorAction Stop}catch{$diagnostic=$_.ToString()}
$after=@([AppDomain]::CurrentDomain.GetAssemblies()|ForEach-Object{if(-not $_.IsDynamic){$_.Location}}|Sort-Object -CaseSensitive)
NewJson 'COMPILE_FINAL_ASSEMBLIES_AFTER.json' $after
$loaded=@($after|Where-Object{[String]::Equals($_,$output,[StringComparison]::OrdinalIgnoreCase)}).Count -ne 0
$result=[ordered]@{sourceSha256=(Get-FileHash $source).Hash.ToLowerInvariant();companionSha256=(Get-FileHash $companion).Hash.ToLowerInvariant();admissionSha256=(Get-FileHash $admission).Hash.ToLowerInvariant();verifierSha256=(Get-FileHash $verifier).Hash.ToLowerInvariant();protocolSha256=(Get-FileHash $protocol).Hash.ToLowerInvariant();registrySha256=(Get-FileHash $registry).Hash.ToLowerInvariant();clientSha256=(Get-FileHash $client).Hash.ToLowerInvariant();hostSha256=(Get-FileHash $rootHostSource).Hash.ToLowerInvariant();output=$output;outputExists=(Test-Path $output);diagnostic=$diagnostic;generatedAssemblyLoaded=$loaded;passThru=$false;nativeMethodsInvoked=0;assemblyBeforeCount=$before.Count;assemblyAfterCount=$after.Count}
if($result.outputExists){$result.outputBytes=(Get-Item $output).Length;$result.outputSha256=(Get-FileHash $output).Hash.ToLowerInvariant()}
NewJson 'COMPILE_FINAL_ENGINE_RESULT.json' $result
$result|ConvertTo-Json -Compress
if($diagnostic-or$loaded-or-not$result.outputExists){exit 1}
