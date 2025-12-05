import {
  Session,
  SessionMode,
  SessionStatus,
  SessionState,
  Participant,
  NetworkQuality,
} from '@/types';
import * as TauriAPI from '@/api/tauri';

/**
 * SessionManager - 管理用户会话的生命周期
 * 
 * 职责：
 * - 创建、切换和销毁会话
 * - 管理会话模式（会议模式/聊天模式）
 * - 管理参与者（添加、移除、更新状态）
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private activeSessionId: string | null = null;

  /**
   * 创建新会话
   * @param mode 会话模式（conference 或 chat）
   * @param userId 用户ID
   * @returns 创建的会话对象
   */
  async createSession(mode: SessionMode, userId: string): Promise<Session> {
    // 调用后端创建会话
    const dbSession = await TauriAPI.createSession(mode, userId);

    // 创建会话对象
    const session: Session = {
      id: dbSession.id,
      mode,
      participants: [],
      createdAt: new Date(dbSession.created_at),
      state: {
        status: SessionStatus.ACTIVE,
        activeParticipants: 0,
        totalMessages: 0,
        averageLatency: 0,
        networkQuality: NetworkQuality.GOOD,
      },
    };

    // 存储到内存
    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    return session;
  }

  /**
   * 切换会话模式
   * @param sessionId 会话ID
   * @param newMode 新的会话模式
   */
  switchMode(sessionId: string, newMode: SessionMode): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 验证模式切换的有效性
    if (newMode === SessionMode.CHAT && session.participants.length > 2) {
      throw new Error(
        'Cannot switch to chat mode: more than 2 participants in session'
      );
    }

    // 保存当前状态
    const previousMode = session.mode;
    const previousState = { ...session.state };
    const previousParticipants = [...session.participants];

    // 切换模式
    session.mode = newMode;

    // 模式切换后，状态应该被保留
    session.state = previousState;
    session.participants = previousParticipants;

    console.log(
      `Session ${sessionId} mode switched from ${previousMode} to ${newMode}`
    );
  }

  /**
   * 结束会话
   * @param sessionId 会话ID
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 更新会话状态
    session.state.status = SessionStatus.ENDED;

    // 如果是当前活动会话，清除活动会话ID
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    console.log(`Session ${sessionId} ended`);
  }

  /**
   * 获取会话
   * @param sessionId 会话ID
   * @returns 会话对象或 null
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 获取当前活动会话
   * @returns 当前活动会话或 null
   */
  getActiveSession(): Session | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.getSession(this.activeSessionId);
  }

  /**
   * 获取所有会话
   * @returns 所有会话的数组
   */
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 添加参与者到会话
   * @param sessionId 会话ID
   * @param participant 参与者对象
   */
  addParticipant(sessionId: string, participant: Participant): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 验证参与者数量限制
    if (session.mode === SessionMode.CHAT && session.participants.length >= 2) {
      throw new Error('Chat mode only supports 2 participants');
    }

    if (
      session.mode === SessionMode.CONFERENCE &&
      session.participants.length >= 10
    ) {
      throw new Error('Conference mode supports maximum 10 participants');
    }

    // 检查参与者是否已存在
    const existingParticipant = session.participants.find(
      (p) => p.id === participant.id
    );
    if (existingParticipant) {
      throw new Error(`Participant ${participant.id} already in session`);
    }

    // 添加参与者
    session.participants.push(participant);
    session.state.activeParticipants = session.participants.filter(
      (p) => !p.isMuted
    ).length;

    console.log(`Participant ${participant.id} added to session ${sessionId}`);
  }

  /**
   * 从会话中移除参与者
   * @param sessionId 会话ID
   * @param participantId 参与者ID
   */
  removeParticipant(sessionId: string, participantId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const index = session.participants.findIndex((p) => p.id === participantId);
    if (index === -1) {
      throw new Error(`Participant ${participantId} not found in session`);
    }

    // 移除参与者
    session.participants.splice(index, 1);
    session.state.activeParticipants = session.participants.filter(
      (p) => !p.isMuted
    ).length;

    console.log(
      `Participant ${participantId} removed from session ${sessionId}`
    );
  }

  /**
   * 更新参与者状态
   * @param sessionId 会话ID
   * @param participantId 参与者ID
   * @param updates 要更新的字段
   */
  updateParticipant(
    sessionId: string,
    participantId: string,
    updates: Partial<Participant>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const participant = session.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new Error(`Participant ${participantId} not found in session`);
    }

    // 更新参与者信息
    Object.assign(participant, updates);

    // 更新活动参与者数量
    session.state.activeParticipants = session.participants.filter(
      (p) => !p.isMuted
    ).length;

    console.log(`Participant ${participantId} updated in session ${sessionId}`);
  }

  /**
   * 切换参与者静音状态
   * @param sessionId 会话ID
   * @param participantId 参与者ID
   */
  toggleParticipantMute(sessionId: string, participantId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const participant = session.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new Error(`Participant ${participantId} not found in session`);
    }

    // 切换静音状态
    participant.isMuted = !participant.isMuted;

    // 更新活动参与者数量
    session.state.activeParticipants = session.participants.filter(
      (p) => !p.isMuted
    ).length;

    console.log(
      `Participant ${participantId} mute toggled to ${participant.isMuted} in session ${sessionId}`
    );
  }

  /**
   * 更新会话状态
   * @param sessionId 会话ID
   * @param stateUpdates 要更新的状态字段
   */
  updateSessionState(
    sessionId: string,
    stateUpdates: Partial<SessionState>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 更新会话状态
    Object.assign(session.state, stateUpdates);
  }

  /**
   * 获取会话参与者数量
   * @param sessionId 会话ID
   * @returns 参与者数量
   */
  getParticipantCount(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session.participants.length;
  }

  /**
   * 检查会话模式是否支持添加更多参与者
   * @param sessionId 会话ID
   * @returns 是��可以添加更多参与者
   */
  canAddMoreParticipants(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    if (session.mode === SessionMode.CHAT) {
      return session.participants.length < 2;
    }

    if (session.mode === SessionMode.CONFERENCE) {
      return session.participants.length < 10;
    }

    return false;
  }
}
