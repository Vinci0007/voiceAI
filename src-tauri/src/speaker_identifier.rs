use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Voiceprint representation using MFCC-based features
/// This is a lightweight approach suitable for real-time processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Voiceprint {
    pub speaker_id: String,
    pub embedding: Vec<f32>,
    pub samples_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpeakerInfo {
    pub speaker_id: String,
    pub confidence: f32,
    pub is_new_speaker: bool,
}

/// Speaker identification using MFCC (Mel-Frequency Cepstral Coefficients)
/// This is a lightweight alternative to ECAPA-TDNN that provides good performance
/// for real-time applications without requiring heavy ML models
pub struct SpeakerIdentifier {
    voiceprints: HashMap<String, Voiceprint>,
    similarity_threshold: f32,
    next_speaker_id: usize,
}

impl SpeakerIdentifier {
    pub fn new() -> Self {
        SpeakerIdentifier {
            voiceprints: HashMap::new(),
            similarity_threshold: 0.75, // Threshold for speaker matching
            next_speaker_id: 1,
        }
    }

    /// Extract voiceprint from audio segment
    /// Uses MFCC features for speaker characterization
    pub fn extract_voiceprint(&self, audio_samples: &[f32], sample_rate: u32) -> Vec<f32> {
        // Extract MFCC features
        let mfcc_features = self.extract_mfcc(audio_samples, sample_rate);
        
        // Compute statistics over time to create speaker embedding
        self.compute_embedding(&mfcc_features)
    }

    /// Identify speaker from audio segment
    pub fn identify(&mut self, audio_samples: &[f32], sample_rate: u32) -> SpeakerInfo {
        let embedding = self.extract_voiceprint(audio_samples, sample_rate);
        
        // Find best matching speaker
        let mut best_match: Option<(String, f32)> = None;
        
        for (speaker_id, voiceprint) in &self.voiceprints {
            let similarity = self.compute_similarity(&embedding, &voiceprint.embedding);
            
            if similarity > self.similarity_threshold {
                if let Some((_, best_sim)) = &best_match {
                    if similarity > *best_sim {
                        best_match = Some((speaker_id.clone(), similarity));
                    }
                } else {
                    best_match = Some((speaker_id.clone(), similarity));
                }
            }
        }
        
        match best_match {
            Some((speaker_id, confidence)) => SpeakerInfo {
                speaker_id,
                confidence,
                is_new_speaker: false,
            },
            None => {
                // Register new speaker
                let speaker_id = format!("speaker_{}", self.next_speaker_id);
                self.next_speaker_id += 1;
                
                self.register_speaker(&speaker_id, embedding);
                
                SpeakerInfo {
                    speaker_id,
                    confidence: 1.0,
                    is_new_speaker: true,
                }
            }
        }
    }

    /// Register a new speaker with their voiceprint
    pub fn register_speaker(&mut self, speaker_id: &str, embedding: Vec<f32>) -> String {
        let voiceprint = Voiceprint {
            speaker_id: speaker_id.to_string(),
            embedding,
            samples_count: 1,
        };
        
        self.voiceprints.insert(speaker_id.to_string(), voiceprint);
        speaker_id.to_string()
    }

    /// Update existing speaker's voiceprint with new audio sample
    pub fn update_voiceprint(&mut self, speaker_id: &str, audio_samples: &[f32], sample_rate: u32) {
        let new_embedding = self.extract_voiceprint(audio_samples, sample_rate);
        
        if let Some(voiceprint) = self.voiceprints.get_mut(speaker_id) {
            // Update embedding using exponential moving average
            let alpha = 0.3; // Weight for new sample
            for (i, new_val) in new_embedding.iter().enumerate() {
                if i < voiceprint.embedding.len() {
                    voiceprint.embedding[i] = 
                        alpha * new_val + (1.0 - alpha) * voiceprint.embedding[i];
                }
            }
            voiceprint.samples_count += 1;
        }
    }

