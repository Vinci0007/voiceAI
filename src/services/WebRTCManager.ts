/**
 * WebRTCManager - 协调 WebRTC 和信令服务
 * 
 * 职责：
 * - 整合 WebRTC 和信令服务
 * - 管理会话建立流程
 * - 处理多对等方连接
 * - 协调音频流的发送和接收
 */

import { WebRTCService, WebRTCConfig, WebRTCCallbacks } from './WebRTCService';
import { SignalingService, SignalingConfig, SignalingCallbacks } from './SignalingService';
import { SessionMode } from '@/types';

export interface WebRTCManagerConfig {
  signalingServerUrl: string;
  iceServers?: RTCIceServer[];
  audioConstraints?: MediaStreamConstraints['audio'];
}

export interface WebRTCManagerCallbacks {
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onPeerConnected?: (peerId: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onSessionJoined?: (sessionId: string, peerId: string) => void;
  onError?: (error: Error) => void;
}

export class WebRTCManager {
  private webrtcService: WebRTCService;
  private signalingService: SignalingService;
  private callbacks: WebRTCManagerCallbacks = {};
  private sessionMode: SessionMode | null = null;
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

  constructor(config: WebRTCManagerConfig) {
    // 初始化 WebRTC 服务
    const webrtcConfig: Partial<WebRTCConfig> = {
      iceServers: config.iceServers,
      audioConstraints: config.audioConstraints,
    };
    this.webrtcService = new WebRTCService(webrtcConfig);

    // 初始化信令服务
    const signalingConfig: SignalingConfig = {
      serverUrl: config.signalingServerUrl,
    };
    this.signalingService = new SignalingService(signalingConfig);

    // 设置回调
    this.setupWebRTCCallbacks();
    this.setupSignalingCallbacks();
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: WebRTCManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 设置 WebRTC 服务回调
   */
  private setupWebRTCCallbacks(): void {
    const callbacks: WebRTCCallbacks = {
      onRemoteStream: (peerId, stream) => {
        console.log(`Received remote stream from ${peerId}`);
        this.callbacks.onRemoteStream?.(peerId, stream);
      },

      onPeerConnected: (peerId) => {
        console.log(`Peer ${peerId} connected`);
        this.callbacks.onPeerConnected?.(peerId);
      },

      onPeerDisconnected: (peerId) => {
        console.log(`Peer ${peerId} disconnected`);
        this.callbacks.onPeerDisconnected?.(peerId);
      },

      onConnectionStateChange: (peerId, state) => {
        console.log(`Connection state for ${peerId}: ${state}`);
      },

      onError: (error) => {
        console.error('WebRTC error:', error);
        this.callbacks.onError?.(error);
      },
    };

    this.webrtcService.setCallbacks(callbacks);
  }

  /**
   * 设置信令服务回调
   */
  private setupSignalingCallbacks(): void {
    const callbacks: SignalingCallbacks = {
      onSessionJoined: async (sessionId, peerId, existingPeers) => {
        console.log(`Joined session ${sessionId} as ${peerId}`);
        console.log(`Existing peers:`, existingPeers);
        this.callbacks.onSessionJoined?.(sessionId, peerId);

        // 与现有对等方建立连接（作为发起方）
        for (const existingPeerId of existingPeers) {
          await this.initiateConnection(existingPeerId);
        }
      },

      onPeerJoined: async (sessionId, peerId) => {
        console.log(`Peer ${peerId} joined session ${sessionId}`);
        // 新对等方加入，等待他们发起连接
        // 我们不需要做任何事情，因为新加入的对等方会向我们发送 offer
      },

      onPeerLeft: async (sessionId, peerId) => {
        console.log(`Peer ${peerId} left session ${sessionId}`);
        await this.webrtcService.closePeerConnection(peerId);
        this.pendingIceCandidates.delete(peerId);
      },

      onOffer: async (fromPeerId, offer) => {
        console.log(`Received offer from ${fromPeerId}`);
        await this.handleOffer(fromPeerId, offer);
      },

      onAnswer: async (fromPeerId, answer) => {
        console.log(`Received answer from ${fromPeerId}`);
        await this.handleAnswer(fromPeerId, answer);
      },

      onIceCandidate: async (fromPeerId, candidate) => {
        console.log(`Received ICE candidate from ${fromPeerId}`);
        await this.handleIceCandidate(fromPeerId, candidate);
      },

      onError: (error) => {
        console.error('Signaling error:', error);
        this.callbacks.onError?.(error);
      },

      onConnectionStateChange: (connected) => {
        console.log(`Signaling connection state: ${connected ? 'connected' : 'disconnected'}`);
      },
    };

    this.signalingService.setCallbacks(callbacks);
  }

  /**
   * 初始化并连接到信令服务器
   */
  async initialize(): Promise<void> {
    try {
      // 初始化本地音频流
      await this.webrtcService.initializeLocalStream();
      console.log('Local audio stream initialized');

      // 连接到信令服务器
      await this.signalingService.connect();
      console.log('Connected to signaling server');
    } catch (error) {
      const err = new Error(`Failed to initialize WebRTC manager: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 加入会话
   */
  async joinSession(sessionId: string, peerId: string, mode: SessionMode): Promise<void> {
    this.sessionMode = mode;
    this.signalingService.joinSession(sessionId, peerId);
  }

  /**
   * 离开会话
   */
  async leaveSession(): Promise<void> {
    // 关闭所有对等连接
    const peerConnections = this.webrtcService.getAllPeerConnections();
    for (const [peerId] of peerConnections) {
      await this.webrtcService.closePeerConnection(peerId);
    }

    // 清空待处理的 ICE 候选
    this.pendingIceCandidates.clear();

    // 离开信令会话
    this.signalingService.leaveSession();

    this.sessionMode = null;
  }

  /**
   * 发起与对等方的连接（作为发起方）
   */
  private async initiateConnection(peerId: string): Promise<void> {
    try {
      // 创建对等连接
      await this.webrtcService.createPeerConnection(peerId, true);

      // 创建并发送 offer
      const offer = await this.webrtcService.createOffer(peerId);
      this.signalingService.sendOffer(peerId, offer);

      console.log(`Sent offer to ${peerId}`);
    } catch (error) {
      console.error(`Failed to initiate connection with ${peerId}:`, error);
      this.callbacks.onError?.(new Error(`Failed to connect to peer ${peerId}`));
    }
  }

  /**
   * 处理接收到的 Offer
   */
  private async handleOffer(
    fromPeerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      // 创建对等连接（作为接收方）
      await this.webrtcService.createPeerConnection(fromPeerId, false);

      // 设置远程描述
      await this.webrtcService.setRemoteDescription(fromPeerId, offer);

      // 创建并发送 answer
      const answer = await this.webrtcService.createAnswer(fromPeerId);
      this.signalingService.sendAnswer(fromPeerId, answer);

      // 处理待处理的 ICE 候选
      await this.processPendingIceCandidates(fromPeerId);

      console.log(`Sent answer to ${fromPeerId}`);
    } catch (error) {
      console.error(`Failed to handle offer from ${fromPeerId}:`, error);
      this.callbacks.onError?.(new Error(`Failed to handle offer from ${fromPeerId}`));
    }
  }

  /**
   * 处理接收到的 Answer
   */
  private async handleAnswer(
    fromPeerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      // 设置远程描述
      await this.webrtcService.setRemoteDescription(fromPeerId, answer);

      // 处理待处理的 ICE 候选
      await this.processPendingIceCandidates(fromPeerId);

      console.log(`Processed answer from ${fromPeerId}`);
    } catch (error) {
      console.error(`Failed to handle answer from ${fromPeerId}:`, error);
      this.callbacks.onError?.(new Error(`Failed to handle answer from ${fromPeerId}`));
    }
  }

  /**
   * 处理接收到的 ICE Candidate
   */
  private async handleIceCandidate(
    fromPeerId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    try {
      const connectionState = this.webrtcService.getConnectionState(fromPeerId);

      // 如果远程描述还未设置，将候选存储起来
      if (!connectionState || connectionState === 'new') {
        if (!this.pendingIceCandidates.has(fromPeerId)) {
          this.pendingIceCandidates.set(fromPeerId, []);
        }
        this.pendingIceCandidates.get(fromPeerId)!.push(candidate);
        console.log(`Queued ICE candidate from ${fromPeerId}`);
      } else {
        // 否则直接添加
        await this.webrtcService.addIceCandidate(fromPeerId, candidate);
        console.log(`Added ICE candidate from ${fromPeerId}`);
      }
    } catch (error) {
      console.error(`Failed to handle ICE candidate from ${fromPeerId}:`, error);
    }
  }

  /**
   * 处理待处理的 ICE 候选
   */
  private async processPendingIceCandidates(peerId: string): Promise<void> {
    const candidates = this.pendingIceCandidates.get(peerId);
    if (!candidates || candidates.length === 0) {
      return;
    }

    console.log(`Processing ${candidates.length} pending ICE candidates for ${peerId}`);

    for (const candidate of candidates) {
      try {
        await this.webrtcService.addIceCandidate(peerId, candidate);
      } catch (error) {
        console.error(`Failed to add pending ICE candidate:`, error);
      }
    }

    this.pendingIceCandidates.delete(peerId);
  }

  /**
   * 静音/取消静音本地音频
   */
  muteLocalAudio(muted: boolean): void {
    this.webrtcService.muteLocalAudio(muted);
  }

  /**
   * 获取本地音频流
   */
  getLocalStream(): MediaStream | null {
    return this.webrtcService.getLocalStream();
  }

  /**
   * 获取远程音频流
   */
  getRemoteStream(peerId: string): MediaStream | null {
    return this.webrtcService.getRemoteStream(peerId);
  }

  /**
   * 获取所有远程音频流
   */
  getAllRemoteStreams(): Map<string, MediaStream> {
    const streams = new Map<string, MediaStream>();
    const peerConnections = this.webrtcService.getAllPeerConnections();

    for (const [peerId, peerConnection] of peerConnections) {
      if (peerConnection.remoteStream) {
        streams.set(peerId, peerConnection.remoteStream);
      }
    }

    return streams;
  }

  /**
   * 发送数据通道消息
   */
  sendDataToAllPeers(data: any): void {
    const peerConnections = this.webrtcService.getAllPeerConnections();
    for (const [peerId] of peerConnections) {
      try {
        this.webrtcService.sendDataChannelMessage(peerId, data);
      } catch (error) {
        console.error(`Failed to send data to ${peerId}:`, error);
      }
    }
  }

  /**
   * 发送数据通道消息给特定对等方
   */
  sendDataToPeer(peerId: string, data: any): void {
    this.webrtcService.sendDataChannelMessage(peerId, data);
  }

  /**
   * 获取当前会话模式
   */
  getSessionMode(): SessionMode | null {
    return this.sessionMode;
  }

  /**
   * 检查是否已连接到信令服务器
   */
  isConnectedToSignaling(): boolean {
    return this.signalingService.isConnectedToServer();
  }

  /**
   * 获取当前会话 ID
   */
  getCurrentSessionId(): string | null {
    return this.signalingService.getCurrentSessionId();
  }

  /**
   * 获取当前对等方 ID
   */
  getCurrentPeerId(): string | null {
    return this.signalingService.getCurrentPeerId();
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    // 离开会话
    await this.leaveSession();

    // 断开信令连接
    this.signalingService.disconnect();

    // 清理 WebRTC 资源
    await this.webrtcService.cleanup();

    console.log('WebRTC manager cleaned up');
  }
}
