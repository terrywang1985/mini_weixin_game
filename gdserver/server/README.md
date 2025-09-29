# 服务器管理脚本使用说明

这里包含了一套完整的服务器管理脚本，可以在不使用 Docker 的情况下管理所有 jigger_protobuf 服务器。

## 📁 脚本列表

### Windows 脚本
- `build.bat` - 构建所有服务器
- `start.bat` - 启动所有服务器
- `stop.bat` - 停止所有服务器

### Linux/macOS 脚本
- `build.sh` - 构建所有服务器
- `start.sh` - 启动所有服务器
- `stop.sh` - 停止所有服务器

## 🚀 使用方法

### Windows 环境

1. **构建服务器**
   ```cmd
   cd server
   .\build.bat
   ```

2. **启动所有服务器**
   ```cmd
   .\start.bat
   ```

3. **停止所有服务器**
   ```cmd
   .\stop.bat
   ```

### Linux/macOS 环境

1. **构建服务器**
   ```bash
   cd server
   ./build.sh
   ```

2. **启动所有服务器**
   ```bash
   ./start.sh
   ```

3. **停止所有服务器**
   ```bash
   ./stop.sh
   ```

## 📂 目录结构

执行脚本后，server 目录结构如下：

```
server/
├── bin/                    # 编译后的二进制文件
│   ├── game-server.exe     # Game Server (Windows)
│   ├── battle-server.exe   # Battle Server (Windows)
│   ├── login-server.exe    # Login Server (Windows)
│   ├── game-server         # Game Server (Linux)
│   ├── battle-server       # Battle Server (Linux)
│   └── login-server        # Login Server (Linux)
├── cfg/                    # 配置文件
│   └── cfg_tbdrawcard.json
├── logs/                   # 日志文件 (Linux/macOS)
│   ├── game-server.log
│   ├── battle-server.log
│   ├── login-server.log
│   ├── game-server.pid
│   ├── battle-server.pid
│   └── login-server.pid
├── src/                    # 源代码
├── build.bat/build.sh      # 构建脚本
├── start.bat/start.sh      # 启动脚本
└── stop.bat/stop.sh        # 停止脚本
```

## 🌐 服务器端口

启动后，各服务器监听以下端口：

- **Login Server**: `http://localhost:8081`
- **Game Server**: 
  - WebSocket: `ws://localhost:18080/ws`
  - TCP: `localhost:12345`
  - gRPC: `localhost:50051`
- **Battle Server**: gRPC: `localhost:50053`

## 📝 注意事项

1. **前置条件**：
   - 确保已安装 Go 1.18+
   - 确保已生成 protobuf 文件（运行 `../tools/gen_proto.bat`）
   - 确保配置文件存在于 `cfg/` 目录

2. **工作目录**：
   - 所有脚本都应在 `server/` 目录下执行
   - 二进制文件在 `bin/` 目录中执行，通过 `../cfg/` 路径加载配置

3. **日志管理**：
   - Windows: 每个服务器在独立窗口中运行，可直接查看日志
   - Linux/macOS: 日志保存在 `logs/` 目录，使用 `tail -f logs/服务器名.log` 查看实时日志

4. **Redis 依赖**：
   - 服务器需要 Redis 服务，请确保 Redis 在 `localhost:6379` 运行
   - 可通过环境变量 `REDIS_ADDR` 自定义 Redis 地址

## 🐛 故障排除

1. **编译失败**：检查 Go 环境和依赖是否正确安装
2. **启动失败**：检查端口是否被占用，配置文件是否存在
3. **Redis 连接失败**：确保 Redis 服务已启动
4. **配置文件找不到**：确保在 `server/` 目录下执行脚本