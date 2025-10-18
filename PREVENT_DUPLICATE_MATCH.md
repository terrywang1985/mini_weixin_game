# 防止重复匹配请求修复

## 问题描述

从日志中发现,用户点击"随机匹配"按钮时,客户端连续发送了两次匹配请求:

### 日志分析

```log
// 第一次请求 (msgSerialNo: 6)
{"time":"2025-10-18T19:18:05.9080764+08:00","level":"INFO","msg":"处理玩家匹配请求","player_id":1093}
{"time":"2025-10-18T19:18:05.9110168+08:00","level":"INFO","msg":"In Send chan coroutine, Sending response","messageLength":29,"message":{"clientId":"wxgame_client_xk37uqamo","msgSerialNo":6,"id":27}}

// 第二次请求 (msgSerialNo: 7) - 0.001秒后
{"time":"2025-10-18T19:18:05.9110168+08:00","level":"INFO","msg":"Received message","message_id":26,"player_id":1093,"message":{"clientId":"wxgame_client_1zxqhvu4s","msgSerialNo":7,"id":26}}
{"time":"2025-10-18T19:18:05.9110168+08:00","level":"INFO","msg":"处理玩家匹配请求","player_id":1093}
{"time":"2025-10-18T19:18:05.9122236+08:00","level":"ERROR","msg":"玩家匹配请求失败，错误码: ","error_code":5}
```

### 客户端日志

```javascript
MainMenu.js:262 点击随机匹配
MainMenu.js:270 [MainMenu] 开始随机匹配
NetworkManager.js:587 [NetworkManager] 匹配请求已发送
MainMenu.js:262 点击随机匹配  // 再次点击!
MainMenu.js:270 [MainMenu] 开始随机匹配
NetworkManager.js:587 [NetworkManager] 匹配请求已发送

// 第一次响应 - 成功
NetworkManager.js:1141 [NetworkManager] 匹配响应: {ret: 0, battle_id: ""}
NetworkManager.js:1145 [NetworkManager] 匹配请求成功，等待匹配结果...
MatchWaitingUI.js:72 [MatchWaitingUI] 显示匹配等待界面

// 第二次响应 - 失败 (已存在)
NetworkManager.js:1141 [NetworkManager] 匹配响应: {ret: 5, battle_id: ""}
NetworkManager.js:1150 [NetworkManager] 匹配失败: 已存在
MatchWaitingUI.js:81 [MatchWaitingUI] 隐藏匹配等待界面
```

### 问题原因

1. **快速连击**: 用户在短时间内(0.001秒)点击了两次"随机匹配"按钮
2. **缺少状态检查**: MainMenu 没有检查当前是否已经在匹配中
3. **异步时序问题**: 第一次请求发送后,`MatchWaitingUI.show()` 被调用,但在第二次点击到达时,可能还没完全渲染
4. **服务器返回错误**: 第二次请求被服务器拒绝,返回错误码 5 (ALREADY_EXISTS)
5. **UI闪烁**: 第二次请求失败触发 `match_error`,导致 MatchWaitingUI 立即隐藏
6. **状态设置延迟**: `isMatching` 标志依赖于服务器响应才设置,导致在网络延迟期间无法拦截重复点击

## 解决方案

在 `MainMenu.js` 中添加匹配状态管理,**在发送请求前立即设置状态**,防止重复点击。

### 代码修改

#### 1. 添加状态标志

```javascript
constructor(canvas, networkManager) {
    // ...其他初始化代码
    
    // 匹配状态标志
    this.isMatching = false;
    
    // ...
}
```

#### 2. 监听匹配事件

在 `init()` 方法中添加事件监听器:

```javascript
// 监听匹配状态变化
this.networkManager.on('match_started', () => {
    this.isMatching = true;
    console.log("[MainMenu] 匹配已开始，禁用匹配按钮");
});

this.networkManager.on('match_success', () => {
    this.isMatching = false;
    console.log("[MainMenu] 匹配成功，重置匹配状态");
});

this.networkManager.on('match_failed', () => {
    this.isMatching = false;
    console.log("[MainMenu] 匹配失败，重置匹配状态");
});

this.networkManager.on('match_error', () => {
    this.isMatching = false;
    console.log("[MainMenu] 匹配错误，重置匹配状态");
});

this.networkManager.on('match_cancelled', () => {
    this.isMatching = false;
    console.log("[MainMenu] 匹配已取消，重置匹配状态");
});
```

#### 3. 添加状态检查

修改 `onRandomMatchClick()` 方法:

