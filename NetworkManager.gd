extends Node

# 预加载生成的 protobuf 文件
const GameProto = preload("res://proto/game_proto.gd")

# HTTP 和 WebSocket 连接管理器
signal http_login_success(token)
signal http_login_failed(error_msg)
signal connected
signal disconnected
signal auth_success(user_info)
signal auth_failed(error_msg)
signal room_list_received(rooms)
signal room_created(room)
signal room_joined
signal room_state_updated(room_state)

var websocket: WebSocketPeer
var http_request: HTTPRequest
var is_connected: bool = false
var client_id: String = ""
var message_serial_no: int = 0
var session_token: String = ""
var gateway_url: String = ""

# 服务器配置
var login_url: String = "http://localhost:8081/login"
var websocket_url: String = ""  # 将从 gateway_url 动态生成

# 用户信息
# 消息缓冲区
var message_buffer: PackedByteArray = PackedByteArray()

# 用户信息
var user_uid: int = 0
var user_nickname: String = ""
var current_room_id: String = ""

# 位置同步相关
var last_sent_position: Vector2 = Vector2.ZERO

func _ready():
	websocket = WebSocketPeer.new()
	# 创建HTTP请求节点
	http_request = HTTPRequest.new()
	add_child(http_request)
	http_request.request_completed.connect(_on_http_login_completed)

func _process(_delta):
	if websocket:
		websocket.poll()
		
		var state = websocket.get_ready_state()
		if state == WebSocketPeer.STATE_OPEN:
			if not is_connected:
				is_connected = true
				connected.emit()
				print("WebSocket 连接成功")
			
			# 处理接收到的消息
			while websocket.get_available_packet_count():
				var packet = websocket.get_packet()
				message_buffer.append_array(packet)
				
				# 处理缓冲区中的完整消息
				process_message_buffer()
				
		elif state == WebSocketPeer.STATE_CLOSED:
			if is_connected:
				is_connected = false
				disconnected.emit()
				print("WebSocket 连接断开")

# HTTP游客登录
func guest_login(test_suffix: String = ""):
	print("开始HTTP游客登录...")
	
	# 准备登录数据，支持测试账号后缀
	var base_device_id = "godoroom_" + OS.get_unique_id()
	var device_id = base_device_id
	
	# 如果有测试后缀，加到device_id后面
	if test_suffix.length() > 0:
		device_id = base_device_id + "_test_" + test_suffix
		print("使用测试账号后缀: ", test_suffix)
		print("生成测试设备ID: ", device_id)
	
	var login_data = {
		"device_id": device_id,
		"app_id": "desktop_app",
		"is_guest": true
	}
	
	var json_string = JSON.stringify(login_data)
	var headers = ["Content-Type: application/json"]
	
	print("请求数据: ", json_string)
	print("正在连接登录服务器: ", login_url)
	
	# 发送HTTP请求
	var error = http_request.request(login_url, headers, HTTPClient.METHOD_POST, json_string)
	if error != OK:
		print("HTTP请求失败: ", error)
		http_login_failed.emit("HTTP请求失败: " + str(error))
		return false
	return true

