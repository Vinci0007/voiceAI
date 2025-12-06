/**
 * DataSyncManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSyncManager, SyncOperationType } from './DataSyncManager';

describe('DataSyncManager', () => {
  let manager: DataSyncManager;

  beforeEach(() => {
    manager = new DataSyncManager();
  });

  describe('Operation Queuing', () => {
    it('should queue an operation', () => {
      const operationId = manager.queueOperation(
        SyncOperationType.CREATE_MESSAGE,
        { text: 'Test message' }
      );

      expect(operationId).toBeDefined();
      expect(operationId).toMatch(/^sync_/);

      const status = manager.getStatus();
      expect(status.pendingOperations).toBe(1);
    });

    it('should queue multiple operations', () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 2' });
      manager.queueOperation(SyncOperationType.UPDATE_SESSION, { id: 'session1' });

      const status = manager.getStatus();
      expect(status.pendingOperations).toBe(3);
    });

    it('should throw error when queue is full', () => {
      manager.updateConfig({ maxQueueSize: 2 });

      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 2' });

      expect(() => {
        manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 3' });
      }).toThrow('Sync queue is full');
    });
  });

  describe('Synchronization', () => {
    it('should sync all pending operations', async () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 2' });

      const result = await manager.sync();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);
    });

    it('should return success when no operations to sync', async () => {
      const result = await manager.sync();

      expect(result.success).toBe(true);
      expect(result.syncedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('should update sync status during sync', async () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });

      const syncPromise = manager.sync();

      // Status should show syncing
      const statusDuringSync = manager.getStatus();
      expect(statusDuringSync.isSyncing).toBe(true);

      await syncPromise;

      // Status should show not syncing after completion
      const statusAfterSync = manager.getStatus();
      expect(statusAfterSync.isSyncing).toBe(false);
    });

    it('should throw error if sync already in progress', async () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });

      const syncPromise1 = manager.sync();

      await expect(manager.sync()).rejects.toThrow('Sync already in progress');

      await syncPromise1;
    });

    it('should update last sync time after successful sync', async () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });

      await manager.sync();

      const status = manager.getStatus();
      expect(status.lastSyncTime).toBeDefined();
      expect(status.lastSyncTime).toBeInstanceOf(Date);
    });
  });

  describe('Operation Management', () => {
    it('should get pending operations', () => {
      const id1 = manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      const id2 = manager.queueOperation(SyncOperationType.UPDATE_SESSION, { id: 'session1' });

      const pending = manager.getPendingOperations();

      expect(pending.length).toBe(2);
      expect(pending.some(op => op.id === id1)).toBe(true);
      expect(pending.some(op => op.id === id2)).toBe(true);
    });

    it('should get operation by ID', () => {
      const operationId = manager.queueOperation(
        SyncOperationType.CREATE_MESSAGE,
        { text: 'Test message' }
      );

      const operation = manager.getOperation(operationId);

      expect(operation).toBeDefined();
      expect(operation?.id).toBe(operationId);
      expect(operation?.type).toBe(SyncOperationType.CREATE_MESSAGE);
    });

    it('should cancel a pending operation', () => {
      const operationId = manager.queueOperation(
        SyncOperationType.CREATE_MESSAGE,
        { text: 'Test message' }
      );

      const cancelled = manager.cancelOperation(operationId);

      expect(cancelled).toBe(true);
      expect(manager.getOperation(operationId)).toBeUndefined();

      const status = manager.getStatus();
      expect(status.pendingOperations).toBe(0);
    });

    it('should return false when cancelling non-existent operation', () => {
      const cancelled = manager.cancelOperation('non-existent-id');
      expect(cancelled).toBe(false);
    });

    it('should clear all pending operations', () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 2' });

      manager.clearQueue();

      const status = manager.getStatus();
      expect(status.pendingOperations).toBe(0);
    });
  });

  describe('Status Listeners', () => {
    it('should notify listeners on status change', () => {
      const listener = vi.fn();
      manager.onStatusChange(listener);

      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Test' });

      expect(listener).toHaveBeenCalled();
      const status = listener.mock.calls[0][0];
      expect(status.pendingOperations).toBe(1);
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onStatusChange(listener);

      unsubscribe();

      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Test' });

      // Listener should not be called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      manager.updateConfig({
        maxRetryAttempts: 5,
        syncBatchSize: 100,
      });

      const config = manager.getConfig();
      expect(config.maxRetryAttempts).toBe(5);
      expect(config.syncBatchSize).toBe(100);
    });

    it('should get current configuration', () => {
      const config = manager.getConfig();
      expect(config).toHaveProperty('maxQueueSize');
      expect(config).toHaveProperty('maxRetryAttempts');
      expect(config).toHaveProperty('retryDelay');
    });
  });

  describe('Statistics', () => {
    it('should track total synced operations', async () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 2' });

      await manager.sync();

      const status = manager.getStatus();
      expect(status.totalSynced).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Message 1' });
      await manager.sync();

      manager.resetStats();

      const status = manager.getStatus();
      expect(status.totalSynced).toBe(0);
      expect(status.totalFailed).toBe(0);
      expect(status.lastSyncTime).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    it('should dispose and cleanup resources', () => {
      manager.queueOperation(SyncOperationType.CREATE_MESSAGE, { text: 'Test' });

      manager.dispose();

      const status = manager.getStatus();
      expect(status.pendingOperations).toBe(0);
    });
  });
});
