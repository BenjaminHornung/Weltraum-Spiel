@echo off
cd /d "%~dp0"
node run.mjs serie 30
set "HVP_RESULT=%ERRORLEVEL%"
echo Exitcode %HVP_RESULT%
pause
exit /b %HVP_RESULT%
