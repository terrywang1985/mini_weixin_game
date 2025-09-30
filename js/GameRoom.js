/**
 * 游戏房间页面 - 6格玩家位置布局
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
        this.isVisible = true;
        this.setupLayout();
        
        // 确保当前玩家显示在第一个位置
        const myUser = GameStateManager.getUserInfo();
        console.log("当前用户信息:", myUser);  // 添加调试信息
        
        if (myUser && this.playerSlots.length > 0) {
            this.playerSlots[0].player = {
                uid: myUser.uid,
                nickname: myUser.nickname || '我',  // 修正：使用 nickname 字段
                avatar: myUser.avatar_url || '',
                is_ready: false
            };
            console.log("设置玩家槽位信息:", this.playerSlots[0].player);  // 添加调试信息
            this.myPlayerIndex = 0;
            this.isReady = false;
        }
        
        this.render();
        console.log("显示游戏房间");
    }
    
    hide() {
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
        // 检查按钮点击
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
        
        // 绘制标题
        this.drawTitle();
        
        // 绘制玩家位置格子
        this.drawPlayerSlots();
        
        // 绘制按钮
        this.drawButtons();
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
        
        // 发送准备状态到服务器
        const newReadyState = !this.isReady;
        this.networkManager.sendReady(newReadyState);
        
        // 更新本地状态（等待服务器确认）
        this.isReady = newReadyState;
        this.readyButton.text = this.isReady ? '取消准备' : '准备';
        
        // 更新自己的槽位状态
        if (this.myPlayerIndex >= 0 && this.myPlayerIndex < this.playerSlots.length) {
            this.playerSlots[this.myPlayerIndex].isReady = this.isReady;
        }
        
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
        console.log("游戏开始:", data);
        GameStateManager.startGame();
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
        this.playerSlots = [];
    }
}

export default GameRoom;