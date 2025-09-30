// 调试脚本 - 用于检查游戏状态
console.log("=== 游戏状态调试 ===");

// 获取主游戏实例
const mainInstance = window.main || window.game;
if (mainInstance) {
    console.log("主游戏实例:", mainInstance);
    console.log("调试信息:", mainInstance.getDebugInfo());
    mainInstance.printDebugInfo();
} else {
    console.log("未找到主游戏实例");
}

// 检查GameStateManager
console.log("GameStateManager当前状态:", GameStateManager?.getCurrentState());
console.log("是否认证:", GameStateManager?.isAuthenticated());
console.log("网络状态:", GameStateManager?.getNetworkStatus());

// 检查canvas
console.log("Canvas对象:", canvas);
if (canvas) {
    console.log("Canvas尺寸:", canvas.width, "x", canvas.height);
}

console.log("=================");