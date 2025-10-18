package main

import (
	"context"
	"log/slog"
	pb "proto"
	"time"
)

// backgroundMatcher 后台匹配处理器
func (s *OptimizedMatchServer) backgroundMatcher() {
	ticker := time.NewTicker(MatchCheckPeriod)
	defer ticker.Stop()

	for range ticker.C {
		s.tryMatch()
	}
}

// tryMatch 尝试匹配玩家
func (s *OptimizedMatchServer) tryMatch() {
	s.mu.Lock()

	// 检查超时的玩家 (30秒)
	now := time.Now()
	var timeoutPlayers []uint64

	for playerID, lastTime := range s.lastActivity {
		if now.Sub(lastTime) > MatchTimeout {
			timeoutPlayers = append(timeoutPlayers, playerID)
		}
	}

	// 释放锁后处理超时通知
	s.mu.Unlock()

	// 通知超时的玩家
	for _, playerID := range timeoutPlayers {
		s.mu.Lock()
		// 双重检查，确保玩家还在队列中
		if _, exists := s.matchQueue[playerID]; exists {
			delete(s.matchQueue, playerID)
			delete(s.lastActivity, playerID)
			s.mu.Unlock()

			slog.Info("Player match timeout", "player_id", playerID)
			// 通知客户端匹配失败
			go s.notifyMatchFailed(playerID, "匹配超时")
		} else {
			s.mu.Unlock()
		}
	}

	// 尝试匹配
	s.mu.Lock()
	var matchedPlayers []*pb.MatchRpcRequest

	for _, req := range s.matchQueue {
		matchedPlayers = append(matchedPlayers, req)

		// 凑够2人就匹配
		if len(matchedPlayers) == 2 {
			// 从队列中移除这些玩家
			for _, player := range matchedPlayers {
				delete(s.matchQueue, player.PlayerId)
				delete(s.lastActivity, player.PlayerId)
			}

			slog.Info("Found match for 2 players",
				"player1", matchedPlayers[0].PlayerId,
				"player2", matchedPlayers[1].PlayerId)

			// 异步创建房间
			players := make([]*pb.MatchRpcRequest, len(matchedPlayers))
			copy(players, matchedPlayers)
			go s.createMatchRoom(players)

			matchedPlayers = nil // 清空，继续匹配下一组
		}
	}

	s.mu.Unlock()
}

// createMatchRoom 创建匹配房间
func (s *OptimizedMatchServer) createMatchRoom(players []*pb.MatchRpcRequest) {
	if s.roomConn == nil {
		slog.Error("Room server connection not available")
		// 通知所有玩家匹配失败
		for _, player := range players {
			s.notifyMatchFailed(player.PlayerId, "服务器连接失败")
		}
		return
	}

	slog.Info("Creating match room", "players", len(players))

	// 构建创建房间请求
	var playerDataList []*pb.PlayerInitData
	for _, player := range players {
		// 使用 player_id 创建 PlayerInitData
		playerData := &pb.PlayerInitData{
			PlayerId:   player.PlayerId,
			PlayerName: player.PlayerData.GetPlayerName(), // 如果有名字就用，否则为空
		}
		playerDataList = append(playerDataList, playerData)
		slog.Info("Adding player to match room request", "player_id", player.PlayerId, "player_name", playerData.PlayerName)
	}

	roomClient := pb.NewRoomRpcServiceClient(s.roomConn)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 调用 Room Server 创建匹配房间
	resp, err := roomClient.MatchCreateRoomRpc(ctx, &pb.MatchCreateRoomRpcRequest{
		Player: playerDataList,
	})

	if err != nil {
		slog.Error("Failed to create match room via RPC", "error", err)
		// 通知所有玩家匹配失败
		for _, player := range players {
			s.notifyMatchFailed(player.PlayerId, "创建房间失败")
		}
		return
	}

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("Create match room failed", "error_code", resp.Ret)
		// 通知所有玩家匹配失败
		for _, player := range players {
			s.notifyMatchFailed(player.PlayerId, "创建房间失败")
		}
		return
	}

	slog.Info("Match room created successfully",
		"room_id", resp.Room.Room.Id,
		"players", len(players))

	// 通知所有玩家匹配成功
	for _, player := range players {
		s.notifyMatchSuccess(player.PlayerId, resp.Room)
	}
}

// notifyMatchSuccess 通知玩家匹配成功
func (s *OptimizedMatchServer) notifyMatchSuccess(playerID uint64, room *pb.RoomDetail) {
	if s.gameConn == nil {
		slog.Error("Game server connection not available", "player_id", playerID)
		return
	}

	gameClient := pb.NewGameRpcServiceClient(s.gameConn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 通知 Game Server，由它推送给客户端
	notify := &pb.MatchResultNotifyRequest{
		BeNotifiedUid: playerID,
		MatchResult: &pb.MatchResultNotify{
			Ret:  int32(pb.ErrorCode_OK),
			Room: room,
		},
	}

	_, err := gameClient.MatchResultNotifyRpc(ctx, notify)
	if err != nil {
		slog.Error("Failed to notify player match success", "player_id", playerID, "error", err)
	} else {
		slog.Info("Notified player match success", "player_id", playerID, "room_id", room.Room.Id)
	}
}

// notifyMatchFailed 通知玩家匹配失败
func (s *OptimizedMatchServer) notifyMatchFailed(playerID uint64, reason string) {
	if s.gameConn == nil {
		slog.Error("Game server connection not available", "player_id", playerID)
		return
	}

	gameClient := pb.NewGameRpcServiceClient(s.gameConn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 通知 Game Server 匹配失败
	notify := &pb.MatchResultNotifyRequest{
		BeNotifiedUid: playerID,
		MatchResult: &pb.MatchResultNotify{
			Ret:  int32(pb.ErrorCode_TIMEOUT),
			Room: nil,
		},
	}

	_, err := gameClient.MatchResultNotifyRpc(ctx, notify)
	if err != nil {
		slog.Error("Failed to notify player match failed",
			"player_id", playerID,
			"reason", reason,
			"error", err)
	} else {
		slog.Info("Notified player match failed",
			"player_id", playerID,
			"reason", reason)
	}
}
