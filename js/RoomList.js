/**
 * 房间列表页面 - 显示房间列表和加入功能
 */

import GameStateManager from './GameStateManager.js';
import ErrorMessageHandler from './ErrorMessageHandler.js';

class RoomList {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.networkManager = networkManager;
        
        // 页面状态
        this.isVisible = false;
        this.rooms = [];
        this.scrollOffset = 0;
        this.maxScroll = 0;
        
        // 界面配置
        this.config = {
            backgroundColor: '#34495e',
            headerColor: '#2c3e50',
            roomItemColor: '#ffffff',
            roomItemHoverColor: '#ecf0f1',
            buttonColor: '#3498db',
            buttonHoverColor: '#2980b9',
            textColor: '#2c3e50',
            headerTextColor: '#ffffff',
            
            headerHeight: 80,
            roomItemHeight: 80,
            roomItemSpacing: 10,
            buttonWidth: 80,
            buttonHeight: 30,
            padding: 20
        };
        
        // 交互状态
        this.hoveredRoomIndex = -1;
        this.hoveredButtonIndex = -1;
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        // 监听游戏状态变化
        GameStateManager.onStateChange((oldState, newState) => {
            if (newState === GameStateManager.GAME_STATES.ROOM_LIST) {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // 监听网络事件
        this.networkManager.on('room_list_received', (rooms) => {
            this.updateRoomList(rooms);
        });
        
        // 监听加入房间失败事件
        this.networkManager.on('room_join_failed', (errorInfo) => {
            this.handleRoomJoinFailed(errorInfo);
        });
    }
    
    bindEvents() {
        // 微信小游戏环境中使用wx API处理事件
        if (typeof wx !== 'undefined') {
            // 使用wx.onTouchStart处理点击和触摸事件
            wx.onTouchStart((res) => {
                if (!this.isVisible) return;
                
                if (res.touches && res.touches.length > 0) {
                    const touch = res.touches[0];
                    // 创建模拟事件对象
                    const simulatedEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => {},
                        touches: res.touches
                    };
                    this.handleClick(simulatedEvent);
                }
            });
            
            // 使用wx.onTouchMove处理鼠标移动事件
            wx.onTouchMove((res) => {
                if (!this.isVisible) return;
                
                if (res.touches && res.touches.length > 0) {
                    const touch = res.touches[0];
                    // 创建模拟事件对象
                    const simulatedEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => {},
                        touches: res.touches
                    };
                    this.onMouseMove(simulatedEvent);
                }
            });
        }
    }
    
    onMouseMove(event) {
        // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
        let x, y;
        if (typeof wx !== 'undefined') {
            // 在微信小游戏环境中，我们假设事件对象已经包含了相对于canvas的坐标
            x = event.clientX || 0;
            y = event.clientY || 0;
        } else {
            return; // 无法获取坐标，直接返回
        }
        
        this.updateHoverState(x, y);
        this.render();
    }
    
    updateHoverState(mouseX, mouseY) {
        this.hoveredRoomIndex = -1;
        this.hoveredButtonIndex = -1;
        
        // 检查返回按钮
        const backButtonArea = this.getBackButtonArea();
        if (this.isPointInArea(mouseX, mouseY, backButtonArea)) {
            this.hoveredButtonIndex = -1; // 特殊标记返回按钮
            return;
        }
        
        // 检查房间项
        const roomListY = this.config.headerHeight;
        const visibleHeight = this.canvas.height - roomListY;
        
        for (let i = 0; i < this.rooms.length; i++) {
            const roomY = roomListY + (i * (this.config.roomItemHeight + this.config.roomItemSpacing)) - this.scrollOffset;
            
            if (roomY > this.canvas.height || roomY + this.config.roomItemHeight < roomListY) {
                continue; // 不在可见区域
            }
            
            const roomArea = {
                x: this.config.padding,
                y: roomY,
                width: this.canvas.width - 2 * this.config.padding,
                height: this.config.roomItemHeight
            };
            
            if (this.isPointInArea(mouseX, mouseY, roomArea)) {
                this.hoveredRoomIndex = i;
                
                // 检查加入按钮
                const joinButtonArea = this.getJoinButtonArea(roomArea);
                if (this.isPointInArea(mouseX, mouseY, joinButtonArea)) {
                    this.hoveredButtonIndex = i;
                }
                break;
            }
        }
    }
    
