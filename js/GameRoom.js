/**
 * 游戏房间页面 - 6格玩家位置布局
 */

import GameStateManager from './GameStateManager.js';
import HandCardArea from './HandCardArea.js';

class GameRoom {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.networkManager = networkManager;
        
        // 页面状态
        this.isVisible = false;
        this.roomInfo = null;
        this.players = [];
        
        // 界面配置
        this.config = {
            backgroundColor: '#2c3e50',
            gridColor: '#34495e',
            playerSlotColor: '#3498db',
            emptySlotColor: '#7f8c8d',
            readySlotColor: '#27ae60',
            avatarColor: '#e74c3c',
            textColor: '#ffffff',
            
            // 6格布局配置 (2行3列)
            gridRows: 2,
            gridCols: 3,
            gridSpacing: 10,
            
            // 按钮配置
            buttonWidth: 120,
            buttonHeight: 50,
            
            // 头像大小
            avatarSize: 40
        };
        
        // 玩家位置槽 (最多6个玩家)
        this.playerSlots = [];
        this.myPlayerIndex = -1; // 当前玩家在哪个槽位
        this.isReady = false;
        
        // 按钮状态
        this.readyButton = {
            x: 0, y: 0, width: 0, height: 0,
            isHovered: false,
            text: '准备'
        };
        
        this.leaveButton = {
            x: 0, y: 0, width: 0, height: 0,
            isHovered: false,
            text: '离开房间'
        };
        
        // 手牌区域
        this.handCardArea = new HandCardArea(canvas, this.ctx);
        this.handCardArea.onCardSelect((index, card, previousIndex) => {
            console.log(`[GameRoom] 选择了卡牌 ${index}: ${card.word}`);
            // TODO: 处理卡牌选择逻辑
        });
        
        // 设置出牌回调
        this.handCardArea.onCardPlayed = (cardIndex, card) => {
            this.onPlayCard(cardIndex, card);
        };
        
        // 游戏状态
        this.gameStarted = false;
        
        // 桌面卡牌区域
        this.tableCards = [];
        this.tableArea = {
            x: 0, y: 0, width: 400, height: 200
        };
        
