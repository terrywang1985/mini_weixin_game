/**
 * 测试新的Protobuf实现
 */

import ProtobufManager from './ProtobufManager.js';

async function testProtobuf() {
    console.log('开始测试Protobuf实现...');
    
    const protobuf = new ProtobufManager();
    
    try {
        // 初始化
        await protobuf.initialize();
        console.log('✅ Protobuf初始化成功');
        
        // 测试认证请求
        const authRequest = protobuf.createAuthRequest("test_token", "test_device");
        console.log('✅ 创建认证请求成功，长度:', authRequest.length);
        
        // 测试房间列表请求
        const roomListRequest = protobuf.createGetRoomListRequest();
        console.log('✅ 创建房间列表请求成功，长度:', roomListRequest.length);
        
        // 测试创建房间请求
        const createRoomRequest = protobuf.createCreateRoomRequest("测试房间");
        console.log('✅ 创建房间请求成功，长度:', createRoomRequest.length);
        
        // 测试解析模拟响应
        const mockAuthResponse = {
            ret: 0,
            uid: 12345,
            nickname: "测试用户",
            conn_id: "conn_123",
            is_guest: true,
            error_msg: ""
        };
        
        // 模拟序列化和反序列化
        const jsonString = JSON.stringify(mockAuthResponse);
        const encoder = new TextEncoder();
        const responseData = encoder.encode(jsonString);
        
        const parsedResponse = protobuf.parseAuthResponse(responseData);
        console.log('✅ 解析认证响应成功:', parsedResponse);
        
        console.log('🎉 所有Protobuf测试通过！');
        
    } catch (error) {
        console.error('❌ Protobuf测试失败:', error);
    }
}

// 在微信小游戏环境中运行测试
if (typeof wx !== 'undefined') {
    wx.onShow(() => {
        setTimeout(testProtobuf, 1000);
    });
}

export { testProtobuf };