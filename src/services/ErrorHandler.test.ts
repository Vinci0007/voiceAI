import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ErrorHandler,
  ErrorType,
  ErrorSeverity,
  createError,
} from './ErrorHandler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('handleError', () => {
    it('should handle network errors', () => {
      const error = createError(
        ErrorType.NETWORK,
        'Connection failed',
        ErrorSeverity.WARNING
      );

      const response = errorHandler.handleError(error);

      expect(response.handled).toBe(true);
      expect(response.shouldRetry).toBe(true);
      expect(response.userMessage).toContain('网络');
    });

    it('should handle API errors', () => {
      const error = createError(
        ErrorType.API,
        'API request failed',
        ErrorSeverity.WARNING
      );

      const response = errorHandler.handleError(error);

      expect(response.handled).toBe(true);
      expect(response.fallbackAction).toBe('use_fallback_api');
    });

    it('should handle permission errors', () => {
      const error = createError(
        ErrorType.PERMISSION,
        'Permission denied',
        ErrorSeverity.CRITICAL
      );

      const response = errorHandler.handleError(error);

      expect(response.handled).toBe(true);
      expect(response.shouldRetry).toBe(false);
    });
  });

  describe('retry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Failed');
        }
        return 'success';
      });

      const result = await errorHandler.retry(operation, {
        maxRetries: 3,
        initialDelay: 10,
        backoffMultiplier: 1,
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw error after max retries', async () => {
      const operation = vi.fn(async () => {
        throw new Error('Always fails');
      });

      await expect(
        errorHandler.retry(operation, {
          maxRetries: 2,
          initialDelay: 10,
        })
      ).rejects.toThrow('Always fails');

      expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      let attempts = 0;

      const operation = vi.fn(async () => {
        attempts++;
        if (attempts < 4) {
          throw new Error('Failed');
        }
        return 'success';
      });

      await errorHandler.retry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
      });

      expect(attempts).toBe(4);
    });
  });

  describe('fallback', () => {
    it('should use primary operation if successful', async () => {
      const primary = vi.fn(async () => 'primary');
      const fallback = vi.fn(async () => 'fallback');

      const result = await errorHandler.fallback(primary, fallback);

      expect(result).toBe('primary');
      expect(primary).toHaveBeenCalled();
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should use fallback if primary fails', async () => {
      const primary = vi.fn(async () => {
        throw new Error('Primary failed');
      });
      const fallback = vi.fn(async () => 'fallback');

      const result = await errorHandler.fallback(primary, fallback);

      expect(result).toBe('fallback');
      expect(primary).toHaveBeenCalled();
      expect(fallback).toHaveBeenCalled();
    });

    it('should throw if both fail', async () => {
      const primary = vi.fn(async () => {
        throw new Error('Primary failed');
      });
      const fallback = vi.fn(async () => {
        throw new Error('Fallback failed');
      });

      await expect(errorHandler.fallback(primary, fallback)).rejects.toThrow(
        'Fallback failed'
      );
    });
  });

  describe('fallbackChain', () => {
    it('should try operations in order', async () => {
      const op1 = vi.fn(async () => {
        throw new Error('Op1 failed');
      });
      const op2 = vi.fn(async () => {
        throw new Error('Op2 failed');
      });
      const op3 = vi.fn(async () => 'success');

      const result = await errorHandler.fallbackChain([op1, op2, op3]);

      expect(result).toBe('success');
      expect(op1).toHaveBeenCalled();
      expect(op2).toHaveBeenCalled();
      expect(op3).toHaveBeenCalled();
    });

    it('should stop at first successful operation', async () => {
      const op1 = vi.fn(async () => {
        throw new Error('Op1 failed');
      });
      const op2 = vi.fn(async () => 'success');
      const op3 = vi.fn(async () => 'also success');

      const result = await errorHandler.fallbackChain([op1, op2, op3]);

      expect(result).toBe('success');
      expect(op1).toHaveBeenCalled();
      expect(op2).toHaveBeenCalled();
      expect(op3).not.toHaveBeenCalled();
    });

    it('should throw if all operations fail', async () => {
      const op1 = vi.fn(async () => {
        throw new Error('Op1 failed');
      });
      const op2 = vi.fn(async () => {
        throw new Error('Op2 failed');
      });

      await expect(errorHandler.fallbackChain([op1, op2])).rejects.toThrow();
    });
  });

  describe('error logging', () => {
    it('should log errors', () => {
      const error = createError(
        ErrorType.NETWORK,
        'Test error',
        ErrorSeverity.WARNING
      );

      errorHandler.handleError(error);

      const log = errorHandler.getErrorLog();
      expect(log).toHaveLength(1);
      expect(log[0].message).toBe('Test error');
    });

    it('should limit log size', () => {
      // Create more errors than max log size
      for (let i = 0; i < 1100; i++) {
        const error = createError(
          ErrorType.UNKNOWN,
          `Error ${i}`,
          ErrorSeverity.INFO
        );
        errorHandler.handleError(error);
      }

      const log = errorHandler.getErrorLog();
      expect(log.length).toBeLessThanOrEqual(1000);
    });

    it('should clear error log', () => {
      const error = createError(
        ErrorType.NETWORK,
        'Test error',
        ErrorSeverity.WARNING
      );

      errorHandler.handleError(error);
      expect(errorHandler.getErrorLog()).toHaveLength(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorLog()).toHaveLength(0);
    });
  });

  describe('error statistics', () => {
    it('should calculate error statistics', () => {
      errorHandler.handleError(
        createError(ErrorType.NETWORK, 'Error 1', ErrorSeverity.WARNING)
      );
      errorHandler.handleError(
        createError(ErrorType.NETWORK, 'Error 2', ErrorSeverity.WARNING)
      );
      errorHandler.handleError(
        createError(ErrorType.API, 'Error 3', ErrorSeverity.CRITICAL)
      );

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.byType[ErrorType.NETWORK]).toBe(2);
      expect(stats.byType[ErrorType.API]).toBe(1);
      expect(stats.bySeverity[ErrorSeverity.WARNING]).toBe(2);
      expect(stats.bySeverity[ErrorSeverity.CRITICAL]).toBe(1);
    });
  });

  describe('error listeners', () => {
    it('should notify listeners of errors', () => {
      const listener = vi.fn();
      errorHandler.addErrorListener(listener);

      const error = createError(
        ErrorType.NETWORK,
        'Test error',
        ErrorSeverity.WARNING
      );
      errorHandler.handleError(error);

      expect(listener).toHaveBeenCalledWith(error);
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      errorHandler.addErrorListener(listener);
      errorHandler.removeErrorListener(listener);

      const error = createError(
        ErrorType.NETWORK,
        'Test error',
        ErrorSeverity.WARNING
      );
      errorHandler.handleError(error);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('createError helper', () => {
    it('should create error with all fields', () => {
      const originalError = new Error('Original');
      const error = createError(
        ErrorType.API,
        'Test message',
        ErrorSeverity.CRITICAL,
        { key: 'value' },
        originalError
      );

      expect(error.type).toBe(ErrorType.API);
      expect(error.message).toBe('Test message');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.context.key).toBe('value');
      expect(error.originalError).toBe(originalError);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should use default values', () => {
      const error = createError(ErrorType.UNKNOWN, 'Test');

      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.context).toEqual({});
      expect(error.originalError).toBeUndefined();
    });
  });
});
