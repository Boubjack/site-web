@echo off
REM Lanceur tout-en-un pour Windows : double-cliquez ou lancez start.bat
setlocal enabledelayedexpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est requis. Installez-le depuis https://nodejs.org puis relancez.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installation des dependances (une seule fois)...
  call npm install --no-audit --no-fund
)

if "%ANTHROPIC_API_KEY%"=="" (
  findstr /b "ANTHROPIC_API_KEY" .mini-agent\.env >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Collez votre cle API Claude puis Entree.
    echo ^(elle est sur https://console.anthropic.com/settings/keys, format sk-ant-...^)
    set /p KEY="Cle : "
    if not exist .mini-agent mkdir .mini-agent
    echo ANTHROPIC_API_KEY=!KEY!>> .mini-agent\.env
    echo Cle enregistree ^(elle ne sera plus redemandee^).
    echo.
  )
)

node agent.js %*
