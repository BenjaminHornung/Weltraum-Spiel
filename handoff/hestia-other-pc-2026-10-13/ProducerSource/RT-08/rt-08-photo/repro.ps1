param([switch]$Rerun)
$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$rtNode='C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
& $rtNode seal.mjs --verify
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
if($Rerun){
 $rtLabel=(Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')
 foreach($rtKind in @('inputs','control','typecheck','build','test')){
  & $rtNode check.mjs $rtKind "$rtKind-repro-$rtLabel"
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
 }
 Write-Output 'Fresh diagnostic evidence written; old complete evidence seal now intentionally requires re-review/reseal.'
}
exit 0
