/**
 * 游戏状态管理器 - 全局状态管理
 * 管理用户信息、房间状态和游戏数据
 */

class GameStateManager {
    constructor() {
        this.reset();
        
        // 游戏状态枚举
        this.GAME_STATES = {
            LOADING: 'loading',
            LOGIN: 'login',
            MAIN_MENU: 'main_menu',
            ROOM_LIST: 'room_list',
            IN_ROOM: 'in_room',
            IN_GAME: 'in_game'
        };
        
        this.currentState = this.GAME_STATES.LOADING;
        
        // 状态变化回调
        this.stateChangeCallbacks = [];
        this.roomUpdateCallbacks = [];
        this.playerUpdateCallbacks = [];
        this.gameStateUpdateCallbacks = [];
    }
    
    // 重置所有状态
    reset() {
        // 用户信息
        this.userInfo = {
            uid: 0,
            nickname: "",
            isGuest: false,
            sessionToken: "",
            clientId: ""
        };
        
        // 当前房间信息
        this.currentRoom = {
            id: "",
            name: "",
            maxPlayers: 0,
            currentPlayers: 0,
            playerList: []
        };
        
        // 房间列表
        this.roomList = [];
        
        // 网络连接状态
        this.networkStatus = {
            isConnected: false,
            isAuthenticated: false,
            lastHeartbeat: 0
        };
        
        // 游戏数据
        this.gameData = {
            isReady: false,
            gameStarted: false,
            playerPositions: new Map(),
            // 卡牌游戏状态
            gameState: null,
            myHandCards: [],
            currentTurn: -1,
            cardTable: null
        };
    }
    
    // 设置用户信息
    setUserInfo(userInfo) {
        this.userInfo = {
            ...this.userInfo,
            ...userInfo
        };
        console.log("用户信息更新:", this.userInfo);
    }
    
    // 设置当前房间信息
    setCurrentRoom(roomInfo) {
        this.currentRoom = {
            ...this.currentRoom,
            ...roomInfo
        };
        console.log("房间信息更新:", this.currentRoom);
        this.notifyRoomUpdate();
    }
    
    // 更新房间内玩家列表
    updateRoomPlayers(players) {
        this.currentRoom.playerList = players || [];
        this.currentRoom.currentPlayers = this.currentRoom.playerList.length;
        console.log("房间玩家列表更新:", this.currentRoom.playerList);
        this.notifyRoomUpdate();
        this.notifyPlayerUpdate();
    }
    
    // 设置房间列表
    setRoomList(rooms) {
        this.roomList = rooms || [];
        console.log("房间列表更新:", this.roomList);
    }
    
    // 更新网络状态
    updateNetworkStatus(status) {
        this.networkStatus = {
            ...this.networkStatus,
            ...status
        };
        console.log("网络状态更新:", this.networkStatus);
    }
    
    // 设置游戏状态
    setGameState(newState) {
        if (this.currentState === newState) {
            // 避免重复广播
            console.log("[GameStateManager] 忽略重复状态设置:", newState);
            return;
        }
        const oldState = this.currentState;
        this.currentState = newState;
        console.log(`游戏状态变化: ${oldState} -> ${newState}`);
        this.notifyStateChange(oldState, newState);
    }
    
    // 加入房间
    joinRoom(roomInfo) {
        this.setCurrentRoom(roomInfo);
        this.setGameState(this.GAME_STATES.IN_ROOM);
    }
    
    // 离开房间
    leaveRoom() {
        this.currentRoom = {
            id: "",
            name: "",
            maxPlayers: 0,
            currentPlayers: 0,
            playerList: []
        };
        this.gameData.isReady = false;
        this.gameData.gameStarted = false;
        this.setGameState(this.GAME_STATES.MAIN_MENU);
        this.notifyRoomUpdate();
    }
    
    // 设置准备状态
    setReadyState(isReady) {
        this.gameData.isReady = isReady;
        console.log("准备状态:", isReady);
    }
    
    // 开始游戏
    startGame() {
        this.gameData.gameStarted = true;
        this.setGameState(this.GAME_STATES.IN_GAME);
        console.log("游戏开始");
    }
    
    // 结束游戏
    endGame() {
        this.gameData.gameStarted = false;
        this.setGameState(this.GAME_STATES.IN_ROOM);
        console.log("游戏结束");
    }
    
    // 更新玩家位置
    updatePlayerPosition(playerId, position) {
        this.gameData.playerPositions.set(playerId, position);
        console.log(`玩家${playerId}位置更新:`, position);
        this.notifyPlayerUpdate();
    }

    // 更新游戏状态 (卡牌游戏)
    updateGameState(gameState) {
        this.gameData.gameState = gameState;
        this.gameData.currentTurn = gameState.currentTurn;
        this.gameData.cardTable = gameState.cardTable;
        
        // 更新当前玩家的手牌
        const currentUserId = this.userInfo.uid;
        if (currentUserId && gameState.players) {
            const currentPlayer = gameState.players.find(p => p.id === currentUserId);
            if (currentPlayer && currentPlayer.cards) {
                this.gameData.myHandCards = currentPlayer.cards;
                console.log(`[GameStateManager] 更新手牌，数量: ${this.gameData.myHandCards.length}`);
            }
        }
        
        console.log("[GameStateManager] 游戏状态更新:", {
            currentTurn: this.gameData.currentTurn,
            myHandCardsCount: this.gameData.myHandCards.length,
            cardTableCards: this.gameData.cardTable?.cards?.length || 0
        });
        
        // 触发游戏状态更新回调
        this.notifyGameStateUpdate();
    }

