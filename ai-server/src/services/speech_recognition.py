import base64
import io
import os
import tempfile
import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger
import speech_recognition as sr
# import whisper  # Commented out due to compatibility issues
import numpy as np
import soundfile as sf

class SpeechRecognitionService:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.whisper_model = None
        # self.load_whisper_model()  # Commented out due to compatibility issues
        logger.info("Speech recognition service initialized (Whisper disabled due to compatibility issues)")

    def load_whisper_model(self):
        """Load Whisper model for speech recognition - DISABLED"""
        try:
            # Whisper model loading disabled due to compatibility issues
            logger.warning("Whisper model loading disabled due to compatibility issues")
            self.whisper_model = None
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.whisper_model = None

    def health_check(self) -> Dict[str, str]:
        """Health check for speech recognition service"""
        try:
            # Test basic functionality
            if self.whisper_model is not None:
                return {"status": "healthy", "service": "speech_recognition"}
            else:
                return {"status": "degraded", "service": "speech_recognition", "note": "Whisper model not available"}
        except Exception as e:
            logger.error(f"Speech recognition health check failed: {e}")
            return {"status": "unhealthy", "service": "speech_recognition", "error": str(e)}

    async def transcribe_audio(self, audio_data: bytes) -> Dict[str, Any]:
        """Transcribe audio to text using multiple methods"""
        try:
            # Try Whisper first (more accurate)
            if self.whisper_model:
                whisper_result = await self._transcribe_with_whisper(audio_data)
                if whisper_result["success"]:
                    return whisper_result
            
            # Fallback to Google Speech Recognition
            google_result = await self._transcribe_with_google(audio_data)
            if google_result["success"]:
                return google_result
            
            # If both fail, return empty result
            return {
                "success": False,
                "transcript": "",
                "confidence": 0.0,
                "words": [],
                "error": "All transcription methods failed"
            }
            
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return {
                "success": False,
                "transcript": "",
                "confidence": 0.0,
                "words": [],
                "error": str(e)
            }

    async def _transcribe_with_whisper(self, audio_data: bytes) -> Dict[str, Any]:
        """Transcribe using Whisper model - DISABLED"""
        try:
            logger.warning("Whisper transcription disabled due to compatibility issues")
            return {"success": False, "error": "Whisper model not available due to compatibility issues"}
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            return {"success": False, "error": str(e)}

    async def _transcribe_with_google(self, audio_data: bytes) -> Dict[str, Any]:
        """Transcribe using Google Speech Recognition"""
        try:
            # Convert audio data to AudioFile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            try:
                with sr.AudioFile(temp_file_path) as source:
                    # Record the audio data
                    audio = self.recognizer.record(source)
                
                # Recognize speech using Google
                transcript = self.recognizer.recognize_google(audio, show_all=True)
                
                if not transcript:
                    return {"success": False, "error": "No speech detected"}
                
                # Extract best result
                if isinstance(transcript, dict) and "alternative" in transcript:
                    best_result = transcript["alternative"][0]
                    text = best_result.get("transcript", "")
                    confidence = best_result.get("confidence", 0.8)
                else:
                    text = str(transcript)
                    confidence = 0.8
                
                # Create word-level data (simplified)
                words = []
                word_list = text.split()
                for i, word in enumerate(word_list):
                    words.append({
                        "word": word,
                        "start": i * 0.5,  # Rough estimate
                        "end": (i + 1) * 0.5,
                        "confidence": confidence
                    })
                
                return {
                    "success": True,
                    "transcript": text,
                    "confidence": confidence,
                    "words": words,
                    "method": "google"
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except sr.UnknownValueError:
            return {"success": False, "error": "Could not understand audio"}
        except sr.RequestError as e:
            logger.error(f"Google Speech Recognition error: {e}")
            return {"success": False, "error": f"Google API error: {e}"}
        except Exception as e:
            logger.error(f"Google transcription error: {e}")
            return {"success": False, "error": str(e)}

    async def analyze_speech_patterns(self, transcript: str, words: List[Dict] = None) -> Dict[str, Any]:
        """Analyze speech patterns from transcript"""
        try:
            if not transcript:
                return self._get_empty_speech_analysis()
            
            # Basic text analysis
            word_count = len(transcript.split())
            sentence_count = len([s for s in transcript.split('.') if s.strip()])
            
            # Calculate speaking rate if word timestamps are available
            speaking_rate = 0
            if words and len(words) > 1:
                total_duration = words[-1]["end"] - words[0]["start"]
                if total_duration > 0:
                    speaking_rate = (word_count / total_duration) * 60  # Words per minute
            
            # Analyze vocabulary complexity
            unique_words = len(set(transcript.lower().split()))
            vocabulary_diversity = unique_words / word_count if word_count > 0 else 0
            
            # Detect filler words
            filler_words = ["um", "uh", "er", "ah", "like", "you know", "so", "well"]
            filler_count = sum(transcript.lower().count(filler) for filler in filler_words)
            filler_percentage = (filler_count / word_count * 100) if word_count > 0 else 0
            
            # Analyze sentence structure
            avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0
            
            return {
                "word_count": word_count,
                "sentence_count": sentence_count,
                "speaking_rate_wpm": round(speaking_rate, 1),
                "vocabulary_diversity": round(vocabulary_diversity, 3),
                "filler_word_count": filler_count,
                "filler_percentage": round(filler_percentage, 2),
                "average_sentence_length": round(avg_sentence_length, 1),
                "speech_assessment": self._assess_speech_quality(
                    speaking_rate, vocabulary_diversity, filler_percentage
                )
            }
            
        except Exception as e:
            logger.error(f"Speech pattern analysis error: {e}")
            return self._get_empty_speech_analysis()

    async def extract_keywords(self, transcript: str) -> List[Dict[str, Any]]:
        """Extract keywords and key phrases from transcript"""
        try:
            if not transcript:
                return []
            
            # Simple keyword extraction (in production, use NLP libraries like spaCy)
            words = transcript.lower().split()
            
            # Remove common stop words
            stop_words = {
                "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
                "of", "with", "by", "from", "up", "about", "into", "through", "during",
                "before", "after", "above", "below", "between", "among", "is", "are",
                "was", "were", "be", "been", "being", "have", "has", "had", "do", "does",
                "did", "will", "would", "could", "should", "may", "might", "must", "can",
                "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them"
            }
            
            # Count word frequencies
            word_freq = {}
            for word in words:
                clean_word = word.strip(".,!?;:")
                if clean_word and clean_word not in stop_words and len(clean_word) > 2:
                    word_freq[clean_word] = word_freq.get(clean_word, 0) + 1
            
            # Sort by frequency and return top keywords
            keywords = []
            for word, freq in sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]:
                keywords.append({
                    "keyword": word,
                    "frequency": freq,
                    "relevance": min(freq / len(words) * 100, 100)
                })
            
            return keywords
            
        except Exception as e:
            logger.error(f"Keyword extraction error: {e}")
            return []

    async def detect_emotions_from_speech(self, transcript: str) -> Dict[str, Any]:
        """Detect emotions from speech content (text-based)"""
        try:
            if not transcript:
                return {"emotions": {}, "dominant_emotion": "neutral"}
            
            # Simple emotion detection based on keywords
            emotion_keywords = {
                "positive": ["good", "great", "excellent", "amazing", "wonderful", "fantastic", "love", "enjoy", "happy", "excited"],
                "negative": ["bad", "terrible", "awful", "hate", "dislike", "frustrated", "angry", "sad", "disappointed"],
                "confident": ["confident", "sure", "certain", "definitely", "absolutely", "strong", "capable"],
                "uncertain": ["maybe", "perhaps", "possibly", "unsure", "uncertain", "might", "could be"],
                "enthusiastic": ["excited", "passionate", "enthusiastic", "eager", "motivated", "driven"]
            }
            
            text_lower = transcript.lower()
            emotion_scores = {}
            
            for emotion, keywords in emotion_keywords.items():
                score = sum(text_lower.count(keyword) for keyword in keywords)
                emotion_scores[emotion] = score
            
            # Normalize scores
            total_score = sum(emotion_scores.values())
            if total_score > 0:
                emotion_percentages = {
                    emotion: (score / total_score) * 100 
                    for emotion, score in emotion_scores.items()
                }
            else:
                emotion_percentages = {emotion: 0 for emotion in emotion_keywords.keys()}
            
            # Find dominant emotion
            dominant_emotion = max(emotion_percentages.items(), key=lambda x: x[1])
            
            return {
                "emotions": emotion_percentages,
                "dominant_emotion": dominant_emotion[0] if dominant_emotion[1] > 0 else "neutral",
                "confidence": min(dominant_emotion[1] / 10, 1.0) if dominant_emotion[1] > 0 else 0.5
            }
            
        except Exception as e:
            logger.error(f"Emotion detection error: {e}")
            return {"emotions": {}, "dominant_emotion": "neutral", "confidence": 0.5}

    def _assess_speech_quality(self, speaking_rate: float, vocabulary_diversity: float, filler_percentage: float) -> str:
        """Assess overall speech quality"""
        issues = []
        
        if speaking_rate > 0:
            if speaking_rate < 120:
                issues.append("speaking too slowly")
            elif speaking_rate > 180:
                issues.append("speaking too quickly")
        
        if vocabulary_diversity < 0.3:
            issues.append("limited vocabulary variety")
        
        if filler_percentage > 5:
            issues.append("excessive filler words")
        
        if not issues:
            return "Excellent speech quality"
        elif len(issues) == 1:
            return f"Good speech quality - consider {issues[0]}"
        else:
            return f"Fair speech quality - work on {', '.join(issues)}"

    def _get_empty_speech_analysis(self) -> Dict[str, Any]:
        """Return empty speech analysis"""
        return {
            "word_count": 0,
            "sentence_count": 0,
            "speaking_rate_wpm": 0,
            "vocabulary_diversity": 0,
            "filler_word_count": 0,
            "filler_percentage": 0,
            "average_sentence_length": 0,
            "speech_assessment": "No speech detected"
        }