/**
 * 匹配等待 UI - 显示匹配倒计时和取消按钮
 */

import GameStateManager from './GameStateManager.js';
import ErrorMessageHandler from './ErrorMessageHandler.js';

class MatchWaitingUI {
    constructor(canvas, networkManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.networkManager = networkManager;
        
        this.isVisible = false;
        this.matchStartTime = 0;
        this.matchTimeout = 30; // 30秒超时
        this.remainingTime = 30;
        this.animationFrameId = null;
        
        // 界面配置
        this.config = {
            backgroundColor: 'rgba(0, 0, 0, 0.95)', // 改为95%不透明,几乎完全遮挡
            boxColor: '#34495e',
            textColor: '#ffffff',
            buttonColor: '#e74c3c',
            buttonHoverColor: '#c0392b',
            titleColor: '#3498db',
            timerColor: '#2ecc71',
            buttonWidth: 150,
            buttonHeight: 50
        };
        
        this.cancelButton = null;
        this.init();
    }
    
    init() {
        // 监听匹配相关事件
        this.networkManager.on('match_started', () => {
            this.show();
        });
        
        this.networkManager.on('match_success', (roomData) => {
            this.hide();
            console.log("[MatchWaitingUI] 匹配成功，进入房间");
        });
        
        this.networkManager.on('match_failed', (error) => {
            this.hide();
            ErrorMessageHandler.showMessage(error.message || '匹配失败');
        });
        
        this.networkManager.on('match_cancelled', () => {
            this.hide();
            ErrorMessageHandler.showMessage('已取消匹配');
        });
        
        this.networkManager.on('match_error', (error) => {
            this.hide();
            ErrorMessageHandler.showMessage(error.message || '匹配出错');
        });
        
        // 设置事件监听器
        this.setupEventListeners();
    }
    
    show() {
        this.isVisible = true;
        this.matchStartTime = Date.now();
        this.remainingTime = this.matchTimeout;
        
        console.log("[MatchWaitingUI] 显示匹配等待界面");
        
        // 开始倒计时动画
        this.startCountdown();
    }
    
    hide() {
        this.isVisible = false;
        this.stopCountdown();
        console.log("[MatchWaitingUI] 隐藏匹配等待界面");
    }
    
    startCountdown() {
        this.stopCountdown(); // 清除之前的定时器
        
        const updateCountdown = () => {
            if (!this.isVisible) {
                this.stopCountdown();
                return;
            }
            
            const elapsed = Math.floor((Date.now() - this.matchStartTime) / 1000);
            this.remainingTime = Math.max(0, this.matchTimeout - elapsed);
            
            this.render();
            
            if (this.remainingTime > 0) {
                this.animationFrameId = requestAnimationFrame(updateCountdown);
            } else {
                // 超时 - 先触发事件重置状态,再隐藏界面
                console.log("[MatchWaitingUI] 客户端匹配倒计时超时");
                // 先触发匹配失败事件,确保 MainMenu.isMatching 被重置
                this.networkManager.emit('match_failed', { 
                    message: '匹配超时，未找到对手' 
                });
                // 再隐藏界面
                this.hide();
            }
        };
        
        this.animationFrameId = requestAnimationFrame(updateCountdown);
    }
    
    stopCountdown() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    render() {
        if (!this.isVisible) return;
        
        // 绘制半透明背景遮罩（完全覆盖整个画布，阻止点击穿透）
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制中央提示框 - 调整位置，避免遮挡标题
        const boxWidth = 400;
        const boxHeight = 300;
        const boxX = (this.canvas.width - boxWidth) / 2;
        // 调整Y位置，让框体向下移动，不遮挡标题
        const boxY = Math.max(150, (this.canvas.height - boxHeight) / 2);
        
        // 绘制框背景
        this.ctx.fillStyle = this.config.boxColor;
        this.ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
        
        // 绘制框边框
        this.ctx.strokeStyle = this.config.titleColor;
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
        
        // 绘制标题
        this.ctx.fillStyle = this.config.titleColor;
        this.ctx.font = 'bold 28px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('正在匹配对手...', boxX + boxWidth / 2, boxY + 60);
        
        // 绘制倒计时
        this.drawCountdown(boxX, boxY, boxWidth);
        
        // 绘制取消按钮
        this.drawCancelButton(boxX, boxY, boxWidth, boxHeight);
        
        // 绘制匹配提示
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '16px Arial';
        this.ctx.fillText('请稍候，正在为您寻找旗鼓相当的对手', boxX + boxWidth / 2, boxY + 180);
    }
    
    drawCountdown(boxX, boxY, boxWidth) {
        // 绘制倒计时圆环
        const centerX = boxX + boxWidth / 2;
        const centerY = boxY + 120;
        const radius = 50;
        
        // 绘制背景圆
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#34495e';
        this.ctx.lineWidth = 8;
        this.ctx.stroke();
        
        // 绘制进度圆
        const progress = this.remainingTime / this.matchTimeout;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * progress);
        this.ctx.strokeStyle = this.config.timerColor;
        this.ctx.lineWidth = 8;
        this.ctx.stroke();
        
        // 绘制倒计时数字
        this.ctx.fillStyle = this.config.timerColor;
        this.ctx.font = 'bold 36px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.remainingTime.toString(), centerX, centerY);
        
        // 绘制秒单位
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '14px Arial';
        this.ctx.fillText('秒', centerX, centerY + 30);
    }
    
    drawCancelButton(boxX, boxY, boxWidth, boxHeight) {
        const buttonX = boxX + (boxWidth - this.config.buttonWidth) / 2;
        const buttonY = boxY + boxHeight - 80;
        
        // 保存按钮位置，用于点击检测
        this.cancelButton = {
            x: buttonX,
            y: buttonY,
            width: this.config.buttonWidth,
            height: this.config.buttonHeight
        };
        
        // 绘制按钮背景
        this.ctx.fillStyle = this.config.buttonColor;
        this.ctx.fillRect(buttonX, buttonY, this.config.buttonWidth, this.config.buttonHeight);
        
        // 绘制按钮边框
        this.ctx.strokeStyle = this.config.textColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(buttonX, buttonY, this.config.buttonWidth, this.config.buttonHeight);
        
        // 绘制按钮文字
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '18px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('取消匹配', buttonX + this.config.buttonWidth / 2, buttonY + this.config.buttonHeight / 2);
    }
    
    setupEventListeners() {
        // 不在这里设置全局监听器
        // 事件处理将通过 main.js 的统一事件分发机制
    }
    
    handleClick(x, y) {
        if (!this.isVisible) return false; // 返回 false 表示未处理
        
        // 当界面可见时，拦截所有点击事件
        // 检查是否点击了取消按钮
        if (this.cancelButton && this.isPointInButton(x, y, this.cancelButton)) {
            console.log("[MatchWaitingUI] 点击取消匹配");
            this.onCancelClick();
        }
        
        // 返回 true 表示事件已被处理，阻止传播到下层
        return true;
    }
    
    isPointInButton(x, y, button) {
        return x >= button.x && 
               x <= button.x + button.width && 
               y >= button.y && 
               y <= button.y + button.height;
    }
    
    onCancelClick() {
        console.log("[MatchWaitingUI] 取消匹配");
        this.networkManager.cancelMatch();
    }
    
    // 更新画布尺寸
    updateCanvasSize() {
        if (this.isVisible) {
            this.render();
        }
    }
    
    // 销毁
    destroy() {
        this.stopCountdown();
        this.isVisible = false;
        this.cancelButton = null;
    }
}

export default MatchWaitingUI;
