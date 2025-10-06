/**
 * 游戏中界面 - 专注于游戏进行时的UI和交互
 */

import GameStateManager from './GameStateManager.js';
import HandCardArea from './HandCardArea.js';

class GameRoom {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.networkManager = networkManager;
        this.gameStateManager = GameStateManager; // 添加GameStateManager实例
        
        // 页面状态
        this.isVisible = false;
        this.players = [];
        
        // 界面配置
        this.config = {
            backgroundColor: '#2c3e50',
            textColor: '#ffffff'
        };
        
        // 手牌区域
        this.handCardArea = new HandCardArea(canvas, this.ctx);
        this.handCardArea.onCardSelect((index, card, previousIndex) => {
            if (card) {
                console.log(`[GameRoom] 选择了卡牌 ${index}: ${card.word}`);
            } else {
                console.log(`[GameRoom] 清除卡牌选择，索引: ${index}`);
            }
            // 当手牌选择状态改变时，重新渲染游戏房间以更新提示信息
            if (this.isVisible) {
                this.render();
            }
        });
        
        // 设置出牌回调
        this.handCardArea.onCardPlayed = (cardIndex, card, position) => {
            if (position !== undefined) {
                this.playCardToPosition(cardIndex, card, position);
            } else {
                this.onPlayCard(cardIndex, card);
            }
        };
        
        // 游戏状态
        this.gameStarted = false;
        
        // 倒计时相关
        this.currentTurnTimeLeft = 15; // 默认15秒倒计时
        this.turnTimer = null;
        this.lastCurrentTurn = -1; // 用于跟踪回合变化
        this.skipTurnClicked = false; // 跟踪是否已点击跳过
        this.hasPlayedCard = false; // 跟踪是否已出牌（等待服务器状态更新）
        
        // 桌面卡牌区域
        this.tableCards = [];
        this.tableArea = {
            x: 0, y: 0, width: 400, height: 200
        };
        
        // 倒计时相关
        this.currentTurnTimeLeft = 15; // 默认15秒倒计时
        this.turnTimer = null;
        this.lastCurrentTurn = -1; // 用于跟踪回合变化
        this.skipTurnClicked = false; // 跟踪是否已点击跳过
        
