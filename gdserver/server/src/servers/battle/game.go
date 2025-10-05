package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"os"
	pb "proto"
	"time"
)

// RoomInterface 房间接口，用于Game与Room解耦
type RoomInterface interface {
	BroadcastGameState()
	BroadcastPlayerAction(action *pb.GameAction) // 通用的玩家动作广播
}

// GameType 游戏类型枚举
type GameType int

const (
	GameType_WordCardGame GameType = iota + 1
	// 未来可添加其他游戏类型
)

// Game 游戏接口
type Game interface {
	Init(players []*Player)
	Start()
	HandleAction(playerID uint64, action *pb.GameAction) pb.ErrorCode
	GetState() *pb.GameState
	IsGameOver() bool
	EndGame()
	SetRoomRef(room RoomInterface) // 设置房间引用

	Update() bool
	RemovePlayer(playerID uint64) bool
}

// Player 玩家结构体
type Player struct {
	ID    uint64
	Name  string
	Hand  []GameCard
	Score int
	// 位置信息 - 使用int32配合protobuf的CharacterMoveAction
	PositionX int32
	PositionY int32
}

// GameCard 卡牌结构体
type GameCard struct {
	Word string `json:"word"`
	POS  string `json:"pos"`
}

// WordCardGame 实现Game接口
type WordCardGame struct {
	Players     []*Player
	Deck        []GameCard
	Table       []GameCard
	POSSeq      []string
	CurrentTurn int
	LastPlayed  int
	PassCount   int
	// 添加房间引用用于广播
	Room RoomInterface
	// 添加倒计时相关字段
	TurnStartTime time.Time     // 当前回合开始时间
	TurnTimeout   time.Duration // 回合超时时间（15秒）
	// 添加每个玩家的跳过状态跟踪
	ConsecutivePasses []bool // 记录每个玩家是否在当前轮次中跳过
}

func (g *WordCardGame) Init(players []*Player) {
	g.Players = players
	g.Deck = loadDeck("../cfg/word_cards.json", 4)

	g.TurnStartTime = time.Now()
	g.TurnTimeout = 15 * time.Second

	// 初始化每个玩家的跳过状态
	g.ConsecutivePasses = make([]bool, len(players))
}

func (g *WordCardGame) Start() {
	dealCards(g, 8)
	g.CurrentTurn = rand.Intn(len(g.Players))
	g.PassCount = 0

	// 发牌完成后，广播初始游戏状态
	if g.Room != nil {
		g.Room.BroadcastGameState()
	}
}

// SetRoomRef 设置房间引用
func (g *WordCardGame) SetRoomRef(room RoomInterface) {
	g.Room = room
}

