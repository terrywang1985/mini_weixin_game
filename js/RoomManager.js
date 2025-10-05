/**
 * 房间管理器 - 负责管理等待房间和游戏房间之间的切换
 */

import GameStateManager from './GameStateManager.js';
import WaitingRoom from './WaitingRoom.js';
import GameRoom from './GameRoom.js';

class RoomManager {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.networkManager = networkManager;
        
        // 创建两个房间实例
        this.waitingRoom = new WaitingRoom(canvas, networkManager);
        this.gameRoom = new GameRoom(canvas, networkManager);
        
        // 当前活跃的房间
        this.currentRoom = null;
        
        this.init();
    }
    
    init() {
        // 监听游戏状态变化，自动切换房间界面
        GameStateManager.onStateChange((oldState, newState) => {
            this.handleStateChange(oldState, newState);
        });
        
        // 默认显示等待房间
        this.switchToWaitingRoom();
    }
    
    handleStateChange(oldState, newState) {
        console.log(`[RoomManager] 状态切换: ${oldState} -> ${newState}`);
        
        switch (newState) {
            case GameStateManager.GAME_STATES.IN_ROOM:
                this.switchToWaitingRoom();
                break;
            case GameStateManager.GAME_STATES.IN_GAME:
                this.switchToGameRoom();
                break;
            default:
                // 其他状态隐藏所有房间界面
                this.hideAllRooms();
                break;
        }
    }
    
    switchToWaitingRoom() {
        console.log('[RoomManager] 切换到等待房间');
        
        // 隐藏游戏房间
        if (this.gameRoom) {
            this.gameRoom.hide();
        }
        
        // 显示等待房间
        if (this.waitingRoom) {
            this.waitingRoom.show();
            this.currentRoom = this.waitingRoom;
        }
    }
    
    switchToGameRoom() {
        console.log('[RoomManager] 切换到游戏房间');
        
        // 隐藏等待房间
        if (this.waitingRoom) {
            this.waitingRoom.hide();
        }
        
        // 显示游戏房间
        if (this.gameRoom) {
            this.gameRoom.show();
            this.currentRoom = this.gameRoom;
        }
    }
    
    hideAllRooms() {
        console.log('[RoomManager] 隐藏所有房间界面');
        
        if (this.waitingRoom) {
            this.waitingRoom.hide();
        }
        
        if (this.gameRoom) {
            this.gameRoom.hide();
        }
        
        this.currentRoom = null;
    }
    
    // 更新画布尺寸
    updateCanvasSize() {
        if (this.waitingRoom) {
            this.waitingRoom.updateCanvasSize();
        }
        
        if (this.gameRoom) {
            this.gameRoom.updateCanvasSize();
        }
    }
    
    // 获取当前活跃的房间
    getCurrentRoom() {
        return this.currentRoom;
    }
    
    // 销毁管理器
    destroy() {
        if (this.waitingRoom) {
            this.waitingRoom.destroy();
        }
        
        if (this.gameRoom) {
            this.gameRoom.destroy();
        }
        
        this.currentRoom = null;
    }
}

export default RoomManager;