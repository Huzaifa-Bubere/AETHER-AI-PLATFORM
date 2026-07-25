import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import { body, validationResult } from "express-validator";
import Interview from "../models/Interview";
import Resume from "../models/Resume";
import { asyncHandler } from "../middleware/errorHandler";
import geminiService from "../services/gemini";
import logger from "../utils/logger";

const router = express.Router();

// Create new interview
router.post(
  "/create",
  [
    body("type")
      .isIn([
        "behavioral",
        "technical",
        "coding",
        "system-design",
        "skill-based",
      ])
      .withMessage(
        "Interview type must be one of: behavioral, technical, coding, system-design, skill-based",
      ),
    body("settings.role")
      .notEmpty()
      .withMessage("Target role is required")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Role must be between 2 and 100 characters"),
    body("settings.difficulty")
      .isIn(["easy", "medium", "hard"])
      .withMessage("Difficulty must be one of: easy, medium, hard"),
    body("settings.duration")
      .isInt({ min: 15, max: 120 })
      .withMessage("Duration must be between 15 and 120 minutes"),
  ],
  asyncHandler(async (req, res) => {
    logger.info("POST /api/interview/create");

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Format errors for better readability
      const formattedErrors = errors.array().map((err: any) => ({
        field: err.param || err.path || "unknown",
        message: err.msg || err.message || "Validation error",
        value: err.value,
        location: err.location || "body",
      }));

      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: "Please check your interview settings and try again",
        details: formattedErrors,
        hint: "Check that type is one of: behavioral, technical, coding, system-design",
      });
    }

    if (!req.user || !req.user.userId) {
      console.error("No user ID in request");
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
        message: "Please log in to create an interview",
      });
    }

    const { type, settings, resumeId } = req.body;

    try {
      console.log(`Creating ${type} interview for user ${req.user.userId}`);

      // Get user's resume if resumeId provided
      let resumeData = null;
      if (resumeId) {
        console.log(`Looking for resume: ${resumeId}`);
        const resume = await Resume.findOne({
          _id: resumeId,
          userId: req.user.userId,
        });
        if (resume) {
          resumeData = resume;
        } else {
        }
      } else {
        // Get latest resume

        const latestResume = await Resume.findOne({
          userId: req.user.userId,
        }).sort({ uploadDate: -1 });

        if (latestResume) {
          resumeData = latestResume;
        } else {
        }
      }

      // Prepare question generation parameters
      // const questionParams: any = {
      //   role: settings.role,
      //   experienceLevel: 'mid', // TODO: Get from user profile
      //   interviewType: type,
      //   difficulty: settings.difficulty,
      //   count: Math.min(5, Math.floor(settings.duration / 5)), // Max 5 questions for faster generation
      // };

      const questionParams: any = {
        role: settings.role,
        experienceLevel: "mid",
        interviewType: type,
        difficulty: settings.difficulty,
        count: Math.min(5, Math.floor(settings.duration / 5)),
        domain: settings.domain, // NEW
      };

      // Add resume context if available
      if (resumeData && resumeData.parsedData) {
        questionParams.resumeContext = {
          skills: resumeData.extractedSkills || [],
          experience: resumeData.parsedData.experience || [],
          projects: resumeData.parsedData.projects || [],
          summary: resumeData.parsedData.summary || "",
        };
      }

      logger.info(
        `Generating ${questionParams.count} questions for ${settings.role} with resume context: ${!!resumeData}`,
      );

      // Generate questions using Gemini AI with timeout

      const questionGenerationPromise =
        geminiService.generateInterviewQuestions(questionParams);
      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(
            () => reject(new Error("Question generation timeout")),
            60000,
          ), // Bug 3 fix: 60s
      );

      let questions;
      try {
        questions = (await Promise.race([
          questionGenerationPromise,
          timeoutPromise,
        ])) as any[];
        console.log(`Generated ${questions.length} questions successfully`);
      } catch (timeoutError: any) {
        logger.warn("Question generation timed out, using fallback");
        logger.warn("Question generation timeout, using fallback");
        // Use fallback - will be handled by gemini service
        questions =
          await geminiService.generateInterviewQuestions(questionParams);
      }

      // Create interview in database
      const interview = new Interview({
        userId: req.user.userId,
        resumeId: resumeData?._id || null,
        type,
        status: "scheduled",
        settings: {
          role: settings.role,
          difficulty: settings.difficulty,
          duration: settings.duration,
          includeVideo: settings.includeVideo !== false,
          includeAudio: settings.includeAudio !== false,
          includeCoding: settings.includeCoding || false,
        },
        questions: questions.map((q: any) => {
          // Normalize a value to string for display, keep as-is for Mixed fields
          const toStr = (v: any): string => {
            if (v === null || v === undefined) return "";
            if (typeof v === "string") return v;
            return JSON.stringify(v);
          };

          // Normalize examples â€” input/output can be any type (Mixed)
          const examples = (q.examples || []).map((ex: any) => ({
            input: ex.input ?? null,
            output: ex.output ?? null,
            explanation:
              typeof ex.explanation === "string"
                ? ex.explanation
                : toStr(ex.explanation),
          }));

          // Normalize testCases â€” input/expectedOutput can be any type (Mixed)
          const testCases = (q.testCases || []).map((tc: any) => ({
            input: tc.input ?? null,
            expectedOutput: tc.expectedOutput ?? null,
          }));

          // Normalize constraints â€” must be strings
          const constraints = (q.constraints || []).map((c: any) =>
            typeof c === "string" ? c : JSON.stringify(c),
          );

          return {
            id:
              q.id ||
              `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text:
              q.text ||
              q.question ||
              q.title ||
              q.description ||
              `Question about ${settings.role}`,
            description: q.description || null,
            type: q.type || (type === "skill-based" ? "technical" : type),
            difficulty: q.difficulty || settings.difficulty,
            expectedDuration: q.expectedDuration || 5,
            followUpQuestions: (q.followUpQuestions || []).map((f: any) =>
              typeof f === "string" ? f : JSON.stringify(f),
            ),
            category: q.category || settings.domain || "general",
            examples,
            constraints,
            testCases,
          };
        }),
        responses: [],
        session: {
          startTime: null,
          endTime: null,
          actualDuration: null,
        },
      });

      await interview.save();

      logger.info(
        `Interview created: ${interview._id} for user ${req.user.userId} with ${questions.length} questions`,
      );
      console.log(`=== Interview created successfully ===`);
      console.log(`Interview ID: ${interview._id}`);
      console.log(`Questions: ${questions.length}`);
      console.log(`Type: ${type}`);
      console.log(`Role: ${settings.role}`);

      // Return interview with both _id and id for compatibility
      const interviewData = interview.toObject();
      const responseData = {
        ...interviewData,
        id: interview._id.toString(), // Ensure id is always present
      };

      res.status(201).json({
        success: true,
        data: responseData,
        message: "Interview created successfully",
      });
    } catch (error: any) {
      logger.error("Interview creation error:", error);

      res.status(500).json({
        success: false,
        error: "Interview creation failed",
        message: error.message,
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }),
);

// Start interview session
router.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      if (
        interview.status !== "scheduled" &&
        interview.status !== "in-progress"
      ) {
        return res.status(400).json({
          success: false,
          error: "Interview already completed or cancelled",
        });
      }

      // If already in-progress, just return the existing session (handles page refresh)
      if (interview.status === "in-progress") {
        const session = {
          id: interview._id,
          interviewId: interview._id,
          status: "active",
          startTime: interview.session.startTime,
          isRecording: false,
          currentQuestionIndex: interview.responses.length,
          totalQuestions: interview.questions.length,
        };
        return res.json({
          success: true,
          data: session,
          message: "Interview session resumed",
        });
      }

      // Update interview status and start time
      interview.status = "in-progress";
      interview.session.startTime = new Date();
      interview.session.metadata = {
        browserInfo: req.headers["user-agent"] || "Unknown",
        deviceInfo: req.body.deviceInfo || "Unknown",
        networkQuality: req.body.networkQuality || "Unknown",
      };

      await interview.save();

      logger.info(`Interview started: ${id} by user ${req.user!.userId}`);

      const session = {
        id: interview._id,
        interviewId: interview._id,
        status: "active",
        startTime: interview.session.startTime,
        isRecording: false,
        currentQuestionIndex: 0,
        totalQuestions: interview.questions.length,
      };

      res.json({
        success: true,
        data: session,
        message: "Interview session started",
      });
    } catch (error: any) {
      logger.error("Interview start error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start interview",
        message: error.message,
      });
    }
  }),
);

// End interview session
router.post(
  "/:id/end",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Update interview status and end time
      interview.status = "completed";
      interview.session.endTime = new Date();

      if (interview.session.startTime) {
        const duration =
          (interview.session.endTime.getTime() -
            interview.session.startTime.getTime()) /
          1000 /
          60;
        interview.session.actualDuration = Math.round(duration);
      }

      await interview.save();

      logger.info(
        `Interview ended: ${id} by user ${req.user!.userId}, duration: ${interview.session.actualDuration}min`,
      );

      res.json({
        success: true,
        data: interview,
        message: "Interview session ended",
      });
    } catch (error: any) {
      logger.error("Interview end error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to end interview",
        message: error.message,
      });
    }
  }),
);

// Get next question â€” returns 200 with completed:true instead of 404 when done
router.get(
  "/:id/next-question",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Bug 26 fix: filter questions with no id to prevent infinite loop
      const validQuestions = interview.questions.filter((q: any) => q.id);

      // Get next unanswered question
      const answeredQuestionIds = new Set(
        interview.responses.map((r: any) => r.questionId),
      );
      const nextQuestion = validQuestions.find(
        (q: any) => !answeredQuestionIds.has(q.id),
      );

      // No more questions â€” signal completion with 200, not 404
      if (!nextQuestion) {
        return res.json({
          success: true,
          data: null,
          completed: true,
          totalQuestions: validQuestions.length,
          answeredQuestions: interview.responses.length,
          message: "All questions have been answered",
        });
      }

      res.json({
        success: true,
        data: nextQuestion,
        completed: false,
        totalQuestions: interview.questions.length,
        answeredQuestions: interview.responses.length,
      });
    } catch (error: any) {
      logger.error("Get next question error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get next question",
        message: error.message,
      });
    }
  }),
);

// Submit response
router.post(
  "/:id/response",
  [
    body("questionId").notEmpty(),
    body("answer").optional({ nullable: true }).trim(),
    body("duration").isNumeric(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors.array(),
      });
    }

    const { id } = req.params;
    const { questionId, answer, duration, audioUrl, videoUrl, codeSubmission } =
      req.body;

    // Use code as answer for coding submissions if answer is empty
    const effectiveAnswer = answer || codeSubmission?.code || "";

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      const question = interview.questions.find(
        (q: any) => q.id === questionId,
      );

      if (!question) {
        return res.status(404).json({
          success: false,
          error: "Question not found",
        });
      }

      // STEP 1 - SAVE RESPONSE FIRST (FAST)
      const responseData = {
        questionId,
        answer: effectiveAnswer,
        audioUrl: audioUrl || null,
        videoUrl: videoUrl || null,
        codeSubmission: codeSubmission || null,
        duration,
        timestamp: new Date(),
      };

      console.log("=== RESPONSE DATA ===");

      console.log(JSON.stringify(responseData, null, 2));

      await Interview.findByIdAndUpdate(id, {
        $push: { responses: responseData },
      });

      // STEP 2 - RETURN RESPONSE IMMEDIATELY (NO WAIT)
      res.json({
        success: true,
        message: "Response submitted instantly",
      });

      // STEP 3 - RUN AI ANALYSIS IN BACKGROUND (NO BLOCKING)
      (async () => {
        try {
          logger.info(`Background AI analysis for question ${questionId}`);

          const analysis = await geminiService.analyzeResponse({
            question: question.text,
            answer: effectiveAnswer,
            role: interview.settings.role,
          });

          if (!analysis?.scores) return;

          // Fetch current state to compute running average across all responses
          const current =
            await Interview.findById(id).select("analysis responses");
          const existingMetrics = current?.analysis?.contentMetrics;
          const responseCount = Math.max(1, current?.responses?.length || 1);

          const runningAvg = (oldVal: number, newVal: number) =>
            Math.round(
              ((oldVal || 0) * (responseCount - 1) + (newVal || 0)) /
                responseCount,
            );

          await Interview.findByIdAndUpdate(id, {
            $set: {
              "analysis.contentMetrics.relevanceScore": runningAvg(
                existingMetrics?.relevanceScore || 0,
                analysis.scores.relevance || 0,
              ),
              "analysis.contentMetrics.technicalAccuracy": runningAvg(
                existingMetrics?.technicalAccuracy || 0,
                analysis.scores.technicalAccuracy || 0,
              ),
              "analysis.contentMetrics.communicationClarity": runningAvg(
                existingMetrics?.communicationClarity || 0,
                analysis.scores.clarity || 0,
              ),
              "analysis.contentMetrics.structureScore": runningAvg(
                existingMetrics?.structureScore || 0,
                analysis.scores.structure || 0,
              ),
              "analysis.overallScore": runningAvg(
                current?.analysis?.overallScore || 0,
                analysis.overallScore || 0,
              ),
            },
            $addToSet: {
              "analysis.contentMetrics.keywordMatches": {
                $each: analysis.keywordMatches || [],
              },
            },
          });

          logger.info("Background AI analysis completed successfully");
        } catch (err) {
          logger.error("Background AI analysis failed:", err);
        }
      })();
    } catch (error: any) {
      logger.error("Submit response error:", error);

      res.status(500).json({
        success: false,
        error: "Failed to submit response",
        message: error.message,
      });
    }
  }),
);
// Process video frame for real-time analysis
router.post(
  "/:id/process-video",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { frameData, timestamp } = req.body;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Send to Python AI server for emotion detection
      const aiServerUrl =
        process.env.PYTHON_AI_SERVER_URL || "http://localhost:8000";
      const apiKey = process.env.PYTHON_AI_SERVER_API_KEY;
      if (!apiKey) {
        throw new Error("PYTHON_AI_SERVER_API_KEY is not configured");
      }
      const aiResponse = await axios.post(
        `${aiServerUrl}/api/emotion/analyze`,
        { image_data: frameData, timestamp: timestamp || Date.now() },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      const emotionData = aiResponse.data?.data || {};

      // Store emotion data in interview
      if (!interview.analysis) {
        interview.analysis = {
          videoMetrics: { emotionAnalysis: [] },
        } as any;
      }

      if (!interview.analysis.videoMetrics) {
        interview.analysis.videoMetrics = { emotionAnalysis: [] } as any;
      }

      interview.analysis.videoMetrics.emotionAnalysis.push({
        timestamp,
        emotions: emotionData.emotions || {},
      } as any);

      console.log("=== VIDEO ANALYSIS DATA ===");

      console.log(JSON.stringify(interview.analysis.videoMetrics, null, 2));

      await interview.save();

      res.json({
        success: true,
        data: { analysis: emotionData },
      });
    } catch (error: any) {
      logger.error("Video processing error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process video",
        message: error.message,
      });
    }
  }),
);

// Process audio chunk for real-time analysis
router.post(
  "/:id/process-audio",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // TODO: Process audio with Python AI server
      // For now, return success
      res.json({
        success: true,
        data: {
          transcript: "",
          analysis: {},
        },
      });
    } catch (error: any) {
      logger.error("Audio processing error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process audio",
        message: error.message,
      });
    }
  }),
);

// Get interview history
router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    try {
      const query: any = { userId: req.user!.userId };
      if (status) {
        query.status = status;
      }

      const interviews = await Interview.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .select("type status settings analysis createdAt updatedAt session");

      const total = await Interview.countDocuments(query);

      res.json({
        success: true,
        data: interviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error("Get interview history error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get interview history",
        message: error.message,
      });
    }
  }),
);

// Get specific interview
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      res.json({
        success: true,
        data: interview,
      });
    } catch (error: any) {
      logger.error("Get interview error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get interview",
        message: error.message,
      });
    }
  }),
);

// Get interview analysis
router.get(
  "/:id/analysis",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      res.json({
        success: true,
        data: interview.analysis || {},
      });
    } catch (error: any) {
      logger.error("Get analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get analysis",
        message: error.message,
      });
    }
  }),
);

// Generate feedback
router.post(
  "/:id/feedback",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Bug 19 & 24 fix: if content metrics are all 0 (background analysis didn't finish
      // before endInterview was called), run synchronous analysis on all responses now.
      const metrics = interview.analysis?.contentMetrics;
      const hasScores =
        metrics &&
        ((metrics.relevanceScore || 0) > 0 ||
          (metrics.technicalAccuracy || 0) > 0 ||
          (metrics.communicationClarity || 0) > 0);

      if (!hasScores && interview.responses.length > 0) {
        logger.info(
          `Running synchronous analysis for ${interview.responses.length} responses (background analysis missed)`,
        );

        // Analyse all responses and average the scores
        const allScores: any[] = [];
        const allKeywords: string[] = [];

        for (const resp of interview.responses) {
          const q = interview.questions.find(
            (q: any) => q.id === resp.questionId,
          );
          if (!q || !resp.answer) continue;
          try {
            const analysis = await geminiService.analyzeResponse({
              question: q.text,
              answer: resp.answer,
              role: interview.settings.role,
            });
            if (analysis?.scores) allScores.push(analysis.scores);
            if (analysis?.keywordMatches)
              allKeywords.push(...analysis.keywordMatches);
          } catch (e) {
            logger.warn(`Sync analysis failed for question ${q.id}:`, e);
          }
        }

        if (allScores.length > 0) {
          const avg = (key: string) =>
            Math.round(
              allScores.reduce((s, sc) => s + (sc[key] || 0), 0) /
                allScores.length,
            );

          await Interview.findByIdAndUpdate(id, {
            $set: {
              "analysis.contentMetrics.relevanceScore": avg("relevance"),
              "analysis.contentMetrics.technicalAccuracy":
                avg("technicalAccuracy"),
              "analysis.contentMetrics.communicationClarity": avg("clarity"),
              "analysis.contentMetrics.structureScore": avg("structure"),
              "analysis.contentMetrics.keywordMatches": [
                ...new Set(allKeywords),
              ],
              "analysis.overallScore": avg("relevance"),
            },
          });

          // Reload with fresh scores
          const refreshed = await Interview.findById(id);
          if (refreshed) Object.assign(interview, refreshed);
        }
      }

      // Build response summaries for richer feedback
      const responseSummaries = interview.responses.map((resp: any) => {
        const q = interview.questions.find(
          (q: any) => q.id === resp.questionId,
        );
        return {
          question: q?.text || "Unknown question",
          answer: resp.answer || resp.codeSubmission?.code || "",
          duration: resp.duration || 0,
        };
      });

      // Generate feedback using Gemini AI
      const feedback = await geminiService.generateFeedback({
        interviewData: {
          type: interview.type,
          role: interview.settings.role,
          duration: interview.session.actualDuration,
          questionsAnswered: interview.responses.length,
          totalQuestions: interview.questions.length,
          responses: responseSummaries,
        },
        analysisResults: interview.analysis || {},
        userProfile: {},
      });

      // Save feedback to interview
      interview.feedback = {
        overallRating: feedback.overallRating || 75,
        strengths: feedback.strengths || [],
        improvements: feedback.improvements || [],
        recommendations: feedback.recommendations || [],
        detailedFeedback: feedback.detailedFeedback || "",
        skillAssessment: feedback.skillAssessment || [],
        nextSteps: feedback.nextSteps || [],
      } as any;

      await interview.save();

      logger.info(`Feedback generated for interview ${id}`);

      // Bug 20 fix: compare with user's previous completed interview score.
      const previousInterview = await Interview.findOne({
        userId: req.user!.userId,
        status: "completed",
        _id: { $ne: id },
      })
        .sort({ createdAt: -1 })
        .select("feedback.overallRating analysis.overallScore");

      const previousScore =
        (previousInterview as any)?.feedback?.overallRating ??
        (previousInterview as any)?.analysis?.overallScore ??
        0;
      const currentScore = interview.feedback?.overallRating || 0;
      const improvement = previousScore > 0 ? currentScore - previousScore : 0;

      res.json({
        success: true,
        data: {
          ...interview.feedback,
          improvement,
        },
      });
    } catch (error: any) {
      logger.error("Generate feedback error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate feedback",
        message: error.message,
      });
    }
  }),
);

// Get feedback
router.get(
  "/:id/feedback",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Check if feedback exists and has content
      if (!interview.feedback || !interview.feedback.overallRating) {
        return res.status(404).json({
          success: false,
          error: "Feedback not generated yet",
        });
      }

      const previousInterview = await Interview.findOne({
        userId: req.user!.userId,
        status: "completed",
        _id: { $ne: id },
      })
        .sort({ createdAt: -1 })
        .select("feedback.overallRating analysis.overallScore");

      const previousScore =
        (previousInterview as any)?.feedback?.overallRating ??
        (previousInterview as any)?.analysis?.overallScore ??
        0;
      const currentScore = interview.feedback?.overallRating || 0;
      const improvement = previousScore > 0 ? currentScore - previousScore : 0;
      const feedbackObj = (interview.feedback as any)?.toObject
        ? (interview.feedback as any).toObject()
        : interview.feedback;

      res.json({
        success: true,
        data: {
          ...feedbackObj,
          improvement,
        },
      });
    } catch (error: any) {
      logger.error("Get feedback error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get feedback",
        message: error.message,
      });
    }
  }),
);

// Generate PDF report
router.post(
  "/:id/report",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: id,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Check if feedback exists
      if (!interview.feedback || !interview.feedback.overallRating) {
        return res.status(400).json({
          success: false,
          error: "Feedback not generated yet",
          message: "Please generate feedback before downloading the report",
        });
      }

      // For now, return a placeholder URL
      // TODO: Implement actual PDF generation using a library like puppeteer or pdfkit
      const reportUrl = `${process.env.FRONTEND_URL}/feedback/${id}`;

      logger.info(`Report generated for interview ${id}`);

      res.json({
        success: true,
        data: {
          reportUrl,
          message:
            "Report generated successfully. You can print this page as PDF.",
        },
      });
    } catch (error: any) {
      logger.error("Generate report error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to generate report",
        message: error.message,
      });
    }
  }),
);

// Real-time video analysis
router.post(
  "/:interviewId/analyze/video",
  asyncHandler(async (req, res) => {
    const { interviewId } = req.params;
    const { frameData, timestamp } = req.body;

    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Call Python AI server for video analysis
      const pythonServerUrl =
        process.env.PYTHON_AI_SERVER_URL || "http://localhost:8000";
      const apiKey = process.env.PYTHON_AI_SERVER_API_KEY;

      const axios = require("axios");
      const analysisResponse = await axios.post(
        `${pythonServerUrl}/api/video/analyze-frame`,
        { frame_data: frameData, timestamp },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      if (analysisResponse.data && analysisResponse.data.success) {
        const videoAnalysis = analysisResponse.data.data;

        // Update interview analysis
        if (!interview.analysis) {
          interview.analysis = {
            videoMetrics: {
              eyeContactPercentage: 0,
              emotionAnalysis: [],
              postureScore: 0,
              gestureAnalysis: [],
              confidenceLevel: 0,
            },
            audioMetrics: {
              speechRate: 0,
              pauseAnalysis: [],
              fillerWords: [],
              toneAnalysis: [],
              clarityScore: 0,
            },
            contentMetrics: {
              relevanceScore: 0,
              technicalAccuracy: 0,
              communicationClarity: 0,
              structureScore: 0,
              keywordMatches: [],
            },
            overallScore: 0,
          };
        }

        // Add emotion data
        if (videoAnalysis.emotions) {
          interview.analysis.videoMetrics.emotionAnalysis.push({
            timestamp,
            emotions: videoAnalysis.emotions,
          });
        }

        // Update eye contact
        if (videoAnalysis.eyeContact !== undefined) {
          const currentCount =
            interview.analysis.videoMetrics.emotionAnalysis.length;
          const currentTotal =
            interview.analysis.videoMetrics.eyeContactPercentage *
            (currentCount - 1);
          interview.analysis.videoMetrics.eyeContactPercentage =
            (currentTotal + videoAnalysis.eyeContact) / currentCount;
        }

        await interview.save();

        res.json({
          success: true,
          data: videoAnalysis,
          message: "Video frame analyzed",
        });
      } else {
        throw new Error("Video analysis failed");
      }
    } catch (error: any) {
      logger.error("Real-time video analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Video analysis failed",
        message: error.message,
      });
    }
  }),
);

// Real-time audio analysis
router.post(
  "/:interviewId/analyze/audio",
  asyncHandler(async (req, res) => {
    const { interviewId } = req.params;
    const { audioData, transcript, timestamp } = req.body;

    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      // Call Python AI server for audio analysis
      const pythonServerUrl =
        process.env.PYTHON_AI_SERVER_URL || "http://localhost:8000";
      const apiKey = process.env.PYTHON_AI_SERVER_API_KEY;

      const axios = require("axios");
      const analysisResponse = await axios.post(
        `${pythonServerUrl}/api/audio/analyze`,
        {
          audio_data: audioData,
          transcript,
          timestamp,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      if (analysisResponse.data && analysisResponse.data.success) {
        const audioAnalysis = analysisResponse.data.data;

        // Update interview analysis
        if (!interview.analysis) {
          interview.analysis = {
            videoMetrics: {
              eyeContactPercentage: 0,
              emotionAnalysis: [],
              postureScore: 0,
              gestureAnalysis: [],
              confidenceLevel: 0,
            },
            audioMetrics: {
              speechRate: 0,
              pauseAnalysis: [],
              fillerWords: [],
              toneAnalysis: [],
              clarityScore: 0,
            },
            contentMetrics: {
              relevanceScore: 0,
              technicalAccuracy: 0,
              communicationClarity: 0,
              structureScore: 0,
              keywordMatches: [],
            },
            overallScore: 0,
          };
        }

        // Update speech rate
        if (audioAnalysis.speechRate) {
          interview.analysis.audioMetrics.speechRate = audioAnalysis.speechRate;
        }

        // Add filler words
        if (audioAnalysis.fillerWords) {
          audioAnalysis.fillerWords.forEach((fw: any) => {
            const existing = interview.analysis!.audioMetrics.fillerWords.find(
              (f: any) => f.word === fw.word,
            );
            if (existing) {
              existing.count += fw.count;
              existing.timestamps.push(...fw.timestamps);
            } else {
              interview.analysis!.audioMetrics.fillerWords.push(fw);
            }
          });
        }

        // Update clarity score
        if (audioAnalysis.clarityScore !== undefined) {
          interview.analysis.audioMetrics.clarityScore =
            audioAnalysis.clarityScore;
        }

        console.log("=== AUDIO ANALYSIS DATA ===");

        console.log(JSON.stringify(interview.analysis.audioMetrics, null, 2));

        await interview.save();

        res.json({
          success: true,
          data: audioAnalysis,
          message: "Audio analyzed",
        });
      } else {
        throw new Error("Audio analysis failed");
      }
    } catch (error: any) {
      logger.error("Real-time audio analysis error:", error);
      res.status(500).json({
        success: false,
        error: "Audio analysis failed",
        message: error.message,
      });
    }
  }),
);

// Get real-time analysis summary
router.get(
  "/:interviewId/analyze/summary",
  asyncHandler(async (req, res) => {
    const { interviewId } = req.params;

    try {
      const interview = await Interview.findOne({
        _id: interviewId,
        userId: req.user!.userId,
      });

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      const analysis = interview.analysis || {
        videoMetrics: {
          eyeContactPercentage: 0,
          emotionAnalysis: [],
          postureScore: 0,
          gestureAnalysis: [],
          confidenceLevel: 0,
        },
        audioMetrics: {
          speechRate: 0,
          pauseAnalysis: [],
          fillerWords: [],
          toneAnalysis: [],
          clarityScore: 0,
        },
        contentMetrics: {
          relevanceScore: 0,
          technicalAccuracy: 0,
          communicationClarity: 0,
          structureScore: 0,
          keywordMatches: [],
        },
        overallScore: 0,
      };

      // Calculate live metrics
      const liveMetrics = {
        eyeContact: Math.round(analysis.videoMetrics.eyeContactPercentage),
        speechRate: analysis.audioMetrics.speechRate,
        fillerWordCount: analysis.audioMetrics.fillerWords.reduce(
          (sum: number, fw: any) => sum + fw.count,
          0,
        ),
        clarityScore: Math.round(analysis.audioMetrics.clarityScore),
        emotionSummary: calculateEmotionSummary(
          analysis.videoMetrics.emotionAnalysis,
        ),
      };

      res.json({
        success: true,
        data: liveMetrics,
      });
    } catch (error: any) {
      logger.error("Get analysis summary error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get analysis summary",
        message: error.message,
      });
    }
  }),
);

// Helper function to calculate emotion summary
function calculateEmotionSummary(emotionAnalysis: any[]): any {
  if (!emotionAnalysis || emotionAnalysis.length === 0) {
    return {
      dominant: "neutral",
      confidence: 0,
      distribution: {},
    };
  }

  const emotionCounts: any = {};
  let totalFrames = emotionAnalysis.length;

  emotionAnalysis.forEach((frame: any) => {
    const emotions = frame.emotions || {};
    Object.keys(emotions).forEach((emotion) => {
      emotionCounts[emotion] =
        (emotionCounts[emotion] || 0) + emotions[emotion];
    });
  });

  // Find dominant emotion
  let dominantEmotion = "neutral";
  let maxScore = 0;
  Object.keys(emotionCounts).forEach((emotion) => {
    const avgScore = emotionCounts[emotion] / totalFrames;
    if (avgScore > maxScore) {
      maxScore = avgScore;
      dominantEmotion = emotion;
    }
  });

  // Calculate distribution
  const distribution: any = {};
  Object.keys(emotionCounts).forEach((emotion) => {
    distribution[emotion] = Math.round(
      (emotionCounts[emotion] / totalFrames) * 100,
    );
  });

  return {
    dominant: dominantEmotion,
    confidence: Math.round(maxScore * 100),
    distribution,
  };
}

export default router;
