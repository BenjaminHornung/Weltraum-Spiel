$ErrorActionPreference = 'Stop'
$spike = Split-Path -Parent $PSScriptRoot
if (-not $spike.StartsWith('C:\IFI_SourceCode\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Execution must stay within C:\IFI_SourceCode' }
$tools = Join-Path $spike '.tools'
New-Item -ItemType Directory -Path $tools -Force | Out-Null
$archive = Join-Path $tools 'rust-std.tar.xz'
$url = 'https://static.rust-lang.org/dist/rust-std-1.97.1-wasm32-unknown-unknown.tar.xz'
$expected = 'fa0edb6e9f34faae5735554d62d50875eded839dc707d0f1c01467a918d8453b'
if (-not (Test-Path -LiteralPath $archive)) { Invoke-WebRequest -Uri $url -OutFile $archive }
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Rust target SHA256 mismatch' }
$target = Join-Path $tools 'rust-std-1.97.1-wasm32-unknown-unknown'
if (-not (Test-Path -LiteralPath $target)) {
  & 'C:\Windows\System32\tar.exe' -xf $archive -C $tools
  if ($LASTEXITCODE -ne 0) { throw ('Target extraction failed: '+$LASTEXITCODE) }
}
Write-Output ('PASS: isolated Rust1.97.1 wasm32 target '+$expected)
