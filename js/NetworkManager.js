/**
 * 网络管理器 - 处理HTTP登录和WebSocket通信
 * 参考Godot NetworkManager.gd实现
 */

import ProtobufManager from './ProtobufManager.js';
import GameStateManager from './GameStateManager.js';

class NetworkManager {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.clientId = "";
        this.messageSerialNo = 0;
        this.sessionToken = "";
        this.gatewayUrl = "";
        
        // 服务器配置
        this.loginUrl = "http://localhost:8081/login";
        this.websocketUrl = "";
        
        // 用户信息
        this.userUid = 0;
        this.userNickname = "";
        this.currentRoomId = "";
        
        // 消息缓冲区
        this.messageBuffer = new ArrayBuffer(0);
        
        // Protobuf管理器
        this.protobuf = new ProtobufManager();
        
        // 事件回调
        this.callbacks = {};
        
        // 绑定this
        this.onWebSocketOpen = this.onWebSocketOpen.bind(this);
        this.onWebSocketMessage = this.onWebSocketMessage.bind(this);
        this.onWebSocketClose = this.onWebSocketClose.bind(this);
        this.onWebSocketError = this.onWebSocketError.bind(this);
    }
    
    // 注册事件回调
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }
    
    // 触发事件
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }
    
    // HTTP游客登录
    async guestLogin(testSuffix = "") {
        console.log("开始HTTP游客登录...");
        
        // 生成唯一的设备ID，确保多窗口不冲突
        const baseDeviceId = "wxgame_" + this.generateDeviceId();
        const windowInstance = Math.floor(Math.random() * 100000); // 窗口实例标识
        const deviceId = testSuffix 
            ? `${baseDeviceId}_test_${testSuffix}_${windowInstance}` 
            : `${baseDeviceId}_${windowInstance}`;
        
        console.log("生成的设备ID:", deviceId);
        
        const loginData = {
            device_id: deviceId,
            app_id: "wxgame_app",
            is_guest: true
        };
        
        try {
            const response = await this.httpRequest(this.loginUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });
            
            const responseData = JSON.parse(response);
            
            if (responseData.success) {
                this.sessionToken = responseData.session_id || "";
                const username = responseData.username || "";
                this.gatewayUrl = responseData.gateway_url || "";
                
                console.log("HTTP游客登录成功！用户名:", username);
                console.log("获得令牌:", this.sessionToken);
                console.log("获得Gateway地址:", this.gatewayUrl);
                
                // 构造WebSocket地址
                this.constructWebSocketUrl();
                
                this.emit('http_login_success', this.sessionToken);
                
                // 继续连接WebSocket
                await this.connectToWebSocket();
                
                return true;
            } else {
                const errorMsg = responseData.error || "游客登录失败";
                console.error("登录失败:", errorMsg);
                this.emit('http_login_failed', errorMsg);
                return false;
            }
        } catch (error) {
            console.error("HTTP请求失败:", error);
            this.emit('http_login_failed', error.message);
            return false;
        }
    }
    
    // 构造WebSocket地址
    constructWebSocketUrl() {
        if (this.gatewayUrl) {
            if (this.gatewayUrl.startsWith("ws://") || this.gatewayUrl.startsWith("wss://")) {
                this.websocketUrl = this.gatewayUrl;
            } else {
                // 构造WebSocket URL
                if (this.gatewayUrl.includes(":")) {
                    const parts = this.gatewayUrl.split(":");
                    this.websocketUrl = `ws://${parts[0]}:18080/ws`;
                } else {
                    this.websocketUrl = `ws://${this.gatewayUrl}:18080/ws`;
                }
            }
        } else {
            // 默认地址
            this.websocketUrl = "ws://127.0.0.1:18080/ws";
        }
        console.log("使用WebSocket地址:", this.websocketUrl);
    }
    
    // 连接WebSocket
    async connectToWebSocket() {
        return new Promise((resolve, reject) => {
            console.log("正在连接WebSocket服务器:", this.websocketUrl);
            
            try {
                // 微信小游戏WebSocket适配
                if (typeof wx !== 'undefined') {
                    console.log("使用微信小游戏WebSocket API");
                    
                    // 微信小游戏环境
                    this.websocket = wx.connectSocket({
                        url: this.websocketUrl,
                        header: {},
                        protocols: [],
                        success: (res) => {
                            console.log("wx.connectSocket success:", res);
                        },
                        fail: (error) => {
                            console.error("wx.connectSocket fail:", error);
                            reject(new Error("微信WebSocket连接创建失败: " + error.errMsg));
                        }
                    });
                    
                    if (this.websocket) {
                        this.websocket.onOpen((event) => {
                            console.log("微信WebSocket已打开");
                            this.onWebSocketOpen(event);
                            resolve(true);
                        });
                        
                        this.websocket.onMessage((event) => {
                            this.onWebSocketMessage(event);
                        });
                        
                        this.websocket.onClose((event) => {
                            console.log("微信WebSocket已关闭:", event);
                            this.onWebSocketClose(event);
                        });
                        
                        this.websocket.onError((event) => {
                            console.error("微信WebSocket错误:", event);
                            this.onWebSocketError(event);
                            reject(new Error("微信WebSocket连接失败"));
                        });
                    } else {
                        reject(new Error("微信WebSocket对象创建失败"));
                    }
                    
                } else {
                    console.log("使用浏览器WebSocket API");
                    // 浏览器环境
                    this.websocket = new WebSocket(this.websocketUrl);
                    this.websocket.binaryType = 'arraybuffer';
                    
                    this.websocket.onopen = (event) => {
                        this.onWebSocketOpen(event);
                        resolve(true);
                    };
                    
                    this.websocket.onmessage = (event) => {
                        this.onWebSocketMessage(event);
                    };
                    
                    this.websocket.onclose = (event) => {
                        this.onWebSocketClose(event);
                    };
                    
                    this.websocket.onerror = (event) => {
                        this.onWebSocketError(event);
                        reject(new Error("WebSocket连接失败"));
                    };
                }
                
            } catch (error) {
                console.error("WebSocket连接失败:", error);
                reject(error);
            }
        });
    }
    
    // WebSocket事件处理
    async onWebSocketOpen(event) {
        this.isConnected = true;
        console.log("WebSocket连接成功");
        
        // 更新网络状态
        GameStateManager.updateNetworkStatus({
            isConnected: true
        });
        
        this.emit('connected');
        
        // 连接成功后立即进行认证
        await this.websocketAuth();
    }
    
    onWebSocketMessage(event) {
        // 微信小游戏和浏览器环境的数据格式适配
        let arrayBuffer;
        
        if (typeof wx !== 'undefined') {
            // 微信小游戏环境
            arrayBuffer = event.data;
        } else {
            // 浏览器环境
            arrayBuffer = event.data;
        }
        
        // 将接收到的数据添加到缓冲区
        const newData = new Uint8Array(arrayBuffer);
        this.appendToBuffer(newData);
        
        // 处理缓冲区中的完整消息
        this.processMessageBuffer();
    }
    
    onWebSocketClose(event) {
        if (this.isConnected) {
            this.isConnected = false;
            console.log("WebSocket连接断开");
            
            // 更新网络状态
            GameStateManager.updateNetworkStatus({
                isConnected: false,
                isAuthenticated: false
            });
            
            this.emit('disconnected');
        }
    }
    
    onWebSocketError(event) {
        console.error("WebSocket错误:", event);
        this.emit('error', event);
    }
    
    // 处理消息缓冲区
    processMessageBuffer() {
        const buffer = new Uint8Array(this.messageBuffer);
        let offset = 0;
        
        while (offset + 4 <= buffer.length) {
            // 读取消息长度（小端序）
            const length = buffer[offset] | 
                          (buffer[offset + 1] << 8) |
                          (buffer[offset + 2] << 16) |
                          (buffer[offset + 3] << 24);
            
            // 检查是否有完整消息
            if (offset + 4 + length > buffer.length) {
                break;
            }
            
            // 提取消息数据
            const messageData = buffer.slice(offset + 4, offset + 4 + length);
            
            // 处理消息
            this.handleMessage(messageData);
            
            // 移动偏移量
            offset += 4 + length;
        }
        
        // 更新缓冲区，移除已处理的数据
        if (offset > 0) {
            const remainingData = buffer.slice(offset);
            this.messageBuffer = remainingData.buffer.slice(remainingData.byteOffset, 
                                                           remainingData.byteOffset + remainingData.byteLength);
        }
    }
    
    // 处理接收到的消息
    handleMessage(data) {
        console.log("收到消息，字节长度:", data.length);
        
        try {
            const parsedMessage = this.protobuf.handleReceivedMessage(data);
            if (!parsedMessage) {
                console.error("消息解析失败");
                return;
            }
            
            // 从解析的消息包装器中提取信息
            const msgId = parsedMessage.id;  // 消息ID
            const msgData = parsedMessage.data;  // 消息数据
            const clientId = parsedMessage.clientId;  // 客户端ID
            const serialNo = parsedMessage.msgSerialNo;  // 序列号
            
            console.log(`处理消息: ID=${msgId}, 客户端=${clientId}, 序列号=${serialNo}`);
            
            // 根据消息ID处理具体的消息类型
            switch (msgId) {
                case this.protobuf.MESSAGE_IDS.AUTH_RESPONSE:
                    this.handleAuthResponse(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.GET_ROOM_LIST_RESPONSE:
                    this.handleRoomListResponse(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.CREATE_ROOM_RESPONSE:
                    this.handleCreateRoomResponse(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.JOIN_ROOM_RESPONSE:
                    this.handleJoinRoomResponse(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.LEAVE_ROOM_RESPONSE:
                    this.handleLeaveRoomResponse(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.ROOM_STATE_NOTIFICATION:
                    this.handleRoomStateNotification(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.GAME_START_NOTIFICATION:
                    this.handleGameStartNotification(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.GET_READY_RESPONSE:
                    this.handleGetReadyResponse(msgData);
                    break;
                case this.protobuf.MESSAGE_IDS.GAME_ACTION_NOTIFICATION:
                    this.handleGameActionNotification(msgData);
                    break;
                default:
                    console.log("未知的消息ID:", msgId);
            }
        } catch (error) {
            console.error("消息处理失败:", error);
        }
    }
    
    // WebSocket认证
    async websocketAuth() {
        if (!this.sessionToken) {
            console.error("没有有效的session_token，无法进行认证");
            return;
        }
        
        console.log("初始化Protobuf管理器...");
        
        // 初始化protobuf管理器
        try {
            await this.protobuf.initialize();
            console.log("Protobuf管理器初始化成功");
        } catch (error) {
            console.error("Protobuf管理器初始化失败:", error);
            return;
        }
        
        console.log("发送WebSocket认证请求...");
        
        const deviceId = "wxgame_" + this.generateDeviceId();
        const finalPacket = this.protobuf.createAuthRequest(this.sessionToken, deviceId);
        
        if (this.isWebSocketConnected()) {
            this.sendWebSocketMessage(finalPacket);
            console.log("认证请求已发送");
        } else {
            console.error("WebSocket未连接，无法发送认证请求");
        }
    }
    
    // 获取房间列表
    getRoomList() {
        console.log("请求房间列表");
        const finalPacket = this.protobuf.createGetRoomListRequest();
        this.sendWebSocketMessage(finalPacket);
    }
    
    // 创建房间
    createRoom(roomName) {
        console.log("创建房间:", roomName);
        const finalPacket = this.protobuf.createCreateRoomRequest(roomName);
        this.sendWebSocketMessage(finalPacket);
    }
    
    // 加入房间
    joinRoom(roomId) {
        console.log("加入房间:", roomId);
        this.currentRoomId = roomId;
        const finalPacket = this.protobuf.createJoinRoomRequest(roomId);
        this.sendWebSocketMessage(finalPacket);
    }
    
    // 发送准备状态（传自己playerId即可，服务器内部翻转 or 标记准备）
    sendReady(playerId) {
        const pidStr = String(playerId);
        console.log("发送准备请求 playerId:", pidStr);
        const finalPacket = this.protobuf.createGetReadyRequest(pidStr);
        this.sendWebSocketMessage(finalPacket);
    }
    
    // 离开房间
    leaveRoom() {
        if (!this.currentRoomId) {
            console.log("没有当前房间ID，无法离开房间");
            return;
        }
        
        console.log("离开房间:", this.currentRoomId);
        const finalPacket = this.protobuf.createLeaveRoomRequest(this.userUid);
        this.sendWebSocketMessage(finalPacket);
        this.currentRoomId = "";
    }
    
    // 发送准备请求
    sendGetReadyRequest() {
        if (!this.currentRoomId) {
            console.log("无法发送准备请求: 当前没有在任何房间中");
            return;
        }
        const pidStr = String(this.userUid);
        console.log("发送准备请求（别名）:", pidStr);
        const finalPacket = this.protobuf.createGetReadyRequest(pidStr);
        this.sendWebSocketMessage(finalPacket);
    }
    
    // 发送WebSocket消息的通用方法
    sendWebSocketMessage(data) {
        if (this.isWebSocketConnected()) {
            if (typeof wx !== 'undefined') {
                // 微信小游戏环境
                this.websocket.send({
                    data: data
                });
            } else {
                // 浏览器环境
                this.websocket.send(data);
            }
        } else {
            console.error("WebSocket未连接，无法发送消息");
        }
    }
    
    // 检查WebSocket连接状态
    isWebSocketConnected() {
        if (!this.websocket) {
            return false;
        }
        
        if (typeof wx !== 'undefined') {
            // 微信小游戏环境，检查isConnected标志
            return this.isConnected;
        } else {
            // 浏览器环境，检查readyState
            return this.websocket.readyState === WebSocket.OPEN;
        }
    }
    
    // 工具方法
    generateDeviceId() {
        // 增强的设备ID生成，确保多窗口唯一性
        const timestamp = Date.now().toString(36);
        const random1 = Math.random().toString(36).substr(2, 9);
        const random2 = Math.random().toString(36).substr(2, 5);
        const windowId = Math.floor(Math.random() * 10000).toString(36);
        
        // 添加性能时间戳作为额外的唯一性保证
        const perfTime = (typeof performance !== 'undefined' && performance.now) 
            ? Math.floor(performance.now() * 1000).toString(36) 
            : Math.floor(Math.random() * 1000000).toString(36);
            
        return `${timestamp}_${random1}_${random2}_${windowId}_${perfTime}`;
    }
    
    // HTTP请求封装（微信小游戏环境）
    httpRequest(url, options) {
        return new Promise((resolve, reject) => {
            if (typeof wx !== 'undefined' && wx.request) {
                // 微信小游戏环境
                wx.request({
                    url: url,
                    method: options.method || 'GET',
                    header: options.headers || {},
                    data: options.body ? JSON.parse(options.body) : {},
                    success: (res) => {
                        resolve(JSON.stringify(res.data));
                    },
                    fail: (error) => {
                        reject(new Error(error.errMsg || '网络请求失败'));
                    }
                });
            } else {
                // 开发环境或其他环境，使用fetch
                fetch(url, options)
                    .then(response => response.text())
                    .then(resolve)
                    .catch(reject);
            }
        });
    }
    
    // 添加数据到缓冲区
    appendToBuffer(newData) {
        const oldBuffer = new Uint8Array(this.messageBuffer);
        const newBuffer = new Uint8Array(oldBuffer.length + newData.length);
        newBuffer.set(oldBuffer);
        newBuffer.set(newData, oldBuffer.length);
        this.messageBuffer = newBuffer.buffer;
    }
    
    // 断开连接
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.isConnected = false;
    }
    
    // 处理认证响应
    handleAuthResponse(data) {
        const response = this.protobuf.parseAuthResponse(data);
        if (!response) return;
        
        if (response.ret === 0) {
            this.userUid = response.uid;
            this.userNickname = response.nickname;
            this.clientId = response.conn_id;
            
            // 更新游戏状态
            GameStateManager.setUserInfo({
                uid: this.userUid,
                nickname: this.userNickname,
                isGuest: response.is_guest,
                sessionToken: this.sessionToken,
                clientId: this.clientId
            });
            
            GameStateManager.updateNetworkStatus({
                isAuthenticated: true
            });
            
            GameStateManager.setGameState(GameStateManager.GAME_STATES.MAIN_MENU);
            
            this.emit('auth_success', {
                uid: this.userUid,
                nickname: this.userNickname,
                is_guest: response.is_guest
            });
            
            console.log("认证成功:", this.userNickname);
        } else {
            const errorMsg = response.error_msg || "认证失败";
            this.emit('auth_failed', errorMsg);
            console.error("认证失败:", errorMsg);
        }
    }
    
    // 处理房间列表响应
    handleRoomListResponse(data) {
        const response = this.protobuf.parseRoomListResponse(data);
        if (!response) return;
        
        if (response.ret === 0) {
            GameStateManager.setRoomList(response.rooms);
            this.emit('room_list_received', response.rooms);
            console.log("收到房间列表，共", response.rooms.length, "个房间");
        } else {
            console.error("获取房间列表失败");
        }
    }
    
    // 处理创建房间响应
    handleCreateRoomResponse(data) {
        const response = this.protobuf.parseCreateRoomResponse(data);
        if (!response) return;
        
        if (response.ret === 0 && response.room) {
            this.currentRoomId = response.room.id;
            GameStateManager.joinRoom(response.room);
            GameStateManager.updateRoomPlayers(response.players);
            
            this.emit('room_created', response.room);
            console.log("房间创建成功:", response.room.name);
        } else {
            console.error("创建房间失败");
        }
    }
    
    // 处理加入房间响应
    handleJoinRoomResponse(data) {
        const response = this.protobuf.parseJoinRoomResponse(data);
        if (!response) return;
        
        if (response.ret === 0 && response.room) {
            this.currentRoomId = response.room.id;
            GameStateManager.joinRoom(response.room);
            GameStateManager.updateRoomPlayers(response.players);
            
            this.emit('room_joined');
            console.log("加入房间成功");
        } else {
            console.error("加入房间失败");
        }
    }
    
    // 处理离开房间响应
    handleLeaveRoomResponse(data) {
        const response = this.protobuf.deserializeMessage(data);
        if (!response) return;
        
        if (response.ret === 0) {
            console.log("离开房间成功");
            this.currentRoomId = "";
        } else {
            console.error("离开房间失败");
        }
    }
    
    // 处理房间状态通知
    handleRoomStateNotification(data) {
        const roomInfo = this.protobuf.parseRoomStateNotification(data);
        if (!roomInfo) return;
        
        GameStateManager.setCurrentRoom(roomInfo.room);
        GameStateManager.updateRoomPlayers(roomInfo.players);
        
        this.emit('room_state_updated', roomInfo);
        console.log("收到房间状态通知");
    }
    
    // 处理游戏开始通知
    handleGameStartNotification(data) {
        const notification = this.protobuf.parseGameStartNotification(data);
        if (!notification) {
            console.error('[Network] 解析游戏开始通知失败: notification为空');
            return;
        }

        console.log('[Network] 原始 game_start_notification 解析结果:', notification);

        // 容错：room_id 兜底
        if (!notification.room_id) {
            const fallbackId = this.currentRoomId || GameStateManager.currentRoom?.id || '';
            if (fallbackId) {
                console.warn('[Network] game_start_notification room_id 缺失, 使用兜底:', fallbackId);
                notification.room_id = fallbackId;
            } else {
                console.error('[Network] 无法兜底 room_id (currentRoomId 与 GameStateManager.currentRoom.id 都为空)');
            }
        }

        // 玩家列表同步
        const parsedPlayers = notification.players || [];
        if (parsedPlayers.length > 0) {
            console.log('[Network] 通知包含玩家列表, count=', parsedPlayers.length);
            GameStateManager.updateRoomPlayers(parsedPlayers);
        } else {
            console.warn('[Network] 通知不含玩家列表, 保持现有列表 count=', GameStateManager.currentRoom.playerList?.length || 0);
        }

        // 状态切换前记录
        console.log('[Network] 准备切换到 IN_GAME, 当前状态=', GameStateManager.currentState, ' roomId=', notification.room_id);

        if (GameStateManager.currentState !== GameStateManager.GAME_STATES.IN_GAME) {
            GameStateManager.startGame();
        } else {
            console.log('[Network] 已在 IN_GAME, 不重复调用 startGame');
        }

        // 发事件供 UI 界面刷新
        this.emit('game_start_notification', notification);
        console.log('[Network] 已分发 game_start_notification 事件');
    }
    
    // 处理准备响应
    handleGetReadyResponse(data) {
        const response = this.protobuf.parseGetReadyResponse(data);
        if (!response) return;
        
        if (response.success) {
            console.log("[Network] GET_READY_RESPONSE 成功 (不切换状态，等待服务器广播房间/开始通知)");
            // 可以触发事件通知UI更新
            this.emit('ready_status_updated', response.isReady);
        } else {
            console.error("准备失败:", response.message);
        }
    }
    
    // 处理游戏动作通知
    handleGameActionNotification(data) {
        console.log("收到游戏动作通知，数据长度:", data ? data.length : 'null');
        // 暂时只记录，后续根据游戏需要实现具体逻辑
        if (data && data.length > 0) {
            const hexString = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log('游戏动作通知数据 (hex):', hexString);
        }
    }
}

export default NetworkManager;