    /// Load voiceprint from database
    pub fn load_voiceprint(&mut self, speaker_id: &str, embedding_data: &[u8]) -> Result<(), String> {
        // Deserialize embedding from bytes
        let embedding: Vec<f32> = bincode::deserialize(embedding_data)
            .map_err(|e| format!("Failed to deserialize voiceprint: {}", e))?;
        
        let voiceprint = Voiceprint {
            speaker_id: speaker_id.to_string(),
            embedding,
            samples_count: 1,
        };
        
        self.voiceprints.insert(speaker_id.to_string(), voiceprint);
        Ok(())
    }

    /// Serialize voiceprint for database storage
    pub fn serialize_voiceprint(&self, speaker_id: &str) -> Result<Vec<u8>, String> {
        let voiceprint = self.voiceprints.get(speaker_id)
            .ok_or_else(|| format!("Speaker {} not found", speaker_id))?;
        
        bincode::serialize(&voiceprint.embedding)
            .map_err(|e| format!("Failed to serialize voiceprint: {}", e))
    }

    /// Get all registered speaker IDs
    pub fn get_speaker_ids(&self) -> Vec<String> {
        self.voiceprints.keys().cloned().collect()
    }

    /// Extract MFCC features from audio
    fn extract_mfcc(&self, samples: &[f32], sample_rate: u32) -> Vec<Vec<f32>> {
        // MFCC parameters
        let n_mfcc = 13; // Number of MFCC coefficients
        let frame_size = 512; // 32ms at 16kHz
        let hop_size = 256; // 16ms hop
        let n_filters = 26; // Number of mel filters
        
        // Pre-emphasis filter
        let emphasized = self.apply_preemphasis(samples);
        
        // Frame the signal
        let frames = self.frame_signal(&emphasized, frame_size, hop_size);
        
        // Apply window function
        let windowed_frames = self.apply_hamming_window(&frames, frame_size);
        
        // Compute power spectrum
        let power_spectra = self.compute_power_spectrum(&windowed_frames, frame_size);
        
        // Apply mel filterbank
        let mel_spectra = self.apply_mel_filterbank(&power_spectra, sample_rate, n_filters);
        
        // Compute DCT to get MFCC
        self.compute_dct(&mel_spectra, n_mfcc)
    }

    fn apply_preemphasis(&self, samples: &[f32]) -> Vec<f32> {
        let alpha = 0.97;
        let mut emphasized = Vec::with_capacity(samples.len());
        
        if samples.is_empty() {
            return emphasized;
        }
        
        emphasized.push(samples[0]);
        for i in 1..samples.len() {
            emphasized.push(samples[i] - alpha * samples[i - 1]);
        }
        
        emphasized
    }

    fn frame_signal(&self, samples: &[f32], frame_size: usize, hop_size: usize) -> Vec<Vec<f32>> {
        let mut frames = Vec::new();
        let mut start = 0;
        
        while start + frame_size <= samples.len() {
            frames.push(samples[start..start + frame_size].to_vec());
            start += hop_size;
        }
        
        frames
    }

    fn apply_hamming_window(&self, frames: &[Vec<f32>], frame_size: usize) -> Vec<Vec<f32>> {
        let window: Vec<f32> = (0..frame_size)
            .map(|n| 0.54 - 0.46 * (2.0 * std::f32::consts::PI * n as f32 / (frame_size - 1) as f32).cos())
            .collect();
        
        frames.iter()
            .map(|frame| {
                frame.iter()
                    .zip(window.iter())
                    .map(|(s, w)| s * w)
                    .collect()
            })
            .collect()
    }

    fn compute_power_spectrum(&self, frames: &[Vec<f32>], frame_size: usize) -> Vec<Vec<f32>> {
        frames.iter()
            .map(|frame| {
                // Simple magnitude spectrum (in production, use FFT library)
                let mut spectrum = vec![0.0; frame_size / 2];
                for i in 0..frame_size / 2 {
                    let real = frame[i];
                    let imag = if i + frame_size / 2 < frame.len() {
                        frame[i + frame_size / 2]
                    } else {
                        0.0
                    };
                    spectrum[i] = (real * real + imag * imag).sqrt();
                }
                spectrum
            })
            .collect()
    }