func (g *WordCardGame) HandleAction(playerID uint64, action *pb.GameAction) pb.ErrorCode {
	// 添加接收action的日志
	log.Printf("[Battle] HandleAction - PlayerID: %d, ActionType: %v", playerID, action.ActionType)

	player := g.findPlayerByID(playerID)
	if player == nil {
		log.Printf("[Battle] HandleAction - Player not found: %d", playerID)
		return pb.ErrorCode_INVALID_USER
	}

	// 获取当前玩家的索引
	currentPlayerIndex := g.getPlayerIndex(playerID)

	switch action.ActionType {
	case pb.ActionType_PLACE_CARD:
		log.Printf("[Battle] Handling PLACE_CARD action for player %d", playerID)

		// 检查是否轮到该玩家
		if currentPlayerIndex != g.CurrentTurn {
			log.Printf("[Battle] Not player %d's turn (current turn: %d, player index: %d)",
				playerID, g.CurrentTurn, currentPlayerIndex)
			return pb.ErrorCode_NOT_YOUR_TURN
		}

		placeCard := action.GetPlaceCard()
		cardIdx := int(placeCard.CardId)
		targetIndex := int(placeCard.TargetIndex)

		if cardIdx < 0 || cardIdx >= len(player.Hand) {
			log.Printf("[Battle] Invalid card index: %d for player %d", cardIdx, playerID)
			return pb.ErrorCode_INVALID_CARD
		}

		card := player.Hand[cardIdx]
		success := g.playCard(player, card, targetIndex)
		if success {
			// 确保 currentPlayerIndex 在有效范围内
			if currentPlayerIndex >= 0 && currentPlayerIndex < len(g.ConsecutivePasses) {
				// 玩家成功出牌，重置跳过状态
				g.ConsecutivePasses[currentPlayerIndex] = false
			}
			g.LastPlayed = int(player.ID) // 记录最后出牌的玩家
			// 成功出牌后，轮到下一个玩家
			g.nextTurn()
			log.Printf("[Battle] Card placed successfully by player %d, next turn: %d", playerID, g.CurrentTurn)
			return pb.ErrorCode_OK
		}
		log.Printf("[Battle] Failed to place card for player %d", playerID)
		return pb.ErrorCode_INVALID_ORDER
	case pb.ActionType_SKIP_TURN:
		log.Printf("[Battle] Handling SKIP_TURN action for player %d", playerID)

		// 检查是否轮到该玩家
		if currentPlayerIndex != g.CurrentTurn {
			log.Printf("[Battle] Not player %d's turn for skip (current turn: %d, player index: %d)",
				playerID, g.CurrentTurn, currentPlayerIndex)
			return pb.ErrorCode_NOT_YOUR_TURN
		}

		// 确保 currentPlayerIndex 在有效范围内
		if currentPlayerIndex < 0 || currentPlayerIndex >= len(g.ConsecutivePasses) {
			log.Printf("[Battle] Invalid player index %d for ConsecutivePasses array (len=%d)",
				currentPlayerIndex, len(g.ConsecutivePasses))
			return pb.ErrorCode_INVALID_USER
		}

		// 检查桌面是否为空 - 如果为空则不允许跳过（因为任何牌都可以出）
		if len(g.Table) == 0 {
			log.Printf("[Battle] Cannot skip when table is empty - any card can be played")
			return pb.ErrorCode_INVALID_ORDER
		}

		// 标记当前玩家跳过
		g.ConsecutivePasses[currentPlayerIndex] = true

		// 双人游戏特殊逻辑：如果桌面有牌且一人跳过，另一人自动得分并重新发牌
		if len(g.Players) == 2 && len(g.Table) > 0 {
			log.Printf("[Battle] Two-player game: Player %d skipped, last player who played will score", playerID)
			g.scoreAndReset()
			dealCards(g, 8)
			// 重置跳过状态
			for i := range g.ConsecutivePasses {
				g.ConsecutivePasses[i] = false
			}
			log.Printf("[Battle] Two-player game: Cards redealt, game continues")
			return pb.ErrorCode_OK
		}

		// 跳过回合后，轮到下一个玩家
		g.nextTurn()

		// 检查是否所有玩家都跳过了
		allPassed := true
		for _, passed := range g.ConsecutivePasses {
			if !passed {
				allPassed = false
				break
			}
		}

		if allPassed {
			log.Printf("[Battle] All players passed consecutively, scoring and resetting")
			g.scoreAndReset()
			// 重置跳过状态
			for i := range g.ConsecutivePasses {
				g.ConsecutivePasses[i] = false
			}
		}
		log.Printf("[Battle] Player %d skipped turn, next turn: %d", playerID, g.CurrentTurn)
		return pb.ErrorCode_OK
	case pb.ActionType_CHAR_MOVE:
		log.Printf("[Battle] Handling CHAR_MOVE action for player %d", playerID)
		moveAction := action.GetCharMove()
		if moveAction == nil {
			log.Printf("[Battle] CharMove action is nil for player %d", playerID)
			return pb.ErrorCode_INVALID_ACTION
		}

		// 记录位置移动信息
		log.Printf("[Battle] Player %d moved from (%d, %d) to (%d, %d)",
			playerID, moveAction.FromX, moveAction.FromY, moveAction.ToX, moveAction.ToY)

		// 更新玩家在游戏中的位置状态
		if player := g.findPlayerByID(playerID); player != nil {
			player.PositionX = moveAction.ToX
			player.PositionY = moveAction.ToY
			log.Printf("[Battle] Updated player %d position to (%d, %d)", playerID, player.PositionX, player.PositionY)
		}

		// 广播位置更新给其他玩家
		if g.Room != nil {
			g.BroadcastPlayerPositionUpdate(playerID, moveAction)
		}

		return pb.ErrorCode_OK
	case pb.ActionType_SURRENDER:
		log.Printf("[Battle] Handling SURRENDER action for player %d", playerID)

		// 检查是否轮到该玩家
		if currentPlayerIndex != g.CurrentTurn {
			log.Printf("[Battle] Not player %d's turn for surrender (current turn: %d, player index: %d)",
				playerID, g.CurrentTurn, currentPlayerIndex)
			return pb.ErrorCode_NOT_YOUR_TURN
		}

		// 处理投降逻辑
		g.handleSurrender(playerID)

		// 跳过回合后，轮到下一个玩家
		g.nextTurn()
		log.Printf("[Battle] Player %d surrendered, next turn: %d", playerID, g.CurrentTurn)
		return pb.ErrorCode_OK
	default:
		log.Printf("[Battle] Unknown action type: %v for player %d", action.ActionType, playerID)
		return pb.ErrorCode_INVALID_ACTION
	}
}

