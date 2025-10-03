package main

import (
	"context"
	"log/slog"
	"math/rand"
	pb "proto"
	"sync"
	"time"
)

type BattleRoom struct {
	BattleID     string
	Server       *BattleServer
	Game         Game
	GameType     GameType
	ReadyPlayers map[uint64]bool
	CmdChan      chan Command
	CmdChanWithResult chan CommandWithResult
	Players      map[uint64]*PlayerInfo
	PlayersMutex sync.RWMutex
}

type PlayerInfo struct {
	PlayerID uint64
	Name     string
	// 添加位置信息用于记录玩家在房间中的当前位置
	PositionX int32
	PositionY int32
	// 标记是否已经发送过第一次位置更新
	HasSentInitialPosition bool
}

type Command struct {
	PlayerID uint64
	Action   *pb.GameAction
}

// CommandWithResult 带有结果通道的命令结构体
type CommandWithResult struct {
	Command
	ResultChan chan pb.ErrorCode
}

func NewBattleRoom(battleID string, server *BattleServer, gameType GameType) *BattleRoom {
	rand.Seed(time.Now().UnixNano())

	room := &BattleRoom{
		BattleID:     battleID,
		Server:       server,
		GameType:     gameType,
		ReadyPlayers: make(map[uint64]bool),
		CmdChan:      make(chan Command, 100),
		CmdChanWithResult: make(chan CommandWithResult, 100),
		Players:      make(map[uint64]*PlayerInfo),
	}

	// 创建游戏实例
	room.Game = GameFactory(gameType)
	
	// 设置房间引用（适用于所有游戏类型）
	room.Game.SetRoomRef(room)
	
	return room
}


func (room *BattleRoom) AddPlayer(playerID uint64, name string) {
	room.PlayersMutex.Lock()
	defer room.PlayersMutex.Unlock()

	room.Players[playerID] = &PlayerInfo{
		PlayerID: playerID,
		Name:     name,
		// 设置初始位置为默认值
		PositionX: 0,
		PositionY: 0,
		// 初始状态为未发送位置
		HasSentInitialPosition: false,
	}

	slog.Info("Player added to battle room", "room_id", room.BattleID, "player_id", playerID, "player_name", name)
}

// RemovePlayer 从战斗房间移除玩家
func (room *BattleRoom) RemovePlayer(playerID uint64) {
	room.PlayersMutex.Lock()
	defer room.PlayersMutex.Unlock()

	if _, exists := room.Players[playerID]; exists {
		delete(room.Players, playerID)
		delete(room.ReadyPlayers, playerID) // 同时移除准备状态
		slog.Info("Player removed from battle room", "room_id", room.BattleID, "player_id", playerID)
	}
}

// Stop 停止战斗房间
func (room *BattleRoom) Stop() {
	room.PlayersMutex.Lock()
	defer room.PlayersMutex.Unlock()

	if room.Game != nil {
		room.Game.EndGame()
	}

	// 关闭命令通道（如果需要的话）
	// close(room.CmdChan) // 注意：需要确保没有其他goroutine在写入

	slog.Info("Battle room stopped", "room_id", room.BattleID)
}

// SetPlayerReady 使用 presence 语义：
//  - isReady=true  => 将玩家加入 ReadyPlayers（value 恒为 true）
//  - isReady=false => 从 ReadyPlayers 删除该玩家
// 这样 AllPlayersReady 只需比较 map 长度与玩家数即可，无需遍历。
func (room *BattleRoom) SetPlayerReady(playerID uint64, isReady bool) {
	room.PlayersMutex.Lock()
	defer room.PlayersMutex.Unlock()
	if isReady {
		room.ReadyPlayers[playerID] = true
	} else {
		delete(room.ReadyPlayers, playerID)
	}
}

