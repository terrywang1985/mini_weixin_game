/**
 * 使用新房间管理系统的示例代码
 * 
 * 这个文件展示了如何使用拆分后的 WaitingRoom、GameRoom 和 RoomManager
 */

import RoomManager from './RoomManager.js';
import NetworkManager from './NetworkManager.js';

// 初始化示例
function initializeGame() {
    const canvas = document.getElementById('gameCanvas');
    const networkManager = new NetworkManager();
    
    // 创建房间管理器，它会自动管理 WaitingRoom 和 GameRoom
    const roomManager = new RoomManager(canvas, networkManager);
    
    // 房间管理器会根据 GameStateManager 的状态自动切换界面
    // 不需要手动管理房间切换
    
    // 如果需要手动控制，可以使用以下方法：
    // roomManager.switchToWaitingRoom(); // 切换到等待房间
    // roomManager.switchToGameRoom();    // 切换到游戏房间
    // roomManager.hideAllRooms();        // 隐藏所有房间界面
    
    console.log('游戏初始化完成，使用新的房间管理系统');
    
    return roomManager;
}

// 在原来使用 GameRoom 的地方，现在使用 RoomManager
// 例如在 main.js 中：
/*
// 替换原来的代码：
// const gameRoom = new GameRoom(canvas, networkManager);

// 使用新的代码：
const roomManager = new RoomManager(canvas, networkManager);
*/

export { initializeGame };