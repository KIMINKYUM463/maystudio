# Registers two Windows tasks for the signed-in user (no admin needed):
#   "MayAIStudio 자동 시작" - at sign-in, starts the live site and internet connection (start-live.bat)
#   "MayAIStudio 백업"      - every day at 03:00 (or as soon as the PC is on after that), runs backup.ps1
# Remove them with: Unregister-ScheduledTask -TaskName "MayAIStudio 자동 시작","MayAIStudio 백업"
$root = Split-Path -Parent $PSScriptRoot
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

$start = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$root\start-live.bat`"" -WorkingDirectory $root
# A short delay lets the network come up before the tunnel starts.
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$atLogon.Delay = "PT45S"
Register-ScheduledTask -TaskName "MayAIStudio 자동 시작" -Action $start -Trigger $atLogon -Settings $settings -Description "MayAIStudio 사이트와 인터넷 연결을 켭니다" -Force | Out-Null

$backup = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\scripts\backup.ps1`"" -WorkingDirectory $root
$daily = New-ScheduledTaskTrigger -Daily -At 3am
Register-ScheduledTask -TaskName "MayAIStudio 백업" -Action $backup -Trigger $daily -Settings $settings -Description "MayAIStudio 데이터를 OneDrive로 백업합니다" -Force | Out-Null

Get-ScheduledTask -TaskName "MayAIStudio*" | Select-Object TaskName, State
