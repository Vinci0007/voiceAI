/**
 * Example usage of LanguageDetector service
 * 
 * This file demonstrates how to integrate the LanguageDetector
 * with other services in the application.
 */

import { LanguageDetector } from './LanguageDetector';
import type { AudioBuffer, LanguageInfo } from '../types';

/**
 * Example 1: Basic language detection from audio
 */
export async function detectLanguageFromAudio(audioSegment: AudioBuffer): Promise<LanguageInfo> {
  const detector = new LanguageDetector({
    confidenceThreshold: 0.7,
    useApiDetection: true,
    apiKey: process.env.GOOGLE_CLOUD_API_KEY,
    defaultLanguage: 'en',
  });

  const languageInfo = await detector.detect(audioSegment);
  
  console.log(`Detected language: ${languageInfo.languageCode}`);
  console.log(`Confidence: ${languageInfo.confidence}`);
  
  if (languageInfo.alternativeLanguages.length > 0) {
    console.log('Alternative languages:');
    languageInfo.alternativeLanguages.forEach(alt => {
      console.log(`  - ${alt.code}: ${alt.confidence}`);
    });
  }
  
  return languageInfo;
}

/**
 * Example 2: Language detection from text (fallback method)
 */
export function detectLanguageFromText(text: string): LanguageInfo {
  const detector = new LanguageDetector();
  const languageInfo = detector.detectFromText(text);
  
  console.log(`Text language: ${languageInfo.languageCode}`);
  console.log(`Confidence: ${languageInfo.confidence}`);
  
  return languageInfo;
}

/**
 * Example 3: Integration with speech recognition pipeline
 * 
 * This demonstrates how language detection fits into the overall
 * speech processing pipeline (Requirement 3.5)
 */
export async function processSpeechWithLanguageDetection(
  audioSegment: AudioBuffer,
  targetLanguage: string
): Promise<{
  detectedLanguage: string;
  shouldTranslate: boolean;
  languageInfo: LanguageInfo;
}> {
  const detector = new LanguageDetector({
    confidenceThreshold: 0.7,
    useApiDetection: true,
  });

  // Step 1: Detect language from audio (Requirements 3.1, 3.2)
  const languageInfo = await detector.detect(audioSegment);
  
  // Step 2: Associate language info with audio segment (Requirement 3.3)
  const detectedLanguage = languageInfo.languageCode;
  
  // Step 3: Determine if translation is needed
  const shouldTranslate = detectedLanguage !== targetLanguage;
  
  console.log(`Detected: ${detectedLanguage}, Target: ${targetLanguage}`);
  console.log(`Translation needed: ${shouldTranslate}`);
  
  // Step 4: Select appropriate speech recognition engine (Requirement 3.5)
  // This would be handled by the SpeechRecognizer service
  
  return {
    detectedLanguage,
    shouldTranslate,
    languageInfo,
  };
}

/**
 * Example 4: Handling low confidence scenarios (Requirement 3.4)
 */
export async function detectWithConfidenceHandling(
  audioSegment: AudioBuffer
): Promise<LanguageInfo> {
  const detector = new LanguageDetector({
    confidenceThreshold: 0.7, // Trigger secondary confirmation below 0.7
    useApiDetection: true,
  });

  const languageInfo = await detector.detect(audioSegment);
  
  if (languageInfo.confidence < 0.7) {
    console.log('Low confidence detected, secondary confirmation was triggered');
    console.log('Alternative languages considered:');
    languageInfo.alternativeLanguages.forEach(alt => {
      console.log(`  - ${alt.code}: ${alt.confidence}`);
    });
  } else {
    console.log('High confidence detection');
  }
  
  return languageInfo;
}

/**
 * Example 5: Multi-language session handling
 * 
 * Demonstrates how to handle a conversation with multiple languages
 */
export class MultiLanguageSession {
  private detector: LanguageDetector;
  private detectedLanguages: Map<string, number> = new Map();

  constructor() {
    this.detector = new LanguageDetector({
      confidenceThreshold: 0.7,
      useApiDetection: true,
    });
  }

  async processAudioSegment(audioSegment: AudioBuffer): Promise<LanguageInfo> {
    const languageInfo = await this.detector.detect(audioSegment);
    
    // Track language usage in the session
    const currentCount = this.detectedLanguages.get(languageInfo.languageCode) || 0;
    this.detectedLanguages.set(languageInfo.languageCode, currentCount + 1);
    
    return languageInfo;
  }

  getLanguageStatistics(): Array<{ language: string; count: number }> {
    return Array.from(this.detectedLanguages.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);
  }

  getMostCommonLanguage(): string | null {
    const stats = this.getLanguageStatistics();
    return stats.length > 0 ? stats[0].language : null;
  }
}

/**
 * Example 6: Adaptive language detection
 * 
 * Adjusts confidence threshold based on session context
 */
export class AdaptiveLanguageDetector {
  private detector: LanguageDetector;
  private recentDetections: LanguageInfo[] = [];
  private maxHistory = 10;

  constructor() {
    this.detector = new LanguageDetector({
      confidenceThreshold: 0.7,
      useApiDetection: true,
    });
  }

  async detect(audioSegment: AudioBuffer): Promise<LanguageInfo> {
    const languageInfo = await this.detector.detect(audioSegment);
    
    // Add to history
    this.recentDetections.push(languageInfo);
    if (this.recentDetections.length > this.maxHistory) {
      this.recentDetections.shift();
    }
    
    // Adjust confidence threshold based on consistency
    const consistency = this.calculateConsistency();
    if (consistency > 0.8) {
      // High consistency, can lower threshold
      this.detector.updateConfig({ confidenceThreshold: 0.6 });
    } else {
      // Low consistency, increase threshold
      this.detector.updateConfig({ confidenceThreshold: 0.8 });
    }
    
    return languageInfo;
  }

  private calculateConsistency(): number {
    if (this.recentDetections.length < 2) {
      return 1.0;
    }
    
    const mostCommon = this.getMostCommonLanguage();
    const matchCount = this.recentDetections.filter(
      d => d.languageCode === mostCommon
    ).length;
    
    return matchCount / this.recentDetections.length;
  }

  private getMostCommonLanguage(): string {
    const counts = new Map<string, number>();
    
    this.recentDetections.forEach(detection => {
      const count = counts.get(detection.languageCode) || 0;
      counts.set(detection.languageCode, count + 1);
    });
    
    let maxCount = 0;
    let mostCommon = 'en';
    
    counts.forEach((count, language) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = language;
      }
    });
    
    return mostCommon;
  }
}
