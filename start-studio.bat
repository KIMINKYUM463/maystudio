@echo off
rem MayAIStudio: build, start on port 3000, and open the Cloudflare tunnel to mayaistudio.com.
rem The site is only up while this computer is on and both windows stay open.
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

findstr /b /c:"MAYSTUDIO_PASSWORD=" .env.local >nul 2>&1
if errorlevel 1 (
  echo 인터넷에서 들어올 때 쓸 비밀번호를 정하세요. 이 컴퓨터 안에서는 묻지 않아요.
  set /p PW=비밀번호:
  if "!PW!"=="" (
    echo 비밀번호가 비어 있어요. 다시 실행해 주세요.
    pause
    exit /b 1
  )
  >>.env.local echo MAYSTUDIO_PASSWORD=!PW!
  echo 저장했어요: .env.local
)

echo 프로그램을 준비하는 중이에요. 1~2분 걸려요...
call npm run build
if errorlevel 1 (
  echo 준비 중 오류가 났어요. 위 내용을 확인해 주세요.
  pause
  exit /b 1
)

start "MayAIStudio 서버" cmd /k npm run start -- -p 3000
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo cloudflared가 설치돼 있지 않아 인터넷 연결은 건너뛰어요. 이 컴퓨터에서는 http://localhost:3000 으로 쓸 수 있어요.
) else (
  start "MayAIStudio 인터넷 연결" cmd /k cloudflared tunnel run mayaistudio
)
start "" http://localhost:3000
