@echo off
chcp 65001 > NUL
cd /d "%~dp0"
where node > NUL 2> NUL || (echo Chybi Node.js. Stahni ho z https://nodejs.org a spust znovu. & pause & exit /b 1)
if not exist node_modules (echo Instaluji zavislosti... & call npm install || (pause & exit /b 1))
call npm run local
pause
