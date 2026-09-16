import {
  ICandidateContext,
  IQuestionIntent,
  InterviewStage,
  DifficultyLevel,
  IInteraction,
  IAnswerEvaluation,
} from './types';

export const InterviewPrompts = {
  extractContextPrompt(input: {
    resumeText?: string;
    parsedResume?: any;
    role: string;
    experienceLevel: string;
  }): string {
    return `You are an expert technical recruiter analyzing candidate data for a mock interview.
Role: ${input.role}
Experience Level: ${input.experienceLevel}
Resume Data:
${input.resumeText ? input.resumeText.slice(0, 4000) : JSON.stringify(input.parsedResume || {})}

Extract key candidate context for the interview. Return ONLY a valid JSON object matching this schema:
{
  "skills": ["string"],
  "experienceYears": number,
  "education": ["string"],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"]
    }
  ],
  "targetRoleRelevance": "string",
  "recommendedTopics": ["string"]
}`;
  },

  generateQuestionPrompt(params: {
    candidateContext: ICandidateContext;
    stage: InterviewStage;
    topic: string;
    difficulty: DifficultyLevel;
    previousInteractions: IInteraction[];
    followUpContext?: {
      previousQuestion: string;
      previousAnswer: string;
      missingConcepts: string[];
    };
  }): string {
    const { candidateContext, stage, topic, difficulty, previousInteractions, followUpContext } = params;

    const recentQuestions = previousInteractions.map((item, idx) => `Q${idx + 1}: ${item.question}`).join('\n');
    const resumeInfo = candidateContext.resumeContext
      ? `Skills: ${(candidateContext.resumeContext.skills || []).slice(0, 10).join(', ')}
Projects: ${(candidateContext.resumeContext.projects || []).map(p => `${p.name || 'Project'}: ${(p.technologies || []).join(', ')}`).join('; ')}`
      : 'None provided';

    const isFollowUp = !!followUpContext;

    return `You are a Principal Software Engineer and Interviewer conducting a realistic, interactive interview.
Target Role: ${candidateContext.role}
Experience Level: ${candidateContext.experienceLevel}
Company Context: ${candidateContext.company || 'Standard Tech Industry'}
Interview Type: ${candidateContext.interviewType}
Current Stage: ${stage}
Current Topic: ${topic}
Difficulty: ${difficulty}

Candidate Background:
${resumeInfo}

${recentQuestions ? `Previously Asked Questions (DO NOT repeat or paraphrase these):\n${recentQuestions}\n` : ''}

${isFollowUp ? `THIS IS A TARGETED FOLLOW-UP QUESTION.
Previous Question: "${followUpContext.previousQuestion}"
Candidate Answer: "${followUpContext.previousAnswer}"
Concepts they missed or under-explained: ${JSON.stringify(followUpContext.missingConcepts)}
Instruction: Ask a direct, natural follow-up question acknowledging their response and probing specifically into the missing concepts or asking how they would handle the deeper technical challenge.` : `Instruction: Ask exactly ONE concise, realistic interview question appropriate for stage "${stage}", topic "${topic}", and difficulty "${difficulty}". Relate it to the candidate's skills or projects when appropriate.`}

Rules:
1. Ask exactly ONE question. No pleasantries, no "Great answer!", no preamble.
2. It must be answerable verbally in 1 to 3 minutes.
3. Provide 3-6 specific expectedConcepts (technical keywords/ideas that a strong answer must include).
4. Clearly state the intent of why this question is being asked.

Return ONLY a valid JSON object in this exact schema:
{
  "question": "string",
  "intent": "string",
  "topic": "${topic}",
  "difficulty": "${difficulty}",
  "stage": "${stage}",
  "expectedConcepts": ["concept1", "concept2", "concept3"]
}`;
  },

  evaluateAnswerPrompt(params: {
    candidateContext: ICandidateContext;
    question: IQuestionIntent;
    answer: string;
    stage: InterviewStage;
    responseTimeSeconds?: number;
    previousContext?: string;
  }): string {
    const { candidateContext, question, answer, stage, responseTimeSeconds } = params;

    return `You are an expert technical interviewer evaluating a candidate's response.
Role: ${candidateContext.role} (${candidateContext.experienceLevel})
Stage: ${stage}
Topic: ${question.topic} (Difficulty: ${question.difficulty})
Question: "${question.question}"
Question Intent: "${question.intent}"
Expected Key Concepts: ${JSON.stringify(question.expectedConcepts)}

Candidate's Answer (via Speech-to-Text / Text, forgive minor STT noise):
"${answer.slice(0, 4000)}"
Response Time: ${responseTimeSeconds || 0} seconds

Evaluate the answer rigorously and objectively based on facts.
Scoring criteria (0 to 100):
- correctness: Technical accuracy and truthfulness of statements.
- technicalDepth: Explanations of underlying mechanisms, trade-offs, architectures vs superficial buzzwords.
- relevance: Directly answers the question asked without rambling.
- clarity: Clear structure, appropriate terminology, logical sequence.
- communication: Professional tone, concise articulation.
- overallScore: Weighted average (correctness 35%, technicalDepth 30%, relevance 15%, clarity 10%, communication 10%).

Adaptive decision criteria:
- needsFollowUp: true if key expected concepts were completely missed or the answer was overly vague, but topic is not yet exhausted.
- increaseDifficulty: true if candidate showed mastery (depth >= 80, correctness >= 80).
- decreaseDifficulty: true if candidate struggled significantly (correctness < 45).
- moveToNextTopic: true if enough evidence is gathered on this topic.

Return ONLY a valid JSON object matching this schema:
{
  "correctness": number,
  "technicalDepth": number,
  "relevance": number,
  "clarity": number,
  "communication": number,
  "overallScore": number,
  "conceptsCovered": ["string"],
  "conceptsMissing": ["string"],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "needsFollowUp": boolean,
  "moveToNextTopic": boolean,
  "increaseDifficulty": boolean,
  "decreaseDifficulty": boolean,
  "finishInterview": boolean,
  "recommendedNextTopic": "string",
  "currentInterviewStage": "${stage}",
  "suggestedFollowUpTopic": "string",
  "feedbackSummary": "string",
  "suggestedAnswerImprovement": "A concise model answer demonstrating how a senior engineer would answer this concisely."
}`;
  },

  finalAssessmentPrompt(params: {
    candidateContext: ICandidateContext;
    interactions: IInteraction[];
    difficultyProgression: any[];
    integritySummary?: {
      totalWarnings: number;
      events: string[];
    };
  }): string {
    const { candidateContext, interactions, difficultyProgression, integritySummary } = params;

    const transcript = interactions.map((item, idx) => {
      const evalData = item.evaluation;
      return `Question ${idx + 1} [${item.stage} | ${item.topic} | ${item.difficulty}]:
"${item.question}"
Candidate Answer: "${item.answer || '(No answer provided)'}"
Scores: Correctness ${evalData?.correctness ?? 0}%, Depth ${evalData?.technicalDepth ?? 0}%, Communication ${evalData?.communication ?? 0}%
Concepts Covered: ${(evalData?.conceptsCovered || []).join(', ')}
Concepts Missed: ${(evalData?.conceptsMissing || []).join(', ')}`;
    }).join('\n\n');

    return `You are the Lead Technical Interviewer and Placement Mentor. Generate a comprehensive, developmental, and Explainable AI assessment for this candidate.
Role: ${candidateContext.role}
Target Level: ${candidateContext.experienceLevel}
Interview Type: ${candidateContext.interviewType}
Company: ${candidateContext.company || 'Tech Industry Standards'}

Complete Interview Transcript & Evaluations:
${transcript}

Difficulty Progression:
${JSON.stringify(difficultyProgression)}

Integrity Events Summary:
${JSON.stringify(integritySummary || { totalWarnings: 0, events: [] })}

Requirements:
1. Provide realistic, evidence-based scores (0-100) for overall, technical, communication, problem solving, and role readiness.
2. Calculate individual topic scores based on performance across asked questions.
3. Provide Explainable AI justification citing specific examples of what was answered well and what was missed.
4. Highlight concrete skill gaps and a actionable learning/practice roadmap.
5. Provide tailored career recommendations for placement preparation.

Return ONLY a valid JSON object in this exact schema:
{
  "overallScore": number,
  "technicalScore": number,
  "communicationScore": number,
  "problemSolvingScore": number,
  "roleReadinessScore": number,
  "topicScores": [
    {
      "topic": "string",
      "score": number,
      "questionsCount": number
    }
  ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "skillGaps": ["string"],
  "recommendedPractice": ["string"],
  "summary": "string",
  "careerRecommendations": ["string"],
  "explainableEvidence": [
    {
      "dimension": "technical",
      "score": number,
      "justification": ["bullet 1 with evidence", "bullet 2 with evidence"]
    },
    {
      "dimension": "communication",
      "score": number,
      "justification": ["bullet 1 with evidence"]
    },
    {
      "dimension": "problemSolving",
      "score": number,
      "justification": ["bullet 1 with evidence"]
    },
    {
      "dimension": "roleReadiness",
      "score": number,
      "justification": ["bullet 1 with evidence"]
    }
  ]
}`;
  },
};
