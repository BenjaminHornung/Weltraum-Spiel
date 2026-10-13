param([ValidateSet('code','serve','seal')][string]$Mode='code')
$ErrorActionPreference='Stop'
$rtNode='C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe'
Push-Location $PSScriptRoot
try {
  if(-not (Get-Location).Path.StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase)){throw 'Executable work must stay under C:\IFI_SourceCode'}
  if($Mode -eq 'serve'){& $rtNode server.mjs;exit $LASTEXITCODE}
  if($Mode -eq 'seal'){& $rtNode seal.mjs verify;exit $LASTEXITCODE}
  $rtEvidence=Join-Path $PSScriptRoot '../../.devtoolbox/specs/changes/rt-02a-2026-10-09/tests'
  $rtRunId=[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
  $rtRuns=@()
  foreach($rtStep in @(@{name='input-consume';args=@('import-inputs.mjs')},@{name='build-typecheck';args=@('node_modules/typescript/bin/tsc','-p','tsconfig.json')},@{name='unchanged-control';args=@('tests/control.mjs')},@{name='cpu-bvh-negatives';args=@('tests/bvh.test.mjs')},@{name='compute-pack-emission';args=@('tests/compute.mjs')})) {
    $rtLog=Join-Path $rtEvidence "$rtRunId-$($rtStep.name).log"
    $rtOutput=& $rtNode @($rtStep.args) 2>&1
    $rtExit=$LASTEXITCODE
    $rtOutput | Set-Content -LiteralPath $rtLog
    $rtRuns+=@{name=$rtStep.name;executable=$rtNode;arguments=$rtStep.args;cwd=$PSScriptRoot;exitCode=$rtExit;log=$rtLog;timeUtc=[DateTime]::UtcNow.ToString('o')}
    $rtRuns | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $rtEvidence "$rtRunId-commands.json")
    Write-Output "$($rtStep.name): exit $rtExit"
    if($rtExit -ne 0){exit $rtExit}
  }
} finally {Pop-Location}
