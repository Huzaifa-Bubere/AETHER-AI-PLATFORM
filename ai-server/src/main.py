from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uvicorn
import os
from dotenv import load_dotenv
from loguru import logger

# Import services
from services.gemini_service import GeminiService
from services.audio_analysis import AudioAnalysisService
from services.video_analysis import VideoAnalysisService
from services.speech_recognition import SpeechRecognitionService
from services.emotion_detection import EmotionDetectionService
from services.resume_parser import ResumeParserService

# Import models
from models.analysis_models import (
    AudioAnalysisRequest,
    VideoAnalysisRequest,
    SpeechAnalysisRequest,
    EmotionAnalysisRequest,
    ResumeAnalysisRequest,
    InterviewAnalysisRequest
)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Smart Interview AI - ML Server",
    description="AI/ML processing server for Smart Interview AI platform",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",  # Frontend
        "http://localhost:5001",  # Backend
        os.getenv("FRONTEND_URL", "http://localhost:5174"),
        os.getenv("BACKEND_URL", "http://localhost:5001")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Initialize services
gemini_service = GeminiService()
audio_service = AudioAnalysisService()
video_service = VideoAnalysisService()
speech_service = SpeechRecognitionService()
emotion_service = EmotionDetectionService()
resume_service = ResumeParserService()

# Dependency for authentication
async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify the API token"""
    expected_token = os.getenv("PYTHON_AI_SERVER_API_KEY")
    if not expected_token or credentials.credentials != expected_token:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    return credentials.credentials

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Smart Interview AI - ML Server",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "services": {
            "gemini": await gemini_service.health_check(),
            "audio": audio_service.health_check(),
            "video": video_service.health_check(),
            "speech": speech_service.health_check(),
            "emotion": emotion_service.health_check(),
            "resume": resume_service.health_check()
        }
    }

# Audio Analysis Endpoints
@app.post("/api/audio/analyze")
async def analyze_audio(
    request: AudioAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Analyze audio for speech patterns, pace, and quality"""
    try:
        result = await audio_service.analyze_audio(
            audio_data=request.audio_data,
            sample_rate=request.sample_rate,
            duration=request.duration
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Audio analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/audio/speech-to-text")
async def speech_to_text(
    audio_file: UploadFile = File(...),
    token: str = Depends(verify_token)
):
    """Convert speech to text using Whisper"""
    try:
        audio_data = await audio_file.read()
        result = await speech_service.transcribe_audio(audio_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Speech-to-text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/audio/filler-words")
async def detect_filler_words(
    request: SpeechAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Detect filler words in speech"""
    try:
        result = await audio_service.detect_filler_words(
            transcript=request.transcript,
            audio_timestamps=request.timestamps
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Filler words detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Video Analysis Endpoints
@app.post("/api/video/analyze-frame")
async def analyze_video_frame(
    video_file: UploadFile = File(...),
    token: str = Depends(verify_token)
):
    """Analyze a single video frame for facial features and emotions"""
    try:
        frame_data = await video_file.read()
        result = await video_service.analyze_frame(frame_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Video frame analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/video/eye-contact")
async def analyze_eye_contact(
    request: VideoAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Analyze eye contact patterns in video"""
    try:
        result = await video_service.analyze_eye_contact(
            video_data=request.video_data,
            duration=request.duration
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Eye contact analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/video/posture")
async def analyze_posture(
    request: VideoAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Analyze posture and body language"""
    try:
        result = await video_service.analyze_posture(
            video_data=request.video_data,
            duration=request.duration
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Posture analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Emotion Detection Endpoints
@app.post("/api/emotion/analyze")
async def analyze_emotions(
    request: EmotionAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Analyze emotions from facial expressions"""
    try:
        result = await emotion_service.analyze_emotions(
            image_data=request.image_data,
            timestamp=request.timestamp
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Emotion analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/emotion/batch-analyze")
async def batch_analyze_emotions(
    video_file: UploadFile = File(...),
    token: str = Depends(verify_token)
):
    """Analyze emotions throughout an entire video"""
    try:
        video_data = await video_file.read()
        result = await emotion_service.batch_analyze_video(video_data)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Batch emotion analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Resume Processing Endpoints
@app.post("/api/resume/parse")
async def parse_resume(
    resume_file: UploadFile = File(...),
    token: str = Depends(verify_token)
):
    """Parse resume and extract structured information"""
    try:
        file_data = await resume_file.read()
        result = await resume_service.parse_resume(
            file_data=file_data,
            filename=resume_file.filename
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Resume parsing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/resume/analyze")
async def analyze_resume(
    request: ResumeAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Analyze resume content using AI"""
    try:
        result = await gemini_service.analyze_resume(
            resume_text=request.resume_text,
            target_role=request.target_role
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Resume analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# AI Question Generation Endpoints
@app.post("/api/ai/generate-questions")
async def generate_questions(
    request: dict,
    token: str = Depends(verify_token)
):
    """Generate interview questions using Gemini AI"""
    try:
        result = await gemini_service.generate_interview_questions(request)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Question generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/analyze-response")
async def analyze_response(
    request: dict,
    token: str = Depends(verify_token)
):
    """Analyze interview response using Gemini AI"""
    try:
        result = await gemini_service.analyze_response(request)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Response analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/generate-feedback")
async def generate_feedback(
    request: dict,
    token: str = Depends(verify_token)
):
    """Generate comprehensive feedback using Gemini AI"""
    try:
        result = await gemini_service.generate_feedback(request)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Feedback generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Comprehensive Analysis Endpoint
@app.post("/api/analysis/comprehensive")
async def comprehensive_analysis(
    request: InterviewAnalysisRequest,
    token: str = Depends(verify_token)
):
    """Perform comprehensive analysis of interview data"""
    try:
        # Combine all analysis services
        results = {}
        
        # Audio analysis
        if request.audio_data:
            results["audio"] = await audio_service.analyze_audio(
                audio_data=request.audio_data,
                sample_rate=request.sample_rate or 44100,
                duration=request.duration
            )
        
        # Video analysis
        if request.video_data:
            results["video"] = await video_service.analyze_comprehensive(
                video_data=request.video_data,
                duration=request.duration
            )
        
        # Emotion analysis
        if request.video_data:
            results["emotions"] = await emotion_service.batch_analyze_video(
                request.video_data
            )
        
        # AI-powered content analysis
        if request.responses:
            results["content"] = await gemini_service.analyze_interview_content(
                responses=request.responses,
                questions=request.questions,
                role=request.role
            )
        
        # Generate overall score and feedback
        results["overall"] = await gemini_service.generate_comprehensive_feedback({
            "analysis_results": results,
            "interview_data": request.dict(),
            "user_profile": request.user_profile
        })
        
        return {"success": True, "data": results}
    except Exception as e:
        logger.error(f"Comprehensive analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=os.getenv("ENVIRONMENT") == "development"
    )