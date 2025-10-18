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

func (p *Player) HandleMatchRequest(msg *pb.Message) {
	var req pb.MatchRequest
	if err := proto.Unmarshal(msg.GetData(), &req); err != nil {
		slog.Error("Failed to parse MatchRequest", "error", err)
		return
	}

	// 检查玩家是否在房间中
	if p.CurrentRoomID != "" {
		slog.Error("玩家已经在房间中", "player_id", p.Uid)
		p.SendResponse(msg, mustMarshal(&pb.MatchResponse{
			Ret: pb.ErrorCode_PLAYER_ALREADY_IN_ROOM,
		}))
		return
	}

	slog.Info("处理玩家匹配请求", "player_id", p.Uid)

	//创建grp client , 给matchserver 发送匹配请求
	conn, err := grpc.Dial(
		"127.0.0.1:50052",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(2*time.Second),
	)
	if err != nil {
		log.Printf("连接MatchServer失败: %s, 错误: %v", "127.0.0.1:50052", err)
		p.SendResponse(msg, mustMarshal(&pb.MatchResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}
	defer conn.Close()

	client := pb.NewMatchRpcServiceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	//发送grpc
	resp, err := client.StartMatchRpc(ctx, &pb.MatchRpcRequest{
		PlayerId: p.Uid,
	})
	if err != nil {
		slog.Error("StartMatch RPC failed", "error", err)
		p.SendResponse(msg, mustMarshal(&pb.MatchResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}
	if resp == nil {
		slog.Error("StartMatch RPC returned nil response")
		p.SendResponse(msg, mustMarshal(&pb.MatchResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("玩家匹配请求失败，错误码: ", "error_code", resp.Ret)
	}

	// 返回新用户信息
	p.SendResponse(msg, mustMarshal(&pb.MatchResponse{
		Ret: resp.Ret,
	}))
}

func (p *Player) HandleCancelMatchRequest(msg *pb.Message) {
	var req pb.CancelMatchRequest
	if err := proto.Unmarshal(msg.GetData(), &req); err != nil {
		slog.Error("Failed to parse CancelMatchRequest", "error", err)
		return
	}
	slog.Info("处理玩家取消匹配请求", "player_id", p.Uid)

	//创建grp client , 给matchserver 发送取消匹配请求
	conn, err := grpc.Dial(
		"127.0.0.1:50052",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(2*time.Second),
	)
	if err != nil {
		log.Printf("连接MatchServer失败: %s, 错误: %v", "127.0.0.1:50052", err)
		p.SendResponse(msg, mustMarshal(&pb.CancelMatchResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}
	defer conn.Close()

	client := pb.NewMatchRpcServiceClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	//发送grpc
	resp, err := client.CancelMatchRpc(ctx, &pb.CancelMatchRpcRequest{
		PlayerId: p.Uid,
	})
	if err != nil {
		slog.Error("CancelMatch RPC failed", "error", err)
		p.SendResponse(msg, mustMarshal(&pb.CancelMatchResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}
	if resp == nil {
		slog.Error("CancelMatch RPC returned nil response")
		p.SendResponse(msg, mustMarshal(&pb.CancelMatchResponse{
			Ret: pb.ErrorCode_SERVER_ERROR,
		}))
		return
	}

	if resp.Ret != pb.ErrorCode_OK {
		slog.Error("玩家取消匹配请求失败，错误码: ", "error_code", resp.Ret)
	}

	// 返回新用户信息
	p.SendResponse(msg, mustMarshal(&pb.CancelMatchResponse{
		Ret: resp.Ret,
	}))
}
