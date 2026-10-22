
$ErrorActionPreference='Stop'
$root='C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Hestia-A0-BenniPC-2026-10-13'
$base=Join-Path $root '.a0-runtime'
$acceptance='E:\DEV\Weltraum-Spiel\TARGET_PC\M5_EMPTY_TOOLHOST_ROOT_ACCEPTANCE-20261018.json'
$ev='E:\DEV\Weltraum-Spiel\TARGET_PC\M5_R05_EXACT_BYTE_RECOVERY-20261019'
function Metadata([string]$p) {
 $i=Get-Item -LiteralPath $p -Force
 if(($i.Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0){throw "Reparse point: $p"}
 [pscustomobject]@{path=$i.FullName;bytes=$i.Length;sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant();creationTimeUtc=$i.CreationTimeUtc.ToString('o');lastWriteTimeUtc=$i.LastWriteTimeUtc.ToString('o');attributes=$i.Attributes.ToString()}
}
function ScanSources {
 $a=Get-Content -LiteralPath $acceptance -Raw|ConvertFrom-Json
 $result=@(); $all=@();$mismatches=@()
 foreach($g in $a.sourcePostPreflight.groups) {
  $dir=Join-Path $base $g.name
  $mp=Join-Path $dir $g.manifest
  $mm=Metadata $mp
  if($mm.sha256 -ne $g.sha256){throw "Manifest drift: $mp"}
  $m=Get-Content -LiteralPath $mp -Raw|ConvertFrom-Json
  if(@($m.files).Count -ne $g.rows){throw "Row count: $dir"}
  $expected=@($m.files.path)+@($g.manifest)
  if(@($expected|Sort-Object -Unique).Count -ne $g.physical){throw "Duplicate or count: $dir"}
  $actual=@(Get-ChildItem -LiteralPath $dir -Recurse -File -Force | ForEach-Object {[IO.Path]::GetRelativePath($dir,$_.FullName).Replace('\','/')})
  if($actual.Count -ne $g.physical -or @(Compare-Object ($expected|Sort-Object) ($actual|Sort-Object)).Count -ne 0){throw "Membership drift: $dir"}
  $matched=0
  foreach($row in $m.files) {
   $fp=[IO.Path]::GetFullPath((Join-Path $dir $row.path))
   if(-not $fp.StartsWith($dir+'\',[StringComparison]::OrdinalIgnoreCase)){throw "Row escapes group: $fp"}
   $meta=Metadata $fp
   $ok=$meta.bytes -eq $row.bytes -and $meta.sha256 -eq $row.sha256
   $r=[pscustomobject]@{group=$g.name;relative=$row.path;expectedBytes=$row.bytes;expectedSha256=$row.sha256;actual=$meta;matches=$ok}
   $all+=$r
   if($ok){$matched++}else{$mismatches+=$r}
  }
  $result+=[pscustomobject]@{name=$g.name;manifest=$g.manifest;sha256=$mm.sha256;manifestBytes=$mm.bytes;rows=$g.rows;physical=$actual.Count;matchingRows=$matched;manifestMatches=$true}
 }
 if($result.Count-ne 8 -or $all.Count-ne 296 -or ($result|Measure-Object physical -Sum).Sum-ne 304){throw 'Global counts drift'}
 [pscustomobject]@{observedAtUtc=[DateTime]::UtcNow.ToString('o');groups=$result;rows=$all;physical=304;manifestRows=296;manifestHashesMatching=8;matchingRows=296-$mismatches.Count;mismatches=$mismatches}
}
$specs=@(
 [pscustomobject]@{name='activation-regressions.mjs';bytes=9336;sha256='b95fba30fa9e4642ec18f8f103578144116e80fd13a9624be107e95c12be8ce6'},
 [pscustomobject]@{name='ActivationAdmission.cs';bytes=9565;sha256='53a8151d9f00fb3e92128bf32a970d938160ec0c55d0d8245f0e46d70bd69305'}
)
$emptySha='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

$ev='E:\DEV\Weltraum-Spiel\TARGET_PC\M5_WARMHOST_ONCE_EXECUTION-20261019'
$admin='C:\IFI_SourceCode\Temp\WeltraumSpiel\artifacts\hestia-target-pc-2026-10-13'
$r04=Join-Path $base 'benni-pc-m5-root-runner-source-r04'
$inner=Join-Path $base 'benni-pc-m5-harmless-activation-source-r05'
$copySpecs=@(
 @('root-outer.ps1','e4f142ef4406a102237b23dab42b136558c1ffa46c4d67e8bbe7c4dd7e0a05a2'),
 @('root-dispatch.ps1','939586e44519ef4f8285a16db69a0b88801d4de59113753545e06dc31301e9f9'),
 @('root-runner.ps1','7312bc523c2b7e38a5050df08ec517d815454a333d006544ee58ad6148b9281f'),
 @('RootOuterAtomicLauncher.cs','7a7334e72013dda3c2f2947292aca615f20137845747d1f45b507858ced83006'),
 @('RootOuterAtomicLauncher.dll','148f0ac69fc07651922b591e32d63660f874b88992d50ab4226908d1e1233b70')
)
function CreateNewJson([string]$name,$obj){
 $b=[Text.UTF8Encoding]::new($false).GetBytes((ConvertTo-Json -InputObject $obj -Depth 25))
 $h=[IO.File]::Open((Join-Path $ev $name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$h.Write($b,0,$b.Length);$h.Flush($true)}finally{$h.Dispose()}
 $read=[IO.File]::ReadAllBytes((Join-Path $ev $name))
 if([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($read))-cne [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($b))){throw 'Evidence readback'}
}
function PinsCheck{
 $pins=Join-Path $inner 'QUAL_SOURCE_PINS.tsv'
 if((Get-FileHash -LiteralPath $pins).Hash.ToLowerInvariant()-ne 'add45dc1d3792464ef1844363afcc88bd75a02300f3f2d7885bb24c07d0a0279'){throw 'Pins file drift'}
 $lines=[IO.File]::ReadAllLines($pins)
 if($lines.Count-ne 1309){throw 'Pins count drift'}
 foreach($line in $lines){
  $v=$line.Split([char]9)
  if($v.Count-ne 4){throw 'Pin shape'}
  $i=Get-Item -LiteralPath $v[1] -Force
  if(($i.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0 -or $i.Length-ne [long]$v[2] -or (Get-FileHash -LiteralPath $v[1]).Hash.ToLowerInvariant()-ne $v[3]){throw "Pin drift: $($v[0])"}
 }
 [pscustomobject]@{count=$lines.Count;sha256=(Get-FileHash -LiteralPath $pins).Hash.ToLowerInvariant();allMatch=$true}
}

$ev=Join-Path $base 'benni-pc-blender-export-membership-source-r01'
if((Get-FileHash -LiteralPath $acceptance).Hash.ToLowerInvariant() -ne '90761df2b0ce247ca63b2de7273c88327426da8360c7805c07eb5f86a2d1f6a1'){throw 'M5 acceptance drift'}
$sources=ScanSources;if($sources.mismatches.Count){throw 'M5 protected bytes drift'}
$pins=PinsCheck
$copies=@(foreach($s in $copySpecs){$m=Metadata (Join-Path $admin $s[0]);if($m.sha256 -ne $s[1]){throw 'installed copy drift'};$m})
function FrozenRows($dir,$manifest,$expectedHash,$self){
 if((Get-FileHash $manifest).Hash.ToLowerInvariant() -ne $expectedHash){throw 'frozen manifest drift'}
 $m=Get-Content $manifest -Raw|ConvertFrom-Json
 $physical=@(Get-ChildItem -LiteralPath $dir -Recurse -File -Force|ForEach-Object{[IO.Path]::GetRelativePath($dir,$_.FullName).Replace('\','/')})
 $expected=@($m.files.path);if($self){$expected+=Split-Path $manifest -Leaf}
 if($physical.Count -ne $m.physical -or @(Compare-Object ($physical|Sort-Object) ($expected|Sort-Object)).Count){throw 'frozen membership drift'}
 foreach($r in $m.files){$meta=Metadata (Join-Path $dir $r.path);if($meta.bytes -ne $r.bytes -or $meta.sha256 -ne $r.sha256){throw 'frozen row drift'}}
 [pscustomobject]@{manifest=Metadata $manifest;physical=$physical.Count;rows=@($m.files).Count;allMatch=$true}
}
$wxg=FrozenRows (Join-Path $base 'benni-pc-wxg-bodyfixed-z-source-r01') 'E:\DEV\Weltraum-Spiel\TARGET_PC\WXG_BODYFIXED_Z_ROOT_MANIFEST-20261019.json' '6d065d3bc13f22d7538ea34a91e578747bafe6ef9e43077232e17a24739fc3f2' $false
$atm=FrozenRows (Join-Path $base 'benni-pc-atm-wxg-z-binding-source-r01') (Join-Path $base 'benni-pc-atm-wxg-z-binding-source-r01/SOURCE_MANIFEST_FINAL.json') 'edfcf77815c33687909d7b1ec792901f5d34d7610e48515da70c136598b5a6a1' $true
$rapier=Join-Path $base 'benni-pc-rapier-dist-source-restore-r01'
$rm=Join-Path $rapier 'SOURCE_MANIFEST_FINAL.json'
if((Get-FileHash $rm).Hash.ToLowerInvariant() -ne '6088aea7a85486e2e954818c478b393b74ac953fbdbfd934bbd48068088d89aa'){throw 'Rapier evidence manifest drift'}
$original=Get-Content $rm -Raw|ConvertFrom-Json
foreach($r in $original.files){$m=Metadata (Join-Path $rapier $r.path);if($m.bytes -ne $r.bytes -or $m.sha256 -ne $r.sha256){throw 'Rapier evidence row drift'}}
$groups=@(foreach($n in @('DONOR_INPUT_BINDINGS.json','EXISTING_PACKAGE_BEFORE.json','SIX_SOURCE_BEFORE.json')){
 $rows=Get-Content (Join-Path $rapier $n) -Raw|ConvertFrom-Json
 foreach($r in $rows){$m=Metadata $r.path;if($m.bytes -ne $r.bytes -or $m.sha256 -ne $r.sha256){throw ('preserved source drift '+$r.path)}}
 [pscustomobject]@{binding=$n;count=@($rows).Count;allMatch=$true}
})
$package=Join-Path $root 'apps/weltraum-browser/vendor/rapier-phy01-positive-margin-r05'
$physical=@(Get-ChildItem $package -Recurse -File -Force)
if($physical.Count -ne 196){throw 'Rapier package membership count drift'}
CreateNewJson 'PRESERVATION.json' ([ordered]@{observedUtc=[DateTime]::UtcNow.ToString('o');m5=$sources;pins=$pins;installedCopies=$copies;wxg=$wxg;atm=$atm;rapierAndSixSources=$groups;rapierPhysical=196;runtimeRuns=0})
[ordered]@{M5Physical=$sources.physical;pins=$pins.count;installed=$copies.Count;WXG=$wxg.physical;ATM=$atm.physical;rapierAndSixSources=$groups;package196=$true}|ConvertTo-Json -Depth 5 -Compress

