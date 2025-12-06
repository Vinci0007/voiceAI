/**
 * Data Sync Manager
 * 
 * Manages data synchronization between offline and online modes.
 * Handles queuing of operations during offline mode and syncing when network recovers.
 * 
 * Requirements:
 * - 8.3: WHEN 网络连接恢复 THEN 系统 SHALL 自动重新连接并同步离线期间的数据
 */

import type { Message } from '../types';
import { ErrorHandler, ErrorType, ErrorSeverity, createError } from './ErrorHandler';

/**
 * Sync operation types
 */
export enum SyncOperationType {
  CREATE_MESSAGE = 'create_message',
  UPDATE_MESSAGE = 'update_message',
  DELETE_MESSAGE = 'delete_message',
  CREATE_SESSION = 'create_session',
  UPDATE_SESSION = 'update_session',
}

/**
 * Sync operation
 */
export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  timestamp: Date;
  data: any;
  retryCount: number;
  lastError?: string;
}

/**
 * Sync status
 */
export interface SyncStatus {
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime?: Date;
  lastSyncError?: string;
  totalSynced: number;
  totalFailed: number;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: Array<{ operationId: string; error: string }>;
}

/**
 * Configuration for data sync manager
 */
export interface DataSyncManagerConfig {
  /** Maximum number of pending operations to queue */
  maxQueueSize: number;
  /** Maximum retry attempts for failed operations */
  maxRetryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Enable automatic sync on network recovery */
  enableAutoSync: boolean;
  /** Batch size for sync operations */
  syncBatchSize: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DataSyncManagerConfig = {
  maxQueueSize: 1000,
  maxRetryAttempts: 3,
  retryDelay: 5000,
  enableAutoSync: true,
  syncBatchSize: 50,
};

/**
 * DataSyncManager class
 * 
 * Manages synchronization of data between offline and online modes,
 * ensuring data consistency and reliability.
 */
export class DataSyncManager {
  private config: DataSyncManagerConfig;
  private errorHandler: ErrorHandler;
  private syncQueue: Map<string, SyncOperation>;
  private status: SyncStatus;
  private isSyncing: boolean = false;
  private syncListeners: Set<(status: SyncStatus) => void> = new Set();

  constructor(
    config: Partial<DataSyncManagerConfig> = {},
    errorHandler: ErrorHandler = new ErrorHandler()
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.errorHandler = errorHandler;
    this.syncQueue = new Map();
    this.status = {
      isSyncing: false,
      pendingOperations: 0,
      totalSynced: 0,
      totalFailed: 0,
    };
  }

  /**
   * Queue an operation for synchronization
   * 
   * @param type - Operation type
   * @param data - Operation data
   * @returns Operation ID
   */
  queueOperation(type: SyncOperationType, data: any): string {
    // Check queue size limit
    if (this.syncQueue.size >= this.config.maxQueueSize) {
      throw new Error('Sync queue is full');
    }

    const operation: SyncOperation = {
      id: this.generateOperationId(),
      type,
      timestamp: new Date(),
      data,
      retryCount: 0,
    };

    this.syncQueue.set(operation.id, operation);
    this.status.pendingOperations = this.syncQueue.size;
    this.notifyListeners();

    console.log(`Queued operation: ${operation.id} (${type})`);

    return operation.id;
  }

  /**
   * Perform synchronization of all pending operations
   * 
   * Requirement 8.3: Sync offline data when network recovers
   * 
   * @returns Sync result
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    if (this.syncQueue.size === 0) {
      return {
        success: true,
        syncedCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    this.isSyncing = true;
    this.status.isSyncing = true;
    this.notifyListeners();

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Get operations to sync
      const operations = Array.from(this.syncQueue.values());
      
      // Sort by timestamp (oldest first)
      operations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Process in batches
      for (let i = 0; i < operations.length; i += this.config.syncBatchSize) {
        const batch = operations.slice(i, i + this.config.syncBatchSize);
        
        for (const operation of batch) {
          try {
            await this.syncOperation(operation);
            
            // Remove from queue on success
            this.syncQueue.delete(operation.id);
            result.syncedCount++;
            this.status.totalSynced++;
            
            console.log(`Synced operation: ${operation.id}`);
          } catch (error) {
            const errorMessage = (error as Error).message;
            
            // Increment retry count
            operation.retryCount++;
            operation.lastError = errorMessage;

            // Remove if max retries exceeded
            if (operation.retryCount >= this.config.maxRetryAttempts) {
              this.syncQueue.delete(operation.id);
              result.failedCount++;
              this.status.totalFailed++;
              result.errors.push({
                operationId: operation.id,
                error: errorMessage,
              });
              
              console.error(`Failed to sync operation ${operation.id} after ${operation.retryCount} attempts:`, error);
            } else {
              console.warn(`Sync failed for operation ${operation.id}, will retry (${operation.retryCount}/${this.config.maxRetryAttempts})`);
            }
          }
        }

        // Update status
        this.status.pendingOperations = this.syncQueue.size;
        this.notifyListeners();
      }

      this.status.lastSyncTime = new Date();
      this.status.lastSyncError = undefined;

      if (result.failedCount > 0) {
        result.success = false;
        this.status.lastSyncError = `${result.failedCount} operations failed`;
      }

    } catch (error) {
      result.success = false;
      this.status.lastSyncError = (error as Error).message;
      
      const systemError = createError(
        ErrorType.STORAGE,
        `Sync failed: ${(error as Error).message}`,
        ErrorSeverity.WARNING,
        { pendingOperations: this.syncQueue.size },
        error as Error
      );
      this.errorHandler.handleError(systemError);
    } finally {
      this.isSyncing = false;
      this.status.isSyncing = false;
      this.status.pendingOperations = this.syncQueue.size;
      this.notifyListeners();
    }

    return result;
  }

  /**
   * Get current sync status
   * 
   * @returns Current sync status
   */
  getStatus(): SyncStatus {
    return { ...this.status };
  }

