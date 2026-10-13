param([string]$RunId = ('repro-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')))
$ErrorActionPreference = 'Stop'
$node = 'C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
Push-Location -LiteralPath $PSScriptRoot
try {
    & $node repro.mjs $RunId
    $result = $LASTEXITCODE
} finally { Pop-Location }
exit $result
