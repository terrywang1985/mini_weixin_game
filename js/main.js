import NetworkManager from './NetworkManager.js';
import GameStateManager from './GameStateManager.js';
import MainMenu from './MainMenu.js';
import RoomList from './RoomList.js';
import RoomManager from './RoomManager.js';

/**
 * 微信小游戏主函数 - 重构版本
 * 实现自动游客登录、房间管理功能
 */
export default class Main {
  constructor() {
    console.log("=== 微信小游戏启动 ===");
    
    // 在微信小游戏环境中获取canvas
    this.canvas = this.getCanvas();
    this.ctx = this.canvas.getContext('2d');
    
    // 设置canvas尺寸
    this.setupCanvas();
    
    // 初始化网络管理器
    this.networkManager = new NetworkManager();
    
    // 初始化UI页面
    this.mainMenu = new MainMenu(this.canvas, this.networkManager);
    this.roomList = new RoomList(this.canvas, this.networkManager);
    this.roomManager = new RoomManager(this.canvas, this.networkManager);
    
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
      const canvasElement = document.createElement('canvas');
      document.body.appendChild(canvasElement);
      return canvasElement;
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
      // 其他环境，设置默认尺寸
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
      }
    } catch (error) {
      console.error("自动登录过程中发生错误:", error);
      this.loadingMessage = "连接失败: " + error.message;
      this.isLoading = false;
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
    });
    
    // WebSocket连接事件
    this.networkManager.on('connected', () => {
      console.log("WebSocket连接成功");
      this.loadingMessage = "正在认证...";
    });
    
    this.networkManager.on('disconnected', () => {
      console.log("WebSocket连接断开");
      this.showReconnectDialog();
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
    });
    
    this.networkManager.on('room_joined', () => {
      console.log("加入房间成功");
    });
    
    this.networkManager.on('room_list_received', (rooms) => {
      console.log("收到房间列表:", rooms);
    });
  }
  
  onGameStateChange(oldState, newState) {
    console.log(`游戏状态变化: ${oldState} -> ${newState}`);
    
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
        this.isLoading = false;
        // RoomManager 会自动显示 WaitingRoom
        break;
      case GameStateManager.GAME_STATES.IN_GAME:
        // 游戏开始后继续显示游戏房间页面（显示游戏界面）
        this.isLoading = false;
        // RoomManager 会自动显示 GameRoom
        break;
      case GameStateManager.GAME_STATES.LOADING:
        this.currentPage = null;
        this.isLoading = true;
        break;
      default:
        console.warn('状态切换到未知或未处理状态, 将显示错误屏:', newState);
        this.currentPage = null;
        break;
    }
  }
  
  bindEvents() {
    // 处理画布尺寸变化
    this.updateCanvasSize();
    
    // 监听窗口尺寸变化（如果需要）
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.updateCanvasSize();
      });
    }
    
    // 处理错误
    window.addEventListener('error', (event) => {
      console.error("全局错误:", event.error);
    });
    
    // 处理未捕获的Promise错误
    window.addEventListener('unhandledrejection', (event) => {
      console.error("未处理的Promise错误:", event.reason);
    });
  }
  
  updateCanvasSize() {
    let screenWidth = 375;
    let screenHeight = 667;
    
    if (typeof wx !== 'undefined') {
      // 微信小游戏环境
      try {
        const systemInfo = wx.getSystemInfoSync();
        screenWidth = systemInfo.windowWidth || 375;
        screenHeight = systemInfo.windowHeight || 667;
      } catch (error) {
        console.error("获取微信系统信息失败:", error);
      }
    } else if (typeof window !== 'undefined') {
      // 浏览器环境
      screenWidth = window.innerWidth || 375;
      screenHeight = window.innerHeight || 667;
    }
    
    // 设置canvas尺寸
    this.canvas.width = screenWidth;
    this.canvas.height = screenHeight;
    
    // 验证设置结果
    if (this.canvas.width <= 1 || this.canvas.height <= 1) {
      this.canvas.width = 375;
      this.canvas.height = 667;
    }
    
    // 更新所有页面的画布尺寸
    if (this.mainMenu) this.mainMenu.updateCanvasSize();
    if (this.roomList) this.roomList.updateCanvasSize();
    if (this.roomManager) this.roomManager.updateCanvasSize();
  }
  
  startGameLoop() {
    const gameLoop = () => {
      this.update();
      this.render();
      requestAnimationFrame(gameLoop);
    };
    
    requestAnimationFrame(gameLoop);
    console.log("游戏循环已启动");
  }
  
  update() {
    // 这里可以添加全局更新逻辑
    // 例如：网络状态检查、心跳包等
  }
  
  render() {
    if (this.isLoading) {
      this.renderLoadingScreen();
      return;
    }

    if (!this.currentPage) {
      // 容错：如果已经在某个状态，却没有设置 currentPage，尝试恢复
      if (GameStateManager.currentState === GameStateManager.GAME_STATES.IN_GAME) {
        console.warn('[Recover] IN_GAME 状态下 currentPage 丢失，RoomManager 会自动处理');
      } else if (GameStateManager.currentState === GameStateManager.GAME_STATES.IN_ROOM) {
        console.warn('[Recover] IN_ROOM 状态下 currentPage 丢失，RoomManager 会自动处理');
      } else if (GameStateManager.currentState === GameStateManager.GAME_STATES.MAIN_MENU) {
        console.warn('[Recover] MAIN_MENU 状态下 currentPage 丢失，尝试自动恢复 mainMenu');
        this.currentPage = this.mainMenu;
        this.mainMenu.show();
      } else if (GameStateManager.currentState === GameStateManager.GAME_STATES.ROOM_LIST) {
        console.warn('[Recover] ROOM_LIST 状态下 currentPage 丢失，尝试自动恢复 roomList');
        this.currentPage = this.roomList;
        this.roomList.show();
      }
    }

    if (this.currentPage) {
      this.currentPage.render();
    } else {
      // 防止错误日志刷屏：最多5秒输出一次
      const now = Date.now();
      if (now - this.lastErrorLogTime > this.errorLogInterval) {
        console.warn('进入错误屏: currentPage仍为空, isLoading=', this.isLoading, ' state=', GameStateManager.currentState);
        this.lastErrorLogTime = now;
      }
      this.renderErrorScreen();
    }
  }
  
  renderLoadingScreen() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 绘制加载背景
    this.ctx.fillStyle = '#2c3e50';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制加载标题
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 28px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('连词成句', centerX, centerY - 60);
    
    // 绘制加载消息
    this.ctx.font = '16px Arial';
    this.ctx.fillStyle = '#bdc3c7';
    this.ctx.fillText(this.loadingMessage, centerX, centerY);
    
    // 绘制简单的加载动画
    const time = Date.now() / 1000;
    const dots = Math.floor(time * 2) % 4;
    const dotString = '.'.repeat(dots);
    this.ctx.fillText(dotString, centerX, centerY + 30);
    
    // 绘制版本信息
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#7f8c8d';
    this.ctx.fillText('版本 1.0.0', centerX, this.canvas.height - 30);
  }
  
  renderErrorScreen() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // 绘制错误背景
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 绘制错误信息
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('连接失败', centerX, centerY - 30);
    
    this.ctx.font = '16px Arial';
    this.ctx.fillText('请检查网络连接', centerX, centerY + 10);
    
    // 重试按钮
    const buttonWidth = 120;
    const buttonHeight = 40;
    const buttonX = centerX - buttonWidth / 2;
    const buttonY = centerY + 50;
    
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    this.ctx.fillStyle = '#e74c3c';
    this.ctx.font = '16px Arial';
    this.ctx.fillText('重试', centerX, buttonY + buttonHeight / 2);
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
    } else {
      const reconnect = confirm('与服务器的连接已断开，是否重新连接？');
      if (reconnect) {
        this.reconnect();
      }
    }
  }
  
  async reconnect() {
    console.log("尝试重新连接...");
    this.isLoading = true;
    this.loadingMessage = "正在重新连接...";
    GameStateManager.setGameState(GameStateManager.GAME_STATES.LOADING);
    
    try {
      await this.startAutoLogin();
    } catch (error) {
      console.error("重连失败:", error);
      this.loadingMessage = "重连失败: " + error.message;
      this.isLoading = false;
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
}