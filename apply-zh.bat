@echo off
cd /d "%~dp0"
set "PATH=E:\DevelopmentTools\NodeJs;%PATH%"
node scripts\apply.js
if errorlevel 1 pause
