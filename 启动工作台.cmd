@echo off
chcp 65001 >nul
title OpenAI Studio
cd /d "%~dp0"
set "OPENAI_STUDIO_PROXY=http://127.0.0.1:7892,http://127.0.0.1:7897"
node scripts/setup-local.mjs
if errorlevel 1 pause
call npm run dev
pause
