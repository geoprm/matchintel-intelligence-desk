@echo off
setlocal
cd /d "%~dp0"
title MatchIntel - Publicar no GitHub

echo =========================================================
echo MATCHINTEL - PUBLICAR PROJETO NO GITHUB
echo =========================================================
echo.
echo Antes de continuar:
echo 1. Crie um repositorio VAZIO no GitHub, por exemplo:
echo    matchintel-intelligence-desk
echo 2. NAO marque README, .gitignore ou license no GitHub.
echo 3. Copie a URL HTTPS do repositorio.
echo.
set /p REPO=COLE A URL HTTPS DO REPOSITORIO: 
if "%REPO%"=="" (
  echo [ERRO] URL vazia.
  pause
  exit /b 1
)

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado neste computador.
  echo Instale o Git for Windows e execute novamente.
  pause
  exit /b 1
)

if not exist ".git" git init
git add .
git commit -m "MatchIntel Intelligence Desk - PWA cloud relay v1"
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin "%REPO%"
git push -u origin main

if errorlevel 1 (
  echo.
  echo [ATENCAO] O push nao terminou.
  echo Se o GitHub pedir login, autentique-se e execute este arquivo novamente.
  pause
  exit /b 1
)

echo.
echo =========================================================
echo GITHUB OK
echo Agora abra vercel.com:
echo Add New ^> Project ^> Import Git Repository
echo Selecione matchintel-intelligence-desk
echo Framework Preset: Other
echo Build Command: node scripts/build.mjs
echo Output Directory: dist
echo Deploy
echo =========================================================
pause
