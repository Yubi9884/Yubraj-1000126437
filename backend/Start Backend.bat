@echo off
setlocal
rem Run from this file directory so relative paths resolve inside the backend.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 LTS or newer, then try again.
  pause
  exit /b 1
)
rem Install locked backend dependencies if Express is missing.
if not exist node_modules\express\package.json (
  call npm.cmd ci
  if errorlevel 1 (
    echo Backend installation failed. Check the error above.
    pause
    exit /b 1
  )
)
echo Starting the StudyPass backend on http://127.0.0.1:4000
echo Keep this window open. Press Ctrl+C to stop the backend.
rem Use the connection address to choose Atlas development mode or local MongoDB.
node --input-type=module -e "import dotenv from 'dotenv'; dotenv.config({ quiet: true }); process.exit(process.env.MONGODB_URI?.trim() ? 0 : 1)"
if errorlevel 1 (
  echo No Atlas address is configured. Starting with local MongoDB.
  call npm.cmd run start:local
) else (
  call npm.cmd run dev
)
pause
