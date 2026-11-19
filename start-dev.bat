@echo off
rem MayAIStudio dev server on http://localhost:3001 for trying changes.
rem It works on its own copy of the data (data-dev) so it never overwrites what the live site (3000) saves.
chcp 65001 >nul
cd /d "%~dp0"
if not exist "data-dev\settings.json" (
  echo 개발용 데이터 복사본을 만드는 중이에요. 처음 한 번만 해요...
  robocopy data data-dev /E /XD .bundle /NFL /NDL /NJH /NJS /R:1 /W:1 >nul
)
set "MAYSTUDIO_DATA_DIR=%~dp0data-dev"
set "MAYSTUDIO_NO_JOBS=1"
title MayAIStudio 개발용(3001)
npm run dev -- -p 3001
