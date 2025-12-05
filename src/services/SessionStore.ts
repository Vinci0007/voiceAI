import { Message } from '@/types';
import * as TauriAPI from '@/api/tauri';

/**
 * SessionStore - 会话数据持久化存储
 * 
 * 职责：
 * - 保存和检索会话消息
 * - 导出会话数据
 * - 搜索和过滤消息
 */
export class SessionStore {
  /**
   * 保存消息到数据库
   * @param sessionId 会话ID
   * @param message 消息对象
   */
  async saveMessage(sessionId: string, message: Omit<Message, 'id'>): Promise<void> {
    const translations = Array.from(message.translations.entries());
    const translatedText = translations.length > 0 ? translations[0][1] : undefined;
    const targetLanguage = translations.length > 0 ? translations[0][0] : undefined;

    await TauriAPI.saveMessage(
      sessionId,
      message.speakerId,
      message.originalText,
      message.originalLanguage,
      translatedText,
      targetLanguage
    );
  }

  /**
   * 获取会话历史消息
   * @param sessionId 会话ID
   * @param limit 限制返回的消息数量
   * @returns 消息数组
   */
  async getHistory(sessionId: string, limit?: number): Promise<Message[]> {
    const dbMessages = await TauriAPI.getSessionMessages(sessionId, limit);

    return dbMessages.map((dbMsg) => {
      const translations = new Map<string, string>();
      if (dbMsg.translated_text && dbMsg.target_language) {
        translations.set(dbMsg.target_language, dbMsg.translated_text);
      }

      return {
        id: dbMsg.id.toString(),
        sessionId: dbMsg.session_id,
        speakerId: dbMsg.speaker_id,
        timestamp: new Date(dbMsg.timestamp),
        originalText: dbMsg.original_text,
        originalLanguage: dbMsg.original_language,
        translations,
      };
    });
  }

  /**
   * 导出会话为 JSON 格式
   * @param sessionId 会话ID
   * @returns JSON 字符串
   */
  async exportSession(sessionId: string): Promise<string> {
    const messages = await this.getHistory(sessionId);

    const exportData = {
      sessionId,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages.map((msg) => ({
        timestamp: msg.timestamp.toISOString(),
        speakerId: msg.speakerId,
        originalText: msg.originalText,
        originalLanguage: msg.originalLanguage,
        translations: Object.fromEntries(msg.translations),
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出会话为纯文本格式
   * @param sessionId 会话ID
   * @returns 纯文本字符串
   */
  async exportSessionAsText(sessionId: string): Promise<string> {
    const messages = await this.getHistory(sessionId);

    let text = `会话记录\n`;
    text += `会话ID: ${sessionId}\n`;
    text += `导出时间: ${new Date().toISOString()}\n`;
    text += `消息数量: ${messages.length}\n`;
    text += `\n${'='.repeat(80)}\n\n`;

    for (const msg of messages) {
      text += `[${msg.timestamp.toISOString()}] 说话人: ${msg.speakerId}\n`;
      text += `原文 (${msg.originalLanguage}): ${msg.originalText}\n`;

      if (msg.translations.size > 0) {
        for (const [lang, translation] of msg.translations) {
          text += `翻译 (${lang}): ${translation}\n`;
        }
      }

      text += `\n${'-'.repeat(80)}\n\n`;
    }

    return text;
  }

  /**
   * 搜索消息
   * @param sessionId 会话ID
   * @param query 搜索查询
   * @returns 匹配的消息数组
   */
  async searchMessages(sessionId: string, query: string): Promise<Message[]> {
    const messages = await this.getHistory(sessionId);

    const lowerQuery = query.toLowerCase();

    return messages.filter((msg) => {
      // 搜索原文
      if (msg.originalText.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // 搜索翻译
      for (const translation of msg.translations.values()) {
        if (translation.toLowerCase().includes(lowerQuery)) {
          return true;
        }
      }

      // 搜索说话人ID
      if (msg.speakerId.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });
  }

  /**
   * 按说话人过滤消息
   * @param sessionId 会话ID
   * @param speakerId 说话人ID
   * @returns 该说话人的消息数组
   */
  async filterBySpeaker(sessionId: string, speakerId: string): Promise<Message[]> {
    const messages = await this.getHistory(sessionId);
    return messages.filter((msg) => msg.speakerId === speakerId);
  }

  /**
   * 按时间范围过滤消息
   * @param sessionId 会话ID
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 时间范围内的消息数组
   */
  async filterByTimeRange(
    sessionId: string,
    startTime: Date,
    endTime: Date
  ): Promise<Message[]> {
    const messages = await this.getHistory(sessionId);
    return messages.filter(
      (msg) => msg.timestamp >= startTime && msg.timestamp <= endTime
    );
  }

  /**
   * 获取会话统计信息
   * @param sessionId 会话ID
   * @returns 统计信息对象
   */
  async getSessionStats(sessionId: string): Promise<{
    totalMessages: number;
    uniqueSpeakers: number;
    languages: string[];
    firstMessage: Date | null;
    lastMessage: Date | null;
  }> {
    const messages = await this.getHistory(sessionId);

    if (messages.length === 0) {
      return {
        totalMessages: 0,
        uniqueSpeakers: 0,
        languages: [],
        firstMessage: null,
        lastMessage: null,
      };
    }

    const uniqueSpeakers = new Set(messages.map((msg) => msg.speakerId));
    const languages = new Set(messages.map((msg) => msg.originalLanguage));

    return {
      totalMessages: messages.length,
      uniqueSpeakers: uniqueSpeakers.size,
      languages: Array.from(languages),
      firstMessage: messages[messages.length - 1].timestamp,
      lastMessage: messages[0].timestamp,
    };
  }
}
