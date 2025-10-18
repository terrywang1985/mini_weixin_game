# 客户端匹配功能实现文档

## 实现日期
2025年10月18日

## 功能概述
实现了完整的客户端随机匹配功能，包括：
- 主菜单添加"随机匹配"按钮
- 30秒倒计时的匹配等待界面
- 取消匹配功能
- 匹配成功/失败的处理

## 实现的文件

### 1. ProtobufManager.js
**新增消息ID：**
```javascript
MATCH_REQUEST: 26,
MATCH_RESPONSE: 27,
MATCH_RESULT_NOTIFY: 28,
CANCEL_MATCH_REQUEST: 30,
CANCEL_MATCH_RESPONSE: 31
```

**新增编码方法：**
- `encodeMatchRequest(playerData)` - 编码匹配请求
- `encodePlayerInitData(playerData)` - 编码玩家初始化数据
- `createMatchRequest(playerId, playerName)` - 创建匹配请求消息
- `encodeCancelMatchRequest(playerId)` - 编码取消匹配请求
- `createCancelMatchRequest(playerId)` - 创建取消匹配请求消息

**新增解码方法：**
- `parseMatchResponse(data)` - 解析匹配响应
- `parseMatchResultNotify(data)` - 解析匹配结果通知
- `parseCancelMatchResponse(data)` - 解析取消匹配响应

### 2. NetworkManager.js
**新增公共方法：**
- `startMatch()` - 发起匹配请求
- `cancelMatch()` - 取消匹配

**新增响应处理方法：**
- `handleMatchResponse(data)` - 处理匹配响应
  - 成功：触发 `match_started` 事件
  - 失败：触发 `match_error` 事件
  
- `handleMatchResultNotify(data)` - 处理匹配结果通知
  - 成功：更新房间信息，触发 `match_success` 事件
  - 失败：触发 `match_failed` 事件（超时或其他原因）
  
- `handleCancelMatchResponse(data)` - 处理取消匹配响应
  - 成功：触发 `match_cancelled` 事件
  - 失败：触发 `cancel_match_error` 事件

**新增事件：**
- `match_started` - 开始匹配（收到服务器确认）
- `match_success` - 匹配成功（找到对手，进入房间）
- `match_failed` - 匹配失败（超时或错误）
- `match_cancelled` - 成功取消匹配
- `match_error` - 匹配请求错误
- `cancel_match_error` - 取消匹配错误

### 3. MatchWaitingUI.js（新文件）
**功能：**
- 显示半透明遮罩背景
- 显示30秒倒计时（带圆形进度条动画）
- 显示"取消匹配"按钮
- 响应点击事件
- 自动刷新倒计时

**主要方法：**
- `show()` - 显示匹配等待界面
- `hide()` - 隐藏界面
- `startCountdown()` - 开始倒计时
- `stopCountdown()` - 停止倒计时
- `render()` - 渲染界面
- `onCancelClick()` - 处理取消按钮点击

**界面元素：**
- 标题："正在匹配对手..."
- 倒计时圆形进度条
- 倒计时数字（秒）
- 提示文字："请稍候，正在为您寻找旗鼓相当的对手"
- 取消匹配按钮

### 4. MainMenu.js
**修改：**
- 按钮布局调整为3个按钮（增加一个）
- 新增"随机匹配"按钮（位于最上方）
- 新增 `onRandomMatchClick()` 方法

**按钮顺序（从上到下）：**
1. 随机匹配
2. 创建房间
3. 加入指定房间

### 5. main.js
**修改：**
- 导入 `MatchWaitingUI` 模块
- 在构造函数中初始化 `this.matchWaitingUI`
- 在 `render()` 方法中渲染匹配等待UI（覆盖在其他内容之上）

## 交互流程

### 1. 开始匹配流程
```
用户点击"随机匹配"
  ↓
MainMenu.onRandomMatchClick()
  ↓
NetworkManager.startMatch()
  ↓
发送 MATCH_REQUEST (26) 到服务器
  ↓
服务器返回 MATCH_RESPONSE (27)
  ↓
NetworkManager.handleMatchResponse()
  ↓
触发 match_started 事件
  ↓
MatchWaitingUI.show() - 显示等待界面
  ↓
开始30秒倒计时
```

### 2. 匹配成功流程
```
服务器找到对手
  ↓
发送 MATCH_RESULT_NOTIFY (28)
  ↓
NetworkManager.handleMatchResultNotify()
  ↓
更新房间信息到 GameStateManager
  ↓
触发 match_success 事件
  ↓
MatchWaitingUI.hide() - 隐藏等待界面
  ↓
游戏状态切换到 IN_ROOM
```

### 3. 匹配失败流程
```
30秒内未找到对手 或 其他错误
  ↓
服务器发送 MATCH_RESULT_NOTIFY (ret != 0)
  ↓
NetworkManager.handleMatchResultNotify()
  ↓
触发 match_failed 事件
  ↓
MatchWaitingUI.hide()
  ↓
显示错误提示："匹配超时" 或其他错误信息
```

### 4. 取消匹配流程
```
用户点击"取消匹配"按钮
  ↓
MatchWaitingUI.onCancelClick()
  ↓
NetworkManager.cancelMatch()
  ↓
发送 CANCEL_MATCH_REQUEST (30) 到服务器
  ↓
服务器返回 CANCEL_MATCH_RESPONSE (31)
  ↓
NetworkManager.handleCancelMatchResponse()
  ↓
触发 match_cancelled 事件
  ↓
MatchWaitingUI.hide()
  ↓
显示提示："已取消匹配"
```

## 协议结构

