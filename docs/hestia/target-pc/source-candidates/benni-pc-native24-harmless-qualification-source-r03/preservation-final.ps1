$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
function NewJson($name,$value){$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 10));$f=[IO.File]::Open((Join-Path $taskRoot $name),[IO.FileMode]::CreateNew);try{$f.Write($bytes,0,$bytes.Length)}finally{$f.Dispose()}}
$baseline=Get-Content -LiteralPath (Join-Path $taskRoot 'PRESERVATION_BASELINE.json') -Raw|ConvertFrom-Json
$start=[DateTime]::UtcNow;$watch=[Diagnostics.Stopwatch]::StartNew()
$errors=[Collections.Generic.List[string]]::new();$rows=[Collections.Generic.List[object]]::new()
function CheckRows($label,$items){
 $count=0
 foreach($row in $items){
  $path=$row.path
  if(-not [IO.File]::Exists($path)){$errors.Add("MISSING $path");continue}
  $info=[IO.FileInfo]::new($path);$sha=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
  if($info.Length -ne $row.bytes -or $sha -ne $row.sha256){$errors.Add("DRIFT $path")}
  $count++
 }
 $rows.Add([ordered]@{group=$label;checked=$count;expected=@($items).Count})
}
CheckRows 'original4007' $baseline.uniqueProtectedFiles
foreach($name in @('ADMISSION_PROTECTED.json','CONTAINMENT_R01_PROTECTED.json','CONTAINMENT_R02_PROTECTED.json','CONTAINMENT_R03_PROTECTED.json','HARMLESS_R01_PROTECTED.json','HARMLESS_R02_PROTECTED.json')){CheckRows $name (Get-Content -LiteralPath (Join-Path $taskRoot $name) -Raw|ConvertFrom-Json)}
$present=0;$absent=0
foreach($row in $baseline.R11HistoricalRows){
 $path=Join-Path $baseline.R11Root $row.relative
 $exists=[IO.File]::Exists($path)
 if($exists -ne $row.present){$errors.Add("R11_STATE $path");continue}
 if($exists){$present++;if(([IO.FileInfo]::new($path)).Length -ne $row.actual.bytes -or (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $row.actual.sha256){$errors.Add("R11_DRIFT $path")}}else{$absent++}
}
$result=[ordered]@{startUtc=$start.ToString('o');endUtc=[DateTime]::UtcNow.ToString('o');elapsedMs=$watch.ElapsedMilliseconds;groups=@($rows);orderedRoles=$baseline.roleRowsOrdered1250.Count;R11Present=$present;R11Absent=$absent;errors=@($errors);pass=$errors.Count -eq 0;readOnlyOldInputs=$true}
NewJson 'PRESERVATION_FINAL_RESULT.json' $result
$result|ConvertTo-Json -Depth 5 -Compress
if($errors.Count){exit 1}
