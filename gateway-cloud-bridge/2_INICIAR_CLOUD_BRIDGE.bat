@echo off
cd /d "%~dp0"
title MatchIntel Cloud Bridge
node sync-to-cloud.mjs
echo.
echo O bridge encerrou. Veja a mensagem acima.
pause
