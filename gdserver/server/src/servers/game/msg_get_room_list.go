package main

import (
	"context"
	"log"
	"log/slog"
	pb "proto"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"
)

func (p *Player) HandleGetRoomListRequest(msg *pb.Message) {
	slog.Info("HandleGetRoomListRequest called", "player_id", p.Uid, "message_id", msg.GetId())

	var req pb.GetRoomListRequest
	if err := proto.Unmarshal(msg.GetData(), &req); err != nil {
		slog.Error("Failed to parse GetRoomListRequest", "error", err)
		return
	}

	slog.Info("GetRoomListRequest parsed", "player_id", p.Uid)

	// 创建gRPC client并连接到battle server
	slog.Info("Attempting to connect to BattleServer", "address", "127.0.0.1:8693")
	conn, err := grpc.Dial(
		"127.0.0.1:8693",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(2*time.Second),
	)
	if err != nil {
		log.Printf("连接BattleServer失败: %s, 错误: %v", "127.0.0.1:8693", err)
		slog.Error("Failed to connect to BattleServer", "error", err)
		// 即使连接失败，也应该给客户端发送响应
		p.SendResponse(msg, mustMarshal(&pb.GetRoomListResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	slog.Info("Connected to BattleServer successfully")
	defer conn.Close()

	client := pb.NewRoomRpcServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 调用获取房间列表的RPC方法
	getRoomListReq := &pb.GetRoomListRpcRequest{}
	slog.Info("Calling GetRoomListRpc", "player_id", p.Uid)
	resp, err := client.GetRoomListRpc(ctx, getRoomListReq)
	if err != nil {
		slog.Error("获取房间列表RPC调用失败: ", "error", err)
		// 即使RPC调用失败，也应该给客户端发送响应
		p.SendResponse(msg, mustMarshal(&pb.GetRoomListResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	slog.Info("GetRoomListRpc response", "player_id", p.Uid, "ret", resp.GetRet(), "room_count", len(resp.GetRooms()))

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("获取房间列表失败，错误码: ", "error_code", resp.Ret)
	}

	// 返回房间列表给客户端
	p.SendResponse(msg, mustMarshal(&pb.GetRoomListResponse{
		Ret:   resp.Ret,
		Rooms: resp.Rooms,
	}))
}
