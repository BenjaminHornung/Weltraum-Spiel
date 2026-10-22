# Current R05 source and tool pins; Root must independently select expected package pins. No runtime store is created.
$ErrorActionPreference='Stop'
$root=$PSScriptRoot;$old=Join-Path (Split-Path $root -Parent) 'benni-pc-m5-harmless-activation-source-r04'
function NewJson($name,$value){$b=[Text.UTF8Encoding]::new($false).GetBytes(($value|ConvertTo-Json -Depth 14));$f=[IO.File]::Open((Join-Path $root $name),[IO.FileMode]::CreateNew);try{$f.Write($b,0,$b.Length)}finally{$f.Dispose()}}
$changes=@()
foreach($f in Get-ChildItem -LiteralPath $root -File|Where-Object{$_.Extension-in@('.cs','.ps1','.mjs')-or$_.Name-in@('ADAPTATIONS.json','ACTIVATION_ADAPTATIONS.json')}){
 $prior=Join-Path $old $f.Name
 if([IO.File]::Exists($prior)){
  $before=[IO.File]::ReadAllText($prior);$after=[IO.File]::ReadAllText($f.FullName)
  if($before-cne$after){
   $begin=0;while($begin-lt$before.Length-and$begin-lt$after.Length-and$before[$begin]-ceq$after[$begin]){$begin++}
   $suffix=0;while($suffix-lt$before.Length-$begin-and$suffix-lt$after.Length-$begin-and$before[$before.Length-1-$suffix]-ceq$after[$after.Length-1-$suffix]){$suffix++}
   $oldPart=$before.Substring($begin,$before.Length-$begin-$suffix);$newPart=$after.Substring($begin,$after.Length-$begin-$suffix)
   $restore=$after.Substring(0,$begin)+$oldPart+$after.Substring($begin+$newPart.Length)
   $hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($restore))).ToLowerInvariant()
   $expected=(Get-FileHash $prior).Hash.ToLowerInvariant();if($hash-cne$expected){throw 'exact reversal'}
   $changes+=[ordered]@{path=$f.Name;original=$prior;offset=$begin;oldText=$oldPart;newText=$newPart;originalSha256=$expected;currentSha256=(Get-FileHash $f.FullName).Hash.ToLowerInvariant();reverseExactSha256=$hash}
  }
 }
}
NewJson 'EXACT_R05_SOURCE_CHANGES.json' $changes
NewJson 'R05_EXACT_REVERSALS.json' $changes
$lines=[Collections.Generic.List[string]]::new()
foreach($row in [IO.File]::ReadAllLines((Join-Path $old 'QUAL_SOURCE_PINS.tsv'))){if($row.StartsWith('ORIGINAL:')-or$row.StartsWith('BRIDGE:')){$lines.Add($row)}}
$files=@(Get-ChildItem -LiteralPath $root -File|Where-Object{$_.Extension-in@('.cs','.ps1','.mjs')-or$_.Name-in@('ADAPTATIONS.json','ACTIVATION_ADAPTATIONS.json','R02_TRANSPORT_ADAPTATIONS.json','COMPANION_CORRECTIONS.json','R05_BINDINGS.json','SUBJECT_PROTOCOL_SCHEMA.json','R03_EXACT_REVERSALS.json','R04_EXACT_REVERSALS.json','R05_MECHANICAL_PATHS.json','R05_EXACT_REVERSALS.json')}|Sort-Object Name)
foreach($f in $files){$lines.Add((@(('ACTIVATION_SOURCE:'+$f.Name),$f.FullName,$f.Length,(Get-FileHash $f.FullName).Hash.ToLowerInvariant())-join[char]9))}
$ps='C:\IFI_SourceCode\Utils\PowerShell\pwsh.exe';$lines.Add((@('ACTIVATION_TOOL:PowerShell',$ps,([IO.FileInfo]$ps).Length,(Get-FileHash $ps).Hash.ToLowerInvariant())-join[char]9))
$b=[Text.UTF8Encoding]::new($false).GetBytes(($lines-join[char]10)+[char]10);$stream=[IO.File]::Open((Join-Path $root 'QUAL_SOURCE_PINS.tsv'),[IO.FileMode]::CreateNew);try{$stream.Write($b,0,$b.Length)}finally{$stream.Dispose()}
foreach($line in $lines){$p=$line.Split([char]9);if($p.Length-ne4-or([IO.FileInfo]$p[1]).Length-ne[long]$p[2]-or(Get-FileHash $p[1]).Hash.ToLowerInvariant()-cne$p[3]){throw 'pin drift'}}
NewJson 'QUAL_PINS_RESULT.json' ([ordered]@{original=1250;bridge=6;newSource=$files.Count;tools=1;total=$lines.Count;sha256=(Get-FileHash (Join-Path $root 'QUAL_SOURCE_PINS.tsv')).Hash.ToLowerInvariant();independentRootExpectedHash=$null;currentComputedHashIsNotAuthority=$true})
[ordered]@{changes=$changes.Count;pins=$lines.Count;sourceFiles=$files.Count;sourceHash=(Get-FileHash (Join-Path $root 'QUAL_SOURCE_PINS.tsv')).Hash.ToLowerInvariant()}|ConvertTo-Json -Compress