    fn apply_mel_filterbank(&self, power_spectra: &[Vec<f32>], _sample_rate: u32, n_filters: usize) -> Vec<Vec<f32>> {
        // Simplified mel filterbank
        // In production, use proper mel scale conversion
        let n_fft = if !power_spectra.is_empty() {
            power_spectra[0].len()
        } else {
            return Vec::new();
        };
        
        power_spectra.iter()
            .map(|spectrum| {
                let mut mel_spectrum = vec![0.0; n_filters];
                let bin_width = n_fft / n_filters;
                
                for (i, mel_val) in mel_spectrum.iter_mut().enumerate() {
                    let start = i * bin_width;
                    let end = ((i + 1) * bin_width).min(spectrum.len());
                    
                    if start < spectrum.len() {
                        *mel_val = spectrum[start..end].iter().sum::<f32>() / (end - start) as f32;
                    }
                }
                
                mel_spectrum
            })
            .collect()
    }

    fn compute_dct(&self, mel_spectra: &[Vec<f32>], n_mfcc: usize) -> Vec<Vec<f32>> {
        // Discrete Cosine Transform (Type-II)
        mel_spectra.iter()
            .map(|mel_frame| {
                let n = mel_frame.len();
                let mut mfcc = vec![0.0; n_mfcc];
                
                for k in 0..n_mfcc {
                    let mut sum = 0.0;
                    for (n_idx, &mel_val) in mel_frame.iter().enumerate() {
                        let log_mel = if mel_val > 0.0 { mel_val.ln() } else { -10.0 };
                        sum += log_mel * (std::f32::consts::PI * k as f32 * (n_idx as f32 + 0.5) / n as f32).cos();
                    }
                    mfcc[k] = sum;
                }
                
                mfcc
            })
            .collect()
    }

    fn compute_embedding(&self, mfcc_features: &[Vec<f32>]) -> Vec<f32> {
        if mfcc_features.is_empty() {
            return vec![0.0; 13]; // Return zero embedding
        }
        
        let n_coeffs = mfcc_features[0].len();
        let mut embedding = vec![0.0; n_coeffs * 2]; // Mean + Std
        
        // Compute mean
        for mfcc_frame in mfcc_features {
            for (i, &coeff) in mfcc_frame.iter().enumerate() {
                embedding[i] += coeff;
            }
        }
        
        for i in 0..n_coeffs {
            embedding[i] /= mfcc_features.len() as f32;
        }
        
        // Compute standard deviation
        for mfcc_frame in mfcc_features {
            for (i, &coeff) in mfcc_frame.iter().enumerate() {
                let diff = coeff - embedding[i];
                embedding[n_coeffs + i] += diff * diff;
            }
        }
        
        for i in 0..n_coeffs {
            embedding[n_coeffs + i] = (embedding[n_coeffs + i] / mfcc_features.len() as f32).sqrt();
        }
        
        embedding
    }

    fn compute_similarity(&self, embedding1: &[f32], embedding2: &[f32]) -> f32 {
        // Cosine similarity
        if embedding1.len() != embedding2.len() {
            return 0.0;
        }
        
        let mut dot_product = 0.0;
        let mut norm1 = 0.0;
        let mut norm2 = 0.0;
        
        for i in 0..embedding1.len() {
            dot_product += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }
        
        if norm1 == 0.0 || norm2 == 0.0 {
            return 0.0;
        }
        
        dot_product / (norm1.sqrt() * norm2.sqrt())
    }
}

impl Default for SpeakerIdentifier {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_speaker_identifier_creation() {
        let identifier = SpeakerIdentifier::new();
        assert_eq!(identifier.voiceprints.len(), 0);
        assert_eq!(identifier.next_speaker_id, 1);
    }

    #[test]
    fn test_register_speaker() {
        let mut identifier = SpeakerIdentifier::new();
        let embedding = vec![0.1, 0.2, 0.3, 0.4];
        
        let speaker_id = identifier.register_speaker("test_speaker", embedding.clone());
        assert_eq!(speaker_id, "test_speaker");
        assert_eq!(identifier.voiceprints.len(), 1);
        assert!(identifier.voiceprints.contains_key("test_speaker"));
    }

    #[test]
    fn test_extract_voiceprint() {
        let identifier = SpeakerIdentifier::new();
        let samples = vec![0.1; 1600]; // 100ms at 16kHz
        let embedding = identifier.extract_voiceprint(&samples, 16000);
        
        assert!(!embedding.is_empty());
        assert_eq!(embedding.len(), 26); // 13 MFCC * 2 (mean + std)
    }

