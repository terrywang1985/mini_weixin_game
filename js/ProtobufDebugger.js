// 调试protobuf编码的工具
class ProtobufDebugger {
    
    // 编码varint
    encodeVarint(value) {
        const bytes = [];
        while (value > 0x7F) {
            bytes.push((value & 0x7F) | 0x80);
            value >>>= 7;
        }
        bytes.push(value & 0x7F);
        return new Uint8Array(bytes);
    }
    
    // 调试编码结果
    debugEncoding() {
        console.log("=== Protobuf编码调试 ===");
        
        // 测试 msgId = 2 的编码
        const msgId = 2;
        const tag1 = (1 << 3) | 0; // field 1, wire type 0
        const tag1Bytes = this.encodeVarint(tag1);
        const msgIdBytes = this.encodeVarint(msgId);
        
        console.log(`字段1 (message_id=${msgId}):`);
        console.log(`  tag字节: [${Array.from(tag1Bytes).join(', ')}]`);
        console.log(`  值字节: [${Array.from(msgIdBytes).join(', ')}]`);
        
        // 测试serial_no = 1 的编码
        const serialNo = 1;
        const tag3 = (3 << 3) | 0; // field 3, wire type 0
        const tag3Bytes = this.encodeVarint(tag3);
        const serialNoBytes = this.encodeVarint(serialNo);
        
        console.log(`字段3 (serial_no=${serialNo}):`);
        console.log(`  tag字节: [${Array.from(tag3Bytes).join(', ')}]`);
        console.log(`  值字节: [${Array.from(serialNoBytes).join(', ')}]`);
        
        // 完整的包装器（不包含data字段，简化测试）
        const wrapperBytes = new Uint8Array([
            ...tag1Bytes, ...msgIdBytes,  // 字段1: message_id = 2
            ...tag3Bytes, ...serialNoBytes // 字段3: serial_no = 1
        ]);
        
        console.log(`完整包装器字节: [${Array.from(wrapperBytes).join(', ')}]`);
        console.log(`包装器长度: ${wrapperBytes.length}`);
        
        // 添加长度头
        const length = wrapperBytes.length;
        const header = new Uint8Array(4);
        header[0] = length & 0xFF;
        header[1] = (length >>> 8) & 0xFF;
        header[2] = (length >>> 16) & 0xFF;
        header[3] = (length >>> 24) & 0xFF;
        
        console.log(`长度头: [${Array.from(header).join(', ')}]`);
        
        const finalMessage = new Uint8Array([...header, ...wrapperBytes]);
        console.log(`最终消息: [${Array.from(finalMessage).join(', ')}]`);
        console.log(`最终消息base64:`, btoa(String.fromCharCode(...finalMessage)));
    }
}

// 运行调试
const protobufDebugger = new ProtobufDebugger();
protobufDebugger.debugEncoding();