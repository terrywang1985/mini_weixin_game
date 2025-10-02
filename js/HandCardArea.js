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
            cardWidth: 60,
            cardHeight: 80,
            cardSpacing: 5,
            bottomMargin: 20,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderColor: '#333',
            textColor: '#fff',
            selectedColor: '#4CAF50',
            hoverColor: '#666'
        };
        
        // 手牌数据
        this.handCards = [];
        this.selectedCardIndex = -1;
        this.hoveredCardIndex = -1;
        
        // 布局信息
        this.areaRect = { x: 0, y: 0, width: 0, height: 0 };
        this.cardRects = [];
        
        // 绑定事件
        this.boundHandleClick = this.handleClick.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        
        this.setupEventListeners();
        this.calculateLayout();
    }
    
    // 设置手牌数据
    setHandCards(cards) {
        this.handCards = cards || [];
        this.selectedCardIndex = -1;
        this.calculateLayout();
        console.log(`[HandCardArea] 设置手牌: ${this.handCards.length} 张`);
    }
    
    // 计算布局
    calculateLayout() {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 计算手牌区域大小
        const totalWidth = Math.min(
            this.handCards.length * (this.config.cardWidth + this.config.cardSpacing) - this.config.cardSpacing,
            canvasWidth - 40
        );
        const areaHeight = this.config.cardHeight + 40;
        
        // 计算手牌区域位置（底部居中）
        this.areaRect = {
            x: (canvasWidth - totalWidth) / 2 - 20,
            y: canvasHeight - areaHeight - this.config.bottomMargin,
            width: totalWidth + 40,
            height: areaHeight
        };
        
        // 计算每张卡牌的位置
        this.cardRects = [];
        const startX = this.areaRect.x + 20;
        const cardY = this.areaRect.y + 20;
        
        for (let i = 0; i < this.handCards.length; i++) {
            const cardX = startX + i * (this.config.cardWidth + this.config.cardSpacing);
            this.cardRects.push({
                x: cardX,
                y: cardY,
                width: this.config.cardWidth,
                height: this.config.cardHeight,
                index: i
            });
        }
    }
    
    // 渲染手牌区域
    render() {
        if (this.handCards.length === 0) return;
        
        // 绘制手牌区域背景
        this.ctx.fillStyle = this.config.backgroundColor;
        this.ctx.fillRect(this.areaRect.x, this.areaRect.y, this.areaRect.width, this.areaRect.height);
        
        // 绘制边框
        this.ctx.strokeStyle = this.config.borderColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.areaRect.x, this.areaRect.y, this.areaRect.width, this.areaRect.height);
        
        // 绘制标题
        this.ctx.fillStyle = this.config.textColor;
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`手牌 (${this.handCards.length})`, this.areaRect.x + 10, this.areaRect.y + 5);
        
        // 绘制每张卡牌
        this.handCards.forEach((card, index) => {
            this.drawCard(card, index);
        });
    }
    
    // 绘制单张卡牌
    drawCard(card, index) {
        const rect = this.cardRects[index];
        if (!rect) return;
        
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
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        
        // 绘制卡牌文字
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 绘制卡牌词语（自动换行）
        const words = this.wrapText(card.word || '未知', rect.width - 10);
        const lineHeight = 14;
        const startY = rect.y + rect.height / 2 - (words.length - 1) * lineHeight / 2;
        
        words.forEach((line, lineIndex) => {
            this.ctx.fillText(
                line, 
                rect.x + rect.width / 2, 
                startY + lineIndex * lineHeight
            );
        });
        
        // 绘制词性（如果有）
        if (card.wordClass) {
            this.ctx.font = '10px Arial';
            this.ctx.fillStyle = '#ccc';
            this.ctx.fillText(
                card.wordClass,
                rect.x + rect.width / 2,
                rect.y + rect.height - 8
            );
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
    }
    
    // 移除事件监听器
    removeEventListeners() {
        this.canvas.removeEventListener('click', this.boundHandleClick);
        this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
    }
    
    // 处理点击事件
    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 检查是否点击了某张卡牌
        for (let i = 0; i < this.cardRects.length; i++) {
            const cardRect = this.cardRects[i];
            if (x >= cardRect.x && x <= cardRect.x + cardRect.width &&
                y >= cardRect.y && y <= cardRect.y + cardRect.height) {
                
                this.selectCard(i);
                break;
            }
        }
    }
    
    // 处理鼠标移动事件
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // 检查是否悬停在某张卡牌上
        let newHoveredIndex = -1;
        for (let i = 0; i < this.cardRects.length; i++) {
            const cardRect = this.cardRects[i];
            if (x >= cardRect.x && x <= cardRect.x + cardRect.width &&
                y >= cardRect.y && y <= cardRect.y + cardRect.height) {
                newHoveredIndex = i;
                break;
            }
        }
        
        if (newHoveredIndex !== this.hoveredCardIndex) {
            this.hoveredCardIndex = newHoveredIndex;
            // 更新鼠标指针样式
            this.canvas.style.cursor = newHoveredIndex >= 0 ? 'pointer' : 'default';
        }
    }
    
    // 选择卡牌
    selectCard(index) {
        if (index < 0 || index >= this.handCards.length) return;
        
        const previousSelected = this.selectedCardIndex;
        this.selectedCardIndex = index;
        
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