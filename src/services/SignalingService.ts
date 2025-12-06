/**
 * SignalingService - 管理 WebSocket 信令通信
 * 
 * 职责：
 * - 建立和维护 WebSocket 连接
 * - 发送和接收信令消息（offer, answer, ICE candidates）
 * - 管理会话建立和参与者加入/离开
 * - 处理连接状态和错误
 */

export enum SignalingMessageType {
  // 会话管理
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SESSION_JOINED = 'session_joined',
  PEER_JOINED = 'peer_joined',
  PEER_LEFT = 'peer_left',

  // WebRTC 信令
  OFFER = 'offer',
  ANSWER = 'answer',
  ICE_CANDIDATE = 'ice_candidate',

  // 错误和状态
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
}

export interface SignalingMessage {
  type: SignalingMessageType;
  sessionId?: string;
  peerId?: string;
  fromPeerId?: string;
  toPeerId?: string;
  data?: any;
  timestamp?: number;
}

export interface SignalingCallbacks {
  onSessionJoined?: (sessionId: string, peerId: string, existingPeers: string[]) => void;
  onPeerJoined?: (sessionId: string, peerId: string) => void;
  onPeerLeft?: (sessionId: string, peerId: string) => void;
  onOffer?: (fromPeerId: string, offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (fromPeerId: string, answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (fromPeerId: string, candidate: RTCIceCandidateInit) => void;
  onError?: (error: Error) => void;
  onConnectionStateChange?: (connected: boolean) => void;
}

export interface SignalingConfig {
  serverUrl: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  maxReconnectAttempts?: number;
}

export class SignalingService {
  private config: SignalingConfig;
  private ws: WebSocket | null = null;
  private callbacks: SignalingCallbacks = {};
  private currentSessionId: string | null = null;
  private currentPeerId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;

  constructor(config: SignalingConfig) {
    this.config = {
      reconnectInterval: config.reconnectInterval || 3000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      ...config,
    };
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: SignalingCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 连接到信令服务器
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl);

        this.ws.onopen = () => {
          console.log('Connected to signaling server');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.callbacks.onConnectionStateChange?.(true);
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          const err = new Error('WebSocket connection error');
          this.callbacks.onError?.(err);
          reject(err);
        };

        this.ws.onclose = () => {
          console.log('Disconnected from signaling server');
          this.isConnected = false;
          this.callbacks.onConnectionStateChange?.(false);
          this.stopHeartbeat();
          this.attemptReconnect();
        };
      } catch (error) {
        const err = new Error(`Failed to connect to signaling server: ${error}`);
        this.callbacks.onError?.(err);
        reject(err);
      }
    });
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const message: SignalingMessage = JSON.parse(data);

      switch (message.type) {
        case SignalingMessageType.SESSION_JOINED:
          this.currentSessionId = message.sessionId || null;
          this.currentPeerId = message.peerId || null;
          this.callbacks.onSessionJoined?.(
            message.sessionId!,
            message.peerId!,
            message.data?.existingPeers || []
          );
          break;

        case SignalingMessageType.PEER_JOINED:
          this.callbacks.onPeerJoined?.(message.sessionId!, message.peerId!);
          break;

        case SignalingMessageType.PEER_LEFT:
          this.callbacks.onPeerLeft?.(message.sessionId!, message.peerId!);
          break;

        case SignalingMessageType.OFFER:
          this.callbacks.onOffer?.(message.fromPeerId!, message.data);
          break;

        case SignalingMessageType.ANSWER:
          this.callbacks.onAnswer?.(message.fromPeerId!, message.data);
          break;

        case SignalingMessageType.ICE_CANDIDATE:
          this.callbacks.onIceCandidate?.(message.fromPeerId!, message.data);
          break;

        case SignalingMessageType.ERROR:
          const error = new Error(message.data?.message || 'Signaling error');
          this.callbacks.onError?.(error);
          break;

        case SignalingMessageType.HEARTBEAT:
          // 心跳响应，不需要处理
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to parse signaling message:', error);
      this.callbacks.onError?.(new Error('Failed to parse signaling message'));
    }
  }

  /**
   * 发送消息到信令服务器
   */
  private sendMessage(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    message.timestamp = Date.now();
    this.ws.send(JSON.stringify(message));
  }

  /**
   * 加入会话
   */
  joinSession(sessionId: string, peerId: string): void {
    this.sendMessage({
      type: SignalingMessageType.JOIN_SESSION,
      sessionId,
      peerId,
    });
  }

  /**
   * 离开会话
   */
  leaveSession(): void {
    if (!this.currentSessionId || !this.currentPeerId) {
      return;
    }

    this.sendMessage({
      type: SignalingMessageType.LEAVE_SESSION,
      sessionId: this.currentSessionId,
      peerId: this.currentPeerId,
    });

    this.currentSessionId = null;
    this.currentPeerId = null;
  }

  /**
   * 发送 Offer
   */
  sendOffer(toPeerId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.currentSessionId || !this.currentPeerId) {
      throw new Error('Not in a session');
    }

    this.sendMessage({
      type: SignalingMessageType.OFFER,
      sessionId: this.currentSessionId,
      fromPeerId: this.currentPeerId,
      toPeerId,
      data: offer,
    });
  }

  /**
   * 发送 Answer
   */
  sendAnswer(toPeerId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.currentSessionId || !this.currentPeerId) {
      throw new Error('Not in a session');
    }

    this.sendMessage({
      type: SignalingMessageType.ANSWER,
      sessionId: this.currentSessionId,
      fromPeerId: this.currentPeerId,
      toPeerId,
      data: answer,
    });
  }

  /**
   * 发送 ICE Candidate
   */
  sendIceCandidate(toPeerId: string, candidate: RTCIceCandidateInit): void {
    if (!this.currentSessionId || !this.currentPeerId) {
      throw new Error('Not in a session');
    }

    this.sendMessage({
      type: SignalingMessageType.ICE_CANDIDATE,
      sessionId: this.currentSessionId,
      fromPeerId: this.currentPeerId,
      toPeerId,
      data: candidate,
    });
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({
          type: SignalingMessageType.HEARTBEAT,
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 尝试重新连接
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      console.error('Max reconnect attempts reached');
      this.callbacks.onError?.(new Error('Failed to reconnect to signaling server'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, this.config.reconnectInterval);
  }

  /**
   * 获取当前会话 ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * 获取当前对等方 ID
   */
  getCurrentPeerId(): string | null {
    return this.currentPeerId;
  }

  /**
   * 检查是否已连接
   */
  isConnectedToServer(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 断开连接并清理资源
   */
  disconnect(): void {
    // 停止重连和心跳
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();

    // 离开当前会话
    if (this.currentSessionId) {
      try {
        this.leaveSession();
      } catch (error) {
        console.error('Error leaving session:', error);
      }
    }

    // 关闭 WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.currentSessionId = null;
    this.currentPeerId = null;
    this.reconnectAttempts = 0;

    console.log('Signaling service disconnected');
  }
}
