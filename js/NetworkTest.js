/**
 * 微信小游戏网络API测试
 */

console.log("开始网络API测试...");

// 测试HTTP请求
function testHTTPRequest() {
    console.log("=== 测试HTTP请求 ===");
    
    if (typeof wx !== 'undefined' && wx.request) {
        console.log("✅ 微信小游戏HTTP API可用");
        
        // 测试简单的HTTP请求
        wx.request({
            url: 'http://127.0.0.1:8081/ping',
            method: 'GET',
            success: (res) => {
                console.log("✅ HTTP请求成功:", res);
            },
            fail: (error) => {
                console.log("⚠️ HTTP请求失败:", error);
            }
        });
    } else {
        console.log("❌ 微信小游戏HTTP API不可用");
        
        // 浏览器环境测试
        if (typeof fetch !== 'undefined') {
            console.log("✅ 浏览器fetch API可用");
        } else {
            console.log("❌ 浏览器fetch API不可用");
        }
    }
}

// 测试WebSocket
function testWebSocket() {
    console.log("=== 测试WebSocket ===");
    
    if (typeof wx !== 'undefined' && wx.connectSocket) {
        console.log("✅ 微信小游戏WebSocket API可用");
        
        // 测试WebSocket连接
        const socket = wx.connectSocket({
            url: 'ws://127.0.0.1:18080/ws',
            header: {},
            protocols: []
        });
        
        socket.onOpen((event) => {
            console.log("✅ WebSocket连接成功");
            socket.close();
        });
        
        socket.onError((event) => {
            console.log("⚠️ WebSocket连接失败:", event);
        });
        
        socket.onClose((event) => {
            console.log("WebSocket连接已关闭");
        });
        
    } else {
        console.log("❌ 微信小游戏WebSocket API不可用");
        
        // 浏览器环境测试
        if (typeof WebSocket !== 'undefined') {
            console.log("✅ 浏览器WebSocket API可用");
        } else {
            console.log("❌ 浏览器WebSocket API不可用");
        }
    }
}

// 测试系统信息
function testSystemInfo() {
    console.log("=== 测试系统信息 ===");
    
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
        try {
            const systemInfo = wx.getSystemInfoSync();
            console.log("✅ 系统信息:", systemInfo);
            console.log(`屏幕尺寸: ${systemInfo.windowWidth}x${systemInfo.windowHeight}`);
            console.log(`平台: ${systemInfo.platform}`);
        } catch (error) {
            console.log("❌ 获取系统信息失败:", error);
        }
    } else {
        console.log("❌ 微信小游戏系统信息API不可用");
    }
}

// 执行所有测试
function runAllTests() {
    testSystemInfo();
    testHTTPRequest();
    testWebSocket();
}

// 在微信小游戏环境中执行测试
if (typeof wx !== 'undefined') {
    wx.onShow(() => {
        setTimeout(runAllTests, 500);
    });

}

export { runAllTests };