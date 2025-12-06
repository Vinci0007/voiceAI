/**
 * OfflineModelManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineModelManager, ModelType } from './OfflineModelManager';

describe('OfflineModelManager', () => {
  let manager: OfflineModelManager;

  beforeEach(() => {
    manager = new OfflineModelManager();
  });

  describe('Model Registry', () => {
    it('should initialize with predefined models', () => {
      const models = manager.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
    });

    it('should get models by type', () => {
      const recognitionModels = manager.getModelsByType(ModelType.SPEECH_RECOGNITION);
      expect(recognitionModels.length).toBeGreaterThan(0);
      expect(recognitionModels.every(m => m.type === ModelType.SPEECH_RECOGNITION)).toBe(true);
    });

    it('should get models by language', () => {
      const enModels = manager.getModelsByLanguage('en');
      expect(enModels.length).toBeGreaterThan(0);
      expect(enModels.every(m => m.language === 'en')).toBe(true);
    });
  });

  describe('Offline Availability', () => {
    it('should return false for offline availability when models not downloaded', () => {
      const isAvailable = manager.isOfflineAvailable('en');
      expect(isAvailable).toBe(false);
    });

    it('should get offline capability status', () => {
      const capability = manager.getOfflineCapability();
      expect(capability).toHaveProperty('isAvailable');
      expect(capability).toHaveProperty('availableLanguages');
      expect(capability).toHaveProperty('missingModels');
      expect(capability).toHaveProperty('totalSize');
      expect(capability).toHaveProperty('usedSize');
    });
  });

  describe('Model Download', () => {
    it('should download a model', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);

      const updatedModel = manager.getAvailableModels().find(m => m.id === modelId);
      expect(updatedModel?.isDownloaded).toBe(true);
    });

    it('should track download progress', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      const progressUpdates: number[] = [];
      await manager.downloadModel(modelId, {
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });

    it('should not download already downloaded model', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      await manager.downloadModel(modelId); // Should not throw

      const updatedModel = manager.getAvailableModels().find(m => m.id === modelId);
      expect(updatedModel?.isDownloaded).toBe(true);
    });
  });

  describe('Model Loading', () => {
    it('should load a downloaded model', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      const instance = await manager.loadModel(modelId);

      expect(instance).toBeDefined();
      expect(instance.id).toBe(modelId);
    });

    it('should throw error when loading non-downloaded model', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await expect(manager.loadModel(modelId)).rejects.toThrow();
    });

    it('should cache loaded model instance', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      const instance1 = await manager.loadModel(modelId);
      const instance2 = await manager.loadModel(modelId);

      expect(instance1).toBe(instance2);
    });
  });

  describe('Model Unloading', () => {
    it('should unload a loaded model', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      await manager.loadModel(modelId);

      manager.unloadModel(modelId);

      const updatedModel = manager.getAvailableModels().find(m => m.id === modelId);
      expect(updatedModel?.isLoaded).toBe(false);
    });
  });

  describe('Model Deletion', () => {
    it('should delete a downloaded model', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      await manager.deleteModel(modelId);

      const updatedModel = manager.getAvailableModels().find(m => m.id === modelId);
      expect(updatedModel?.isDownloaded).toBe(false);
    });

    it('should unload model before deletion if loaded', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      await manager.loadModel(modelId);
      await manager.deleteModel(modelId);

      const updatedModel = manager.getAvailableModels().find(m => m.id === modelId);
      expect(updatedModel?.isLoaded).toBe(false);
      expect(updatedModel?.isDownloaded).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      manager.updateConfig({
        maxStorageSize: 5 * 1024 * 1024 * 1024, // 5GB
      });

      const config = manager.getConfig();
      expect(config.maxStorageSize).toBe(5 * 1024 * 1024 * 1024);
    });

    it('should get current configuration', () => {
      const config = manager.getConfig();
      expect(config).toHaveProperty('modelBasePath');
      expect(config).toHaveProperty('maxStorageSize');
      expect(config).toHaveProperty('enableAutoUpdate');
    });
  });

  describe('Cleanup', () => {
    it('should dispose and cleanup resources', async () => {
      const models = manager.getAvailableModels();
      const modelId = models[0].id;

      await manager.downloadModel(modelId);
      await manager.loadModel(modelId);

      manager.dispose();

      const updatedModel = manager.getAvailableModels().find(m => m.id === modelId);
      expect(updatedModel).toBeUndefined(); // Registry should be cleared
    });
  });
});
