// 解码base64数据的工具
function decodeBase64Message(base64String) {
    // 将base64转换为字节数组
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log("=== 解码消息分析 ===");
    console.log(`总长度: ${bytes.length}`);
    
    // 解析长度头
    const lengthHeader = (bytes[0]) | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);
    console.log(`长度头: [${bytes[0]}, ${bytes[1]}, ${bytes[2]}, ${bytes[3]}]`);
    console.log(`解析的长度: ${lengthHeader}`);
    
    // 显示消息内容前20字节
    const messageContent = bytes.slice(4);
    console.log(`消息内容前20字节: [${Array.from(messageContent.slice(0, 20)).join(', ')}]`);
    
    // 尝试解析第一个字段
    if (messageContent.length > 0) {
        let offset = 0;
        
        // 解析第一个tag
        let tag = messageContent[offset++];
        console.log(`第一个tag: ${tag} (字段=${tag >> 3}, wire_type=${tag & 7})`);
        
        if ((tag & 7) === 0) { // varint
            let value = messageContent[offset++];
            console.log(`第一个值: ${value}`);
        }
        
        // 解析第二个tag
        if (offset < messageContent.length) {
            tag = messageContent[offset++];
            console.log(`第二个tag: ${tag} (字段=${tag >> 3}, wire_type=${tag & 7})`);
            
            if ((tag & 7) === 2) { // length-delimited
                let length = messageContent[offset++];
                console.log(`数据长度: ${length}`);
                console.log(`数据内容前10字节: [${Array.from(messageContent.slice(offset, offset + 10)).join(', ')}]`);
            }
        }
    }
}

// 解析服务器收到的消息
const serverReceivedData = "eQAAAAgCEnMKJGUwZjgyNTUxLTEyMDctNDAzMy05Y2JiLTAxNTA2ZDQxZWEyMBIDMS4wGgUxLjAuMCIGV2VDaGF0Khh3eGdhbWVfbWc1Y3EzanQ4ZXgyYW13NWwyCnd4Z2FtZV9hcHA6CWpscThyMDg1MED5qNeyCVABGAE=";
decodeBase64Message(serverReceivedData);