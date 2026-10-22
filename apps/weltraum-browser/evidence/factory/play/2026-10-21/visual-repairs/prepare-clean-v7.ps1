$ErrorActionPreference = 'Stop'
$taskSource = 'E:\DEV\Weltraum-Spiel\FP06-Candidate'
$taskTarget = 'E:\DEV\Weltraum-Spiel\FP06-Ready-2026-10-21-v7'
if (Test-Path -LiteralPath $taskTarget) { throw 'Fresh delivery destination already exists' }
$taskManifest = Get-Content -LiteralPath 'E:\DEV\Weltraum-Spiel\FP06-Ready-2026-10-21-v4\DELIVERY_MANIFEST.json' -Raw | ConvertFrom-Json
$taskPaths = @($taskManifest.sourceAndEvidence.path)
$taskPaths += @(Get-ChildItem -LiteralPath "$taskSource\art\factory\play-distribution-surface-v2-2026-10-21" -File | ForEach-Object { [IO.Path]::GetRelativePath($taskSource, $_.FullName) })
$taskPaths += @('apps/weltraum-browser/src/factory/presentation/factoryDecorProjection.ts', 'apps/weltraum-browser/src/factory/presentation/batchPlayParts.ts', 'apps/weltraum-browser/src/factory/presentation/factoryMaterialProjection.ts', 'apps/weltraum-browser/public/factory/play-2026-10-12/distribution-v2.glb', 'apps/weltraum-browser/public/factory/play-2026-10-12/manifest-distribution-surface-v2.json')
$taskPaths += @(Get-ChildItem -LiteralPath "$taskSource\docs\factory\fp06\play\2026-10-21\visual-repairs" -File | ForEach-Object { [IO.Path]::GetRelativePath($taskSource, $_.FullName) })
$taskPaths += @(Get-ChildItem -LiteralPath "$taskSource\apps\weltraum-browser\evidence\factory\play\2026-10-21\visual-repairs" -File | Where-Object { $_.Extension -in @('.png','.mjs','.md','.json','.ps1') -and $_.Name -ne 'CLEAN_V7_SOURCE.json' } | ForEach-Object { [IO.Path]::GetRelativePath($taskSource, $_.FullName) })
$taskPaths += @(Get-ChildItem -LiteralPath "$taskSource\art\factory\play-storage-surface-v2-2026-10-21" -File | ForEach-Object { [IO.Path]::GetRelativePath($taskSource, $_.FullName) })
$taskPaths += @('apps/weltraum-browser/public/factory/play-2026-10-12/storage-v2.glb', 'apps/weltraum-browser/public/factory/play-2026-10-12/storage-open-v2.glb', 'apps/weltraum-browser/public/factory/play-2026-10-12/manifest-storage-surface-v2.json')
$taskRecords = foreach ($taskRelative in @($taskPaths | Sort-Object -Unique)) {
    $taskFrom = [IO.Path]::GetFullPath([IO.Path]::Combine($taskSource, $taskRelative))
    $taskTo = [IO.Path]::GetFullPath([IO.Path]::Combine($taskTarget, $taskRelative))
    if (-not $taskFrom.StartsWith($taskSource + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $taskTo.StartsWith($taskTarget + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Copy path escapes the exact source/destination' }
    if (-not (Test-Path -LiteralPath $taskFrom -PathType Leaf)) { throw "Missing exact source: $taskRelative" }
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($taskTo))
    Copy-Item -LiteralPath $taskFrom -Destination $taskTo
    $taskHash = (Get-FileHash -LiteralPath $taskFrom -Algorithm SHA256).Hash.ToLowerInvariant()
    if ((Get-FileHash -LiteralPath $taskTo -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskHash) { throw "Copy parity failed: $taskRelative" }
    [ordered]@{path=$taskRelative.Replace('\','/');bytes=(Get-Item -LiteralPath $taskTo).Length;sha256=$taskHash}
}
$taskReceipt = [ordered]@{schema='hestia.fp06.clean-staging/v1';atUtc=[DateTimeOffset]::UtcNow.ToString('o');source=$taskSource;destination=$taskTarget;status='EXACT_SOURCE_COPY_BUILD_AND_RUNTIME_PENDING';fileCount=@($taskRecords).Count;files=@($taskRecords)}
$taskReceipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath "$taskSource\apps\weltraum-browser\evidence\factory\play\2026-10-21\visual-repairs\CLEAN_V7_SOURCE.json" -Encoding utf8NoBOM
[ordered]@{destination=$taskTarget;copied=@($taskRecords).Count;status=$taskReceipt.status} | ConvertTo-Json