        this.leaveButton = {
            x: 0, y: 0, width: 0, height: 0,
            isHovered: false,
            text: '离开房间'
        };
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        // 监听游戏状态变化
        GameStateManager.onStateChange((oldState, newState) => {
            if (newState === GameStateManager.GAME_STATES.IN_ROOM || newState === GameStateManager.GAME_STATES.IN_GAME) {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // 监听房间更新
        GameStateManager.onRoomUpdate((roomInfo) => {
            this.updateRoomInfo(roomInfo);
        });
        
        // 监听玩家更新
        GameStateManager.onPlayerUpdate((players) => {
            this.updatePlayerList(players);
        });
        
        // 监听网络事件
        this.networkManager.on('room_joined', () => {
            this.onRoomJoined();
        });
        
        this.networkManager.on('room_created', (room) => {
            this.onRoomCreated(room);
        });
        
        this.networkManager.on('game_start_notification', (data) => {
            this.onGameStart(data);
        });
        
        // 监听游戏动作响应
        this.networkManager.on('game_action_failed', (data) => {
            this.onGameActionFailed(data);
        });
        
        this.networkManager.on('game_action_success', () => {
            this.onGameActionSuccess();
        });
    }
    
    bindEvents() {
        // 微信小游戏触摸事件
        if (typeof wx !== 'undefined') {
            wx.onTouchStart((e) => {
                if (!this.isVisible) return;
                
                const touch = e.touches[0];
                const touchX = touch.clientX;
                const touchY = touch.clientY;
                
                this.handleClick(touchX, touchY);
            });
        } else {
            // 浏览器环境的事件处理
            // 鼠标移动事件
            this.canvas.addEventListener('mousemove', (e) => {
                if (!this.isVisible) return;
                
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                this.updateHoverState(mouseX, mouseY);
            });
            
            // 鼠标点击事件
            this.canvas.addEventListener('click', (e) => {
                if (!this.isVisible) return;
                
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                this.handleClick(mouseX, mouseY);
            });
            
            // 触摸事件（移动端浏览器支持）
            this.canvas.addEventListener('touchstart', (e) => {
                if (!this.isVisible) return;
                
                e.preventDefault();
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;
                
                this.handleClick(touchX, touchY);
            });
        }
    }
    
    show() {
        if (this.isVisible) {
            // 避免重复 show 造成不必要的重新布局频繁触发
            // 但仍可选择刷新渲染
            //console.log('[GameRoom] show() 被重复调用');
        } else {
            this.isVisible = true;
        }
        this.setupLayout();
        
        // 注册游戏状态更新回调
        GameStateManager.onGameStateUpdate((gameStateData) => {
            if (this.isVisible) {
                this.onGameStateUpdate(gameStateData);
            }
        });
        
        // 确保当前玩家显示在第一个位置
        const myUser = GameStateManager.getUserInfo();
        console.log("当前用户信息:", myUser);  // 添加调试信息
        
        if (myUser && this.playerSlots.length > 0) {
            // 若服务器已经下发玩家数据，尽量不覆盖其 is_ready 状态
            if (!this.playerSlots[0].player || this.playerSlots[0].player.uid !== myUser.uid) {
                this.playerSlots[0].player = {
                    uid: myUser.uid,
                    nickname: myUser.nickname || '我',
                    avatar: myUser.avatar_url || '',
                    is_ready: this.isReady || false
                };
                console.log("设置玩家槽位信息(初始化):", this.playerSlots[0].player);
            } else {
                // 已存在时，仅确保 nickname 同步
                this.playerSlots[0].player.nickname = myUser.nickname || this.playerSlots[0].player.nickname;
                console.log("保留服务器ready状态:", this.playerSlots[0].player);
            }
            this.myPlayerIndex = 0;
        }
        
        this.render();
        console.log("显示游戏房间");
    }
    
    hide() {
        // 如果已经在 IN_GAME 状态，不允许外部把界面隐藏（防止错误屏）
        if (GameStateManager.currentState === GameStateManager.GAME_STATES.IN_GAME) {
            console.warn('[GameRoom] 处于 IN_GAME，忽略 hide() 调用');
            return;
        }
        this.isVisible = false;
        console.log("隐藏游戏房间");
    }
    
    setupLayout() {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 确保房间ID被正确设置
        if (!this.roomId) {
            if (this.roomInfo && this.roomInfo.id) {
                this.roomId = this.roomInfo.id;
            } else {
                // 如果没有房间信息，使用当前用户ID作为房间ID（后端策略）
                const currentUser = GameStateManager.getUserInfo();
                this.roomId = currentUser?.uid?.toString() || "unknown";
            }
            console.log("在setupLayout中设置房间ID为:", this.roomId);
        }
        
        // 计算格子尺寸和位置 - 整体居中布局
        const totalSpacingX = (this.config.gridCols - 1) * this.config.gridSpacing;
        const totalSpacingY = (this.config.gridRows - 1) * this.config.gridSpacing;
        
        // 更紧凑的格子尺寸
        const slotWidth = 100;  // 固定宽度
        const slotHeight = 100; // 固定高度
        
        // 计算整个网格的尺寸
        const totalGridWidth = this.config.gridCols * slotWidth + totalSpacingX;
        const totalGridHeight = this.config.gridRows * slotHeight + totalSpacingY;
        
        // 居中布局，整体在画布中间
        const startX = (canvasWidth - totalGridWidth) / 2;
        const startY = (canvasHeight - totalGridHeight) / 2 + 40; // 整体下移
        
        // 保存标题位置基准，让标题在格子上方
        this.titleBaseY = startY - 80;
        
        // 保存现有的玩家信息
        const existingPlayers = this.playerSlots ? 
            this.playerSlots.map(slot => ({ player: slot.player, isReady: slot.isReady })) : 
            [];
        
        // 初始化玩家位置槽
        this.playerSlots = [];
        for (let row = 0; row < this.config.gridRows; row++) {
            for (let col = 0; col < this.config.gridCols; col++) {
                const slotIndex = row * this.config.gridCols + col;
                const existingSlot = existingPlayers[slotIndex] || { player: null, isReady: false };
                
                this.playerSlots.push({
                    index: slotIndex,
                    x: startX + col * (slotWidth + this.config.gridSpacing),
                    y: startY + row * (slotHeight + this.config.gridSpacing),
                    width: slotWidth,
                    height: slotHeight,
                    player: existingSlot.player,
                    isReady: existingSlot.isReady
                });
            }
        }
        
        // 设置按钮位置
        const buttonY = canvasHeight - 80;
        
        this.readyButton = {
            x: canvasWidth / 2 - this.config.buttonWidth - 10,
            y: buttonY,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight,
            isHovered: false,
            text: this.isReady ? '取消准备' : '准备'
        };
        
        this.leaveButton = {
            x: canvasWidth / 2 + 10,
            y: buttonY,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight,
            isHovered: false,
            text: '离开房间'
        };
    }
    
    updateHoverState(x, y) {
        // 检查按钮悬停状态
        this.readyButton.isHovered = this.isPointInButton(x, y, this.readyButton);
        this.leaveButton.isHovered = this.isPointInButton(x, y, this.leaveButton);
        
        if (this.readyButton.isHovered || this.leaveButton.isHovered) {
            this.render();
        }
    }
    
    handleClick(x, y) {
        if (!this.isVisible) return;
        
        // 游戏状态下的点击处理
        if (this.gameStarted) {
            // 检查弃牌认输按钮
            if (this.gameExitButton && this.isPointInButton(x, y, this.gameExitButton)) {
                this.onSurrenderClick();
                return;
            }
            
            // 检查是否点击在手牌区域
            if (this.handCardArea && this.handCardArea.isVisible()) {
                // 先检查是否点击了出牌按钮
                if (this.handCardArea.playButton.visible) {
                    const playButton = this.handCardArea.playButton;
                    if (x >= playButton.x && x <= playButton.x + playButton.width &&
                        y >= playButton.y && y <= playButton.y + playButton.height) {
                        // 直接调用手牌区域的出牌方法
                        this.handCardArea.onPlayCard();
                        return;
                    }
                }
                
                // 检查点击坐标是否在手牌区域内（但不在出牌按钮上）
                if (this.handCardArea.isInHandCardArea(x, y)) {
                    // 创建一个模拟的鼠标事件对象
                    const rect = this.canvas.getBoundingClientRect();
                    const simulatedEvent = {
                        clientX: x + rect.left,
                        clientY: y + rect.top,
                        preventDefault: () => {}
                    };
                    
                    // 直接调用手牌区域的点击处理方法
                    this.handCardArea.handleClick(simulatedEvent);
                    return;
                }
            }
        }
        
        // 房间状态下的点击处理
        if (this.isPointInButton(x, y, this.readyButton)) {
            this.onReadyClick();
        } else if (this.isPointInButton(x, y, this.leaveButton)) {
            this.onLeaveClick();
        }
    }
    
    isPointInButton(x, y, button) {
        return x >= button.x && 
               x <= button.x + button.width && 
               y >= button.y && 
               y <= button.y + button.height;
    }
    
    updateRoomInfo(roomInfo) {
        this.roomInfo = roomInfo;
        if (this.isVisible) {
            this.render();
        }
    }
    
    updatePlayerList(players) {
        this.players = players || [];
        
        // 重置所有槽位
        this.playerSlots.forEach(slot => {
            slot.player = null;
            slot.isReady = false;
        });
        
        // 获取当前用户信息
        const myUser = GameStateManager.getUserInfo();
        
        // 首先确保当前玩家在第一个位置
        let myPlayerData = this.players.find(player => player.uid === myUser.uid);
        let otherPlayers = this.players.filter(player => player.uid !== myUser.uid);
        
        // 如果当前玩家不在列表中，创建一个临时的玩家数据
        if (!myPlayerData) {
            myPlayerData = {
                uid: myUser.uid,
                name: myUser.nickname || '我',
                avatar: myUser.avatar_url || '',
                is_ready: false
            };
        }
        
        // 重新排列玩家列表：当前玩家在第一位
        const arrangedPlayers = [myPlayerData, ...otherPlayers];
        
        // 分配玩家到槽位
        arrangedPlayers.forEach((player, index) => {
            if (index < this.playerSlots.length) {
                this.playerSlots[index].player = player;
                this.playerSlots[index].isReady = player.is_ready || false;
                
                // 设置当前玩家的状态
                if (player.uid === myUser.uid) {
                    this.myPlayerIndex = index;
                    this.isReady = player.is_ready || false;
                    
                    // 更新准备按钮文本
                    this.readyButton.text = this.isReady ? '取消准备' : '准备';
                }
            }
        });
        
        if (this.isVisible) {
            this.render();
        }
    }
    
    render() {
        if (!this.isVisible) return;
        
        // 清空画布
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 检查游戏状态
        const currentState = GameStateManager.currentState;
        
        if (currentState === GameStateManager.GAME_STATES.IN_GAME) {
            // 游戏中界面
            this.drawGameScreen();
        } else {
            // 房间准备界面
            this.drawTitle();
            this.drawPlayerSlots();
            this.drawButtons();
        }
        
        // 渲染手牌区域（如果游戏已开始且有手牌）
        if (this.gameStarted && this.handCardArea.isVisible()) {
            this.handCardArea.render();
        }
    }
    
    drawTitle() {
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 使用动态计算的标题位置
        const baseY = this.titleBaseY || 50;
        
        // 主标题
        const title = this.roomInfo ? `房间: ${this.roomInfo.name}` : '游戏房间';
        this.ctx.fillText(title, this.canvas.width / 2, baseY);
        
        // 房间号，放在标题下方
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = '#666';
        this.ctx.fillText(`房间号: ${this.roomId}`, this.canvas.width / 2, baseY + 25);
        
        // 复制房间号提示
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#999';
        this.ctx.fillText('告诉朋友房间号即可加入', this.canvas.width / 2, baseY + 45);
    }
    
    drawPlayerSlots() {
        this.playerSlots.forEach((slot, index) => {
            // 确定槽位颜色
            let slotColor = this.config.emptySlotColor;
            if (slot.player) {
                slotColor = slot.isReady ? this.config.readySlotColor : this.config.playerSlotColor;
            }
            
            // 绘制阴影
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            this.roundRect(slot.x + 3, slot.y + 3, slot.width, slot.height, 8);
            this.ctx.fill();
            
            // 绘制槽位背景（圆角矩形）
            this.ctx.fillStyle = slotColor;
            this.roundRect(slot.x, slot.y, slot.width, slot.height, 8);
            this.ctx.fill();
            
            // 绘制槽位边框
            this.ctx.strokeStyle = slot.player ? '#4CAF50' : this.config.gridColor;
            this.ctx.lineWidth = slot.player ? 3 : 2;
            this.ctx.stroke();
            
            if (slot.player) {
                // 绘制玩家头像（简单的圆形）
                const avatarX = slot.x + slot.width / 2;
                const avatarY = slot.y + slot.height / 2 - 10;
                
                this.ctx.beginPath();
                this.ctx.arc(avatarX, avatarY, this.config.avatarSize / 2, 0, 2 * Math.PI);
                this.ctx.fillStyle = this.config.avatarColor;
                this.ctx.fill();
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
                
                // 绘制玩家名称
                this.ctx.fillStyle = this.config.textColor;
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                
                const nameY = slot.y + slot.height - 25;
                const playerName = `${slot.player.uid}`;  // 只显示UID数字
                this.ctx.fillText(playerName, avatarX, nameY);
                
                // 绘制准备状态
                if (slot.isReady) {
                    this.ctx.fillStyle = '#4CAF50';
                    this.ctx.font = 'bold 12px Arial';
                    this.ctx.fillText('✓ 已准备', avatarX, nameY + 15);
                }
            } else {
                // 空槽位显示等待玩家
                this.ctx.fillStyle = '#999';
                this.ctx.font = '16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('等待玩家', slot.x + slot.width / 2, slot.y + slot.height / 2);
            }
        });
    }
    
    // 绘制圆角矩形的辅助方法
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }
    
    drawButtons() {
        // 绘制准备按钮
        this.drawButton(this.readyButton, this.isReady ? this.config.readySlotColor : this.config.playerSlotColor);
        
        // 绘制离开按钮
        this.drawButton(this.leaveButton, '#e74c3c');
    }
    
    drawButton(button, color) {
        // 绘制按钮背景
        this.ctx.fillStyle = button.isHovered ? this.adjustColor(color, -20) : color;
        this.ctx.fillRect(button.x, button.y, button.width, button.height);
        
        // 绘制按钮边框
        this.ctx.strokeStyle = this.config.textColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(button.x, button.y, button.width, button.height);
        
        // 绘制按钮文字
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const textX = button.x + button.width / 2;
        const textY = button.y + button.height / 2;
        this.ctx.fillText(button.text, textX, textY);
    }
    
    adjustColor(color, amount) {
        // 简单的颜色调整函数
        const hex = color.replace('#', '');
        const num = parseInt(hex, 16);
        const r = Math.max(0, Math.min(255, (num >> 16) + amount));
        const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
        const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    onReadyClick() {
        console.log("点击准备按钮");
        const currentUser = GameStateManager.getUserInfo();
        const playerId = currentUser?.uid;
        if (!playerId) {
            console.warn('当前用户ID不存在，无法发送准备');
            return;
        }
        // 发送准备请求（服务器基于playerId处理准备状态，客户端不再直接切换IN_GAME）
        this.networkManager.sendReady(playerId);
        // 不再本地翻转，等待服务器 RoomStateNotification / GameStartNotification 驱动更新
        console.log('[GameRoom] 已发送准备请求，等待服务器广播状态');
    }
    
    // 弃牌认输点击处理
    onSurrenderClick() {
        console.log("点击弃牌认输");
        
        let shouldSurrender = false;
        
        // 显示确认对话框
        if (typeof wx !== 'undefined') {
            wx.showModal({
                title: '弃牌认输',
                content: '确定要弃牌认输吗？这将结束游戏。',
                success: (res) => {
                    if (res.confirm) {
                        this.sendSurrenderRequest();
                    }
                }
            });
        } else {
            shouldSurrender = confirm('确定要弃牌认输吗？这将结束游戏。');
        }
        
        if (shouldSurrender) {
            this.sendSurrenderRequest();
        }
    }
    
    // 发送认输请求
    sendSurrenderRequest() {
        console.log("发送认输请求");
        // TODO: 发送认输消息到服务器
        // this.networkManager.sendSurrenderMessage();
        
        // 临时处理：直接退出房间
        this.leaveRoom();
    }
    
    // 处理出牌
    onPlayCard(cardIndex, card) {
        console.log(`[GameRoom] 出牌: 索引=${cardIndex}, 卡牌=${card.word}`);
        
        // 检查是否轮到自己
        const gameState = GameStateManager.gameState;
        if (gameState && gameState.gameState) {
            const currentTurn = gameState.gameState.currentTurn;
            const players = gameState.gameState.players || [];
            const currentPlayer = players[currentTurn];
            const userInfo = GameStateManager.getUserInfo();
            
            if (!currentPlayer || currentPlayer.id !== userInfo.uid) {
                console.log('[GameRoom] 不是你的回合，无法出牌');
                
                // 显示提示信息
                if (typeof wx !== 'undefined') {
                    wx.showToast({
                        title: '不是你的回合',
                        icon: 'none',
                        duration: 2000
                    });
                } else {
                    alert('不是你的回合，请等待其他玩家出牌');
                }
                return;
            }
        }
        
        // 发送出牌消息到服务器
        this.sendPlayCardMessage(cardIndex, card);
    }
    
    // 发送出牌消息
    sendPlayCardMessage(cardIndex, card) {
        if (!this.networkManager) {
            console.error("NetworkManager未初始化");
            return;
        }
        
        // 创建出牌动作
        const placeCardAction = {
            cardId: cardIndex,
            targetIndex: this.tableCards.length, // 暂时添加到桌面末尾
            word: card.word,
            wordClass: card.wordClass
        };
        
        console.log(`[GameRoom] 发送出牌消息:`, placeCardAction);
        
        // 通过NetworkManager发送PLACE_CARD动作
        this.networkManager.sendGameAction({
            actionType: 'PLACE_CARD',
            actionDetail: placeCardAction
        });
        
        console.log(`[GameRoom] 出牌请求已发送到服务器`);
    }
    
    // 添加卡牌到桌面
    addCardToTable(card) {
        this.tableCards.push(card);
        console.log(`[GameRoom] 桌面卡牌数量: ${this.tableCards.length}`);
        
        // 注意：手牌的移除应该由服务器状态更新来处理，而不是在这里直接修改
        // 这里只是临时的本地显示更新
        
        this.render();
    }

    onLeaveClick() {
        console.log("点击离开房间");
        
        // 确认对话框
        let shouldLeave = true;
        
        if (typeof wx !== 'undefined' && wx.showModal) {
            wx.showModal({
                title: '离开房间',
                content: '确定要离开房间吗？',
                success: (res) => {
                    if (res.confirm) {
                        this.leaveRoom();
                    }
                }
            });
        } else {
            shouldLeave = confirm('确定要离开房间吗？');
            if (shouldLeave) {
                this.leaveRoom();
            }
        }
    }
    
    leaveRoom() {
        // TODO: 发送离开房间请求到服务器
        // this.networkManager.leaveRoom();
        
        // 临时直接返回主菜单
        GameStateManager.leaveRoom();
    }
    
    onRoomJoined() {
        console.log("成功加入房间");
        this.setupLayout();
    }
    
    onRoomCreated(room) {
        console.log("成功创建房间:", room);
        this.roomInfo = room;
        
        // 获取当前用户的房间ID（服务器使用玩家ID作为房间ID）
        const currentUser = GameStateManager.getUserInfo();
        const actualRoomId = room?.id || currentUser?.uid?.toString() || "unknown";
        
        // 确保房间ID被正确设置
        this.roomId = actualRoomId;
        console.log("设置房间ID为:", this.roomId);
        
        this.setupLayout();
        
        // 模拟创建房间后自动进入房间
        GameStateManager.joinRoom({
            id: actualRoomId,
            name: room?.name || "我的房间",
            maxPlayers: 6,
            currentPlayers: 1,
            playerList: [{
                uid: currentUser.uid,
                nickname: currentUser.nickname,
                is_ready: false
            }]
        });
    }
    
    onGameStart(data) {
        // 服务器广播的正式开始事件
        console.log("[GameRoom] 收到 game_start_notification (服务器确认) :", data);
        if (data) {
            if (!this.roomId && data.room_id) {
                this.roomId = data.room_id;
                console.log('[GameRoom] 根据通知设置 roomId:', this.roomId);
            }
            // 如果通知带玩家列表，更新本地 players（不直接覆盖 GameStateManager.currentRoom.playerList，保持来源一致）
            if (data.players && data.players.length > 0) {
                this.players = data.players;
                console.log('[GameRoom] 通知玩家人数:', data.players.length);
            }
        }
        // 确保当前显示页面仍然是房间界面，渲染逻辑会根据IN_GAME状态显示战斗界面
        if (GameStateManager.currentState === GameStateManager.GAME_STATES.IN_GAME) {
            this.show(); // 再次调用show以防被其他逻辑 hide
            this.render();
        } else {
            console.warn('[GameRoom] 收到开始通知但当前状态不是 IN_GAME:', GameStateManager.currentState);
        }
    }
    
    onGameActionFailed(data) {
        console.log("[GameRoom] 游戏动作失败:", data);
        
        // 显示错误提示
        let message = "操作失败";
        if (data && data.errorMessage) {
            message = data.errorMessage;
        }
        
        // 特殊处理不是回合玩家的情况
        if (data.errorCode === 10) { // INVALID_ACTION
            message = "现在不是你的回合，请等待其他玩家操作";
        }
        
        // 在微信小游戏环境中显示提示
        if (typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            });
        } else {
            // 在浏览器环境中使用alert
            alert(message);
        }
    }
    
