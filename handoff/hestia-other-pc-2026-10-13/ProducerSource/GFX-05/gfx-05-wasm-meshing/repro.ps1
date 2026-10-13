param([switch]$Build, [switch]$BrowserServer, [switch]$ProfileDryRun)
$ErrorActionPreference = 'Stop'
$node = 'C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
if (-not $PSScriptRoot.StartsWith('C:\IFI_SourceCode\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Executable work must stay under C:\IFI_SourceCode' }
Push-Location -LiteralPath $PSScriptRoot
try {
  & $node scripts/seal.mjs --check
  if ($LASTEXITCODE -ne 0) { throw "Seal check failed: $LASTEXITCODE" }
  if ($Build) {
    & $node scripts/build.mjs
    if ($LASTEXITCODE -ne 0) { throw "Build failed: $LASTEXITCODE" }
    & $node scripts/seal.mjs --check
    if ($LASTEXITCODE -ne 0) { throw "Rebuild byte parity failed: $LASTEXITCODE" }
  }
  & $node --test --test-concurrency=1 tests/control.test.mjs tests/parity.test.mjs tests/lifecycle.test.mjs tests/imported.test.mjs tests/worker.test.mjs tests/review-regressions.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "Function tests failed: $LASTEXITCODE" }
  if ($ProfileDryRun) { & $node scripts/profile.mjs --dry-run; if ($LASTEXITCODE -ne 0) { throw 'Profile validation failed' } }
  if ($BrowserServer) { & $node scripts/server.mjs }
} finally { Pop-Location }
