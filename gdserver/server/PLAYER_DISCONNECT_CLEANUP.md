# 玩家断线清理机制

## 问题背景

当玩家断开连接时，如果只清理battle房间而不清理match队列，会导致以下问题：
- 玩家的匹配状态残留在match-server中
- 重新上线后无法再次发起匹配请求
- match-server可能会尝试将已断线的玩家匹配给其他玩家

## 解决方案

在 `player.go` 的 `Run()` 方法的 defer 函数中，添加匹配队列清理逻辑。

### 清理顺序

玩家断开连接时，按以下顺序执行清理：

1. **cleanupBattleRoom()** - 清理battle房间
2. **cleanupMatchQueue()** - 清理匹配队列（新增）
3. **GlobalManager.DeletePlayer()** - 从全局管理器移除玩家
4. **cancelFunc()** - 取消上下文停止所有goroutine
5. **close(RecvChan)** - 关闭接收通道
6. **Conn.Close()** - 关闭网络连接

### 代码实现

#### 1. 在 Run() 的 defer 中调用清理

```go
defer func() {
    // 清理玩家退出时的资源
    // 1. 先清理battle房间
    p.cleanupBattleRoom()
    
    // 2. 清理匹配队列
    p.cleanupMatchQueue()
    
    // 3. 从全局管理器中移除玩家
    GlobalManager.DeletePlayer(p.ConnUUID)
    
    // 4. 取消上下文以停止所有goroutine
    p.cancelFunc()
    
    // 5. 关闭通道
    close(p.RecvChan)
    
    // 6. 关闭连接
    defer p.Conn.Close()

    slog.Info("Player exited and cleaned up", "conn_uuid", p.ConnUUID, "uid", p.Uid)
}()
```

#### 2. cleanupMatchQueue() 实现

```go
// cleanupMatchQueue 清理玩家在匹配队列中的状态
func (p *Player) cleanupMatchQueue() {
	if p.Uid == 0 {
		return // 未认证的玩家不需要清理
	}

	slog.Info("Cleaning up match queue for disconnected player", "player_id", p.Uid)

	// 连接到MatchServer清理匹配队列
	conn, err := grpc.Dial(
		"127.0.0.1:50052",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(2*time.Second),
	)
	if err != nil {
		slog.Error("Failed to connect to MatchServer for cleanup", "player_id", p.Uid, "error", err)
		return
	}
	defer conn.Close()

	client := pb.NewMatchServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 发送取消匹配请求
	cancelMatchReq := &pb.CancelMatchRpcRequest{
		PlayerId: p.Uid,
	}

	resp, err := client.CancelMatch(ctx, cancelMatchReq)
	if err != nil {
		slog.Error("Failed to cleanup match queue", "player_id", p.Uid, "error", err)
		return
	}

	if resp.Ret == pb.ErrorCode_OK {
		slog.Info("Successfully cleaned up match queue", "player_id", p.Uid)
	} else {
		slog.Warn("Match queue cleanup returned error", "player_id", p.Uid, "error_code", resp.Ret)
	}
}
```

### 技术细节

#### RPC 调用参数
- **服务地址**: `127.0.0.1:50052` (match-server端口)
- **连接超时**: 2秒
- **RPC超时**: 3秒
- **服务接口**: `pb.NewMatchServiceClient(conn)`
- **RPC方法**: `CancelMatch(ctx, *pb.CancelMatchRpcRequest)`

#### 请求消息
```protobuf
message CancelMatchRpcRequest {
  uint64 player_id = 1;
}
```

#### 响应处理
- **成功**: `resp.Ret == pb.ErrorCode_OK` - 记录日志
- **失败**: 记录警告日志，但不影响后续清理流程
- **连接失败**: 记录错误日志，继续执行其他清理步骤

### 容错设计

1. **未认证玩家跳过**: `if p.Uid == 0 { return }`
2. **连接失败不阻塞**: 如果无法连接match-server，记录错误后继续执行其他清理
3. **RPC失败不阻塞**: 即使CancelMatch调用失败，也不影响其他资源的清理
4. **超时保护**: 使用带超时的context，避免清理过程卡死

### Match-Server 端处理

Match-Server的 `CancelMatch` 方法会：
```go
func (s *OptimizedMatchServer) CancelMatch(ctx context.Context, req *pb.CancelMatchRequest) (*pb.MatchRpcResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	playerID := req.GetPlayerId()
	
	if _, exists := s.matchQueue[playerID]; exists {
		delete(s.matchQueue, playerID)
		delete(s.lastActivity, playerID)
		slog.Info("Player removed from match queue", "player_id", playerID)
	}

	return &pb.MatchRpcResponse{Ret: pb.ErrorCode_OK}, nil
}
```

### 测试场景

#### 场景1: 玩家在匹配中断线
1. 玩家A点击"随机匹配"
2. 等待匹配过程中，玩家A断开连接
3. game-server调用 `cleanupMatchQueue()`
4. match-server从队列中移除玩家A
5. 玩家A重新上线后可以正常发起新的匹配请求

#### 场景2: 玩家未在匹配中断线
1. 玩家B在主菜单界面
2. 玩家B断开连接
3. game-server调用 `cleanupMatchQueue()`
4. match-server发现玩家B不在队列中
5. 返回成功，不影响清理流程

#### 场景3: Match-Server不可用
1. 玩家C断开连接
2. match-server未启动或崩溃
3. `cleanupMatchQueue()` 连接失败
4. 记录错误日志，继续执行battle房间清理等其他步骤
5. 不影响玩家连接的正常关闭

### 日志示例

#### 成功清理
```
INFO: Cleaning up match queue for disconnected player, player_id=12345
INFO: Successfully cleaned up match queue, player_id=12345
```

#### 玩家不在队列中
```
INFO: Cleaning up match queue for disconnected player, player_id=12345
INFO: Successfully cleaned up match queue, player_id=12345
// match-server日志: WARN: Player not in match queue, player_id=12345
```

#### 连接失败
```
INFO: Cleaning up match queue for disconnected player, player_id=12345
ERROR: Failed to connect to MatchServer for cleanup, player_id=12345, error=dial tcp 127.0.0.1:50052: connect: connection refused
```

## 为什么要先清理Battle再清理Match

清理顺序的设计考虑：

1. **Battle房间优先级更高**: 如果玩家正在游戏中，battle房间需要立即通知其他玩家
2. **Match队列相对独立**: 匹配队列清理失败不影响已进行的游戏
3. **状态一致性**: 先退出实际游戏，再退出等待队列，逻辑更清晰

## 注意事项

1. **超时设置**: 清理操作的总超时不应超过连接关闭的容忍时间
2. **错误处理**: 清理失败不应阻止连接的正常关闭
3. **日志记录**: 详细记录清理过程，便于排查问题
4. **并发安全**: cleanupMatchQueue可能与其他goroutine并发执行，需要match-server端保证线程安全

## 相关文件

- `gdserver/server/src/servers/game/player.go` - 玩家清理逻辑
- `gdserver/server/src/servers/match/match_service.go` - Match服务端处理
- `gdserver/proto/match_service.proto` - RPC接口定义

## 修改历史

- 2025-10-18: 初始版本，添加匹配队列清理逻辑