func (room *BattleRoom) AllPlayersReady() bool {
	room.PlayersMutex.RLock()
	defer room.PlayersMutex.RUnlock()
	// 确保至少有一名玩家，并且准备人数与玩家总数相等
	return len(room.Players) > 0 && len(room.ReadyPlayers) == len(room.Players)
}

func (room *BattleRoom) StartGame() {
	// 将房间玩家转换为游戏玩家
	var players []*Player
	for id, info := range room.Players {
		players = append(players, &Player{
			ID:   id,
			Name: info.Name,
		})
	}

	// 初始化并开始游戏
	room.Game.Init(players)
	room.Game.Start()

	// 清空准备状态，避免下局继承（若房间复用）
	room.ReadyPlayers = make(map[uint64]bool)

	// 广播游戏状态
	room.BroadcastGameState()
}

func (room *BattleRoom) BroadcastGameState() {
	if room.Game == nil {
		slog.Warn("Cannot broadcast game state: Game is nil")
		return
	}
	
	state := room.Game.GetState()
	slog.Info("Broadcasting game state", "current_turn", state.CurrentTurn, "players_count", len(state.Players))

	// 通知房间内所有玩家
	for playerID := range room.Players {
		room.NotifyGameState(playerID, &pb.GameStateNotify{
			RoomId:    room.BattleID,
			GameState: state,
		})
	}
}

func (room *BattleRoom) Run() {
	go func() {
		gameTicker := time.NewTicker(100 * time.Millisecond)
		defer gameTicker.Stop()

		for {
			select {
			case cmd := <-room.CmdChan:
				room.HandlePlayerCommand(cmd)
			case cmdWithResult := <-room.CmdChanWithResult:
				result := room.HandlePlayerCommandWithResult(cmdWithResult.Command)
				// 将结果发送回结果通道
				select {
				case cmdWithResult.ResultChan <- result:
				default:
					// 如果通道已满或关闭，忽略结果
				}
			case <-gameTicker.C:
				if room.Game != nil && room.Game.IsGameOver() {
					room.Game.EndGame()
					room.EndGame()
					return
				}
			}
		}
	}()
}

func (room *BattleRoom) HandlePlayerCommand(cmd Command) {
	// 确保Command不为nil
	if cmd.Action == nil {
		slog.Error("[Battle] Action is nil", "player_id", cmd.PlayerID)
		return
	}

	// ===========================================
	// Room层面处理：跨游戏状态的功能
	// ===========================================

	switch cmd.Action.ActionType {
	case pb.ActionType_CHAR_MOVE:
		// 位置移动在Room层面处理（大厅、游戏中都需要）
		room.handleCharMoveInRoom(cmd)
		return

		// case pb.ActionType_AUTO_CHAT:
		// 	// 聊天在Room层面处理（游戏前后都能聊天）
		// 	room.handleChatInRoom(cmd)
		// 	return
	}

	// ===========================================
	// Game层面处理：游戏逻辑相关的功能
	// ===========================================

	// 检查游戏是否已开始
	if room.Game == nil {
		slog.Warn("[Battle] Game not started yet, ignoring game action",
			"action_type", cmd.Action.ActionType, "player_id", cmd.PlayerID)
		return
	}

	// 确保Game实例有效后再调用HandleAction
	if room.Game != nil {
		// 游戏层面的操作（卡牌、回合等）
		result := room.Game.HandleAction(cmd.PlayerID, cmd.Action)
		if result == pb.ErrorCode_OK {
			room.BroadcastGameState()
		}
	} else {
		slog.Error("[Battle] Game instance is nil when handling action",
			"action_type", cmd.Action.ActionType, "player_id", cmd.PlayerID)
	}
}

