# 统一化 Docker 部署说明

## 🎯 优化概述

我们将原来的多个独立 Dockerfile 统一为一个 `Dockerfile.unified`，通过参数化启动脚本实现不同服务的启动。

## 📁 文件结构

```
docker/
├── Dockerfile.unified     # 统一的 Dockerfile（新）
├── Dockerfile.game        # 原游戏服务 Dockerfile（保留用于参考）
├── Dockerfile.battle      # 原战斗服务 Dockerfile（保留用于参考）
├── Dockerfile.login       # 原登录服务 Dockerfile（保留用于参考）
└── Dockerfile.match       # 原匹配服务 Dockerfile（保留用于参考）
```

## 🔧 工作原理

### 统一构建过程

1. **复制完整服务器代码**：将整个 `server/` 目录复制到容器中
2. **执行统一构建**：运行 `build.sh` 构建所有服务器
3. **参数化启动**：通过修改后的 `start.sh` 脚本支持单服务启动

### 参数化启动脚本

修改后的 `start.sh` 支持以下参数：

```bash
./start.sh login   # 只启动登录服务器
./start.sh game    # 只启动游戏服务器
./start.sh battle  # 只启动战斗服务器
./start.sh all     # 启动所有服务器（默认）
```

## 🐳 Docker Compose 配置

每个服务使用相同的镜像，但通过不同的 `command` 参数启动：

```yaml
# 登录服务
login-server:
  build:
    dockerfile: docker/Dockerfile.unified
  command: ["./start.sh", "login"]
  
# 游戏服务
game-server:
  build:
    dockerfile: docker/Dockerfile.unified
  command: ["./start.sh", "game"]
  
# 战斗服务
battle-server:
  build:
    dockerfile: docker/Dockerfile.unified
  command: ["./start.sh", "battle"]
```

## ✅ 优势

1. **统一性**：所有容器内容完全一致，避免差异导致的问题
2. **简化维护**：只需维护一个 Dockerfile
3. **灵活性**：可以轻松添加新服务，只需修改启动脚本
4. **一致性**：本地开发和容器部署使用相同的构建和启动逻辑
5. **减少重复**：避免多个 Dockerfile 中的重复代码

## 🚀 使用方法

### 构建并启动所有服务

```bash
docker-compose up -d --build
```

### 只启动特定服务

```bash
# 只启动登录服务
docker-compose up -d login-server

# 只启动游戏服务
docker-compose up -d game-server

# 只启动战斗服务
docker-compose up -d battle-server
```

### 查看服务日志

```bash
# 查看特定服务日志
docker-compose logs -f game-server

# 查看所有服务日志
docker-compose logs -f
```

## 🔍 调试和开发

### 进入容器调试

```bash
# 进入游戏服务器容器
docker-compose exec game-server /bin/bash

# 查看容器内的文件结构
ls -la /app
```

### 单独测试服务

```bash
# 构建镜像
docker build -f docker/Dockerfile.unified -t jigger-unified .

# 测试启动登录服务
docker run --rm -p 8081:8081 jigger-unified ./start.sh login

# 测试启动游戏服务
docker run --rm -p 18080:18080 -p 12345:12345 -p 50051:50051 jigger-unified ./start.sh game
```

## 📊 对比表

| 项目 | 原方案 | 统一方案 |
|------|--------|----------|
| Dockerfile 数量 | 4 个独立文件 | 1 个统一文件 |
| 镜像大小 | 各不相同 | 完全一致 |
| 维护复杂度 | 高（需同步修改） | 低（只需修改一处） |
| 构建时间 | 各自构建 | 一次构建全部 |
| 一致性保证 | 依赖手动同步 | 天然一致 |

这种统一化的方案大大简化了部署和维护的复杂度，同时保证了所有服务的一致性。