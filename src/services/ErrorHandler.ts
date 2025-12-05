/**
 * ErrorHandler - 统一错误处理和降级策略
 * 
 * 功能：
 * - 错误分类和处理
 * - 重试机制（指数退避）
 * - API 失败降级链
 * - 用户友好的错误消息
 * - 错误日志记录
 */

export enum ErrorType {
  NETWORK = 'network',
  API = 'api',
  AUDIO = 'audio',
  RECOGNITION = 'recognition',
  TRANSLATION = 'translation',
  SYNTHESIS = 'synthesis',
  STORAGE = 'storage',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown',
}

export enum ErrorSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

export interface SystemError {
  type: ErrorType;
  message: string;
  severity: ErrorSeverity;
  timestamp: Date;
  context: Record<string, any>;
  originalError?: Error;
}

export interface ErrorResponse {
  handled: boolean;
  userMessage?: string;
  fallbackAction?: string;
  shouldRetry: boolean;
  retryDelay?: number;
}

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class ErrorHandler {
  private errorLog: SystemError[] = [];
  private maxLogSize = 1000;
  private errorListeners: Array<(error: SystemError) => void> = [];

  /**
   * 处理错误
   */
  handleError(error: SystemError): ErrorResponse {
    // 记录错误
    this.logError(error);

    // 通知监听器
    this.notifyListeners(error);

    // 根据错误类型返回处理策略
    switch (error.type) {
      case ErrorType.NETWORK:
        return this.handleNetworkError(error);
      case ErrorType.API:
        return this.handleApiError(error);
      case ErrorType.AUDIO:
        return this.handleAudioError(error);
      case ErrorType.RECOGNITION:
        return this.handleRecognitionError(error);
      case ErrorType.TRANSLATION:
        return this.handleTranslationError(error);
      case ErrorType.SYNTHESIS:
        return this.handleSynthesisError(error);
      case ErrorType.STORAGE:
        return this.handleStorageError(error);
      case ErrorType.PERMISSION:
        return this.handlePermissionError(error);
      default:
        return this.handleUnknownError(error);
    }
  }

  /**
   * 重试机制（指数退避）
   */
  async retry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
    } = options;

    let lastError: Error | null = null;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // 等待后重试
          await this.sleep(delay);
          delay = Math.min(delay * backoffMultiplier, maxDelay);

          console.log(
            `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * 降级链执行
   */
  async fallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      console.warn('Primary operation failed, trying fallback:', primaryError);

      try {
        return await fallbackOperation();
      } catch (fallbackError) {
        console.error('Fallback operation also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  /**
   * 多级降级链
   */
  async fallbackChain<T>(operations: Array<() => Promise<T>>): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < operations.length; i++) {
      try {
        return await operations[i]();
      } catch (error) {
        lastError = error as Error;
        console.warn(`Operation ${i + 1} failed, trying next:`, error);
      }
    }

    throw lastError || new Error('All operations in fallback chain failed');
  }

  /**
   * 添加错误监听器
   */
  addErrorListener(listener: (error: SystemError) => void): void {
    this.errorListeners.push(listener);
  }

  /**
   * 移除错误监听器
   */
  removeErrorListener(listener: (error: SystemError) => void): void {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLog(): SystemError[] {
    return [...this.errorLog];
  }

  /**
   * 清除错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
  } {
    const byType: Record<ErrorType, number> = {} as any;
    const bySeverity: Record<ErrorSeverity, number> = {} as any;

    for (const error of this.errorLog) {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    }

    return {
      total: this.errorLog.length,
      byType,
      bySeverity,
    };
  }

  // 私有方法

  private handleNetworkError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '网络连接失败，请检查网络设置',
      fallbackAction: 'switch_to_offline',
      shouldRetry: true,
      retryDelay: 5000,
    };
  }

  private handleApiError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: 'API 服务暂时不可用，正在尝试备用方案',
      fallbackAction: 'use_fallback_api',
      shouldRetry: true,
      retryDelay: 3000,
    };
  }

  private handleAudioError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '音频设备错误，请检查麦克风权限',
      fallbackAction: 'request_permission',
      shouldRetry: false,
    };
  }

  private handleRecognitionError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '语音识别失败，请重试或检查音频质量',
      fallbackAction: 'use_local_recognition',
      shouldRetry: true,
      retryDelay: 2000,
    };
  }

  private handleTranslationError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '翻译服务暂时不可用，正在使用备用翻译',
      fallbackAction: 'use_local_translation',
      shouldRetry: true,
      retryDelay: 2000,
    };
  }

  private handleSynthesisError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '语音合成失败，正在使用备用方案',
      fallbackAction: 'use_local_synthesis',
      shouldRetry: true,
      retryDelay: 2000,
    };
  }

  private handleStorageError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '数据保存失败，请检查存储空间',
      fallbackAction: 'clear_cache',
      shouldRetry: true,
      retryDelay: 1000,
    };
  }

  private handlePermissionError(_error: SystemError): ErrorResponse {
    return {
      handled: true,
      userMessage: '需要相应权限才能继续，请在设置中授予权限',
      fallbackAction: 'request_permission',
      shouldRetry: false,
    };
  }

  private handleUnknownError(_error: SystemError): ErrorResponse {
    return {
      handled: false,
      userMessage: '发生未知错误，请重试或联系支持',
      shouldRetry: true,
      retryDelay: 3000,
    };
  }

  private logError(error: SystemError): void {
    this.errorLog.push(error);

    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // 控制台输出
    const logMethod =
      error.severity === ErrorSeverity.CRITICAL
        ? console.error
        : error.severity === ErrorSeverity.WARNING
        ? console.warn
        : console.info;

    logMethod(
      `[${error.severity.toUpperCase()}] ${error.type}: ${error.message}`,
      error.context
    );
  }

  private notifyListeners(error: SystemError): void {
    for (const listener of this.errorListeners) {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 创建 SystemError 的辅助函数
 */
export function createError(
  type: ErrorType,
  message: string,
  severity: ErrorSeverity = ErrorSeverity.WARNING,
  context: Record<string, any> = {},
  originalError?: Error
): SystemError {
  return {
    type,
    message,
    severity,
    timestamp: new Date(),
    context,
    originalError,
  };
}

/**
 * 全局错误处理器实例
 */
export const globalErrorHandler = new ErrorHandler();
