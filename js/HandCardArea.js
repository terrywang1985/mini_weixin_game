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
        
        // 出牌按钮配置
        this.playButton = {
            x: 0, y: 0, width: 80, height: 35,
            visible: false,
            hovered: false
        };
        
        // 拖拽滑动相关
        this.dragState = {
            isDragging: false,
            startX: 0,
            startScrollOffset: 0,
            lastX: 0,
            dragThreshold: 5, // 开始拖拽的最小距离
            sensitivity: 0.8 // 滑动敏感度
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
        
        this.selectedCardIndex = -1;
        this.calculateLayout();
        console.log(`[HandCardArea] 设置手牌: ${this.handCards.length} 张`);
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
        
        // 计算每张卡牌的位置（考虑滚动偏移）
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
        
        // 计算出牌按钮位置（在手牌区上方）
        this.playButton.x = this.areaRect.x + this.areaRect.width - this.playButton.width;
        this.playButton.y = this.areaRect.y - this.playButton.height - 5;
        this.playButton.visible = this.selectedCardIndex >= 0;
    }
    
    // 渲染手牌区域
    render() {
        if (this.handCards.length === 0) return;
        
        // 不再绘制滚动按钮
        
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
        
        // 绘制出牌按钮
        if (this.playButton.visible) {
            this.drawPlayButton();
        }
    }
    
    // 绘制出牌按钮
    drawPlayButton() {
        if (!this.playButton.visible) return;
        
        const btn = this.playButton;
        
        // 按钮背景色
        let bgColor = '#4CAF50';
        if (btn.hovered) {
            bgColor = '#45a049';
        }
        
        // 绘制按钮背景
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
        
        // 绘制按钮边框
        this.ctx.strokeStyle = '#2e7d32';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
        
        // 绘制按钮文字
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('出牌', btn.x + btn.width / 2, btn.y + btn.height / 2);
    }

    // 绘制单张卡牌
    drawCard(card, index) {
        // 查找对应的cardRect
        const rect = this.cardRects.find(r => r.index === index);
        if (!rect || !rect.visible) return;
        
        // 确定卡牌颜色
        let cardColor = '#2196F3'; // 默认蓝色
        if (index === this.selectedCardIndex) {
            cardColor = this.config.selectedColor;
        } else if (index === this.hoveredCardIndex) {
            cardColor = this.config.hoverColor;
        }
        
        // 绘制卡牌背景
        this.ctx.fillStyle = cardColor;
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        
        // 绘制卡牌边框
        this.ctx.strokeStyle = index === this.selectedCardIndex ? '#fff' : '#333';
        this.ctx.lineWidth = index === this.selectedCardIndex ? 3 : 1;
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        
        // 绘制卡牌文字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 绘制单词（主要内容）
        const word = card.word || '未知';
        this.ctx.fillText(word, rect.x + rect.width / 2, rect.y + rect.height / 2 - 5);
        
        // 绘制词性（小字）
        if (card.wordClass) {
            this.ctx.font = '10px Arial';
            this.ctx.fillStyle = '#ccc';
            this.ctx.fillText(card.wordClass, rect.x + rect.width / 2, rect.y + rect.height / 2 + 15);
        }
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
        this.canvas.addEventListener('click', this.boundHandleClick);
        this.canvas.addEventListener('mousemove', this.boundHandleMouseMove);
        this.canvas.addEventListener('wheel', this.boundHandleWheel);
        
        // 鼠标拖拽事件
        this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
        this.canvas.addEventListener('mouseup', this.boundHandleMouseUp);
        document.addEventListener('mouseup', this.boundHandleMouseUp); // 全局监听，防止鼠标移出画布
        
        // 触摸事件
        this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.boundHandleTouchEnd);
    }
    
    // 移除事件监听器
    removeEventListeners() {
        this.canvas.removeEventListener('click', this.boundHandleClick);
        this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
        this.canvas.removeEventListener('wheel', this.boundHandleWheel);
        
        // 鼠标拖拽事件
        this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
        this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp);
        document.removeEventListener('mouseup', this.boundHandleMouseUp);
        
        // 触摸事件
        this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
        this.canvas.removeEventListener('touchmove', this.boundHandleTouchMove);
        this.canvas.removeEventListener('touchend', this.boundHandleTouchEnd);
    }
    
    // 选择卡牌
    selectCard(index) {
        if (index < 0 || index >= this.handCards.length) return;
        
        const previousSelected = this.selectedCardIndex;
        this.selectedCardIndex = index;
        
        // 更新出牌按钮可见性（不重新计算布局）
        this.playButton.visible = true;
        
        console.log(`[HandCardArea] 选择卡牌: ${index} - ${this.handCards[index].word}`);
        
        // 触发卡牌选择事件
        this.onCardSelected && this.onCardSelected(index, this.handCards[index], previousSelected);
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
        this.playButton.visible = false;
        // 不重新计算布局，避免循环调用
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
            
            // 显示提示信息
            if (typeof wx !== 'undefined' && wx.showToast) {
                wx.showToast({
                    title: '现在不是你的回合，请等待',
                    icon: 'none',
                    duration: 2000
                });
            } else {
                alert('现在不是你的回合，请等待其他玩家操作');
            }
            
            return;
        }
        
        // 获取选中的卡牌
        const selectedCard = this.handCards[this.selectedCardIndex];
        if (!selectedCard) {
            console.log('[HandCardArea] 选中的卡牌不存在');
            return;
        }
        
        console.log('[HandCardArea] 出牌:', selectedCard.word);
        
        // 调用出牌回调
        if (this.onCardPlayed) {
            this.onCardPlayed(this.selectedCardIndex, selectedCard);
        }
        
        // 清除选中状态
        this.selectedCardIndex = -1;
        this.render();
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
        // 检查鼠标是否在手牌区域内
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (x >= this.areaRect.x && x <= this.areaRect.x + this.areaRect.width &&
            y >= this.areaRect.y && y <= this.areaRect.y + this.areaRect.height) {
            
            event.preventDefault();
            
            if (event.deltaY > 0) {
                this.scrollRight();
            } else {
                this.scrollLeft();
            }
        }
    }
    
    // 鼠标按下事件处理
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 检查是否在手牌区域内
        if (this.isInHandCardArea(x, y)) {
            this.startDrag(x);
            event.preventDefault();
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
        const rect = this.canvas.getBoundingClientRect();
        const touch = event.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // 检查是否在手牌区域内
        if (this.isInHandCardArea(x, y)) {
            this.startDrag(x);
            event.preventDefault();
        }
    }
    
    // 触摸移动事件处理
    handleTouchMove(event) {
        if (this.dragState.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const touch = event.touches[0];
            const x = touch.clientX - rect.left;
            this.updateDrag(x);
            event.preventDefault();
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
        this.canvas.style.cursor = 'grabbing';
    }
    
    // 更新拖拽状态
    updateDrag(x) {
        if (!this.dragState.isDragging) return;
        
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
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 如果正在拖拽，更新拖拽状态
        if (this.dragState.isDragging) {
            this.updateDrag(x);
            return;
        }
        
        // 原有的鼠标悬停逻辑
        // 检查是否悬停在出牌按钮上
        this.playButton.hovered = this.playButton.visible &&
            x >= this.playButton.x && x <= this.playButton.x + this.playButton.width &&
            y >= this.playButton.y && y <= this.playButton.y + this.playButton.height;
        
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
                this.canvas.style.cursor = 'grab'; // 在手牌区域显示可拖拽光标
            } else {
                this.canvas.style.cursor = (newHoveredIndex >= 0 || 
                    this.playButton.hovered) ? 'pointer' : 'default';
            }
        }
    }
    
    // 重写点击处理，防止拖拽时误触发点击
    handleClick(event) {
        // 如果刚刚结束拖拽，忽略点击事件
        if (Math.abs(event.clientX - this.dragState.startX) > this.dragState.dragThreshold) {
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 检查是否点击了出牌按钮
        if (this.playButton.visible && 
            x >= this.playButton.x && x <= this.playButton.x + this.playButton.width &&
            y >= this.playButton.y && y <= this.playButton.y + this.playButton.height) {
            this.onPlayCard();
            return;
        }
        
        // 检查是否点击了某张卡牌
        for (let i = 0; i < this.cardRects.length; i++) {
            const cardRect = this.cardRects[i];
            if (cardRect.visible && 
                x >= cardRect.x && x <= cardRect.x + cardRect.width &&
                y >= cardRect.y && y <= cardRect.y + cardRect.height) {
                
                this.selectCard(cardRect.index);
                break;
            }
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