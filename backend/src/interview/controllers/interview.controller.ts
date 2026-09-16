import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Interview from '../../models/Interview';
import User from '../../models/User';
import { contextBuilder } from '../services/ContextBuilder';
import { questionAgent } from '../services/QuestionAgent';
import { evaluationAgent } from '../services/EvaluationAgent';
import { adaptiveInterviewEngine } from '../engine/AdaptiveInterviewEngine';
import { finalAssessmentAgent } from '../services/FinalAssessmentAgent';
import logger from '../../utils/logger';
import { DifficultyLevel, DifficultyMode, InterviewStage, InterviewType } from '../types';

export class InterviewController {
  /**
   * POST /api/interview/create
   * Initialize a new adaptive interview session with candidate context.
   */
  async createInterview(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const {
        role,
        experienceLevel = 'Junior',
        interviewType = 'technical',
        difficultyMode = 'adaptive',
        company,
        language = 'English',
        plannedQuestions = 6,
        resumeId,
        jobDescription,
        jobRequirements,
        settings = {},
      } = req.body;

      const targetRole = (role || settings.role || 'Software Engineer').trim();
      const targetExp = experienceLevel || settings.experienceLevel || 'Junior';
      const targetType = (interviewType || req.body.type || 'technical') as InterviewType;
      const targetDiff = (difficultyMode || settings.difficulty || 'adaptive') as DifficultyMode;

      const candidateContext = await contextBuilder.buildContext({
        userId,
        role: targetRole,
        experienceLevel: targetExp,
        interviewType: targetType,
        difficultyMode: targetDiff,
        company,
        language,
        resumeId,
        jobDescription,
        jobRequirements,
      });

      const initialTopics = contextBuilder.getInitialTopics(candidateContext);
      const initialDifficulty: DifficultyLevel = targetDiff === 'adaptive' ? 'medium' : targetDiff;

      const interview = await Interview.create({
        userId: new mongoose.Types.ObjectId(userId),
        resumeId: resumeId ? new mongoose.Types.ObjectId(resumeId) : null,
        type: targetType,
        status: 'scheduled',
        settings: {
          role: targetRole,
          difficulty: targetDiff,
          duration: settings.duration || 30,
          domain: settings.domain || targetRole,
          includeVideo: settings.includeVideo !== false,
          includeAudio: settings.includeAudio !== false,
          includeCoding: targetType === 'coding',
          proctoringEnabled: settings.proctoringEnabled !== false,
        },
        candidateContext,
        currentStage: 'INTRODUCTION',
        currentTopic: initialTopics[0] || 'Technical Background',
        currentDifficulty: initialDifficulty,
        plannedQuestions: Math.max(3, Math.min(15, Number(plannedQuestions) || 6)),
        allTopics: initialTopics,
        interactions: [],
        difficultyProgression: [],
        integrityEvents: [],
        session: {
          metadata: {
            browserInfo: req.headers['user-agent'],
          },
        },
      });

      return res.status(201).json({
        success: true,
        data: interview,
        message: 'Interview session created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating interview:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to create interview' });
    }
  }

  /**
   * POST /api/interview/:id/start
   * Start interview session and return the first question.
   */
  async startInterview(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const interview = await Interview.findOne({ _id: id, userId });
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
      }

      // If already started and has an unanswered question, return existing state
      const unansweredInteraction = interview.interactions?.find(i => !i.answer);
      if (unansweredInteraction && interview.status === 'in-progress') {
        return res.json({
          success: true,
          data: {
            interviewId: interview._id,
            interactionId: unansweredInteraction.id,
            question: unansweredInteraction.question,
            intent: unansweredInteraction.intent,
            topic: unansweredInteraction.topic,
            difficulty: unansweredInteraction.difficulty,
            stage: unansweredInteraction.stage,
            expectedDuration: 2,
            totalAnswered: interview.interactions?.filter(i => !!i.answer).length || 0,
            plannedQuestions: interview.plannedQuestions || 6,
          },
        });
      }

      interview.status = 'in-progress';
      if (!interview.session?.startTime) {
        // Mutate fields directly — re-assigning a spread of the Mongoose subdocument
        // carries undefined-valued props (e.g. recordingUrls/metadata) and breaks
        // the embedded schema cast on save.
        interview.session.startTime = new Date();
      }

      const candidateContext = interview.candidateContext || {
        userId: userId!,
        role: interview.settings.role,
        experienceLevel: 'Junior',
        interviewType: interview.type as InterviewType,
        difficultyMode: interview.settings.difficulty as DifficultyMode,
      };

      const stage: InterviewStage = (interview.currentStage as InterviewStage) || 'INTRODUCTION';
      const topic = interview.currentTopic || interview.allTopics?.[0] || 'Professional Background';
      const difficulty: DifficultyLevel = (interview.currentDifficulty as DifficultyLevel) || 'medium';

      const firstQuestionIntent = await questionAgent.generateQuestion({
        candidateContext,
        stage,
        topic,
        difficulty,
        previousInteractions: interview.interactions || [],
      });

      const newInteraction = {
        id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        question: firstQuestionIntent.question,
        intent: firstQuestionIntent.intent,
        topic: firstQuestionIntent.topic,
        difficulty: firstQuestionIntent.difficulty,
        stage: firstQuestionIntent.stage,
        expectedConcepts: firstQuestionIntent.expectedConcepts,
        startedAt: new Date(),
      };

      interview.interactions = interview.interactions || [];
      interview.interactions.push(newInteraction as any);

      // Keep legacy questions array populated for UI backwards compatibility
      interview.questions = interview.questions || [];
      interview.questions.push({
        id: newInteraction.id,
        text: newInteraction.question,
        // questions[].type has a narrower enum than Interview.type — 'mixed'/'hr'
        // are not valid question types, so map them onto a valid one.
        type: (['mixed', 'hr'] as string[]).includes(interview.type) ? 'behavioral' : interview.type as any,
        difficulty: newInteraction.difficulty,
        expectedDuration: 2,
      });

      await interview.save();

      return res.json({
        success: true,
        data: {
          interviewId: interview._id,
          interactionId: newInteraction.id,
          question: newInteraction.question,
          intent: newInteraction.intent,
          topic: newInteraction.topic,
          difficulty: newInteraction.difficulty,
          stage: newInteraction.stage,
          expectedDuration: 2,
          totalAnswered: 0,
          plannedQuestions: interview.plannedQuestions || 6,
        },
      });
    } catch (error: any) {
      logger.error('Error starting interview:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to start interview' });
    }
  }

  /**
   * POST /api/interview/:id/answer
   * Submit answer, evaluate, run adaptive engine, and return next question or completion.
   */
  async submitAnswer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { answer = '', answerSource = 'text', responseTimeSeconds = 0 } = req.body;

      const interview = await Interview.findOne({ _id: id, userId });
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
      }

      if (interview.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Interview is already completed' });
      }

      // Find the interaction waiting for an answer
      const interactions = interview.interactions || [];
      const currentInteraction = interactions[interactions.length - 1];
      if (!currentInteraction) {
        return res.status(400).json({ success: false, message: 'No active question found to answer' });
      }

      const candidateContext = interview.candidateContext || {
        userId: userId!,
        role: interview.settings.role,
        experienceLevel: 'Junior',
        interviewType: interview.type as InterviewType,
        difficultyMode: interview.settings.difficulty as DifficultyMode,
      };

      // 1. Evaluate answer
      const evaluation = await evaluationAgent.evaluate({
        candidateContext,
        question: {
          question: currentInteraction.question,
          intent: currentInteraction.intent,
          topic: currentInteraction.topic,
          difficulty: currentInteraction.difficulty as DifficultyLevel,
          stage: currentInteraction.stage as InterviewStage,
          expectedConcepts: currentInteraction.expectedConcepts || [],
        },
        answer,
        stage: currentInteraction.stage as InterviewStage,
        responseTimeSeconds,
      });

      // Update current interaction
      currentInteraction.answer = answer;
      currentInteraction.answerSource = answerSource;
      currentInteraction.answeredAt = new Date();
      currentInteraction.responseTimeSeconds = responseTimeSeconds;
      currentInteraction.evaluation = evaluation;

      // Keep legacy responses array populated for compatibility
      interview.responses = interview.responses || [];
      interview.responses.push({
        questionId: currentInteraction.id,
        answer,
        duration: responseTimeSeconds,
        timestamp: new Date(),
      } as any);

      // Record difficulty progression point
      interview.difficultyProgression = interview.difficultyProgression || [];
      interview.difficultyProgression.push({
        topic: currentInteraction.topic,
        difficulty: currentInteraction.difficulty,
        score: evaluation.overallScore,
        stage: currentInteraction.stage,
        timestamp: new Date(),
      });

      // 2. Run Adaptive Decision Engine
      const decision = adaptiveInterviewEngine.decideNextStep({
        candidateContext,
        currentStage: currentInteraction.stage as InterviewStage,
        currentTopic: currentInteraction.topic,
        currentDifficulty: currentInteraction.difficulty as DifficultyLevel,
        interactions,
        lastEvaluation: evaluation,
        plannedQuestions: interview.plannedQuestions || 6,
        allTopics: interview.allTopics || [currentInteraction.topic],
      });

      // Check if session concludes
      if (decision.action === 'FINISH_INTERVIEW') {
        const assessment = await finalAssessmentAgent.generateAssessment({
          candidateContext,
          interactions,
          difficultyProgression: interview.difficultyProgression,
          integritySummary: {
            totalWarnings: interview.integrityEvents?.length || 0,
            events: interview.integrityEvents?.map(e => e.type) || [],
          },
        });

        interview.status = 'completed';
        interview.finalAssessment = assessment;
        interview.session.endTime = new Date();
        interview.session.actualDuration = interview.session.startTime
          ? Math.round((Date.now() - new Date(interview.session.startTime).getTime()) / 60000)
          : 0;

        // Populate backwards-compatible fields
        interview.analysis = {
          overallScore: assessment.overallScore,
          contentMetrics: {
            relevanceScore: assessment.problemSolvingScore,
            technicalAccuracy: assessment.technicalScore,
            communicationClarity: assessment.communicationScore,
            structureScore: assessment.communicationScore,
            keywordMatches: assessment.topicScores.map(t => t.topic),
          },
        } as any;

        interview.feedback = {
          overallRating: Math.max(1, Math.min(5, Math.round(assessment.overallScore / 20))),
          strengths: assessment.strengths,
          improvements: assessment.weaknesses,
          recommendations: assessment.recommendedPractice,
          detailedFeedback: assessment.summary,
          skillAssessment: assessment.topicScores.map(t => ({
            skill: t.topic,
            currentLevel: Math.round(t.score / 10),
            targetLevel: 10,
            feedback: `Scored ${t.score}/100`,
          })),
          nextSteps: assessment.careerRecommendations,
        };

        await interview.save();

        // Sync with AETHER User statistics
        try {
          await this.syncUserStats(userId!);
        } catch (err) {
          logger.warn('Failed to sync user stats after interview finish:', err);
        }

        return res.json({
          success: true,
          data: {
            finished: true,
            interviewId: interview._id,
            evaluation,
            finalAssessment: assessment,
          },
        });
      }

      // Generate next question according to decision
      interview.currentStage = decision.nextStage;
      interview.currentTopic = decision.nextTopic;
      interview.currentDifficulty = decision.nextDifficulty;

      const nextQuestionIntent = await questionAgent.generateQuestion({
        candidateContext,
        stage: decision.nextStage,
        topic: decision.nextTopic,
        difficulty: decision.nextDifficulty,
        previousInteractions: interactions,
        followUpContext: decision.followUpContext,
      });

      const nextInteraction = {
        id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        question: nextQuestionIntent.question,
        intent: nextQuestionIntent.intent,
        topic: nextQuestionIntent.topic,
        difficulty: nextQuestionIntent.difficulty,
        stage: nextQuestionIntent.stage,
        expectedConcepts: nextQuestionIntent.expectedConcepts,
        startedAt: new Date(),
      };

      interview.interactions.push(nextInteraction as any);
      interview.questions.push({
        id: nextInteraction.id,
        text: nextInteraction.question,
        // questions[].type has a narrower enum than Interview.type — 'mixed'/'hr'
        // are not valid question types, so map them onto a valid one.
        type: (['mixed', 'hr'] as string[]).includes(interview.type) ? 'behavioral' : interview.type as any,
        difficulty: nextInteraction.difficulty,
        expectedDuration: 2,
      });

      await interview.save();

      const answeredCount = interview.interactions.filter(i => !!i.answer).length;

      return res.json({
        success: true,
        data: {
          finished: false,
          evaluation,
          decision,
          nextQuestion: {
            interviewId: interview._id,
            interactionId: nextInteraction.id,
            question: nextInteraction.question,
            intent: nextInteraction.intent,
            topic: nextInteraction.topic,
            difficulty: nextInteraction.difficulty,
            stage: nextInteraction.stage,
            expectedDuration: 2,
            totalAnswered: answeredCount,
            plannedQuestions: interview.plannedQuestions || 6,
          },
        },
      });
    } catch (error: any) {
      logger.error('Error submitting interview answer:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to submit answer' });
    }
  }

  /**
   * POST /api/interview/:id/end
   * Manually end interview and produce final assessment report.
   */
  async endInterview(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const interview = await Interview.findOne({ _id: id, userId });
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
      }

      const candidateContext = interview.candidateContext || {
        userId: userId!,
        role: interview.settings.role,
        experienceLevel: 'Junior',
        interviewType: interview.type as InterviewType,
        difficultyMode: interview.settings.difficulty as DifficultyMode,
      };

      const assessment = await finalAssessmentAgent.generateAssessment({
        candidateContext,
        interactions: interview.interactions || [],
        difficultyProgression: interview.difficultyProgression || [],
        integritySummary: {
          totalWarnings: interview.integrityEvents?.length || 0,
          events: interview.integrityEvents?.map(e => e.type) || [],
        },
      });

      interview.status = 'completed';
      interview.finalAssessment = assessment;
      interview.session.endTime = new Date();
      interview.session.actualDuration = interview.session.startTime
        ? Math.round((Date.now() - new Date(interview.session.startTime).getTime()) / 60000)
        : 0;

      interview.analysis = {
        overallScore: assessment.overallScore,
        contentMetrics: {
          relevanceScore: assessment.problemSolvingScore,
          technicalAccuracy: assessment.technicalScore,
          communicationClarity: assessment.communicationScore,
          structureScore: assessment.communicationScore,
          keywordMatches: assessment.topicScores.map(t => t.topic),
        },
      } as any;

      interview.feedback = {
        overallRating: Math.max(1, Math.min(5, Math.round(assessment.overallScore / 20))),
        strengths: assessment.strengths,
        improvements: assessment.weaknesses,
        recommendations: assessment.recommendedPractice,
        detailedFeedback: assessment.summary,
        skillAssessment: assessment.topicScores.map(t => ({
          skill: t.topic,
          currentLevel: Math.round(t.score / 10),
          targetLevel: 10,
          feedback: `Scored ${t.score}/100`,
        })),
        nextSteps: assessment.careerRecommendations,
      };

      await interview.save();

      try {
        await this.syncUserStats(userId!);
      } catch (err) {
        logger.warn('Failed to sync user stats after manual interview end:', err);
      }

      return res.json({
        success: true,
        data: {
          interviewId: interview._id,
          finalAssessment: assessment,
        },
      });
    } catch (error: any) {
      logger.error('Error ending interview:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to end interview' });
    }
  }

  /**
   * GET /api/interview/:id
   * Get interview details and current question.
   */
  async getInterview(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const interview = await Interview.findOne({ _id: id, userId });
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
      }

      const unansweredInteraction = interview.interactions?.find(i => !i.answer);

      return res.json({
        success: true,
        data: {
          ...interview.toJSON(),
          activeQuestion: unansweredInteraction
            ? {
                interactionId: unansweredInteraction.id,
                question: unansweredInteraction.question,
                intent: unansweredInteraction.intent,
                topic: unansweredInteraction.topic,
                difficulty: unansweredInteraction.difficulty,
                stage: unansweredInteraction.stage,
                totalAnswered: interview.interactions?.filter(i => !!i.answer).length || 0,
                plannedQuestions: interview.plannedQuestions || 6,
              }
            : null,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching interview:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch interview' });
    }
  }

  /**
   * GET /api/interview/:id/result
   * Get final assessment result.
   */
  async getInterviewResult(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const interview = await Interview.findOne({ _id: id, userId });
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
      }

      if (!interview.finalAssessment) {
        // If completed or has interactions, generate assessment on the fly
        const candidateContext = interview.candidateContext || {
          userId: userId!,
          role: interview.settings.role,
          experienceLevel: 'Junior',
          interviewType: interview.type as InterviewType,
          difficultyMode: interview.settings.difficulty as DifficultyMode,
        };

        const assessment = await finalAssessmentAgent.generateAssessment({
          candidateContext,
          interactions: interview.interactions || [],
          difficultyProgression: interview.difficultyProgression || [],
          integritySummary: {
            totalWarnings: interview.integrityEvents?.length || 0,
            events: interview.integrityEvents?.map(e => e.type) || [],
          },
        });

        interview.finalAssessment = assessment;
        await interview.save();
      }

      return res.json({
        success: true,
        data: {
          interview: {
            id: interview._id,
            role: interview.settings.role,
            difficulty: interview.settings.difficulty,
            type: interview.type,
            status: interview.status,
            createdAt: interview.createdAt,
            durationMinutes: interview.session?.actualDuration || 0,
          },
          finalAssessment: interview.finalAssessment,
          interactions: interview.interactions || [],
          difficultyProgression: interview.difficultyProgression || [],
          integrityEvents: interview.integrityEvents || [],
        },
      });
    } catch (error: any) {
      logger.error('Error getting interview result:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get interview result' });
    }
  }

  /**
   * GET /api/interview/history/me
   * Return authenticated candidate's interview history.
   */
  async getHistory(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

      const [interviews, total] = await Promise.all([
        Interview.find({ userId })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('type status settings session analysis finalAssessment createdAt updatedAt interactions'),
        Interview.countDocuments({ userId }),
      ]);

      const formatted = interviews.map(i => {
        const overallScore = i.finalAssessment?.overallScore ?? i.analysis?.overallScore ?? 0;
        return {
          id: i._id,
          type: i.type,
          status: i.status,
          role: i.settings?.role,
          difficulty: i.settings?.difficulty,
          duration: i.session?.actualDuration || 0,
          overallScore,
          questionsAnswered: i.interactions?.filter(item => !!item.answer).length || 0,
          createdAt: i.createdAt,
        };
      });

      return res.json({
        success: true,
        data: formatted,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching interview history:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to fetch interview history' });
    }
  }

  /**
   * POST /api/interview/:id/integrity
   * Record anti-cheat / session integrity event.
   */
  async recordIntegrityEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { type, details } = req.body;

      if (!type) {
        return res.status(400).json({ success: false, message: 'Event type is required' });
      }

      const interview = await Interview.findOne({ _id: id, userId });
      if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
      }

      interview.integrityEvents = interview.integrityEvents || [];
      interview.integrityEvents.push({
        type,
        timestamp: new Date(),
        details,
      });

      await interview.save();

      return res.json({
        success: true,
        data: {
          recorded: true,
          totalEvents: interview.integrityEvents.length,
        },
      });
    } catch (error: any) {
      logger.error('Error recording integrity event:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to record integrity event' });
    }
  }

  /**
   * Helper: sync completed interview stats into User.stats for dashboard analytics.
   */
  private async syncUserStats(userId: string) {
    const user = await User.findById(userId);
    if (!user) return;

    const stats = await Interview.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
      {
        $group: {
          _id: null,
          totalInterviews: { $sum: 1 },
          averageScore: {
            $avg: {
              $ifNull: ['$finalAssessment.overallScore', '$analysis.overallScore'],
            },
          },
          lastInterviewDate: { $max: '$createdAt' },
        },
      },
    ]);

    if (stats.length > 0) {
      user.stats.totalInterviews = stats[0].totalInterviews || 0;
      user.stats.averageScore = Math.round(stats[0].averageScore || 0);
      user.stats.lastInterviewDate = stats[0].lastInterviewDate;

      // Calculate improvement rate
      const recentInterviews = await Interview.find({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'completed',
        $or: [
          { 'finalAssessment.overallScore': { $exists: true } },
          { 'analysis.overallScore': { $exists: true } },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(10);

      if (recentInterviews.length >= 4) {
        const getScore = (i: any) => i.finalAssessment?.overallScore ?? i.analysis?.overallScore ?? 0;
        const mid = Math.floor(recentInterviews.length / 2);
        const recent = recentInterviews.slice(0, mid);
        const older = recentInterviews.slice(mid);

        const recentAvg = recent.reduce((sum, i) => sum + getScore(i), 0) / recent.length;
        const olderAvg = older.reduce((sum, i) => sum + getScore(i), 0) / older.length;

        if (olderAvg > 0) {
          user.stats.improvementRate = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
        }
      }

      await user.save();
    }
  }
}

export const interviewController = new InterviewController();
