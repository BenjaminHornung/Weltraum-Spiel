param([ValidateSet('code','verify','serve')][string]$Mode='code',[int]$Port=8736)
$ErrorActionPreference='Stop'
$spikeRoot=$PSScriptRoot
$nodeExe='C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
if (!(Test-Path -LiteralPath $nodeExe) -or !$spikeRoot.StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Approved local tooling/worktree required' }
Push-Location -LiteralPath $spikeRoot
try {
 if ($Mode -eq 'verify') { & $nodeExe seal.mjs verify; exit $LASTEXITCODE }
 if ($Mode -eq 'serve') { & $nodeExe seal.mjs verify; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; & $nodeExe serve.mjs $Port; exit $LASTEXITCODE }
 & $nodeExe run-code.mjs
 exit $LASTEXITCODE
} finally { Pop-Location }
