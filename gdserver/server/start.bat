@echo off
chcp 65001 > nul

echo === 启动 jigger_protobuf 服务器 ===

REM 创建日志目录
if not exist "..\logs" mkdir "..\logs"

REM 检查二进制文件是否存在
if not exist bin\game-server.exe (
    echo ❌ Game Server 可执行文件不存在，请先运行 build.bat
    pause
    exit /b 1
)

if not exist bin\battle-server.exe (
    echo ❌ Battle Server 可执行文件不存在，请先运行 build.bat
    pause
    exit /b 1
)

if not exist bin\login-server.exe (
    echo ❌ Login Server 可执行文件不存在，请先运行 build.bat
    pause
    exit /b 1
)

if not exist bin\match-server.exe (
    echo ❌ Match Server 可执行文件不存在，请先运行 build.bat
    pause
    exit /b 1
)

REM 检查配置文件
if not exist cfg\cfg_tbdrawcard.json (
    echo ❌ 配置文件不存在，请检查 cfg 目录
    pause
    exit /b 1
)

echo 🚀 启动 Login Server...
cd bin
rem start "Login Server" login-server.exe
start "Login Server" cmd /c "login-server.exe > ..\logs\login-server.log 2>&1"
timeout /t 2 > nul

echo 🚀 启动 Game Server...
rem start "Game Server" game-server.exe
start "Game Server" cmd /c "game-server.exe > ..\logs\game-server.log 2>&1"
timeout /t 2 > nul

echo 🚀 启动 Battle Server (日志输出到 ..\logs\battle-server.log)...
start "Battle Server" cmd /c "battle-server.exe > ..\logs\battle-server.log 2>&1"
timeout /t 2 > nul

echo 🚀 启动 Match Server (日志输出到 ..\logs\match-server.log)...
start "Match Server" cmd /c "match-server.exe > ..\logs\match-server.log 2>&1"
timeout /t 2 > nul

cd ..

echo.
echo === 服务器启动完成 ===
echo 💡 Login Server:  http://localhost:8081
echo 💡 Game Server:   WebSocket: ws://localhost:18080/ws, TCP: localhost:12345, gRPC: localhost:8691
echo 💡 Battle Server: gRPC: localhost:8693
echo 💡 Match Server:  gRPC: localhost:50052
echo.
echo 💡 日志文件位置: logs\
echo 💡 使用 stop.bat 停止所有服务器
pause