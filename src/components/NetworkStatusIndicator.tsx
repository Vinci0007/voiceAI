/**
 * Network Status Indicator Component
 * 
 * Displays current network status, quality, and offline mode information.
 * 
 * Requirements:
 * - 8.5: WHEN 系统检测到网络质量下降 THEN 系统 SHALL 在用户界面上显示网络状态指示器
 */

import React, { useEffect, useState } from 'react';
import { NetworkQuality } from '../types';
import type { NetworkMetrics } from '../services/NetworkMonitor';
import { ProcessingMode } from '../services/NetworkMonitor';
import './NetworkStatusIndicator.css';

export interface NetworkStatusIndicatorProps {
  /** Network monitor instance */
  networkMonitor: any;
  /** Show detailed information */
  showDetails?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * NetworkStatusIndicator component
 * 
 * Requirement 8.5: Display network status indicator in UI
 */
export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({
  networkMonitor,
  showDetails = false,
  compact = false,
}) => {
  const [metrics, setMetrics] = useState<NetworkMetrics | null>(null);
  const [mode, setMode] = useState<ProcessingMode>(ProcessingMode.ONLINE);
  const [syncStatus, setSyncStatus] = useState<any>(null);

  useEffect(() => {
    if (!networkMonitor) return;

    // Get initial state
    setMetrics(networkMonitor.getCurrentMetrics());
    setMode(networkMonitor.getCurrentMode());

    // Subscribe to network status updates
    const unsubscribeStatus = networkMonitor.onNetworkStatus((newMetrics: NetworkMetrics) => {
      setMetrics(newMetrics);
    });

    // Subscribe to mode changes
    const unsubscribeMode = networkMonitor.onModeChange((newMode: ProcessingMode) => {
      setMode(newMode);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeMode();
    };
  }, [networkMonitor]);

  if (!metrics) {
    return null;
  }

  const getQualityIcon = (quality: NetworkQuality): string => {
    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return '📶';
      case NetworkQuality.GOOD:
        return '📶';
      case NetworkQuality.FAIR:
        return '📡';
      case NetworkQuality.POOR:
        return '📡';
      case NetworkQuality.OFFLINE:
        return '📴';
      default:
        return '❓';
    }
  };

  const getQualityColor = (quality: NetworkQuality): string => {
    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return '#4caf50';
      case NetworkQuality.GOOD:
        return '#8bc34a';
      case NetworkQuality.FAIR:
        return '#ff9800';
      case NetworkQuality.POOR:
        return '#ff5722';
      case NetworkQuality.OFFLINE:
        return '#9e9e9e';
      default:
        return '#9e9e9e';
    }
  };

  const getModeIcon = (processingMode: ProcessingMode): string => {
    switch (processingMode) {
      case ProcessingMode.ONLINE:
        return '☁️';
      case ProcessingMode.OFFLINE:
        return '💾';
      case ProcessingMode.HYBRID:
        return '🔄';
      default:
        return '❓';
    }
  };

  const getModeLabel = (processingMode: ProcessingMode): string => {
    switch (processingMode) {
      case ProcessingMode.ONLINE:
        return 'Online';
      case ProcessingMode.OFFLINE:
        return 'Offline';
      case ProcessingMode.HYBRID:
        return 'Hybrid';
      default:
        return 'Unknown';
    }
  };

  const getQualityLabel = (quality: NetworkQuality): string => {
    switch (quality) {
      case NetworkQuality.EXCELLENT:
        return 'Excellent';
      case NetworkQuality.GOOD:
        return 'Good';
      case NetworkQuality.FAIR:
        return 'Fair';
      case NetworkQuality.POOR:
        return 'Poor';
      case NetworkQuality.OFFLINE:
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  if (compact) {
    return (
      <div className="network-status-indicator compact">
        <span className="status-icon" title={`${getQualityLabel(metrics.quality)} - ${getModeLabel(mode)}`}>
          {getQualityIcon(metrics.quality)}
        </span>
        {mode === ProcessingMode.OFFLINE && (
          <span className="mode-badge offline">Offline</span>
        )}
      </div>
    );
  }

  return (
    <div className="network-status-indicator">
      <div className="status-header">
        <span className="status-icon">{getQualityIcon(metrics.quality)}</span>
        <div className="status-info">
          <div className="status-quality" style={{ color: getQualityColor(metrics.quality) }}>
            {getQualityLabel(metrics.quality)}
          </div>
          <div className="status-mode">
            <span className="mode-icon">{getModeIcon(mode)}</span>
            <span className="mode-label">{getModeLabel(mode)}</span>
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="status-details">
          {metrics.isOnline && (
            <>
              <div className="detail-item">
                <span className="detail-label">Latency:</span>
                <span className="detail-value">{metrics.latency.toFixed(0)}ms</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Bandwidth:</span>
                <span className="detail-value">
                  {metrics.bandwidth >= 1000
                    ? `${(metrics.bandwidth / 1000).toFixed(1)} Mbps`
                    : `${metrics.bandwidth.toFixed(0)} kbps`}
                </span>
              </div>
              {metrics.jitter > 0 && (
                <div className="detail-item">
                  <span className="detail-label">Jitter:</span>
                  <span className="detail-value">{metrics.jitter.toFixed(0)}ms</span>
                </div>
              )}
            </>
          )}

          {mode === ProcessingMode.OFFLINE && (
            <div className="offline-notice">
              <span className="notice-icon">ℹ️</span>
              <span className="notice-text">Using local models</span>
            </div>
          )}

          {syncStatus && syncStatus.pendingOperations > 0 && (
            <div className="sync-status">
              <span className="sync-icon">🔄</span>
              <span className="sync-text">
                {syncStatus.isSyncing
                  ? 'Syncing...'
                  : `${syncStatus.pendingOperations} pending`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NetworkStatusIndicator;
