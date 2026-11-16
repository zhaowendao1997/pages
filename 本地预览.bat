@echo off
cd /d "%~dp0"

if not exist "dist\index.html" (
  node build.mjs
)

powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 4321); $c.Close(); exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" "http://127.0.0.1:4321"
  exit /b
)

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:4321'"
echo Preview: http://127.0.0.1:4321
echo Close this window to stop the server.
node serve.mjs --watch
