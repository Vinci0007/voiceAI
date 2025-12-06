/**
 * WebRTCManager 使用示例
 * 
 * 本文件展示如何使用 WebRTCManager 实现实时音频通信
 */

import { WebRTCManager } from './WebRTCManager';
import { SessionMode } from '@/types';

// ============================================================================
// 示例 1: 基本的一对一聊天
// ============================================================================

async function example1_BasicChat() {
  console.log('=== 示例 1: 基本的一对一聊天 ===\n');

  // 创建 WebRTC 管理器
  const manager = new WebRTCManager({
    signalingServerUrl: 'ws://localhost:8080',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  });

  // 设置回调
  manager.setCallbacks({
    onRemoteStream: (peerId, stream) => {
      console.log(`收到来自 ${peerId} 的音频流`);
      
      // 播放远程音频
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play();
    },
    
    onPeerConnected: (peerId) => {
      console.log(`已连接到 ${peerId}`);
    },
    
    onPeerDisconnected: (peerId) => {
      console.log(`与 ${peerId} 断开连接`);
    },
    
    onSessionJoined: (sessionId, peerId) => {
      console.log(`已加入会话 ${sessionId}，您的 ID: ${peerId}`);
    },
    
    onError: (error) => {
      console.error('错误:', error.message);
    },
  });

  try {
    // 初始化（获取麦克风权限并连接信令服务器）
    await manager.initialize();
    console.log('初始化成功');

    // 加入聊天会话
    await manager.joinSession('chat-room-1', 'user-alice', SessionMode.CHAT);
    console.log('已加入聊天会话');

    // 模拟聊天 30 秒
    await new Promise(resolve => setTimeout(resolve, 30000));

    // 离开会话
    await manager.leaveSession();
    console.log('已离开会话');

    // 清理资源
    await manager.cleanup();
    console.log('资源已清理');
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// ============================================================================
// 示例 2: 多人会议
// ============================================================================

async function example2_Conference() {
  console.log('=== 示例 2: 多人会议 ===\n');

  const manager = new WebRTCManager({
    signalingServerUrl: 'ws://localhost:8080',
  });

  // 存储远程音频元素
  const remoteAudios = new Map<string, HTMLAudioElement>();

  manager.setCallbacks({
    onRemoteStream: (peerId, stream) => {
      console.log(`收到来自 ${peerId} 的音频流`);
      
      // 为每个参与者创建独立的音频元素
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play();
      
      remoteAudios.set(peerId, audio);
    },
    
    onPeerConnected: (peerId) => {
      console.log(`参与者 ${peerId} 已连接`);
    },
    
    onPeerDisconnected: (peerId) => {
      console.log(`参与者 ${peerId} 已断开`);
      
      // 清理音频元素
      const audio = remoteAudios.get(peerId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        remoteAudios.delete(peerId);
      }
    },
    
    onSessionJoined: (sessionId, peerId) => {
      console.log(`已加入会议 ${sessionId}，您的 ID: ${peerId}`);
    },
  });

  try {
    await manager.initialize();
    
    // 加入会议会话
    await manager.joinSession('conference-1', 'user-bob', SessionMode.CONFERENCE);
    console.log('已加入会议');

    // 模拟会议 60 秒
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 离开会议
    await manager.leaveSession();
    
    // 清理所有音频元素
    remoteAudios.forEach(audio => {
      audio.pause();
      audio.srcObject = null;
    });
    remoteAudios.clear();

    await manager.cleanup();
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// ============================================================================
// 示例 3: 静音控制
// ============================================================================

async function example3_MuteControl() {
  console.log('=== 示例 3: 静音控制 ===\n');

  const manager = new WebRTCManager({
    signalingServerUrl: 'ws://localhost:8080',
  });

  manager.setCallbacks({
    onRemoteStream: (peerId, stream) => {
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play();
    },
  });

  try {
    await manager.initialize();
    await manager.joinSession('chat-room-2', 'user-charlie', SessionMode.CHAT);

    // 正常说话 5 秒
    console.log('正常说话中...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 静音 5 秒
    console.log('静音中...');
    manager.muteLocalAudio(true);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 取消静音
    console.log('取消静音');
    manager.muteLocalAudio(false);
    await new Promise(resolve => setTimeout(resolve, 5000));

    await manager.leaveSession();
    await manager.cleanup();
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// ============================================================================
// 示例 4: 数据通道通信
// ============================================================================

async function example4_DataChannel() {
  console.log('=== 示例 4: 数据通道通信 ===\n');

  const manager = new WebRTCManager({
    signalingServerUrl: 'ws://localhost:8080',
  });

  manager.setCallbacks({
    onRemoteStream: (peerId, stream) => {
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play();
    },
    
    onPeerConnected: (peerId) => {
      console.log(`${peerId} 已连接，发送欢迎消息`);
      
      // 发送欢迎消息
      manager.sendDataToPeer(peerId, {
        type: 'greeting',
        message: 'Hello! Welcome to the chat.',
      });
    },
  });

  try {
    await manager.initialize();
    await manager.joinSession('chat-room-3', 'user-david', SessionMode.CHAT);

    // 定期发送心跳消息
    const heartbeatInterval = setInterval(() => {
      try {
        manager.sendDataToAllPeers({
          type: 'heartbeat',
          timestamp: Date.now(),
        });
        console.log('发送心跳消息');
      } catch (error) {
        console.error('发送心跳失败:', error);
      }
    }, 10000);

    // 运行 30 秒
    await new Promise(resolve => setTimeout(resolve, 30000));

    clearInterval(heartbeatInterval);
    await manager.leaveSession();
    await manager.cleanup();
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// ============================================================================
// 示例 5: 错误处理和重连
// ============================================================================

async function example5_ErrorHandling() {
  console.log('=== 示例 5: 错误处理和重连 ===\n');

  const manager = new WebRTCManager({
    signalingServerUrl: 'ws://localhost:8080',
  });

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  manager.setCallbacks({
    onRemoteStream: (peerId, stream) => {
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play();
    },
    
    onError: async (error) => {
      console.error('发生错误:', error.message);
      
      // 如果是连接错误，尝试重连
      if (error.message.includes('connection') && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`尝试重连 (${reconnectAttempts}/${maxReconnectAttempts})...`);
        
        try {
          await manager.cleanup();
          await new Promise(resolve => setTimeout(resolve, 3000));
          await manager.initialize();
          await manager.joinSession('chat-room-4', 'user-eve', SessionMode.CHAT);
          
          reconnectAttempts = 0; // 重置计数器
          console.log('重连成功');
        } catch (reconnectError) {
          console.error('重连失败:', reconnectError);
        }
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('达到最大重连次数，放弃重连');
      }
    },
  });

  try {
    await manager.initialize();
    await manager.joinSession('chat-room-4', 'user-eve', SessionMode.CHAT);

    // 运行 60 秒
    await new Promise(resolve => setTimeout(resolve, 60000));

    await manager.leaveSession();
    await manager.cleanup();
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// ============================================================================
// 示例 6: 获取和管理远程流
// ============================================================================

async function example6_ManageRemoteStreams() {
  console.log('=== 示例 6: 获取和管理远程流 ===\n');

  const manager = new WebRTCManager({
    signalingServerUrl: 'ws://localhost:8080',
  });

  manager.setCallbacks({
    onRemoteStream: (peerId, stream) => {
      console.log(`收到来自 ${peerId} 的音频流`);
      displayStreamInfo(peerId, stream);
    },
    
    onPeerConnected: (peerId) => {
      console.log(`${peerId} 已连接`);
      
      // 显示所有当前的远程流
      const allStreams = manager.getAllRemoteStreams();
      console.log(`当前远程流数量: ${allStreams.size}`);
      
      allStreams.forEach((stream, id) => {
        displayStreamInfo(id, stream);
      });
    },
  });

  function displayStreamInfo(peerId: string, stream: MediaStream) {
    const audioTracks = stream.getAudioTracks();
    console.log(`\n流信息 - ${peerId}:`);
    console.log(`  流 ID: ${stream.id}`);
    console.log(`  音频轨道数: ${audioTracks.length}`);
    
    audioTracks.forEach((track, index) => {
      console.log(`  轨道 ${index + 1}:`);
      console.log(`    ID: ${track.id}`);
      console.log(`    标签: ${track.label}`);
      console.log(`    启用: ${track.enabled}`);
      console.log(`    静音: ${track.muted}`);
      console.log(`    就绪状态: ${track.readyState}`);
    });
  }

  try {
    await manager.initialize();
    await manager.joinSession('conference-2', 'user-frank', SessionMode.CONFERENCE);

    // 运行 30 秒
    await new Promise(resolve => setTimeout(resolve, 30000));

    await manager.leaveSession();
    await manager.cleanup();
  } catch (error) {
    console.error('示例执行失败:', error);
  }
}

// ============================================================================
// 运行所有示例
// ============================================================================

export async function runAllExamples() {
  console.log('开始运行 WebRTCManager 示例...\n');

  // 注意：在实际使用中，这些示例应该分别运行
  // 这里只是展示如何使用 API

  // await example1_BasicChat();
  // await example2_Conference();
  // await example3_MuteControl();
  // await example4_DataChannel();
  // await example5_ErrorHandling();
  // await example6_ManageRemoteStreams();

  console.log('\n所有示例运行完毕');
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}
