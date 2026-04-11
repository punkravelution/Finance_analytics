@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Запуск сервера разработки...
echo Открой в браузере: http://127.0.0.1:3000
echo Окно не закрывай — пока оно открыто, сайт работает.
echo.
npm run dev
pause