func (g *WordCardGame) GetState() *pb.GameState {
	state := &pb.GameState{
		CurrentTurn: int32(g.CurrentTurn),
	}

	for _, p := range g.Players {
		playerState := &pb.BattlePlayer{
			Id:           p.ID,
			Name:         p.Name,
			CurrentScore: int32(p.Score),
		}

		// 添加玩家手牌信息
		for _, card := range p.Hand {
			playerState.Cards = append(playerState.Cards, &pb.WordCard{
				Word:      card.Word,
				WordClass: card.POS,
			})
		}

		state.Players = append(state.Players, playerState)
	}

	table := &pb.CardTable{}
	for _, card := range g.Table {
		table.Cards = append(table.Cards, &pb.WordCard{
			Word:      card.Word,
			WordClass: card.POS,
		})
	}
	table.Sentence = tableToString(g.Table)
	state.CardTable = table

	return state
}

func (g *WordCardGame) IsGameOver() bool {
	for _, p := range g.Players {
		if len(p.Hand) == 0 {
			return true
		}
	}
	return false
}

func (g *WordCardGame) EndGame() {
	// 游戏结束逻辑，可添加奖励发放等
}

// BroadcastPlayerPositionUpdate 广播玩家位置更新
func (g *WordCardGame) BroadcastPlayerPositionUpdate(playerID uint64, moveAction *pb.CharacterMoveAction) {
	// 确保moveAction不为nil
	if moveAction == nil {
		log.Printf("[Battle] MoveAction is nil in BroadcastPlayerPositionUpdate")
		return
	}

	if g.Room == nil {
		log.Printf("[Battle] Cannot broadcast position update: Room is nil")
		return
	}

	log.Printf("[Battle] Broadcasting position update for player %d to all other players", playerID)

	// 创建位置更新的 GameAction
	positionUpdate := &pb.GameAction{
		PlayerId:   playerID,
		ActionType: pb.ActionType_CHAR_MOVE,
		Timestamp:  time.Now().UnixMilli(),
		ActionDetail: &pb.GameAction_CharMove{
			CharMove: moveAction,
		},
	}

	// 通过房间广播给所有玩家
	g.Room.BroadcastPlayerAction(positionUpdate)
}

// RemovePlayer 从游戏中移除指定玩家
func (g *WordCardGame) RemovePlayer(playerID uint64) bool {
	playerIndex := g.getPlayerIndex(playerID)
	if playerIndex == -1 {
		return false // 玩家不在游戏中
	}

	// 从玩家列表中移除
	g.Players = append(g.Players[:playerIndex], g.Players[playerIndex+1:]...)

	// 同时调整 ConsecutivePasses 数组
	if playerIndex < len(g.ConsecutivePasses) {
		g.ConsecutivePasses = append(g.ConsecutivePasses[:playerIndex], g.ConsecutivePasses[playerIndex+1:]...)
	}

	// 如果移除的是当前回合玩家或之前的玩家，需要调整当前回合索引
	if playerIndex < g.CurrentTurn {
		g.CurrentTurn--
	} else if playerIndex == g.CurrentTurn {
		// 如果移除的是当前回合玩家，轮到下一个玩家
		if len(g.Players) > 0 {
			g.CurrentTurn = g.CurrentTurn % len(g.Players)
		} else {
			g.CurrentTurn = 0
		}
	}

	// 调整CurrentTurn确保不会超出范围
	if len(g.Players) > 0 {
		g.CurrentTurn = g.CurrentTurn % len(g.Players)
	} else {
		g.CurrentTurn = 0
	}

	log.Printf("[Battle] Player %d removed from game, players left: %d, current turn: %d",
		playerID, len(g.Players), g.CurrentTurn)

	return true
}

