package main

import (
	"common/discovery"
	"common/redisutil"
	"common/rpc"
	"context"
	"fmt"
	"log/slog"
	"net"
	"os"
	pb "proto"
	"strconv"
	"sync"
	"time"

	"google.golang.org/grpc"
)

// BattleServer 结构体
type BattleServer struct {
	pb.UnimplementedRoomRpcServiceServer // 实现gRPC接口

	RedisPool    *redisutil.RedisPool
	BattleRooms  map[string]*BattleRoom
	RoomsMutex   sync.RWMutex
	PlayerInRoom map[uint64]string // 玩家ID到房间ID的映射
	PlayersMutex sync.RWMutex
	Discovery    discovery.Discovery
	InstanceID   string
}

func main() {
	// 初始化日志
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)
	slog.Info("Starting Battle Server...")

	// 初始化Redis连接池
	redisConfig := redisutil.LoadRedisConfigFromEnv()
	redisPool := redisutil.NewRedisPoolFromConfig(redisConfig)
	defer redisPool.Close()

	// 创建BattleServer实例
	server := &BattleServer{
		RedisPool:    redisPool,
		BattleRooms:  make(map[string]*BattleRoom),
		PlayerInRoom: make(map[uint64]string),
	}

	// 注册服务发现
	server.registerServiceDiscovery()

	// 启动gRPC服务器
	server.startRoomGRPCServer(rpc.RoomServiceGRPCPort, server.InstanceID)

	slog.Info("Battle server is running")
	select {} // 阻塞主线程
}

// 注册服务发现
func (s *BattleServer) registerServiceDiscovery() {
	s.InstanceID = generateInstanceID()
	disc := discovery.NewRedisDiscovery(s.RedisPool, "prod_")

	// 获取本机IP
	hostIP, err := getLocalIP()
	if err != nil {
		slog.Error("Failed to get local IP", "error", err)
		hostIP = "127.0.0.1"
	}

	grpcAddr := fmt.Sprintf("%s:%d", hostIP, rpc.RoomServiceGRPCPort)

	instance := &discovery.ServiceInstance{
		ServiceName: "battle-server",
		InstanceID:  s.InstanceID,
		Address:     grpcAddr,
		Metadata: map[string]string{
			"version": "1.0",
		},
	}

	// 注册服务
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := disc.Register(ctx, instance); err != nil {
		slog.Error("Failed to register service", "error", err)
		os.Exit(1)
	}
	slog.Info("Service registered", "instance", s.InstanceID, "address", grpcAddr)

	s.Discovery = disc

	// 心跳协程
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			if err := disc.Heartbeat(ctx, s.InstanceID); err != nil {
				slog.Error("Heartbeat failed", "error", err)
			} else {
				slog.Debug("Heartbeat sent")
			}
			cancel()
		}
	}()
}

