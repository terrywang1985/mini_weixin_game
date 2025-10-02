/**
 * 微信小游戏兼容的Protobuf管理器
 * 手工实现protobuf编码，确保与Go服务器兼容
 */

import GameStateManager from './GameStateManager.js';

class ProtobufManager {
    constructor() {
        this.isInitialized = true;
        this.messageSerialNo = 0;
        
        // 消息ID定义
        this.MESSAGE_IDS = {
            AUTH_REQUEST: 2,
            AUTH_RESPONSE: 3,
            GET_ROOM_LIST_REQUEST: 6,
            GET_ROOM_LIST_RESPONSE: 7,
            CREATE_ROOM_REQUEST: 8,
            CREATE_ROOM_RESPONSE: 9,
            JOIN_ROOM_REQUEST: 10,
            JOIN_ROOM_RESPONSE: 11,
            LEAVE_ROOM_REQUEST: 12,
            LEAVE_ROOM_RESPONSE: 13,
            ROOM_STATE_NOTIFICATION: 14,
            GAME_STATE_NOTIFICATION: 15,
            GET_READY_REQUEST: 18,
            GET_READY_RESPONSE: 19,
            GAME_ACTION_REQUEST: 20,
            GAME_ACTION_RESPONSE: 21,
            GAME_ACTION_NOTIFICATION: 22,
            GAME_START_NOTIFICATION: 23
        };
    }
    
