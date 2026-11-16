@echo off
chcp 65001 >nul
cd /d "%~dp0"

if "%~1"=="" (
  echo 把装有照片的文件夹拖到这个文件上。
  echo.
  pause
  exit /b
)

node tools\import-album.mjs "%~1"
echo.
pause
