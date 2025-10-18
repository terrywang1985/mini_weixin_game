# 服务器启动顺序说明

## 依赖关系

Match Server 依赖于 Game Server 和 Battle Server（Room Server），因此必须按照以下顺序启动：

```
1. Login Server (可选，独立服务)
2. Game Server (gRPC: 8691)
3. Battle Server (gRPC: 8693)
4. Match Server (gRPC: 50052)
```

## 启动方式

### 方式一：使用 start.bat 脚本（推荐）

在 `server` 目录下运行：
```bash
.\start.bat
```

该脚本会自动按照正确的顺序启动所有服务器，并在每个服务器启动后等待 2 秒，确保服务完全启动。

### 方式二：手动启动

在 `server\bin` 目录下依次运行：
```bash
# 1. 启动 Login Server
start cmd /c "login-server.exe > ..\logs\login-server.log 2>&1"
timeout /t 2

# 2. 启动 Game Server
start cmd /c "game-server.exe > ..\logs\game-server.log 2>&1"
timeout /t 2

# 3. 启动 Battle Server
start cmd /c "battle-server.exe > ..\logs\battle-server.log 2>&1"
timeout /t 2

# 4. 启动 Match Server
start cmd /c "match-server.exe > ..\logs\match-server.log 2>&1"
```

## 停止服务

在 `server` 目录下运行：
```bash
.\stop.bat
```

该脚本会停止所有服务器进程。

## 服务地址

- **Login Server**: http://localhost:8081
- **Game Server**: 
  - WebSocket: ws://localhost:18080/ws
  - TCP: localhost:12345
  - gRPC: localhost:8691
- **Battle Server** (Room Server): gRPC: localhost:8693
- **Match Server**: gRPC: localhost:50052

## 日志文件

所有服务器的日志文件位于 `server\logs\` 目录：
- `login-server.log`
- `game-server.log`
- `battle-server.log`
- `match-server.log`

## 构建服务器

在 `server` 目录下运行：
```bash
.\build.bat
```

该脚本会编译所有服务器，生成的可执行文件位于 `server\bin\` 目录。

## Match Server 配置

Match Server 的连接地址配置在 `match_service.go` 中：
- Room Server (Battle Server): 127.0.0.1:8693
- Game Server: 127.0.0.1:8691

如果修改了 Game Server 或 Battle Server 的端口，需要同步更新 Match Server 的配置。
