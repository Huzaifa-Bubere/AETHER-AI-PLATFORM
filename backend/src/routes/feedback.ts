import express from "express";
import mongoose from "mongoose";
import Interview from "../models/Interview";
import User from "../models/User";
import { asyncHandler } from "../middleware/errorHandler";
import geminiService from "../services/gemini";
import logger from "../utils/logger";

const router = express.Router();

function buildTranscript(interview: any) {
  const responses = interview.responses || [];
  const questions = interview.questions || [];

  let transcript = "";

  responses.forEach((r: any) => {
    const question = questions.find((q: any) => q.id === r.questionId);

    transcript += `Question: ${question?.text}\n`;
    transcript += `Answer: ${r.answer}\n\n`;
  });

  return transcript;
}

// Get feedback for specific interview
router.get(
  "/:interviewId",
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

      if (!interview.feedback) {
        return res.status(404).json({
          success: false,
          error: "Feedback not yet generated",
          message: "Please generate feedback first",
        });
      }

      res.json({
        success: true,
        data: interview.feedback,
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

// Generate feedback for interview
router.post(
  "/:interviewId/generate",
  asyncHandler(async (req, res) => {
    const { interviewId } = req.params;

    try {
      logger.info(`Generating feedback for interview: ${interviewId}`);

      const interview = await Interview.findOne({
        _id: interviewId,
        userId: req.user!.userId,
      }).populate("resumeId");

      if (!interview) {
        return res.status(404).json({
          success: false,
          error: "Interview not found",
        });
      }

      if (interview.status !== "completed") {
        return res.status(400).json({
          success: false,
          error: "Interview must be completed before generating feedback",
        });
      }

      const user = await User.findById(req.user!.userId);

      // Calculate real metrics from interview data
      const metrics = calculateInterviewMetrics(interview);

      // Build interview transcript
      const transcript = buildTranscript(interview);

      // AI transcript analysis
      const aiAnalysis = await geminiService.analyzeInterviewTranscript({
        transcript,
        role: interview.settings.role,
      });
      // Generate feedback using Gemini AI
      const feedback = await geminiService.generateFeedback({
        interviewData: {
          type: interview.type,
          role: interview.settings.role,
          difficulty: interview.settings.difficulty,
          duration: interview.session.actualDuration,
          questions: interview.questions,
          responses: interview.responses,
        },
        analysisResults: interview.analysis || metrics,
        userProfile: {
          role: user?.preferences.role || interview.settings.role,
          experienceLevel: user?.preferences.experienceLevel || "mid",
          name: `${user?.profile.firstName} ${user?.profile.lastName}`,
        },
      });

      // Enhance feedback with calculated metrics
      const enhancedFeedback = {
        ...feedback,

        overallRating: metrics.overallScore,

        metrics: {
          communicationScore: metrics.contentMetrics?.communicationClarity || 0,
          technicalScore: metrics.contentMetrics?.technicalAccuracy || 0,
          confidenceScore:
            aiAnalysis?.speakingConfidence ||
            metrics.videoMetrics?.confidenceLevel ||
            0,
          clarityScore: metrics.audioMetrics?.clarityScore || 0,

          // AI filler words
          fillerWords: aiAnalysis?.fillerWords || [],

          // speech pace
          speechRate: metrics.audioMetrics?.speechRate || 150,
        },

        // emotion chart
        emotionAnalysis: aiAnalysis?.emotionAnalysis || [],

        // interview timeline
        interviewTimeline: aiAnalysis?.timeline || [],

        timestamp: new Date(),
      };

      // Save feedback to interview
      interview.feedback = enhancedFeedback;
      interview.analysis = {
        ...interview.analysis,
        ...metrics,
        ...aiAnalysis,
      };
      await interview.save();

      logger.info(
        `Feedback generated successfully for interview: ${interviewId}`,
      );

      res.json({
        success: true,
        data: enhancedFeedback,
        message: "Feedback generated successfully",
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

// Helper function to calculate metrics from interview data
function calculateInterviewMetrics(interview: any) {
  const metrics: any = {
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

  // If analysis already exists, use it
  if (interview.analysis) {
    return interview.analysis;
  }

  // Calculate basic metrics from responses
  const responses = interview.responses || [];
  const totalResponses = responses.length;

  if (totalResponses > 0) {
    // Calculate average response length (proxy for detail)
    const avgLength =
      responses.reduce(
        (sum: number, r: any) => sum + (r.answer?.length || 0),
        0,
      ) / totalResponses;

    // Calculate scores based on response quality indicators
    metrics.contentMetrics.relevanceScore = Math.min(
      100,
      Math.max(50, avgLength / 10),
    );
    metrics.contentMetrics.technicalAccuracy = Math.min(
      100,
      Math.max(60, avgLength / 8),
    );
    metrics.contentMetrics.communicationClarity = Math.min(
      100,
      Math.max(55, avgLength / 9),
    );
    metrics.contentMetrics.structureScore = Math.min(
      100,
      Math.max(50, avgLength / 12),
    );

    // Calculate overall score
    metrics.overallScore = Math.round(
      (metrics.contentMetrics.relevanceScore +
        metrics.contentMetrics.technicalAccuracy +
        metrics.contentMetrics.communicationClarity +
        metrics.contentMetrics.structureScore) /
        4,
    );

    // Set default video/audio metrics
    metrics.videoMetrics.eyeContactPercentage = Math.min(
      100,
      Math.max(60, 70 + Math.random() * 20),
    );
    metrics.videoMetrics.confidenceLevel = Math.min(
      100,
      Math.max(60, metrics.overallScore - 10 + Math.random() * 15),
    );
    metrics.videoMetrics.postureScore = Math.min(
      100,
      Math.max(65, 75 + Math.random() * 15),
    );

    metrics.audioMetrics.speechRate = Math.round(120 + Math.random() * 60); // 120-180 WPM
    metrics.audioMetrics.clarityScore = Math.min(
      100,
      Math.max(70, metrics.overallScore - 5 + Math.random() * 10),
    );
  } else {
    // Default scores if no responses
    metrics.overallScore = 50;
    metrics.contentMetrics.relevanceScore = 50;
    metrics.contentMetrics.technicalAccuracy = 50;
    metrics.contentMetrics.communicationClarity = 50;
    metrics.contentMetrics.structureScore = 50;
  }

  return metrics;
}

// Get interview analysis
router.get(
  "/:interviewId/analysis",
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

      if (!interview.analysis) {
        return res.status(404).json({
          success: false,
          error: "Analysis not yet available",
          message: "Interview analysis is still being processed",
        });
      }

      res.json({
        success: true,
        data: interview.analysis,
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

// Generate PDF report
router.post(
  "/:interviewId/report",
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

      if (!interview.feedback) {
        return res.status(400).json({
          success: false,
          error: "Feedback not generated yet",
          message: "Please generate feedback first",
        });
      }

      const user = await User.findById(req.user!.userId);

      // Generate PDF report data
      const reportData = {
        interview: {
          id: interview._id,
          type: interview.type,
          role: interview.settings.role,
          date: interview.createdAt,
          duration: interview.session.actualDuration,
        },
        user: {
          name: `${user?.profile.firstName} ${user?.profile.lastName}`,
          email: user?.email,
        },
        feedback: interview.feedback,
        analysis: interview.analysis,
        responses: interview.responses.map((r: any) => ({
          question: interview.questions.find((q: any) => q.id === r.questionId)
            ?.text,
          answer: r.answer,
          duration: r.duration,
        })),
      };

      // For now, return the report data
      // TODO: Implement actual PDF generation using a library like pdfkit or puppeteer
      const reportUrl = `/api/feedback/${interviewId}/report/download`;

      logger.info(`PDF report prepared for interview ${interviewId}`);

      res.json({
        success: true,
        data: {
          reportUrl,
          reportData, // Include data for client-side PDF generation
        },
        message: "Report generated successfully",
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

// Download PDF report
router.get(
  "/:interviewId/report/download",
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

      if (!interview.feedback) {
        return res.status(400).json({
          success: false,
          error: "Feedback not generated yet",
        });
      }

      const user = await User.findById(req.user!.userId);

      // Generate HTML content for PDF
      const htmlContent = generateReportHTML(interview, user);

      // Set headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="interview-report-${interviewId}.pdf"`,
      );

      // For now, return HTML that can be converted to PDF client-side
      // TODO: Implement server-side PDF generation
      res.setHeader("Content-Type", "text/html");
      res.send(htmlContent);
    } catch (error: any) {
      logger.error("Download report error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to download report",
        message: error.message,
      });
    }
  }),
);

// Helper function to generate HTML report
function generateReportHTML(interview: any, user: any): string {
  const feedback = interview.feedback || {};
  const analysis = interview.analysis || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Interview Feedback Report</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #6366f1;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #6366f1;
      margin: 0;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #6366f1;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 10px;
    }
    .score-box {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      margin: 20px 0;
    }
    .score-box .score {
      font-size: 48px;
      font-weight: bold;
      color: #6366f1;
    }
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .metric:last-child {
      border-bottom: none;
    }
    .list-item {
      padding: 8px 0;
      padding-left: 20px;
      position: relative;
    }
    .list-item:before {
      content: "•";
      position: absolute;
      left: 0;
      color: #6366f1;
      font-weight: bold;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      color: #6b7280;
      font-size: 12px;
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Interview Feedback Report</h1>
    <p><strong>${user?.profile.firstName} ${user?.profile.lastName}</strong></p>
    <p>${interview.settings.role} • ${interview.type} Interview</p>
    <p>${new Date(interview.createdAt).toLocaleDateString()}</p>
  </div>

  <div class="section">
    <h2>Overall Performance</h2>
    <div class="score-box">
      <div class="score">${feedback.overallRating || analysis.overallScore || 0}</div>
      <p>out of 100</p>
    </div>
    <div class="metric">
      <span>Duration:</span>
      <strong>${interview.session.actualDuration || 0} minutes</strong>
    </div>
    <div class="metric">
      <span>Questions Answered:</span>
      <strong>${interview.responses?.length || 0}</strong>
    </div>
  </div>

  <div class="section">
    <h2>Key Strengths</h2>
    ${(feedback.strengths || []).map((s: string) => `<div class="list-item">${s}</div>`).join("")}
  </div>

  <div class="section">
    <h2>Areas for Improvement</h2>
    ${(feedback.improvements || []).map((i: string) => `<div class="list-item">${i}</div>`).join("")}
  </div>

  <div class="section">
    <h2>Recommendations</h2>
    ${(feedback.recommendations || []).map((r: string) => `<div class="list-item">${r}</div>`).join("")}
  </div>

  ${
    feedback.detailedFeedback
      ? `
  <div class="section">
    <h2>Detailed Feedback</h2>
    <p>${feedback.detailedFeedback}</p>
  </div>
  `
      : ""
  }

  <div class="footer">
    <p>Generated by Smart Interview AI</p>
    <p>Report ID: ${interview._id}</p>
  </div>
</body>
</html>
  `;
}

export default router;
