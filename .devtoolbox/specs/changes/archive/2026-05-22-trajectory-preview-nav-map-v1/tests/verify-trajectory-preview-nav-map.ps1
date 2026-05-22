$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [string] $Label,
        [Parameter(Mandatory = $true)]
        [scriptblock] $Command
    )

    Write-Host "== $Label =="
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\..")
Set-Location $root

$sourcePath = Join-Path $root "Assets\Scripts\Prototype\PrototypeTrajectoryPreviewNavMap.cs"
$hudPath = Join-Path $root "Assets\Scripts\Prototype\PrototypePlayerHud.cs"
$minimapPath = Join-Path $root "Assets\Scripts\Prototype\PrototypeMinimapOverlay.cs"
$testPath = Join-Path $root "Assets\Tests\Editor\TrajectoryPreviewPredictionTests.cs"
$protocolPath = Join-Path $PSScriptRoot "test-protocol.md"

foreach ($path in @($sourcePath, $hudPath, $minimapPath, $testPath, $protocolPath)) {
    if (-not (Test-Path $path)) {
        throw "Missing required trajectory preview artifact: $path"
    }
}

$source = Get-Content -Raw -Path $sourcePath
foreach ($required in @(
    "TrajectoryPredictor.Predict",
    "TrajectoryBurnPlan",
    "PrototypeWaypointAutopilot",
    "CopyFiniteRoutePoints",
    "MaxPreviewPointCount",
    "PrototypeTrajectoryPreviewStatus.Truncated"
)) {
    if ($source -notlike "*$required*") {
        throw "Trajectory preview source does not contain required reuse/safety token: $required"
    }
}

foreach ($forbidden in @(
    "NBody",
    "ManeuverNode",
    "PatchedConic",
    "SphereOfInfluence"
)) {
    if ($source -like "*$forbidden*") {
        throw "Trajectory preview source contains out-of-scope token: $forbidden"
    }
}

$hud = Get-Content -Raw -Path $hudPath
if ($hud -notlike "*TrajectoryPreview*" -or $hud -notlike "*HasRenderablePoints*") {
    throw "Player HUD does not expose trajectory preview route/status."
}

$minimap = Get-Content -Raw -Path $minimapPath
if ($minimap -notlike "*SetTrajectoryPreviewVisible*" -or $minimap -notlike "*DrawTrajectoryPreview*") {
    throw "Minimap does not expose trajectory preview toggle/rendering."
}

$tests = Get-Content -Raw -Path $testPath
foreach ($requiredTest in @(
    "NavMapPreviewSourcePredictsBoundedFiniteRouteWithBurnPlan",
    "NavMapPreviewFiltersNonFiniteRoutesAndSupportsDeterministicToggle",
    "PlayerHudSnapshotExposesTrajectoryPreviewRouteAndDisabledState",
    "BootstrapBindsTrajectoryPreviewToHudAndMinimap"
)) {
    if ($tests -notlike "*$requiredTest*") {
        throw "Missing focused trajectory preview test: $requiredTest"
    }
}

Invoke-Checked "dotnet build" {
    dotnet build "Weltraum Spiel.sln" --no-restore
}

Invoke-Checked "focused dotnet test" {
    dotnet test "Weltraum Spiel.sln" --no-build --filter "FullyQualifiedName~TrajectoryPreviewPredictionTests"
}

Write-Host "Trajectory preview nav-map verification passed."
