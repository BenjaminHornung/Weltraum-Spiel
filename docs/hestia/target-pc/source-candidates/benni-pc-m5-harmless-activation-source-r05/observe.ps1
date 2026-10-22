[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RequestPath)
$ErrorActionPreference='Stop'
$packagePath='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13\M5_HARMLESS_REVIEWED_PACKAGE.json'
$fixedRoot='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05'
if(-not[IO.File]::Exists($packagePath)){throw 'DATA_HOLD:Root package unissued'}
$package=[IO.File]::ReadAllText($packagePath)|ConvertFrom-Json -AsHashtable
if($package.schema-cne'hestia.m5.package.v1'-or$package.version-cne'1'-or$package.sourceRoot-cne$fixedRoot){throw 'DATA_HOLD:fixed Root package'}
$pins=Join-Path $fixedRoot 'QUAL_SOURCE_PINS.tsv'
if((Get-FileHash -LiteralPath $pins).Hash.ToLowerInvariant()-cne$package.packagePinsSha256){throw 'DATA_HOLD:independent expected source pins'}
$helper=Join-Path $fixedRoot 'root-contract.ps1'
$pin=@([IO.File]::ReadAllLines($pins)|Where-Object{$_ -like ('ACTIVATION_SOURCE:root-contract.ps1'+[char]9+'*')})
if($pin.Count-ne1){throw 'DATA_HOLD:one fixed contract pin'}
$v=$pin[0].Split([char]9)
if($v.Count-ne4-or$v[1]-cne$helper-or([IO.FileInfo]$helper).Length-ne[long]$v[2]-or(Get-FileHash -LiteralPath $helper).Hash.ToLowerInvariant()-cne$v[3]){throw 'DATA_HOLD:fixed contract bytes'}
. 'C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-harmless-activation-source-r05\root-contract.ps1'

$verifier=Get-ExternalRootRuntimeVerifier
$admitted=$verifier.VerifyPowerShellEntry('Observer',$RequestPath)
Need ($verifier.VerifyIndependentRootProof($admitted)) 'independent proof before loader'
$verifier.VerifyCurrentPhase($admitted,'powershell-before-loader')
$dll=Join-Path $script:FixedSourceRoot 'HarmlessActivation.dll'
Need ((Sha $dll)-ceq$admitted.Root.Package.dllSha256) 'fixed expected DLL'
$verifier.VerifyCurrentPhase($admitted,'powershell-immediately-before-loader')
$verifier.VerifyLateLoaderProof($admitted)
[void][Reflection.Assembly]::LoadFrom($dll)
$verifier.VerifyCurrentPhase($admitted,'powershell-after-loader')
$result=[Hestia.M5.Native24Source.Native24Family]::ObserveHarmlessQualification($RequestPath,$admitted.Raw.Line)
exit $result
