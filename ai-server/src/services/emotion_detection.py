import base64
import io
import cv2
import numpy as np
from typing import Dict, List, Any, Optional
from loguru import logger
import tempfile
import os

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    logger.warning("DeepFace not available, using fallback emotion detection")

class EmotionDetectionService:
    def __init__(self):
        self.emotions = ["angry", "disgust", "fear", "happy", "sad", "surprise", "neutral"]
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        logger.info(f"Emotion detection service initialized (DeepFace: {DEEPFACE_AVAILABLE})")

    def health_check(self) -> Dict[str, str]:
        """Health check for emotion detection service"""
        try:
            # Test basic functionality
            test_image = np.zeros((480, 640, 3), dtype=np.uint8)
            faces = self.face_cascade.detectMultiScale(test_image, 1.1, 4)
            
            status = "healthy" if DEEPFACE_AVAILABLE else "degraded"
            return {"status": status, "service": "emotion_detection"}
        except Exception as e:
            logger.error(f"Emotion detection health check failed: {e}")
            return {"status": "unhealthy", "service": "emotion_detection", "error": str(e)}

    async def analyze_emotions(self, image_data: str, timestamp: float = 0) -> Dict[str, Any]:
        """Analyze emotions from a single image"""
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                raise ValueError("Could not decode image")
            
            # Use DeepFace if available, otherwise use fallback
            if DEEPFACE_AVAILABLE:
                result = await self._analyze_with_deepface(image, timestamp)
            else:
                result = await self._analyze_with_fallback(image, timestamp)
            
            logger.info(f"Emotion analysis completed for timestamp {timestamp}")
            return result
            
        except Exception as e:
            logger.error(f"Emotion analysis error: {e}")
            return self._get_fallback_emotion_result(timestamp)

    async def batch_analyze_video(self, video_data: bytes) -> List[Dict[str, Any]]:
        """Analyze emotions throughout an entire video"""
        try:
            # Save video to temporary file
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
                temp_file.write(video_data)
                temp_file_path = temp_file.name
            
            try:
                # Open video
                cap = cv2.VideoCapture(temp_file_path)
                
                if not cap.isOpened():
                    raise ValueError("Could not open video file")
                
                fps = cap.get(cv2.CAP_PROP_FPS)
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                duration = frame_count / fps if fps > 0 else 0
                
                # Analyze frames at regular intervals (every 2 seconds)
                interval_seconds = 2.0
                frame_interval = int(fps * interval_seconds) if fps > 0 else 30
                
                emotions_timeline = []
                frame_number = 0
                
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Analyze frame if it's at the right interval
                    if frame_number % frame_interval == 0:
                        timestamp = frame_number / fps if fps > 0 else frame_number * 0.033
                        
                        # Convert frame to base64 for analysis
                        _, buffer = cv2.imencode('.jpg', frame)
                        frame_base64 = base64.b64encode(buffer).decode('utf-8')
                        
                        # Analyze emotions
                        emotion_result = await self.analyze_emotions(frame_base64, timestamp)
                        emotions_timeline.append(emotion_result)
                    
                    frame_number += 1
                
                cap.release()
                
                # Calculate overall emotion statistics
                overall_stats = self._calculate_emotion_statistics(emotions_timeline)
                
                return {
                    "timeline": emotions_timeline,
                    "overall_statistics": overall_stats,
                    "video_duration": duration,
                    "frames_analyzed": len(emotions_timeline)
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"Batch emotion analysis error: {e}")
            return {
                "timeline": [],
                "overall_statistics": self._get_default_emotion_stats(),
                "video_duration": 0,
                "frames_analyzed": 0,
                "error": str(e)
            }

    async def _analyze_with_deepface(self, image: np.ndarray, timestamp: float) -> Dict[str, Any]:
        """Analyze emotions using DeepFace"""
        try:
            # Save image to temporary file for DeepFace
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
                cv2.imwrite(temp_file.name, image)
                temp_file_path = temp_file.name
            
            try:
                # Analyze with DeepFace
                result = DeepFace.analyze(
                    img_path=temp_file_path,
                    actions=['emotion'],
                    enforce_detection=False
                )
                
                # Extract emotion data
                if isinstance(result, list):
                    emotion_data = result[0]['emotion']
                else:
                    emotion_data = result['emotion']
                
                # Find dominant emotion
                dominant_emotion = max(emotion_data.items(), key=lambda x: x[1])
                
                return {
                    "emotions": emotion_data,
                    "dominant_emotion": dominant_emotion[0],
                    "confidence": dominant_emotion[1] / 100.0,
                    "timestamp": timestamp,
                    "face_detected": True,
                    "method": "deepface"
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                    
        except Exception as e:
            logger.error(f"DeepFace analysis error: {e}")
            return await self._analyze_with_fallback(image, timestamp)

    async def _analyze_with_fallback(self, image: np.ndarray, timestamp: float) -> Dict[str, Any]:
        """Fallback emotion analysis using basic face detection"""
        try:
            # Convert to grayscale for face detection
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(gray, 1.1, 4)
            
            if len(faces) == 0:
                return {
                    "emotions": {emotion: 0 for emotion in self.emotions},
                    "dominant_emotion": "neutral",
                    "confidence": 0.5,
                    "timestamp": timestamp,
                    "face_detected": False,
                    "method": "fallback"
                }
            
            # Simple heuristic-based emotion detection
            # This is a very basic implementation - in production you'd use a trained model
            emotions = self._simple_emotion_heuristics(image, faces[0])
            
            dominant_emotion = max(emotions.items(), key=lambda x: x[1])
            
            return {
                "emotions": emotions,
                "dominant_emotion": dominant_emotion[0],
                "confidence": dominant_emotion[1] / 100.0,
                "timestamp": timestamp,
                "face_detected": True,
                "method": "fallback"
            }
            
        except Exception as e:
            logger.error(f"Fallback emotion analysis error: {e}")
            return self._get_fallback_emotion_result(timestamp)

    def _simple_emotion_heuristics(self, image: np.ndarray, face_rect) -> Dict[str, float]:
        """Simple heuristic-based emotion detection"""
        try:
            x, y, w, h = face_rect
            face_roi = image[y:y+h, x:x+w]
            
            # Convert to grayscale
            gray_face = cv2.cvtColor(face_roi, cv2.COLOR_BGR2GRAY)
            
            # Calculate basic features
            brightness = np.mean(gray_face)
            contrast = np.std(gray_face)
            
            # Simple heuristics (this is very basic and not accurate)
            emotions = {
                "neutral": 40.0,
                "happy": 20.0 + (brightness - 100) * 0.1,
                "sad": 15.0 + (150 - brightness) * 0.1,
                "angry": 10.0 + contrast * 0.1,
                "surprise": 8.0,
                "fear": 5.0,
                "disgust": 2.0
            }
            
            # Normalize to ensure they sum to 100
            total = sum(emotions.values())
            if total > 0:
                emotions = {k: (v / total) * 100 for k, v in emotions.items()}
            
            return emotions
            
        except Exception as e:
            logger.error(f"Simple emotion heuristics error: {e}")
            return {emotion: 100/len(self.emotions) for emotion in self.emotions}

    def _calculate_emotion_statistics(self, emotions_timeline: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate overall emotion statistics from timeline"""
        try:
            if not emotions_timeline:
                return self._get_default_emotion_stats()
            
            # Aggregate emotions across all frames
            emotion_totals = {emotion: 0 for emotion in self.emotions}
            dominant_emotions = []
            total_confidence = 0
            
            for frame_data in emotions_timeline:
                if "emotions" in frame_data:
                    for emotion, value in frame_data["emotions"].items():
                        if emotion in emotion_totals:
                            emotion_totals[emotion] += value
                
                if "dominant_emotion" in frame_data:
                    dominant_emotions.append(frame_data["dominant_emotion"])
                
                if "confidence" in frame_data:
                    total_confidence += frame_data["confidence"]
            
            # Calculate averages
            num_frames = len(emotions_timeline)
            avg_emotions = {
                emotion: total / num_frames 
                for emotion, total in emotion_totals.items()
            }
            
            # Find most common dominant emotion
            if dominant_emotions:
                most_common_emotion = max(set(dominant_emotions), key=dominant_emotions.count)
            else:
                most_common_emotion = "neutral"
            
            avg_confidence = total_confidence / num_frames if num_frames > 0 else 0.5
            
            return {
                "average_emotions": avg_emotions,
                "dominant_emotion_overall": most_common_emotion,
                "average_confidence": avg_confidence,
                "emotion_stability": self._calculate_emotion_stability(emotions_timeline),
                "frames_with_faces": sum(1 for frame in emotions_timeline if frame.get("face_detected", False))
            }
            
        except Exception as e:
            logger.error(f"Emotion statistics calculation error: {e}")
            return self._get_default_emotion_stats()

    def _calculate_emotion_stability(self, emotions_timeline: List[Dict[str, Any]]) -> float:
        """Calculate how stable emotions are throughout the video"""
        try:
            if len(emotions_timeline) < 2:
                return 1.0
            
            # Calculate variance in dominant emotions
            dominant_emotions = [frame.get("dominant_emotion", "neutral") for frame in emotions_timeline]
            
            # Simple stability measure: percentage of frames with the same dominant emotion
            most_common = max(set(dominant_emotions), key=dominant_emotions.count)
            stability = dominant_emotions.count(most_common) / len(dominant_emotions)
            
            return stability
            
        except Exception as e:
            logger.error(f"Emotion stability calculation error: {e}")
            return 0.5

    def _get_fallback_emotion_result(self, timestamp: float) -> Dict[str, Any]:
        """Get fallback emotion result when analysis fails"""
        return {
            "emotions": {
                "neutral": 60.0,
                "happy": 15.0,
                "sad": 10.0,
                "angry": 5.0,
                "surprise": 5.0,
                "fear": 3.0,
                "disgust": 2.0
            },
            "dominant_emotion": "neutral",
            "confidence": 0.6,
            "timestamp": timestamp,
            "face_detected": True,
            "method": "fallback"
        }

    def _get_default_emotion_stats(self) -> Dict[str, Any]:
        """Get default emotion statistics"""
        return {
            "average_emotions": {emotion: 100/len(self.emotions) for emotion in self.emotions},
            "dominant_emotion_overall": "neutral",
            "average_confidence": 0.6,
            "emotion_stability": 0.8,
            "frames_with_faces": 0
        }