```javascript
onRandomMatchClick() {
    console.log("点击随机匹配");
    
    if (!GameStateManager.isAuthenticated()) {
        this.showMessage("请先登录");
        return;
    }
    
    // 检查是否已经在匹配中
    if (this.isMatching) {
        console.log("[MainMenu] 已在匹配中，忽略重复点击");
        return;
    }
    
    // 立即设置匹配状态,防止快速双击 (关键修复!)
    this.isMatching = true;
    console.log("[MainMenu] 设置 isMatching = true,防止重复请求");
    
    // 发起匹配请求
    console.log("[MainMenu] 开始随机匹配");
    this.networkManager.startMatch();
}
```

**关键点**: 必须在 `startMatch()` **之前** 设置 `isMatching = true`,而不是等待服务器响应!

### 状态流转

```
初始状态: isMatching = false
    ↓
点击"随机匹配" → 检查 isMatching
    ↓ (false)
立即设置 isMatching = true  ← 关键! 在发送请求前设置
    ↓
发送匹配请求 → NetworkManager.startMatch()
    ↓
[用户再次点击] → 检查 isMatching → (true) → 忽略点击  ← 即使服务器还没响应也能拦截
    ↓
收到 MATCH_RESPONSE (ret=0)
    ↓
触发 match_started 事件 (此时 isMatching 已经是 true)
    ↓
MatchWaitingUI.show() → 显示等待界面
    ↓
收到匹配结果:
  - match_success → isMatching = false
  - match_failed → isMatching = false
  - match_error → isMatching = false
  - match_cancelled → isMatching = false
```

**重要**: 通过在发送请求前立即设置 `isMatching = true`,可以在网络延迟期间也拦截重复点击!

### 防护机制

#### 1. 客户端防护 (本次修复)
- 状态标志 `isMatching` 防止重复发送请求
- 事件驱动的状态管理,自动同步

#### 2. 服务器端防护 (已存在)
- match-server 检查玩家是否已在队列中
- 返回错误码 5 (ALREADY_EXISTS)

#### 3. UI层防护 (已存在)
- MatchWaitingUI 显示时拦截底层点击
- main.js 的事件优先级机制

## 测试场景

### 场景1: 正常匹配
1. 用户点击"随机匹配"
2. `isMatching` 设为 `true`
3. MatchWaitingUI 显示
4. 等待30秒或匹配成功
5. `isMatching` 重置为 `false`

### 场景2: 快速连击
1. 用户快速点击两次"随机匹配"
2. 第一次点击: 发送请求, `isMatching = true`
3. 第二次点击: 检测到 `isMatching = true`, 忽略
4. 只发送一次匹配请求到服务器

### 场景3: 匹配失败后重试
1. 用户点击"随机匹配"
2. 匹配失败 (错误码 5 或其他)
3. 触发 `match_error`, `isMatching = false`
4. 用户可以再次点击"随机匹配"

### 场景4: 取消匹配
1. 用户点击"随机匹配"
2. 点击"取消匹配"按钮
3. 触发 `match_cancelled`, `isMatching = false`
4. 用户可以再次点击"随机匹配"

## 预期日志

修复后的正常日志:

```javascript
// 第一次点击
MainMenu.js:262 点击随机匹配
MainMenu.js:270 [MainMenu] 开始随机匹配
NetworkManager.js:587 [NetworkManager] 匹配请求已发送
NetworkManager.js:1145 [NetworkManager] 匹配请求成功，等待匹配结果...
MainMenu.js:XX [MainMenu] 匹配已开始，禁用匹配按钮
MatchWaitingUI.js:72 [MatchWaitingUI] 显示匹配等待界面

// 第二次点击 - 被拦截
MainMenu.js:262 点击随机匹配
MainMenu.js:XX [MainMenu] 已在匹配中，忽略重复点击
```

## 相关错误码

- **ErrorCode 0 (OK)**: 匹配请求成功
- **ErrorCode 5 (ALREADY_EXISTS)**: 玩家已在匹配队列中

## 文件修改

- `js/MainMenu.js`:
  - 添加 `isMatching` 状态标志
  - 添加匹配事件监听器
  - 修改 `onRandomMatchClick()` 添加状态检查

## 优化建议

### 可选: 按钮禁用样式
```javascript
// 在 render() 方法中根据 isMatching 状态改变按钮外观
buttons.forEach(button => {
    if (button.id === 'random_match' && this.isMatching) {
        // 绘制禁用状态的按钮
        this.ctx.fillStyle = '#95a5a6'; // 灰色
        this.ctx.fillText('匹配中...', x, y);
    }
});
```

### 可选: 触觉反馈
```javascript
if (this.isMatching) {
    console.log("[MainMenu] 已在匹配中，忽略重复点击");
    // 可选: 播放提示音或震动
    if (typeof wx !== 'undefined' && wx.vibrateShort) {
        wx.vibrateShort({ type: 'medium' });
    }
    return;
}
```

## 修改历史

- 2025-10-18: 初始版本,添加 isMatching 状态管理防止重复匹配请求
