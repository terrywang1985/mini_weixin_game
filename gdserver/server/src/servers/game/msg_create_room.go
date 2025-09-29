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

func (p *Player) HandleCreateRoomRequest(msg *pb.Message) {
	slog.Info("HandleCreateRoomRequest called", "player_id", p.Uid, "message_id", msg.GetId())

	var req pb.CreateRoomRequest
	if err := proto.Unmarshal(msg.GetData(), &req); err != nil {
		slog.Error("Failed to parse CreateRoomRequest", "error", err)
		return
	}

	slog.Info("CreateRoomRequest parsed", "player_id", p.Uid, "room_name", req.GetName())

	//创建grp client 并给battleserver阻塞发送,  grpc CreateRoom
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
		// 创建RoomDetail对象
		roomDetail := &pb.RoomDetail{
			Room: &pb.Room{
				Id:   "",
				Name: req.GetName(),
			},
		}
		p.SendResponse(msg, mustMarshal(&pb.CreateRoomResponse{
			Ret:         pb.ErrorCode_SERVER_ERROR,
			RoomDetail: roomDetail,
		}))
		return
	}

	slog.Info("Connected to BattleServer successfully")
	defer conn.Close()

	client := pb.NewRoomRpcServiceClient(conn)

	player := &pb.PlayerInitData{
		PlayerId:   p.Uid,
		PlayerName: p.Name,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	createRoomReq := &pb.CreateRoomRpcRequest{
		Player: player,
	}

	slog.Info("Calling CreateRoomRpc", "player_id", p.Uid)
	resp, err := client.CreateRoomRpc(ctx, createRoomReq)
	if err != nil {
		slog.Error("创建房间RPC调用失败: ", "error", err)
		// 即使RPC调用失败，也应该给客户端发送响应
		p.SendResponse(msg, mustMarshal(&pb.CreateRoomResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
			RoomDetail: &pb.RoomDetail{
				Room: &pb.Room{
					Id:   "",
					Name: req.GetName(),
				},
			},
		}))
		return
	}

	// 修复：使用新的RoomDetail字段访问方式
	roomId := ""
	if resp.GetRoom() != nil && resp.GetRoom().GetRoom() != nil {
		roomId = resp.GetRoom().GetRoom().GetId()
	}

	slog.Info("CreateRoomRpc response", "player_id", p.Uid, "ret", resp.GetRet(), "room_id", roomId)

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("创建房间失败，错误码: ", "error_code", resp.Ret)
	} else {
		// 创建房间成功，设置当前房间ID
		p.CurrentRoomID = roomId
		slog.Info("玩家成功创建房间", "player_id", p.Uid, "room_id", p.CurrentRoomID)
	}

	// 返回响应
	// 直接使用RPC返回的RoomDetail，而不是自己构造
	p.SendResponse(msg, mustMarshal(&pb.CreateRoomResponse{
		Ret:         resp.Ret,
		RoomDetail: resp.GetRoom(), // 直接使用RPC返回的RoomDetail
	}))
}