// CheckTurnTimeout 检查并处理回合超时
func (g *WordCardGame) CheckTurnTimeout() bool {
	// 检查是否超时（15秒）
	if time.Since(g.TurnStartTime) > g.TurnTimeout {
		log.Printf("[Battle] Player turn timeout, skipping turn for player index: %d", g.CurrentTurn)

		// 获取当前玩家
		if len(g.Players) > 0 {
			currentPlayer := g.Players[g.CurrentTurn]

			// 标记当前玩家跳过
			if g.CurrentTurn < len(g.ConsecutivePasses) {
				g.ConsecutivePasses[g.CurrentTurn] = true
			}

			// 跳过回合后，轮到下一个玩家
			g.nextTurn()

			// 检查是否所有玩家都跳过了
			allPassed := true
			for _, passed := range g.ConsecutivePasses {
				if !passed {
					allPassed = false
					break
				}
			}

			if allPassed {
				log.Printf("[Battle] All players passed consecutively, scoring and resetting")
				g.scoreAndReset()
				// 重置跳过状态
				for i := range g.ConsecutivePasses {
					g.ConsecutivePasses[i] = false
				}
			}

			// 广播跳过消息
			if g.Room != nil {
				skipAction := &pb.GameAction{
					PlayerId:   currentPlayer.ID,
					ActionType: pb.ActionType_SKIP_TURN,
					Timestamp:  time.Now().UnixMilli(),
				}

				g.Room.BroadcastPlayerAction(skipAction)
			}

			// 广播新的游戏状态
			if g.Room != nil {
				g.Room.BroadcastGameState()
			}

			return true // 发生了超时处理
		}
	}
	return false // 没有超时
}

// Update 游戏更新方法，处理游戏逻辑更新
func (g *WordCardGame) Update() bool {
	// 检查是否有玩家分数超过30分
	for _, p := range g.Players {
		if p.Score >= 30 {
			log.Printf("[Battle] Player %d has reached 30 points, game over", p.ID)
			return false // 游戏结束
		}
	}

	// 检查游戏是否结束（手牌为空）
	if g.IsGameOver() {
		return false // 游戏结束
	}

	// 检查回合是否超时
	g.CheckTurnTimeout()

	return true // 正常运行
}

// 内部辅助方法
func (g *WordCardGame) findPlayerByID(playerID uint64) *Player {
	for _, p := range g.Players {
		if p.ID == playerID {
			return p
		}
	}
	return nil
}

func (g *WordCardGame) playCard(player *Player, card GameCard, position int) bool {
	if !canInsert(g.POSSeq, card.POS, position) {
		return false
	}

	// 从玩家手牌移除
	for i, c := range player.Hand {
		if c.Word == card.Word && c.POS == card.POS {
			player.Hand = append(player.Hand[:i], player.Hand[i+1:]...)
			break
		}
	}

	// 添加到桌面（在指定位置插入）
	if position >= len(g.Table) {
		// 如果位置超出当前长度，添加到末尾
		g.Table = append(g.Table, card)
		g.POSSeq = append(g.POSSeq, card.POS)
	} else {
		// 在指定位置插入
		g.Table = append(g.Table[:position], append([]GameCard{card}, g.Table[position:]...)...)
		g.POSSeq = append(g.POSSeq[:position], append([]string{card.POS}, g.POSSeq[position:]...)...)
	}

	g.LastPlayed = int(player.ID)
	return true
}

func (g *WordCardGame) scoreAndReset() {
	score := len(g.Table)
	for _, p := range g.Players {
		if uint64(p.ID) == uint64(g.LastPlayed) {
			p.Score += score
			log.Printf("[Battle] Player %d scored %d points, total score: %d", p.ID, score, p.Score)
		}
	}
	g.Table = []GameCard{}
	g.POSSeq = []string{}

	// 随机选择下一个起始玩家
	if len(g.Players) > 0 {
		g.CurrentTurn = rand.Intn(len(g.Players))
		g.TurnStartTime = time.Now() // 重置回合开始时间
	}

	dealCards(g, 8)

	log.Printf("[Battle] Game reset, new starting player: %d", g.CurrentTurn)
}

