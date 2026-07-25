from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class AudioAnalysisRequest(BaseModel):
    audio_data: str = Field(..., description="Base64 encoded audio data")
    sample_rate: int = Field(default=44100, description="Audio sample rate")
    duration: float = Field(..., description="Audio duration in seconds")

class VideoAnalysisRequest(BaseModel):
    video_data: str = Field(..., description="Base64 encoded video data")
    duration: float = Field(..., description="Video duration in seconds")

class SpeechAnalysisRequest(BaseModel):
    transcript: str = Field(..., description="Speech transcript")
    timestamps: List[float] = Field(default=[], description="Word timestamps")

class EmotionAnalysisRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded image data")
    timestamp: float = Field(..., description="Timestamp of the frame")

class ResumeAnalysisRequest(BaseModel):
    resume_text: str = Field(..., description="Extracted resume text")
    target_role: Optional[str] = Field(None, description="Target job role")

class InterviewAnalysisRequest(BaseModel):
    interview_id: str = Field(..., description="Interview ID")
    user_profile: Dict[str, Any] = Field(..., description="User profile data")
    questions: List[Dict[str, Any]] = Field(..., description="Interview questions")
    responses: List[Dict[str, Any]] = Field(..., description="User responses")
    audio_data: Optional[str] = Field(None, description="Audio data")
    video_data: Optional[str] = Field(None, description="Video data")
    sample_rate: Optional[int] = Field(44100, description="Audio sample rate")
    duration: float = Field(..., description="Interview duration")
    role: str = Field(..., description="Target role")

class AudioAnalysisResponse(BaseModel):
    speech_rate: float = Field(..., description="Words per minute")
    pause_analysis: List[Dict[str, Any]] = Field(..., description="Pause patterns")
    filler_words: List[Dict[str, Any]] = Field(..., description="Filler word detection")
    tone_analysis: List[Dict[str, Any]] = Field(..., description="Tone analysis")
    clarity_score: float = Field(..., description="Speech clarity score")
    volume_analysis: Dict[str, Any] = Field(..., description="Volume analysis")

class VideoAnalysisResponse(BaseModel):
    eye_contact_percentage: float = Field(..., description="Eye contact percentage")
    emotion_analysis: List[Dict[str, Any]] = Field(..., description="Emotion detection")
    posture_score: float = Field(..., description="Posture assessment")
    gesture_analysis: List[Dict[str, Any]] = Field(..., description="Gesture analysis")
    confidence_level: float = Field(..., description="Confidence assessment")

class EmotionAnalysisResponse(BaseModel):
    emotions: Dict[str, float] = Field(..., description="Emotion scores")
    dominant_emotion: str = Field(..., description="Primary emotion")
    confidence: float = Field(..., description="Detection confidence")
    timestamp: float = Field(..., description="Frame timestamp")

class ResumeAnalysisResponse(BaseModel):
    skills: List[str] = Field(..., description="Extracted skills")
    experience: float = Field(..., description="Years of experience")
    education: List[Dict[str, Any]] = Field(..., description="Education details")
    certifications: List[str] = Field(..., description="Certifications")
    summary: str = Field(..., description="Professional summary")
    match_score: Optional[float] = Field(None, description="Role match score")
    recommendations: List[str] = Field(..., description="Improvement recommendations")

class ComprehensiveAnalysisResponse(BaseModel):
    overall_score: float = Field(..., description="Overall interview score")
    audio_analysis: Optional[AudioAnalysisResponse] = None
    video_analysis: Optional[VideoAnalysisResponse] = None
    content_analysis: Dict[str, Any] = Field(..., description="Content analysis")
    feedback: Dict[str, Any] = Field(..., description="Generated feedback")
    recommendations: List[str] = Field(..., description="Improvement recommendations")
    timestamp: datetime = Field(default_factory=datetime.now)

class HealthCheckResponse(BaseModel):
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(default_factory=datetime.now)
    version: str = Field(default="1.0.0", description="Service version")
    dependencies: Dict[str, str] = Field(..., description="Dependency status")