    onGameActionSuccess() {
        console.log("[GameRoom] 游戏动作成功");
        // 可以在这里添加成功后的处理逻辑
    }
    
    // 更新画布尺寸
    updateCanvasSize() {
        if (this.isVisible) {
            this.setupLayout();
            this.render();
        }
    }
    
    // 绘制游戏中界面
    drawGameScreen() {
        // 绘制游戏标题 - 考虑刘海屏，向下移动
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const centerX = this.canvas.width / 2;
        
        this.ctx.fillText('游戏进行中', centerX, 70); // 从30改为70，避开刘海屏
        
        // 显示房间信息 - 向下移动
        this.ctx.font = '18px Arial';
        this.ctx.fillStyle = '#666';
        this.ctx.fillText(`房间: ${this.roomInfo ? this.roomInfo.name : this.roomId}`, centerX, 100);
        
        // 显示玩家列表 - 向下移动
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.fillText('参与玩家:', centerX, 130);
        
        // 显示玩家名单 - 向下移动
        const players = this.players || [];
        let playerText = players.map((player, index) => {
            const userInfo = GameStateManager.getUserInfo();
            const name = player.name || player.nickname || 'Unknown';
            return player.uid === userInfo.uid ? `[${name}]` : name;
        }).join(' | ');
        
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.fillText(playerText, centerX, 155);
        
        // 显示当前回合信息
        this.drawCurrentTurnInfo();
        
        // 绘制桌面卡牌 - 放在中央区域
        this.drawTableCards();
        
        // 可以添加退出游戏按钮
        this.drawGameExitButton();
    }
    
