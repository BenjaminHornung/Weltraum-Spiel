$ErrorActionPreference='Stop'
$rtRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$rtGit='C:\IFI_SourceCode\Utils\opencode-migration\runtime\git\cmd\git.exe'
function Invoke-RtGit([string[]]$Arguments){$rtOutput=& $rtGit --no-optional-locks -C $rtRoot @Arguments; if($LASTEXITCODE -ne 0){throw "Git failed: $Arguments exit $LASTEXITCODE"};return ($rtOutput -join "`n")}
$rtIdentity=@{head=Invoke-RtGit -Arguments @('rev-parse','HEAD');branch=Invoke-RtGit -Arguments @('branch','--show-current');indexRows=Invoke-RtGit -Arguments @('ls-files','--stage');statusRaw=Invoke-RtGit -Arguments @('status','--porcelain=v1','-z','--untracked-files=all');stagedDiff=Invoke-RtGit -Arguments @('diff','--cached','--name-only');gitVersion=Invoke-RtGit -Arguments @('--version')}
if($rtIdentity.head -ne '17b1db4201a28e7b607c30707bdc2b75e3484a10' -or $rtIdentity.branch -ne 'feature/rt-02a-2026-10-09'){throw 'Worktree identity drift'}
$rtIdentity.gitDirectory=Invoke-RtGit -Arguments @('rev-parse','--absolute-git-dir')
$rtIdentity.indexFile=Join-Path $rtIdentity.gitDirectory 'index'
$rtIdentity.indexSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $rtIdentity.indexFile).Hash.ToLowerInvariant()
$rtIdentity.headFile=Join-Path $rtIdentity.gitDirectory 'HEAD'
$rtIdentity.headFileSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $rtIdentity.headFile).Hash.ToLowerInvariant()
$rtCommon=Invoke-RtGit -Arguments @('rev-parse','--git-common-dir')
if(-not [IO.Path]::IsPathRooted($rtCommon)){$rtCommon=[IO.Path]::GetFullPath((Join-Path $rtRoot $rtCommon))}
$rtIdentity.refFile=Join-Path $rtCommon 'refs/heads/feature/rt-02a-2026-10-09'
if(-not (Test-Path -LiteralPath $rtIdentity.refFile)){throw 'Loose assigned branch ref unavailable; rebind resolved identity before sealing'}
if((Get-Content -Raw -LiteralPath $rtIdentity.refFile).Trim() -ne $rtIdentity.head){throw 'Resolved branch target drift'}
$rtIdentity.refFileSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $rtIdentity.refFile).Hash.ToLowerInvariant()
$rtIdentity.timeUtc=[DateTime]::UtcNow.ToString('o')
$rtIdentity | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot '../../.devtoolbox/specs/changes/rt-02a-2026-10-09/tests/git-final.json')
Write-Output 'Git identity/index/dirty inventory recorded; no index, commit or product content changed.'
