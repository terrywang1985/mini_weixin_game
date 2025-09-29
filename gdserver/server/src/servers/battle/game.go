package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"os"
	pb "proto"
)

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
	HandleAction(playerID uint64, action *pb.GameAction) bool
	GetState() *pb.GameState
	IsGameOver() bool
	EndGame()
}

// Player 玩家结构体
type Player struct {
	ID       uint64
	Name     string
	Hand     []GameCard
	Score    int
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
	Room        *BattleRoom
}

func (g *WordCardGame) Init(players []*Player) {
	g.Players = players
	g.Deck = loadDeck("../cfg/word_cards.json", 4)
}

func (g *WordCardGame) Start() {
	dealCards(g, 8)
	g.CurrentTurn = rand.Intn(len(g.Players))
	g.PassCount = 0
}

func (g *WordCardGame) HandleAction(playerID uint64, action *pb.GameAction) bool {
	// 添加接收action的日志
	log.Printf("[Battle] HandleAction - PlayerID: %d, ActionType: %v", playerID, action.ActionType)
	
	player := g.findPlayerByID(playerID)
	if player == nil {
		log.Printf("[Battle] HandleAction - Player not found: %d", playerID)
		return false
	}

	switch action.ActionType {
	case pb.ActionType_PLACE_CARD:
		log.Printf("[Battle] Handling PLACE_CARD action for player %d", playerID)
		placeCard := action.GetPlaceCard()
		cardIdx := int(placeCard.CardId)
		if cardIdx < 0 || cardIdx >= len(player.Hand) {
			log.Printf("[Battle] Invalid card index: %d for player %d", cardIdx, playerID)
			return false
		}
		card := player.Hand[cardIdx]
		success := g.playCard(player, card, int(placeCard.TargetIndex))
		if success {
			g.PassCount = 0
			log.Printf("[Battle] Card placed successfully by player %d", playerID)
			return true
		}
		log.Printf("[Battle] Failed to place card for player %d", playerID)
	case pb.ActionType_SKIP_TURN:
		log.Printf("[Battle] Handling SKIP_TURN action for player %d", playerID)
		g.PassCount++
		if g.PassCount >= len(g.Players) {
			log.Printf("[Battle] All players passed, scoring and resetting")
			g.scoreAndReset()
			g.PassCount = 0
		}
		return true
	case pb.ActionType_CHAR_MOVE:
		log.Printf("[Battle] Handling CHAR_MOVE action for player %d", playerID)
		moveAction := action.GetCharMove()
		if moveAction == nil {
			log.Printf("[Battle] CharMove action is nil for player %d", playerID)
			return false
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
		
		return true
	default:
		log.Printf("[Battle] Unknown action type: %v for player %d", action.ActionType, playerID)
	}
	return false
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
	if g.Room == nil {
		log.Printf("[Battle] Cannot broadcast position update: Room is nil")
		return
	}
	
	log.Printf("[Battle] Broadcasting position update for player %d to all other players", playerID)
	
	// 通过房间广播给所有玩家（包括自己）
	g.Room.BroadcastPlayerPosition(playerID, moveAction)
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

	// 添加到桌面
	g.Table = append(g.Table[:position], append([]GameCard{card}, g.Table[position:]...)...)
	g.POSSeq = append(g.POSSeq[:position], append([]string{card.POS}, g.POSSeq[position:]...)...)
	g.LastPlayed = int(player.ID)
	return true
}

func (g *WordCardGame) scoreAndReset() {
	score := len(g.Table)
	for _, p := range g.Players {
		if uint64(p.ID) == uint64(g.LastPlayed) {
			p.Score += score
		}
	}
	g.Table = []GameCard{}
	g.POSSeq = []string{}
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
