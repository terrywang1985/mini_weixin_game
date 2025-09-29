/**
 * 调试消息格式的测试
 */

import ProtobufManager from './ProtobufManager.js';

class MessageDebugger {
    constructor() {
        this.protobuf = new ProtobufManager();
    }
    
    async testMessageCreation() {
        try {
            console.log("=== 消息创建测试 ===");
            
            // 初始化protobuf
            await this.protobuf.initialize();
            console.log("✅ ProtobufManager初始化成功");
            
            // 测试认证请求创建
            const authRequest = this.protobuf.createAuthRequest("test_token", "test_device");
            console.log("认证请求长度:", authRequest.length);
            console.log("认证请求内容:", Array.from(authRequest.slice(0, Math.min(50, authRequest.length))));
            
            // 解析长度头
            if (authRequest.length >= 4) {
                const lengthHeader = new DataView(authRequest.buffer, 0, 4);
                const messageLength = lengthHeader.getUint32(0, true); // 小端序
                console.log("包头指示的消息长度:", messageLength);
                console.log("实际消息体长度:", authRequest.length - 4);
                
                if (messageLength !== authRequest.length - 4) {
                    console.error("❌ 长度不匹配！包头说", messageLength, "但实际是", authRequest.length - 4);
                    
                    // 创建一个简单的测试消息
                    const testMessage = JSON.stringify({
                        token: "test_token",
                        device_id: "test_device",
                        is_guest: true
                    });
                    const testBytes = new TextEncoder().encode(testMessage);
                    console.log("测试消息长度:", testBytes.length);
                    console.log("测试消息内容:", testMessage);
                    
                    // 手动创建正确的包
                    const correctPacket = this.createCorrectPacket(testBytes);
                    console.log("修正后的包长度:", correctPacket.length);
                    
                    return correctPacket;
                }
            }
            
            return authRequest;
            
        } catch (error) {
            console.error("❌ 消息创建测试失败:", error);
            return null;
        }
    }
    
    createCorrectPacket(messageBytes) {
        const length = messageBytes.length;
        const headerBytes = new ArrayBuffer(4);
        const headerView = new DataView(headerBytes);
        
        // 小端序写入长度
        headerView.setUint32(0, length, true);
        
        // 合并头部和消息体
        const result = new Uint8Array(4 + messageBytes.length);
        result.set(new Uint8Array(headerBytes), 0);
        result.set(messageBytes, 4);
        
        console.log("创建包: 头部长度=4, 消息长度=", length, "总长度=", result.length);
        
        return result;
    }
    
    async testWebSocketConnection() {
        console.log("=== WebSocket连接测试 ===");
        
        if (typeof wx !== 'undefined') {
            console.log("微信小游戏环境");
            
            // 测试一个简单的WebSocket连接
            const testUrl = 'ws://127.0.0.1:18080/ws';
            console.log("尝试连接:", testUrl);
            
            const socket = wx.connectSocket({
                url: testUrl,
                header: {},
                protocols: [],
                success: (res) => {
                    console.log("✅ WebSocket创建成功:", res);
                },
                fail: (error) => {
                    console.error("❌ WebSocket创建失败:", error);
                }
            });
            
            if (socket) {
                socket.onOpen((event) => {
                    console.log("✅ WebSocket连接已打开");
                    
                    // 发送测试消息
                    const testPacket = this.createCorrectPacket(
                        new TextEncoder().encode('{"test": "message"}')
                    );
                    
                    socket.send({
                        data: testPacket.buffer
                    });
                    
                    console.log("发送了测试消息");
                });
                
                socket.onError((event) => {
                    console.error("❌ WebSocket错误:", event);
                });
                
                socket.onClose((event) => {
                    console.log("WebSocket已关闭");
                });
            }
        } else {
            console.log("非微信小游戏环境，跳过WebSocket测试");
        }
    }
}

export default MessageDebugger;