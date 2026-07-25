import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../utils/logger";

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.model = this.genAI.getGenerativeModel({ model: modelName });
    console.log("✅ Gemini service initialized with model:", modelName);
  }

  // ── Question generation ───────────────────────────────────────────────────
  async generateInterviewQuestions(params: {
    role: string;
    experienceLevel: string;
    interviewType: string;
    resumeContext?: any;
    domain?: string;
    difficulty: string;
    count: number;
  }): Promise<any[]> {
    console.log("=== GENERATING INTERVIEW QUESTIONS ===");
    try {
      const prompt = this.buildQuestionGenerationPrompt(params);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      let questions;
      try {
        const clean = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        questions = JSON.parse(clean);
      } catch {
        return this.generateFallbackQuestions(params);
      }
      if (!Array.isArray(questions)) {
        questions =
          questions.questions && Array.isArray(questions.questions)
            ? questions.questions
            : this.generateFallbackQuestions(params);
      }
      logger.info(`Generated ${questions.length} questions for ${params.role}`);
      return questions;
    } catch (error: any) {
      logger.error("Error generating interview questions:", error);
      return this.generateFallbackQuestions(params);
    }
  }

  // ── Minimal fallback (only when Gemini is down) ───────────────────────────
  private generateFallbackQuestions(params: {
    role: string;
    interviewType: string;
    difficulty: string;
    count: number;
  }): any[] {
    logger.warn(
      `Gemini unavailable — minimal fallback for ${params.role} (${params.interviewType})`,
    );
    if (params.interviewType === "coding") {
      return [
        {
          id: `fallback_coding_${Date.now()}`,
          text: "Two Sum",
          description:
            "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.",
          type: "coding",
          difficulty: params.difficulty,
          expectedDuration: 15,
          category: "arrays",
          examples: [
            {
              input: "nums = [2,7,11,15], target = 9",
              output: "[0,1]",
              explanation: "nums[0] + nums[1] = 9",
            },
          ],
          constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
          testCases: [
            { input: "[2,7,11,15]\n9", expectedOutput: "[0,1]" },
            { input: "[3,2,4]\n6", expectedOutput: "[1,2]" },
          ],
          followUpQuestions: ["Can you solve it in O(n) time?"],
        },
      ].slice(0, params.count);
    }
    return Array.from({ length: Math.min(params.count, 3) }, (_, i) => ({
      id: `fallback_${Date.now()}_${i}`,
      text:
        i === 0
          ? `Tell me about your experience as a ${params.role}.`
          : i === 1
            ? "Describe a challenging project you worked on."
            : "Where do you see yourself in 3-5 years?",
      type: "behavioral",
      difficulty: params.difficulty,
      expectedDuration: 5,
      category: "general",
      followUpQuestions: [],
    }));
  }

  // ── Response analysis ─────────────────────────────────────────────────────
  async analyzeResponse(params: {
    question: string;
    answer: string;
    role: string;
    expectedKeywords?: string[];
    context?: any;
  }): Promise<any> {
    try {
      const prompt = this.buildResponseAnalysisPrompt(params);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      try {
        const clean = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        return JSON.parse(clean);
      } catch {
        return this.generateFallbackAnalysis(params);
      }
    } catch (error: any) {
      logger.error("Error analyzing response:", error);
      return this.generateFallbackAnalysis(params);
    }
  }

  private generateFallbackAnalysis(params: {
    question: string;
    answer: string;
    role: string;
  }): any {
    const wordCount = params.answer.split(/\s+/).length;
    const hasExamples = /example|instance|case|situation|time when/i.test(
      params.answer,
    );
    const hasTech =
      /\b(code|system|design|implement|develop|build|test|deploy)\b/i.test(
        params.answer,
      );
    const lengthScore = Math.min(100, (params.answer.length / 500) * 100);
    const wScore = Math.min(100, (wordCount / 100) * 100);
    const overall = Math.round(
      (lengthScore + wScore + (hasExamples ? 85 : 60) + (hasTech ? 85 : 70)) /
        4,
    );
    return {
      scores: {
        relevance: Math.min(100, overall + 5),
        technicalAccuracy: hasTech ? 85 : 70,
        clarity: Math.min(100, wScore),
        structure: Math.min(100, lengthScore),
        depth: hasExamples ? 85 : 60,
        examples: hasExamples ? 85 : 60,
      },
      overallScore: overall,
      strengths: [
        hasExamples ? "Provided concrete examples" : "Clear communication",
        hasTech ? "Demonstrated technical knowledge" : "Good articulation",
      ],
      improvements: [
        !hasExamples ? "Include more specific examples" : "Add more context",
        !hasTech
          ? "Include more technical details"
          : "Continue demonstrating expertise",
      ],
      missingElements: [],
      keywordMatches: [],
      feedback: `Response shows ${overall >= 75 ? "strong" : "developing"} understanding.`,
    };
  }

  // ── Feedback generation ───────────────────────────────────────────────────
  async generateFeedback(params: {
    interviewData: any;
    analysisResults: any;
    userProfile: any;
  }): Promise<any> {
    try {
      const prompt = this.buildFeedbackPrompt(params);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      try {
        const clean = text
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        return JSON.parse(clean);
      } catch {
        return this.generateFallbackFeedback(params);
      }
    } catch (error: any) {
      logger.error("Error generating feedback:", error);
      return this.generateFallbackFeedback(params);
    }
  }

  private generateFallbackFeedback(params: {
    interviewData: any;
    analysisResults: any;
    userProfile: any;
  }): any {
    const rate =
      (params.interviewData.questionsAnswered /
        params.interviewData.totalQuestions) *
      100;
    const score = params.analysisResults?.overallScore || 75;
    return {
      overallRating: score,
      strengths: [
        "Completed the interview with good engagement",
        "Demonstrated clear communication skills",
      ],
      improvements: [
        "Practice providing more specific examples",
        "Work on structuring responses using STAR method",
      ],
      recommendations: [
        "Review common interview questions",
        "Practice mock interviews to build confidence",
      ],
      skillAssessment: [],
      nextSteps: [
        "Take more practice interviews",
        "Focus on identified improvement areas",
      ],
      detailedFeedback: `Completed ${rate.toFixed(0)}% of questions. Performance shows ${score >= 80 ? "strong" : score >= 60 ? "good" : "developing"} interview skills.`,
    };
  }

  // ── Follow-up questions ───────────────────────────────────────────────────
  async generateFollowUpQuestions(params: {
    originalQuestion: string;
    userAnswer: string;
    role: string;
    context?: any;
  }): Promise<string[]> {
    try {
      const prompt = this.buildFollowUpPrompt(params);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(clean);
      return parsed.questions || [];
    } catch (error) {
      logger.error("Error generating follow-up questions:", error);
      return [];
    }
  }

  // ── Resume analysis ───────────────────────────────────────────────────────
  async analyzeResume(params: {
    resumeText: string;
    targetRole?: string;
  }): Promise<any> {
    try {
      const prompt = this.buildResumeAnalysisPrompt(params);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(clean);
    } catch (error) {
      logger.error("Error analyzing resume:", error);
      throw new Error("Failed to analyze resume");
    }
  }

  // ── Recommendations ───────────────────────────────────────────────────────
  async generateRecommendations(params: {
    userProfile: any;
    interviewHistory: any[];
    currentPerformance: any;
  }): Promise<any> {
    try {
      const prompt = this.buildRecommendationsPrompt(params);
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(clean);
    } catch (error) {
      logger.error("Error generating recommendations:", error);
      throw new Error("Failed to generate recommendations");
    }
  }

  // ── Transcript analysis ───────────────────────────────────────────────────
  async analyzeInterviewTranscript(params: {
    transcript: string;
    role: string;
  }): Promise<any> {
    try {
      const prompt = `You are an AI interview analysis expert.\nAnalyze this interview transcript for role: ${params.role}\n\nTRANSCRIPT:\n${params.transcript}\n\nReturn ONLY valid JSON:\n{"emotionAnalysis":[{"name":"Confident","value":0}],"fillerWords":[{"word":"um","count":0}],"speakingConfidence":0,"answerQuality":0,"timeline":[]}`;
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();
      const clean = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(clean);
    } catch (error) {
      logger.error("Transcript analysis failed:", error);
      return null;
    }
  }

  // ── Prompts ───────────────────────────────────────────────────────────────
  private buildQuestionGenerationPrompt(params: any): string {
    const resumeSkills =
      params.resumeContext?.skills?.length > 0
        ? params.resumeContext.skills.join(", ")
        : "";
    const resumeProjects =
      params.resumeContext?.projects?.length > 0
        ? params.resumeContext.projects
            .map(
              (p: any) =>
                `${p.name || "Project"}: ${p.description || ""} Technologies: ${(p.technologies || []).join(", ")}`,
            )
            .join("\n")
        : "";
    const domainInstruction = params.domain
      ? `CRITICAL: Generate ONLY questions related to ${params.domain}. Do NOT ask anything outside this domain.`
      : "";
    const resumeInstruction =
      resumeSkills || resumeProjects
        ? `
Candidate Resume Context:

Skills:
${resumeSkills}

Projects:
${resumeProjects}

CRITICAL RULES:
- Generate at least ONE question per project.
- Generate questions based on the technologies used in the projects.
- Generate questions based on the candidate skills.
- Ask implementation-level questions.
- Ask debugging scenarios from the projects.
- Ask architecture questions about the system design of the projects.
`
        : "";

    if (params.interviewType === "coding") {
      return `You are an expert coding interviewer. Generate ${params.count} algorithmic coding problems.
Role: ${params.role}
Difficulty: ${params.difficulty}

STRICT RULES:
- Real LeetCode-style problems only
- Every problem MUST include testCases, examples, and constraints
- testCases must have at least 2 entries with multi-line input format (one value per line)
- For Two Sum: input is "[2,7,11,15]\\n9" (array on line 1, target on line 2)

IMPORTANT — testCase input format:
- Each argument goes on its own line
- Arrays use JSON format: [1,2,3]
- Numbers are plain: 9
- Strings use quotes: "hello"

Return ONLY a valid JSON array (no markdown):
[
  {
    "id": "q1",
    "text": "Problem title",
    "type": "coding",
    "difficulty": "${params.difficulty}",
    "expectedDuration": 15,
    "category": "Arrays",
    "description": "Full problem statement with examples",
    "examples": [{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "nums[0] + nums[1] = 9"}],
    "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
    "testCases": [
      {"input": "[2,7,11,15]\\n9", "expectedOutput": "[0,1]"},
      {"input": "[3,2,4]\\n6", "expectedOutput": "[1,2]"}
    ],
    "followUpQuestions": ["Can you solve it in O(n) time?"]
  }
]`;
    }

    // ================= TECHNICAL =================
    if (params.interviewType === "technical") {
      return `
You are a senior FAANG technical interviewer.

Generate ${params.count} HIGH QUALITY technical interview questions.

Role: ${params.role}
Experience Level: ${params.experienceLevel}
Difficulty: ${params.difficulty}

${domainInstruction}
${resumeInstruction}

STRICT RULES:
- ONLY technical questions
- NO behavioral questions
- NO generic HR questions
- Ask deep implementation questions
- Ask system-level understanding
- Ask real interview questions
- Focus on how things work internally
- Ask scenario-based problems

Examples of good questions:
- Java memory management
- DBMS indexing
- OS process scheduling
- React rendering lifecycle
- Network TCP handshake

Return JSON array format:
[
  {
    "id": "unique_id",
    "text": "question",
    "type": "technical",
    "difficulty": "${params.difficulty}",
    "expectedDuration": 5,
    "category": "topic",
    "followUpQuestions": []
  }
]
`;
    }

    // ================= SYSTEM DESIGN =================
    // ================= SKILL BASED =================
    if (params.interviewType === "skill-based") {
      return `
You are a senior technical interviewer.

Generate ${params.count} DEEP SKILL-BASED interview questions.

Role: ${params.role}
Primary Skill / Domain: ${params.domain || "candidate skills"}
Difficulty: ${params.difficulty}

STRICT RULES:
- ONLY technical questions
- NO behavioral questions
- NO "describe a time" questions
- NO HR questions
- Ask implementation-level questions
- Ask "how it works internally"
- Ask debugging scenarios
- Ask real interview questions

Focus on:
- core concepts
- internal working
- architecture
- optimization
- real coding scenarios

If domain is React ask about:
- hooks
- lifecycle
- reconciliation
- state management
- performance optimization

Return JSON format:
[
  {
    "id": "q1",
    "text": "question",
    "type": "skill-based",
    "difficulty": "${params.difficulty}",
    "expectedDuration": 5,
    "category": "${params.domain || "technical"}",
    "followUpQuestions": []
  }
]
`;
    }
    if (params.interviewType === "system-design") {
      return `
You are a senior system design interviewer.

Generate ${params.count} system design problems.

Focus on:
- scalability
- architecture
- database design
- load balancing
- caching
- distributed systems

Return JSON array only.
`;
    }

    // ================= BEHAVIORAL =================
    return `Generate ${params.count} behavioral interview questions for ${params.role}.\nDifficulty: ${params.difficulty}\n${resumeInstruction}\nReturn JSON array:\n[{"id":"q1","text":"question","type":"behavioral","difficulty":"${params.difficulty}","expectedDuration":5,"category":"behavioral","followUpQuestions":[]}]`;
  }

  private buildResponseAnalysisPrompt(params: any): string {
    return `You are a senior FAANG technical interviewer evaluating a candidate's interview response.

QUESTION: "${params.question}"
CANDIDATE'S ANSWER: "${params.answer || "(no answer provided)"}"
TARGET ROLE: ${params.role}
${params.expectedKeywords ? `Expected Keywords: ${params.expectedKeywords.join(", ")}` : ""}

Score each dimension from 0 to 100 based on the actual answer content above.
- relevance: How well the answer addresses the question
- technicalAccuracy: Correctness of technical content
- clarity: How clearly the answer is communicated
- structure: How well-organized the answer is
- depth: Level of detail and insight
- examples: Use of concrete examples

Also determine:

Strengths:
- What the candidate did well

Improvements:
- What the candidate should improve

Missing Elements:
- Important concepts or explanations that were missing

Keyword Matches:
- Which relevant technical keywords appeared in the answer

OVERALL EVALUATION:
- Provide a clear summary explaining the candidate's performance.

Return ONLY valid JSON (no markdown, no extra text):
{"scores":{"relevance":75,"technicalAccuracy":70,"clarity":80,"structure":75,"depth":65,"examples":60},"overallScore":74,"strengths":["specific strength 1","specific strength 2"],"improvements":["specific improvement 1","specific improvement 2"],"missingElements":[],"keywordMatches":["keyword1","keyword2"],"feedback":"2-3 sentence specific feedback about this answer"}`;
  }

  private buildFeedbackPrompt(params: any): string {
    const { interviewData, analysisResults } = params;

    // Build a readable Q&A section so Gemini has real content to evaluate
    const qaSection = (interviewData.responses || [])
      .map(
        (r: any, i: number) =>
          `Q${i + 1}: ${r.question}\nA${i + 1}: ${r.answer || "(no answer provided)"}`,
      )
      .join("\n\n");

    const metrics = analysisResults?.contentMetrics || {};
    const metricsSection =
      Object.keys(metrics).length > 0
        ? `Content Metrics: relevance=${metrics.relevanceScore || 0}, technical=${metrics.technicalAccuracy || 0}, clarity=${metrics.communicationClarity || 0}, structure=${metrics.structureScore || 0}`
        : "Content Metrics: not yet computed";

    return `You are a senior FAANG interview coach. Generate detailed, personalised feedback for this interview.

INTERVIEW DETAILS:
- Role: ${interviewData.role}
- Type: ${interviewData.type}
- Questions answered: ${interviewData.questionsAnswered}/${interviewData.totalQuestions}
- Duration: ${interviewData.duration || 0} minutes
- ${metricsSection}

CANDIDATE RESPONSES:
${qaSection || "No responses recorded."}

INSTRUCTIONS:
- Base your feedback on the ACTUAL answers above, not generic advice
- Be specific — reference what the candidate said
- overallRating must be a number 0-100 based on answer quality
- strengths: 3-5 specific things the candidate did well
- improvements: 3-5 specific areas to improve with actionable advice
- recommendations: 3-5 concrete next steps
- detailedFeedback: 2-3 paragraphs of personalised coaching

NEXT STEPS
Suggest practical next steps the candidate should take to improve interview readiness.

DETAILED FEEDBACK
Write a professional paragraph summarizing the candidate's interview performance, highlighting strengths and improvement areas.

Return ONLY valid JSON (no markdown, no extra text):
{"overallRating":75,"strengths":["..."],"improvements":["..."],"recommendations":["..."],"skillAssessment":[{"skill":"","currentLevel":0,"targetLevel":0,"feedback":""}],"nextSteps":["..."],"detailedFeedback":"..."}`;
  }

  private buildFollowUpPrompt(params: any): string {
    return `
You are a senior technical interviewer conducting a live interview.

The candidate has answered a question. Your job is to ask deeper follow-up questions to evaluate their understanding.

ORIGINAL QUESTION:
"${params.originalQuestion}"

CANDIDATE ANSWER:
"${params.userAnswer}"

ROLE:
${params.role}

Generate 2–3 intelligent follow-up questions.

The follow-up questions should:
- Dig deeper into the candidate's reasoning
- Ask for clarification if the answer is vague
- Explore edge cases or trade-offs
- Ask how the solution would work at scale
- Test real-world practical knowledge

Follow-up questions should feel like a real interviewer continuing the conversation.

Avoid:
- repeating the same question
- generic HR questions
- simple yes/no questions

IMPORTANT:
Return ONLY valid JSON.
Do NOT include markdown.
Do NOT include explanations.

JSON FORMAT:
{
  "questions": [
    "follow-up question 1",
    "follow-up question 2",
    "follow-up question 3"
  ]
}
`;
  }

  private buildResumeAnalysisPrompt(params: any): string {
    return `
You are an expert technical recruiter and resume analyzer.

Analyze the following resume and extract structured information.

RESUME CONTENT:
"${params.resumeText}"

${params.targetRole ? `TARGET ROLE: ${params.targetRole}` : ""}

Carefully analyze the resume and extract the following information.

1. SKILLS
List all technical and soft skills mentioned.

2. PROGRAMMING LANGUAGES
Identify programming languages (Java, Python, C++, etc.).

3. FRAMEWORKS & LIBRARIES
Examples: React, Spring Boot, Django, TensorFlow, etc.

4. TOOLS & TECHNOLOGIES
Examples: Docker, Kubernetes, Git, AWS, MongoDB, MySQL, etc.

5. PROJECTS
Extract important projects including:
- project name
- short description
- technologies used

6. EXPERIENCE
Estimate total years of experience.

7. EDUCATION
Extract degree, institution, year, and GPA if available.

8. CERTIFICATIONS
List any certifications.

9. KEY ACHIEVEMENTS
Important accomplishments or recognitions.

10. INDUSTRY EXPERIENCE
Industries the candidate has worked in.

11. LEADERSHIP EXPERIENCE
Team leadership or management roles.

12. PROFESSIONAL SUMMARY
Generate a short professional summary of the candidate.

${
  params.targetRole
    ? `
13. MATCH SCORE
Evaluate how well this resume matches the target role (0–100).

14. IMPROVEMENT RECOMMENDATIONS
Suggest improvements to strengthen the resume for the target role.
`
    : ""
}

IMPORTANT RULES:
- Extract only information present in the resume.
- Do not invent details.
- If a field is missing, return an empty array or null.
- Return ONLY valid JSON.
- Do NOT include markdown or explanations.

JSON FORMAT:

{
  "skills": [],
  "programmingLanguages": [],
  "frameworks": [],
  "tools": [],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": []
    }
  ],
  "experience": 0,
  "education": [
    {
      "degree": "",
      "institution": "",
      "year": "",
      "gpa": ""
    }
  ],
  "certifications": [],
  "achievements": [],
  "industries": [],
  "leadership": [],
  "summary": "",
  "matchScore": 0,
  "recommendations": []
}
`;
  }

  private buildRecommendationsPrompt(params: any): string {
    return `
You are a senior career coach, technical interviewer, and software engineering mentor.

Generate personalized improvement recommendations based on the candidate's profile and interview performance.

USER PROFILE:
${JSON.stringify(params.userProfile, null, 2)}

INTERVIEW HISTORY:
${JSON.stringify(params.interviewHistory, null, 2)}

CURRENT PERFORMANCE:
${JSON.stringify(params.currentPerformance, null, 2)}

Analyze the data carefully and identify:

1. Skill gaps in technical knowledge
2. Weaknesses in interview performance
3. Areas where communication can improve
4. Topics that need deeper understanding
5. Career growth opportunities

Generate recommendations in these categories:

1. Technical Skills
2. Interview Preparation
3. Communication Skills
4. System Design / Architecture (if relevant)
5. Industry Knowledge

For each recommendation include:

- category
- clear title
- detailed description
- priority (high | medium | low)
- suggested timeframe
- learning resources (courses, documentation, practice platforms)

Also generate a **structured learning path** that gradually improves the candidate's skills.

IMPORTANT RULES:
- Recommendations must be specific and actionable.
- Avoid generic advice.
- Use insights from the interview performance.
- Focus on realistic improvement steps.
- Return ONLY valid JSON.
- Do NOT include markdown or explanations.

JSON FORMAT:

{
  "recommendations": [
    {
      "category": "",
      "title": "",
      "description": "",
      "priority": "high|medium|low",
      "timeframe": "",
      "resources": []
    }
  ],
  "learningPath": [
    {
      "step": 1,
      "title": "",
      "description": "",
      "duration": ""
    }
  ],
  "practiceAreas": []
}
`;
  }
}

export default new GeminiService();