        // 跳过轮次按钮
        this.skipTurnButton = {
            x: 0, y: 0, width: 0, height: 0,
            isHovered: false
        };
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        // 监听游戏状态变化
        GameStateManager.onStateChange((oldState, newState) => {
            if (newState === GameStateManager.GAME_STATES.IN_GAME) {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // 监听玩家更新
        GameStateManager.onPlayerUpdate((players) => {
            this.updatePlayerList(players);
        });
        
        // 监听游戏开始通知
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
            return;
        }
        this.isVisible = true;
        this.setupLayout();
        
        // 注册游戏状态更新回调
        GameStateManager.onGameStateUpdate((gameStateData) => {
            if (this.isVisible) {
                this.onGameStateUpdate(gameStateData);
            }
        });
        
        this.render();
        console.log("显示游戏界面");
    }
    
    hide() {
        this.isVisible = false;
        console.log("隐藏游戏界面");
    }
    
    setupLayout() {
        // 设置游戏界面布局
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 设置桌面区域
        this.tableArea = {
            x: canvasWidth / 2 - 200,
            y: canvasHeight / 2 - 100,
            width: 400,
            height: 200
        };
        
        // 设置游戏控制按钮
        const buttonWidth = 80;
        const buttonHeight = 30;
        const buttonSpacing = 15;
        const startY = canvasHeight - 180;
        
        const totalWidth = buttonWidth * 2 + buttonSpacing;
        const startX = (canvasWidth - totalWidth) / 2;
        
        this.gameExitButton = {
            x: startX,
            y: startY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        this.skipTurnButton = {
            x: startX + buttonWidth + buttonSpacing,
            y: startY,
            width: buttonWidth,
            height: buttonHeight
        };
    }
    
    
    // 修改 handleClick 方法专注于游戏中的点击处理
    handleClick(x, y) {
        if (!this.isVisible) return;
        
        // 检查弃牌认输按钮 - 只有轮到自己时才能点击
        if (this.gameExitButton && this.isPointInButton(x, y, this.gameExitButton)) {
            const gameState = this.gameStateManager.gameState;
            if (!this.isMyTurn()) {
                console.log('[GameRoom] 不是你的回合，无法弃牌认输');
                if (typeof wx !== 'undefined') {
                    wx.showToast({
                        title: '不是你的回合',
                        icon: 'none',
                        duration: 2000
                    });
                }
                return;
            }
            this.onSurrenderClick();
            return;
        }
        
        // 检查跳过轮次按钮 - 只有轮到自己且没有跳过时才能点击
        if (this.skipTurnButton && this.isPointInButton(x, y, this.skipTurnButton)) {
            const gameState = this.gameStateManager.gameState;
            const tableIsEmpty = !this.tableCards || this.tableCards.length === 0;
            const canSkip = this.isMyTurn() && !this.skipTurnClicked && !tableIsEmpty;
            if (!canSkip) {
                let message = '';
                if (tableIsEmpty) {
                    console.log('[GameRoom] 无法跳过：桌面为空时必须出牌');
                    message = '桌面为空时必须出牌';
                } else {
                    console.log('[GameRoom] 无法跳过：不是你的回合或已跳过');
                    message = '不是你的回合或已跳过';
                }
                
                // 在UI上显示提示信息
                if (typeof wx !== 'undefined') {
                    wx.showToast({
                        title: message,
                        icon: 'none',
                        duration: 2000
                    });
                } else {
                    alert(message);
                }
                return;
            }
            this.onSkipTurnClick();
            return;
        }
        
        // 检查是否点击了桌面插入位置标签
        if (this.tableInsertPositions) {
            for (let i = 0; i < this.tableInsertPositions.length; i++) {
                const pos = this.tableInsertPositions[i];
                const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
                // 使用标签的半径来判断点击范围
                const radius = (pos.width || 20) / 2;
                if (distance <= radius) { // 点击在圆形标签内
                    this.selectedInsertPosition = pos.position;
                    console.log(`[GameRoom] 选择插入位置: ${pos.position}`);
                    
                    // 如果已经有选中的手牌，则直接出牌到该位置
                    const selectedCard = this.handCardArea.getSelectedCard();
                    if (selectedCard) {
                        this.playCardToPosition(selectedCard.index, selectedCard.card, pos.position);
                        // 清除手牌选择状态
                        this.handCardArea.clearSelection();
                    }
                    
                    this.render();
                    return;
                }
            }
        }
        
        // 检查是否点击在手牌区域
        if (this.handCardArea && this.handCardArea.isVisible()) {
            // 检查点击坐标是否在手牌区域内
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
    
    isPointInButton(x, y, button) {
        return x >= button.x && 
               x <= button.x + button.width && 
               y >= button.y && 
               y <= button.y + button.height;
    }
    
    updatePlayerList(players) {
        this.players = players || [];
        if (this.isVisible) {
            this.render();
        }
    }
    
    onGameStart(data) {
        // 服务器广播的正式开始事件
        console.log("[GameRoom] 收到 game_start_notification (服务器确认) :", data);
        if (data) {
            // 如果通知带玩家列表，更新本地 players
            if (data.players && data.players.length > 0) {
                this.players = data.players;
                console.log('[GameRoom] 通知玩家人数:', data.players.length);
            }
        }
        // 确保当前显示页面仍然是游戏界面
        if (GameStateManager.currentState === GameStateManager.GAME_STATES.IN_GAME) {
            this.show();
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
        
        // 特殊处理不同类型的错误
        switch (data.errorCode) {
            case 10: // INVALID_ACTION - 保持向后兼容
                message = "卡牌放置不符合语法规则，请重新选择位置";
                break;
            case 11: // INVALID_CARD
                message = "无效的卡牌";
                break;
            case 15: // NOT_YOUR_TURN
                message = "现在不是你的回合，请等待其他玩家操作";
                break;
            case 16: // INVALID_ORDER
                message = "卡牌放置顺序不符合语法规则，请重新选择位置";
                break;
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
        
        // 出牌成功后立即处理UI状态
        // 1. 停止倒计时
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
            console.log("[GameRoom] 出牌成功，停止倒计时");
        }
        
        // 2. 重置跳过状态
        this.skipTurnClicked = false;
        
        // 3. 临时标记：已出牌，等待服务器状态更新
        this.hasPlayedCard = true;
        
        // 4. 立即重新渲染界面以隐藏跳过按钮和倒计时
        if (this.isVisible) {
            this.render();
        }
        
        console.log("[GameRoom] 出牌成功，已更新UI状态");
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
        GameStateManager.leaveRoom();
    }
    
    // 处理出牌
    onPlayCard(cardIndex, card) {
        console.log(`[GameRoom] 出牌: 索引=${cardIndex}, 卡牌=${card?.word || '未知卡牌'}`);
        
        // 检查是否轮到自己
        const gameState = this.gameStateManager.gameState;
        if (gameState) {
            const currentTurn = gameState.currentTurn;
            const players = gameState.players || [];
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
        
        // 发送出牌消息到服务器（默认添加到桌面末尾）
        const tableLength = this.tableCards ? this.tableCards.length : 0;
        this.sendPlayCardMessage(cardIndex, card, tableLength);
    }
    
    // 发送出牌消息
    sendPlayCardMessage(cardIndex, card, position = null) {
        if (!this.networkManager) {
            console.error("NetworkManager未初始化");
            return;
        }
        
        // 如果没有指定位置，默认添加到桌面末尾
        const tableLength = this.tableCards ? this.tableCards.length : 0;
        const targetIndex = position !== null ? position : tableLength;
        
        // 创建出牌动作
        const placeCardAction = {
            cardId: cardIndex,
            targetIndex: targetIndex,
            word: card?.word || '',
            wordClass: card?.wordClass || ''
        };
        
        console.log(`[GameRoom] 发送出牌消息:`, placeCardAction);
        
        // 通过NetworkManager发送PLACE_CARD动作
        this.networkManager.sendGameAction({
            actionType: 'PLACE_CARD',
            actionDetail: placeCardAction
        });
        
        console.log(`[GameRoom] 出牌请求已发送到服务器`);
    }
    
    render() {
        if (!this.isVisible) return;
        
        // 清空画布
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 游戏中界面
        this.drawGameScreen();
        
        // 渲染手牌区域（如果游戏已开始且有手牌）
        if (this.gameStarted && this.handCardArea.isVisible()) {
            this.handCardArea.render();
        }
    }
    
    // 绘制游戏中界面
    drawGameScreen() {
        // 绘制顶部玩家信息区域
        this.drawPlayerInfoPanel();
        
        // 绘制当前句子 - 放在手牌区域和桌面区域之间
        this.drawCurrentSentence();
        
        // 绘制游戏操作按钮区域
        this.drawGameControlButtons();
        
        // 绘制桌面卡牌 - 放在中央区域
        this.drawTableCards();
    }
    
    // 绘制当前回合信息
    drawCurrentTurnInfo() {
        const gameState = this.gameStateManager.gameState;
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
        
        // 保存桌面区域信息供点击检测使用
        this.tableInsertPositions = [];
        
        // 卡牌和间距设置
        const cardWidth = 50;
        const cardHeight = 30;
        const cardSpacing = 30;
        const lineSpacing = 20; // 行间距
        
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
            
            // 绘制起始插入位置标签 (0) - 居中显示并放大
            this.drawInsertPosition(0, centerX, this.tableArea.y + this.tableArea.height / 2, true);
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
        
        // 计算每行能容纳的卡牌数量
        const maxCardsPerRow = Math.max(1, Math.floor((this.tableArea.width - 40) / (cardWidth + cardSpacing)));
        
        // 按行分组卡牌
        const rows = [];
        for (let i = 0; i < this.tableCards.length; i += maxCardsPerRow) {
            rows.push(this.tableCards.slice(i, Math.min(i + maxCardsPerRow, this.tableCards.length)));
        }
        
        // 计算所有行的总高度
        const totalHeight = rows.length * cardHeight + (rows.length - 1) * lineSpacing;
        // 计算起始Y坐标以实现垂直居中
        const startY = this.tableArea.y + (this.tableArea.height - totalHeight) / 2 + cardHeight / 2;
        
        // 绘制每行卡牌
        rows.forEach((row, rowIndex) => {
            // 计算当前行的总宽度
            const rowWidth = row.length * cardWidth + (row.length - 1) * cardSpacing;
            // 计算当前行的起始X坐标以实现居中对齐
            const startX = this.tableArea.x + (this.tableArea.width - rowWidth) / 2;
            const currentY = startY + rowIndex * (cardHeight + lineSpacing);
            
            // 计算当前行的起始位置索引
            const rowStartIndex = rowIndex * maxCardsPerRow;
            
            // 绘制行首插入位置标签（确保不超出左边界）
            const firstPositionX = Math.max(this.tableArea.x + 15, startX - cardSpacing / 2);
            this.drawInsertPosition(rowStartIndex, firstPositionX, currentY);
            
            // 绘制当前行的卡牌
            row.forEach((card, colIndex) => {
                const cardX = startX + colIndex * (cardWidth + cardSpacing);
                const cardY = currentY - cardHeight / 2;
                const globalIndex = rowStartIndex + colIndex;
                
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
                this.ctx.fillText(card?.word || '未知', cardX + cardWidth / 2, cardY + cardHeight / 2);
                
                // 绘制下一个插入位置标签（确保不超出右边界）
                const nextPositionX = cardX + cardWidth + cardSpacing / 2;
                if (nextPositionX <= this.tableArea.x + this.tableArea.width - 15) {
                    this.drawInsertPosition(globalIndex + 1, nextPositionX, currentY);
                }
            });
        });
        
        // 添加操作提示 - 更明显的位置和颜色
        const gameState = this.gameStateManager.gameState;
        const isMyTurn = this.isMyTurn();
        const selectedCard = this.handCardArea.getSelectedCard();
        
        if (isMyTurn && selectedCard) {
            // 如果轮到自己且选中了手牌，显示出牌提示
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // 绘制背景
            const textWidth = 200;
            const textHeight = 25;
            const textX = this.canvas.width / 2;
            const textY = this.tableArea.y - 25;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(textX - textWidth/2, textY - textHeight/2, textWidth, textHeight);
            
            // 绘制文字
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillText('点击数字标签出牌', textX, textY);
            
        } else if (isMyTurn && !selectedCard) {
            // 如果轮到自己但没选中手牌，显示选牌提示
            this.ctx.fillStyle = '#FFA726';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // 绘制背景
            const textWidth = 150;
            const textHeight = 25;
            const textX = this.canvas.width / 2;
            const textY = this.tableArea.y - 25;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(textX - textWidth/2, textY - textHeight/2, textWidth, textHeight);
            
            // 绘制文字
            this.ctx.fillStyle = '#FFA726';
            this.ctx.fillText('请先选择手牌', textX, textY);
        }
    }

    // 绘制插入位置标签
    drawInsertPosition(position, x, y, isLarge = false) {
        // 保存插入位置信息供点击检测使用
        this.tableInsertPositions.push({
            position: position,
            x: x,
            y: y,
            width: isLarge ? 30 : 20,
            height: isLarge ? 30 : 20
        });
        
        // 绘制圆形标签
        const radius = isLarge ? 15 : 10;
        this.ctx.fillStyle = '#FF9800';
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // 绘制边框
        this.ctx.strokeStyle = '#F57C00';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        // 绘制数字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = isLarge ? '16px Arial' : '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(position.toString(), x, y);
    }
    
    // 绘制弃牌认输按钮
    // 绘制玩家信息面板（竖排显示）
    drawPlayerInfoPanel() {
        const startX = 10; // 减小左边距适配390px画布
        const startY = 80; // 往下移动，避开刘海屏
        const panelWidth = 360; // 适配390px画布
        const rowHeight = 25; // 减小行高，改为单行显示
        
        // 绘制标题
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('玩家信息', startX, startY);
        
        // 获取游戏状态中的玩家信息
        const gameState = this.gameStateManager.gameState;
        
        console.log('[玩家信息] 当前gameState:', gameState);
        
        // 尝试从多个来源获取玩家信息
        let players = [];
        let currentTurn = -1;
        let currentPlayer = null;
        let hasValidGameState = false;
        
        // 检查直接的游戏状态对象
        if (gameState && gameState.players) {
            players = gameState.players || [];
            currentTurn = gameState.currentTurn;
            if (currentTurn !== undefined && currentTurn >= 0 && currentTurn < players.length) {
                currentPlayer = players[currentTurn];
                hasValidGameState = true;
                // 添加调试信息（仅在必要时显示）
                if (this.lastCurrentTurn !== currentTurn) {
                    console.log(`[回合更新] 当前回合: ${currentTurn}, 玩家ID: ${currentPlayer ? currentPlayer.id : 'null'}`);
                    this.lastCurrentTurn = currentTurn;
                }
            }
        } else if (this.players && this.players.length > 0) {
            // 如果没有gameState，使用房间中的玩家信息
            players = this.players;
            // 在房间状态下，不设置当前玩家，等待游戏开始
            currentTurn = -1;
            currentPlayer = null;
            hasValidGameState = false; // 显确设置为false，因为没有游戏回合信息
        } else {
            // 如果完全没有数据，不显示任何内容
            return;
        }
        
        const userInfo = GameStateManager.getUserInfo();
        
        // 检查是否轮到我
        const isMyTurn = this.isMyTurn();
        console.log(`[玩家信息] 轮到我: ${isMyTurn}, hasValidGameState: ${hasValidGameState}, currentTurn: ${currentTurn}, players: ${players.length}`);
        
        // 移除"请等待其他玩家出牌"的提示，改为始终显示玩家信息
        // 轮次信息通过绿色边框在玩家列表中显示
        
        // 按积分排序（高到低），如果没有积分则按ID排序
        const sortedPlayers = [...players].sort((a, b) => {
            const scoreA = a.currentScore || a.current_score || a.score || 0;
            const scoreB = b.currentScore || b.current_score || b.score || 0;
            if (scoreA === scoreB) {
                return (a.id || a.uid || 0) - (b.id || b.uid || 0);
            }
            return scoreB - scoreA;
        });
        
        // 更新本地玩家列表以保持积分同步
        if (this.players && this.players.length > 0) {
            this.players = this.players.map(localPlayer => {
                const gameStatePlayer = sortedPlayers.find(p => 
                    (p.id === localPlayer.uid || p.uid === localPlayer.uid));
                if (gameStatePlayer) {
                    return {
                        ...localPlayer,
                        currentScore: gameStatePlayer.currentScore || gameStatePlayer.current_score || gameStatePlayer.score || 0,
                        winCount: gameStatePlayer.winCount || localPlayer.winCount || 0
                    };
                }
                return localPlayer;
            });
        }
        
        // 绘制每个玩家的信息
        sortedPlayers.forEach((player, index) => {
            const yPos = startY + 25 + index * rowHeight;
            const playerId = player.id || player.uid || 0;
            const isCurrentPlayer = currentPlayer && (currentPlayer.id === playerId || currentPlayer.uid === playerId);
            const isMe = playerId === userInfo.uid;
            
            // 如果是当前出牌人，绘制绿色边框（不遮盖内容）
            if (isCurrentPlayer) {
                this.ctx.strokeStyle = '#4CAF50';
                this.ctx.lineWidth = 3;
                this.ctx.strokeRect(startX - 5, yPos - 3, panelWidth - 10, rowHeight - 2);
                
                // 可选：添加轻微的绿色背景
                this.ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
                this.ctx.fillRect(startX - 4, yPos - 2, panelWidth - 12, rowHeight - 4);
            }
            
            // 玩家基本信息
            const score = player.currentScore || player.current_score || player.score || 0;
            const wins = player.winCount !== undefined ? player.winCount : 0;
            
            // 一行显示：玩家ID、积分和获胜次数
            this.ctx.fillStyle = isMe ? '#FFD700' : '#fff';
            this.ctx.font = isCurrentPlayer ? 'bold 12px Arial' : '11px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            
            // 构建完整的文本信息
            const playerText = `玩家ID: ${playerId}    积分: ${score}分    获胜: ${wins}次`;
            this.ctx.fillText(playerText, startX, yPos + rowHeight / 2);
            
            // 如果是当前出牌人，在右侧显示状态和倒计时
            if (isCurrentPlayer) {
                // 显示当前回合状态
                this.ctx.fillStyle = '#4CAF50';
                this.ctx.font = 'bold 11px Arial';
                this.ctx.textAlign = 'right';
                const statusText = isMe ? '轮到你' : '出牌中';
                this.ctx.fillText(statusText, startX + panelWidth - 50, yPos + rowHeight / 2);
                
                // 显示倒计时
                if (this.turnTimer && !this.skipTurnClicked) {
                    const timeLeft = this.currentTurnTimeLeft || 15;
                    this.ctx.fillStyle = '#FF5722';
                    this.ctx.font = 'bold 10px Arial';
                    this.ctx.fillText(`${timeLeft}s`, startX + panelWidth - 20, yPos + rowHeight / 2);
                }
            }
        });
    }
    
    // 绘制游戏控制按钮区域
    drawGameControlButtons() {
        const buttonWidth = 80; // 减小按钮宽度
        const buttonHeight = 30; // 减小按钮高度
        const buttonSpacing = 15; // 减小间距
        const startY = this.canvas.height - 180; // 在手牌区上方
        
        // 计算按钮位置（居中排列）
        const totalWidth = buttonWidth * 2 + buttonSpacing;
        const startX = (this.canvas.width - totalWidth) / 2;
        
        // 检查是否轮到自己
        const gameState = this.gameStateManager.gameState;
        const isMyTurn = this.isMyTurn();
        
        // 弃牌认输按钮 - 只有轮到自己时才可点击
        const surrenderButtonX = startX;
        this.gameExitButton = {
            x: surrenderButtonX,
            y: startY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        this.ctx.fillStyle = isMyTurn ? '#ff4444' : '#666'; // 不是自己回合时变灰
        this.ctx.fillRect(surrenderButtonX, startY, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = isMyTurn ? '#cc0000' : '#444';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(surrenderButtonX, startY, buttonWidth, buttonHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('弃牌认输', surrenderButtonX + buttonWidth / 2, startY + buttonHeight / 2);
        
        // 跳过当前轮次按钮
        const skipButtonX = startX + buttonWidth + buttonSpacing;
        this.skipTurnButton = {
            x: skipButtonX,
            y: startY,
            width: buttonWidth,
            height: buttonHeight
        };
        
        // 检查按钮状态：只有轮到自己且没有点击跳过且桌面不为空时才可点击
        const tableIsEmpty = !this.tableCards || this.tableCards.length === 0;
        const canSkip = isMyTurn && !this.skipTurnClicked && !tableIsEmpty;
        
        // 添加调试信息
        console.log(`[跳过按钮状态] 轮到我: ${isMyTurn}, 未跳过: ${!this.skipTurnClicked}, 桌面非空: ${!tableIsEmpty}, 桌面卡牌数: ${this.tableCards ? this.tableCards.length : 0}, 最终可跳过: ${canSkip}`);
        
        this.ctx.fillStyle = canSkip ? '#2196F3' : '#666';
        this.ctx.fillRect(skipButtonX, startY, buttonWidth, buttonHeight);
        this.ctx.strokeStyle = canSkip ? '#1976D2' : '#444';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(skipButtonX, startY, buttonWidth, buttonHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('跳过轮次', skipButtonX + buttonWidth / 2, startY + buttonHeight / 2);
        
        // 在跳过按钮旁边显示倒计时（只有当轮到我且可以跳过时才显示）
        if (canSkip && isMyTurn && this.turnTimer) {
            this.drawTurnTimer(skipButtonX + buttonWidth + 10, startY + buttonHeight / 2 - 5);
        }
    }
    
    // 绘制回合倒计时
    drawTurnTimer(x, y) {
        const timeLeft = this.currentTurnTimeLeft || 15; // 默认15秒
        
        this.ctx.fillStyle = '#FF5722';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`${timeLeft}s`, x, y);
    }
    
    // 检查是否是当前玩家的回合
    isMyTurn(gameState) {
        const userInfo = GameStateManager.getUserInfo();
        if (!userInfo || !userInfo.uid) return false;
        
        // 如果已经出牌但还没收到服务器状态更新，返回false
        if (this.hasPlayedCard) {
            console.log("[GameRoom] isMyTurn: 已出牌等待服务器状态，返回false");
            return false;
        }
        
        // 如果没有传入参数，使用GameStateManager的状态
        if (!gameState) {
            gameState = this.gameStateManager.gameState;
        }
        
        // 如果有游戏状态，使用游戏状态判断
        // 直接的游戏状态对象
        if (gameState && gameState.players) {
            const currentTurn = gameState.currentTurn;
            const players = gameState.players || [];
            if (currentTurn >= 0 && currentTurn < players.length) {
                const currentPlayer = players[currentTurn];
                return currentPlayer && currentPlayer.id === userInfo.uid;
            }
        }
        
        // 如果没有游戏状态，但有房间玩家信息，假设第一个玩家可以操作
        if (this.players && this.players.length > 0) {
            return this.players[0] && (this.players[0].uid === userInfo.uid || this.players[0].id === userInfo.uid);
        }
        
        return false;
    }
    
    // 跳过轮次点击处理
    onSkipTurnClick() {
        console.log('[GameRoom] 跳过轮次按钮被点击');
        
        // 检查是否是当前玩家的回合
        const gameState = this.gameStateManager.gameState;
        if (!this.isMyTurn()) {
            console.log('[GameRoom] 不是你的回合，无法跳过');
            
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
        
        // 标记已点击跳过，停止倒计时
        this.skipTurnClicked = true;
        
        // 立即停止倒计时
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        // 发送跳过请求
        this.sendSkipTurnRequest();
        
        // 更新界面，使按钮变灰
        this.render();
    }
    
    // 发送跳过轮次请求
    sendSkipTurnRequest() {
        if (!this.networkManager) {
            console.error('NetworkManager未初始化');
            return;
        }
        
        console.log('[GameRoom] 发送跳过轮次请求');
        
        // 通过NetworkManager发送SKIP_TURN动作
        this.networkManager.sendGameAction({
            actionType: 'SKIP_TURN',
            actionDetail: {}
        });
    }
    
    // 开始回合倒计时
    startTurnTimer() {
        // 清除之前的计时器
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
        }
        
        // 检查是否轮到我，只有轮到我时才启动倒计时
        const gameState = this.gameStateManager.gameState;
        const isMyTurn = this.isMyTurn();
        
        if (!isMyTurn) {
            console.log('[GameRoom] 不是我的回合，不启动倒计时');
            this.skipTurnClicked = false; // 重置跳过状态
            return;
        }
        
        console.log('[GameRoom] 轮到我的回合，启动倒计时');
        
        // 重置跳过状态
        this.skipTurnClicked = false;
        this.currentTurnTimeLeft = 15; // 重置为15秒
        
        this.turnTimer = setInterval(() => {
            this.currentTurnTimeLeft--;
            
            if (this.currentTurnTimeLeft <= 0) {
                this.onTurnTimeOut();
            }
            
            // 更新界面显示
            if (this.isVisible) {
                this.render();
            }
        }, 1000);
    }
    
    // 回合超时处理
    onTurnTimeOut() {
        console.log('[GameRoom] 回合超时，自动跳过');
        
        // 清除计时器
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        // 如果是当前玩家的回合，自动发送跳过请求
        const gameState = this.gameStateManager.gameState;
        if (this.isMyTurn()) {
            this.sendSkipTurnRequest();
        }
    }
    
    // 更新画布尺寸
    updateCanvasSize() {
        if (this.isVisible) {
            this.setupLayout();
            this.render();
        }
    }
    
    // 销毁页面
    destroy() {
        this.isVisible = false;
        
        // 清除倒计时器
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
        
        if (this.handCardArea) {
            this.handCardArea.destroy();
        }
    }

    // 处理游戏状态更新
    onGameStateUpdate(gameStateData) {
        // 这个方法由GameStateManager的updateGameState触发
        // 不需要再调用updateGameState，只需要更新UI
        
        // 检查是否是重新发牌（桌面卡牌为空且手牌数量增加）
        const newTableCards = gameStateData.gameState?.cardTable?.cards || [];
        const newHandCards = GameStateManager.getMyHandCards();
        const isNewRound = newTableCards.length === 0 && newHandCards.length > (this.handCardArea.handCards?.length || 0);
        
        if (isNewRound) {
            console.log("[GameRoom] 检测到重新发牌，重置所有状态");
            this.hasPlayedCard = false;
            this.skipTurnClicked = false;
            this.lastCurrentTurn = -1;
        } else {
            // 重置出牌状态（收到服务器状态更新意味着新的回合开始）
            this.hasPlayedCard = false;
        }
        
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
        
        // 更新当前回合信息并重启倒计时
        this.updateCurrentTurnInfo(gameStateData.gameState);
        
        // 如果游戏已开始且有有效的回合信息，检查是否需要启动倒计时
        if (this.gameStarted && gameStateData.gameState && 
            gameStateData.gameState.currentTurn !== undefined && 
            gameStateData.gameState.players && 
            gameStateData.gameState.players.length > 0) {
            
            // 检查是否轮到我
            const isMyTurn = this.isMyTurn();
            const currentTurn = gameStateData.gameState.currentTurn;
            console.log(`[GameRoom] 游戏状态更新，轮到我: ${isMyTurn}, 当前回合: ${currentTurn}, 上次回合: ${this.lastCurrentTurn}`);
            
            // 只有在回合发生变化且轮到我时才启动倒计时
            if (isMyTurn && currentTurn !== this.lastCurrentTurn) {
                console.log(`[GameRoom] 检测到新回合轮到我，启动倒计时`);
                this.lastCurrentTurn = currentTurn; // 更新回合记录
                this.startTurnTimer();
            } else if (!isMyTurn) {
                // 如果不是我的回合，确保倒计时被停止
                if (this.turnTimer) {
                    clearInterval(this.turnTimer);
                    this.turnTimer = null;
                    console.log(`[GameRoom] 不是我的回合，停止倒计时`);
                }
                // 更新回合记录（即使不是我的回合也要记录）
                if (currentTurn !== this.lastCurrentTurn) {
                    this.lastCurrentTurn = currentTurn;
                    console.log(`[GameRoom] 更新回合记录: ${currentTurn}`);
                }
                this.skipTurnClicked = false; // 重置跳过状态
            }
            
            // 强制重新渲染UI以更新按钮状态
            if (this.isVisible) {
                this.render();
            }
        }
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
    
    // 绘制当前句子（支持换行显示）
    drawCurrentSentence() {
        if (!this.tableCards || this.tableCards.length === 0) {
            return;
        }
        
        // 获取当前句子
        const sentence = this.tableCards.map(card => card?.word || '').join('');
        if (!sentence) {
            return;
        }
        
        // 设置显示位置 - 在手牌区域和桌面区域之间
        const x = this.canvas.width / 2;
        // 计算手牌区域的顶部Y坐标
        const handCardAreaTop = this.canvas.height - 95; 
        // 计算桌面区域的顶部Y坐标
        const tableAreaTop = this.tableArea.y;
        // 将句子显示在两者之间的中心位置
        const y = (handCardAreaTop + tableAreaTop) / 2;
        
        // 设置字体和样式
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 计算文本宽度，判断是否需要换行
        const maxWidth = this.canvas.width - 40; // 左右各留20px边距
        const textWidth = this.ctx.measureText(`当前句子: ${sentence}`).width;
        
        if (textWidth <= maxWidth) {
            // 不需要换行
            this.ctx.fillText(`当前句子: ${sentence}`, x, y);
        } else {
            // 需要换行显示
            const words = sentence.split('');
            let line = '';
            let lines = [];
            
            // 按字符分组，尽量填满每行
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i];
                const testWidth = this.ctx.measureText(`当前句子: ${testLine}`).width;
                
                if (testWidth > maxWidth && i > 0) {
                    lines.push(line);
                    line = words[i];
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
            
            // 绘制多行文本
            const lineHeight = 25;
            const totalHeight = lines.length * lineHeight;
            const startY = y - totalHeight / 2 + lineHeight / 2;
            
            for (let i = 0; i < lines.length; i++) {
                const lineY = startY + i * lineHeight;
                if (i === 0) {
                    // 第一行加上"当前句子:"前缀
                    this.ctx.fillText(`当前句子: ${lines[i]}`, x, lineY);
                } else {
                    // 后续行直接显示内容
                    this.ctx.fillText(lines[i], x, lineY);
                }
            }
        }
    }
    
    // 添加新的出牌方法，支持指定位置
    playCardToPosition(cardIndex, card, position) {
        console.log(`[GameRoom] 出牌到位置: 索引=${cardIndex}, 卡牌=${card?.word || '未知卡牌'}, 位置=${position}`);
        
        // 检查是否轮到自己
        const gameState = this.gameStateManager.gameState;
        if (gameState) {
            const currentTurn = gameState.currentTurn;
            const players = gameState.players || [];
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
        
        // 发送出牌消息到服务器，包含位置信息
        this.sendPlayCardMessage(cardIndex, card, position);
        
        // 清除选中的插入位置
        this.selectedInsertPosition = undefined;
    }
    
    // 修改发送出牌消息方法，支持指定位置
    sendPlayCardMessage(cardIndex, card, position = null) {
        if (!this.networkManager) {
            console.error("NetworkManager未初始化");
            return;
        }
        
        // 如果没有指定位置，默认添加到桌面末尾
        const tableLength = this.tableCards ? this.tableCards.length : 0;
        const targetIndex = position !== null ? position : tableLength;
        
        // 创建出牌动作
        const placeCardAction = {
            cardId: cardIndex,
            targetIndex: targetIndex,
            word: card?.word || '',
            wordClass: card?.wordClass || ''
        };
        
        console.log(`[GameRoom] 发送出牌消息:`, placeCardAction);
        
        // 通过NetworkManager发送PLACE_CARD动作
        this.networkManager.sendGameAction({
            actionType: 'PLACE_CARD',
            actionDetail: placeCardAction
        });
        
        console.log(`[GameRoom] 出牌请求已发送到服务器`);
    }
}

export default GameRoom;