    handleClick(event) {
        // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
        let x, y;
        if (typeof wx !== 'undefined') {
            // 在微信小游戏环境中，我们假设事件对象已经包含了相对于canvas的坐标
            x = event.clientX || event.touches?.[0]?.clientX || 0;
            y = event.clientY || event.touches?.[0]?.clientY || 0;
        } else {
            return; // 无法获取坐标，直接返回
        }
        
        // 检查是否点击了返回按钮
        if (this.backButton && 
            x >= this.backButton.x && x <= this.backButton.x + this.backButton.width &&
            y >= this.backButton.y && y <= this.backButton.y + this.backButton.height) {
            this.onBack();
            return;
        }
        
        // 检查是否点击了刷新按钮
        if (this.refreshButton && 
            x >= this.refreshButton.x && x <= this.refreshButton.x + this.refreshButton.width &&
            y >= this.refreshButton.y && y <= this.refreshButton.y + this.refreshButton.height) {
            this.onRefresh();
            return;
        }
        
        // 检查是否点击了创建房间按钮
        if (this.createRoomButton && 
            x >= this.createRoomButton.x && x <= this.createRoomButton.x + this.createRoomButton.width &&
            y >= this.createRoomButton.y && y <= this.createRoomButton.y + this.createRoomButton.height) {
            this.onCreateRoom();
            return;
        }
        
        // 检查是否点击了某个房间
        if (this.rooms && this.rooms.length > 0) {
            const roomHeight = 60;
            const startY = 150;
            
            for (let i = 0; i < this.rooms.length; i++) {
                const roomY = startY + i * (roomHeight + 10);
                if (y >= roomY && y <= roomY + roomHeight) {
                    this.onJoinRoom(this.rooms[i]);
                    return;
                }
            }
        }
    }
    
    isPointInArea(x, y, area) {
        return x >= area.x && 
               x <= area.x + area.width && 
               y >= area.y && 
               y <= area.y + area.height;
    }
    
    getBackButtonArea() {
        return {
            x: this.config.padding,
            y: this.config.padding,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight
        };
    }
    
    getJoinButtonArea(roomArea) {
        return {
            x: roomArea.x + roomArea.width - this.config.buttonWidth - 10,
            y: roomArea.y + (roomArea.height - this.config.buttonHeight) / 2,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight
        };
    }
    
    show() {
        this.isVisible = true;
        this.scrollOffset = 0;
        this.render();
        console.log("显示房间列表");
    }
    
    hide() {
        this.isVisible = false;
        console.log("隐藏房间列表");
    }
    
    updateRoomList(rooms) {
        this.rooms = rooms || [];
        
        // 更新滚动范围
        const totalHeight = this.rooms.length * (this.config.roomItemHeight + this.config.roomItemSpacing);
        const visibleHeight = this.canvas.height - this.config.headerHeight;
        this.maxScroll = Math.max(0, totalHeight - visibleHeight);
        
        console.log("房间列表更新:", this.rooms.length, "个房间");
        
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
        
        // 绘制房间列表
        this.drawRoomList();
        
        // 绘制滚动条
        this.drawScrollbar();
    }
    
    drawHeader() {
        // 绘制头部背景
        this.ctx.fillStyle = this.config.headerColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.config.headerHeight);
        
        // 绘制返回按钮
        const backButtonArea = this.getBackButtonArea();
        this.ctx.fillStyle = this.hoveredButtonIndex === -1 ? 
            this.config.buttonHoverColor : this.config.buttonColor;
        this.ctx.fillRect(backButtonArea.x, backButtonArea.y, backButtonArea.width, backButtonArea.height);
        
        this.ctx.strokeStyle = this.config.headerTextColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(backButtonArea.x, backButtonArea.y, backButtonArea.width, backButtonArea.height);
        
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('返回', 
            backButtonArea.x + backButtonArea.width / 2, 
            backButtonArea.y + backButtonArea.height / 2);
        
        // 绘制标题
        this.ctx.fillStyle = this.config.headerTextColor;
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('房间列表', this.canvas.width / 2, this.config.headerHeight / 2);
        
