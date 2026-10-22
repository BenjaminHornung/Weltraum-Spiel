# Source checks only. Never dot-source or invoke prestart.ps1 / Root.cell.mjs.
param([string]$ResultName='CHECK_RESULTS_FINAL.json')
$ErrorActionPreference='Stop'
$dir=$PSScriptRoot
$node='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-other-pc-restored\Tooling\PortableNode\node.exe'
if((Get-FileHash -LiteralPath $node).Hash.ToLowerInvariant()-ne '0d0f5e39f9f3d9587bc19f73eab3c2c9c4903fd02d6dbf9c853dd81b3d95fad4'){throw 'Pinned Node image drift'}
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $dir 'prestart.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){$errors|ForEach-Object{Write-Output $_};throw 'PS AST parse failure'}
$writer=$ast.Find({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq 'WriteNew'},$true)
$guards=@($writer.FindAll({param($n)$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-eq 'AssertLateGuard'},$true)|Sort-Object {$_.Extent.StartOffset})
$methods=@($writer.FindAll({param($n)$n-is[Management.Automation.Language.InvokeMemberExpressionAst]-and$n.Member.Value-in @('Open','Write','Flush','ReadAllBytes')},$true)|Sort-Object {$_.Extent.StartOffset})
if($guards.Count-ne 5 -or $methods.Count-ne 4){throw 'Late write/read guard structure drift'}
for($i=0;$i-lt 4;$i++){if($guards[$i].Extent.StartOffset-ge $methods[$i].Extent.StartOffset){throw 'Guard must precede each CreateNew/write/flush/readback'}}
$late=$ast.Find({param($n)$n-is[Management.Automation.Language.FunctionDefinitionAst]-and$n.Name-eq 'AssertLateGuard'},$true)
$native=$late.Find({param($n)$n-is[Management.Automation.Language.CommandAst]-and$n.GetCommandName()-eq 'AssertWindow'},$true)
$cutoff=[long]$native.CommandElements[1].SafeGetValue()
if($cutoff-ne 120000-or 191698-le $cutoff){throw 'Historical late issuance trace must be denied by actual AST cutoff'}
$results=@()
foreach($args in @(@('--check',(Join-Path $dir 'A0.cell.mjs')),@('--check',(Join-Path $dir 'Root.cell.mjs')),@('--check',(Join-Path $dir 'replay.mjs')),@((Join-Path $dir 'replay.mjs')))){
 $watch=[Diagnostics.Stopwatch]::StartNew()
 $p=[Diagnostics.Process]::new();$safe=$null;$started=$false
 try{
  $p.StartInfo.FileName=$node
  foreach($a in $args){$p.StartInfo.ArgumentList.Add($a)}
  $p.StartInfo.UseShellExecute=$false;$p.StartInfo.CreateNoWindow=$true;$p.StartInfo.RedirectStandardOutput=$true;$p.StartInfo.RedirectStandardError=$true;$p.StartInfo.WorkingDirectory=$dir
  if(-not $p.Start()){throw 'Own source check failed to start'};$started=$true
  $pidValue=$p.Id;$creation=$p.StartTime.ToFileTimeUtc().ToString();$safe=$p.SafeHandle
  $stdout=$p.StandardOutput.ReadToEndAsync();$stderr=$p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit([Math]::Max(0,27000-[int]$watch.ElapsedMilliseconds))){$p.Kill($true);throw 'Own check 27s work cutoff'}
  $complete=[Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($stdout,$stderr),[Math]::Max(0,29000-[int]$watch.ElapsedMilliseconds))
  if(-not $complete){throw 'Own check EOF cutoff'}
  $code=$p.ExitCode;$out=$stdout.Result;$err=$stderr.Result
  $p.StandardOutput.Dispose();$p.StandardError.Dispose();$p.Dispose()
  $record=[pscustomobject]@{arguments=$args;pid=$pidValue;creationFileTime=$creation;terminal=$true;exitCode=$code;stdoutEof=$stdout.IsCompletedSuccessfully;stderrEof=$stderr.IsCompletedSuccessfully;processHandleClosed=$safe.IsClosed;elapsedMs=$watch.ElapsedMilliseconds;stdout=$out;stderr=$err}
  $results+=,$record
  if($code-ne 0-or $watch.ElapsedMilliseconds-gt 30000-or-not $safe.IsClosed){$record|ConvertTo-Json -Depth 5;throw 'Source check failed'}
 }finally{if($started){try{if(-not $p.HasExited){$p.Kill($true)}}catch{}};$p.Dispose()}
}
$report=[pscustomobject]@{status='SOURCE_CHECKS_PASS_ONLY';psAstDiagnostics=$errors.Count;issuerBodyExecuted=$false;lateGuardAstCutoffMs=$cutoff;historical191698msDenied=$true;writeReadbackGuardOrdering=$true;nodeImage=$node;checks=$results;rootCellExecution='NOT_RUN';liveRuntime='NOT_RUN';utc=[DateTime]::UtcNow.ToString('o')}
$b=[Text.UTF8Encoding]::new($false).GetBytes(($report|ConvertTo-Json -Depth 12))
$h=[IO.File]::Open((Join-Path $dir $ResultName),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try{$h.Write($b,0,$b.Length);$h.Flush($true)}finally{$h.Dispose()}
$report|ConvertTo-Json -Depth 12 -Compress

