@echo off
rem Starts the live site (port 3000) and the internet connection without rebuilding.
rem Run at Windows sign-in by the "MayAIStudio 자동 시작" task (scripts/install-tasks.ps1).
rem After code changes, a deploy rebuilds; start-studio.bat also rebuilds.
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".next\BUILD_ID" (
  call npm run build
)
start "MayAIStudio 서버" /min cmd /k npm run start -- -p 3000
set "CF=cloudflared"
where cloudflared >nul 2>&1
if errorlevel 1 set "CF=%LOCALAPPDATA%\cloudflared\cloudflared.exe"
if exist "%USERPROFILE%\.cloudflared\config.yml" (
  start "MayAIStudio 인터넷 연결" /min "%CF%" tunnel run mayaistudio
)
