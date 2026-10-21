# Photo credits checklist.
# Reads data/collieries.geojson and writes CREDITS-TODO.md: which photos still need a credit,
# which need permission (watermarks, modern photos, artwork), and which are ready to publish.
# Also catches photo files that are missing, unused, or used twice.
#
# Run it: double-click credits-report.bat, or
#   powershell -ExecutionPolicy Bypass -File credits-report.ps1

$root = $PSScriptRoot
$data = Get-Content -Raw -Encoding UTF8 (Join-Path $root 'data\collieries.geojson') | ConvertFrom-Json

$ready = @(); $needCredit = @(); $needPermission = @(); $missing = @()
$used = @{}

foreach ($f in $data.features) {
  $p = $f.properties
  $list = @()
  if ($p.photo_url) { $list += [pscustomobject]@{ url = $p.photo_url; caption = $p.photo_caption; credit = $p.photo_credit } }
  foreach ($ph in @($p.photos)) { if ($ph -and $ph.url) { $list += $ph } }

  foreach ($ph in $list) {
    $credit = [string]$ph.credit
    $row = [pscustomobject]@{ site = $p.name; id = $p.id; url = $ph.url; caption = [string]$ph.caption; credit = $credit; why = '' }

    # Local photo files: does it exist, and is it used elsewhere?
    if ($ph.url -notmatch '^https?://') {
      $file = Join-Path $root ($ph.url -replace '/', '\')
      if (-not (Test-Path -LiteralPath $file)) { $missing += $row }
      else {
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
        if (-not $used.ContainsKey($hash)) { $used[$hash] = @() }
        $used[$hash] += $row
      }
    }

    $c = $credit.ToLower()
    if ($c -match 'watermark|pabucketlist|artist|permission|modern photograph|video still|drone') {
      $reasons = @()
      if ($c -match 'watermark') { $reasons += 'watermarked' }
      if ($c -match 'pabucketlist') { $reasons += 'PA Bucket List photo' }
      if ($c -match 'artist') { $reasons += 'modern artwork' }
      if ($c -match 'modern photograph') { $reasons += 'modern photo' }
      if ($c -match 'video still|drone') { $reasons += 'video still' }
      $row.why = ($reasons | Select-Object -Unique) -join ', '
      $needPermission += $row
    }
    elseif ($credit.Trim() -eq '' -or $c -match '\btodo\b') {
      if ($c -match 'public domain') { $row.why = 'probably public domain; just needs its source' }
      elseif ($c -match 'colorized|colorizer') { $row.why = 'colorized; credit the colorizer' }
      else { $row.why = 'source and license unknown' }
      $needCredit += $row
    }
    else { $ready += $row }
  }
}

# Same image file used for more than one photo
$dupes = $used.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }

# Files in photos/ that no site uses
$referenced = @{}
foreach ($v in $used.Values) { foreach ($r in $v) { $referenced[(Split-Path $r.url -Leaf).ToLower()] = $true } }
$unused = Get-ChildItem (Join-Path $root 'photos') -File | Where-Object { -not $referenced.ContainsKey($_.Name.ToLower()) }

function Table($rows, [switch]$why) {
  $out = @()
  foreach ($g in ($rows | Group-Object site)) {
    $out += "### $($g.Name)"
    foreach ($r in $g.Group) {
      $name = Split-Path $r.url -Leaf
      $cap = if ($r.caption.Length -gt 70) { $r.caption.Substring(0, 70) + '…' } else { $r.caption }
      $line = "- [ ] ``$name``: $cap"
      if ($why -and $r.why) { $line += " **($($r.why))**" }
      $out += $line
    }
    $out += ''
  }
  $out
}

$total = $ready.Count + $needCredit.Count + $needPermission.Count
$md = @()
$md += '# Photo credits checklist'
$md += ''
$md += "_Generated $(Get-Date -Format 'MMMM d, yyyy h:mm tt') from data/collieries.geojson. Re-run credits-report.bat after you update credits._"
$md += ''
$md += "**$total photos:** $($ready.Count) ready · $($needCredit.Count) need a credit · $($needPermission.Count) need permission"
if ($missing.Count) { $md += "  · **$($missing.Count) missing files**" }
if (@($dupes).Count) { $md += "  · **$(@($dupes).Count) images used twice**" }
$md += ''
$md += 'To fix one, edit its "credit" in data/collieries.geojson, e.g.'
$md += '`"credit": "Library of Congress, HAER PA-203, public domain"` or `"credit": "Photo by Jane Doe, used with permission"`.'
$md += ''

if ($missing.Count) {
  $md += '## Missing photo files (these show "Photo could not be loaded")'
  $md += ''
  foreach ($r in $missing) { $md += "- $($r.site): ``$($r.url)``" }
  $md += ''
}
if (@($dupes).Count) {
  $md += '## Same image used more than once'
  $md += ''
  foreach ($d in $dupes) { $md += '- ' + (($d.Value | ForEach-Object { "$($_.site) (``$(Split-Path $_.url -Leaf)``)" }) -join ' = ') }
  $md += ''
}

$md += "## 1. Need permission before publishing ($($needPermission.Count))"
$md += ''
$md += 'Someone owns these: a watermark, a modern photographer, an artist or a website. Ask them, or take the photo down.'
$md += ''
$md += Table $needPermission -why

$md += "## 2. Need a source and license ($($needCredit.Count))"
$md += ''
$md += 'Find where each came from. Anything first published before 1931 is public domain in the US. Say so in the credit, with the source.'
$md += ''
$md += Table $needCredit -why

$md += "## 3. Ready ($($ready.Count))"
$md += ''
foreach ($r in $ready) { $md += "- [x] $($r.site): ``$(Split-Path $r.url -Leaf)``: $($r.credit)" }
$md += ''

if ($unused) {
  $md += "## Files in photos/ that no site uses ($(@($unused).Count))"
  $md += ''
  foreach ($u in $unused) { $md += "- ``$($u.Name)``" }
  $md += ''
}

$outFile = Join-Path $root 'CREDITS-TODO.md'
[IO.File]::WriteAllLines($outFile, $md, (New-Object Text.UTF8Encoding($false)))
"Wrote $outFile"
"  $total photos: $($ready.Count) ready, $($needCredit.Count) need a credit, $($needPermission.Count) need permission"
if ($missing.Count) { "  $($missing.Count) MISSING files" }
if (@($dupes).Count) { "  $(@($dupes).Count) image(s) used twice" }
