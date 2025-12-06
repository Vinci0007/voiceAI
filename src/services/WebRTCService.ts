/**
 * WebRTCService - 管理 WebRTC P2P 音频传输
 * 
 * 职责：
 * - 建立和管理 WebRTC 对等连接
 * - 处理音频流的发送和接收
 * - 管理 ICE 候选和连接状态
 * - 与信令服务器通信
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
  audioConstraints?: MediaStreamConstraints['audio'];
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  dataChannel: RTCDataChannel | null;
}

export interface WebRTCCallbacks {
  onRemoteStream?: (peerId: string, stream: MediaStream) => void;
  onPeerConnected?: (peerId: string) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onDataChannelMessage?: (peerId: string, data: any) => void;
  onConnectionStateChange?: (peerId: string, state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export class WebRTCService {
  private config: WebRTCConfig;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, PeerConnection> = new Map();
  private callbacks: WebRTCCallbacks = {};

  constructor(config?: Partial<WebRTCConfig>) {
    this.config = {
      iceServers: config?.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      audioConstraints: config?.audioConstraints || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      },
    };
  }

  /**
   * 设置回调函数
   */
  setCallbacks(callbacks: WebRTCCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 初始化本地音频流
   */
  async initializeLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: this.config.audioConstraints,
        video: false,
      });

      return this.localStream;
    } catch (error) {
      const err = new Error(`Failed to get local media stream: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 获取本地音频流
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * 创建与对等方的连接
   */
  async createPeerConnection(
    peerId: string,
    isInitiator: boolean = false
  ): Promise<RTCPeerConnection> {
    // 如果已存在连接，先关闭
    if (this.peerConnections.has(peerId)) {
      await this.closePeerConnection(peerId);
    }

    // 创建新的 RTCPeerConnection
    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });

    // 创建 PeerConnection 对象
    const peerConnection: PeerConnection = {
      peerId,
      connection,
      remoteStream: null,
      dataChannel: null,
    };

    // 添加本地音频流
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        connection.addTrack(track, this.localStream!);
      });
    }

    // 设置事件处理器
    this.setupConnectionHandlers(peerConnection);

    // 如果是发起方，创建数据通道
    if (isInitiator) {
      peerConnection.dataChannel = connection.createDataChannel('data', {
        ordered: true,
      });
      this.setupDataChannelHandlers(peerConnection);
    }

    // 存储连接
    this.peerConnections.set(peerId, peerConnection);

    return connection;
  }

  /**
   * 设置连接事件处理器
   */
  private setupConnectionHandlers(peerConnection: PeerConnection): void {
    const { peerId, connection } = peerConnection;

    // ICE 候选事件
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        // ICE 候选应该通过信令服务器发送给对方
        // 这里只是记录，实际发送由 SignalingService 处理
        console.log(`ICE candidate for ${peerId}:`, event.candidate);
      }
    };

    // 连接状态变化
    connection.onconnectionstatechange = () => {
      console.log(`Connection state for ${peerId}: ${connection.connectionState}`);
      this.callbacks.onConnectionStateChange?.(peerId, connection.connectionState);

      if (connection.connectionState === 'connected') {
        this.callbacks.onPeerConnected?.(peerId);
      } else if (
        connection.connectionState === 'disconnected' ||
        connection.connectionState === 'failed' ||
        connection.connectionState === 'closed'
      ) {
        this.callbacks.onPeerDisconnected?.(peerId);
      }
    };

    // ICE 连接状态变化
    connection.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${peerId}: ${connection.iceConnectionState}`);
    };

    // 接收远程音频流
    connection.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      if (event.streams && event.streams[0]) {
        peerConnection.remoteStream = event.streams[0];
        this.callbacks.onRemoteStream?.(peerId, event.streams[0]);
      }
    };

    // 数据通道（接收方）
    connection.ondatachannel = (event) => {
      peerConnection.dataChannel = event.channel;
      this.setupDataChannelHandlers(peerConnection);
    };
  }

  /**
   * 设置数据通道事件处理器
   */
  private setupDataChannelHandlers(peerConnection: PeerConnection): void {
    const { peerId, dataChannel } = peerConnection;
    if (!dataChannel) return;

    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
    };

    dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.callbacks.onDataChannelMessage?.(peerId, data);
      } catch (error) {
        console.error(`Failed to parse data channel message from ${peerId}:`, error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };
  }

  /**
   * 创建 Offer
   */
  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      const offer = await peerConnection.connection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await peerConnection.connection.setLocalDescription(offer);
      return offer;
    } catch (error) {
      const err = new Error(`Failed to create offer for ${peerId}: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 创建 Answer
   */
  async createAnswer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      const answer = await peerConnection.connection.createAnswer();
      await peerConnection.connection.setLocalDescription(answer);
      return answer;
    } catch (error) {
      const err = new Error(`Failed to create answer for ${peerId}: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 设置远程描述
   */
  async setRemoteDescription(
    peerId: string,
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      await peerConnection.connection.setRemoteDescription(
        new RTCSessionDescription(description)
      );
    } catch (error) {
      const err = new Error(`Failed to set remote description for ${peerId}: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 添加 ICE 候选
   */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) {
      throw new Error(`Peer connection not found for ${peerId}`);
    }

    try {
      await peerConnection.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      const err = new Error(`Failed to add ICE candidate for ${peerId}: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 通过数据通道发送消息
   */
  sendDataChannelMessage(peerId: string, data: any): void {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection || !peerConnection.dataChannel) {
      throw new Error(`Data channel not available for ${peerId}`);
    }

    if (peerConnection.dataChannel.readyState !== 'open') {
      throw new Error(`Data channel not open for ${peerId}`);
    }

    try {
      peerConnection.dataChannel.send(JSON.stringify(data));
    } catch (error) {
      const err = new Error(`Failed to send data to ${peerId}: ${error}`);
      this.callbacks.onError?.(err);
      throw err;
    }
  }

  /**
   * 获取远程音频流
   */
  getRemoteStream(peerId: string): MediaStream | null {
    const peerConnection = this.peerConnections.get(peerId);
    return peerConnection?.remoteStream || null;
  }

  /**
   * 获取所有对等连接
   */
  getAllPeerConnections(): Map<string, PeerConnection> {
    return new Map(this.peerConnections);
  }

  /**
   * 获取连接状态
   */
  getConnectionState(peerId: string): RTCPeerConnectionState | null {
    const peerConnection = this.peerConnections.get(peerId);
    return peerConnection?.connection.connectionState || null;
  }

  /**
   * 静音/取消静音本地音频
   */
  muteLocalAudio(muted: boolean): void {
    if (!this.localStream) {
      return;
    }

    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  /**
   * 关闭与特定对等方的连接
   */
  async closePeerConnection(peerId: string): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) {
      return;
    }

    // 关闭数据通道
    if (peerConnection.dataChannel) {
      peerConnection.dataChannel.close();
    }

    // 关闭连接
    peerConnection.connection.close();

    // 从映射中移除
    this.peerConnections.delete(peerId);

    console.log(`Closed peer connection with ${peerId}`);
  }

  /**
   * 关闭所有连接并清理资源
   */
  async cleanup(): Promise<void> {
    // 关闭所有对等连接
    const peerIds = Array.from(this.peerConnections.keys());
    for (const peerId of peerIds) {
      await this.closePeerConnection(peerId);
    }

    // 停止本地音频流
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // 清空回调
    this.callbacks = {};

    console.log('WebRTC service cleaned up');
  }
}
