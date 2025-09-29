/**
 * 微信小游戏Canvas测试
 */

console.log("开始Canvas测试...");

// 测试canvas获取
function testCanvas() {
    try {
        let canvas;
        
        if (typeof wx !== 'undefined') {
            console.log("微信小游戏环境");
            
            // 获取系统信息
            const systemInfo = wx.getSystemInfoSync();
            console.log("系统信息:", systemInfo);
            
            // 尝试获取canvas
            if (wx.createCanvas) {
                canvas = wx.createCanvas();
                console.log("使用wx.createCanvas()创建canvas");
            } else if (typeof canvas !== 'undefined') {
                console.log("使用全局canvas对象");
            } else {
                console.error("无法获取canvas对象");
                return;
            }
            
            // 设置canvas尺寸
            canvas.width = systemInfo.windowWidth;
            canvas.height = systemInfo.windowHeight;
            
        } else {
            console.log("浏览器环境");
            canvas = document.createElement('canvas');
            canvas.width = 375;
            canvas.height = 667;
            document.body.appendChild(canvas);
        }
        
        console.log(`Canvas尺寸: ${canvas.width}x${canvas.height}`);
        
        // 获取绘图上下文
        const ctx = canvas.getContext('2d');
        if (ctx) {
            console.log("✅ 成功获取2D绘图上下文");
            
            // 绘制测试内容
            ctx.fillStyle = '#2c3e50';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Canvas测试成功！', canvas.width / 2, canvas.height / 2);
            
            console.log("✅ Canvas测试完成");
        } else {
            console.error("❌ 无法获取2D绘图上下文");
        }
        
    } catch (error) {
        console.error("❌ Canvas测试失败:", error);
    }
}

// 在微信小游戏环境中执行测试
if (typeof wx !== 'undefined') {
    wx.onShow(() => {
        setTimeout(testCanvas, 100);
    });
} else {
    // 浏览器环境
    document.addEventListener('DOMContentLoaded', testCanvas);
}

export { testCanvas };