    // 绘制当前回合信息
    drawCurrentTurnInfo() {
        const gameState = GameStateManager.gameState;
        if (!gameState || !gameState.gameState) return;
        
        const currentTurn = gameState.gameState.currentTurn;
        const players = gameState.gameState.players || [];
        const currentPlayer = players[currentTurn];
        
        if (currentPlayer) {
            const centerX = this.canvas.width / 2;
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            const userInfo = GameStateManager.getUserInfo();
            const isMyTurn = currentPlayer.id === userInfo.uid;
            
            this.ctx.fillStyle = isMyTurn ? '#4CAF50' : '#FFA726';
            
            const turnText = isMyTurn ? '轮到你出牌' : `轮到 ${currentPlayer.name || 'Unknown'} 出牌`;
            this.ctx.fillText(turnText, centerX, 180); // 从140调整为180
            
            // 如果不是自己的回合，显示提示
            if (!isMyTurn) {
                this.ctx.font = '14px Arial';
                this.ctx.fillStyle = '#999';
                this.ctx.fillText('请等待其他玩家出牌', centerX, 200); // 从160调整为200
            }
        }
    }
    
    // 绘制桌面卡牌
    drawTableCards() {
        // 计算桌面区域 - 考虑刘海屏调整后的位置
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2 - 40; // 从-60调整为-40，给上方更多空间
        this.tableArea.x = centerX - this.tableArea.width / 2;
        this.tableArea.y = centerY - this.tableArea.height / 2;
        
        if (this.tableCards.length === 0) {
            // 绘制空桌面
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(this.tableArea.x, this.tableArea.y, this.tableArea.width, this.tableArea.height);
            this.ctx.setLineDash([]);
            
            this.ctx.fillStyle = '#666';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('桌面 - 暂无卡牌', centerX, centerY);
            return;
        }
        
        // 绘制桌面背景
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(this.tableArea.x, this.tableArea.y, this.tableArea.width, this.tableArea.height);
        
        this.ctx.strokeStyle = '#ccc';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.tableArea.x, this.tableArea.y, this.tableArea.width, this.tableArea.height);
        