func _on_http_login_completed(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
	print("HTTP响应状态码: ", response_code)
	var response_text = body.get_string_from_utf8()
	print("响应内容: ", response_text)
	
	if response_code == 200:
		var json = JSON.new()
		var parse_result = json.parse(response_text)
		if parse_result == OK:
			var response_data = json.data
			if response_data.get("success", false):
				session_token = response_data.get("session_id", "")
				var username = response_data.get("username", "")
				gateway_url = response_data.get("gateway_url", "")
				print("HTTP游客登录成功！用户名: ", username)
				print("获得令牌: ", session_token)
				print("获得Gateway地址: ", gateway_url)
				
				# 动态配置WebSocket地址
				if gateway_url != "":
					# 将gateway地址转换为WebSocket地址
					if gateway_url.begins_with("ws://") or gateway_url.begins_with("wss://"):
						websocket_url = gateway_url
					else:
						# 如果不是WebSocket格式，则构造WebSocket URL
						if ":" in gateway_url:
							var parts = gateway_url.split(":")
							websocket_url = "ws://" + parts[0] + ":18080/ws"
						else:
							websocket_url = "ws://" + gateway_url + ":18080/ws"
				else:
					# 如果没有gateway_url，使用默认地址
					websocket_url = "ws://127.0.0.1:18080/ws"
					
				print("使用WebSocket地址: ", websocket_url)
				http_login_success.emit(session_token)
				# 继续连接WebSocket
				connect_to_websocket()
			else:
				var error_msg = response_data.get("error", "游客登录失败")
				print("登录失败: ", error_msg)
				http_login_failed.emit(error_msg)
		else:
			print("解析响应JSON失败")
			http_login_failed.emit("解析响应JSON失败")
	else:
		print("HTTP请求失败，状态码: ", response_code)
		http_login_failed.emit("HTTP请求失败，状态码: " + str(response_code))

func connect_to_websocket():
	print("正在连接WebSocket服务器: ", websocket_url)
	var error = websocket.connect_to_url(websocket_url)
	if error != OK:
		print("WebSocket连接失败: ", error)
		return false
	return true

func disconnect_from_server():
	if websocket:
		websocket.close()
	is_connected = false

func process_message_buffer():
	while message_buffer.size() >= 4:
		# 读取消息长度（小端序）
		var length = message_buffer[0] | \
		            (message_buffer[1] << 8) | \
		            (message_buffer[2] << 16) | \
		            (message_buffer[3] << 24)
		
		# 检查是否有完整消息
		if message_buffer.size() < 4 + length:
			break
		
		# 提取消息数据
		var message_data = message_buffer.slice(4, 4 + length)
		message_buffer = message_buffer.slice(4 + length)
		
		# 解析消息
		_handle_message(message_data)

func _handle_message(data: PackedByteArray):
	# 使用真正的 Protobuf 消息处理
	print("收到 Protobuf 消息，字节长度: ", data.size())
	
	# 反序列化 Message 包装器
	var message = GameProto.Message.new()
	var parse_result = message.from_bytes(data)
	
	if parse_result != GameProto.PB_ERR.NO_ERRORS:
		print("Protobuf 消息解析失败，错误代码: ", parse_result)
		return
	
	var msg_id = message.get_id()
	var msg_data = message.get_data()  # 这是嵌套的消息数据
	var client_id = message.get_clientId()
	var serial_no = message.get_msgSerialNo()
	
	print("Protobuf 消息解析成功 - ID: ", msg_id, ", Serial: ", serial_no)
	
	# 根据消息ID处理具体的消息类型
	match msg_id:
		3:  # AUTH_RESPONSE
			_handle_auth_response_protobuf(msg_data)
		7:  # GET_ROOM_LIST_RESPONSE
			_handle_room_list_response_protobuf(msg_data)
		9:  # CREATE_ROOM_RESPONSE
			_handle_create_room_response_protobuf(msg_data)
		11: # JOIN_ROOM_RESPONSE
			_handle_join_room_response_protobuf(msg_data)
		13: # LEAVE_ROOM_RESPONSE
			_handle_leave_room_response_protobuf(msg_data)
		14: # ROOM_STATE_NOTIFICATION
			_handle_room_state_notification_protobuf(msg_data)
		15: # GAME_STATE_NOTIFICATION
			_handle_game_state_notification_protobuf(msg_data)
		19: # GET_READY_RESPONSE
			_handle_get_ready_response_protobuf(msg_data)
		21: # GAME_ACTION_RESPONSE
			_handle_game_action_response_protobuf(msg_data)
		22: # GAME_ACTION_NOTIFICATION
			_handle_game_action_notification_protobuf(msg_data)
		23: # GAME_START_NOTIFICATION
			_handle_game_start_notification_protobuf(msg_data)
		_:
			print("未知的消息ID: ", msg_id)

func _handle_auth_response_protobuf(data: PackedByteArray):
	var response = GameProto.AuthResponse.new()
	var parse_result = response.from_bytes(data)
	
	if parse_result != GameProto.PB_ERR.NO_ERRORS:
		print("AuthResponse 解析失败: ", parse_result)
		return
	
	var ret = response.get_ret()
	if ret == 0:  # ErrorCode.OK
		user_uid = response.get_uid()
		user_nickname = response.get_nickname()
		client_id = response.get_conn_id()
		
		auth_success.emit({
			"uid": user_uid,
			"nickname": user_nickname,
			"is_guest": response.get_is_guest()
		})
		print("登录成功: ", user_nickname)
	else:
		var error_msg = response.get_error_msg()
		auth_failed.emit(error_msg)
		print("登录失败: ", error_msg)

func _handle_room_list_response_protobuf(data: PackedByteArray):
	var response = GameProto.GetRoomListResponse.new()
	var parse_result = response.from_bytes(data)
	
	if parse_result != GameProto.PB_ERR.NO_ERRORS:
		print("GetRoomListResponse 解析失败: ", parse_result)
		return
	
	var ret = response.get_ret()
	if ret == 0:  # ErrorCode.OK
		var rooms = []
		var rooms_array = response.get_rooms()
		for room_proto in rooms_array:
			var room = {
				"id": room_proto.get_id(),
				"name": room_proto.get_name(),
				"max_players": room_proto.get_max_players(),
				"current_players": room_proto.get_current_players()
			}
			rooms.append(room)
		room_list_received.emit(rooms)
		print("收到房间列表，共 ", rooms.size(), " 个房间")
	else:
		print("获取房间列表失败")

func _handle_create_room_response_protobuf(data: PackedByteArray):
	var response = GameProto.CreateRoomResponse.new()
	var parse_result = response.from_bytes(data)
	
	if parse_result != GameProto.PB_ERR.NO_ERRORS:
		print("CreateRoomResponse 解析失败: ", parse_result)
		return
	
	var ret = response.get_ret()
	if ret == 0:  # ErrorCode.OK
		# 修改：使用新的room_detail字段而不是room字段
		var room_detail = response.get_room_detail()
		var room_proto = room_detail.get_room()
		var room = {
			"id": room_proto.get_id(),
			"name": room_proto.get_name(),
			"max_players": room_proto.get_max_players(),
			"current_players": room_proto.get_current_players()
		}
		current_room_id = room["id"]
		room_created.emit(room)
		print("房间创建成功: ", room["name"])
		
		# 处理房间内的玩家列表（包括位置信息）
		var players = []
		for player_proto in room_detail.get_current_players():
			var player = {
				"uid": player_proto.get_uid(),
				"name": player_proto.get_name(),
				"position_x": player_proto.get_position_x(),
				"position_y": player_proto.get_position_y()
			}
			players.append(player)
		print("房间内玩家列表: ", players)
	else:
		print("创建房间失败")

func _handle_join_room_response_protobuf(data: PackedByteArray):
	var response = GameProto.JoinRoomResponse.new()
	var parse_result = response.from_bytes(data)
	
	if parse_result != GameProto.PB_ERR.NO_ERRORS:
		print("JoinRoomResponse 解析失败: ", parse_result)
		return
	
	var ret = response.get_ret()
	if ret == 0:  # ErrorCode.OK
		# 修改：使用新的room_detail字段而不是room字段
		var room_detail = response.get_room_detail()
		var room_proto = room_detail.get_room()
		current_room_id = room_proto.get_id()
		
		# 处理房间内的玩家列表（包括位置信息）
		var players = []
		for player_proto in room_detail.get_current_players():
			var player = {
				"uid": player_proto.get_uid(),
				"name": player_proto.get_name(),
				"position_x": player_proto.get_position_x(),
				"position_y": player_proto.get_position_y()
			}
			players.append(player)
		print("加入房间成功，房间内玩家列表: ", players)
		
		room_joined.emit()
		print("加入房间成功")
	else:
		print("加入房间失败")

func _handle_leave_room_response_protobuf(data: PackedByteArray):
	var response = GameProto.LeaveRoomResponse.new()
	var parse_result = response.from_bytes(data)
	
	if parse_result != GameProto.PB_ERR.NO_ERRORS:
		print("LeaveRoomResponse 解析失败: ", parse_result)
		return
	
	var ret = response.get_ret()
	if ret == 0:  # ErrorCode.OK
		print("离开房间成功")
		current_room_id = ""
	else:
		print("离开房间失败")

func _handle_room_state_notification_protobuf(data: PackedByteArray):
	# 解析房间状态通知
	# 这里需要解析 RoomDetailNotify 消息
	# 由于Godot的protobuf实现可能不支持嵌套的service消息，我们简化处理
	# 假设服务器直接发送RoomDetail数据
	var room_detail = GameProto.RoomDetail.new()
	var result = room_detail.from_bytes(data)
	
	if result == GameProto.PB_ERR.NO_ERRORS:
		var room_info = {
			"room": {
				"id": room_detail.get_room().get_id(),
				"name": room_detail.get_room().get_name(),
				"max_players": room_detail.get_room().get_max_players(),
				"current_players": room_detail.get_room().get_current_players()
			},
			"players": []
		}
		
		# 解析当前玩家列表
		for player in room_detail.get_current_players():
			room_info["players"].append({
				"uid": player.get_uid(),
				"name": player.get_name()
			})
		
		print("收到房间状态通知: 房间ID=", room_info.room.id, ", 玩家数量=", room_info.players.size())
		
		# 发出信号通知游戏房间更新玩家列表
		room_state_updated.emit(room_info)
	else:
		print("解析房间状态通知失败: ", result)

func _handle_game_state_notification_protobuf(data: PackedByteArray):
	# 对于 GAME_STATE_NOTIFICATION，可能需要使用具体的通知类型
	# 这里暂时使用简化处理
	print("收到游戏状态通知")
	# TODO: 实现具体的 GAME_STATE_NOTIFICATION 反序列化

# 新增：处理准备响应
func _handle_get_ready_response_protobuf(data: PackedByteArray):
	var response = GameProto.GetReadyResponse.new()
	var result = response.from_bytes(data)
	
	if result == GameProto.PB_ERR.NO_ERRORS:
		var ret = response.get_ret()
		if ret == 0:  # ErrorCode.OK
			print("准备成功")
		else:
			print("准备失败: 错误码 ", ret)
	else:
		print("解析GetReadyResponse失败: ", result)

# 新增：处理游戏开始通知
func _handle_game_start_notification_protobuf(data: PackedByteArray):
	var game_start_notify = GameProto.GameStartNotification.new()
	var result = game_start_notify.from_bytes(data)
	
	if result == GameProto.PB_ERR.NO_ERRORS:
		var room_id = game_start_notify.get_room_id()
		var players = game_start_notify.get_players()
		
		print("收到游戏开始通知: 房间ID=", room_id, ", 玩家数量=", players.size())
		
		# 跳转到卡牌游戏场景
		print("切换到卡牌游戏场景")
		get_tree().change_scene_to_file("res://scenes/CardGameRoom.tscn")
	else:
		print("解析GameStartNotification失败: ", result)

func _handle_game_action_response_protobuf(data: PackedByteArray):
	# 处理游戏动作响应
	var response = GameProto.GameActionResponse.new()
	var result = response.from_bytes(data)
	
	if result == GameProto.PB_ERR.NO_ERRORS:
		var ret = response.get_ret()
		if ret == 0:  # ErrorCode.OK
			print("游戏动作执行成功")
		else:
			# 根据ErrorCode定义输出错误信息
			match ret:
				12:  # INVALID_ROOM
					print("=== 游戏动作失败: INVALID_ROOM ===")
					print("当前房间ID: ", current_room_id)
					print("当前用户ID: ", user_uid)
					print("可能原因:")
					print("1. GameServer未正确传递room_id给BattleServer")
					print("2. 玩家不在正确的游戏房间状态")
					print("3. BattleServer中没有对应的房间")
					print("===============================")
				10: # INVALID_ACTION
					print("游戏动作失败: 无效的动作")
				_:
					print("游戏动作失败: 错误码 ", ret)
	else:
		print("解析GameActionResponse失败: ", result)

func _handle_game_action_notification_protobuf(data: PackedByteArray):
	# 处理游戏动作通知（包括位置更新）
	var action_notify = GameProto.PlayerActionNotify.new()
	var result = action_notify.from_bytes(data)
	
	if result == GameProto.PB_ERR.NO_ERRORS:
		var player_id = action_notify.get_player_id()
		var action = action_notify.get_action()
		
		# 检查是否是角色移动动作（action_type = 5）
		if action.get_action_type() == 5 and action.has_char_move():
			var char_move = action.get_char_move()
			var from_pos = Vector2(char_move.get_from_x(), char_move.get_from_y())
			var to_pos = Vector2(char_move.get_to_x(), char_move.get_to_y())
			
			print("收到玩家移动：ID=", player_id, "，从 ", from_pos, " 移动到 ", to_pos)
			
			# 更新GameState中的玩家位置
			GameStateManager.update_player_position(player_id, to_pos)
		# 检查是否是旧的位置更新动作（兼容性）
		elif action.get_action_type() == 3 and action.has_place_card():
			var place_card = action.get_place_card()
			var position_x = place_card.get_card_id()  # x坐标
			var position_y = place_card.get_target_index()  # y坐标
			var position = Vector2(position_x, position_y)
			
			print("收到旧版玩家位置更新：ID=", player_id, "，位置=", position)
			
			# 更新GameState中的玩家位置
			GameStateManager.update_player_position(player_id, position)
		else:
			print("收到其他游戏动作：类型=", action.get_action_type())
	else:
		print("解析PlayerActionNotify失败: ", result)

func send_message(msg_id: int, data_bytes: PackedByteArray):
	if not is_connected:
		print("未连接到服务器")
		return false
	
	message_serial_no += 1
	
	# 创建 Protobuf Message 包装器
	var message = GameProto.Message.new()
	message.set_clientId(client_id)
	message.set_msgSerialNo(message_serial_no)
	message.set_id(msg_id)
	message.set_data(data_bytes)
	
	# 序列化为字节数组
	var message_bytes = message.to_bytes()
	
	# 添加4字节长度头（小端序）
	var length_bytes = PackedByteArray()
	var length = message_bytes.size()
	length_bytes.append(length & 0xFF)
	length_bytes.append((length >> 8) & 0xFF)
	length_bytes.append((length >> 16) & 0xFF)
	length_bytes.append((length >> 24) & 0xFF)
	
	# 组合最终数据包
	var final_packet = length_bytes + message_bytes
	
	var error = websocket.send(final_packet)
	if error != OK:
		print("发送消息失败: ", error)
		return false
	
	print("发送 Protobuf 消息 - ID: ", msg_id, ", 序列号: ", message_serial_no, ", 数据长度: ", data_bytes.size(), ", 总包长度: ", final_packet.size())
	return true

# WebSocket认证
func websocket_auth():
	if session_token.is_empty():
		print("没有有效的session_token，无法进行认证")
		return
	
	print("发送WebSocket认证请求...")
	var request = GameProto.AuthRequest.new()
	request.set_token(session_token)
	request.set_device_id("godoroom_" + OS.get_unique_id())
	request.set_timestamp(Time.get_unix_time_from_system() * 1000)
	request.set_nonce(str(randi()))
	request.set_is_guest(true)
	request.set_app_id("desktop_app")
	request.set_protocol_version("1.0")
	request.set_client_version("1.0.0")
	request.set_device_type("PC")
	request.set_signature("")
	
	# 序列化为字节数组
	var proto_bytes = request.to_bytes()
	send_message(2, proto_bytes)  # AUTH_REQUEST = 2

# 获取房间列表
func get_room_list():
	var request = GameProto.GetRoomListRequest.new()
	var proto_bytes = request.to_bytes()
	send_message(6, proto_bytes)  # GET_ROOM_LIST_REQUEST = 6

# 创建房间
func create_room(room_name: String):
	var request = GameProto.CreateRoomRequest.new()
	request.set_name(room_name)
	var proto_bytes = request.to_bytes()
	send_message(8, proto_bytes)  # CREATE_ROOM_REQUEST = 8

# 加入房间
func join_room(room_id: String):
	var request = GameProto.JoinRoomRequest.new()
	request.set_roomId(room_id)
	current_room_id = room_id
	var proto_bytes = request.to_bytes()
	send_message(10, proto_bytes)  # JOIN_ROOM_REQUEST = 10

# 离开房间
func leave_room():
	if current_room_id.is_empty():
		print("没有当前房间ID，无法离开房间")
		return
	
	var request = GameProto.LeaveRoomRequest.new()
	request.set_playerId(str(user_uid))
	var proto_bytes = request.to_bytes()
	send_message(12, proto_bytes)  # LEAVE_ROOM_REQUEST = 12
	print("发送离开房间请求，房间ID: ", current_room_id)
	
	# 清空当前房间ID
	current_room_id = ""

# 发送玩家位置更新
func send_player_position(position: Vector2):
	if current_room_id.is_empty():
		print("无法发送位置: 当前没有在任何房间中")
		return
	
	if user_uid == 0:
		print("无法发送位置: 用户未登录")
		return
	
	print("准备发送位置: 房间ID=", current_room_id, ", 用户ID=", user_uid)
	
	var request = GameProto.GameActionRequest.new()
	# 使用new_action()方法创建GameAction并设置
	var action = request.new_action()
	action.set_player_id(user_uid)
	action.set_action_type(5)  # CHAR_MOVE
	action.set_timestamp(Time.get_unix_time_from_system() * 1000)
	
	# 使用oneof结构：new_char_move()方法创建CharacterMoveAction
	var move_action = action.new_char_move()
	move_action.set_from_x(int(last_sent_position.x))
	move_action.set_from_y(int(last_sent_position.y))
	move_action.set_to_x(int(position.x))
	move_action.set_to_y(int(position.y))
	
	# 更新last_sent_position
	last_sent_position = position
	
	var proto_bytes = request.to_bytes()
	send_message(20, proto_bytes)  # GAME_ACTION_REQUEST = 20
	
	print("发送玩家位置: ", last_sent_position, " -> ", position)

# 新增：发送准备请求
func send_get_ready_request():
	if current_room_id.is_empty():
		print("无法发送准备请求: 当前没有在任何房间中")
		return
	
	if user_uid == 0:
		print("无法发送准备请求: 用户未登录")
		return
	
	print("发送准备请求: 房间ID=", current_room_id, ", 用户ID=", user_uid)
	
	var request = GameProto.GetReadyRequest.new()
	request.set_playerId(str(user_uid))
	var proto_bytes = request.to_bytes()
	send_message(18, proto_bytes)  # GET_READY_REQUEST = 18