// HandlePlayerCommandWithResult 处理带结果的玩家命令
func (room *BattleRoom) HandlePlayerCommandWithResult(cmd Command) pb.ErrorCode {
	// 确保Command不为nil
	if cmd.Action == nil {
		slog.Error("[Battle] Action is nil", "player_id", cmd.PlayerID)
		return pb.ErrorCode_INVALID_ACTION
	}

	// ===========================================
	// Room层面处理：跨游戏状态的功能
	// ===========================================

	switch cmd.Action.ActionType {
	case pb.ActionType_CHAR_MOVE:
		// 位置移动在Room层面处理（大厅、游戏中都需要）
		room.handleCharMoveInRoom(cmd)
		return pb.ErrorCode_OK

		// case pb.ActionType_AUTO_CHAT:
		// 	// 聊天在Room层面处理（游戏前后都能聊天）
		// 	room.handleChatInRoom(cmd)
		// 	return pb.ErrorCode_OK
	}

	// ===========================================
	// Game层面处理：游戏逻辑相关的功能
	// ===========================================

	// 检查游戏是否已开始
	if room.Game == nil {
		slog.Warn("[Battle] Game not started yet, ignoring game action",
			"action_type", cmd.Action.ActionType, "player_id", cmd.PlayerID)
		return pb.ErrorCode_INVALID_STATE
	}

	// 确保Game实例有效后再调用HandleAction
	if room.Game != nil {
		// 游戏层面的操作（卡牌、回合等）
		result := room.Game.HandleAction(cmd.PlayerID, cmd.Action)
		if result == pb.ErrorCode_OK {
			room.BroadcastGameState()
		}
		return result
	} else {
		slog.Error("[Battle] Game instance is nil when handling action",
			"action_type", cmd.Action.ActionType, "player_id", cmd.PlayerID)
		return pb.ErrorCode_SERVER_ERROR
	}
}

// handleCharMoveInRoom 在房间层面处理角色移动
func (room *BattleRoom) handleCharMoveInRoom(cmd Command) {
	slog.Info("[Battle] Handling CHAR_MOVE in room", "player_id", cmd.PlayerID, "room_id", room.BattleID)

	// 检查玩家是否在房间中
	room.PlayersMutex.Lock()
	playerInfo, exists := room.Players[cmd.PlayerID]
	if !exists {
		room.PlayersMutex.Unlock()
		slog.Error("[Battle] Player not in room", "player_id", cmd.PlayerID, "room_id", room.BattleID)
		return
	}

	// 确保Action和CharMove不为nil
	if cmd.Action == nil {
		room.PlayersMutex.Unlock()
		slog.Error("[Battle] Action is nil", "player_id", cmd.PlayerID)
		return
	}

	moveAction := cmd.Action.GetCharMove()
	if moveAction == nil {
		room.PlayersMutex.Unlock()
		slog.Error("[Battle] CharMove action is nil", "player_id", cmd.PlayerID)
		return
	}

	// 更新房间层面的玩家位置信息
	isFirstPosition := !playerInfo.HasSentInitialPosition
	playerInfo.PositionX = moveAction.ToX
	playerInfo.PositionY = moveAction.ToY

	// 如果是第一次发送位置，标记为已发送
	if isFirstPosition {
		playerInfo.HasSentInitialPosition = true
		slog.Info("[Battle] Player sent first position", "player_id", cmd.PlayerID,
			"pos_x", moveAction.ToX, "pos_y", moveAction.ToY)
	}

	room.PlayersMutex.Unlock()

	slog.Info("[Battle] Player moved in room", "player_id", cmd.PlayerID,
		"from_x", moveAction.FromX, "from_y", moveAction.FromY, "to_x", moveAction.ToX, "to_y", moveAction.ToY)

	// 如果游戏已开始，同时更新游戏层面的位置状态
	if room.Game != nil {
		// 调用游戏层面的位置更新（更新游戏内玩家对象的位置）
		room.Game.HandleAction(cmd.PlayerID, cmd.Action)
	}

	// Room层面：广播位置更新给所有玩家
	room.BroadcastPlayerPosition(cmd.PlayerID, moveAction)

	// 如果是第一次发送位置，记录日志
	if isFirstPosition {
		slog.Info("[Battle] Broadcasted first position to all players", "player_id", cmd.PlayerID)
	}
}

