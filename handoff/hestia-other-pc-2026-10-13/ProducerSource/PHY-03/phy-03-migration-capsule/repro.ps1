param([ValidateSet('Verify','Migrate','Preview','SealCheck')][string]$Mode='Verify',
  [string]$Node='C:\IFI_SourceCode\Utils\npm-tmp\opencode\node-v22.23.2-win-x64\node.exe')
$ErrorActionPreference='Stop'
$taskNode=(Get-Item -LiteralPath $Node).FullName
if(!$taskNode.StartsWith('C:\IFI_SourceCode\',[StringComparison]::OrdinalIgnoreCase)){throw 'Node must be under C:\IFI_SourceCode'}
Set-Location -LiteralPath $PSScriptRoot
$taskVersion=& $taskNode --version
if($LASTEXITCODE -ne 0 -or $taskVersion -notmatch '^v22\.'){throw 'This repro profile requires the verified Node22 runtime'}
switch($Mode){
  'Verify' {& $taskNode scripts/verify.mjs full}
  'Migrate' {& $taskNode scripts/migrate.mjs world fixtures/legacy-world.json ".runtime/world-envelope-$([Guid]::NewGuid().ToString('N')).json"}
  'Preview' {& $taskNode scripts/preview.mjs}
  'SealCheck' {& $taskNode scripts/seal.mjs --check}
}
exit $LASTEXITCODE
