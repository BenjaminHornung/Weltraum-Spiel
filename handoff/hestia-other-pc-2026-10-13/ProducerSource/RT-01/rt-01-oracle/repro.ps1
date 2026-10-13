param(
  [string]$Node = 'C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe',
  [string]$Compiler = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-CutV3-Resume-2026-10-05\apps\weltraum-browser\node_modules\typescript\lib\tsc.js'
)
$ErrorActionPreference = 'Stop'
if (-not ([IO.Path]::GetFullPath($PSScriptRoot).StartsWith('C:\IFI_SourceCode\', [StringComparison]::OrdinalIgnoreCase))) { throw 'Run only from C:\IFI_SourceCode' }
Push-Location -LiteralPath $PSScriptRoot
try {
  & $Node $Compiler -p tsconfig.json
  if ($LASTEXITCODE -ne 0) { throw "Typecheck failed: $LASTEXITCODE" }
  & $Node $Compiler -p tsconfig.json --noEmit false --outDir .build --rewriteRelativeImportExtensions true
  if ($LASTEXITCODE -ne 0) { throw "Build failed: $LASTEXITCODE" }
  $testFiles = @(Get-ChildItem -LiteralPath tests -Filter '*.test.mjs' -File | Sort-Object Name | ForEach-Object { $_.FullName })
  & $Node --test @testFiles
  if ($LASTEXITCODE -ne 0) { throw "Tests failed: $LASTEXITCODE" }
  & $Node export.mjs --verify
  if ($LASTEXITCODE -ne 0) { throw "Frozen fixtures failed: $LASTEXITCODE" }
  & $Node seal.mjs --verify
  if ($LASTEXITCODE -ne 0) { throw "Source binding failed: $LASTEXITCODE" }
} finally { Pop-Location }
