$ErrorActionPreference='Stop'
$rows=@();$errorsTotal=0
foreach($name in @('root-handoff.ps1','root-contract.ps1','qualify.ps1','observe.ps1','supervise.ps1','compile-only-reviewed.ps1','verify-source.ps1','preservation-check.ps1','source-metadata.ps1')){
 $tokens=$null;$errors=$null;$a=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $name),[ref]$tokens,[ref]$errors);$errorsTotal+=@($errors).Count
 $rows+=[ordered]@{path=$name;sha256=(Get-FileHash (Join-Path $PSScriptRoot $name)).Hash.ToLowerInvariant();parseErrors=@($errors|ForEach-Object Message);executed=$false}
 if($name-in@('qualify.ps1','observe.ps1','supervise.ps1')){
  $s=$a.Extent.Text;$gate=$s.IndexOf('$admitted=$verifier.VerifyPowerShellEntry');$verify=$s.IndexOf('VerifyIndependentRootProof($admitted)');$late=$s.IndexOf('VerifyLateLoaderProof($admitted)');$loader=$s.IndexOf('[Reflection.Assembly]::LoadFrom($dll)');$invoke=$s.IndexOf('$result=[Hestia.M5.Native24Source.Native24Family]::')
  if($gate-lt0-or$verify-le$gate-or$late-le$verify-or$loader-le$late-or$invoke-le$loader-or-not$s.Contains('exit $result')){throw 'actual gate/verify/loader/native/exit AST order'}
 }
}
$v=[ordered]@{errors=$errorsTotal;fixedEntries=3;rows=$rows;parsedOnly=$true;productionInvocations=0}
$b=[Text.UTF8Encoding]::new($false).GetBytes(($v|ConvertTo-Json -Depth 8));$f=[IO.File]::Open((Join-Path $PSScriptRoot 'STATIC_AST_ENGINE_RESULT.json'),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()};$v|ConvertTo-Json -Depth 8 -Compress
if($errorsTotal){exit 1}
