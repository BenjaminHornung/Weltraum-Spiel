$ErrorActionPreference='Stop'
$root=$PSScriptRoot
function NewJson($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 14));$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$watch=[Diagnostics.Stopwatch]::StartNew();$cache=@{}
function VerifyRow($row,[string]$path){
 if(-not$cache.ContainsKey($path)){
  if(-not[IO.File]::Exists($path)){throw "protected missing: $path"}
  $cache[$path]=[ordered]@{path=$path;bytes=([IO.FileInfo]$path).Length;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
 }
 $actual=$cache[$path]
 if($actual.bytes-ne$row.bytes-or$actual.sha256-cne$row.sha256){throw "protected drift: $path"}
}
$b=Get-Content -LiteralPath (Join-Path $root 'PRESERVATION_BASELINE.json') -Raw|ConvertFrom-Json
$groups=[ordered]@{}
foreach($row in $b.uniqueProtectedFiles){VerifyRow $row $row.path};$groups.original4007=@($b.uniqueProtectedFiles).Count
foreach($row in $b.roleRowsOrdered1250){VerifyRow $row $row.path};$groups.orderedOriginalRoles=@($b.roleRowsOrdered1250).Count
$groups.orderedDuplicateRoleRowsRetained=$groups.orderedOriginalRoles-@($b.roleRowsOrdered1250.path|Sort-Object -Unique).Count
foreach($name in @('ADMISSION_PROTECTED.json','CONTAINMENT_R01_PROTECTED.json','CONTAINMENT_R02_PROTECTED.json','CONTAINMENT_R03_PROTECTED.json','HARMLESS_R01_PROTECTED.json','HARMLESS_R02_PROTECTED.json','BASE_R03_PROTECTED.json','ACTIVATION_R01_PROTECTED.json','ACTIVATION_R02_PROTECTED.json','ACTIVATION_R03_PROTECTED.json','ACTIVATION_R04_PROTECTED.json')){
 $rows=Get-Content -LiteralPath (Join-Path $root $name) -Raw|ConvertFrom-Json
 foreach($row in $rows){VerifyRow $row $row.path};$groups[$name]=@($rows).Count
}
$present=0;$absent=0
foreach($row in $b.R11HistoricalRows){
 $p=Join-Path $b.R11Root $row.relative
 if($row.present){VerifyRow $row.actual $p;$present++}else{if([IO.File]::Exists($p)){throw "R11 absent path appeared: $p"};$absent++}
}
$groups.R11=[ordered]@{present=$present;absent=$absent;total=$present+$absent}
$d2=@(
 @('benni-pc-d2-negative-frame-source-r01','e3b996dd1b24d4d7bf6fcd75dc9ab709028704356e867fb252924f5f3aeeef3a'),
 @('benni-pc-d2-typed-context-r01','de4b915f7b97b1400db82eb75803fc7b060bf8b7b0ab6c450541cb7ad3794bdf'),
 @('benni-pc-d2-typed-context-r02','c3c5767330de3cfccb13a9f972ea2d10df0a533c2d299cda898ef8190f5e12a2'),
 @('benni-pc-d2-source-application-r01','f01770fa0478c355121ee212b6e7099b58b563c16e7383201f133cd692f95ed2'))
foreach($pair in $d2){
 $dir=Join-Path (Split-Path $root -Parent) $pair[0];$mp=Join-Path $dir 'SOURCE_MANIFEST_FINAL.json'
 if((Get-FileHash -LiteralPath $mp).Hash.ToLowerInvariant()-cne$pair[1]){throw 'D2 manifest drift'}
 $m=Get-Content -LiteralPath $mp -Raw|ConvertFrom-Json
 foreach($row in $m.files){VerifyRow $row (Join-Path $dir $row.path)}
 $physical=@(Get-ChildItem -LiteralPath $dir -Recurse -File).Count
 if($physical-ne @($m.files).Count+1){throw 'D2 physical population drift'}
 $groups[$pair[0]]=[ordered]@{manifestSha256=$pair[1];rows=@($m.files).Count;physical=$physical}
}
$normal=Get-Content -LiteralPath (Join-Path $root 'D2_NORMAL6_PROTECTED.json') -Raw|ConvertFrom-Json
foreach($row in $normal){VerifyRow $row $row.actual};$groups.D2CurrentNormal=@($normal).Count
$watch.Stop()
$result=[ordered]@{status='PASS';groups=$groups;uniquePhysicalFiles=$cache.Count;elapsedMs=$watch.ElapsedMilliseconds;checkedUtc=[DateTime]::UtcNow.ToString('o');sourceReadOnly=$true;runtimeExecutions=0;runtimeGrant='NONE_HOLD'}
NewJson 'PRESERVATION_RESULT.json' $result
NewJson 'PRESERVATION_CURRENT_FILES.json' @($cache.Values|Sort-Object path)
$result|ConvertTo-Json -Depth 10 -Compress
