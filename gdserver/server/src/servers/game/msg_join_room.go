package main

import (
	"context"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"
	"log"
	"log/slog"
	pb "proto"
	"time"
)

func (p *Player) HandleJoinRoomRequest(msg *pb.Message) {
	var req pb.JoinRoomRequest
	if err := proto.Unmarshal(msg.GetData(), &req); err != nil {
		slog.Error("Failed to parse JoinRoomRequest Request", "error", err)
		return
	}

	conn, err := grpc.Dial(
		"127.0.0.1:8693",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(2*time.Second),
	)
	if err != nil {
		log.Printf("连接BattleServer失败: %s, 错误: %v", "127.0.0.1:8693", err)
		return
	}

	defer conn.Close()

	client := pb.NewRoomRpcServiceClient(conn)

	playerInitData := &pb.PlayerInitData{
		PlayerId:   p.Uid,
		PlayerName: p.Name,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	joinRoomRpc := &pb.JoinRoomRpcRequest{
		RoomId: req.RoomId,
		Player: playerInitData,
	}

	resp, err := client.JoinRoomRpc(ctx, joinRoomRpc)
	if err != nil {
		slog.Error("加入房间RPC调用失败: ", "error", err)
		p.SendResponse(msg, mustMarshal(&pb.JoinRoomResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	// 修复：使用新的RoomDetail字段访问方式
	roomId := ""
	if resp.GetRoom() != nil && resp.GetRoom().GetRoom() != nil {
		roomId = resp.GetRoom().GetRoom().GetId()
	}

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("加入房间失败，错误码: ", "error_code", resp.Ret)
	} else {
		// 加入房间成功，设置当前房间ID
		p.CurrentRoomID = roomId
		slog.Info("玩家成功加入房间", "player_id", p.Uid, "room_id", p.CurrentRoomID)
	}

	// 返回响应
	// 直接使用RPC返回的RoomDetail，而不是自己构造
	p.SendResponse(msg, mustMarshal(&pb.JoinRoomResponse{
		Ret:         resp.Ret,
		RoomDetail: resp.GetRoom(), // 直接使用RPC返回的RoomDetail
	}))
}