    // 获取当前玩家手牌
    getMyHandCards() {
        return [...this.gameData.myHandCards];
    }

    // 获取卡牌桌面状态
    getCardTable() {
        return this.gameData.cardTable ? { ...this.gameData.cardTable } : null;
    }

    // 获取当前回合玩家
    getCurrentTurn() {
        return this.gameData.currentTurn;
    }

    // 检查是否轮到自己
    isMyTurn() {
        if (!this.gameData.gameState || !this.gameData.gameState.players) return false;
        const currentTurnIndex = this.gameData.currentTurn;
        if (currentTurnIndex < 0 || currentTurnIndex >= this.gameData.gameState.players.length) return false;
        
        const currentTurnPlayer = this.gameData.gameState.players[currentTurnIndex];
        return currentTurnPlayer && currentTurnPlayer.id === this.userInfo.uid;
    }
    
    // 获取玩家位置
    getPlayerPosition(playerId) {
        return this.gameData.playerPositions.get(playerId) || { x: 0, y: 0 };
    }
    
    // 获取当前状态
    getCurrentState() {
        return this.currentState;
    }
    
    // 获取用户信息
    getUserInfo() {
        return { ...this.userInfo };
    }
    
    // 获取当前房间信息
    getCurrentRoom() {
        return { ...this.currentRoom };
    }
    
    // 获取房间列表
    getRoomList() {
        return [...this.roomList];
    }
    
    // 获取网络状态
    getNetworkStatus() {
        return { ...this.networkStatus };
    }
    
    // 检查是否在房间中
    isInRoom() {
        return this.currentRoom.id !== "";
    }
    
    // 检查是否已准备
    isReady() {
        return this.gameData.isReady;
    }
    
    // 检查游戏是否已开始
    isGameStarted() {
        return this.gameData.gameStarted;
    }
    
    // 检查是否已认证
    isAuthenticated() {
        return this.networkStatus.isAuthenticated && this.userInfo.uid > 0;
    }
    
    // 检查是否已连接
    isConnected() {
        return this.networkStatus.isConnected;
    }
    
    // 注册状态变化回调
    onStateChange(callback) {
        this.stateChangeCallbacks.push(callback);
    }
    
    // 注册房间更新回调
    onRoomUpdate(callback) {
        this.roomUpdateCallbacks.push(callback);
    }
    
    // 注册玩家更新回调
    onPlayerUpdate(callback) {
        this.playerUpdateCallbacks.push(callback);
    }
    
    // 注册游戏状态更新回调
    onGameStateUpdate(callback) {
        this.gameStateUpdateCallbacks.push(callback);
    }
    
    // 通知状态变化
    notifyStateChange(oldState, newState) {
        this.stateChangeCallbacks.forEach(callback => {
            try {
                callback(oldState, newState);
            } catch (error) {
                console.error("状态变化回调错误:", error);
            }
        });
    }
    
    // 通知房间更新
    notifyRoomUpdate() {
        this.roomUpdateCallbacks.forEach(callback => {
            try {
                callback(this.getCurrentRoom());
            } catch (error) {
                console.error("房间更新回调错误:", error);
            }
        });
    }
    
    // 通知玩家更新
    notifyPlayerUpdate() {
        this.playerUpdateCallbacks.forEach(callback => {
            try {
                callback(this.currentRoom.playerList);
            } catch (error) {
                console.error("玩家更新回调错误:", error);
            }
        });
    }
    
    // 通知游戏状态更新
    notifyGameStateUpdate() {
        this.gameStateUpdateCallbacks.forEach(callback => {
            try {
                callback({
                    handCards: this.getMyHandCards(),
                    cardTable: this.getCardTable(),
                    currentTurn: this.getCurrentTurn(),
                    isMyTurn: this.isMyTurn(),
                    gameState: this.gameData.gameState
                });
            } catch (error) {
                console.error("游戏状态更新回调错误:", error);
            }
        });
    }
    
    // 移除回调
    removeStateChangeCallback(callback) {
        const index = this.stateChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.stateChangeCallbacks.splice(index, 1);
        }
    }
    
    removeRoomUpdateCallback(callback) {
        const index = this.roomUpdateCallbacks.indexOf(callback);
        if (index > -1) {
            this.roomUpdateCallbacks.splice(index, 1);
        }
    }
    
    removePlayerUpdateCallback(callback) {
        const index = this.playerUpdateCallbacks.indexOf(callback);
        if (index > -1) {
            this.playerUpdateCallbacks.splice(index, 1);
        }
    }
    
    // 获取游戏调试信息
    getDebugInfo() {
        return {
            state: this.currentState,
            userInfo: this.userInfo,
            currentRoom: this.currentRoom,
            roomList: this.roomList.length,
            networkStatus: this.networkStatus,
            gameData: {
                isReady: this.gameData.isReady,
                gameStarted: this.gameData.gameStarted,
                playerCount: this.gameData.playerPositions.size
            }
        };
    }
    
    // 打印调试信息
    printDebugInfo() {
        console.log("=== 游戏状态调试信息 ===");
        console.log(this.getDebugInfo());
        console.log("=====================");
    }
}

// 创建全局单例
const gameStateManager = new GameStateManager();

export default gameStateManager;