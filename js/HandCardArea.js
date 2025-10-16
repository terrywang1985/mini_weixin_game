/**
 * 手牌区域 - 显示和管理玩家手牌
 */

import GameStateManager from './GameStateManager.js';

/**
 * 手牌区组件 - 显示玩家的手牌
 * 位于游戏界面的底部
 */

class HandCardArea {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        
        // 手牌配置
        this.config = {
            cardWidth: 55,   // 稍微减小宽度
            cardHeight: 75,  // 稍微减小高度
            cardSpacing: 3,  // 减小间距
            bottomMargin: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderColor: '#333',
            textColor: '#fff',
            selectedColor: '#4CAF50',
            hoverColor: '#666',
            maxVisibleCards: 9 // 增加到9张卡牌
        };
        
        // 手牌数据
        this.handCards = [];
        this.selectedCardIndex = -1;
        this.hoveredCardIndex = -1;
        
        // 滚动相关
        this.scrollOffset = 0; // 滚动偏移量
        this.maxScrollOffset = 0; // 最大滚动偏移
        
        // 布局信息
        this.areaRect = { x: 0, y: 0, width: 0, height: 0 };
        this.cardRects = [];
        
        // 拖拽滑动相关
        this.dragState = {
            isDragging: false,
            startX: 0,
            startScrollOffset: 0,
            lastX: 0,
            dragThreshold: 5, // 开始拖拽的最小距离
            sensitivity: 1.2, // 提高敏感度，减少更新频率
            lastUpdateTime: 0, // 上次更新时间
            updateThrottle: 16 // 更新节流，60FPS
        };
        
        // 可见性状态
        this.visible = false;
        
        // 绑定事件
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleWheel = this.handleWheel.bind(this);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchMove = this.handleTouchMove.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
        