        // 绘制桌面标题
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('桌面', this.tableArea.x + this.tableArea.width / 2, this.tableArea.y + 5);
        
        // 绘制桌面卡牌
        const cardWidth = 50;
        const cardHeight = 30;
        const cardSpacing = 5;
        const startX = this.tableArea.x + 10;
        const startY = this.tableArea.y + 30;
        
        this.tableCards.forEach((card, index) => {
            const cardX = startX + (index % 7) * (cardWidth + cardSpacing);
            const cardY = startY + Math.floor(index / 7) * (cardHeight + cardSpacing);
            
            // 绘制卡牌背景
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
            
            // 绘制卡牌边框
            this.ctx.strokeStyle = '#2e7d32';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);
            
            // 绘制卡牌文字
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(card.word, cardX + cardWidth / 2, cardY + cardHeight / 2);
        });
        
        // 绘制当前句子
        if (this.tableCards.length > 0) {
            const sentence = this.tableCards.map(card => card.word).join('');
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`当前句子: ${sentence}`, 
                this.tableArea.x + this.tableArea.width / 2, 
                this.tableArea.y + this.tableArea.height - 20);
        }
    }

    // 绘制弃牌认输按钮
    drawGameExitButton() {
        const buttonWidth = 120;
        const buttonHeight = 40;
        const buttonX = this.canvas.width / 2 - buttonWidth / 2;
        // 上移到手牌区上方，避免遮挡
        const buttonY = this.canvas.height - 200;
        
        // 保存按钮位置信息供点击检测使用
        this.gameExitButton = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        this.ctx.fillStyle = '#ff4444';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        this.ctx.strokeStyle = '#cc0000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('弃牌认输', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
    }
    
    // 销毁页面
    destroy() {
        this.isVisible = false;
        if (this.handCardArea) {
            this.handCardArea.destroy();
        }
    }

    // 处理游戏状态更新
    onGameStateUpdate(gameStateData) {
        // 这个方法由GameStateManager的updateGameState触发
        // 不需要再调用updateGameState，只需要更新UI
        
        // 获取我的手牌
        const myHandCards = GameStateManager.getMyHandCards();
        
        // 更新手牌显示
        if (myHandCards && myHandCards.length > 0) {
            this.handCardArea.setHandCards(myHandCards);
            this.handCardArea.show();
            console.log(`[GameRoom] 手牌更新: ${myHandCards.length} 张`);
        }
        
        // 更新桌面卡牌（从传入的数据中获取）
        if (gameStateData.gameState && gameStateData.gameState.cardTable && gameStateData.gameState.cardTable.cards) {
            this.tableCards = [...gameStateData.gameState.cardTable.cards];
            console.log(`[GameRoom] 桌面卡牌更新: ${this.tableCards.length} 张`);
        }
        
        // 标记游戏已开始
        if (!this.gameStarted) {
            this.gameStarted = true;
            console.log('[GameRoom] 游戏开始，显示手牌');
        }
        
        // 重新渲染界面
        this.render();
        
        // 更新当前回合信息
        this.updateCurrentTurnInfo(gameStateData.gameState);
    }
    
    // 更新当前回合信息
    updateCurrentTurnInfo(gameState) {
        if (!gameState) return;
        
        const currentTurn = gameState.currentTurn;
        const players = gameState.players || [];
        const currentPlayer = players[currentTurn];
        
        if (currentPlayer) {
            const centerX = this.canvas.width / 2;
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            const userInfo = GameStateManager.getUserInfo();
            const isMyTurn = currentPlayer.id === userInfo.uid;
            
            this.ctx.fillStyle = isMyTurn ? '#4CAF50' : '#FFA726';
            const turnText = isMyTurn ? '轮到你出牌' : `轮到 ${currentPlayer.name || 'Unknown'} 出牌`;
            this.ctx.fillText(turnText, centerX, 180); // 从140调整到180
            
            // 如果不是自己的回合，显示提示
            if (!isMyTurn) {
                this.ctx.font = '14px Arial';
                this.ctx.fillStyle = '#999';
                this.ctx.fillText('请等待其他玩家出牌', centerX, 200); // 从160调整到200
            }
        }
    }
}

export default GameRoom;