    async initialize() {
        console.log('ProtobufManager initialized (手工实现模式)');
        return true;
    }
    
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('ProtobufManager not initialized');
        }
    }
    
    // 获取下一个序列号
    getNextSerial() {
        return ++this.messageSerialNo;
    }
    
    // 编码varint（可变长度整数）
    encodeVarint(value) {
        const bytes = [];
        while (value > 0x7F) {
            bytes.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        bytes.push(value & 0x7F);
        return new Uint8Array(bytes);
    }
    
    // 编码字符串字段
    encodeStringField(fieldNumber, value) {
        if (!value) return new Uint8Array(0);
        
        const tag = (fieldNumber << 3) | 2; // wire type 2
        const stringBytes = new TextEncoder().encode(value);
        const lengthBytes = this.encodeVarint(stringBytes.length);
        const tagBytes = this.encodeVarint(tag);
        
        const result = new Uint8Array(tagBytes.length + lengthBytes.length + stringBytes.length);
        let offset = 0;
        result.set(tagBytes, offset);
        offset += tagBytes.length;
        result.set(lengthBytes, offset);
        offset += lengthBytes.length;
        result.set(stringBytes, offset);
        
        return result;
    }
    
    // 编码整数字段
    encodeIntField(fieldNumber, value) {
        // 即使值为0也要编码（对于protobuf，0是有效值）
        const tag = (fieldNumber << 3) | 0; // wire type 0
        const tagBytes = this.encodeVarint(tag);
        const valueBytes = this.encodeVarint(value);
        
        const result = new Uint8Array(tagBytes.length + valueBytes.length);
        result.set(tagBytes, 0);
        result.set(valueBytes, tagBytes.length);
        
        console.log(`编码整数字段 ${fieldNumber}=${value}: tag=[${Array.from(tagBytes)}], value=[${Array.from(valueBytes)}]`);
        
        return result;
    }
    
    // 编码布尔字段
    encodeBoolField(fieldNumber, value) {
        if (!value) return new Uint8Array(0);
        
        const tag = (fieldNumber << 3) | 0;
        const tagBytes = this.encodeVarint(tag);
        const valueBytes = new Uint8Array([1]);
        
        const result = new Uint8Array(tagBytes.length + valueBytes.length);
        result.set(tagBytes, 0);
        result.set(valueBytes, tagBytes.length);
        
        return result;
    }
    
    // 合并字节数组
    concatBytes(...arrays) {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        return result;
    }
    
    // 编码AuthRequest消息
    encodeAuthRequest(authData) {
        const fields = [];
        
        if (authData.token) fields.push(this.encodeStringField(1, authData.token));
        if (authData.protocol_version) fields.push(this.encodeStringField(2, authData.protocol_version));
        if (authData.client_version) fields.push(this.encodeStringField(3, authData.client_version));
        if (authData.device_type) fields.push(this.encodeStringField(4, authData.device_type));
        if (authData.device_id) fields.push(this.encodeStringField(5, authData.device_id));
        if (authData.app_id) fields.push(this.encodeStringField(6, authData.app_id));
        if (authData.nonce) fields.push(this.encodeStringField(7, authData.nonce));
        if (authData.timestamp) fields.push(this.encodeIntField(8, authData.timestamp));
        if (authData.signature) fields.push(this.encodeStringField(9, authData.signature));
        if (authData.is_guest) fields.push(this.encodeBoolField(10, authData.is_guest));
        
        return this.concatBytes(...fields);
    }
    
    // 编码GetRoomListRequest（空消息）
    encodeGetRoomListRequest() {
        return new Uint8Array(0);
    }
    
    // 编码CreateRoomRequest
    encodeCreateRoomRequest(roomName) {
        // CreateRoomRequest 消息结构:
        // 1: room_name (string)
        
        const fields = [];
        
        // 编码房间名称 (field 1, string)
        if (roomName) {
            const nameBytes = new TextEncoder().encode(roomName);
            const field1 = [];
            field1.push(0x0A); // field 1, wire type 2 (length-delimited)
            field1.push(...this.encodeVarint(nameBytes.length));
            field1.push(...nameBytes);
            fields.push(...field1);
        }
        
        return new Uint8Array(fields);
    }
    
    // 编码JoinRoomRequest
    encodeJoinRoomRequest(roomId) {
        // JoinRoomRequest 消息结构:
        // 1: roomId (string)
        
        const fields = [];
        
        // 编码房间ID (field 1, string)
        if (roomId) {
            const roomIdBytes = new TextEncoder().encode(roomId);
            const field1 = [];
            field1.push(0x0A); // field 1, wire type 2 (length-delimited)
            field1.push(...this.encodeVarint(roomIdBytes.length));
            field1.push(...roomIdBytes);
            fields.push(...field1);
        }
        
        return new Uint8Array(fields);
    }
    
    // 编码GetReadyRequest
    encodeGetReadyRequest(playerId) {
        // GetReadyRequest proto: string playerId = 1;
        // field 1, wire type 2 (length-delimited)
        const fields = [];
        if (playerId !== undefined && playerId !== null) {
            const pidStr = String(playerId);
            const bytes = new TextEncoder().encode(pidStr);
            const field1 = [];
            field1.push(0x0A); // tag (field=1, wt=2)
            field1.push(...this.encodeVarint(bytes.length));
            field1.push(...bytes);
            fields.push(...field1);
        }
        return new Uint8Array(fields);
    }
    
    // 添加4字节长度头（小端序）
    addLengthHeader(messageData) {
        const length = messageData.length;
        const header = new Uint8Array(4);
        // 使用小端序 (little-endian)
        header[0] = length & 0xFF;
        header[1] = (length >>> 8) & 0xFF;
        header[2] = (length >>> 16) & 0xFF;
        header[3] = (length >>> 24) & 0xFF;
        
        const result = new Uint8Array(4 + messageData.length);
        result.set(header, 0);
        result.set(messageData, 4);
        
        console.log(`添加长度头 (小端序): 消息${length}字节, 总计${result.length}字节`);
        console.log(`长度头字节: [${header[0]}, ${header[1]}, ${header[2]}, ${header[3]}]`);
        return result;
    }
    
    // 编码消息包装器（按照Go服务器的Message格式）
    encodeMessageWrapper(msgId, data) {
        const fields = [];
        
        console.log(`开始编码消息包装器: msgId=${msgId}, data长度=${data.length}`);
        
        // 字段1: clientId (string) - 客户端唯一标识
        const clientId = "wxgame_client_" + Math.random().toString(36).substr(2, 9);
        const field1 = this.encodeStringField(1, clientId);
        fields.push(field1);
        console.log(`字段1 (clientId): "${clientId}", 字节=[${Array.from(field1).slice(0, 10)}...]`);
        
        // 字段2: msgSerialNo (int32) - 消息序列号
        const field2 = this.encodeIntField(2, this.messageSerialNo);
        fields.push(field2);
        console.log(`字段2 (msgSerialNo): [${Array.from(field2)}]`);
        
        // 字段3: id (MessageId/int32) - 消息ID
        const field3 = this.encodeIntField(3, msgId);
        fields.push(field3);
        console.log(`字段3 (id/MessageId): [${Array.from(field3)}]`);
        
        // 字段4: data (bytes) - 消息体
        if (data && data.length > 0) {
            const tag = (4 << 3) | 2; // field 4, wire type 2
            const tagBytes = this.encodeVarint(tag);
            const lengthBytes = this.encodeVarint(data.length);
            const fieldBytes = this.concatBytes(tagBytes, lengthBytes, data);
            fields.push(fieldBytes);
            console.log(`字段4 (data): tag=[${Array.from(tagBytes)}], length=[${Array.from(lengthBytes)}], 总长度=${fieldBytes.length}`);
        }
        
        const result = this.concatBytes(...fields);
        console.log(`编码包装器完成: msgId=${msgId}, 数据=${data.length}字节, 包装后=${result.length}字节`);
        console.log(`完整包装器: [${Array.from(result).slice(0, 20)}...]`);
        return result;
    }
    
    // 创建消息包装器
    createMessage(msgId, messageData) {
        this.messageSerialNo++;
        
        // 创建包装消息
        const wrapper = this.encodeMessageWrapper(msgId, messageData);
        
        // 添加长度头
        return this.addLengthHeader(wrapper);
    }
    
    // 创建认证请求
    createAuthRequest(token, deviceId) {
        this.ensureInitialized();
        
        const authRequestData = {
            token: token || "",
            device_id: deviceId || "",
            timestamp: Date.now(),
            nonce: Math.random().toString(36).substr(2, 9),
            is_guest: true,
            app_id: "wxgame_app",
            protocol_version: "1.0",
            client_version: "1.0.0",
            device_type: "WeChat",
            signature: ""
        };
        
        console.log('创建认证请求:', authRequestData);
        
        const messageData = this.encodeAuthRequest(authRequestData);
        return this.createMessage(this.MESSAGE_IDS.AUTH_REQUEST, messageData);
    }
    
    // 创建获取房间列表请求
    createGetRoomListRequest() {
        this.ensureInitialized();
        
        const messageData = this.encodeGetRoomListRequest();
        return this.createMessage(this.MESSAGE_IDS.GET_ROOM_LIST_REQUEST, messageData);
    }
    
    // 创建创建房间请求
    createCreateRoomRequest(roomName) {
        this.ensureInitialized();
        
        const messageData = this.encodeCreateRoomRequest(roomName);
        return this.createMessage(this.MESSAGE_IDS.CREATE_ROOM_REQUEST, messageData);
    }
    
    // 创建加入房间请求
    createJoinRoomRequest(roomId) {
        this.ensureInitialized();
        
        const messageData = this.encodeJoinRoomRequest(roomId);
        return this.createMessage(this.MESSAGE_IDS.JOIN_ROOM_REQUEST, messageData);
    }
    
    // 解码varint
    decodeVarint(data, offset = 0) {
        let value = 0;
        let shift = 0;
        let index = offset;
        
        while (index < data.length) {
            const byte = data[index++];
            value |= (byte & 0x7F) << shift;
            if ((byte & 0x80) === 0) break;
            shift += 7;
        }
        
        return { value, nextOffset: index };
    }
    
    // 解码字符串
    decodeString(data, offset, length) {
        const stringBytes = data.slice(offset, offset + length);
        const decoder = new TextDecoder();
        return decoder.decode(stringBytes);
    }
    
    // 解析消息包装器
    parseMessageWrapper(data) {
        let offset = 0;
        const result = {
            clientId: "",
            msgSerialNo: 0,
            id: 0,
            data: null
        };
        
        while (offset < data.length) {
            // 解析tag
            const tagResult = this.decodeVarint(data, offset);
            const tag = tagResult.value;
            offset = tagResult.nextOffset;
            
            const fieldNumber = tag >> 3;
            const wireType = tag & 7;
            
            console.log(`解析字段 ${fieldNumber}, wire_type=${wireType}, offset=${offset}`);
            
            switch (fieldNumber) {
                case 1: // clientId (string)
                    if (wireType === 2) {
                        const lengthResult = this.decodeVarint(data, offset);
                        offset = lengthResult.nextOffset;
                        result.clientId = this.decodeString(data, offset, lengthResult.value);
                        offset += lengthResult.value;
                        console.log(`解析clientId: "${result.clientId}"`);
                    }
                    break;
                    
                case 2: // msgSerialNo (int32)
                    if (wireType === 0) {
                        const valueResult = this.decodeVarint(data, offset);
                        result.msgSerialNo = valueResult.value;
                        offset = valueResult.nextOffset;
                        console.log(`解析msgSerialNo: ${result.msgSerialNo}`);
                    }
                    break;
                    
                case 3: // id (MessageId/int32)
                    if (wireType === 0) {
                        const valueResult = this.decodeVarint(data, offset);
                        result.id = valueResult.value;
                        offset = valueResult.nextOffset;
                        console.log(`解析id: ${result.id}`);
                    }
                    break;
                    
                case 4: // data (bytes)
                    if (wireType === 2) {
                        const lengthResult = this.decodeVarint(data, offset);
                        offset = lengthResult.nextOffset;
                        result.data = data.slice(offset, offset + lengthResult.value);
                        offset += lengthResult.value;
                        console.log(`解析data: ${lengthResult.value}字节`);
                        
                        // 打印data的十六进制表示
                        if (result.data && result.data.length > 0) {
                            const hexString = Array.from(result.data).map(b => b.toString(16).padStart(2, '0')).join(' ');
                            console.log(`Message.data内容 (hex): ${hexString}`);
                        } else {
                            console.log('Message.data为空');
                        }
                    }
                    break;
                    
                default:
                    console.warn(`未知字段: ${fieldNumber}`);
                    // 跳过未知字段
                    if (wireType === 0) {
                        const valueResult = this.decodeVarint(data, offset);
                        offset = valueResult.nextOffset;
                    } else if (wireType === 2) {
                        const lengthResult = this.decodeVarint(data, offset);
                        offset = lengthResult.nextOffset + lengthResult.value;
                    }
                    break;
            }
        }
        
        return result;
    }
    
    // 处理接收到的消息
    handleReceivedMessage(data) {
        try {
            // 移除长度头（如果存在）
            let messageData = data;
            if (data.length > 4) {
                const length = (data[0]) | (data[1] << 8) | (data[2] << 16) | (data[3] << 24);
                if (length === data.length - 4) {
                    messageData = data.slice(4);
                    console.log(`移除长度头，消息数据长度: ${messageData.length}`);
                }
            }
            
            // 解析消息包装器
            const wrapper = this.parseMessageWrapper(messageData);
            console.log('解析消息包装器:', wrapper);
            
            return wrapper;
        } catch (error) {
            console.error('消息解析失败:', error);
            return null;
        }
    }
    
    // 解析认证响应
    parseAuthResponse(data) {
        console.log('解析认证响应数据，长度:', data.length);
        
        if (!data || data.length === 0) {
            console.log('认证响应数据为空');
            return null;
        }
        
        try {
            // AuthResponse 包含多个字段，需要解析protobuf
            let offset = 0;
            let ret = 0;
            let uid = 0;
            let nickname = "";
            let connId = "";
            let isGuest = false;
            let errorMsg = "";
            let exp = 0;
            let gold = 0;
            let diamond = 0;
            
            while (offset < data.length) {
                const tag = data[offset];
                const fieldNumber = tag >> 3;
                const wireType = tag & 0x07;
                offset++;
                
                console.log(`解析AuthResponse字段: field=${fieldNumber}, wireType=${wireType}`);
                
                if (fieldNumber === 1 && wireType === 0) {
                    // ret字段 (ErrorCode)
                    const result = this.decodeVarint(data, offset);
                    ret = result.value;
                    offset = result.nextOffset;
                    console.log(`认证错误码: ${ret}`);
                } else if (fieldNumber === 2 && wireType === 0) {
                    // uid字段 (uint64)
                    const result = this.decodeVarint(data, offset);
                    uid = result.value;
                    offset = result.nextOffset;
                    console.log(`用户UID: ${uid}`);
                } else if (fieldNumber === 3 && wireType === 2) {
                    // conn_id字段 (string)
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset;
                    connId = this.decodeString(data, offset, lengthResult.value);
                    offset += lengthResult.value;
                    console.log(`连接ID: ${connId}`);
                } else if (fieldNumber === 6 && wireType === 2) {
                    // nickname字段 (string)
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset;
                    nickname = this.decodeString(data, offset, lengthResult.value);
                    offset += lengthResult.value;
                    console.log(`用户昵称: ${nickname}`);
                } else if (fieldNumber === 8 && wireType === 0) {
                    // exp字段 (int64)
                    const result = this.decodeVarint(data, offset);
                    exp = result.value;
                    offset = result.nextOffset;
                    console.log(`用户经验: ${exp}`);
                } else if (fieldNumber === 9 && wireType === 0) {
                    // gold字段 (int64)
                    const result = this.decodeVarint(data, offset);
                    gold = result.value;
                    offset = result.nextOffset;
                    console.log(`用户金币: ${gold}`);
                } else if (fieldNumber === 10 && wireType === 0) {
                    // diamond字段 (int64)
                    const result = this.decodeVarint(data, offset);
                    diamond = result.value;
                    offset = result.nextOffset;
                    console.log(`用户钻石: ${diamond}`);
                } else if (fieldNumber === 11 && wireType === 0) {
                    // is_guest字段 (bool)
                    const result = this.decodeVarint(data, offset);
                    isGuest = result.value === 1;
                    offset = result.nextOffset;
                    console.log(`是否游客: ${isGuest}`);
                } else if (fieldNumber === 12 && wireType === 2) {
                    // error_msg字段 (string)
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset;
                    errorMsg = this.decodeString(data, offset, lengthResult.value);
                    offset += lengthResult.value;
                    console.log(`错误消息: ${errorMsg}`);
                } else {
                    // 跳过未知字段
                    if (wireType === 0) {
                        const result = this.decodeVarint(data, offset);
                        offset = result.nextOffset;
                    } else if (wireType === 2) {
                        const lengthResult = this.decodeVarint(data, offset);
                        offset = lengthResult.nextOffset + lengthResult.value;
                    }
                }
            }
            
            return {
                ret: ret,
                uid: uid,
                nickname: nickname || "玩家",
                conn_id: connId,
                is_guest: isGuest,
                error_msg: errorMsg,
                exp: exp,
                gold: gold,
                diamond: diamond
            };
        } catch (error) {
            console.error('解析认证响应失败:', error);
            return null;
        }
    }
    
    // 解析房间列表响应
    parseRoomListResponse(data) {
        return {
            ret: 0,
            rooms: []
        };
    }
    
    // 解析创建房间响应
    parseCreateRoomResponse(data) {
        console.log('解析创建房间响应数据，长度:', data.length);
        
        if (!data || data.length === 0) {
            console.log('创建房间响应数据为空，假设为成功');
            return { 
                ret: 0, 
                room: null 
            };
        }
        
        try {
            // CreateRoomResponse 包含: ErrorCode ret = 1; RoomDetail room_detail = 2;
            let offset = 0;
            let errorCode = 0;
            let roomDetail = null;
            
            while (offset < data.length) {
                const tag = data[offset];
                const fieldNumber = tag >> 3;
                const wireType = tag & 0x07;
                offset++;
                
                console.log(`解析CreateRoomResponse字段: field=${fieldNumber}, wireType=${wireType}`);
                
                if (fieldNumber === 1 && wireType === 0) {
                    // ret字段 (ErrorCode)
                    const result = this.decodeVarint(data, offset);
                    errorCode = result.value;
                    offset = result.nextOffset;
                    console.log(`创建房间错误码: ${errorCode}`);
                } else if (fieldNumber === 2 && wireType === 2) {
                    // room_detail字段 (RoomDetail)
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset;
                    const roomDetailData = data.slice(offset, offset + lengthResult.value);
                    offset += lengthResult.value;
                    
                    roomDetail = this.parseRoomDetail(roomDetailData);
                    console.log(`解析到房间详情:`, roomDetail);
                } else {
                    // 跳过未知字段
                    if (wireType === 0) {
                        const result = this.decodeVarint(data, offset);
                        offset = result.nextOffset;
                    } else if (wireType === 2) {
                        const lengthResult = this.decodeVarint(data, offset);
                        offset = lengthResult.nextOffset + lengthResult.value;
                    }
                }
            }
            
            const success = errorCode === 0;
            const message = this.getErrorMessage(errorCode);
            
            return {
                ret: errorCode,
                success: success,
                message: message,
                room: roomDetail ? roomDetail.room : null,
                players: roomDetail ? roomDetail.players : []
            };
        } catch (error) {
            console.error('解析创建房间响应失败:', error);
            return { ret: 2, success: false, message: '解析失败: ' + error.message };
        }
    }
    
    // 解析RoomDetail
    parseRoomDetail(data) {
        console.log('解析RoomDetail，数据长度:', data.length);
        
        let offset = 0;
        let room = null;
        let players = [];
        
        while (offset < data.length) {
            const tag = data[offset];
            const fieldNumber = tag >> 3;
            const wireType = tag & 0x07;
            offset++;
            
            if (fieldNumber === 1 && wireType === 2) {
                // room字段 (Room)
                const lengthResult = this.decodeVarint(data, offset);
                offset = lengthResult.nextOffset;
                const roomData = data.slice(offset, offset + lengthResult.value);
                offset += lengthResult.value;
                
                room = this.parseRoom(roomData);
                console.log('解析到Room:', room);
            } else if (fieldNumber === 2 && wireType === 2) {
                // current_players字段 (repeated RoomPlayer)
                const lengthResult = this.decodeVarint(data, offset);
                offset = lengthResult.nextOffset;
                const playerData = data.slice(offset, offset + lengthResult.value);
                offset += lengthResult.value;
                
                const player = this.parseRoomPlayer(playerData);
                players.push(player);
                console.log('解析到玩家:', player);
            } else {
                // 跳过未知字段
                if (wireType === 0) {
                    const result = this.decodeVarint(data, offset);
                    offset = result.nextOffset;
                } else if (wireType === 2) {
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset + lengthResult.value;
                }
            }
        }
        
        return { room: room, players: players };
    }
    
    // 解析Room
    parseRoom(data) {
        console.log('解析Room，数据长度:', data.length);
        
        let offset = 0;
        let id = "";
        let name = "";
        let maxPlayers = 6;
        let currentPlayers = 0;
        
        while (offset < data.length) {
            const tag = data[offset];
            const fieldNumber = tag >> 3;
            const wireType = tag & 0x07;
            offset++;
            
            if (fieldNumber === 1 && wireType === 2) {
                // id字段 (string)
                const lengthResult = this.decodeVarint(data, offset);
                offset = lengthResult.nextOffset;
                id = this.decodeString(data, offset, lengthResult.value);
                offset += lengthResult.value;
                console.log('房间ID:', id);
            } else if (fieldNumber === 2 && wireType === 2) {
                // name字段 (string)
                const lengthResult = this.decodeVarint(data, offset);
                offset = lengthResult.nextOffset;
                name = this.decodeString(data, offset, lengthResult.value);
                offset += lengthResult.value;
                console.log('房间名称:', name);
            } else if (fieldNumber === 3 && wireType === 0) {
                // max_players字段 (int32)
                const result = this.decodeVarint(data, offset);
                maxPlayers = result.value;
                offset = result.nextOffset;
                console.log('最大玩家数:', maxPlayers);
            } else if (fieldNumber === 4 && wireType === 0) {
                // current_players字段 (int32)
                const result = this.decodeVarint(data, offset);
                currentPlayers = result.value;
                offset = result.nextOffset;
                console.log('当前玩家数:', currentPlayers);
            } else {
                // 跳过未知字段
                if (wireType === 0) {
                    const result = this.decodeVarint(data, offset);
                    offset = result.nextOffset;
                } else if (wireType === 2) {
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset + lengthResult.value;
                }
            }
        }
        
        return {
            id: id,
            name: name,
            max_players: maxPlayers,
            current_players: currentPlayers
        };
    }
    
    // 解析RoomPlayer
    parseRoomPlayer(data) {
        console.log('解析RoomPlayer，数据长度:', data.length);
        
        let offset = 0;
        let uid = 0;
        let nickname = "";
        let isReady = false;
        let position = 0;
        
        while (offset < data.length) {
            const tag = data[offset];
            const fieldNumber = tag >> 3;
            const wireType = tag & 0x07;
            offset++;
            
            if (fieldNumber === 1 && wireType === 0) {
                // uid字段 (uint64)
                const result = this.decodeVarint(data, offset);
                uid = result.value;
                offset = result.nextOffset;
                console.log('玩家UID:', uid);
            } else if (fieldNumber === 2 && wireType === 2) {
                // nickname字段 (string)
                const lengthResult = this.decodeVarint(data, offset);
                offset = lengthResult.nextOffset;
                nickname = this.decodeString(data, offset, lengthResult.value);
                offset += lengthResult.value;
                console.log('玩家昵称:', nickname);
            } else if (fieldNumber === 3 && wireType === 0) {
                // is_ready字段 (bool)
                const result = this.decodeVarint(data, offset);
                isReady = result.value === 1;
                offset = result.nextOffset;
                console.log('玩家准备状态:', isReady);
            } else if (fieldNumber === 4 && wireType === 0) {
                // position字段 (int32)
                const result = this.decodeVarint(data, offset);
                position = result.value;
                offset = result.nextOffset;
                console.log('玩家位置:', position);
            } else {
                // 跳过未知字段
                if (wireType === 0) {
                    const result = this.decodeVarint(data, offset);
                    offset = result.nextOffset;
                } else if (wireType === 2) {
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset + lengthResult.value;
                }
            }
        }
        
        return {
            uid: uid,
            nickname: nickname,
            is_ready: isReady,
            position: position
        };
    }
    
    // 解析加入房间响应
    parseJoinRoomResponse(data) {
        console.log('解析加入房间响应数据，长度:', data.length);
        
        if (!data || data.length === 0) {
            console.log('加入房间响应数据为空');
            return { ret: 2, success: false, message: '响应数据为空' };
        }
        
        try {
            // JoinRoomResponse 包含: ErrorCode ret = 1; RoomDetail room_detail = 2;
            let offset = 0;
            let errorCode = 0;
            let roomDetail = null;
            
            while (offset < data.length) {
                const tag = data[offset];
                const fieldNumber = tag >> 3;
                const wireType = tag & 0x07;
                offset++;
                
                console.log(`解析JoinRoomResponse字段: field=${fieldNumber}, wireType=${wireType}`);
                
                if (fieldNumber === 1 && wireType === 0) {
                    // ret字段 (ErrorCode)
                    const result = this.decodeVarint(data, offset);
                    errorCode = result.value;
                    offset = result.nextOffset;
                    console.log(`加入房间错误码: ${errorCode}`);
                } else if (fieldNumber === 2 && wireType === 2) {
                    // room_detail字段 (RoomDetail)
                    const lengthResult = this.decodeVarint(data, offset);
                    offset = lengthResult.nextOffset;
                    const roomDetailData = data.slice(offset, offset + lengthResult.value);
                    offset += lengthResult.value;
                    
                    roomDetail = this.parseRoomDetail(roomDetailData);
                    console.log(`解析到房间详情:`, roomDetail);
                } else {
                    // 跳过未知字段
                    if (wireType === 0) {
                        const result = this.decodeVarint(data, offset);
                        offset = result.nextOffset;
                    } else if (wireType === 2) {
                        const lengthResult = this.decodeVarint(data, offset);
                        offset = lengthResult.nextOffset + lengthResult.value;
                    }
                }
            }
            
            const success = errorCode === 0;
            const message = this.getErrorMessage(errorCode);
            
            return {
                ret: errorCode,
                success: success,
                message: message,
                room: roomDetail ? roomDetail.room : null,
                players: roomDetail ? roomDetail.players : []
            };
        } catch (error) {
            console.error('解析加入房间响应失败:', error);
            return { ret: 2, success: false, message: '解析失败: ' + error.message };
        }
    }
    
    // 创建准备请求 (传入 playerId)
    createGetReadyRequest(playerId) {
        this.ensureInitialized();
        const messageData = this.encodeGetReadyRequest(playerId);
        return this.createMessage(this.MESSAGE_IDS.GET_READY_REQUEST, messageData);
    }
    
    // 解析准备响应
    parseGetReadyResponse(data) {
        console.log('解析准备响应数据，长度:', data ? data.length : 'null');
        
        // 打印原始数据的十六进制表示以便调试
        if (data && data.length > 0) {
            const hexString = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log('准备响应原始数据 (hex):', hexString);
        }
        
        // GetReadyResponse只有一个字段: ErrorCode ret = 1
        // 当ret=0(成功)时，protobuf会省略这个字段，导致data为空
        // 这是protobuf的标准行为：默认值不会被编码
        if (!data || data.length === 0) {
            console.log('准备响应数据为空，说明ErrorCode=0(成功)');
            return { 
                success: true, 
                message: '准备状态更新成功', 
                isReady: true 
            };
        }
        
        try {
            // GetReadyResponse 只有一个字段: ErrorCode ret = 1
            // protobuf格式: tag(field=1, wire_type=0) + varint(error_code)
            let offset = 0;
            let errorCode = 0; // 默认为 OK
            
            if (data.length > 0) {
                // 解析第一个字段 (应该是 ret = 1)
                const tag = data[offset];
                const fieldNumber = tag >> 3;
                const wireType = tag & 0x07;
                
                console.log(`解析GetReadyResponse: tag=${tag}, field=${fieldNumber}, wireType=${wireType}`);
                
                if (fieldNumber === 1 && wireType === 0) {
                    // 这是 ret 字段，解析varint
                    const result = this.decodeVarint(data, offset + 1);
                    errorCode = result.value;
                    console.log(`解析到错误码: ${errorCode}`);
                }
            }
            
            // 根据ErrorCode枚举判断是否成功
            const success = errorCode === 0; // OK = 0
            const message = this.getErrorMessage(errorCode);
            
            return {
                success: success,
                message: message,
                isReady: success // 如果成功，说明准备状态已更新
            };
        } catch (error) {
            console.error('解析准备响应失败:', error);
            return { success: false, message: '解析失败: ' + error.message, isReady: false };
        }
    }
    
    // 获取错误码对应的消息
    getErrorMessage(errorCode) {
        const errorMessages = {
            0: '成功',
            1: '无效参数',
            2: '服务器错误', 
            3: '认证失败',
            4: '未找到',
            5: '已存在',
            6: '不允许',
            7: '不支持',
            8: '超时',
            9: '无效状态',
            10: '无效动作',
            11: '无效卡牌',
            12: '无效房间',
            13: '无效用户',
            14: '玩家已在房间中'
        };
        return errorMessages[errorCode] || `未知错误(${errorCode})`;
    }
    
    // 解析房间状态通知
    parseRoomStateNotification(data) {
        console.log('解析房间状态通知数据，长度:', data.length);
        
        if (!data || data.length === 0) {
            console.log('房间状态通知数据为空');
            return { ret: 0, room: null, players: [] };
        }
        
        try {
            // RoomStateNotification 应该直接包含 RoomDetail 数据
            // 解析为 RoomDetail
            const roomDetail = this.parseRoomDetail(data);
            console.log('解析房间状态通知详情:', roomDetail);
            
            return {
                ret: 0,
                room: roomDetail ? roomDetail.room : null,
                players: roomDetail ? roomDetail.players : []
            };
        } catch (error) {
            console.error('解析房间状态通知失败:', error);
            return { ret: 2, room: null, players: [] };
        }
    }
    
    // 解析游戏开始通知
    parseGameStartNotification(data) {
        console.log("解析游戏开始通知数据，长度:", data ? data.length : null);
        
        if (!data || data.length === 0) {
            console.log("游戏开始通知数据为空，返回默认结构");
            return {
                ret: 0,
                room_id: "",
                players: [],
                start_time: 0
            };
        }
        
        try {
            let offset = 0;
            let room_id = "";
            let players = [];
            
            while (offset < data.length) {
                // 解析tag
                const tagResult = this.decodeVarint(data, offset);
                const tag = tagResult.value;
                offset = tagResult.nextOffset;
                
                const fieldNumber = tag >> 3;
                const wireType = tag & 7;
                
                console.log(`解析游戏开始通知字段 ${fieldNumber}, wire_type=${wireType}, offset=${offset}`);
                
                switch (fieldNumber) {
                    case 1: // room_id
                        if (wireType === 2) {
                            const lengthResult = this.decodeVarint(data, offset);
                            offset = lengthResult.nextOffset;
                            room_id = this.decodeString(data, offset, lengthResult.value);
                            offset += lengthResult.value;
                            console.log("游戏开始通知room_id:", room_id);
                        }
                        break;
                    case 2: // players (repeated RoomPlayer)
                        if (wireType === 2) {
                            const lengthResult = this.decodeVarint(data, offset);
                            offset = lengthResult.nextOffset;
                            // 解析单个RoomPlayer
                            const playerData = data.slice(offset, offset + lengthResult.value);
                            const player = this.parseRoomPlayer(playerData);
                            if (player) {
                                players.push(player);
                                console.log("游戏开始通知玩家:", player);
                            }
                            offset += lengthResult.value;
                        }
                        break;
                    default:
                        console.log(`跳过游戏开始通知未知字段 ${fieldNumber}`);
                        // 跳过未知字段
                        if (wireType === 0) {
                            const valueResult = this.decodeVarint(data, offset);
                            offset = valueResult.nextOffset;
                        } else if (wireType === 2) {
                            const lengthResult = this.decodeVarint(data, offset);
                            offset = lengthResult.nextOffset + lengthResult.value;
                        }
                        break;
                }
            }
            
            return {
                ret: 0,
                room_id,
                players,
                start_time: 0
            };
        } catch (error) {
            console.error("解析游戏开始通知失败:", error);
            return {
                ret: 0,
                room_id: "",
                players: [],
                start_time: 0
            };
        }
    }
}

// 导出模块
export default ProtobufManager;
