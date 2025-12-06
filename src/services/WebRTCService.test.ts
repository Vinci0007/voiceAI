import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebRTCService } from './WebRTCService';

// Mock WebRTC APIs
global.RTCPeerConnection = vi.fn().mockImplementation(() => ({
  addTrack: vi.fn(),
  createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
  createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp' }),
  setLocalDescription: vi.fn().mockResolvedValue(undefined),
  setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  addIceCandidate: vi.fn().mockResolvedValue(undefined),
  createDataChannel: vi.fn().mockReturnValue({
    readyState: 'open',
    send: vi.fn(),
    close: vi.fn(),
  }),
  close: vi.fn(),
  connectionState: 'new',
  iceConnectionState: 'new',
})) as any;

global.RTCSessionDescription = vi.fn().mockImplementation((desc) => desc) as any;
global.RTCIceCandidate = vi.fn().mockImplementation((candidate) => candidate) as any;

// Mock MediaStream
const mockMediaStream = {
  getTracks: vi.fn().mockReturnValue([
    { kind: 'audio', enabled: true, stop: vi.fn() },
  ]),
  getAudioTracks: vi.fn().mockReturnValue([
    { kind: 'audio', enabled: true, stop: vi.fn() },
  ]),
} as any;

global.navigator = {
  mediaDevices: {
    getUserMedia: vi.fn().mockResolvedValue(mockMediaStream),
  },
} as any;

describe('WebRTCService', () => {
  let service: WebRTCService;

  beforeEach(() => {
    service = new WebRTCService();
    vi.clearAllMocks();
  });

  describe('Local Stream Management', () => {
    it('should initialize local audio stream', async () => {
      const stream = await service.initializeLocalStream();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: expect.any(Object),
        video: false,
      });
      expect(stream).toBeDefined();
      expect(service.getLocalStream()).toBe(stream);
    });

    it('should throw error if getUserMedia fails', async () => {
      const error = new Error('Permission denied');
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(error);

      await expect(service.initializeLocalStream()).rejects.toThrow(
        'Failed to get local media stream'
      );
    });

    it('should mute and unmute local audio', async () => {
      await service.initializeLocalStream();
      const tracks = mockMediaStream.getAudioTracks();

      service.muteLocalAudio(true);
      expect(tracks[0].enabled).toBe(false);

      service.muteLocalAudio(false);
      expect(tracks[0].enabled).toBe(true);
    });
  });

  describe('Peer Connection Management', () => {
    it('should create peer connection', async () => {
      await service.initializeLocalStream();
      const connection = await service.createPeerConnection('peer1', true);

      expect(connection).toBeDefined();
      expect(RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: expect.any(Array),
      });
    });

    it('should add local tracks to peer connection', async () => {
      await service.initializeLocalStream();
      const connection = await service.createPeerConnection('peer1', true);

      expect(connection.addTrack).toHaveBeenCalled();
    });

    it('should create data channel for initiator', async () => {
      await service.initializeLocalStream();
      const connection = await service.createPeerConnection('peer1', true);

      expect(connection.createDataChannel).toHaveBeenCalledWith('data', {
        ordered: true,
      });
    });

    it('should not create data channel for non-initiator', async () => {
      await service.initializeLocalStream();
      const connection = await service.createPeerConnection('peer1', false);

      expect(connection.createDataChannel).not.toHaveBeenCalled();
    });

    it('should close existing connection before creating new one', async () => {
      await service.initializeLocalStream();
      const connection1 = await service.createPeerConnection('peer1', true);
      const connection2 = await service.createPeerConnection('peer1', true);

      expect(connection1.close).toHaveBeenCalled();
      expect(connection2).toBeDefined();
    });
  });

  describe('Offer/Answer Creation', () => {
    beforeEach(async () => {
      await service.initializeLocalStream();
      await service.createPeerConnection('peer1', true);
    });

    it('should create offer', async () => {
      const offer = await service.createOffer('peer1');

      expect(offer).toEqual({ type: 'offer', sdp: 'mock-sdp' });
    });

    it('should create answer', async () => {
      const answer = await service.createAnswer('peer1');

      expect(answer).toEqual({ type: 'answer', sdp: 'mock-sdp' });
    });

    it('should throw error if peer connection not found', async () => {
      await expect(service.createOffer('nonexistent')).rejects.toThrow(
        'Peer connection not found'
      );
    });
  });

  describe('Remote Description and ICE Candidates', () => {
    beforeEach(async () => {
      await service.initializeLocalStream();
      await service.createPeerConnection('peer1', true);
    });

    it('should set remote description', async () => {
      const description = { type: 'offer' as RTCSdpType, sdp: 'remote-sdp' };
      await service.setRemoteDescription('peer1', description);

      const peerConnections = service.getAllPeerConnections();
      const peerConnection = peerConnections.get('peer1');
      expect(peerConnection?.connection.setRemoteDescription).toHaveBeenCalled();
    });

    it('should add ICE candidate', async () => {
      const candidate = {
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 54321 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      };
      await service.addIceCandidate('peer1', candidate);

      const peerConnections = service.getAllPeerConnections();
      const peerConnection = peerConnections.get('peer1');
      expect(peerConnection?.connection.addIceCandidate).toHaveBeenCalled();
    });
  });

  describe('Data Channel', () => {
    beforeEach(async () => {
      await service.initializeLocalStream();
      await service.createPeerConnection('peer1', true);
    });

    it('should send data channel message', () => {
      const data = { type: 'test', message: 'hello' };
      service.sendDataChannelMessage('peer1', data);

      const peerConnections = service.getAllPeerConnections();
      const peerConnection = peerConnections.get('peer1');
      expect(peerConnection?.dataChannel?.send).toHaveBeenCalledWith(
        JSON.stringify(data)
      );
    });

    it('should throw error if data channel not available', () => {
      expect(() => {
        service.sendDataChannelMessage('nonexistent', {});
      }).toThrow('Data channel not available');
    });
  });

  describe('Connection State', () => {
    beforeEach(async () => {
      await service.initializeLocalStream();
      await service.createPeerConnection('peer1', true);
    });

    it('should get connection state', () => {
      const state = service.getConnectionState('peer1');
      expect(state).toBe('new');
    });

    it('should return null for nonexistent peer', () => {
      const state = service.getConnectionState('nonexistent');
      expect(state).toBeNull();
    });

    it('should get all peer connections', () => {
      const connections = service.getAllPeerConnections();
      expect(connections.size).toBe(1);
      expect(connections.has('peer1')).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should close peer connection', async () => {
      await service.initializeLocalStream();
      await service.createPeerConnection('peer1', true);

      await service.closePeerConnection('peer1');

      const connections = service.getAllPeerConnections();
      expect(connections.has('peer1')).toBe(false);
    });

    it('should cleanup all resources', async () => {
      await service.initializeLocalStream();
      await service.createPeerConnection('peer1', true);
      await service.createPeerConnection('peer2', true);

      await service.cleanup();

      expect(service.getLocalStream()).toBeNull();
      expect(service.getAllPeerConnections().size).toBe(0);
    });

    it('should stop local stream tracks on cleanup', async () => {
      await service.initializeLocalStream();
      const tracks = mockMediaStream.getTracks();

      await service.cleanup();

      tracks.forEach((track: any) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });
  });

  describe('Callbacks', () => {
    it('should trigger onError callback on initialization failure', async () => {
      const onError = vi.fn();
      service.setCallbacks({ onError });

      const error = new Error('Permission denied');
      vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(error);

      await expect(service.initializeLocalStream()).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });
  });
});