        this.setupEventListeners();
        this.calculateLayout();
    }
    
    // 设置手牌数据
    setHandCards(cards) {
        this.handCards = cards || [];
        
        // // 临时测试：如果手牌数量小于10张，添加测试数据来验证滚动功能
        // if (this.handCards.length > 0 && this.handCards.length < 10) {
        //     const testCards = [];
        //     for (let i = this.handCards.length; i < 12; i++) {
        //         testCards.push({
        //             word: `测试${i}`,
        //             wordClass: 'Noun'
        //         });
        //     }
        //     this.handCards = [...this.handCards, ...testCards];
        //     console.log(`[HandCardArea] 添加测试数据，总数: ${this.handCards.length} 张`);
        // }
        
        const previousSelected = this.selectedCardIndex;
        this.selectedCardIndex = -1;
        this.calculateLayout();
        console.log(`[HandCardArea] 设置手牌: ${this.handCards.length} 张`);
        
        // 触发卡牌选择事件，通知游戏房间更新提示信息
        this.onCardSelected && this.onCardSelected(-1, null, previousSelected);
    }
    
    // 计算布局
    calculateLayout() {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 计算实际可以显示的卡牌数量（基于全屏宽度）
        const cardTotalWidth = this.config.cardWidth + this.config.cardSpacing;
        const sideMargin = 20; // 左右边距
        
        // 计算最大可显示数量（不再需要为滚动按钮预留空间）
        const availableWidth = canvasWidth - sideMargin * 2;
        const maxCardsWithoutScroll = Math.floor(availableWidth / cardTotalWidth);
        
        // 确定实际最大可见数量
        this.actualMaxVisible = Math.min(this.config.maxVisibleCards, maxCardsWithoutScroll, Math.max(1, this.handCards.length));
        
        console.log(`[手牌区] 布局: 画布=${canvasWidth}px, 可显示=${this.actualMaxVisible}张`);
        
        // 计算手牌区域大小（不再需要滚动按钮空间）
        const actualDisplayWidth = this.actualMaxVisible * cardTotalWidth - this.config.cardSpacing;
        const totalWidth = actualDisplayWidth;
        
        // 计算手牌区域位置（底部居中，不再需要为滚动按钮偏移）
        this.areaRect = {
            x: (canvasWidth - totalWidth) / 2,
            y: canvasHeight - this.config.cardHeight - this.config.bottomMargin,
            width: totalWidth,
            height: this.config.cardHeight
        };
        
        // 计算滚动相关（保留滚动逻辑，但移除滚动按钮）
        if (this.handCards.length > this.actualMaxVisible) {
            this.maxScrollOffset = Math.max(0, this.handCards.length - this.actualMaxVisible);
            this.scrollOffset = Math.min(this.scrollOffset, this.maxScrollOffset);
        } else {
            this.scrollOffset = 0;
            this.maxScrollOffset = 0;
        }
        
        // 重新计算每张卡牌的位置（考虑滚动偏移）
        this.cardRects = [];
        const startX = this.areaRect.x;
        const cardY = this.areaRect.y;
        
        for (let i = 0; i < this.handCards.length; i++) {
            const displayIndex = i - this.scrollOffset;
            
            // 只计算可见卡牌的位置（使用实际可见数量）
            if (displayIndex >= 0 && displayIndex < this.actualMaxVisible) {
                const cardX = startX + displayIndex * cardTotalWidth;
                
                this.cardRects.push({
                    x: cardX,
                    y: cardY,
                    width: this.config.cardWidth,
                    height: this.config.cardHeight,
                    index: i,
                    visible: true
                });
            }
        }
    }
    
    // 渲染手牌区域
    render() {
        if (this.handCards.length === 0) return;
        
        // 绘制可见的卡牌
        this.cardRects.forEach((cardRect) => {
            if (cardRect.visible) {
                this.drawCard(this.handCards[cardRect.index], cardRect.index);
            }
        });
        
        // 绘制手牌数量指示器（简化显示）
        if (this.handCards.length > this.actualMaxVisible) {
            const startIndex = this.scrollOffset;
            const endIndex = Math.min(this.scrollOffset + this.actualMaxVisible, this.handCards.length);
            
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'bottom';
            
            const textX = this.areaRect.x + this.areaRect.width / 2;
            const textY = this.areaRect.y - 5;
            this.ctx.fillText(`${startIndex + 1}-${endIndex} / ${this.handCards.length}`, textX, textY);
        }
    }
    
    // 绘制单张卡牌
    drawCard(card, index) {
        // 查找对应的cardRect
        const rect = this.cardRects.find(r => r.index === index);
        if (!rect || !rect.visible) return;
        
        // 确定卡牌状态
        const isSelected = index === this.selectedCardIndex;
        const isHovered = index === this.hoveredCardIndex;
        
        // 圆角半径
        const radius = 10;
        
        this.ctx.save();
        
        // 绘制卡牌阴影
        if (isSelected) {
            this.ctx.shadowColor = 'rgba(76, 175, 80, 0.6)';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetY = 5;
        } else if (isHovered) {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowOffsetY = 3;
        }
        
        // 绘制渐变背景
        let gradient;
        if (isSelected) {
            gradient = this.ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
            gradient.addColorStop(0, '#66BB6A');
            gradient.addColorStop(1, '#43A047');
        } else if (isHovered) {
            gradient = this.ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
            gradient.addColorStop(0, '#64B5F6');
            gradient.addColorStop(1, '#42A5F5');
        } else {
            gradient = this.ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
            gradient.addColorStop(0, '#42A5F5');
            gradient.addColorStop(1, '#1E88E5');
        }
        this.ctx.fillStyle = gradient;
        
        // 绘制圆角矩形
        this.ctx.beginPath();
        this.ctx.moveTo(rect.x + radius, rect.y);
        this.ctx.lineTo(rect.x + rect.width - radius, rect.y);
        this.ctx.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius);
        this.ctx.lineTo(rect.x + rect.width, rect.y + rect.height - radius);
        this.ctx.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - radius, rect.y + rect.height);
        this.ctx.lineTo(rect.x + radius, rect.y + rect.height);
        this.ctx.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius);
        this.ctx.lineTo(rect.x, rect.y + radius);
        this.ctx.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 重置阴影
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetY = 0;
        
        // 绘制卡牌边框
        this.ctx.strokeStyle = isSelected ? '#FFEB3B' : 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = isSelected ? 3 : 2;
        this.ctx.stroke();
        
        this.ctx.restore();
        
        // 绘制卡牌文字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 14px "PingFang SC", "Microsoft YaHei", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 添加文字阴影
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 3;
        
        // 绘制单词（主要内容）- 居中显示
        const word = card.word || '未知';
        this.ctx.fillText(word, rect.x + rect.width / 2, rect.y + rect.height / 2);
        
        // 重置阴影
        this.ctx.shadowColor = 'transparent';
        this.ctx.shadowBlur = 0;
    }
    
    // 文字自动换行
    wrapText(text, maxWidth) {
        const words = [];
        let currentWord = '';
        
        for (let i = 0; i < text.length; i++) {
            currentWord += text[i];
            const metrics = this.ctx.measureText(currentWord);
            
            if (metrics.width > maxWidth && currentWord.length > 1) {
                words.push(currentWord.slice(0, -1));
                currentWord = text[i];
            }
        }
        
        if (currentWord) {
            words.push(currentWord);
        }
        
        return words.length > 0 ? words : [text];
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 微信小游戏环境中使用wx API处理事件
        if (typeof wx !== 'undefined') {
            // 使用wx API替代canvas事件
            wx.onTouchStart(this.boundHandleTouchStart);
            wx.onTouchMove(this.boundHandleTouchMove);
            wx.onTouchEnd(this.boundHandleTouchEnd);
            
            // 使用wx.onTouchStart处理点击事件
            wx.onTouchStart((res) => {
                if (res.touches && res.touches.length > 0) {
                    const touch = res.touches[0];
                    // 创建模拟事件对象
                    const simulatedEvent = {
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => {},
                        touches: res.touches
                    };
                    this.boundHandleClick(simulatedEvent);
                }
            });
        }
    }
    
    // 移除事件监听器
    removeEventListeners() {
        // 微信小游戏环境中不支持removeEventListener，事件监听器会在页面销毁时自动移除
        if (typeof wx !== 'undefined') {
            console.log("微信小游戏环境中事件监听器将在页面销毁时自动移除");
        }
    }
    
    // 选择卡牌
    selectCard(index) {
        if (index < 0 || index >= this.handCards.length) return;
        
        const previousSelected = this.selectedCardIndex;
        this.selectedCardIndex = index;
        
        const selectedCard = this.handCards[index];
        if (selectedCard) {
            console.log(`[HandCardArea] 选择卡牌: ${index} - ${selectedCard.word}`);
        } else {
            console.log(`[HandCardArea] 选择卡牌: ${index} - 未知卡牌`);
        }
        console.log(`[HandCardArea] 当前选中索引: ${this.selectedCardIndex}`);
        
        // 立即重新渲染以显示选中效果
        this.render();
        
        // 触发卡牌选择事件
        this.onCardSelected && this.onCardSelected(index, selectedCard, previousSelected);
    }
    
    // 获取选中的卡牌
    getSelectedCard() {
        if (this.selectedCardIndex >= 0 && this.selectedCardIndex < this.handCards.length) {
            return {
                index: this.selectedCardIndex,
                card: this.handCards[this.selectedCardIndex]
            };
        }
        return null;
    }
    
    // 清除选择
    clearSelection() {
        this.selectedCardIndex = -1;
        // 重新渲染以更新显示
        this.render();
        // 触发卡牌选择事件，通知游戏房间更新提示信息
        this.onCardSelected && this.onCardSelected(-1, null, -1);
    }
    
    // 出牌
    onPlayCard() {
        // 检查是否有选中的卡牌
        if (this.selectedCardIndex === -1) {
            console.log('[HandCardArea] 没有选中的卡牌');
            return;
        }
        
        // 检查是否是当前玩家的回合
        const gameState = GameStateManager.gameData.gameState;
        if (!gameState) {
            console.log('[HandCardArea] 游戏状态未初始化');
            return;
        }
        
        const currentTurn = gameState.currentTurn;
        const players = gameState.players || [];
        const currentPlayer = players[currentTurn];
        
        if (!currentPlayer) {
            console.log('[HandCardArea] 无法确定当前回合玩家');
            return;
        }
        
        const userInfo = GameStateManager.getUserInfo();
        if (currentPlayer.id !== userInfo.uid) {
            console.log('[HandCardArea] 不是你的回合，无法出牌');
            this.showError('现在不是你的回合，请等待其他玩家操作');
            return;
        }
        
        // 获取选中的卡牌
        const selectedCard = this.handCards[this.selectedCardIndex];
        if (!selectedCard) {
            console.log('[HandCardArea] 选中的卡牌不存在');
            return;
        }
        
        console.log('[HandCardArea] 出牌:', selectedCard.word || '未知卡牌');
        
        // 调用出牌回调（不指定位置，由回调函数决定）
        if (this.onCardPlayed) {
            this.onCardPlayed(this.selectedCardIndex, selectedCard);
        }
        
        // 清除选中状态
        const previousSelected = this.selectedCardIndex;
        this.selectedCardIndex = -1;
        this.render();
        // 触发卡牌选择事件，通知游戏房间更新提示信息
        this.onCardSelected && this.onCardSelected(-1, null, previousSelected);
    }
    
    // 显示手牌区域
    show() {
        this.visible = true;
        this.calculateLayout();
    }
    
    // 隐藏手牌区域
    hide() {
        this.visible = false;
        this.selectedCardIndex = -1;
        this.hoveredCardIndex = -1;
    }
    
    // 检查是否可见
    isVisible() {
        return this.visible && this.handCards.length > 0;
    }
    
    // 向左滚动
    scrollLeft() {
        if (this.scrollOffset > 0) {
            this.scrollOffset--;
            this.calculateLayout();
            console.log(`[HandCardArea] 向左滚动，当前偏移: ${this.scrollOffset}`);
        }
    }
    
    // 向右滚动
    scrollRight() {
        if (this.scrollOffset < this.maxScrollOffset) {
            this.scrollOffset++;
            this.calculateLayout();
            console.log(`[HandCardArea] 向右滚动，当前偏移: ${this.scrollOffset}`);
        }
    }
    
    // 处理鼠标滚轮事件
    handleWheel(event) {
        // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
        let x, y;
        if (typeof wx !== 'undefined') {
            // 在微信小游戏环境中，我们假设事件对象已经包含了相对于canvas的坐标
            x = event.clientX || 0;
            y = event.clientY || 0;
        } else {
            return; // 无法获取坐标，直接返回
        }
        
        if (x >= this.areaRect.x && x <= this.areaRect.x + this.areaRect.width &&
            y >= this.areaRect.y && y <= this.areaRect.y + this.areaRect.height) {
            
            if (event.deltaY > 0) {
                this.scrollRight();
            } else {
                this.scrollLeft();
            }
        }
    }
    
    // 鼠标按下事件处理
    handleMouseDown(event) {
        // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
        let x, y;
        if (typeof wx !== 'undefined') {
            // 在微信小游戏环境中，我们假设事件对象已经包含了相对于canvas的坐标
            x = event.clientX || 0;
            y = event.clientY || 0;
        } else {
            return; // 无法获取坐标，直接返回
        }
        
        // 检查是否在手牌区域内
        if (this.isInHandCardArea(x, y)) {
            this.startDrag(x);
        }
    }
    
    // 鼠标抬起事件处理
    handleMouseUp(event) {
        if (this.dragState.isDragging) {
            this.endDrag();
        }
    }
    
    // 触摸开始事件处理
    handleTouchStart(event) {
        if (event.touches && event.touches.length > 0) {
            const touch = event.touches[0];
            
            // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
            let x, y;
            if (typeof wx !== 'undefined') {
                // 在微信小游戏环境中，我们直接使用touch坐标
                x = touch.clientX || 0;
                y = touch.clientY || 0;
            } else {
                return; // 无法获取坐标，直接返回
            }
            
            // 检查是否在手牌区域内
            if (this.isInHandCardArea(x, y)) {
                this.startDrag(x);
            }
        }
    }
    
    // 触摸移动事件处理
    handleTouchMove(event) {
        if (this.dragState.isDragging && event.touches && event.touches.length > 0) {
            const touch = event.touches[0];
            
            // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
            let x;
            if (typeof wx !== 'undefined') {
                // 在微信小游戏环境中，我们直接使用touch坐标
                x = touch.clientX || 0;
            } else {
                return; // 无法获取坐标，直接返回
            }
            
            this.updateDrag(x);
        }
    }
    
    // 触摸结束事件处理
    handleTouchEnd(event) {
        if (this.dragState.isDragging) {
            this.endDrag();
        }
    }
    
    // 检查坐标是否在手牌区域内
    isInHandCardArea(x, y) {
        return x >= this.areaRect.x && 
               x <= this.areaRect.x + this.areaRect.width &&
               y >= this.areaRect.y && 
               y <= this.areaRect.y + this.areaRect.height;
    }
    
    // 开始拖拽
    startDrag(x) {
        this.dragState.isDragging = true;
        this.dragState.startX = x;
        this.dragState.lastX = x;
        this.dragState.startScrollOffset = this.scrollOffset;
        this.dragState.lastUpdateTime = 0; // 重置节流时间
        this.canvas.style.cursor = 'grabbing';
    }
    
    // 更新拖拽状态
    updateDrag(x) {
        if (!this.dragState.isDragging) return;
        
        // 节流更新，减少频繁计算
        const now = Date.now();
        if (now - this.dragState.lastUpdateTime < this.dragState.updateThrottle) {
            this.dragState.lastX = x;
            return;
        }
        this.dragState.lastUpdateTime = now;
        
        const deltaX = x - this.dragState.startX;
        const cardWidth = this.config.cardWidth + this.config.cardSpacing;
        
        // 计算新的滚动偏移
        const dragCards = Math.round(-deltaX * this.dragState.sensitivity / cardWidth);
        const newScrollOffset = Math.max(0, 
            Math.min(this.maxScrollOffset, this.dragState.startScrollOffset + dragCards));
        
        // 只有偏移量真正改变时才重新计算布局
        if (newScrollOffset !== this.scrollOffset) {
            this.scrollOffset = newScrollOffset;
            this.calculateLayout();
            // 立即重新渲染以提供流畅的拖拽体验
            this.render();
        }
        
        this.dragState.lastX = x;
    }
    
    // 结束拖拽
    endDrag() {
        this.dragState.isDragging = false;
        this.canvas.style.cursor = 'default';
    }
    
    // 重写鼠标移动处理，在拖拽时更新拖拽状态
    handleMouseMove(event) {
        // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
        let x, y;
        if (typeof wx !== 'undefined') {
            // 在微信小游戏环境中，我们假设事件对象已经包含了相对于canvas的坐标
            x = event.clientX || 0;
            y = event.clientY || 0;
        } else {
            return; // 无法获取坐标，直接返回
        }
        
        // 如果正在拖拽，更新拖拽状态
        if (this.dragState.isDragging) {
            this.updateDrag(x);
            return;
        }
        
        // 原有的鼠标悬停逻辑
        // 检查是否悬停在某张卡牌上
        let newHoveredIndex = -1;
        for (let i = 0; i < this.cardRects.length; i++) {
            const cardRect = this.cardRects[i];
            if (cardRect.visible &&
                x >= cardRect.x && x <= cardRect.x + cardRect.width &&
                y >= cardRect.y && y <= cardRect.y + cardRect.height) {
                newHoveredIndex = cardRect.index;
                break;
            }
        }
        
        if (newHoveredIndex !== this.hoveredCardIndex) {
            this.hoveredCardIndex = newHoveredIndex;
            // 更新鼠标指针样式
            if (this.isInHandCardArea(x, y) && this.handCards.length > this.actualMaxVisible) {
                if (this.canvas) {
                    this.canvas.style.cursor = 'grab'; // 在手牌区域显示可拖拽光标
                }
            } else {
                if (this.canvas) {
                    this.canvas.style.cursor = (newHoveredIndex >= 0) ? 'pointer' : 'default';
                }
            }
        }
    }
    
    // 重写点击处理，防止拖拽时误触发点击
    handleClick(event) {
        // 如果刚刚结束拖拽，忽略点击事件
        if (Math.abs(event.clientX - this.dragState.startX) > this.dragState.dragThreshold) {
            return;
        }
        
        // 微信小游戏环境中不支持getBoundingClientRect，使用其他方式获取坐标
        let x, y;
        if (typeof wx !== 'undefined') {
            // 在微信小游戏环境中，我们假设事件对象已经包含了相对于canvas的坐标
            x = event.clientX || 0;
            y = event.clientY || 0;
        } else {
            return; // 无法获取坐标，直接返回
        }
        
        // 检查是否在手牌区域内
        if (!this.isInHandCardArea(x, y)) {
            return;
        }
        
        console.log(`[HandCardArea] 点击坐标: (${x}, ${y})`);
        
        // 检查是否点击了某张卡牌
        for (let i = 0; i < this.cardRects.length; i++) {
            const cardRect = this.cardRects[i];
            if (cardRect.visible && 
                x >= cardRect.x && x <= cardRect.x + cardRect.width &&
                y >= cardRect.y && y <= cardRect.y + cardRect.height) {
                
                console.log(`[HandCardArea] 点击了卡牌 ${cardRect.index}`);
                this.selectCard(cardRect.index);
                break;
            }
        }
    }
    
    // 显示错误提示
    showError(message) {
        // 在微信小游戏环境中显示提示
        if (typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({
                title: message,
                icon: 'none',
                duration: 2000
            });
        } else if (typeof alert !== 'undefined') {
            // 在浏览器环境中使用alert
            alert(message);
        } else {
            // 其他环境，输出到控制台
            console.log("错误提示:", message);
        }
    }
    
    // 销毁组件
    destroy() {
        this.removeEventListeners();
        this.handCards = [];
        this.cardRects = [];
    }
    
    // 设置卡牌选择回调
    onCardSelect(callback) {
        this.onCardSelected = callback;
    }
}

export default HandCardArea;