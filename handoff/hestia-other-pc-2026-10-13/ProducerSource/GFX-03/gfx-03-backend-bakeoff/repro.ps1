param([ValidateSet('code','preview','seal')][string]$Mode='code',[string]$Node='C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe',[string]$RtProducer='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-Spike-RT-01-2026-10-09')
$ErrorActionPreference='Stop'
if(-not ([IO.Path]::GetFullPath($PSScriptRoot).StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase))){throw 'Execution outside approved root'}
Push-Location -LiteralPath $PSScriptRoot
try {
  if($Mode -eq 'preview'){& $Node serve.mjs;if($LASTEXITCODE -ne 0){throw "Preview exit $LASTEXITCODE"};return}
  if($Mode -eq 'seal'){& $Node seal.mjs --verify;if($LASTEXITCODE -ne 0){throw "Seal exit $LASTEXITCODE"};return}
  & $Node import-rt.mjs $RtProducer;if($LASTEXITCODE -ne 0){throw "RT input exit $LASTEXITCODE"}
  & $Node import-hvp.mjs;if($LASTEXITCODE -ne 0){throw "HVP input exit $LASTEXITCODE"}
  & $Node node_modules/typescript/bin/tsc --noEmit;if($LASTEXITCODE -ne 0){throw "Typecheck exit $LASTEXITCODE"}
  & $Node build.mjs;if($LASTEXITCODE -ne 0){throw "Build exit $LASTEXITCODE"}
  $testFiles=@(Get-ChildItem -LiteralPath tests -Filter '*.test.mjs' -File | Sort-Object Name | ForEach-Object FullName)
  & $Node --experimental-test-isolation=none --test @testFiles;if($LASTEXITCODE -ne 0){throw "Tests exit $LASTEXITCODE"}
} finally {Pop-Location}
