@echo off
setlocal
rem Run from this file directory so npm finds the frontend package.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 LTS or newer, then try again.
  pause
  exit /b 1
)
rem Install the locked frontend dependencies on first launch.
if not exist node_modules\react\package.json (
  call npm.cmd ci
  if errorlevel 1 (
    echo Frontend installation failed. Check the error above.
    pause
    exit /b 1
  )
)
echo Starting the StudyPass frontend on http://127.0.0.1:5173
echo Start the backend in its own folder to load your workspace.
echo Keep this window open. Press Ctrl+C to stop the frontend.
call npm.cmd run dev
pause
