@echo off
setlocal

REM Kill anything listening on 3000 (Next dev)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>nul
)

REM Remove Next build output (can be corrupted/locked on Windows)
if exist ".next" (
  rmdir /s /q ".next" >nul 2>nul
)

REM Pre-create middleware manifest to prevent Next dev crash
node "scripts\prepare-next-dev.js"

echo cleaned
endlocal

