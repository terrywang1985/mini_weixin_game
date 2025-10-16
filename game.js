// 为微信小游戏环境添加TextEncoder polyfill（在所有模块加载之前）
if (typeof wx !== 'undefined' && typeof TextEncoder === 'undefined') {
  // 简单的TextEncoder polyfill实现
  global.TextEncoder = class {
    encode(string) {
      if (typeof string !== 'string') {
        throw new TypeError('Expected string argument');
      }
      
      // 在微信小游戏中，我们使用简单的UTF-8编码模拟
      const bytes = [];
      for (let i = 0; i < string.length; i++) {
        const codePoint = string.charCodeAt(i);
        
        if (codePoint < 0x80) {
          bytes.push(codePoint);
        } else if (codePoint < 0x800) {
          bytes.push(0xC0 | (codePoint >> 6));
          bytes.push(0x80 | (codePoint & 0x3F));
        } else if (codePoint < 0x10000) {
          bytes.push(0xE0 | (codePoint >> 12));
          bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
          bytes.push(0x80 | (codePoint & 0x3F));
        } else {
          bytes.push(0xF0 | (codePoint >> 18));
          bytes.push(0x80 | ((codePoint >> 12) & 0x3F));
          bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
          bytes.push(0x80 | (codePoint & 0x3F));
        }
      }
      
      return new Uint8Array(bytes);
    }
  };
  
  // 同时添加TextDecoder polyfill
  global.TextDecoder = class {
    decode(bytes) {
      if (!(bytes instanceof Uint8Array) && !Array.isArray(bytes)) {
        throw new TypeError('Expected Uint8Array or Array argument');
      }
      
      // 简单的UTF-8解码实现
      let string = '';
      let i = 0;
      
      while (i < bytes.length) {
        const byte1 = bytes[i++];
        let codePoint;
        
        if ((byte1 & 0x80) === 0) {
          // 单字节字符
          codePoint = byte1;
        } else if ((byte1 & 0xE0) === 0xC0) {
          // 双字节字符
          const byte2 = bytes[i++];
          codePoint = ((byte1 & 0x1F) << 6) | (byte2 & 0x3F);
        } else if ((byte1 & 0xF0) === 0xE0) {
          // 三字节字符
          const byte2 = bytes[i++];
          const byte3 = bytes[i++];
          codePoint = ((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F);
        } else if ((byte1 & 0xF8) === 0xF0) {
          // 四字节字符
          const byte2 = bytes[i++];
          const byte3 = bytes[i++];
          const byte4 = bytes[i++];
          codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
        } else {
          // 无效的UTF-8序列
          continue;
        }
        
        string += String.fromCodePoint(codePoint);
      }
      
      return string;
    }
  };
}

import Main from './js/main.js';

new Main();