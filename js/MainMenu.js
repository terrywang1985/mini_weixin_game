/**
 * 主菜单页面 - 显示创建房间和房间列表按钮
 */

import GameStateManager from './GameStateManager.js';
import ErrorMessageHandler from './ErrorMessageHandler.js';

class MainMenu {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.networkManager = networkManager;
        
        // 页面元素
        this.buttons = [];
        this.isVisible = false;
        
        // 界面配置
        this.config = {
            backgroundColor: '#2c3e50',
            buttonColor: '#3498db',
            buttonHoverColor: '#2980b9',
            textColor: '#ffffff',
            titleColor: '#ecf0f1',
            buttonWidth: 200,
            buttonHeight: 60,
            buttonSpacing: 20
        };
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        // 创建按钮
        this.createButtons();
        
        // 监听游戏状态变化
        GameStateManager.onStateChange((oldState, newState) => {
            if (newState === GameStateManager.GAME_STATES.MAIN_MENU) {
                this.show();
            } else {
                this.hide();
            }
        });
        
        // 监听加入房间失败事件
        this.networkManager.on('room_join_failed', (errorInfo) => {
            this.handleRoomJoinFailed(errorInfo);
        });
    }
    
    createButtons() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // 创建房间按钮
        this.buttons.push({
            id: 'create_room',
            text: '创建房间',
            x: centerX - this.config.buttonWidth / 2,
            y: centerY - this.config.buttonHeight - this.config.buttonSpacing / 2,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight,
            isHovered: false,
            onClick: () => this.onCreateRoomClick()
        });
        
        // 加入指定房间按钮
        this.buttons.push({
            id: 'join_room',
            text: '加入指定房间',
            x: centerX - this.config.buttonWidth / 2,
            y: centerY + this.config.buttonSpacing / 2,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight,
            isHovered: false,
            onClick: () => this.onJoinRoomClick()
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
                
                // 检查是否点击了按钮
                this.buttons.forEach(button => {
                    if (this.isPointInButton(touchX, touchY, button)) {
                        button.onClick();
                    }
                });
                
                // 检查是否点击了重连按钮
                if (this.reconnectButton && this.isPointInButton(touchX, touchY, this.reconnectButton)) {
                    this.onReconnectClick();
                }
            });
        } else {
            // 浏览器环境的事件处理
            // 鼠标移动事件
            this.canvas.addEventListener('mousemove', (e) => {
                if (!this.isVisible) return;
                
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                this.buttons.forEach(button => {
                    button.isHovered = this.isPointInButton(mouseX, mouseY, button);
                });
                
                this.render();
            });
            
            // 鼠标点击事件
            this.canvas.addEventListener('click', (e) => {
                if (!this.isVisible) return;
                
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // 检查是否点击了按钮
                this.buttons.forEach(button => {
                    if (this.isPointInButton(mouseX, mouseY, button)) {
                        button.onClick();
                    }
                });
                
                // 检查是否点击了重连按钮
                if (this.reconnectButton && this.isPointInButton(mouseX, mouseY, this.reconnectButton)) {
                    this.onReconnectClick();
                }
            });
            
            // 触摸事件（移动端浏览器支持）
            this.canvas.addEventListener('touchstart', (e) => {
                if (!this.isVisible) return;
                
                e.preventDefault();
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;
                
                // 检查是否点击了按钮
                this.buttons.forEach(button => {
                    if (this.isPointInButton(touchX, touchY, button)) {
                        button.onClick();
                    }
                });
                
                // 检查是否点击了重连按钮
                if (this.reconnectButton && this.isPointInButton(touchX, touchY, this.reconnectButton)) {
                    this.onReconnectClick();
                }
            });
        }
    }
    
    isPointInButton(x, y, button) {
        return x >= button.x && 
               x <= button.x + button.width && 
               y >= button.y && 
               y <= button.y + button.height;
    }
    
    show() {
        this.isVisible = true;
        this.render();
        console.log("显示主菜单");
    }
    
    hide() {
        this.isVisible = false;
        console.log("隐藏主菜单");
    }
    
    render() {
        if (!this.isVisible) return;
        
        // 清空画布
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制标题
        this.drawTitle();
        
        // 绘制用户信息
        this.drawUserInfo();
        
        // 绘制按钮
        this.drawButtons();
        
        // 绘制连接状态
        this.drawConnectionStatus();
    }
    
    drawTitle() {
        this.ctx.fillStyle = this.config.titleColor;
        this.ctx.font = 'bold 32px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const titleY = this.canvas.height / 2 - 120;
        this.ctx.fillText('连词成句', this.canvas.width / 2, titleY);
    }
    
    drawUserInfo() {
        // 暂时隐藏用户昵称显示，因为昵称太长
        // const userInfo = GameStateManager.getUserInfo();
        // if (userInfo.nickname) {
        //     this.ctx.fillStyle = this.config.textColor;
        //     this.ctx.font = '16px Arial';
        //     this.ctx.textAlign = 'center';
        //     
        //     const userY = this.canvas.height / 2 - 80;
        //     this.ctx.fillText(`欢迎，${userInfo.nickname}`, this.canvas.width / 2, userY);
        // }
    }
    
    drawButtons() {
        this.buttons.forEach(button => {
            // 绘制按钮背景
            this.ctx.fillStyle = button.isHovered ? 
                this.config.buttonHoverColor : 
                this.config.buttonColor;
            
            this.ctx.fillRect(button.x, button.y, button.width, button.height);
            
            // 绘制按钮边框
            this.ctx.strokeStyle = this.config.textColor;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(button.x, button.y, button.width, button.height);
            
            // 绘制按钮文字
            this.ctx.fillStyle = this.config.textColor;
            this.ctx.font = '18px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            const textX = button.x + button.width / 2;
            const textY = button.y + button.height / 2;
            this.ctx.fillText(button.text, textX, textY);
        });
    }
    
    drawConnectionStatus() {
        const networkStatus = GameStateManager.getNetworkStatus();
        
        // 绘制连接状态指示器
        const statusX = 20;
        const statusY = 20;
        const statusRadius = 8;
        
        this.ctx.beginPath();
        this.ctx.arc(statusX, statusY, statusRadius, 0, 2 * Math.PI);
        this.ctx.fillStyle = networkStatus.isConnected && networkStatus.isAuthenticated ? 
            '#27ae60' : '#e74c3c';
        this.ctx.fill();
        
        // 绘制状态文字
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        const statusText = networkStatus.isConnected && networkStatus.isAuthenticated ? 
            '已连接' : '未连接';
        this.ctx.fillText(statusText, statusX + statusRadius + 10, statusY);
        
        // 如果未连接，显示重连按钮
        if (!networkStatus.isConnected || !networkStatus.isAuthenticated) {
            this.drawReconnectButton();
        }
    }
    
    drawReconnectButton() {
        const buttonWidth = 100;
        const buttonHeight = 30;
        const buttonX = this.canvas.width - buttonWidth - 20;
        const buttonY = 20;
        
        // 绘制按钮背景
        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // 绘制按钮边框
        this.ctx.strokeStyle = this.config.textColor;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
        
        // 绘制按钮文字
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('重新连接', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
        
        // 保存重连按钮位置，用于事件处理
        this.reconnectButton = {
            x: buttonX,
            y: buttonY,
            width: buttonWidth,
            height: buttonHeight
        };
    }
    
    onCreateRoomClick() {
        console.log("点击创建房间");
        
        if (!GameStateManager.isAuthenticated()) {
            this.showMessage("请先登录");
            return;
        }
        
        // 弹出输入框让用户输入房间名称
        this.showCreateRoomDialog();
    }
    
    
    onJoinRoomClick() {
        console.log("点击加入指定房间");
        
        if (!GameStateManager.isAuthenticated()) {
            this.showMessage("请先登录");
            return;
        }
        
        // 弹出输入框让用户输入房间ID
        this.showJoinRoomDialog();
    }
    
    // 处理重连按钮点击
    onReconnectClick() {
        console.log("点击重新连接");
        // 触发重连事件
        if (typeof window !== 'undefined' && window.mainInstance) {
            window.mainInstance.reconnect();
        }
    }
    
    showJoinRoomDialog() {
        if (typeof wx !== 'undefined' && wx.showModal) {
            // 微信小游戏环境
            wx.showModal({
                title: '加入房间',
                content: '请输入朋友的房间号',
                editable: true,
                placeholderText: '输入房间号...',
                success: (res) => {
                    if (res.confirm && res.content) {
                        const roomId = res.content.trim();
                        if (roomId && /^\d+$/.test(roomId)) {
                            console.log("加入房间:", roomId);
                            this.networkManager.joinRoom(roomId);
                        } else {
                            wx.showToast({
                                title: '请输入有效的房间号（纯数字）',
                                icon: 'none',
                                duration: 2000
                            });
                        }
                    }
                }
            });
        } else if (typeof prompt !== 'undefined') {
            // 浏览器环境
            const roomId = prompt("请输入朋友的房间号:", "");
            
            if (roomId && roomId.trim()) {
                console.log("加入房间:", roomId.trim());
                this.networkManager.joinRoom(roomId.trim());
            }
        } else {
            this.showMessage("当前环境不支持输入房间号");
        }
    }
    
    showCreateRoomDialog() {
        // 直接创建房间，不弹出对话框
        const defaultName = `我的房间`;
        console.log("创建房间:", defaultName);
        this.networkManager.createRoom(defaultName);
    }
    
    // 处理加入房间失败
    handleRoomJoinFailed(errorInfo) {
        const { errorCode, errorMessage } = errorInfo;
        console.log("加入房间失败:", errorCode, errorMessage);
        
        // 使用统一的错误处理工具
        const userFriendlyMessage = ErrorMessageHandler.handleRoomError(errorCode);
        
        this.showMessage(userFriendlyMessage);
    }
    
    showMessage(message) {
        // 显示消息提示
        console.log("消息提示:", message);
        
        ErrorMessageHandler.showMessage(message);
    }
    
    // 更新画布尺寸
    updateCanvasSize() {
        // 重新计算按钮位置
        this.buttons = [];
        this.createButtons();
        
        if (this.isVisible) {
            this.render();
        }
    }
    
    // 销毁页面
    destroy() {
        this.isVisible = false;
        this.buttons = [];
        this.reconnectButton = null;
        
        // 移除事件监听器
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
    }
}

export default MainMenu;