$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$node = 'C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
$entry = Join-Path $root 'tests/replay-seven-day.test.mjs'
$receiptPath = Join-Path $root 'RUN_RECEIPT.json'
if (Test-Path -LiteralPath $receiptPath) { throw 'ONE_ATTEMPT_ALREADY_RECORDED' }
$nodeHash = (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant()
if ($nodeHash -ne '0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4') { throw 'NODE_PIN' }
$entryHash = (Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash.ToLowerInvariant()
$started = [DateTimeOffset]::UtcNow
$watch = [Diagnostics.Stopwatch]::StartNew()
$p = [Diagnostics.Process]::new()
$p.StartInfo.FileName = $node
$p.StartInfo.ArgumentList.Add($entry)
$p.StartInfo.WorkingDirectory = $root
$p.StartInfo.UseShellExecute = $false
$p.StartInfo.CreateNoWindow = $true
$p.StartInfo.RedirectStandardOutput = $true
$p.StartInfo.RedirectStandardError = $true
$p.StartInfo.Environment.Remove('NODE_OPTIONS') | Out-Null
$p.StartInfo.Environment.Remove('NODE_V8_COVERAGE') | Out-Null
$pidOwned = $null; $creation = $null; $safe = $null; $exitCode = $null
$timedOut = $false; $terminal = $false; $failure = $null
$stdout = ''; $stderr = ''
try {
    if (-not $p.Start()) { throw 'START_FAILED' }
    $safe = $p.SafeHandle
    $pidOwned = $p.Id
    $creation = $p.StartTime.ToUniversalTime().ToString('o')
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $errTask = $p.StandardError.ReadToEndAsync()
    if (-not $p.WaitForExit([Math]::Max(1, 48000 - [int]$watch.ElapsedMilliseconds))) {
        $timedOut = $true
        $p.Kill()
    }
    $remaining = [Math]::Max(1, 58000 - [int]$watch.ElapsedMilliseconds)
    $terminal = $p.WaitForExit($remaining)
    if (-not $terminal) { throw 'OWNED_PROCESS_TERMINAL_UNPROVEN' }
    $exitCode = $p.ExitCode
    $remaining = [Math]::Max(1, 59000 - [int]$watch.ElapsedMilliseconds)
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($outTask, $errTask), $remaining)) { throw 'STREAM_TIMEOUT' }
    $stdout = $outTask.Result
    $stderr = $errTask.Result
} catch {
    $failure = $_.Exception.Message
} finally {
    if ($null -ne $pidOwned -and -not $terminal) {
        try { if (-not $p.HasExited) { $p.Kill() }; $terminal = $p.WaitForExit([Math]::Max(1, 59500 - [int]$watch.ElapsedMilliseconds)) } catch { $failure = "$failure; cleanup: $($_.Exception.Message)" }
    }
    $p.Dispose()
}
$closed = $null -ne $safe -and $safe.IsClosed
$elapsed = $watch.ElapsedMilliseconds
$receipt = [ordered]@{
    attempt = 1; appTurn = '01a1500b-e66e-7ce1-8264-64e21e1d8d46'
    appStartedAt = '2026-10-18T17:25:19Z'; fixedDeadline = '2026-10-18T17:34:32Z'
    command = @($node, $entry); cwd = $root
    nodeSha256Before = $nodeHash; nodeSha256After = (Get-FileHash -LiteralPath $node -Algorithm SHA256).Hash.ToLowerInvariant()
    entrySha256Before = $entryHash; entrySha256After = (Get-FileHash -LiteralPath $entry -Algorithm SHA256).Hash.ToLowerInvariant()
    startedAt = $started.ToString('o'); endedAt = [DateTimeOffset]::UtcNow.ToString('o')
    ownedPid = $pidOwned; processCreatedAt = $creation; workCutoffMs = 48000; overallLimitMs = 60000
    elapsedThroughSafeHandleCloseMs = $elapsed; terminal = $terminal; exitCode = $exitCode
    safeHandleClosedAfterDispose = $closed; timedOut = $timedOut; failure = $failure
    stdout = $stdout; stderr = $stderr
    passed = ($exitCode -eq 0 -and $terminal -and $closed -and -not $timedOut -and -not $failure -and $elapsed -le 60000)
}
$bytes = [Text.Encoding]::UTF8.GetBytes(($receipt | ConvertTo-Json -Depth 6) + [Environment]::NewLine)
$stream = [IO.File]::Open($receiptPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
try { $stream.Write($bytes) } finally { $stream.Dispose() }
$receipt | ConvertTo-Json -Depth 6
if (-not $receipt.passed) { exit 1 }
