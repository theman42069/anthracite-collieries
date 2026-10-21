# Checks the data files before publishing. Prints problems and exits 1, or prints "Data OK".
#   powershell -ExecutionPolicy Bypass -File check-data.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$problems = New-Object Collections.Generic.List[string]

$geo = Get-Content data\collieries.geojson -Raw -Encoding UTF8 | ConvertFrom-Json
$ids = @{}
foreach ($f in $geo.features) {
  $p = $f.properties
  if (-not $p.id) { $problems.Add("Colliery without an id: $($p.name)") }
  elseif ($ids[$p.id]) { $problems.Add("Duplicate colliery id: $($p.id)") }
  $ids[$p.id] = 1
  $c = $f.geometry.coordinates
  if ($f.geometry.type -ne 'Point' -or $c.Count -ne 2 -or $c[1] -lt 39 -or $c[1] -gt 42.5 -or $c[0] -lt -81 -or $c[0] -gt -74) {
    $problems.Add("Bad coordinates: $($p.id)")
  }
}
foreach ($f in $geo.features) {
  foreach ($r in @($f.properties.related)) {
    $id = if ($r -is [string]) { $r } else { $r.id }
    if ($id -and -not $ids[$id]) { $problems.Add("$($f.properties.id): related site '$id' does not exist") }
  }
  $p = $f.properties
  foreach ($url in @($p.photo_url) + @($p.photos | ForEach-Object { if ($_ -is [string]) { $_ } else { $_.url } })) {
    if ($url -and $url -notmatch '^https?:' -and -not (Test-Path -LiteralPath $url)) { $problems.Add("$($p.id): missing photo $url") }
  }
}

$mem = Get-Content data\memorial.json -Raw -Encoding UTF8 | ConvertFrom-Json
$n = 0
foreach ($row in $mem.people) {
  $n++
  $r = @($row)
  if ($r.Count -ne 8) { $problems.Add("Memorial row $n has $($r.Count) fields, not 8"); continue }
  if ($r[0] -notmatch '^\d{4}(-\d{2}(-\d{2})?)?$') { $problems.Add("Memorial row ${n}: bad date '$($r[0])'") }
  if (-not $r[1]) { $problems.Add("Memorial row ${n}: no name") }
  if (-not $ids[$r[4]]) { $problems.Add("Memorial row ${n}: unknown colliery '$($r[4])'") }
  if ($r[6] -and -not $mem.sources.($r[6])) { $problems.Add("Memorial row ${n}: unknown source '$($r[6])'") }
}

foreach ($q in (Get-Content data\quiz-extra.json -Raw -Encoding UTF8 | ConvertFrom-Json)) {
  if ($q.colliery -and -not $ids[$q.colliery]) { $problems.Add("Quiz: unknown colliery '$($q.colliery)'") }
  if (@($q.wrong) -contains $q.answer) { $problems.Add("Quiz: answer is also a wrong choice: $($q.question)") }
}

if ($problems.Count) { $problems | ForEach-Object { Write-Host $_ -ForegroundColor Red }; exit 1 }
Write-Host "Data OK: $($geo.features.Count) collieries, $n memorial names." -ForegroundColor Green
