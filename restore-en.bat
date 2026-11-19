@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  if exist "E:\DevelopmentTools\NodeJs\node.exe" (
    set "PATH=E:\DevelopmentTools\NodeJs;%PATH%"
  ) else (
    echo [错误] 未在系统 PATH 中检测到 Node.js，请先安装 Node.js (https://nodejs.org)！
    pause
    exit /b 1
  )
)

node scripts\restore.js
pause
