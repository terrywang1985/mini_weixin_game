/**
 * 错误消息处理工具 - 提供统一的错误消息映射和处理
 */

class ErrorMessageHandler {
    // 错误码到用户友好消息的映射
    static errorMessages = {
        // 通用错误码
        0: "成功",
        1: "无效参数",
        2: "服务器错误",
        3: "认证失败",
        4: "未找到",
        5: "已存在",
        6: "不允许的操作",
        7: "不支持的操作",
        8: "超时",
        9: "无效状态",
        10: "无效动作",
        11: "无效卡牌",
        12: "无效房间",
        13: "无效用户",
        14: "玩家已在房间中",
        15: "不是你的回合",
        16: "卡牌放置顺序不符合语法规则"
    };
    
    /**
     * 获取用户友好的错误消息
     * @param {number} errorCode - 错误码
     * @param {string} defaultMessage - 默认消息（可选）
     * @returns {string} 用户友好的错误消息
     */
    static getUserFriendlyMessage(errorCode, defaultMessage = "") {
        return this.errorMessages[errorCode] || defaultMessage || "未知错误";
    }
    
    /**
     * 显示错误消息
     * @param {string} message - 要显示的消息
     * @param {object} options - 显示选项
     */
    static showMessage(message, options = {}) {
        const {
            duration = 2000,
            icon = 'none'
        } = options;
        
        if (typeof wx !== 'undefined' && wx.showToast) {
            // 微信小游戏环境
            wx.showToast({
                title: message,
                icon: icon,
                duration: duration
            });
        } else if (typeof alert !== 'undefined') {
            // 浏览器环境
            alert(message);
        } else {
            // 其他环境，输出到控制台
            console.log("消息提示:", message);
        }
    }
    
    /**
     * 处理房间相关的错误
     * @param {number} errorCode - 错误码
     * @returns {string} 用户友好的错误消息
     */
    static handleRoomError(errorCode) {
        let userFriendlyMessage = "";
        
        switch (errorCode) {
            case 12:
                userFriendlyMessage = "房间不存在或已解散";
                break;
            case 14:
                userFriendlyMessage = "您已在其他房间中";
                break;
            case 13:
                userFriendlyMessage = "用户信息无效";
                break;
            default:
                userFriendlyMessage = this.getUserFriendlyMessage(errorCode, "加入房间失败");
        }
        
        return userFriendlyMessage;
    }
    
    /**
     * 处理游戏动作相关的错误
     * @param {number} errorCode - 错误码
     * @returns {string} 用户友好的错误消息
     */
    static handleGameActionError(errorCode) {
        // 游戏动作错误可以直接使用通用错误消息映射
        return this.getUserFriendlyMessage(errorCode, "操作失败");
    }
}

export default ErrorMessageHandler;