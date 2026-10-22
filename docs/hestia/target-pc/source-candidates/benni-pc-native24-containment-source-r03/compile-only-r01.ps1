$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$source = Join-Path $root 'Native24Family.cs'
$output = Join-Path $root 'Native24Family.compile-r01.dll'
if (Test-Path -LiteralPath $output) { throw 'Compile output must be fresh' }
function New-Json([string]$name, $value) {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($value | ConvertTo-Json -Depth 8))
    $file = [IO.File]::Open((Join-Path $root $name), [IO.FileMode]::CreateNew)
    try { $file.Write($bytes, 0, $bytes.Length) } finally { $file.Dispose() }
}
$before = @([AppDomain]::CurrentDomain.GetAssemblies() | ForEach-Object { if (-not $_.IsDynamic) { $_.Location } } | Sort-Object -CaseSensitive)
New-Json 'COMPILE_R01_ASSEMBLIES_BEFORE.json' $before
$diagnostic = $null
try {
    Add-Type -LiteralPath $source -OutputAssembly $output -OutputType Library -ErrorAction Stop
} catch { $diagnostic = $_.ToString() }
$after = @([AppDomain]::CurrentDomain.GetAssemblies() | ForEach-Object { if (-not $_.IsDynamic) { $_.Location } } | Sort-Object -CaseSensitive)
New-Json 'COMPILE_R01_ASSEMBLIES_AFTER.json' $after
$loaded = @($after | Where-Object { [String]::Equals($_, $output, [StringComparison]::OrdinalIgnoreCase) }).Count -ne 0
$evidence = [ordered]@{
    source = $source; sourceSha256 = (Get-FileHash -LiteralPath $source).Hash.ToLowerInvariant()
    output = $output; outputExists = (Test-Path -LiteralPath $output)
    assemblyBeforeCount = $before.Count; assemblyAfterCount = $after.Count
    generatedAssemblyLoaded = $loaded; nativeMethodsInvoked = 0; passThru = $false; diagnostic = $diagnostic
}
if ($evidence.outputExists) {
    $evidence.outputBytes = (Get-Item -LiteralPath $output).Length
    $evidence.outputSha256 = (Get-FileHash -LiteralPath $output).Hash.ToLowerInvariant()
}
New-Json 'COMPILE_R01_ENGINE_RESULT.json' $evidence
$evidence | ConvertTo-Json -Compress
if ($diagnostic -or $loaded -or -not $evidence.outputExists) { exit 1 }