// 游戏通用函数
func loadDeck(filename string, copies int) []GameCard {
	data, err := os.ReadFile(filename)
	if err != nil {
		panic(err)
	}
	var base []GameCard
	if err := json.Unmarshal(data, &base); err != nil {
		panic(err)
	}
	deck := []GameCard{}
	for _, c := range base {
		for i := 0; i < copies; i++ {
			deck = append(deck, c)
		}
	}
	rand.Shuffle(len(deck), func(i, j int) { deck[i], deck[j] = deck[j], deck[i] })
	return deck
}

func dealCards(g *WordCardGame, handSize int) {
	// 清空所有玩家手牌，重新发牌
	for _, player := range g.Players {
		player.Hand = []GameCard{} // 清空手牌
	}
	for i := 0; i < handSize; i++ {
		for _, p := range g.Players {
			if len(g.Deck) > 0 {
				p.Hand = append(p.Hand, g.Deck[0])
				g.Deck = g.Deck[1:]
			}
		}
	}
}

func tableToString(table []GameCard) string {
	s := ""
	for _, c := range table {
		s += c.Word
	}
	return s
}

func canInsert(seq []string, posType string, index int) bool {
	allowedNext := map[string][]string{
		"Adv-TIME-DATE":    {"Adv-TIME-PART", "Adv-LOC", "Adj", "NP-HUMAN-PRONOUN", "NP-HUMAN-KINSHIP", "NP-HUMAN-NAME", "Adv-MANNER", "V-EVENT"},
		"Adv-TIME-PART":    {"Adv-LOC", "Adj", "NP-HUMAN-PRONOUN", "NP-HUMAN-KINSHIP", "NP-HUMAN-NAME", "Adv-MANNER", "V-EVENT"},
		"Adv-LOC":          {"Adv-MANNER", "V-EVENT"},
		"Adj":              {"Adj", "NP-HUMAN-PRONOUN", "NP-HUMAN-KINSHIP", "NP-HUMAN-NAME"},
		"NP-HUMAN-PRONOUN": {"NP-HUMAN-KINSHIP", "Adv-MANNER", "V-EVENT", "Adv-LOC"},
		"NP-HUMAN-KINSHIP": {"Adv-MANNER", "V-EVENT", "Adv-LOC"},
		"NP-HUMAN-NAME":    {"Adv-MANNER", "V-EVENT", "Adv-LOC"},
		"V-EVENT":          {},
		"Adv-MANNER":       {"V-EVENT"},
	}

	if len(seq) == 0 {
		return true
	}
	if index == 0 {
		return contains(allowedNext[posType], seq[0])
	}
	if index == len(seq) {
		return contains(allowedNext[seq[len(seq)-1]], posType)
	}
	return contains(allowedNext[seq[index-1]], posType) &&
		contains(allowedNext[posType], seq[index])
}

func contains(arr []string, target string) bool {
	for _, v := range arr {
		if v == target {
			return true
		}
	}
	return false
}

// GameFactory 游戏工厂
func GameFactory(gameType GameType) Game {
	switch gameType {
	case GameType_WordCardGame:
		return &WordCardGame{}
	default:
		return nil
	}
}

// getPlayerIndex 获取玩家在游戏中的索引位置
func (g *WordCardGame) getPlayerIndex(playerID uint64) int {
	for i, player := range g.Players {
		if player.ID == playerID {
			return i
		}
	}
	return -1
}

// nextTurn 切换到下一个玩家的回合
func (g *WordCardGame) nextTurn() {
	if len(g.Players) > 0 {
		g.CurrentTurn = (g.CurrentTurn + 1) % len(g.Players)
		// 更新回合开始时间
		g.TurnStartTime = time.Now()
	} else {
		g.CurrentTurn = 0
	}
}

// handleSurrender 处理玩家投降逻辑
func (g *WordCardGame) handleSurrender(playerID uint64) {
	log.Printf("[Battle] Player %d surrendered", playerID)

	// 广播玩家投降的消息给所有玩家
	if g.Room != nil {
		surrenderAction := &pb.GameAction{
			PlayerId:   playerID,
			ActionType: pb.ActionType_SURRENDER,
			Timestamp:  time.Now().UnixMilli(),
		}

		g.Room.BroadcastPlayerAction(surrenderAction)
	}

	// 标记该玩家已投降，将其从游戏中移除
	g.RemovePlayer(playerID)
}
