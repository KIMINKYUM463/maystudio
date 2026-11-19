# MayAIStudio daily backup (registered by scripts/install-tasks.ps1, runs once a day).
# - media: photos, clips, renders copied into <dest>\media; never deletes, so a project removed by mistake
#   is still in the backup
# - snapshots\<date>: every project.json plus clicks/reels, so any of the last 14 days can be restored
# settings.json (API keys) is NOT copied off this computer.
param([string]$Dest = $(if ($env:MAYSTUDIO_BACKUP_DIR) { $env:MAYSTUDIO_BACKUP_DIR } else { Join-Path $env:USERPROFILE "OneDrive\MayAIStudio-backup" }))

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root "data"
$log = Join-Path $Dest "backup.log"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

# 1) Media and project files, added and updated only (no /MIR: deletions never propagate).
robocopy $data (Join-Path $Dest "media") /E /XO /XD .bundle /XF "settings*.json" /R:1 /W:2 /NFL /NDL /NP /NJH | Out-Null
$code = $LASTEXITCODE  # robocopy: 0-7 = success, 8+ = failure

# 2) Dated snapshot of the small JSON files.
$stamp = Get-Date -Format "yyyy-MM-dd"
$snap = Join-Path $Dest "snapshots\$stamp"
New-Item -ItemType Directory -Force -Path $snap | Out-Null
foreach ($f in @("clicks.json", "reels.json")) {
  $p = Join-Path $data $f
  if (Test-Path $p) { Copy-Item $p $snap -Force }
}
Get-ChildItem (Join-Path $data "projects") -Directory | ForEach-Object {
  $pj = Join-Path $_.FullName "project.json"
  if (Test-Path $pj) {
    $to = Join-Path $snap "projects\$($_.Name)"
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    Copy-Item $pj $to -Force
  }
}

# 3) Keep the newest 14 snapshots.
Get-ChildItem (Join-Path $Dest "snapshots") -Directory | Sort-Object Name -Descending | Select-Object -Skip 14 | Remove-Item -Recurse -Force

$status = if ($code -lt 8) { "ok" } else { "robocopy failed ($code)" }
Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $status"
if ($code -ge 8) { exit 1 }
