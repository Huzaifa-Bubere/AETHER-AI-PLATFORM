import base64
import io
import numpy as np
import librosa
import soundfile as sf
from typing import Dict, List, Any, Optional
from loguru import logger
import re
from collections import Counter

class AudioAnalysisService:
    def __init__(self):
        self.sample_rate = 44100
        self.filler_words = [
            'um', 'uh', 'er', 'ah', 'like', 'you know', 'so', 'well',
            'actually', 'basically', 'literally', 'right', 'okay', 'yeah'
        ]
        logger.info("Audio analysis service initialized")

    def health_check(self) -> Dict[str, str]:
        """Health check for audio analysis service"""
        try:
            # Test basic functionality
            test_audio = np.random.random(1000).astype(np.float32)
            _ = librosa.feature.mfcc(y=test_audio, sr=self.sample_rate, n_mfcc=13)
            return {"status": "healthy", "service": "audio_analysis"}
        except Exception as e:
            logger.error(f"Audio analysis health check failed: {e}")
            return {"status": "unhealthy", "service": "audio_analysis", "error": str(e)}

    async def analyze_audio(self, audio_data: str, sample_rate: int = 44100, duration: float = 0) -> Dict[str, Any]:
        """Comprehensive audio analysis"""
        try:
            # Decode base64 audio data
            audio_bytes = base64.b64decode(audio_data)
            audio_array, sr = sf.read(io.BytesIO(audio_bytes))
            
            # Ensure mono audio
            if len(audio_array.shape) > 1:
                audio_array = np.mean(audio_array, axis=1)
            
            # Resample if necessary
            if sr != sample_rate:
                audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=sample_rate)
                sr = sample_rate
            
            # Perform various analyses
            results = {
                "speech_rate": await self._analyze_speech_rate(audio_array, sr),
                "pause_analysis": await self._analyze_pauses(audio_array, sr),
                "tone_analysis": await self._analyze_tone(audio_array, sr),
                "clarity_score": await self._analyze_clarity(audio_array, sr),
                "volume_analysis": await self._analyze_volume(audio_array, sr),
                "energy_analysis": await self._analyze_energy(audio_array, sr)
            }
            
            logger.info("Audio analysis completed successfully")
            return results
            
        except Exception as e:
            logger.error(f"Audio analysis error: {e}")
            return self._get_fallback_audio_analysis()

    async def detect_filler_words(self, transcript: str, audio_timestamps: List[float] = None) -> Dict[str, Any]:
        """Detect filler words in transcript"""
        try:
            words = transcript.lower().split()
            total_words = len(words)
            
            filler_count = 0
            filler_instances = []
            
            for i, word in enumerate(words):
                # Clean word of punctuation
                clean_word = re.sub(r'[^\w\s]', '', word)
                
                if clean_word in self.filler_words:
                    filler_count += 1
                    filler_instances.append({
                        "word": clean_word,
                        "position": i,
                        "timestamp": audio_timestamps[i] if audio_timestamps and i < len(audio_timestamps) else None
                    })
            
            filler_percentage = (filler_count / total_words * 100) if total_words > 0 else 0
            
            # Count frequency of each filler word
            filler_frequency = Counter([instance["word"] for instance in filler_instances])
            
            return {
                "total_filler_words": filler_count,
                "total_words": total_words,
                "filler_percentage": round(filler_percentage, 2),
                "filler_instances": filler_instances,
                "filler_frequency": dict(filler_frequency),
                "assessment": self._assess_filler_usage(filler_percentage)
            }
            
        except Exception as e:
            logger.error(f"Filler word detection error: {e}")
            return {
                "total_filler_words": 0,
                "total_words": 0,
                "filler_percentage": 0,
                "filler_instances": [],
                "filler_frequency": {},
                "assessment": "Unable to analyze"
            }

    async def _analyze_speech_rate(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze speech rate (words per minute)"""
        try:
            # Estimate speech segments using energy-based voice activity detection
            frame_length = int(0.025 * sr)  # 25ms frames
            hop_length = int(0.01 * sr)     # 10ms hop
            
            # Calculate energy
            energy = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop_length)[0]
            
            # Simple voice activity detection
            energy_threshold = np.mean(energy) * 0.3
            speech_frames = energy > energy_threshold
            
            # Calculate speech duration
            speech_duration = np.sum(speech_frames) * hop_length / sr
            
            # Estimate words (rough approximation: 2.5 syllables per second average)
            estimated_syllables = speech_duration * 2.5
            estimated_words = estimated_syllables / 1.5  # Average syllables per word
            
            # Calculate WPM
            duration_minutes = len(audio) / sr / 60
            wpm = estimated_words / duration_minutes if duration_minutes > 0 else 0
            
            return {
                "words_per_minute": round(wpm, 1),
                "speech_duration": round(speech_duration, 2),
                "total_duration": round(len(audio) / sr, 2),
                "speech_percentage": round((speech_duration / (len(audio) / sr)) * 100, 1),
                "assessment": self._assess_speech_rate(wpm)
            }
            
        except Exception as e:
            logger.error(f"Speech rate analysis error: {e}")
            return {
                "words_per_minute": 150,
                "speech_duration": 0,
                "total_duration": 0,
                "speech_percentage": 0,
                "assessment": "Normal pace"
            }

    async def _analyze_pauses(self, audio: np.ndarray, sr: int) -> List[Dict[str, Any]]:
        """Analyze pause patterns"""
        try:
            # Voice activity detection
            frame_length = int(0.025 * sr)
            hop_length = int(0.01 * sr)
            
            energy = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop_length)[0]
            energy_threshold = np.mean(energy) * 0.2
            
            # Find silent segments
            silent_frames = energy < energy_threshold
            
            # Convert to time
            time_per_frame = hop_length / sr
            
            pauses = []
            in_pause = False
            pause_start = 0
            
            for i, is_silent in enumerate(silent_frames):
                if is_silent and not in_pause:
                    # Start of pause
                    in_pause = True
                    pause_start = i * time_per_frame
                elif not is_silent and in_pause:
                    # End of pause
                    in_pause = False
                    pause_duration = (i * time_per_frame) - pause_start
                    
                    # Only consider pauses longer than 0.3 seconds
                    if pause_duration > 0.3:
                        pauses.append({
                            "start_time": round(pause_start, 2),
                            "duration": round(pause_duration, 2),
                            "type": self._classify_pause(pause_duration)
                        })
            
            return pauses
            
        except Exception as e:
            logger.error(f"Pause analysis error: {e}")
            return []

    async def _analyze_tone(self, audio: np.ndarray, sr: int) -> List[Dict[str, Any]]:
        """Analyze tone and pitch variations"""
        try:
            # Extract pitch using librosa
            pitches, magnitudes = librosa.piptrack(y=audio, sr=sr, threshold=0.1)
            
            # Get fundamental frequency over time
            f0 = []
            for t in range(pitches.shape[1]):
                index = magnitudes[:, t].argmax()
                pitch = pitches[index, t]
                if pitch > 0:
                    f0.append(pitch)
            
            if not f0:
                return [{"analysis": "Unable to detect pitch"}]
            
            f0 = np.array(f0)
            
            # Calculate statistics
            mean_pitch = np.mean(f0)
            pitch_std = np.std(f0)
            pitch_range = np.max(f0) - np.min(f0)
            
            # Analyze pitch contour
            pitch_variation = pitch_std / mean_pitch if mean_pitch > 0 else 0
            
            return [{
                "mean_pitch_hz": round(mean_pitch, 2),
                "pitch_variation": round(pitch_variation, 3),
                "pitch_range_hz": round(pitch_range, 2),
                "tone_assessment": self._assess_tone(mean_pitch, pitch_variation)
            }]
            
        except Exception as e:
            logger.error(f"Tone analysis error: {e}")
            return [{"analysis": "Tone analysis unavailable"}]

    async def _analyze_clarity(self, audio: np.ndarray, sr: int) -> float:
        """Analyze speech clarity"""
        try:
            # Calculate spectral features that correlate with clarity
            spectral_centroids = librosa.feature.spectral_centroid(y=audio, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=audio, sr=sr)[0]
            zero_crossing_rate = librosa.feature.zero_crossing_rate(audio)[0]
            
            # Normalize features
            centroid_score = np.mean(spectral_centroids) / 4000  # Normalize to ~0-1
            rolloff_score = np.mean(spectral_rolloff) / 8000
            zcr_score = np.mean(zero_crossing_rate) * 10
            
            # Combine scores (this is a simplified heuristic)
            clarity_score = (centroid_score + rolloff_score + zcr_score) / 3
            clarity_score = min(max(clarity_score, 0), 1) * 100  # Scale to 0-100
            
            return round(clarity_score, 1)
            
        except Exception as e:
            logger.error(f"Clarity analysis error: {e}")
            return 75.0  # Default score

    async def _analyze_volume(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze volume patterns"""
        try:
            # Calculate RMS energy
            rms = librosa.feature.rms(y=audio)[0]
            
            # Convert to dB
            rms_db = librosa.amplitude_to_db(rms)
            
            return {
                "average_volume_db": round(np.mean(rms_db), 2),
                "volume_variation_db": round(np.std(rms_db), 2),
                "max_volume_db": round(np.max(rms_db), 2),
                "min_volume_db": round(np.min(rms_db), 2),
                "volume_assessment": self._assess_volume(np.mean(rms_db), np.std(rms_db))
            }
            
        except Exception as e:
            logger.error(f"Volume analysis error: {e}")
            return {
                "average_volume_db": -20,
                "volume_variation_db": 5,
                "max_volume_db": -10,
                "min_volume_db": -30,
                "volume_assessment": "Normal volume"
            }

    async def _analyze_energy(self, audio: np.ndarray, sr: int) -> Dict[str, Any]:
        """Analyze energy patterns"""
        try:
            # Calculate energy over time
            frame_length = int(0.1 * sr)  # 100ms frames
            hop_length = int(0.05 * sr)   # 50ms hop
            
            energy = librosa.feature.rms(y=audio, frame_length=frame_length, hop_length=hop_length)[0]
            
            return {
                "average_energy": round(np.mean(energy), 4),
                "energy_variation": round(np.std(energy), 4),
                "energy_peaks": len([e for e in energy if e > np.mean(energy) + 2 * np.std(energy)]),
                "energy_consistency": round(1 - (np.std(energy) / np.mean(energy)), 3) if np.mean(energy) > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Energy analysis error: {e}")
            return {
                "average_energy": 0.1,
                "energy_variation": 0.05,
                "energy_peaks": 0,
                "energy_consistency": 0.8
            }

    def _assess_speech_rate(self, wpm: float) -> str:
        """Assess speech rate"""
        if wpm < 120:
            return "Slow pace - consider speaking slightly faster"
        elif wpm > 180:
            return "Fast pace - consider slowing down slightly"
        else:
            return "Good pace"

    def _assess_filler_usage(self, percentage: float) -> str:
        """Assess filler word usage"""
        if percentage < 2:
            return "Excellent - minimal filler words"
        elif percentage < 5:
            return "Good - acceptable filler word usage"
        elif percentage < 10:
            return "Fair - try to reduce filler words"
        else:
            return "Poor - significant filler word usage"

    def _classify_pause(self, duration: float) -> str:
        """Classify pause type"""
        if duration < 1:
            return "short"
        elif duration < 3:
            return "medium"
        else:
            return "long"

    def _assess_tone(self, mean_pitch: float, variation: float) -> str:
        """Assess tone characteristics"""
        if variation < 0.1:
            return "Monotone - add more vocal variety"
        elif variation > 0.3:
            return "Highly varied - good vocal expression"
        else:
            return "Good vocal variety"

    def _assess_volume(self, mean_db: float, std_db: float) -> str:
        """Assess volume characteristics"""
        if mean_db < -30:
            return "Too quiet - speak louder"
        elif mean_db > -10:
            return "Too loud - speak softer"
        elif std_db > 10:
            return "Inconsistent volume"
        else:
            return "Good volume control"

    def _get_fallback_audio_analysis(self) -> Dict[str, Any]:
        """Fallback analysis when processing fails"""
        return {
            "speech_rate": {
                "words_per_minute": 150,
                "assessment": "Normal pace"
            },
            "pause_analysis": [],
            "tone_analysis": [{"analysis": "Analysis unavailable"}],
            "clarity_score": 75.0,
            "volume_analysis": {
                "average_volume_db": -20,
                "volume_assessment": "Normal volume"
            },
            "energy_analysis": {
                "average_energy": 0.1,
                "energy_consistency": 0.8
            }
        }