    #[test]
    fn test_identify_new_speaker() {
        let mut identifier = SpeakerIdentifier::new();
        let samples = vec![0.1; 1600];
        
        let info = identifier.identify(&samples, 16000);
        assert!(info.is_new_speaker);
        assert_eq!(info.speaker_id, "speaker_1");
        assert_eq!(info.confidence, 1.0);
    }

    #[test]
    fn test_identify_existing_speaker() {
        let mut identifier = SpeakerIdentifier::new();
        let samples = vec![0.1; 1600];
        
        // First identification - new speaker
        let info1 = identifier.identify(&samples, 16000);
        assert!(info1.is_new_speaker);
        
        // Second identification with similar audio - should match
        let info2 = identifier.identify(&samples, 16000);
        assert!(!info2.is_new_speaker);
        assert_eq!(info2.speaker_id, info1.speaker_id);
    }

    #[test]
    fn test_update_voiceprint() {
        let mut identifier = SpeakerIdentifier::new();
        let samples1 = vec![0.1; 1600];
        
        let info = identifier.identify(&samples1, 16000);
        let speaker_id = info.speaker_id.clone();
        
        let original_embedding = identifier.voiceprints.get(&speaker_id).unwrap().embedding.clone();
        
        // Update with new samples
        let samples2 = vec![0.2; 1600];
        identifier.update_voiceprint(&speaker_id, &samples2, 16000);
        
        let updated_embedding = &identifier.voiceprints.get(&speaker_id).unwrap().embedding;
        
        // Embedding should have changed
        assert_ne!(original_embedding, *updated_embedding);
    }

    #[test]
    fn test_compute_similarity() {
        let identifier = SpeakerIdentifier::new();
        
        // Identical embeddings
        let emb1 = vec![1.0, 2.0, 3.0];
        let similarity = identifier.compute_similarity(&emb1, &emb1);
        assert!((similarity - 1.0).abs() < 0.001);
        
        // Orthogonal embeddings
        let emb2 = vec![1.0, 0.0, 0.0];
        let emb3 = vec![0.0, 1.0, 0.0];
        let similarity = identifier.compute_similarity(&emb2, &emb3);
        assert!((similarity - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_serialize_deserialize_voiceprint() {
        let mut identifier = SpeakerIdentifier::new();
        let embedding = vec![0.1, 0.2, 0.3, 0.4];
        
        identifier.register_speaker("test_speaker", embedding.clone());
        
        // Serialize
        let serialized = identifier.serialize_voiceprint("test_speaker").unwrap();
        assert!(!serialized.is_empty());
        
        // Deserialize into new identifier
        let mut identifier2 = SpeakerIdentifier::new();
        identifier2.load_voiceprint("test_speaker", &serialized).unwrap();
        
        assert!(identifier2.voiceprints.contains_key("test_speaker"));
        let loaded_embedding = &identifier2.voiceprints.get("test_speaker").unwrap().embedding;
        assert_eq!(loaded_embedding.len(), embedding.len());
    }

    #[test]
    fn test_preemphasis() {
        let identifier = SpeakerIdentifier::new();
        let samples = vec![1.0, 2.0, 3.0, 4.0];
        let emphasized = identifier.apply_preemphasis(&samples);
        
        assert_eq!(emphasized.len(), samples.len());
        assert_eq!(emphasized[0], samples[0]);
    }

    #[test]
    fn test_frame_signal() {
        let identifier = SpeakerIdentifier::new();
        let samples = vec![0.0; 1000];
        let frames = identifier.frame_signal(&samples, 256, 128);
        
        assert!(!frames.is_empty());
        assert_eq!(frames[0].len(), 256);
    }

    #[test]
    fn test_get_speaker_ids() {
        let mut identifier = SpeakerIdentifier::new();
        
        identifier.register_speaker("speaker1", vec![0.1, 0.2]);
        identifier.register_speaker("speaker2", vec![0.3, 0.4]);
        
        let ids = identifier.get_speaker_ids();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"speaker1".to_string()));
        assert!(ids.contains(&"speaker2".to_string()));
    }
}
