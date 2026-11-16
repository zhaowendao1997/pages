@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 请选一张图片当头像，会按中心正方形裁切。
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "tools\set-avatar.ps1" -Path "%~1"
if errorlevel 1 (
  echo.
  echo 头像没有改动。
  pause
  exit /b
)

echo.
echo 重新生成站点……
node build.mjs
echo.
echo 好了。如果本地预览开着，刷新浏览器就能看到。
echo 要发到线上，再提交并推送 dist 到 GitHub 就行。
echo.
pause
