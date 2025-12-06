import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SignalingService, SignalingMessageType } from './SignalingService';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({});
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }
}

global.WebSocket = MockWebSocket as any;

describe('SignalingService', () => {
  let service: SignalingService;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    service = new SignalingService({
      serverUrl: 'ws://localhost:8080',
      reconnectInterval: 100,
      heartbeatInterval: 1000,
      maxReconnectAttempts: 3,
    });
  });

  afterEach(() => {
    service.disconnect();
    vi.clearAllTimers();
  });

  describe('Connection', () => {
    it('should connect to signaling server', async () => {
      await service.connect();

      expect(service.isConnectedToServer()).toBe(true);
    });

    it('should trigger onConnectionStateChange callback on connect', async () => {
      const onConnectionStateChange = vi.fn();
      service.setCallbacks({ onConnectionStateChange });

      await service.connect();

      expect(onConnectionStateChange).toHaveBeenCalledWith(true);
    });

    it('should disconnect from signaling server', async () => {
      await service.connect();
      service.disconnect();

      expect(service.isConnectedToServer()).toBe(false);
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      await service.connect();
      mockWs = (service as any).ws;
    });

    it('should join session', () => {
      const sendSpy = vi.spyOn(mockWs, 'send');

      service.joinSession('session1', 'peer1');

      expect(sendSpy).toHaveBeenCalled();
      const message = JSON.parse(sendSpy.mock.calls[0][0]);
      expect(message.type).toBe(SignalingMessageType.JOIN_SESSION);
      expect(message.sessionId).toBe('session1');
      expect(message.peerId).toBe('peer1');
    });

    it('should leave session', () => {
      const sendSpy = vi.spyOn(mockWs, 'send');

      service.joinSession('session1', 'peer1');
      
      // Simulate session joined to set currentSessionId and currentPeerId
      const message = {
        type: SignalingMessageType.SESSION_JOINED,
        sessionId: 'session1',
        peerId: 'peer1',
        data: { existingPeers: [] },
      };
      mockWs.onmessage?.({ data: JSON.stringify(message) });
      
      service.leaveSession();

      const leaveMessage = JSON.parse(sendSpy.mock.calls[1][0]);
      expect(leaveMessage.type).toBe(SignalingMessageType.LEAVE_SESSION);
    });

    it('should handle session joined message', async () => {
      const onSessionJoined = vi.fn();
      service.setCallbacks({ onSessionJoined });

      service.joinSession('session1', 'peer1');

      // Simulate server response
      const message = {
        type: SignalingMessageType.SESSION_JOINED,
        sessionId: 'session1',
        peerId: 'peer1',
        data: { existingPeers: ['peer2', 'peer3'] },
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onSessionJoined).toHaveBeenCalledWith(
        'session1',
        'peer1',
        ['peer2', 'peer3']
      );
      expect(service.getCurrentSessionId()).toBe('session1');
      expect(service.getCurrentPeerId()).toBe('peer1');
    });

    it('should handle peer joined message', async () => {
      const onPeerJoined = vi.fn();
      service.setCallbacks({ onPeerJoined });

      const message = {
        type: SignalingMessageType.PEER_JOINED,
        sessionId: 'session1',
        peerId: 'peer2',
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onPeerJoined).toHaveBeenCalledWith('session1', 'peer2');
    });

    it('should handle peer left message', async () => {
      const onPeerLeft = vi.fn();
      service.setCallbacks({ onPeerLeft });

      const message = {
        type: SignalingMessageType.PEER_LEFT,
        sessionId: 'session1',
        peerId: 'peer2',
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onPeerLeft).toHaveBeenCalledWith('session1', 'peer2');
    });
  });

  describe('WebRTC Signaling', () => {
    beforeEach(async () => {
      await service.connect();
      mockWs = (service as any).ws;
      service.joinSession('session1', 'peer1');
      
      // Simulate session joined to set currentSessionId and currentPeerId
      const message = {
        type: SignalingMessageType.SESSION_JOINED,
        sessionId: 'session1',
        peerId: 'peer1',
        data: { existingPeers: [] },
      };
      mockWs.onmessage?.({ data: JSON.stringify(message) });
    });

    it('should send offer', () => {
      const offer = { type: 'offer' as RTCSdpType, sdp: 'mock-sdp' };
      const sendSpy = vi.spyOn(mockWs, 'send');

      service.sendOffer('peer2', offer);

      expect(sendSpy).toHaveBeenCalled();
      const message = JSON.parse(sendSpy.mock.calls[sendSpy.mock.calls.length - 1][0]);
      expect(message.type).toBe(SignalingMessageType.OFFER);
      expect(message.toPeerId).toBe('peer2');
      expect(message.data).toEqual(offer);
    });

    it('should send answer', () => {
      const answer = { type: 'answer' as RTCSdpType, sdp: 'mock-sdp' };
      const sendSpy = vi.spyOn(mockWs, 'send');

      service.sendAnswer('peer2', answer);

      expect(sendSpy).toHaveBeenCalled();
      const message = JSON.parse(sendSpy.mock.calls[sendSpy.mock.calls.length - 1][0]);
      expect(message.type).toBe(SignalingMessageType.ANSWER);
      expect(message.toPeerId).toBe('peer2');
      expect(message.data).toEqual(answer);
    });

    it('should send ICE candidate', () => {
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };
      const sendSpy = vi.spyOn(mockWs, 'send');

      service.sendIceCandidate('peer2', candidate);

      expect(sendSpy).toHaveBeenCalled();
      const message = JSON.parse(sendSpy.mock.calls[sendSpy.mock.calls.length - 1][0]);
      expect(message.type).toBe(SignalingMessageType.ICE_CANDIDATE);
      expect(message.toPeerId).toBe('peer2');
      expect(message.data).toEqual(candidate);
    });

    it('should handle received offer', () => {
      const onOffer = vi.fn();
      service.setCallbacks({ onOffer });

      const offer = { type: 'offer' as RTCSdpType, sdp: 'remote-sdp' };
      const message = {
        type: SignalingMessageType.OFFER,
        fromPeerId: 'peer2',
        data: offer,
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onOffer).toHaveBeenCalledWith('peer2', offer);
    });

    it('should handle received answer', () => {
      const onAnswer = vi.fn();
      service.setCallbacks({ onAnswer });

      const answer = { type: 'answer' as RTCSdpType, sdp: 'remote-sdp' };
      const message = {
        type: SignalingMessageType.ANSWER,
        fromPeerId: 'peer2',
        data: answer,
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onAnswer).toHaveBeenCalledWith('peer2', answer);
    });

    it('should handle received ICE candidate', () => {
      const onIceCandidate = vi.fn();
      service.setCallbacks({ onIceCandidate });

      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };
      const message = {
        type: SignalingMessageType.ICE_CANDIDATE,
        fromPeerId: 'peer2',
        data: candidate,
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onIceCandidate).toHaveBeenCalledWith('peer2', candidate);
    });

    it('should throw error when sending without session', async () => {
      service.leaveSession();

      expect(() => {
        service.sendOffer('peer2', { type: 'offer', sdp: 'mock-sdp' });
      }).toThrow('Not in a session');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.connect();
      mockWs = (service as any).ws;
    });

    it('should handle error messages', () => {
      const onError = vi.fn();
      service.setCallbacks({ onError });

      const message = {
        type: SignalingMessageType.ERROR,
        data: { message: 'Test error' },
      };

      mockWs.onmessage?.({ data: JSON.stringify(message) });

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toContain('Test error');
    });

    it('should handle invalid JSON messages', () => {
      const onError = vi.fn();
      service.setCallbacks({ onError });

      mockWs.onmessage?.({ data: 'invalid json' });

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Heartbeat', () => {
    it('should send heartbeat messages', () => {
      vi.useFakeTimers();
      
      const testService = new SignalingService({
        serverUrl: 'ws://localhost:8080',
        heartbeatInterval: 1000,
      });

      // Mock WebSocket to avoid actual connection
      const mockSend = vi.fn();
      const mockClose = vi.fn();
      (testService as any).ws = {
        readyState: 1, // OPEN
        send: mockSend,
        close: mockClose,
      };
      (testService as any).isConnected = true;
      (testService as any).startHeartbeat();

      // Fast-forward time past heartbeat interval
      vi.advanceTimersByTime(1100);

      expect(mockSend).toHaveBeenCalled();
      const message = JSON.parse(mockSend.mock.calls[0][0]);
      expect(message.type).toBe(SignalingMessageType.HEARTBEAT);

      testService.disconnect();
      expect(mockClose).toHaveBeenCalled();
      
      vi.useRealTimers();
    });
  });
});