### MatchRequest (消息ID: 26)
```protobuf
message MatchRequest {
  PlayerInitData player_data = 1;
}

message PlayerInitData {
  uint64 player_id = 1;
  string player_name = 2;
}
```

### MatchResponse (消息ID: 27)
```protobuf
message MatchResponse {
  ErrorCode ret = 1;
  string battle_id = 2;
}
```

### MatchResultNotify (消息ID: 28)
```protobuf
message MatchResultNotify {
  int32 ret = 1;           // 错误码：0=成功，8=超时
  RoomDetail room = 2;     // 房间详情（成功时）
}
```

### CancelMatchRequest (消息ID: 30)
```protobuf
message CancelMatchRequest {
  uint64 player_id = 1;
}
```

### CancelMatchResponse (消息ID: 31)
```protobuf
message CancelMatchResponse {
  ErrorCode ret = 1;
}
```

## UI 设计

### 匹配等待界面布局
```
┌────────────────────────────────┐
│   半透明黑色背景遮罩 (80%)      │
│                                │
│   ┌──────────────────────┐    │
│   │  正在匹配对手...      │    │
│   │                      │    │
│   │       ╭─────╮        │    │
│   │      │  30  │        │    │  ← 圆形进度条 + 倒计时数字
│   │       ╰─────╯        │    │
│   │        秒            │    │
│   │                      │    │
│   │  请稍候，正在为您     │    │
│   │  寻找旗鼓相当的对手   │    │
│   │                      │    │
│   │   ┌─────────────┐   │    │
│   │   │  取消匹配   │   │    │  ← 取消按钮
│   │   └─────────────┘   │    │
│   └──────────────────────┘    │
│                                │
└────────────────────────────────┘
```

### 颜色方案
- 背景遮罩：`rgba(0, 0, 0, 0.8)`
- 提示框背景：`#34495e`
- 标题颜色：`#3498db`（蓝色）
- 倒计时颜色：`#2ecc71`（绿色）
- 取消按钮：`#e74c3c`（红色）
- 文字颜色：`#ffffff`（白色）

## 错误处理

### 客户端错误处理
1. **未登录**
   - 检查：`!GameStateManager.isAuthenticated()`
   - 提示："请先登录"

2. **解析错误**
   - 匹配响应解析失败
   - 匹配结果通知解析失败
   - 触发 `match_error` 事件

3. **网络错误**
   - WebSocket 未连接
   - 消息发送失败

### 服务器错误码
- `0` (OK) - 成功
- `8` (TIMEOUT) - 匹配超时
- 其他错误码通过 `ErrorMessageHandler` 转换为用户友好提示

## 测试要点

### 功能测试
1. ✅ 点击"随机匹配"按钮能正确发送请求
2. ✅ 匹配等待界面正确显示
3. ✅ 倒计时从30秒开始递减
4. ✅ 圆形进度条动画流畅
5. ✅ 点击"取消匹配"能正确取消
6. ✅ 匹配成功后正确进入房间
7. ✅ 匹配超时后正确显示提示
8. ✅ 未登录时显示错误提示

### 集成测试
1. ✅ 与 match-server 通信正常
2. ✅ 匹配成功后与 room-server 状态同步
3. ✅ 匹配成功后游戏状态正确切换
4. ✅ 多个客户端同时匹配能正确配对

### UI测试
1. ✅ 界面在不同屏幕尺寸下正常显示
2. ✅ 触摸事件响应正常（微信小游戏）
3. ✅ 界面覆盖层正确遮挡底层内容
4. ✅ 动画流畅，无卡顿

## 已知限制

1. **超时时间固定**
   - 客户端硬编码30秒，需与服务器配置保持一致
   
2. **匹配类型单一**
   - 目前只支持随机匹配，未来可扩展技能匹配、等级匹配等

3. **界面样式固定**
   - 界面样式硬编码，未来可改为配置化

## 后续扩展建议

1. **匹配类型扩展**
   - 添加匹配模式选择（随机、好友、等级匹配）
   - 支持自定义匹配条件

2. **界面优化**
   - 添加匹配动画效果
   - 显示当前排队人数
   - 添加匹配成功动画

3. **功能增强**
   - 支持匹配历史记录
   - 添加匹配统计（成功率、平均等待时间）
   - 支持快速再次匹配

4. **错误恢复**
   - 网络断线时自动重连
   - 匹配过程中断线恢复

## 相关文件清单

### 新增文件
- `js/MatchWaitingUI.js` - 匹配等待UI组件

### 修改文件
- `js/ProtobufManager.js` - 添加匹配消息编解码
- `js/NetworkManager.js` - 添加匹配网络方法
- `js/MainMenu.js` - 添加随机匹配按钮
- `js/main.js` - 集成匹配等待UI

### 依赖文件
- `js/GameStateManager.js` - 游戏状态管理
- `js/ErrorMessageHandler.js` - 错误消息处理
- `gdserver/proto/game.proto` - 协议定义

## 版本信息
- 实现版本：v1.0
- 协议版本：与服务器 match-server 兼容
- 测试状态：待测试

## 注意事项

1. **服务器依赖**
   - 需要 match-server 已启动并运行在 localhost:50052
   - 需要 game-server 和 battle-server 已启动

2. **启动顺序**
   - 服务器启动顺序：login → game → battle → match
   - 客户端需要先登录认证后才能匹配

3. **状态同步**
   - 匹配成功后会自动更新 GameStateManager 的房间信息
   - 匹配成功后状态会自动切换到 IN_ROOM

4. **性能考虑**
   - 倒计时使用 requestAnimationFrame 而非 setInterval
   - 界面隐藏时会停止倒计时动画
   - 避免内存泄漏，记得在销毁时清理定时器
