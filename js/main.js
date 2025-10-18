import NetworkManager from './NetworkManager.js';
import GameStateManager from './GameStateManager.js';
import MainMenu from './MainMenu.js';
import RoomList from './RoomList.js';
import RoomManager from './RoomManager.js';
import MatchWaitingUI from './MatchWaitingUI.js';

/**
 * 微信小游戏主函数 - 重构版本
 * 实现自动游客登录、房间管理功能
 */
export default class Main {
  constructor() {
    console.log("=== 微信小游戏启动 ===");
    // 屏幕调试日志开关（true=显示，false=关闭）
    this.enableDebugLogOnScreen = false;

    // 微信真机调试时自动开启详细 JS 日志（建议真机排查问题时开启）
    if (typeof wx !== 'undefined' && wx.setEnableDebug) {
      wx.setEnableDebug({ enableDebug: false});
      // 注：如需关闭可改为 false
    }

    // 在微信小游戏环境中获取canvas
    this.canvas = this.getCanvas();
    this.ctx = this.canvas.getContext('2d');

    // 设置canvas尺寸
    this.setupCanvas();

    // 初始化网络管理器
    this.networkManager = new NetworkManager();

    // 绑定调试日志画布（如开启）
    if (this.enableDebugLogOnScreen) {
      this.networkManager.bindDebugCanvas(this.canvas);
    }

    // 初始化UI页面
    this.mainMenu = new MainMenu(this.canvas, this.networkManager);
    this.roomList = new RoomList(this.canvas, this.networkManager);
    this.roomManager = new RoomManager(this.canvas, this.networkManager);
    this.matchWaitingUI = new MatchWaitingUI(this.canvas, this.networkManager);

    // 当前活动页面
    this.currentPage = null;

    // 加载状态
    this.isLoading = true;
    this.loadingMessage = "正在连接服务器...";

    // 防止错误日志刷屏的防抖机制
    this.lastErrorLogTime = 0;
    this.errorLogInterval = 5000; // 5秒内最多输出一次错误日志

    this.init();
    this.bindEvents();
    this.startGameLoop();
  }
  
  async init() {
    console.log("初始化游戏...");
    
    // 设置初始加载状态
    GameStateManager.setGameState(GameStateManager.GAME_STATES.LOADING);
    
    // 监听游戏状态变化
    GameStateManager.onStateChange((oldState, newState) => {
      this.onGameStateChange(oldState, newState);
    });
    
    // 监听网络事件
    this.setupNetworkEvents();
    
    // 开始自动游客登录流程
    await this.startAutoLogin();
  }
  
  // 获取微信小游戏canvas
  getCanvas() {
    if (typeof wx !== 'undefined') {
      // 微信小游戏环境
      console.log("微信小游戏环境，获取canvas");
      
      // 尝试使用全局canvas对象（推荐方式）
      if (typeof canvas !== 'undefined') {
        console.log("使用全局canvas对象");
        return canvas;
      }
      
      // 如果没有全局canvas，尝试创建
      if (wx.createCanvas) {
        console.log("使用wx.createCanvas创建canvas");
        return wx.createCanvas();
      }
      
      // 最后的fallback
      console.error("无法获取canvas对象");
      return null;
    } else if (typeof canvas !== 'undefined') {
      // 调试环境可能有全局canvas
      console.log("使用全局canvas对象（调试环境）");
      return canvas;
    } else {
      // 浏览器环境，创建canvas元素
      console.log("浏览器环境，创建canvas元素");
      // 在微信小游戏中不支持document API，这里仅用于测试
      if (typeof document !== 'undefined') {
        const canvasElement = document.createElement('canvas');
        document.body.appendChild(canvasElement);
        return canvasElement;
      }
      return null;
    }
  }
  
