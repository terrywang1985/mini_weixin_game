# Match Server 脚本更新总结

## 更新日期
2025年10月18日

## 更新的文件

### Windows 脚本
1. **build.bat** - 已更新
   - 添加 Match Server 构建步骤
   - 修复构建命令（添加 `.` 参数和错误检查）

2. **start.bat** - 已更新
   - 添加 match-server.exe 存在性检查
   - 按正确顺序启动：Login → Game → Battle → Match
   - 每个服务启动后等待 2 秒
   - 更新端口信息显示（Match Server: 50052）

3. **stop.bat** - 已更新
   - 添加 Match Server 停止逻辑
   - 更新进度提示（4/4）

### Linux/Unix 脚本
1. **build.sh** - 已更新
   - 添加 Match Server 构建步骤
   - 与 Windows 版本保持一致

2. **start.sh** - 已更新
   - 支持启动单个 match 服务：`./start.sh match`
   - 支持启动所有服务：`./start.sh all`
   - 按正确顺序启动：Login → Game → Battle → Match
   - 更新使用说明和端口信息

3. **stop.sh** - 已更新
   - 添加 Match Server 停止逻辑
   - 使用 PID 文件管理进程
   - 添加强制清理 match-server 进程

## 服务启动顺序

**重要：** Match Server 依赖于 Game Server 和 Battle Server，必须最后启动。

```
启动顺序：
1. Login Server   (可选，独立服务)
2. Game Server    (Match Server 的依赖)
3. Battle Server  (Match Server 的依赖)
4. Match Server   (最后启动)
```

## 使用方法

### Windows

```batch
# 构建所有服务器
cd E:\weixin_game\gdserver\server
.\build.bat

# 启动所有服务器（自动按正确顺序）
.\start.bat

# 停止所有服务器
.\stop.bat
```

### Linux/Unix

```bash
# 构建所有服务器
cd /path/to/gdserver/server
chmod +x build.sh start.sh stop.sh
./build.sh

# 启动所有服务器
./start.sh all

# 或启动单个服务
./start.sh match

# 停止所有服务器
./stop.sh
```

## 服务端口

| 服务 | 端口 | 协议 |
|-----|------|------|
| Login Server | 8081 | HTTP |
| Game Server | 18080 (WebSocket)<br>12345 (TCP)<br>8691 (gRPC) | Multiple |
| Battle Server | 8693 | gRPC |
| Match Server | 50052 | gRPC |

## 日志文件

所有服务器日志位于 `logs/` 目录：
- `login-server.log`
- `game-server.log`
- `battle-server.log`
- `match-server.log`

## Match Server 配置

Match Server 的依赖服务地址配置在 `src/servers/match/match_service.go`：

```go
const (
    RoomServerAddr = "127.0.0.1:8693"  // Battle Server (Room Server)
    GameServerAddr = "127.0.0.1:8691"  // Game Server
)
```

如果修改了 Game Server 或 Battle Server 的端口，需要相应更新这些配置。

## 验证构建结果

### Windows
```batch
dir bin\*.exe
```

应该看到 4 个可执行文件：
- battle-server.exe
- game-server.exe
- login-server.exe
- match-server.exe

### Linux/Unix
```bash
ls -la bin/
```

应该看到 4 个可执行文件：
- battle-server
- game-server
- login-server
- match-server

## 相关文档

- [STARTUP_ORDER.md](./STARTUP_ORDER.md) - 详细的启动顺序说明
- [README.md](./README.md) - 服务器总体说明

## 注意事项

1. **启动顺序很重要**：Match Server 必须在 Game Server 和 Battle Server 之后启动
2. **等待时间**：每个服务启动后等待 2 秒，确保服务完全初始化
3. **依赖检查**：启动脚本会自动检查依赖服务的可执行文件是否存在
4. **日志监控**：建议启动后查看日志文件，确认服务正常运行
5. **Redis 依赖**：Match Server 需要 Redis，确保 Redis 服务已启动

## 故障排查

### Match Server 启动失败

1. 检查 Game Server 和 Battle Server 是否已启动：
   ```bash
   # Windows
   tasklist | findstr "game-server\|battle-server"
   
   # Linux
   ps aux | grep -E "game-server|battle-server"
   ```

2. 检查端口是否被占用：
   ```bash
   # Windows
   netstat -ano | findstr "50052"
   
   # Linux
   netstat -tlnp | grep 50052
   ```

3. 查看日志文件：
   ```bash
   # Windows
   type logs\match-server.log
   
   # Linux
   tail -f logs/match-server.log
   ```

4. 检查 Redis 连接：
   确保 Redis 服务运行在默认端口 6379

## 测试建议

启动所有服务后，可以通过以下方式验证：

1. 检查所有进程是否运行
2. 检查日志文件是否有错误
3. 测试匹配功能：发送匹配请求，验证 30 秒超时和房间创建逻辑
4. 测试取消匹配功能
5. 验证匹配成功/失败的客户端通知
