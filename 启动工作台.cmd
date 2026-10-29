@echo off
chcp 65001 >nul
title OpenAI Studio
cd /d "%~dp0"
node scripts/setup-local.mjs
if errorlevel 1 pause
call npm run dev
pause
