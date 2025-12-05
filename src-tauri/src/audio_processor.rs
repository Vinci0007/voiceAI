use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Host, Stream, StreamConfig};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioQuality {
    pub snr: f32,
    pub clarity: f32,
    pub has_echo: bool,
    pub has_noise: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessedAudio {
    pub samples: Vec<f32>,
    pub sample_rate: u32,
    pub channels: u16,
    pub quality: AudioQuality,
    pub timestamp: i64,
}

pub struct AudioProcessor {
    host: Host,
    input_device: Option<Device>,
    output_device: Option<Device>,
    config: Option<StreamConfig>,
    noise_threshold: f32,
    echo_threshold: f32,
}

impl AudioProcessor {
    pub fn new() -> Result<Self, String> {
        let host = cpal::default_host();
        
        Ok(AudioProcessor {
            host,
            input_device: None,
            output_device: None,
            config: None,
            noise_threshold: 0.02,
            echo_threshold: 0.3,
        })
    }

    pub fn initialize_input(&mut self) -> Result<(), String> {
        let device = self.host
            .default_input_device()
            .ok_or("No input device available")?;
        
        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get input config: {}", e))?;
        
        self.input_device = Some(device);
        self.config = Some(config.into());
        
        Ok(())
    }

    pub fn initialize_output(&mut self) -> Result<(), String> {
        let device = self.host
            .default_output_device()
            .ok_or("No output device available")?;
        
        self.output_device = Some(device);
        
        Ok(())
    }

    pub fn process(&self, audio_data: &[f32], sample_rate: u32, channels: u16) -> ProcessedAudio {
        let mut processed = audio_data.to_vec();
        
        // Apply noise reduction
        self.apply_noise_reduction(&mut processed);
        
        // Apply echo cancellation
        self.apply_echo_cancellation(&mut processed);
        
        // Normalize volume
        self.normalize_volume(&mut processed);
        
        // Assess audio quality
        let quality = self.assess_quality(&processed);
        
        ProcessedAudio {
            samples: processed,
            sample_rate,
            channels,
            quality,
            timestamp: chrono::Utc::now().timestamp_millis(),
        }
    }

    fn apply_noise_reduction(&self, samples: &mut [f32]) {
        // Simple noise gate implementation
        // In production, use nnnoiseless or webrtc-audio-processing
        let threshold = self.noise_threshold;
        
        for sample in samples.iter_mut() {
            if sample.abs() < threshold {
                *sample = 0.0;
            }
        }
    }

    fn apply_echo_cancellation(&self, samples: &mut [f32]) {
        // Simple echo reduction using high-pass filter
        // In production, use webrtc-audio-processing
        if samples.len() < 2 {
            return;
        }
        
        let alpha = 0.95; // High-pass filter coefficient
        let mut prev = samples[0];
        
        for i in 1..samples.len() {
            let current = samples[i];
            samples[i] = alpha * (samples[i] + prev - samples[i - 1]);
            prev = current;
        }
    }

    fn normalize_volume(&self, samples: &mut [f32]) {
        // Find peak amplitude
        let peak = samples.iter()
            .map(|s| s.abs())
            .fold(0.0f32, f32::max);
        
        if peak > 0.0 && peak < 1.0 {
            // Normalize to 0.8 to avoid clipping
            let gain = 0.8 / peak;
            for sample in samples.iter_mut() {
                *sample *= gain;
            }
        } else if peak > 1.0 {
            // Prevent clipping
            let gain = 0.8 / peak;
            for sample in samples.iter_mut() {
                *sample *= gain;
            }
        }
    }

    fn assess_quality(&self, samples: &[f32]) -> AudioQuality {
        // Calculate Signal-to-Noise Ratio (simplified)
        let signal_power: f32 = samples.iter()
            .map(|s| s * s)
            .sum::<f32>() / samples.len() as f32;
        
        let noise_power: f32 = samples.iter()
            .filter(|s| s.abs() < self.noise_threshold)
            .map(|s| s * s)
            .sum::<f32>() / samples.len() as f32;
        
        let snr = if noise_power > 0.0 {
            10.0 * (signal_power / noise_power).log10()
        } else {
            100.0 // Very high SNR
        };
        
        // Calculate clarity (based on signal strength)
        let clarity = (signal_power.sqrt() * 2.0).min(1.0);
        
        // Detect echo (simplified - check for repetitive patterns)
        let has_echo = self.detect_echo(samples);
        
        // Detect noise (check if noise level is high)
        let has_noise = noise_power > self.noise_threshold * self.noise_threshold;
        
        AudioQuality {
            snr,
            clarity,
            has_echo,
            has_noise,
        }
    }

    fn detect_echo(&self, samples: &[f32]) -> bool {
        // Simplified echo detection
        // Check for correlation with delayed version
        if samples.len() < 1000 {
            return false;
        }
        
        let delay = 500; // Check for echo at 500 samples delay
        let mut correlation = 0.0;
        let check_len = (samples.len() - delay).min(500);
        
        for i in 0..check_len {
            correlation += samples[i] * samples[i + delay];
        }
        
        correlation /= check_len as f32;
        correlation.abs() > self.echo_threshold
    }

    pub fn get_input_devices(&self) -> Result<Vec<String>, String> {
        let devices: Vec<String> = self.host
            .input_devices()
            .map_err(|e| format!("Failed to enumerate input devices: {}", e))?
            .filter_map(|d| d.name().ok())
            .collect();
        
        Ok(devices)
    }

    pub fn get_output_devices(&self) -> Result<Vec<String>, String> {
        let devices: Vec<String> = self.host
            .output_devices()
            .map_err(|e| format!("Failed to enumerate output devices: {}", e))?
            .filter_map(|d| d.name().ok())
            .collect();
        
        Ok(devices)
    }

    pub fn start_capture<F>(&self, callback: F) -> Result<Stream, String>
    where
        F: FnMut(&[f32]) + Send + 'static,
    {
        let device = self.input_device.as_ref()
            .ok_or("Input device not initialized")?;
        
        let config = self.config.as_ref()
            .ok_or("Audio config not initialized")?;
        
        let callback = Arc::new(Mutex::new(callback));
        
        let stream = device
            .build_input_stream(
                config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut cb) = callback.lock() {
                        cb(data);
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {}", e))?;
        
        stream.play()
            .map_err(|e| format!("Failed to start stream: {}", e))?;
        
        Ok(stream)
    }
}

impl Default for AudioProcessor {
    fn default() -> Self {
        Self::new().expect("Failed to create AudioProcessor")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_processor_creation() {
        let processor = AudioProcessor::new();
        assert!(processor.is_ok());
    }

    #[test]
    fn test_noise_reduction() {
        let processor = AudioProcessor::new().unwrap();
        let mut samples = vec![0.01, 0.5, 0.01, 0.8, 0.005];
        processor.apply_noise_reduction(&mut samples);
        
        // Small values should be zeroed
        assert_eq!(samples[0], 0.0);
        assert_eq!(samples[2], 0.0);
        assert_eq!(samples[4], 0.0);
        
        // Large values should remain
        assert!(samples[1] > 0.0);
        assert!(samples[3] > 0.0);
    }

    #[test]
    fn test_volume_normalization() {
        let processor = AudioProcessor::new().unwrap();
        let mut samples = vec![0.1, 0.2, 0.3, 0.4, 0.5];
        processor.normalize_volume(&mut samples);
        
        // Peak should be normalized to around 0.8
        let peak = samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        assert!((peak - 0.8).abs() < 0.01);
    }

    #[test]
    fn test_process_audio() {
        let processor = AudioProcessor::new().unwrap();
        let samples = vec![0.01, 0.5, 0.01, 0.8, 0.005, 0.6];
        let processed = processor.process(&samples, 16000, 1);
        
        assert_eq!(processed.sample_rate, 16000);
        assert_eq!(processed.channels, 1);
        assert!(processed.quality.snr > 0.0);
        assert!(processed.quality.clarity >= 0.0 && processed.quality.clarity <= 1.0);
    }

    #[test]
    fn test_quality_assessment() {
        let processor = AudioProcessor::new().unwrap();
        
        // High quality signal
        let high_quality = vec![0.5; 1000];
        let quality = processor.assess_quality(&high_quality);
        assert!(quality.snr > 10.0);
        assert!(quality.clarity > 0.5);
        
        // Low quality signal (mostly noise)
        let low_quality = vec![0.01; 1000];
        let quality = processor.assess_quality(&low_quality);
        assert!(quality.clarity < 0.5);
    }
}
