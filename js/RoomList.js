/**
 * 房间列表页面 - 显示房间列表和加入功能
 */

import GameStateManager from './GameStateManager.js';

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
        
        // 滚轮事件
        this.canvas.addEventListener('wheel', (e) => {
            if (!this.isVisible) return;
            
            e.preventDefault();
            
            const scrollDelta = e.deltaY > 0 ? 20 : -20;
            this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + scrollDelta));
            
            this.render();
        });
        
        // 触摸事件
        let touchStartY = 0;
        
        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.isVisible) return;
            
            e.preventDefault();
            touchStartY = e.touches[0].clientY;
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isVisible) return;
            
            e.preventDefault();
            const touchY = e.touches[0].clientY;
            const deltaY = touchStartY - touchY;
            
            this.scrollOffset = Math.max(0, Math.min(this.maxScroll, this.scrollOffset + deltaY));
            touchStartY = touchY;
            
            this.render();
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (!this.isVisible) return;
            
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;
            
            this.handleClick(touchX, touchY);
        });
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
    
    handleClick(mouseX, mouseY) {
        // 检查返回按钮
        const backButtonArea = this.getBackButtonArea();
        if (this.isPointInArea(mouseX, mouseY, backButtonArea)) {
            this.onBackClick();
            return;
        }
        
        // 检查房间项的加入按钮
        const roomListY = this.config.headerHeight;
        
        for (let i = 0; i < this.rooms.length; i++) {
            const roomY = roomListY + (i * (this.config.roomItemHeight + this.config.roomItemSpacing)) - this.scrollOffset;
            
            if (roomY > this.canvas.height || roomY + this.config.roomItemHeight < roomListY) {
                continue;
            }
            
            const roomArea = {
                x: this.config.padding,
                y: roomY,
                width: this.canvas.width - 2 * this.config.padding,
                height: this.config.roomItemHeight
            };
            
            const joinButtonArea = this.getJoinButtonArea(roomArea);
            if (this.isPointInArea(mouseX, mouseY, joinButtonArea)) {
                this.onJoinRoomClick(this.rooms[i]);
                break;
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
        
        if (typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            });
        } else {
            alert(message);
        }
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