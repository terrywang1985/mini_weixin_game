package main

import (
	"common/rpc"
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	pb "proto"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

const (
	MatchTimeout     = 30 * time.Second       // 匹配超时时间
	MatchCheckPeriod = 500 * time.Millisecond // 匹配检查周期
)

var (
	// 使用 common/rpc 中定义的端口
	RoomServerAddr = fmt.Sprintf("127.0.0.1:%d", rpc.RoomServiceGRPCPort) // 8693
	GameServerAddr = fmt.Sprintf("127.0.0.1:%d", rpc.GameServiceGRPCPort) // 8694 (修正!)
)

type OptimizedMatchServer struct {
	pb.UnimplementedMatchRpcServiceServer

	mu           sync.RWMutex
	matchQueue   map[uint64]*pb.MatchRpcRequest // 玩家ID到匹配请求的映射
	lastActivity map[uint64]time.Time           // 玩家最后活动时间（用于超时）

	// gRPC 连接池
	roomConn *grpc.ClientConn
	gameConn *grpc.ClientConn
}

func NewOptimizedMatchServer() *OptimizedMatchServer {
	server := &OptimizedMatchServer{
		matchQueue:   make(map[uint64]*pb.MatchRpcRequest),
		lastActivity: make(map[uint64]time.Time),
	}

	// 建立到 Room Server 的连接
	roomConn, err := grpc.Dial(
		RoomServerAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		slog.Error("Failed to connect to Room Server", "error", err)
	} else {
		server.roomConn = roomConn
		slog.Info("Connected to Room Server", "addr", RoomServerAddr)
	}

	// 建立到 Game Server 的连接
	gameConn, err := grpc.Dial(
		GameServerAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		slog.Error("Failed to connect to Game Server", "error", err)
	} else {
		server.gameConn = gameConn
		slog.Info("Connected to Game Server", "addr", GameServerAddr)
	}

	// 启动后台匹配协程
	go server.backgroundMatcher()

	return server
}

func (s *OptimizedMatchServer) Close() {
	if s.roomConn != nil {
		s.roomConn.Close()
	}
	if s.gameConn != nil {
		s.gameConn.Close()
	}
}

func (s *OptimizedMatchServer) StartMatchRpc(ctx context.Context, req *pb.MatchRpcRequest) (*pb.MatchRpcResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	playerID := req.GetPlayerId()
	slog.Info("Player joined match queue", "player_id", playerID)

	// 如果已经在匹配队列中，则忽略
	if _, exists := s.matchQueue[playerID]; exists {
		slog.Warn("Player already in match queue", "player_id", playerID)
		return &pb.MatchRpcResponse{Ret: pb.ErrorCode_ALREADY_EXISTS}, nil
	}

	// 添加到匹配队列
	s.matchQueue[playerID] = req
	s.lastActivity[playerID] = time.Now()

	slog.Info("Player added to match queue", "player_id", playerID, "queue_size", len(s.matchQueue))
	return &pb.MatchRpcResponse{Ret: pb.ErrorCode_OK}, nil
}

func (s *OptimizedMatchServer) CancelMatchRpc(ctx context.Context, req *pb.CancelMatchRpcRequest) (*pb.MatchRpcResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	playerID := req.GetPlayerId()
	slog.Info("Player canceling match", "player_id", playerID)

	if _, exists := s.matchQueue[playerID]; exists {
		delete(s.matchQueue, playerID)
		delete(s.lastActivity, playerID)
		slog.Info("Player removed from match queue", "player_id", playerID, "queue_size", len(s.matchQueue))
	} else {
		slog.Warn("Player not in match queue", "player_id", playerID)
	}

	return &pb.MatchRpcResponse{Ret: pb.ErrorCode_OK}, nil
}
