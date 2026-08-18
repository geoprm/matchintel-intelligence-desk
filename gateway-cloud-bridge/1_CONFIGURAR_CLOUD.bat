@echo off
setlocal
cd /d "%~dp0"
echo ==================================================
echo MatchIntel - Configurar Cloud Bridge
echo ==================================================
echo.
set /p KEY=COLE A CHAVE MATCHINTEL_INGEST_KEY: 
if "%KEY%"=="" (
  echo [ERRO] Chave vazia.
  pause
  exit /b 1
)
> ".env.cloud" echo MATCHINTEL_INGEST_URL=https://tkzfkkqcgmzqjfcokrws.supabase.co/functions/v1/matchintel-ingest
>> ".env.cloud" echo MATCHINTEL_INGEST_KEY=%KEY%
>> ".env.cloud" echo MATCHINTEL_SYNC_MS=20000
>> ".env.cloud" echo GATEWAY_URL=http://127.0.0.1:8787
echo.
echo Configuracao salva em .env.cloud
echo NAO envie .env.cloud ao GitHub.
pause