        // 绘制房间数量
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`共 ${this.rooms.length} 个房间`, 
            this.canvas.width - this.config.padding, 
            this.config.headerHeight / 2 + 20);
    }
    
    drawRoomList() {
        const roomListY = this.config.headerHeight;
        const visibleHeight = this.canvas.height - roomListY;
        
        // 设置裁剪区域，防止内容绘制到头部
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, roomListY, this.canvas.width, visibleHeight);
        this.ctx.clip();
        
        for (let i = 0; i < this.rooms.length; i++) {
            const room = this.rooms[i];
            const roomY = roomListY + (i * (this.config.roomItemHeight + this.config.roomItemSpacing)) - this.scrollOffset;
            
            // 只绘制可见的房间项
            if (roomY > this.canvas.height || roomY + this.config.roomItemHeight < roomListY) {
                continue;
            }
            
            this.drawRoomItem(room, roomY, i);
        }
        
        this.ctx.restore();
    }
    
    drawRoomItem(room, y, index) {
        const x = this.config.padding;
        const width = this.canvas.width - 2 * this.config.padding;
        const height = this.config.roomItemHeight;
        
        // 绘制房间项背景
        this.ctx.fillStyle = index === this.hoveredRoomIndex ? 
            this.config.roomItemHoverColor : this.config.roomItemColor;
        this.ctx.fillRect(x, y, width, height);
        
        // 绘制边框
        this.ctx.strokeStyle = '#bdc3c7';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, width, height);
        
        // 绘制房间信息
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // 房间名称
        this.ctx.font = 'bold 18px Arial';
        this.ctx.fillText(room.name, x + 15, y + 15);
        
        // 房间ID
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#7f8c8d';
        this.ctx.fillText(`ID: ${room.id}`, x + 15, y + 40);
        
        // 玩家数量
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.fillText(`${room.current_players}/${room.max_players} 玩家`, x + 15, y + 58);
        
        // 绘制加入按钮
        const joinButtonArea = this.getJoinButtonArea({x, y, width, height});
        
        const isButtonHovered = index === this.hoveredButtonIndex;
        this.ctx.fillStyle = isButtonHovered ? 
            this.config.buttonHoverColor : this.config.buttonColor;
        this.ctx.fillRect(joinButtonArea.x, joinButtonArea.y, joinButtonArea.width, joinButtonArea.height);
        
        this.ctx.strokeStyle = this.config.textColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(joinButtonArea.x, joinButtonArea.y, joinButtonArea.width, joinButtonArea.height);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('加入', 
            joinButtonArea.x + joinButtonArea.width / 2, 
            joinButtonArea.y + joinButtonArea.height / 2);
    }
    
    drawScrollbar() {
        if (this.maxScroll <= 0) return;
        
        const scrollbarWidth = 6;
        const scrollbarX = this.canvas.width - scrollbarWidth - 5;
        const scrollbarY = this.config.headerHeight;
        const scrollbarHeight = this.canvas.height - this.config.headerHeight;
        
        // 绘制滚动条背景
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(scrollbarX, scrollbarY, scrollbarWidth, scrollbarHeight);
        
        // 绘制滚动条滑块
        const thumbHeight = Math.max(20, scrollbarHeight * (scrollbarHeight / (scrollbarHeight + this.maxScroll)));
        const thumbY = scrollbarY + (this.scrollOffset / this.maxScroll) * (scrollbarHeight - thumbHeight);
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.fillRect(scrollbarX, thumbY, scrollbarWidth, thumbHeight);
    }
    
    onBackClick() {
        console.log("点击返回");
        GameStateManager.setGameState(GameStateManager.GAME_STATES.MAIN_MENU);
    }
    
    onJoinRoomClick(room) {
        console.log("加入房间:", room.name);
        
        if (room.current_players >= room.max_players) {
            this.showMessage("房间已满");
            return;
        }
        
        // 发送加入房间请求
        this.networkManager.joinRoom(room.id);
    }
    
    showMessage(message) {
        console.log("消息提示:", message);
        
        ErrorMessageHandler.showMessage(message);
    }
    
    // 处理加入房间失败
    handleRoomJoinFailed(errorInfo) {
        const { errorCode, errorMessage } = errorInfo;
        console.log("加入房间失败:", errorCode, errorMessage);
        
        // 使用统一的错误处理工具
        const userFriendlyMessage = ErrorMessageHandler.handleRoomError(errorCode);
        
        this.showMessage(userFriendlyMessage);
    }
    
    // 刷新房间列表
    refresh() {
        console.log("刷新房间列表");
        this.networkManager.getRoomList();
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
        this.rooms = [];
    }
}

export default RoomList;