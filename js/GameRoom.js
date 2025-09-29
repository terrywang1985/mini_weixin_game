/**
 * 游戏房间页面 - 显示房间信息和玩家列表
 */

import GameStateManager from './GameStateManager.js';

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
            headerColor: '#34495e',
            playerItemColor: '#ffffff',
            playerItemHoverColor: '#ecf0f1',
            buttonColor: '#e74c3c',
            buttonHoverColor: '#c0392b',
            readyButtonColor: '#27ae60',
            readyButtonHoverColor: '#229954',
            textColor: '#2c3e50',
            headerTextColor: '#ffffff',
            
            headerHeight: 100,
            playerItemHeight: 60,
            playerItemSpacing: 10,
            buttonWidth: 100,
            buttonHeight: 40,
            padding: 20
        };
        
        // 交互状态
        this.hoveredButtonIndex = -1;
        this.isReady = false;
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        // 监听游戏状态变化
        GameStateManager.onStateChange((oldState, newState) => {
            if (newState === GameStateManager.GAME_STATES.IN_ROOM) {
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
    }
    
    bindEvents() {
        // 鼠标移动事件
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isVisible) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.updateHoverState(mouseX, mouseY);
            this.render();
        });
        
        // 鼠标点击事件
        this.canvas.addEventListener('click', (e) => {
            if (!this.isVisible) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            this.handleClick(mouseX, mouseY);
        });
        
        // 触摸事件
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
    
    updateHoverState(mouseX, mouseY) {
        this.hoveredButtonIndex = -1;
        
        // 检查离开房间按钮
        const leaveButtonArea = this.getLeaveButtonArea();
        if (this.isPointInArea(mouseX, mouseY, leaveButtonArea)) {
            this.hoveredButtonIndex = 0; // 离开按钮
            return;
        }
        
        // 检查准备按钮
        const readyButtonArea = this.getReadyButtonArea();
        if (this.isPointInArea(mouseX, mouseY, readyButtonArea)) {
            this.hoveredButtonIndex = 1; // 准备按钮
            return;
        }
    }
    
    handleClick(mouseX, mouseY) {
        // 检查离开房间按钮
        const leaveButtonArea = this.getLeaveButtonArea();
        if (this.isPointInArea(mouseX, mouseY, leaveButtonArea)) {
            this.onLeaveRoomClick();
            return;
        }
        
        // 检查准备按钮
        const readyButtonArea = this.getReadyButtonArea();
        if (this.isPointInArea(mouseX, mouseY, readyButtonArea)) {
            this.onReadyClick();
            return;
        }
    }
    
    isPointInArea(x, y, area) {
        return x >= area.x && 
               x <= area.x + area.width && 
               y >= area.y && 
               y <= area.y + area.height;
    }
    
    getLeaveButtonArea() {
        return {
            x: this.config.padding,
            y: this.config.padding,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight
        };
    }
    
    getReadyButtonArea() {
        return {
            x: this.canvas.width - this.config.padding - this.config.buttonWidth,
            y: this.config.padding,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight
        };
    }
    
    show() {
        this.isVisible = true;
        this.roomInfo = GameStateManager.getCurrentRoom();
        this.players = this.roomInfo.playerList || [];
        this.isReady = GameStateManager.isReady();
        this.render();
        console.log("显示游戏房间");
    }
    
    hide() {
        this.isVisible = false;
        console.log("隐藏游戏房间");
    }
    
    updateRoomInfo(roomInfo) {
        this.roomInfo = roomInfo;
        if (this.isVisible) {
            this.render();
        }
    }
    
    updatePlayerList(players) {
        this.players = players || [];
        if (this.isVisible) {
            this.render();
        }
    }
    
    render() {
        if (!this.isVisible) return;
        
        // 清空画布
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制头部
        this.drawHeader();
        
        // 绘制房间信息
        this.drawRoomInfo();
        
        // 绘制玩家列表
        this.drawPlayerList();
        
        // 绘制游戏状态提示
        this.drawGameStatus();
    }
    
    drawHeader() {
        // 绘制头部背景
        this.ctx.fillStyle = this.config.headerColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.config.headerHeight);
        
        // 绘制离开房间按钮
        const leaveButtonArea = this.getLeaveButtonArea();
        this.ctx.fillStyle = this.hoveredButtonIndex === 0 ? 
            this.config.buttonHoverColor : this.config.buttonColor;
        this.ctx.fillRect(leaveButtonArea.x, leaveButtonArea.y, leaveButtonArea.width, leaveButtonArea.height);
        
        this.ctx.strokeStyle = this.config.headerTextColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(leaveButtonArea.x, leaveButtonArea.y, leaveButtonArea.width, leaveButtonArea.height);
        
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('离开房间', 
            leaveButtonArea.x + leaveButtonArea.width / 2, 
            leaveButtonArea.y + leaveButtonArea.height / 2);
        
        // 绘制准备按钮
        const readyButtonArea = this.getReadyButtonArea();
        const readyButtonColor = this.isReady ? this.config.readyButtonColor : this.config.buttonColor;
        const readyButtonHoverColor = this.isReady ? this.config.readyButtonHoverColor : this.config.buttonHoverColor;
        
        this.ctx.fillStyle = this.hoveredButtonIndex === 1 ? 
            readyButtonHoverColor : readyButtonColor;
        this.ctx.fillRect(readyButtonArea.x, readyButtonArea.y, readyButtonArea.width, readyButtonArea.height);
        
        this.ctx.strokeStyle = this.config.headerTextColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(readyButtonArea.x, readyButtonArea.y, readyButtonArea.width, readyButtonArea.height);
        
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.isReady ? '取消准备' : '准备', 
            readyButtonArea.x + readyButtonArea.width / 2, 
            readyButtonArea.y + readyButtonArea.height / 2);
    }
    
    drawRoomInfo() {
        if (!this.roomInfo) return;
        
        // 绘制房间名称
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.roomInfo.name, this.canvas.width / 2, 30);
        
        // 绘制房间ID
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`房间ID: ${this.roomInfo.id}`, this.canvas.width / 2, 55);
        
        // 绘制玩家数量
        this.ctx.fillText(`玩家: ${this.roomInfo.currentPlayers}/${this.roomInfo.maxPlayers}`, 
            this.canvas.width / 2, 75);
    }
    
    drawPlayerList() {
        const startY = this.config.headerHeight + 20;
        
        // 绘制玩家列表标题
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = 'bold 18px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText('房间内玩家:', this.config.padding, startY);
        
        // 绘制玩家项
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            const playerY = startY + 40 + (i * (this.config.playerItemHeight + this.config.playerItemSpacing));
            
            this.drawPlayerItem(player, playerY, i);
        }
        
        // 如果没有玩家，显示提示
        if (this.players.length === 0) {
            this.ctx.fillStyle = '#7f8c8d';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('房间内暂无其他玩家', this.canvas.width / 2, startY + 80);
        }
    }
    
    drawPlayerItem(player, y, index) {
        const x = this.config.padding;
        const width = this.canvas.width - 2 * this.config.padding;
        const height = this.config.playerItemHeight;
        
        // 绘制玩家项背景
        this.ctx.fillStyle = this.config.playerItemColor;
        this.ctx.fillRect(x, y, width, height);
        
        // 绘制边框
        this.ctx.strokeStyle = '#bdc3c7';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
        
        // 绘制玩家信息
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        // 玩家头像区域（简单的圆形）
        const avatarX = x + 20;
        const avatarY = y + height / 2;
        const avatarRadius = 15;
        
        this.ctx.beginPath();
        this.ctx.arc(avatarX, avatarY, avatarRadius, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#3498db';
        this.ctx.fill();
        this.ctx.strokeStyle = '#2980b9';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 玩家名称
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(player.name, avatarX + avatarRadius + 15, avatarY - 5);
        
        // 玩家ID
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.fillText(`ID: ${player.uid}`, avatarX + avatarRadius + 15, avatarY + 10);
        
        // 玩家状态（如果有准备状态信息）
        if (player.isReady !== undefined) {
            this.ctx.fillStyle = player.isReady ? '#27ae60' : '#e74c3c';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(player.isReady ? '已准备' : '未准备', 
                x + width - 15, avatarY);
        }
        
        // 当前用户标识
        const currentUser = GameStateManager.getUserInfo();
        if (player.uid === currentUser.uid) {
            this.ctx.fillStyle = '#f39c12';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'right';
            this.ctx.fillText('(你)', x + width - 15, avatarY - 15);
        }
    }
    
    drawGameStatus() {
        // 显示游戏状态信息
        const statusY = this.canvas.height - 60;
        
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        if (GameStateManager.isGameStarted()) {
            this.ctx.fillText('游戏进行中...', this.canvas.width / 2, statusY);
        } else {
            const readyCount = this.players.filter(p => p.isReady).length;
            const totalCount = this.players.length;
            
            if (totalCount < 2) {
                this.ctx.fillText('等待更多玩家加入...', this.canvas.width / 2, statusY);
            } else if (readyCount === totalCount && totalCount >= 2) {
                this.ctx.fillStyle = '#27ae60';
                this.ctx.fillText('所有玩家已准备，游戏即将开始！', this.canvas.width / 2, statusY);
            } else {
                this.ctx.fillText(`等待玩家准备... (${readyCount}/${totalCount})`, this.canvas.width / 2, statusY);
            }
        }
    }
    
    onLeaveRoomClick() {
        console.log("点击离开房间");
        
        // 确认对话框
        const confirmed = this.showConfirm("确定要离开房间吗？");
        if (confirmed) {
            this.networkManager.leaveRoom();
            GameStateManager.leaveRoom();
        }
    }
    
    onReadyClick() {
        console.log("点击准备按钮");
        
        this.isReady = !this.isReady;
        GameStateManager.setReadyState(this.isReady);
        
        // 发送准备请求
        this.networkManager.sendGetReadyRequest();
        
        this.render();
    }
    
    onRoomJoined() {
        console.log("成功加入房间");
        this.showMessage("成功加入房间");
    }
    
    onRoomCreated(room) {
        console.log("成功创建房间:", room.name);
        this.showMessage("房间创建成功");
    }
    
    onGameStart(data) {
        console.log("游戏开始通知:", data);
        GameStateManager.startGame();
        this.showMessage("游戏开始！");
    }
    
    showMessage(message) {
        console.log("消息提示:", message);
        
        if (typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            });
        } else {
            // 在canvas上显示临时消息
            this.showCanvasMessage(message);
        }
    }
    
    showConfirm(message) {
        if (typeof wx !== 'undefined' && wx.showModal) {
            // 微信小游戏环境中应该使用异步方式
            // 这里简化处理
            return confirm(message);
        } else {
            return confirm(message);
        }
    }
    
    showCanvasMessage(message) {
        // 在canvas上显示临时消息
        const messageY = this.canvas.height - 100;
        
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, messageY - 20, this.canvas.width, 40);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(message, this.canvas.width / 2, messageY);
        this.ctx.restore();
        
        // 2秒后重新渲染
        setTimeout(() => {
            this.render();
        }, 2000);
    }
    
    // 更新画布尺寸
    updateCanvasSize() {
        if (this.isVisible) {
            this.render();
        }
    }
    
    // 销毁页面
    destroy() {
        this.isVisible = false;
        this.roomInfo = null;
        this.players = [];
    }
}

export default GameRoom;