// 启动gRPC服务器
func (s *BattleServer) startRoomGRPCServer(port int, instanceID string) {
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		slog.Error("Failed to listen", "port", port, "error", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterRoomRpcServiceServer(grpcServer, s)
	slog.Info("gRPC server starting", "port", port)
	if err := grpcServer.Serve(lis); err != nil {
		slog.Error("gRPC server failed", "error", err)
		os.Exit(1)
	}
	slog.Info("gRPC server started", "port", port, "instance_id", instanceID)
}

func (s *BattleServer) CreateRoomRpc(ctx context.Context, req *pb.CreateRoomRpcRequest) (*pb.CreateRoomRpcResponse, error) {

	s.RoomsMutex.Lock()
	defer s.RoomsMutex.Unlock()

	s.PlayersMutex.Lock()
	defer s.PlayersMutex.Unlock()

	//如果玩家已经在房间中，返回错误
	if roomID, exists := s.PlayerInRoom[req.Player.PlayerId]; exists {
		slog.Warn("Player already in room", "player_id", req.Player.PlayerId, "room_id", roomID)
		return &pb.CreateRoomRpcResponse{Ret: pb.ErrorCode_PLAYER_ALREADY_IN_ROOM}, nil
	}

	roomID := strconv.FormatUint(req.Player.PlayerId, 10)

	// 创建新战斗房间
	room := NewBattleRoom(roomID, s, GameType_WordCardGame)
	room.AddPlayer(req.Player.PlayerId, req.Player.PlayerName)
	room.Run()

	s.BattleRooms[roomID] = room
	s.PlayerInRoom[req.Player.PlayerId] = roomID

	slog.Info("Battle room created", "room_id", roomID)

	//todo: room 跟哪个 BattleServer 关联 需要写入到redis里，后续 GameServer收到加入房间请求时可以通过BattleServer的实例ID找到对应的BattleServer

	// 返回RoomDetail而不是RoomId
	roomDetail := &pb.RoomDetail{
		Room: &pb.Room{
			Id:             roomID,
			Name:           "Battle Room",
			MaxPlayers:     4,
			CurrentPlayers: 1,
		},
		CurrentPlayers: room.GetPlayerList(),
	}

	return &pb.CreateRoomRpcResponse{Ret: pb.ErrorCode_OK, Room: roomDetail}, nil
}

func (s *BattleServer) JoinRoomRpc(ctx context.Context, req *pb.JoinRoomRpcRequest) (*pb.JoinRoomRpcResponse, error) {
	s.RoomsMutex.RLock()
	room, exists := s.BattleRooms[req.RoomId]
	s.RoomsMutex.RUnlock()

	if !exists {
		return &pb.JoinRoomRpcResponse{Ret: pb.ErrorCode_INVALID_ROOM}, nil
	}

	room.AddPlayer(req.Player.PlayerId, req.Player.PlayerName)

	s.PlayersMutex.Lock()
	defer s.PlayersMutex.Unlock()

	s.PlayerInRoom[req.Player.PlayerId] = req.RoomId

	slog.Info("Player joined room", "room_id", req.RoomId, "player", req.Player.PlayerId)

	// 广播房间状态给所有玩家（包括新加入的玩家）
	room.BroadcastRoomStatus()

	// 新增：广播玩家初始位置信息
	room.BroadcastInitialPositions(req.Player.PlayerId)

	// 返回RoomDetail而不是RoomId
	roomDetail := &pb.RoomDetail{
		Room: &pb.Room{
			Id:             req.RoomId,
			Name:           "Battle Room",
			MaxPlayers:     4,
			CurrentPlayers: int32(len(room.Players)),
		},
		CurrentPlayers: room.GetPlayerList(),
	}

	return &pb.JoinRoomRpcResponse{
		Ret:  pb.ErrorCode_OK,
		Room: roomDetail,
	}, nil

}

func (s *BattleServer) LeaveRoomRpc(ctx context.Context, req *pb.LeaveRoomRpcRequest) (*pb.LeaveRoomRpcResponse, error) {
	slog.Info("LeaveRoomRpc called", "player_id", req.PlayerId)

	s.PlayersMutex.Lock()
	roomID, exists := s.PlayerInRoom[req.PlayerId]
	if !exists {
		s.PlayersMutex.Unlock()
		slog.Warn("Player not in any room", "player_id", req.PlayerId)
		return &pb.LeaveRoomRpcResponse{Ret: pb.ErrorCode_INVALID_ROOM}, nil
	}

	// 从 PlayerInRoom 中移除玩家
	delete(s.PlayerInRoom, req.PlayerId)
	s.PlayersMutex.Unlock()

	// 从房间中移除玩家
	s.RoomsMutex.Lock()
	room, roomExists := s.BattleRooms[roomID]
	if roomExists {
		// 从房间中移除玩家
		room.RemovePlayer(req.PlayerId)

		// 向房间内剩余玩家广播房间状态更新
		if len(room.Players) > 0 {
			room.BroadcastRoomStatus()
			slog.Info("Broadcasted room status after player left", "room_id", roomID, "remaining_players", len(room.Players))
		}

		// 如果房间没有玩家了，删除房间
		if len(room.Players) == 0 {
			slog.Info("Room is empty, removing room", "room_id", roomID)
			room.Stop() // 停止房间逻辑
			delete(s.BattleRooms, roomID)
		}
	}
	s.RoomsMutex.Unlock()

	slog.Info("Player left room successfully", "player_id", req.PlayerId, "room_id", roomID)

	// 返回房间剩余玩家列表
	var players []*pb.PlayerInitData
	if roomExists {
		for playerID := range room.Players {
			players = append(players, &pb.PlayerInitData{
				PlayerId: playerID,
			})
		}
	}

	return &pb.LeaveRoomRpcResponse{
		Ret:     pb.ErrorCode_OK,
		RoomId:  roomID,
		Players: players,
	}, nil
}

func (s *BattleServer) GetReadyRpc(ctx context.Context, req *pb.GetReadyRpcRequest) (*pb.GetReadyRpcResponse, error) {
	//找到玩家在哪个房间
	s.PlayersMutex.RLock()
	roomId, exists := s.PlayerInRoom[req.PlayerId]
	s.PlayersMutex.RUnlock()

	if !exists {
		return &pb.GetReadyRpcResponse{Ret: pb.ErrorCode_INVALID_ROOM}, nil
	}

	//找到房间
	s.RoomsMutex.RLock()
	room, roomExists := s.BattleRooms[roomId]
	s.RoomsMutex.RUnlock()

	if !roomExists {
		return &pb.GetReadyRpcResponse{Ret: pb.ErrorCode_INVALID_ROOM}, nil
	}

	slog.Info("Player ready status change", "player_id", req.PlayerId, "is_ready", req.IsReady)

	//设置状态
	room.SetPlayerReady(req.PlayerId, req.IsReady)
	//todo: 通知房间内所有玩家某个玩家准备状态变化 给game 发送 RoomDetailNotify
	room.BroadcastRoomStatus()

	//房间人数大于等于2人，且全部准备，开始游戏
	if len(room.Players) >= 2 && room.AllPlayersReady() {
		slog.Info("All players ready, starting game", "room_id", roomId)
		// 通知所有玩家游戏开始
		room.NotifyGameStart()
		room.StartGame()
	}

	return &pb.GetReadyRpcResponse{
		Ret:    pb.ErrorCode_OK,
		RoomId: roomId,
	}, nil
}

// PlayerAction 处理玩家操作
func (s *BattleServer) PlayerActionRpc(ctx context.Context, req *pb.PlayerActionRpcRequest) (*pb.PlayerActionRpcResponse, error) {
	s.RoomsMutex.RLock()
	room, exists := s.BattleRooms[req.RoomId]
	s.RoomsMutex.RUnlock()

	if !exists {
		return &pb.PlayerActionRpcResponse{Ret: pb.ErrorCode_INVALID_ROOM}, nil
	}

	// 将操作发送到房间的命令通道
	room.CmdChan <- Command{
		PlayerID: req.PlayerId,
		Action:   req.Action,
	}

	return &pb.PlayerActionRpcResponse{Ret: pb.ErrorCode_OK}, nil
}

// GetRoomListRpc 获取房间列表
func (s *BattleServer) GetRoomListRpc(ctx context.Context, req *pb.GetRoomListRpcRequest) (*pb.GetRoomListRpcResponse, error) {
	slog.Info("GetRoomListRpc called")

	// 获取所有房间信息
	s.RoomsMutex.RLock()
	defer s.RoomsMutex.RUnlock()

	var rooms []*pb.Room
	for roomID, room := range s.BattleRooms {
		// 创建房间信息
		roomInfo := &pb.Room{
			Id:             roomID,
			Name:           "Battle Room",            // 可以根据需要修改房间名称
			MaxPlayers:     4,                        // 最大玩家数，可以根据需要调整
			CurrentPlayers: int32(len(room.Players)), // 当前玩家数
		}
		rooms = append(rooms, roomInfo)
	}

	slog.Info("Returning room list", "count", len(rooms))

	return &pb.GetRoomListRpcResponse{
		Ret:   pb.ErrorCode_OK,
		Rooms: rooms,
	}, nil
}

// 获取本机IP
func getLocalIP() (string, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "", err
	}

	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String(), nil
			}
		}
	}
	return "", fmt.Errorf("no valid local IP found")
}

// 生成唯一实例ID
func generateInstanceID() string {
	hostname, _ := os.Hostname()
	return fmt.Sprintf("%s-%d-%d", hostname, os.Getpid(), time.Now().UnixNano())
}
