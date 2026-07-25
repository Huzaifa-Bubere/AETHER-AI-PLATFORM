import os
import json
import asyncio
from typing import Dict, List, Any, Optional
import google.generativeai as genai
from loguru import logger

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
        logger.info("Gemini service initialized successfully")

    async def health_check(self) -> Dict[str, str]:
        """Check if Gemini service is healthy"""
        try:
            # Simple test generation
            response = await self.model.generate_content_async("Test")
            return {"status": "healthy", "service": "gemini"}
        except Exception as e:
            logger.error(f"Gemini health check failed: {e}")
            return {"status": "unhealthy", "service": "gemini", "error": str(e)}

    async def generate_interview_questions(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate interview questions based on parameters"""
        try:
            prompt = self._build_question_prompt(params)
            
            response = await self.model.generate_content_async(prompt)
            
            # Parse JSON response
            questions_text = response.text.strip()
            if questions_text.startswith('```json'):
                questions_text = questions_text[7:-3]
            elif questions_text.startswith('```'):
                questions_text = questions_text[3:-3]
            
            questions = json.loads(questions_text)
            
            logger.info(f"Generated {len(questions)} questions for {params.get('role', 'unknown')} role")
            return questions
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            # Return fallback questions
            return self._get_fallback_questions(params)

    async def analyze_response(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze interview response"""
        try:
            prompt = self._build_analysis_prompt(params)
            
            response = await self.model.generate_content_async(prompt)
            
            # Parse JSON response
            analysis_text = response.text.strip()
            if analysis_text.startswith('```json'):
                analysis_text = analysis_text[7:-3]
            elif analysis_text.startswith('```'):
                analysis_text = analysis_text[3:-3]
            
            analysis = json.loads(analysis_text)
            
            logger.info(f"Analyzed response for question: {params.get('question', '')[:50]}...")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing response: {e}")
            return self._get_fallback_analysis()

    async def generate_feedback(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive feedback"""
        try:
            prompt = self._build_feedback_prompt(params)
            
            response = await self.model.generate_content_async(prompt)
            
            # Parse JSON response
            feedback_text = response.text.strip()
            if feedback_text.startswith('```json'):
                feedback_text = feedback_text[7:-3]
            elif feedback_text.startswith('```'):
                feedback_text = feedback_text[3:-3]
            
            feedback = json.loads(feedback_text)
            
            logger.info("Generated comprehensive feedback")
            return feedback
            
        except Exception as e:
            logger.error(f"Error generating feedback: {e}")
            return self._get_fallback_feedback()

    async def analyze_resume(self, resume_text: str, target_role: Optional[str] = None) -> Dict[str, Any]:
        """Analyze resume content"""
        try:
            prompt = self._build_resume_prompt(resume_text, target_role)
            
            response = await self.model.generate_content_async(prompt)
            
            # Parse JSON response
            analysis_text = response.text.strip()
            if analysis_text.startswith('```json'):
                analysis_text = analysis_text[7:-3]
            elif analysis_text.startswith('```'):
                analysis_text = analysis_text[3:-3]
            
            analysis = json.loads(analysis_text)
            
            logger.info("Analyzed resume content")
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing resume: {e}")
            return self._get_fallback_resume_analysis()

    def _build_question_prompt(self, params: Dict[str, Any]) -> str:
        """Build prompt for question generation"""
        return f"""
Generate {params.get('count', 5)} interview questions for a {params.get('role', 'Software Engineer')} position.

Parameters:
- Role: {params.get('role', 'Software Engineer')}
- Experience Level: {params.get('experienceLevel', 'mid')}
- Interview Type: {params.get('interviewType', 'behavioral')}
- Difficulty: {params.get('difficulty', 'medium')}

Requirements:
1. Questions should be appropriate for the experience level
2. Include a mix of behavioral, technical, and situational questions
3. Each question should have an expected duration (in minutes)
4. Include follow-up questions where appropriate

Return ONLY a JSON array with this exact structure:
[
  {{
    "id": "unique_id",
    "text": "question text",
    "type": "behavioral|technical|coding",
    "difficulty": "easy|medium|hard",
    "expectedDuration": 5,
    "category": "category_name",
    "followUpQuestions": ["follow up 1", "follow up 2"]
  }}
]
"""

    def _build_analysis_prompt(self, params: Dict[str, Any]) -> str:
        """Build prompt for response analysis"""
        return f"""
Analyze this interview response:

Question: "{params.get('question', '')}"
Answer: "{params.get('answer', '')}"
Role: {params.get('role', 'Software Engineer')}

Analyze on these dimensions (0-100 scale):
1. Relevance to the question
2. Technical accuracy
3. Communication clarity
4. Structure and organization
5. Depth of knowledge
6. Use of examples

Return ONLY a JSON object with this exact structure:
{{
  "scores": {{
    "relevance": 85,
    "technicalAccuracy": 90,
    "clarity": 80,
    "structure": 75,
    "depth": 85,
    "examples": 70
  }},
  "overallScore": 81,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "keywordMatches": ["keyword 1", "keyword 2"],
  "feedback": "detailed feedback text"
}}
"""

    def _build_feedback_prompt(self, params: Dict[str, Any]) -> str:
        """Build prompt for feedback generation"""
        return f"""
Generate comprehensive interview feedback based on:

Interview Data: {json.dumps(params.get('interview_data', {}), indent=2)}
Analysis Results: {json.dumps(params.get('analysis_results', {}), indent=2)}

Generate detailed feedback including:
1. Overall performance rating (0-100)
2. Key strengths (3-5 points)
3. Areas for improvement (3-5 points)
4. Specific recommendations (3-5 actionable items)
5. Next steps for improvement

Return ONLY a JSON object with this exact structure:
{{
  "overallRating": 85,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "nextSteps": ["step 1", "step 2", "step 3"],
  "detailedFeedback": "comprehensive narrative feedback"
}}
"""

    def _build_resume_prompt(self, resume_text: str, target_role: Optional[str]) -> str:
        """Build prompt for resume analysis"""
        role_text = f"Target Role: {target_role}" if target_role else ""
        
        return f"""
Analyze this resume content:

{resume_text}

{role_text}

Extract and analyze:
1. Skills (technical and soft skills)
2. Experience level (years)
3. Education background
4. Certifications
5. Key achievements
6. Professional summary

Return ONLY a JSON object with this exact structure:
{{
  "skills": ["skill1", "skill2", "skill3"],
  "experience": 5,
  "education": [
    {{
      "degree": "Bachelor's in Computer Science",
      "institution": "University Name",
      "year": 2020
    }}
  ],
  "certifications": ["cert1", "cert2"],
  "achievements": ["achievement1", "achievement2"],
  "summary": "professional summary",
  "matchScore": 85,
  "recommendations": ["recommendation1", "recommendation2"]
}}
"""

    def _get_fallback_questions(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Fallback questions if AI generation fails"""
        return [
            {
                "id": "fallback_1",
                "text": "Tell me about yourself and your background.",
                "type": "behavioral",
                "difficulty": "easy",
                "expectedDuration": 3,
                "category": "introduction",
                "followUpQuestions": ["What interests you most about this role?"]
            },
            {
                "id": "fallback_2",
                "text": "Describe a challenging project you worked on.",
                "type": "behavioral",
                "difficulty": "medium",
                "expectedDuration": 5,
                "category": "experience",
                "followUpQuestions": ["How did you overcome the challenges?", "What would you do differently?"]
            }
        ]

    def _get_fallback_analysis(self) -> Dict[str, Any]:
        """Fallback analysis if AI analysis fails"""
        return {
            "scores": {
                "relevance": 75,
                "technicalAccuracy": 70,
                "clarity": 80,
                "structure": 75,
                "depth": 70,
                "examples": 65
            },
            "overallScore": 72,
            "strengths": ["Clear communication", "Good structure"],
            "improvements": ["Add more specific examples", "Provide more technical details"],
            "keywordMatches": [],
            "feedback": "Good response with room for improvement in technical depth and specific examples."
        }

    def _get_fallback_feedback(self) -> Dict[str, Any]:
        """Fallback feedback if AI generation fails"""
        return {
            "overallRating": 75,
            "strengths": [
                "Clear communication skills",
                "Good understanding of basic concepts",
                "Professional demeanor"
            ],
            "improvements": [
                "Provide more specific examples",
                "Elaborate on technical details",
                "Practice storytelling techniques"
            ],
            "recommendations": [
                "Practice behavioral questions using STAR method",
                "Prepare specific examples from past experience",
                "Work on technical communication skills"
            ],
            "nextSteps": [
                "Schedule follow-up practice sessions",
                "Review technical concepts",
                "Prepare portfolio of projects"
            ],
            "detailedFeedback": "Overall solid performance with opportunities for improvement in providing specific examples and technical depth."
        }

    def _get_fallback_resume_analysis(self) -> Dict[str, Any]:
        """Fallback resume analysis if AI analysis fails"""
        return {
            "skills": ["Communication", "Problem Solving", "Teamwork"],
            "experience": 2,
            "education": [],
            "certifications": [],
            "achievements": [],
            "summary": "Professional with relevant experience",
            "matchScore": 70,
            "recommendations": ["Add more specific skills", "Include quantifiable achievements"]
        }