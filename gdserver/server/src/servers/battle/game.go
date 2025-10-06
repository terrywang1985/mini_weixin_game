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
	IsGameStarted() bool                         // 获取游戏是否已开始状态
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
	LastPlayed  uint64
	SkipCount   int // 当前轮次跳过的人数
	// 添加房间引用用于广播
	Room RoomInterface
	// 添加倒计时相关字段
	// TurnStartTime time.Time     // 当前回合开始时间
	// TurnTimeout   time.Duration // 回合超时时间（15秒）
}

func (g *WordCardGame) Init(players []*Player) {
	g.Players = players
	g.Deck = loadDeck("../cfg/word_cards.json", 4)

	// g.TurnStartTime = time.Now()
	// g.TurnTimeout = 15 * time.Second

	// 初始化跳过计数
	g.SkipCount = 0
}

func (g *WordCardGame) Start() {
	dealCards(g, 8)
	g.CurrentTurn = rand.Intn(len(g.Players))
	g.SkipCount = 0

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
			// 玩家成功出牌，重置跳过计数
			log.Printf("[Battle] 玩家 %d 出牌成功，重置跳过计数，之前跳过人数: %d", playerID, g.SkipCount)
			g.SkipCount = 0
			g.LastPlayed = player.ID // 记录最后出牌的玩家
			log.Printf("[Battle] 重置后跳过计数: %d，最后出牌玩家: %d", g.SkipCount, g.LastPlayed)
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

		// 检查桌面是否为空 - 如果为空则不允许跳过（因为任何牌都可以出）
		if len(g.Table) == 0 {
			log.Printf("[Battle] Cannot skip when table is empty - any card can be played")
			return pb.ErrorCode_INVALID_ORDER
		}

		// 跳过人数增加
		g.SkipCount++
		log.Printf("[Battle] 玩家 %d 跳过，当前跳过人数: %d，总玩家数: %d", playerID, g.SkipCount, len(g.Players))

		// 跳过回合后，轮到下一个玩家
		g.nextTurn()

		// 检查是否除了最后出牌玩家外所有人都跳过了
		if g.SkipCount >= len(g.Players)-1 {
			log.Printf("[Battle] 跳过人数达到 %d，最后出牌玩家 %d 得分", g.SkipCount, g.LastPlayed)
			g.scoreAndReset()

			// 检查游戏是否因胜利条件而结束
			if g.IsGameOver() {
				log.Printf("[Battle] Game ended after scoring")
				return pb.ErrorCode_OK
			}

			log.Printf("[Battle] Cards redealt, game continues")
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
	// 检查是否有玩家达到胜利分数（20分）
	for _, p := range g.Players {
		if p.Score >= 20 {
			return true
		}
	}

	// 检查是否有玩家手牌为空
	for _, p := range g.Players {
		if len(p.Hand) == 0 {
			return true
		}
	}

	// 只有在游戏已经开始的情况下，才检查人数是否不足
	// 等待房间状态下人数少不应该结束游戏
	if g.Room != nil && g.Room.IsGameStarted() {
		// 游戏进行中，如果人数≤1则结束游戏
		if len(g.Players) <= 1 {
			return true
		}
	}

	return false
}

func (g *WordCardGame) EndGame() {
	log.Printf("[Battle] Game ending, notifying all players")
	
	// 发送游戏结束通知
	if g.Room != nil {
		g.BroadcastGameEnd()
	}
	
	// 游戏结束逻辑，可添加奖励发放等
	log.Printf("[Battle] Game ended successfully")
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
	// if time.Since(g.TurnStartTime) > g.TurnTimeout {
	// 	log.Printf("[Battle] Player turn timeout, skipping turn for player index: %d", g.CurrentTurn)

	// 	// 获取当前玩家
	// 	if len(g.Players) > 0 {
	// 		currentPlayer := g.Players[g.CurrentTurn]

	// 		// 标记当前玩家跳过
	// 		if g.CurrentTurn < len(g.ConsecutivePasses) {
	// 			g.ConsecutivePasses[g.CurrentTurn] = true
	// 		}

	// 		// 跳过回合后，轮到下一个玩家
	// 		g.nextTurn()

	// 		// 检查是否所有玩家都跳过了
	// 		allPassed := true
	// 		for _, passed := range g.ConsecutivePasses {
	// 			if !passed {
	// 				allPassed = false
	// 				break
	// 			}
	// 		}

	// 		if allPassed {
	// 			log.Printf("[Battle] All players passed consecutively, scoring and resetting")
	// 			g.scoreAndReset()
	// 			// 重置跳过状态
	// 			// for i := range g.ConsecutivePasses {
	// 			// 	g.ConsecutivePasses[i] = false
	// 			// }
	// 		}

	// 		// 广播跳过消息
	// 		if g.Room != nil {
	// 			skipAction := &pb.GameAction{
	// 				PlayerId:   currentPlayer.ID,
	// 				ActionType: pb.ActionType_SKIP_TURN,
	// 				Timestamp:  time.Now().UnixMilli(),
	// 			}

	// 			g.Room.BroadcastPlayerAction(skipAction)
	// 		}

	// 		// 广播新的游戏状态
	// 		if g.Room != nil {
	// 			g.Room.BroadcastGameState()
	// 		}

	// 		return true // 发生了超时处理
	// 	}
	// }
	return false // 没有超时
}

// Update 游戏更新方法，处理游戏逻辑更新
func (g *WordCardGame) Update() bool {
	// 检查是否有玩家分数超过20分
	for _, p := range g.Players {
		if p.Score >= 20 {
			log.Printf("[Battle] Player %d has reached 20 points, game over", p.ID)
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

	g.LastPlayed = player.ID
	return true
}

func (g *WordCardGame) scoreAndReset() {
	score := len(g.Table)
	gameEnded := false

	for _, p := range g.Players {
		if p.ID == g.LastPlayed {
			p.Score += score
			log.Printf("[Battle] Player %d scored %d points, total score: %d", p.ID, score, p.Score)

			// 检查是否达到胜利条件（20分）
			if p.Score >= 20 {
				log.Printf("[Battle] Player %d has reached 20 points, game over", p.ID)
				gameEnded = true
			}
		}
	}

	// 如果游戏结束，不重新发牌
	if gameEnded {
		log.Printf("[Battle] Game ended due to victory condition")
		return
	}

	g.Table = []GameCard{}
	g.POSSeq = []string{}
	g.SkipCount = 0 // 重置跳过计数

	// 随机选择下一个起始玩家
	if len(g.Players) > 0 {
		g.CurrentTurn = rand.Intn(len(g.Players))
		// 更新回合开始时间
		// g.TurnStartTime = time.Now() // 重置回合开始时间
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
		// g.TurnStartTime = time.Now()
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

// BroadcastGameEnd 广播游戏结束通知
func (g *WordCardGame) BroadcastGameEnd() {
	if g.Room == nil {
		log.Printf("[Battle] Cannot broadcast game end: Room is nil")
		return
	}

	log.Printf("[Battle] Broadcasting game end notification to all players")

	// 创建游戏结束通知，包含最终玩家状态
	gameEndNotification := &pb.GameEndNotification{
		RoomId: "", // Room ID 将在 Room 层设置
	}

	// 添加所有玩家的最终状态
	for _, p := range g.Players {
		playerState := &pb.BattlePlayer{
			Id:           p.ID,
			Name:         p.Name,
			CurrentScore: int32(p.Score),
			// 可以添加胜利次数等其他信息
		}
		gameEndNotification.Players = append(gameEndNotification.Players, playerState)
	}

	// 通过房间广播游戏结束通知
	if roomInterface, ok := g.Room.(interface{ BroadcastGameEnd(*pb.GameEndNotification) }); ok {
		roomInterface.BroadcastGameEnd(gameEndNotification)
	} else {
		log.Printf("[Battle] Room does not support BroadcastGameEnd method")
	}
}
