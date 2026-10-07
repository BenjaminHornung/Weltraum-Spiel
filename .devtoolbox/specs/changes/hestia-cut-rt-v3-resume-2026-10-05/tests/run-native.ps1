param([Parameter(Mandatory)][string]$Phase)
$ErrorActionPreference = 'Stop'
if ($Phase -notmatch '^A0[0-8]-[a-z0-9-]+$') { throw 'Invalid task run ID.' }
$plan = Get-Content -LiteralPath (Join-Path $PSScriptRoot ($Phase + '.plan.json')) -Raw | ConvertFrom-Json
$files = @($plan.files)
if ($plan.diagnosticTrace -eq $true) { $env:WELTRAUM_A02_TRACE = '1' }
if ($plan.cpuProfile -eq $true) { $env:WELTRAUM_A02_CPU_PROFILE = '1' }
$started = [DateTimeOffset]::UtcNow.ToString('o')
$clock = [Diagnostics.Stopwatch]::StartNew()
& 'C:\IFI_SourceCode\Utils\Python\cpython-3.12.13-windows-x86_64-none\python.exe' (Join-Path $PSScriptRoot 'native_receipt.py') $Phase $plan.binding $plan.mode @files 1> (Join-Path $PSScriptRoot ($Phase + '.wrapper.stdout.txt')) 2> (Join-Path $PSScriptRoot ($Phase + '.wrapper.stderr.txt'))
$nativeWrapperExit = $LASTEXITCODE
$clock.Stop()
$receipt = [pscustomobject]@{runId=$Phase;startedUtc=$started;endedUtc=[DateTimeOffset]::UtcNow.ToString('o');wrapperExitCode=$nativeWrapperExit;elapsedSeconds=$clock.Elapsed.TotalSeconds;planFile=$Phase+'.plan.json'}
$receiptPath = Join-Path $PSScriptRoot ($Phase + '.wrapper.receipt.json')
if (Test-Path -LiteralPath $receiptPath) { throw 'Wrapper receipt already exists.' }
$receipt | ConvertTo-Json | Set-Content -LiteralPath $receiptPath -Encoding utf8
exit $nativeWrapperExit
