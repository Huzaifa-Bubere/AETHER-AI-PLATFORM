import { apiService } from './api';

/**
 * AETHER Career Learning — course client (spec §44–53).
 */

export interface LessonWithState {
  id: string; title: string; estimatedMinutes: number; order: number; state: string;
}
export interface ModuleSummary {
  id: string; title: string; description: string; order: number;
  lessonCount: number; estimatedMinutes: number; hasQuiz: boolean;
  quizScore: number | null; hasProject: boolean; completedLessons: number;
  lessons: LessonWithState[];
}
export interface CourseDetail {
  course: {
    title: string; slug: string; description: string; difficulty: string;
    estimatedHours: number; roleSlugs: string[]; skillSlugs: string[]; prerequisites: string[];
  };
  modules: ModuleSummary[];
  progress: {
    totalLessons: number; completedLessons: number; percentage: number;
    quizAverage: number | null; projectsCompleted: number; estimatedRemainingMinutes: number;
  };
}
export interface CourseRecommendation {
  courseSlug: string; title: string; description: string; difficulty: string;
  estimatedHours: number; gapSkillSlugs: string[]; prereqsComplete: boolean;
  missingPrereqTitles: string[]; reasons: string[]; priorityScore: number;
}

class CourseService {
  async getCourse(slug: string): Promise<CourseDetail> {
    const res = await apiService.get(`/careers/courses/${slug}`);
    if (!res.success) throw new Error(res.error || 'Failed to load course');
    return res.data as CourseDetail;
  }

  async getLesson(slug: string, moduleId: string, lessonId: string) {
    const res = await apiService.get(`/careers/courses/${slug}/modules/${moduleId}/lessons/${lessonId}`);
    if (!res.success) throw new Error(res.error || 'Failed to load lesson');
    return res.data as { module: { id: string; title: string }; lesson: any; state: string; siblings: any[] };
  }

  async setLessonProgress(slug: string, lessonId: string, state: string) {
    const res = await apiService.put(`/careers/courses/${slug}/lessons/${lessonId}/progress`, { state });
    if (!res.success) throw new Error(res.error || 'Failed to update progress');
    return res.data as { lessonId: string; state: string; progressPercentage: number };
  }

  async getQuiz(slug: string, moduleId: string) {
    const res = await apiService.get(`/careers/courses/${slug}/modules/${moduleId}/quiz`);
    if (!res.success) throw new Error(res.error || 'No quiz available');
    return res.data as { questions: Array<{ id: string; question: string; options: string[] }> };
  }

  async submitQuiz(slug: string, moduleId: string, answers: number[]) {
    const res = await apiService.post(`/careers/courses/${slug}/modules/${moduleId}/quiz`, { answers });
    if (!res.success) throw new Error(res.error || 'Quiz failed');
    return res.data as { score: number; results: Array<{ correct: boolean; correctIndex: number; explanation: string }> };
  }

  async completeProject(slug: string, moduleId: string) {
    const res = await apiService.post(`/careers/courses/${slug}/modules/${moduleId}/project`);
    if (!res.success) throw new Error(res.error || 'Failed to update project');
    return res.data;
  }

  async getRecommendations(): Promise<{ roleSlug: string | null; recommendations: CourseRecommendation[]; note: string }> {
    const res = await apiService.get('/careers/me/learning-recommendations');
    if (!res.success) throw new Error(res.error || 'Failed to load recommendations');
    return res.data as { roleSlug: string | null; recommendations: CourseRecommendation[]; note: string };
  }

  async ask(slug: string, question: string, lessonId?: string) {
    const res = await apiService.post(`/careers/courses/${slug}/ask`, { question, lessonId }, { timeout: 60000 });
    if (!res.success) throw new Error(res.error || 'AI tutor unavailable');
    return res.data as { answer: string; groundedIn: string; cached: boolean; aiAvailable: boolean };
  }
}

export const courseService = new CourseService();
