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

func (p *Player) HandleLeaveRoomRequest(msg *pb.Message) {
	var req pb.LeaveRoomRequest
	if err := proto.Unmarshal(msg.GetData(), &req); err != nil {
		slog.Error("Failed to parse LeaveRoomRequest Request", "error", err)
		return
	}

	slog.Info("HandleLeaveRoomRequest called", "player_id", p.Uid)

	//暂时连接到固定的 BattleServer地址，后续通过redis做服务发现，获得一个空闲的 BattleServer地址
	conn, err := grpc.Dial(
		"127.0.0.1:8693",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(2*time.Second),
	)
	if err != nil {
		log.Printf("连接BattleServer失败: %s, 错误: %v", "127.0.0.1:8693", err)
		// 即使连接失败，也发送响应
		p.SendResponse(msg, mustMarshal(&pb.LeaveRoomResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	defer conn.Close()

	client := pb.NewRoomRpcServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// 创建离开房间请求，传递房间ID和玩家ID
	leaveRoomRpc := &pb.LeaveRoomRpcRequest{
		RoomId:   p.CurrentRoomID, // 传递房间ID
		PlayerId: p.Uid,
	}

	slog.Info("Calling LeaveRoomRpc", "player_id", p.Uid, "room_id", p.CurrentRoomID)

	resp, err := client.LeaveRoomRpc(ctx, leaveRoomRpc)
	if err != nil {
		slog.Error("离开房间RPC调用失败: ", "error", err)
		// 即使RPC失败，也发送响应
		p.SendResponse(msg, mustMarshal(&pb.LeaveRoomResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("离开房间失败，错误码: ", "error_code", resp.Ret)
	} else {
		// 离开房间成功，清空当前房间ID
		oldRoomID := p.CurrentRoomID
		p.CurrentRoomID = ""
		slog.Info("离开房间成功", "player_id", p.Uid, "old_room_id", oldRoomID, "new_room_id", resp.RoomId)
	}

	// 返回响应
	p.SendResponse(msg, mustMarshal(&pb.LeaveRoomResponse{
		Ret: resp.Ret,
	}))
}
