# Future fixed compile source only; AST checked, never invoked in this source task.
[CmdletBinding()]param()
$ErrorActionPreference='Stop'
$root='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13\.a0-runtime\benni-pc-m5-root-runner-source-r04'
$source=Join-Path $root 'RootOuterAtomicLauncher.cs'
$output=Join-Path $root 'RootOuterAtomicLauncher.dll'
if([Environment]::ProcessPath-cne'C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe'-or$PSVersionTable.PSVersion.ToString()-cne'7.6.4'-or[Runtime.InteropServices.RuntimeInformation]::FrameworkDescription-cne'.NET 10.0.10'){throw 'QUALIFIED_COMPILER_ONLY'}
if(Test-Path -LiteralPath $output){throw 'Fresh emit only; preserve existing reviewed DLL'}
$before=@([AppDomain]::CurrentDomain.GetAssemblies()|ForEach-Object{$_.FullName})
Add-Type -LiteralPath $source -OutputAssembly $output -OutputType Library -ErrorAction Stop
$name=[Reflection.AssemblyName]::GetAssemblyName($output).FullName
$after=@([AppDomain]::CurrentDomain.GetAssemblies()|ForEach-Object{$_.FullName})
$loaded=$after-ccontains$name
[pscustomobject]@{sourceSha256=(Get-FileHash -LiteralPath $source).Hash.ToLowerInvariant();outputSha256=(Get-FileHash -LiteralPath $output).Hash.ToLowerInvariant();generatedAssemblyLoaded=$loaded;assemblyBefore=$before;assemblyAfter=$after;nativeMethodsInvoked=0}|ConvertTo-Json -Depth 4
if($loaded){throw 'Generated assembly load forbidden'}