  /**
   * Get pending operations
   * 
   * @returns Array of pending operations
   */
  getPendingOperations(): SyncOperation[] {
    return Array.from(this.syncQueue.values());
  }

  /**
   * Get operation by ID
   * 
   * @param operationId - Operation ID
   * @returns Operation or undefined
   */
  getOperation(operationId: string): SyncOperation | undefined {
    return this.syncQueue.get(operationId);
  }

  /**
   * Cancel a pending operation
   * 
   * @param operationId - Operation ID
   * @returns True if operation was cancelled
   */
  cancelOperation(operationId: string): boolean {
    const deleted = this.syncQueue.delete(operationId);
    if (deleted) {
      this.status.pendingOperations = this.syncQueue.size;
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Clear all pending operations
   */
  clearQueue(): void {
    this.syncQueue.clear();
    this.status.pendingOperations = 0;
    this.notifyListeners();
  }

  /**
   * Register sync status listener
   * 
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DataSyncManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): DataSyncManagerConfig {
    return { ...this.config };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.status.totalSynced = 0;
    this.status.totalFailed = 0;
    this.status.lastSyncTime = undefined;
    this.status.lastSyncError = undefined;
    this.notifyListeners();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.syncQueue.clear();
    this.syncListeners.clear();
    this.status.pendingOperations = 0;
  }

  // Private methods

  /**
   * Sync a single operation
   */
  private async syncOperation(operation: SyncOperation): Promise<void> {
    // In production, this would make actual API calls to sync data
    // For now, simulate sync with delay

    console.log(`Syncing operation: ${operation.id} (${operation.type})`);

    // Simulate network request
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simulate occasional failures for testing retry logic
    if (Math.random() < 0.1) {
      throw new Error('Simulated sync failure');
    }

    // In production, handle different operation types:
    switch (operation.type) {
      case SyncOperationType.CREATE_MESSAGE:
        await this.syncCreateMessage(operation.data);
        break;
      case SyncOperationType.UPDATE_MESSAGE:
        await this.syncUpdateMessage(operation.data);
        break;
      case SyncOperationType.DELETE_MESSAGE:
        await this.syncDeleteMessage(operation.data);
        break;
      case SyncOperationType.CREATE_SESSION:
        await this.syncCreateSession(operation.data);
        break;
      case SyncOperationType.UPDATE_SESSION:
        await this.syncUpdateSession(operation.data);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Sync create message operation
   */
  private async syncCreateMessage(data: any): Promise<void> {
    // In production, this would call the API to create the message
    console.log('Syncing create message:', data);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Sync update message operation
   */
  private async syncUpdateMessage(data: any): Promise<void> {
    // In production, this would call the API to update the message
    console.log('Syncing update message:', data);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Sync delete message operation
   */
  private async syncDeleteMessage(data: any): Promise<void> {
    // In production, this would call the API to delete the message
    console.log('Syncing delete message:', data);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Sync create session operation
   */
  private async syncCreateSession(data: any): Promise<void> {
    // In production, this would call the API to create the session
    console.log('Syncing create session:', data);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Sync update session operation
   */
  private async syncUpdateSession(data: any): Promise<void> {
    // In production, this would call the API to update the session
    console.log('Syncing update session:', data);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync status listener:', error);
      }
    });
  }
}

/**
 * Singleton instance for global use
 */
export const dataSyncManager = new DataSyncManager();
