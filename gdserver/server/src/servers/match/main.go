package main

import (
	"common/redisutil"
	"fmt"
	"log/slog"
	"net"
	"os"
	"os/signal"
	"syscall"

	pb "proto"

	"google.golang.org/grpc"
)

// 全局变量
var (
	GlobalRedis *redisutil.RedisPool
)

func main() {
	// 初始化日志
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	slog.SetDefault(logger)

	// 初始化Redis连接池
	redisConfig := redisutil.LoadRedisConfigFromEnv()
	GlobalRedis = redisutil.NewRedisPoolFromConfig(redisConfig)

	// 测试Redis连接
	if err := testRedisConnection(); err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}

	matchServer := NewOptimizedMatchServer()

	// 启动gRPC服务器
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		slog.Error("failed to listen", "error", err)
		os.Exit(1)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterMatchServiceServer(grpcServer, matchServer)

	// 优雅退出
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-sigCh
		slog.Info("received signal, shutting down", "signal", sig)
		grpcServer.GracefulStop()
	}()

	slog.Info("MatchServer started", "port", 50052)
	if err := grpcServer.Serve(lis); err != nil {
		slog.Error("failed to serve", "error", err)
		os.Exit(1)
	}
}

// 测试Redis连接
func testRedisConnection() error {
	// 使用Exists命令测试连接
	_, err := GlobalRedis.Exists("test_connection")
	if err != nil {
		return fmt.Errorf("redis connection failed: %v", err)
	}
	return nil
}
