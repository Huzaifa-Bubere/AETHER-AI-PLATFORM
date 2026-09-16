import Resume from '../../models/Resume';
import { ICandidateContext, InterviewType, DifficultyMode } from '../types';
import logger from '../../utils/logger';

export class ContextBuilder {
  /**
   * Build candidate context incorporating stored resume data if available.
   */
  async buildContext(params: {
    userId: string;
    role: string;
    experienceLevel: string;
    interviewType: InterviewType;
    difficultyMode: DifficultyMode;
    company?: string;
    language?: string;
    resumeId?: string;
    jobDescription?: string;
    jobRequirements?: string[];
  }): Promise<ICandidateContext> {
    const { userId, role, experienceLevel, interviewType, difficultyMode, company, language, resumeId, jobDescription, jobRequirements } = params;

    let resumeDoc = null;
    try {
      if (resumeId) {
        resumeDoc = await Resume.findOne({ _id: resumeId, userId });
      } else {
        resumeDoc = await Resume.findOne({ userId }).sort({ createdAt: -1 });
      }
    } catch (err) {
      logger.warn('Error fetching resume for interview context:', err);
    }

    let resumeContext: ICandidateContext['resumeContext'] = undefined;

    if (resumeDoc) {
      const skills = Array.isArray(resumeDoc.analysis?.skills) ? resumeDoc.analysis.skills : [];
      const experienceYears = typeof resumeDoc.analysis?.experience === 'number' ? resumeDoc.analysis.experience : undefined;
      const education = Array.isArray(resumeDoc.analysis?.education)
        ? resumeDoc.analysis.education.map((e: any) => `${e.degree || ''} at ${e.institution || ''}`).filter(Boolean)
        : [];

      // Extract projects from parsedData if available
      const parsedProjects = resumeDoc.metadata?.parsedData?.projects || [];
      const projects = Array.isArray(parsedProjects)
        ? parsedProjects.map((p: any) => ({
            name: p.title || p.name || 'Project',
            description: p.description || '',
            technologies: Array.isArray(p.technologies) ? p.technologies : [],
          }))
        : [];

      resumeContext = {
        summary: resumeDoc.analysis?.summary || '',
        skills: skills.slice(0, 25),
        experienceYears,
        education,
        projects: projects.slice(0, 5),
      };
    }

    return {
      userId,
      role: role.trim(),
      experienceLevel: experienceLevel || 'Junior',
      interviewType: interviewType || 'technical',
      difficultyMode: difficultyMode || 'adaptive',
      company: company?.trim(),
      language: language || 'English',
      resumeContext,
      jobDescription: jobDescription?.trim(),
      jobRequirements: jobRequirements || [],
    };
  }

  /**
   * Determine initial sequence of topics based on role and interview type.
   */
  getInitialTopics(context: ICandidateContext): string[] {
    const role = context.role.toLowerCase();
    const type = context.interviewType;

    if (type === 'behavioral') {
      return [
        'Teamwork & Collaboration',
        'Conflict Resolution',
        'Handling Ambiguity & Failure',
        'Leadership & Initiative',
        'Career Goals & Culture Fit',
      ];
    }

    if (type === 'system-design') {
      return [
        'Requirements & Estimation',
        'High-Level Architecture',
        'Data Modeling & Storage',
        'Scalability & Caching',
        'Resilience & Trade-offs',
      ];
    }

    if (type === 'hr') {
      return [
        'Background & Career Journey',
        'Work Ethics & Motivation',
        'Work-Life Balance & Pressure',
        'Company Alignment & Expectations',
      ];
    }

    // Technical / Mixed / Skill-based: tailor to role
    if (role.includes('frontend')) {
      return ['JavaScript & TypeScript Fundamentals', 'React Architecture & State Management', 'Browser Performance & DOM', 'Web APIs & CSS', 'Frontend Security'];
    }
    if (role.includes('backend')) {
      return ['RESTful APIs & Microservices', 'Database Schema & Indexing', 'Authentication & Security', 'Caching & Concurrency', 'System Reliability'];
    }
    if (role.includes('full') || role.includes('stack')) {
      return ['Web Architecture & APIs', 'Frontend Frameworks & UI', 'Databases & Query Optimization', 'Authentication & State', 'Deployment & CI/CD'];
    }
    if (role.includes('data') || role.includes('ml') || role.includes('machine')) {
      return ['Data Pipelines & Cleaning', 'Machine Learning Models & Evaluation', 'Feature Engineering', 'Model Deployment & Monitoring', 'SQL & Big Data Tools'];
    }
    if (role.includes('devops') || role.includes('cloud')) {
      return ['Containers & Docker', 'Kubernetes Orchestration', 'CI/CD Pipelines', 'Cloud Infrastructure & AWS/GCP', 'Observability & Monitoring'];
    }
    if (role.includes('product')) {
      return ['Product Vision & Metrics', 'User Research & MVP Definition', 'Prioritization Frameworks', 'Stakeholder Management', 'Go-To-Market Execution'];
    }

    // Default Software Engineer
    return ['Data Structures & Algorithms', 'API Design & Backend Services', 'Database Design & Queries', 'Concurrency & Performance', 'Software Architecture'];
  }
}

export const contextBuilder = new ContextBuilder();
