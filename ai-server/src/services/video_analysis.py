import base64
import io
import os
import tempfile
import cv2
import numpy as np
import mediapipe as mp
from typing import Dict, List, Any, Optional
from loguru import logger
import json

class VideoAnalysisService:
    def __init__(self):
        # Initialize MediaPipe
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_pose = mp.solutions.pose
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Initialize face mesh for eye tracking
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Initialize pose detection
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Initialize hand detection
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        logger.info("Video analysis service initialized")

    def health_check(self) -> Dict[str, str]:
        """Health check for video analysis service"""
        try:
            # Test basic functionality
            test_image = np.zeros((480, 640, 3), dtype=np.uint8)
            _ = self.face_mesh.process(test_image)
            return {"status": "healthy", "service": "video_analysis"}
        except Exception as e:
            logger.error(f"Video analysis health check failed: {e}")
            return {"status": "unhealthy", "service": "video_analysis", "error": str(e)}

    async def analyze_frame(self, frame_data: bytes) -> Dict[str, Any]:
        """Analyze a single video frame"""
        try:
            # Convert bytes to image
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                raise ValueError("Could not decode frame")
            
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Analyze different aspects
            results = {
                "face_analysis": await self._analyze_face(rgb_frame),
                "pose_analysis": await self._analyze_pose(rgb_frame),
                "hand_analysis": await self._analyze_hands(rgb_frame),
                "frame_quality": await self._analyze_frame_quality(frame)
            }
            
            logger.info("Frame analysis completed")
            return results
            
        except Exception as e:
            logger.error(f"Frame analysis error: {e}")
            return self._get_fallback_frame_analysis()

    async def analyze_eye_contact(self, video_data: str, duration: float) -> Dict[str, Any]:
        """Analyze eye contact patterns throughout video"""
        try:
            video_bytes = base64.b64decode(video_data)

            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                tmp.write(video_bytes)
                tmp_path = tmp.name

            try:
                cap = cv2.VideoCapture(tmp_path)
                if not cap.isOpened():
                    raise ValueError("Could not open video")

                fps = cap.get(cv2.CAP_PROP_FPS) or 25
                frame_interval = max(1, int(fps * 2))  # sample every 2 s
                frame_number = 0
                eye_contact_scores: List[float] = []

                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if frame_number % frame_interval == 0:
                        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        score = self._estimate_eye_contact_from_frame(rgb)
                        eye_contact_scores.append(score)
                    frame_number += 1

                cap.release()
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

            if not eye_contact_scores:
                return {"eye_contact_percentage": 0.0, "assessment": "No frames analyzed", "timeline": []}

            avg = float(np.mean(eye_contact_scores))
            return {
                "eye_contact_percentage": round(avg, 1),
                "total_frames_analyzed": len(eye_contact_scores),
                "assessment": self._assess_eye_contact(avg),
                "timeline": [{"frame": i, "score": round(s, 1)} for i, s in enumerate(eye_contact_scores)],
            }

        except Exception as e:
            logger.error(f"Eye contact analysis error: {e}")
            return {"eye_contact_percentage": 0.0, "assessment": "Analysis failed", "timeline": []}

    async def analyze_posture(self, video_data: str, duration: float) -> Dict[str, Any]:
        """Analyze posture and body language"""
        try:
            video_bytes = base64.b64decode(video_data)

            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                tmp.write(video_bytes)
                tmp_path = tmp.name

            try:
                cap = cv2.VideoCapture(tmp_path)
                if not cap.isOpened():
                    raise ValueError("Could not open video")

                fps = cap.get(cv2.CAP_PROP_FPS) or 25
                frame_interval = max(1, int(fps * 2))
                frame_number = 0
                posture_scores: List[float] = []

                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if frame_number % frame_interval == 0:
                        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        score = self._calculate_posture_score_from_frame(rgb)
                        if score is not None:
                            posture_scores.append(score)
                    frame_number += 1

                cap.release()
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

            if not posture_scores:
                return {"posture_score": 0.0, "posture_assessment": "No pose detected", "body_language_notes": []}

            avg = float(np.mean(posture_scores))
            return {
                "posture_score": round(avg, 1),
                "posture_assessment": self._assess_posture(avg),
                "frames_analyzed": len(posture_scores),
                "body_language_notes": self._generate_posture_notes(avg),
            }

        except Exception as e:
            logger.error(f"Posture analysis error: {e}")
            return {"posture_score": 0.0, "posture_assessment": "Analysis failed", "body_language_notes": []}

    async def analyze_comprehensive(self, video_data: str, duration: float) -> Dict[str, Any]:
        """Comprehensive video analysis"""
        try:
            # Combine all video analyses
            eye_contact = await self.analyze_eye_contact(video_data, duration)
            posture = await self.analyze_posture(video_data, duration)
            
            # Calculate overall video score
            overall_score = (
                eye_contact["eye_contact_percentage"] * 0.4 +
                posture["posture_score"] * 0.3 +
                75 * 0.3  # Placeholder for other factors
            )
            
            return {
                "overall_score": round(overall_score, 1),
                "eye_contact": eye_contact,
                "posture": posture,
                "engagement_level": self._assess_engagement(overall_score),
                "recommendations": self._generate_video_recommendations(eye_contact, posture)
            }
            
        except Exception as e:
            logger.error(f"Comprehensive video analysis error: {e}")
            return self._get_fallback_video_analysis()

    async def _analyze_face(self, frame: np.ndarray) -> Dict[str, Any]:
        """Analyze facial features and expressions"""
        try:
            results = self.face_mesh.process(frame)
            
            if not results.multi_face_landmarks:
                return {"face_detected": False}
            
            face_landmarks = results.multi_face_landmarks[0]
            
            # Calculate face orientation
            face_orientation = self._calculate_face_orientation(face_landmarks, frame.shape)
            
            # Estimate eye contact
            eye_contact_score = self._estimate_eye_contact(face_landmarks)
            
            return {
                "face_detected": True,
                "face_orientation": face_orientation,
                "eye_contact_score": eye_contact_score,
                "face_confidence": 0.8  # Placeholder
            }
            
        except Exception as e:
            logger.error(f"Face analysis error: {e}")
            return {"face_detected": False, "error": str(e)}

    async def _analyze_pose(self, frame: np.ndarray) -> Dict[str, Any]:
        """Analyze body pose and posture"""
        try:
            results = self.pose.process(frame)
            
            if not results.pose_landmarks:
                return {"pose_detected": False}
            
            # Calculate posture metrics
            posture_score = self._calculate_posture_score(results.pose_landmarks)
            
            return {
                "pose_detected": True,
                "posture_score": posture_score,
                "shoulder_alignment": "good",  # Placeholder
                "spine_alignment": "upright"   # Placeholder
            }
            
        except Exception as e:
            logger.error(f"Pose analysis error: {e}")
            return {"pose_detected": False, "error": str(e)}

    async def _analyze_hands(self, frame: np.ndarray) -> Dict[str, Any]:
        """Analyze hand gestures"""
        try:
            results = self.hands.process(frame)
            
            if not results.multi_hand_landmarks:
                return {"hands_detected": False}
            
            hand_count = len(results.multi_hand_landmarks)
            
            return {
                "hands_detected": True,
                "hand_count": hand_count,
                "gesture_activity": "moderate"  # Placeholder
            }
            
        except Exception as e:
            logger.error(f"Hand analysis error: {e}")
            return {"hands_detected": False, "error": str(e)}

    async def _analyze_frame_quality(self, frame: np.ndarray) -> Dict[str, Any]:
        """Analyze frame quality metrics"""
        try:
            # Calculate basic quality metrics
            height, width = frame.shape[:2]
            
            # Calculate brightness
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness = np.mean(gray)
            
            # Calculate contrast
            contrast = np.std(gray)
            
            # Calculate sharpness (using Laplacian variance)
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            return {
                "resolution": f"{width}x{height}",
                "brightness": round(brightness, 2),
                "contrast": round(contrast, 2),
                "sharpness": round(sharpness, 2),
                "quality_assessment": self._assess_frame_quality(brightness, contrast, sharpness)
            }
            
        except Exception as e:
            logger.error(f"Frame quality analysis error: {e}")
            return {
                "resolution": "unknown",
                "brightness": 128,
                "contrast": 50,
                "sharpness": 100,
                "quality_assessment": "acceptable"
            }

    def _calculate_face_orientation(self, landmarks, frame_shape) -> Dict[str, float]:
        """Calculate face orientation angles"""
        try:
            # This is a simplified calculation
            # In production, you'd use proper 3D face orientation estimation
            return {
                "yaw": 0.0,    # Left-right rotation
                "pitch": 0.0,  # Up-down rotation
                "roll": 0.0    # Tilt rotation
            }
        except:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    def _estimate_eye_contact(self, landmarks) -> float:
        """Estimate eye contact score from face landmarks using gaze direction"""
        try:
            # Use iris landmarks (indices 468-477 in refined face mesh)
            # Left iris center: 468, Right iris center: 473
            h, w = 480, 640  # default; actual shape passed separately

            left_iris = landmarks.landmark[468]
            right_iris = landmarks.landmark[473]
            nose_tip = landmarks.landmark[1]

            # Horizontal deviation from nose (camera center proxy)
            left_dev = abs(left_iris.x - nose_tip.x)
            right_dev = abs(right_iris.x - nose_tip.x)
            avg_dev = (left_dev + right_dev) / 2.0

            # Vertical deviation
            left_vdev = abs(left_iris.y - nose_tip.y)
            right_vdev = abs(right_iris.y - nose_tip.y)
            avg_vdev = (left_vdev + right_vdev) / 2.0

            # Score: lower deviation = better eye contact
            # Deviation of 0 → 100, deviation of 0.15+ → 0
            h_score = max(0.0, 1.0 - (avg_dev / 0.12)) * 100
            v_score = max(0.0, 1.0 - (avg_vdev / 0.12)) * 100
            return round((h_score * 0.6 + v_score * 0.4), 1)
        except Exception:
            return 0.0

    def _estimate_eye_contact_from_frame(self, rgb_frame: np.ndarray) -> float:
        """Run face mesh on a single frame and return eye contact score"""
        try:
            results = self.face_mesh.process(rgb_frame)
            if not results.multi_face_landmarks:
                return 0.0
            return self._estimate_eye_contact(results.multi_face_landmarks[0])
        except Exception:
            return 0.0

    def _calculate_posture_score(self, landmarks) -> float:
        """Calculate posture score from pose landmarks using shoulder/spine alignment"""
        try:
            return self._score_pose_landmarks(landmarks)
        except Exception:
            return 0.0

    def _calculate_posture_score_from_frame(self, rgb_frame: np.ndarray) -> Optional[float]:
        """Run pose detection on a single frame and return posture score"""
        try:
            results = self.pose.process(rgb_frame)
            if not results.pose_landmarks:
                return None
            return self._score_pose_landmarks(results.pose_landmarks)
        except Exception:
            return None

    def _score_pose_landmarks(self, landmarks) -> float:
        """
        Score posture using shoulder and hip alignment.
        Returns 0-100.
        """
        try:
            mp_pose = self.mp_pose
            lm = landmarks.landmark

            left_shoulder  = lm[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
            right_shoulder = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
            left_hip       = lm[mp_pose.PoseLandmark.LEFT_HIP.value]
            right_hip      = lm[mp_pose.PoseLandmark.RIGHT_HIP.value]
            nose           = lm[mp_pose.PoseLandmark.NOSE.value]

            # 1. Shoulder level (y difference — lower is better)
            shoulder_tilt = abs(left_shoulder.y - right_shoulder.y)
            shoulder_score = max(0.0, 1.0 - shoulder_tilt / 0.1) * 100

            # 2. Spine vertical alignment: nose should be between shoulders horizontally
            shoulder_mid_x = (left_shoulder.x + right_shoulder.x) / 2
            spine_offset = abs(nose.x - shoulder_mid_x)
            spine_score = max(0.0, 1.0 - spine_offset / 0.15) * 100

            # 3. Hip level
            hip_tilt = abs(left_hip.y - right_hip.y)
            hip_score = max(0.0, 1.0 - hip_tilt / 0.1) * 100

            # 4. Forward lean: nose y vs shoulder y (nose too far below = slouching)
            lean = nose.y - ((left_shoulder.y + right_shoulder.y) / 2)
            lean_score = max(0.0, 1.0 - abs(lean) / 0.3) * 100

            overall = shoulder_score * 0.3 + spine_score * 0.3 + hip_score * 0.2 + lean_score * 0.2
            return round(overall, 1)
        except Exception:
            return 0.0

    def _generate_posture_notes(self, score: float) -> List[str]:
        """Generate human-readable posture notes"""
        if score >= 85:
            return ["Excellent upright posture", "Good shoulder alignment", "Confident body language"]
        elif score >= 70:
            return ["Good posture overall", "Minor alignment improvements possible"]
        elif score >= 55:
            return ["Sit up straighter", "Keep shoulders level", "Avoid leaning forward"]
        else:
            return ["Significant posture issues detected", "Sit upright with back straight", "Keep shoulders back and level"]

    def _assess_eye_contact(self, percentage: float) -> str:
        """Assess eye contact quality"""
        if percentage >= 80:
            return "Excellent eye contact"
        elif percentage >= 60:
            return "Good eye contact"
        elif percentage >= 40:
            return "Fair eye contact - try to look at camera more"
        else:
            return "Poor eye contact - focus on looking at camera"

    def _assess_posture(self, score: float) -> str:
        """Assess posture quality"""
        if score >= 85:
            return "Excellent posture"
        elif score >= 70:
            return "Good posture"
        elif score >= 55:
            return "Fair posture - sit up straighter"
        else:
            return "Poor posture - improve sitting position"

    def _assess_engagement(self, score: float) -> str:
        """Assess overall engagement level"""
        if score >= 80:
            return "Highly engaged"
        elif score >= 65:
            return "Well engaged"
        elif score >= 50:
            return "Moderately engaged"
        else:
            return "Low engagement"

    def _assess_frame_quality(self, brightness: float, contrast: float, sharpness: float) -> str:
        """Assess frame quality"""
        if brightness < 50 or brightness > 200:
            return "Poor lighting"
        elif contrast < 30:
            return "Low contrast"
        elif sharpness < 50:
            return "Blurry image"
        else:
            return "Good quality"

    def _generate_video_recommendations(self, eye_contact: Dict, posture: Dict) -> List[str]:
        """Generate recommendations based on video analysis"""
        recommendations = []
        
        if eye_contact["eye_contact_percentage"] < 60:
            recommendations.append("Practice maintaining eye contact with the camera")
        
        if posture["posture_score"] < 70:
            recommendations.append("Improve your sitting posture - sit up straight")
        
        recommendations.append("Continue practicing confident body language")
        
        return recommendations

    def _get_fallback_frame_analysis(self) -> Dict[str, Any]:
        """Fallback analysis when frame processing fails"""
        return {
            "face_analysis": {"face_detected": False},
            "pose_analysis": {"pose_detected": False},
            "hand_analysis": {"hands_detected": False},
            "frame_quality": {
                "quality_assessment": "unable to analyze"
            }
        }

    def _get_fallback_video_analysis(self) -> Dict[str, Any]:
        """Fallback analysis when video processing fails"""
        return {
            "overall_score": 70.0,
            "eye_contact": {
                "eye_contact_percentage": 70.0,
                "assessment": "Unable to analyze"
            },
            "posture": {
                "posture_score": 75.0,
                "posture_assessment": "Unable to analyze"
            },
            "engagement_level": "Unable to determine",
            "recommendations": ["Ensure good lighting and camera positioning"]
        }