  // 设置canvas尺寸和样式
  setupCanvas() {
    if (!this.canvas) {
      console.error("Canvas对象为空，无法设置尺寸");
      return;
    }
    
    if (typeof wx !== 'undefined') {
      // 微信小游戏环境，获取系统信息
      try {
        const systemInfo = wx.getSystemInfoSync();
        this.canvas.width = systemInfo.windowWidth || 375;
        this.canvas.height = systemInfo.windowHeight || 667;
      } catch (error) {
        console.error("获取系统信息失败:", error);
        this.canvas.width = 375;
        this.canvas.height = 667;
      }
    } else {
      // 浏览器环境，设置默认尺寸
      this.canvas.width = 375;
      this.canvas.height = 667;
    }
    
    // 如果尺寸还是不对，强制设置
    if (this.canvas.width <= 1 || this.canvas.height <= 1) {
      this.canvas.width = 375;
      this.canvas.height = 667;
    }
    
    // 设置画布样式
    if (this.ctx) {
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  
  async startAutoLogin() {
    try {
      console.log("开始自动游客登录...");
      this.loadingMessage = "正在登录...";
      
      // 测试网络环境
      this.testNetworkEnvironment();
      
      // 执行游客登录，传入窗口实例标识
      const windowInstance = Math.floor(Date.now() / 1000) % 10000; // 基于秒级时间戳的窗口标识
      const loginSuccess = await this.networkManager.guestLogin(windowInstance.toString());
      
      if (loginSuccess) {
        console.log("自动登录成功");
        this.loadingMessage = "登录成功！";
      } else {
        console.error("自动登录失败");
        this.loadingMessage = "登录失败，请重试";
        this.isLoading = false;
        // 显示重连按钮(Canvas绘制)
        this.needsRetryButtonHandling = true;
      }
    } catch (error) {
      console.error("自动登录过程中发生错误:", error);
      this.loadingMessage = "连接失败: " + error.message;
      this.isLoading = false;
      // 显示重连按钮(Canvas绘制)
      this.needsRetryButtonHandling = true;
    }
  }
  
  // 测试网络环境
  testNetworkEnvironment() {
    console.log("=== 网络环境检测 ===");
    
    if (typeof wx !== 'undefined') {
      console.log("✅ 微信小游戏环境");
      console.log("HTTP API:", wx.request ? "可用" : "不可用");
      console.log("WebSocket API:", wx.connectSocket ? "可用" : "不可用");
      
      try {
        const systemInfo = wx.getSystemInfoSync();
        console.log("系统信息:", systemInfo.platform, systemInfo.version);
      } catch (e) {
        console.log("获取系统信息失败:", e);
      }
    } else {
      console.log("🌐 浏览器环境");
      console.log("Fetch API:", typeof fetch !== 'undefined' ? "可用" : "不可用");
      console.log("WebSocket API:", typeof WebSocket !== 'undefined' ? "可用" : "不可用");
    }
  }
  
  setupNetworkEvents() {
    // HTTP登录事件
    this.networkManager.on('http_login_success', () => {
      console.log("HTTP登录成功");
      this.loadingMessage = "正在连接服务器...";
    });
    
    this.networkManager.on('http_login_failed', (error) => {
      console.error("HTTP登录失败:", error);
      this.loadingMessage = "登录失败: " + error;
      this.isLoading = false;
      // 显示重连按钮(Canvas绘制)
      this.needsRetryButtonHandling = true;
    });
    
    // WebSocket连接事件
    this.networkManager.on('connected', () => {
      console.log("WebSocket连接成功");
      this.loadingMessage = "正在认证...";
    });
    
    this.networkManager.on('disconnected', () => {
      console.log("WebSocket连接断开");
      this.loadingMessage = "连接已断开";
      this.isLoading = false;
      this.needsRetryButtonHandling = true;
    });
    
    // 认证事件
    this.networkManager.on('auth_success', (userInfo) => {
      console.log("认证成功:", userInfo);
      this.isLoading = false;
      this.loadingMessage = "";
      
      // 确保状态正确切换到主菜单
      const currentState = GameStateManager.getCurrentState();
      if (currentState === GameStateManager.GAME_STATES.MAIN_MENU) {
        this.onGameStateChange('loading', GameStateManager.GAME_STATES.MAIN_MENU);
      }
    });
    
    this.networkManager.on('auth_failed', (error) => {
      console.error("认证失败:", error);
      this.loadingMessage = "认证失败: " + error;
      this.isLoading = false;
    });
    
    // 房间相关事件
    this.networkManager.on('room_created', (room) => {
      console.log("房间创建成功:", room);
      
      // 不再显示房间创建成功的对话框，直接进入房间
      console.log("房间已创建，ID:", room.id);
      
      // 更新游戏状态到房间等待状态
      GameStateManager.setGameState(GameStateManager.GAME_STATES.IN_ROOM);
    });
    
    this.networkManager.on('room_joined', () => {
      console.log("加入房间成功");
      // 更新游戏状态到房间等待状态
      GameStateManager.setGameState(GameStateManager.GAME_STATES.IN_ROOM);
    });
    
    this.networkManager.on('room_list_received', (rooms) => {
      console.log("收到房间列表:", rooms);
    });
  }
  
  onGameStateChange(oldState, newState) {
    console.log(`状态切换: ${oldState} -> ${newState}`);
    
    // 隐藏所有页面
    this.mainMenu.hide();
    this.roomList.hide();
    // RoomManager会根据状态自动管理显示/隐藏
    
    // 显示对应的页面
    switch (newState) {
      case GameStateManager.GAME_STATES.MAIN_MENU:
        this.isLoading = false;
        this.currentPage = this.mainMenu;
        this.mainMenu.show();
        break;
      case GameStateManager.GAME_STATES.LOGIN:
        // 登录阶段暂时使用加载界面或主菜单的过渡，这里保持加载态但不进入错误屏
        this.isLoading = true;
        this.currentPage = null;
        this.loadingMessage = '正在登录...';
        break;
      case GameStateManager.GAME_STATES.ROOM_LIST:
        this.isLoading = false;
        this.currentPage = this.roomList;
        this.roomList.show();
        break;
      case GameStateManager.GAME_STATES.IN_ROOM:
        console.log("切换到房间内，RoomManager接管渲染");
        this.isLoading = false;
        this.currentPage = null;  // 让RoomManager接管
        // RoomManager 会自动显示 WaitingRoom
        break;
      case GameStateManager.GAME_STATES.IN_GAME:
        // 游戏开始后继续显示游戏房间页面（显示游戏界面）
        this.isLoading = false;
        this.currentPage = null;  // 让RoomManager接管
        // RoomManager 会自动显示 GameRoom
        break;
      case GameStateManager.GAME_STATES.LOADING:
        this.currentPage = null;
        this.isLoading = true;
        break;
      default:
        console.warn('状态切换到未知状态:', newState);
        this.currentPage = null;
        break;
    }
  }
  
  bindEvents() {
    // 处理画布尺寸变化
    this.updateCanvasSize();
    
    // 微信小游戏环境中使用wx.onWindowResize
    if (typeof wx !== 'undefined' && wx.onWindowResize) {
      wx.onWindowResize(() => {
        this.updateCanvasSize();
      });
    }
    
    // 处理错误 - 微信小游戏环境中使用wx.onError
    if (typeof wx !== 'undefined' && wx.onError) {
      wx.onError((error) => {
        console.error("全局错误:", error);
      });
    }
    
    // 处理未捕获的Promise错误 - 微信小游戏环境中使用wx.onUnhandledRejection
    if (typeof wx !== 'undefined' && wx.onUnhandledRejection) {
      wx.onUnhandledRejection((event) => {
        console.error("未处理的Promise错误:", event.reason);
      });
    }
    
    // 添加canvas点击事件处理 - 适配微信小游戏环境
    this.setupCanvasClickHandler();
  }
  
  // 更新画布尺寸 - 适配微信小游戏环境
  updateCanvasSize() {
    // 重新设置canvas尺寸
    this.setupCanvas();
    
    // 通知所有页面更新尺寸
    if (this.mainMenu) {
      this.mainMenu.updateCanvasSize();
    }
    if (this.roomList) {
      this.roomList.updateCanvasSize();
    }
    if (this.roomManager) {
      this.roomManager.updateCanvasSize();
    }
    
    // 重新渲染当前页面
    if (this.currentPage && typeof this.currentPage.render === 'function') {
      this.currentPage.render();
    }
  }
  
  // 设置canvas点击事件处理 - 适配微信小游戏环境
  setupCanvasClickHandler() {
    if (typeof wx !== 'undefined') {
      // 微信小游戏环境使用wx.onTouchStart处理点击
      wx.onTouchStart((res) => {
        if (res.touches && res.touches.length > 0) {
          const touch = res.touches[0];
          const x = touch.clientX;
          const y = touch.clientY;
          
          // 优先级1: 匹配等待UI（最高优先级，拦截所有点击）
          if (this.matchWaitingUI && this.matchWaitingUI.isVisible) {
            const handled = this.matchWaitingUI.handleClick(x, y);
            if (handled) {
              return; // 事件已被处理，不再传播
            }
          }
          
          // 优先级2: 重试按钮处理
          if (this.needsRetryButtonHandling) {
            this.handleRetryButtonClick(x, y);
            this.needsRetryButtonHandling = false;
            return;
          }
          
          // 优先级3: 当前页面的点击处理
          if (this.currentPage && typeof this.currentPage.handleClick === 'function') {
            this.currentPage.handleClick({ clientX: x, clientY: y });
          }
        }
      });
    }
  }
  
  // 重写setupRetryButton方法，适配微信小游戏环境
  setupRetryButton(x, y, width, height) {
    // 在微信小游戏中，我们使用wx API处理点击事件
    
    // 保存按钮坐标信息，供点击处理中使用
    this.retryButtonArea = { x, y, width, height };
    
    // 设置一个标志，表示需要处理重试按钮点击
    this.needsRetryButtonHandling = true;
  }
  
  // 处理重试按钮点击事件
  handleRetryButtonClick(mouseX, mouseY) {
    if (this.retryButtonArea) {
      const { x, y, width, height } = this.retryButtonArea;
      // 检查点击是否在按钮区域内
      if (mouseX >= x && mouseX <= x + width && mouseY >= y && mouseY <= y + height) {
        // 点击了重试按钮，执行重连逻辑
        this.reconnect();
        return true; // 表示已处理点击事件
      }
    }
    return false; // 表示未处理点击事件
  }
  
  showReconnectDialog() {
    // 显示重连对话框
    if (typeof wx !== 'undefined' && wx.showModal) {
      wx.showModal({
        title: '连接断开',
        content: '与服务器的连接已断开，是否重新连接？',
        success: (res) => {
          if (res.confirm) {
            this.reconnect();
          }
        }
      });
    } else if (typeof confirm !== 'undefined') {
      // 浏览器环境
      const reconnect = confirm('与服务器的连接已断开，是否重新连接？');
      if (reconnect) {
        this.reconnect();
      }
    } else {
      // 其他环境，直接重连
      console.log("连接断开，尝试重新连接...");
      this.reconnect();
    }
  }
  
  async reconnect() {
    console.log("尝试重新连接...");
    this.isLoading = true;
    this.needsRetryButtonHandling = false; // 清除重连按钮状态
    this.retryButtonArea = null; // 清除按钮区域
    this.loadingMessage = "正在重新连接...";
    GameStateManager.setGameState(GameStateManager.GAME_STATES.LOADING);
    
    // 移除之前的重试按钮事件监听器
    if (this.retryButtonHandler) {
      // 在微信小游戏中不支持removeEventListener，事件监听器会在页面销毁时自动移除
      if (typeof wx !== 'undefined') {
        console.log("微信小游戏环境中事件监听器将在页面销毁时自动移除");
      }
      this.retryButtonHandler = null;
    }
    
    try {
      await this.startAutoLogin();
    } catch (error) {
      console.error("重连失败:", error);
      this.loadingMessage = "重连失败: " + error.message;
      this.isLoading = false;
      this.needsRetryButtonHandling = true; // 重连失败,再次显示按钮
    }
  }
  
  // 获取调试信息
  getDebugInfo() {
    return {
      gameState: GameStateManager.getCurrentState(),
      networkConnected: GameStateManager.isConnected(),
      authenticated: GameStateManager.isAuthenticated(),
      currentRoom: GameStateManager.getCurrentRoom(),
      userInfo: GameStateManager.getUserInfo()
    };
  }
  
  // 打印调试信息（开发用）
  printDebugInfo() {
    console.log("=== 游戏调试信息 ===");
    console.log(this.getDebugInfo());
    GameStateManager.printDebugInfo();
    console.log("==================");
  }
  
  // 开始游戏循环
  startGameLoop() {
    const gameLoop = () => {
      this.render();
      requestAnimationFrame(gameLoop);
    };
    
    // 优先使用requestAnimationFrame，如果不可用再用setTimeout
    if (typeof requestAnimationFrame !== 'undefined') {
      // 浏览器环境或支持requestAnimationFrame的环境
      gameLoop();
      console.log("游戏循环已启动");
    } else {
      // 不支持requestAnimationFrame的环境，使用setTimeout
      const loop = () => {
        this.render();
        setTimeout(loop, 1000 / 60); // 约60FPS
      };
      loop();
      console.log("游戏循环已启动 (setTimeout)");
    }
  }
  
  // 渲染游戏画面
  render() {
    if (!this.canvas || !this.ctx) return;

    // 清空画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制加载画面或当前页面
    if (this.isLoading) {
      this.drawLoadingScreen();
    } else if (this.needsRetryButtonHandling) {
      // 如果需要显示重连按钮(连接失败状态)
      this.drawLoadingScreen();
    } else if (this.currentPage && typeof this.currentPage.render === 'function') {
      this.currentPage.render();
    } else {
      // ...existing code...
      const currentState = GameStateManager.getCurrentState();
      if (currentState === GameStateManager.GAME_STATES.IN_ROOM || 
          currentState === GameStateManager.GAME_STATES.IN_GAME) {
        if (this.roomManager && this.roomManager.currentRoom && 
            typeof this.roomManager.currentRoom.render === 'function') {
          this.roomManager.currentRoom.render();
        } else {
          this.ctx.fillStyle = '#2c3e50';
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = '20px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('正在进入房间...', this.canvas.width / 2, this.canvas.height / 2);
        }
      } else {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
    
    // 渲染匹配等待 UI（覆盖在其他内容之上）
    if (this.matchWaitingUI && this.matchWaitingUI.isVisible) {
      this.matchWaitingUI.render();
    }

    // 屏幕调试日志渲染（如开启）
    if (this.enableDebugLogOnScreen) {
      this.networkManager.drawDebugLog();
    }
  }
  
  // 绘制加载画面
  drawLoadingScreen() {
    if (!this.ctx) return;
    
    // 绘制背景
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制加载文字
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    this.ctx.fillText(this.loadingMessage, centerX, centerY);
    
    // 如果加载失败,显示重连按钮
    if (!this.isLoading && (this.loadingMessage.includes('失败') || this.loadingMessage.includes('错误') || this.loadingMessage.includes('断开'))) {
      this.drawReconnectButton();
    }
  }
  
  // 绘制重连按钮
  drawReconnectButton() {
    if (!this.ctx) return;
    
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = centerX - buttonWidth / 2;
    const buttonY = centerY + 50;
    
    // 保存按钮区域供点击检测使用
    this.retryButtonArea = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
    this.needsRetryButtonHandling = true;
    
    // 绘制按钮背景
    this.ctx.fillStyle = '#3498db';
    this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // 绘制按钮边框
    this.ctx.strokeStyle = '#2980b9';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    // 绘制按钮文字
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '18px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('重新连接', centerX, buttonY + buttonHeight / 2);
  }
}