func (room *BattleRoom) EndGame() {
	slog.Info("Game ended", "room", room.BattleID)

	// 清理房间
	room.Server.RoomsMutex.Lock()
	delete(room.Server.BattleRooms, room.BattleID)
	room.Server.RoomsMutex.Unlock()
}

func (room *BattleRoom) BroadcastRoomStatus() {
	// 通知房间内所有玩家
	for playerID := range room.Players {
		room.NotifyRoomStatus(playerID, &pb.RoomDetail{
			Room: &pb.Room{
				Id:   room.BattleID,
				Name: "Battle Room",
			},
			CurrentPlayers: room.GetPlayerList(),
		})
	}
}

func (room *BattleRoom) BroadcastNotifyGameState() {
	state := room.Game.GetState()

	// 通知房间内所有玩家
	for playerID := range room.Players {
		room.NotifyGameState(playerID, &pb.GameStateNotify{
			RoomId:    room.BattleID,
			GameState: state,
		})
	}
}

func (room *BattleRoom) NotifyRoomStatus(playerID uint64, msg *pb.RoomDetail) {
	client, err := room.Server.getGameClient()
	if err != nil {
		slog.Error("Failed to get game client", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	notify := &pb.RoomDetailNotify{
		BeNotifiedUid: playerID,
		Room:          msg,
	}

	_, err = client.RoomStatusNotifyRpc(ctx, notify)
	if err != nil {
		slog.Error("Failed to send notification", "player_id", playerID, "error", err)
	}
}

func (room *BattleRoom) NotifyGameState(playerId uint64, msg *pb.GameStateNotify) {
	client, err := room.Server.getGameClient()
	if err != nil {
		slog.Error("Failed to get game client", "error", err)
		return
	}

	// 设置被通知者的ID
	msg.BeNotifiedUid = playerId

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	_, err = client.GameStateNotifyRpc(ctx, msg)
	if err != nil {
		slog.Error("Failed to send game state notification", "player_id", playerId, "error", err)
	}
}

func (room *BattleRoom) GetPlayerList() []*pb.RoomPlayer {
	var players []*pb.RoomPlayer
	room.PlayersMutex.RLock()
	defer room.PlayersMutex.RUnlock()

	for id, info := range room.Players {
		_, ready := room.ReadyPlayers[id]
		players = append(players, &pb.RoomPlayer{
			Uid:       id,
			Name:      info.Name,
			PositionX: info.PositionX,
			PositionY: info.PositionY,
			IsReady:   ready,
		})
	}
	return players
}

// BroadcastPlayerPosition 广播玩家位置更新
func (room *BattleRoom) BroadcastPlayerPosition(playerID uint64, moveAction *pb.CharacterMoveAction) {
	// 确保moveAction不为nil
	if moveAction == nil {
		slog.Error("MoveAction is nil in BroadcastPlayerPosition", "player_id", playerID)
		return
	}

	slog.Info("Broadcasting player position update", "room_id", room.BattleID, "player_id", playerID,
		"from_x", moveAction.FromX, "from_y", moveAction.FromY, "to_x", moveAction.ToX, "to_y", moveAction.ToY)

	// 创建位置更新消息
	positionUpdate := &pb.GameAction{
		PlayerId:   playerID,
		ActionType: pb.ActionType_CHAR_MOVE,
		Timestamp:  time.Now().UnixMilli(),
	}
	// 设置 CharMove action
	positionUpdate.ActionDetail = &pb.GameAction_CharMove{
		CharMove: moveAction,
	}

	// 使用通用的BroadcastPlayerAction方法
	room.BroadcastPlayerAction(positionUpdate)
}

// BroadcastPlayerAction 广播玩家动作（通用方法）
func (room *BattleRoom) BroadcastPlayerAction(action *pb.GameAction) {
	slog.Info("Broadcasting player action", "room_id", room.BattleID, "player_id", action.PlayerId,
		"action_type", action.ActionType)

	// 向房间内所有玩家广播
	for otherPlayerID := range room.Players {
		room.NotifyPlayerAction(otherPlayerID, action)
	}
}

// NotifyPlayerAction 通知单个玩家动作更新（通用方法）
func (room *BattleRoom) NotifyPlayerAction(playerID uint64, action *pb.GameAction) {
	client, err := room.Server.getGameClient()
	if err != nil {
		slog.Error("Failed to get game client for action update", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 使用PlayerActionNotify消息格式发送动作更新
	notify := &pb.PlayerActionNotify{
		BeNotifiedUid: playerID,
		RoomId:        room.BattleID,
		PlayerId:      action.PlayerId,
		Action:        action,
	}

	_, err = client.PlayerActionNotifyRpc(ctx, notify)
	if err != nil {
		slog.Error("Failed to send action notification", "player_id", playerID, "error", err)
	} else {
		slog.Debug("Action notification sent successfully", "player_id", playerID)
	}
}

// NotifyGameStart 通知所有玩家游戏开始
func (room *BattleRoom) NotifyGameStart() {
	slog.Info("Notifying game start to all players", "room_id", room.BattleID)

	// 创建游戏开始通知
	gameStartNotify := &pb.GameStartNotification{
		RoomId:  room.BattleID,
		Players: room.GetPlayerList(),
	}

	// 通知房间内所有玩家
	for playerID := range room.Players {
		room.NotifyGameStartToPlayer(playerID, gameStartNotify)
	}
}

// NotifyGameStartToPlayer 通知单个玩家游戏开始
func (room *BattleRoom) NotifyGameStartToPlayer(playerID uint64, gameStartNotify *pb.GameStartNotification) {
	client, err := room.Server.getGameClient()
	if err != nil {
		slog.Error("Failed to get game client for game start notification", "error", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 使用GameStartNotify消息格式发送游戏开始通知
	notify := &pb.GameStartNotify{
		BeNotifiedUid: playerID,
		GameStart:     gameStartNotify,
	}

	_, err = client.GameStartNotifyRpc(ctx, notify)
	if err != nil {
		slog.Error("Failed to send game start notification", "player_id", playerID, "error", err)
	} else {
		slog.Info("Game start notification sent successfully", "player_id", playerID)
	}
}

// BroadcastInitialPositions 广播初始位置信息
func (room *BattleRoom) BroadcastInitialPositions(newPlayerID uint64) {
	slog.Info("Broadcasting initial positions", "room_id", room.BattleID, "new_player_id", newPlayerID)

	room.PlayersMutex.RLock()
	defer room.PlayersMutex.RUnlock()

	// 只向新玩家发送所有现有玩家的位置
	// 新玩家的位置等待他们主动发送第一个移动消息时再同步
	for playerID, playerInfo := range room.Players {
		if playerID == newPlayerID {
			continue // 跳过新玩家自己
		}

		// 创建位置消息
		positionAction := &pb.CharacterMoveAction{
			FromX: 0,
			FromY: 0,
			ToX:   playerInfo.PositionX,
			ToY:   playerInfo.PositionY,
		}

		positionUpdate := &pb.GameAction{
			PlayerId:   playerID,
			ActionType: pb.ActionType_CHAR_MOVE,
			Timestamp:  time.Now().UnixMilli(),
			ActionDetail: &pb.GameAction_CharMove{
				CharMove: positionAction,
			},
		}

		// 发送给新玩家
		room.NotifyPlayerAction(newPlayerID, positionUpdate)
		slog.Debug("Sent existing player position to new player",
			"existing_player", playerID, "new_player", newPlayerID,
			"pos_x", playerInfo.PositionX, "pos_y", playerInfo.PositionY)
	}

	slog.Info("Initial positions sent to new player", "new_player_id", newPlayerID,
		"existing_players_count", len(room.Players)-1)
}
