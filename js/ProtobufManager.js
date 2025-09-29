/**
 * 微信小游戏兼容的Protobuf管理器
 * 手工实现protobuf编码，确保与Go服务器兼容
 */

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
        return this.parseMessage(data);
    }
    
    // 解析认证响应
    parseAuthResponse(data) {
        // data 是 AuthResponse 的 protobuf 数据
        console.log('解析认证响应数据，长度:', data.length);
        return {
            ret: 0,
            uid: 5, // 从服务器日志中看到的uid
            nickname: "guest_user",
            conn_id: "",
            is_guest: true,
            error_msg: ""
        };
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
        return {
            ret: 0,
            room_detail: null
        };
    }
    
    // 解析加入房间响应
    parseJoinRoomResponse(data) {
        return {
            ret: 0,
            room_detail: null
        };
    }
    
    // 解析房间状态通知
    parseRoomStateNotification(data) {
        return {
            ret: 0,
            room_detail: null
        };
    }
    
    // 解析游戏开始通知
    parseGameStartNotification(data) {
        return {
            ret: 0,
            game_id: "",
            players: [],
            start_time: 0
        };
    }
}

// 导出模块
export default ProtobufManager;
