import apiService from './api';

export type SkillPriority = 'ESSENTIAL' | 'RECOMMENDED' | 'OPTIONAL';
export type NodeState = 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

export interface RoleSkill {
  skillSlug: string; name: string; priority: SkillPriority; skillType: string; stageId?: string;
}

export interface RoleListItem {
  slug: string; name: string; description: string; category: string;
  skillsCount: number; stagesCount: number; projectsCount: number;
  readiness: number; isGoal: boolean;
  market: { region: string; updated: string; postings: number } | null;
}

export interface CareerRoleDetail {
  slug: string; name: string; description: string; category: string;
  responsibilities: string[];
  skills: RoleSkill[];
  tools: string[]; frameworks: string[]; databases: string[]; cloudTechnologies: string[]; softSkills: string[];
  roadmapStages: Array<{ id: string; title: string; description?: string; order: number; nodeIds: string[] }>;
  roadmapNodes: RoadmapNodeFull[];
  resources: LearningResource[];
  projects: ProjectSuggestion[];
  experienceExpectations?: string;
  portfolioExpectations?: string;
}

export interface RoadmapNodeFull {
  id: string; title: string; description?: string; whyItMatters?: string;
  whatYouWillLearn: string[]; keyConcepts: string[]; skillSlugs: string[];
  prerequisites: string[]; estimatedHours?: number; resourceIds: string[];
  interviewQuestions: string[];
  project?: { title: string; description: string; deliverables: string[] };
  hasQuiz?: boolean;
}

export interface LearningResource {
  id: string; title: string; type: string; provider: string; url: string;
  difficulty?: string; estimatedTime?: string;
}

export interface ProjectSuggestion {
  title: string; difficulty: string; estimatedDuration: string; description: string;
  deliverables: string[]; skillSlugs: string[];
}

export interface RoadmapView {
  roleSlug: string; roleName: string;
  stages: Array<{ id: string; title: string; description?: string; order: number; nodeIds: string[] }>;
  nodes: Array<{
    id: string; title: string; description?: string; state: NodeState;
    prerequisites: string[]; skillSlugs: string[]; estimatedHours?: number;
    quizCount: number; hasProject: boolean; resourceCount: number;
  }>;
  progressSummary: { total: number; completed: number; inProgress: number; percentage: number };
  currentStageId?: string;
}

export interface TopicDetail {
  node: RoadmapNodeFull & { quiz?: unknown; hasQuiz: boolean };
  resources: LearningResource[];
  prerequisites: Array<{ id: string; title: string }>;
  state: NodeState;
  quizScores: number[];
}

export interface GapItem {
  skillSlug: string; name: string; priority: SkillPriority; priorityWeight: number;
  confidence: number; gapSize: number;
  demand?: { frequency?: number; trend?: string };
  priorityScore: number; reasons: string[];
  hasRoadmapNode: boolean; nodeId?: string;
}

export interface ReadinessData {
  roleSlug: string; roleName: string;
  readiness: number; skillsMatched: number; skillsTotal: number;
  essentialMatched: number; essentialTotal: number;
  gaps: GapItem[];
  matched: Array<{ skillSlug: string; name: string; confidence: number; priority: SkillPriority }>;
  snapshot: { region: string; periodStart: string; periodEnd: string; totalPostings: number; source: string } | null;
}

export interface SkillStat {
  skill: string; count: number; percentage: number;
  previousPercentage?: number; trend: string;
}

export interface MarketSnapshot {
  role: string; region: string; periodStart: string; periodEnd: string;
  totalPostings: number;
  topSkills: SkillStat[];
  topTools: string[]; topFrameworks: string[]; topDatabases: string[]; topCloud: string[];
  skillPairs: Array<{ skills: string[]; count: number; percentage: number }>;
  experienceDistribution: Record<string, number>;
  sourceMetadata: { sourceName: string; sourceType: string };
  generatedAt: string;
}

export interface WeeklyPlan {
  hoursPerWeek: number;
  weeks: number;
  plan: Array<{ week: number; nodeIds: string[]; title: string; estimatedHours: number }>;
}

function unwrap<T>(res: unknown): T {
  const r = res as { success?: boolean; data?: T; message?: string };
  if (r && r.success === false) throw new Error(r.message || 'Request failed');
  if (r && r.data !== undefined) return r.data as T;
  return r as T;
}

const api = {
  async listRoles(search?: string, category?: string) {
    const res = await apiService.get<{ roles: RoleListItem[]; categories: string[]; goal: { roleSlug: string; hoursPerWeek: number; experienceLevel: string; targetTimelineWeeks?: number } | null }>(
      '/careers',
      { ...(search ? { search } : {}), ...(category ? { category } : {}) },
    );
    return unwrap<any>(res);
  },

  async getRole(slug: string) {
    const res = await apiService.get<{ role: CareerRoleDetail; goal: any; progress: any; snapshot: MarketSnapshot | null }>(`/careers/${slug}`);
    return unwrap<any>(res);
  },

  async getRoadmap(slug: string) {
    const res = await apiService.get<RoadmapView>(`/careers/${slug}/roadmap`);
    return unwrap<any>(res);
  },

  async getTopic(slug: string, nodeId: string) {
    const res = await apiService.get<TopicDetail>(`/careers/${slug}/nodes/${nodeId}`);
    return unwrap<any>(res);
  },

  async getQuiz(slug: string, nodeId: string) {
    const res = await apiService.get<{ questions: Array<{ question: string; options: string[] }> }>(`/careers/${slug}/nodes/${nodeId}/quiz`);
    return unwrap<any>(res);
  },

  async submitQuiz(slug: string, nodeId: string, answers: number[]) {
    const res = await apiService.post<{ score: number; results: Array<{ correct: boolean; correctIndex: number; explanation?: string }> }>(
      `/careers/${slug}/nodes/${nodeId}/quiz`, { answers });
    return unwrap<any>(res);
  },

  async setGoal(payload: { roleSlug: string; hoursPerWeek?: number; experienceLevel?: string; targetTimelineWeeks?: number }) {
    const res = await apiService.post<any>('/careers/goal', payload);
    return unwrap<any>(res);
  },

  async getReadiness(role?: string) {
    const res = await apiService.get<ReadinessData | null>('/careers/me/readiness', role ? { role } : undefined);
    return unwrap<any>(res);
  },

  async getGaps() {
    const res = await apiService.get<{ roleSlug: string; gaps: GapItem[] }>('/careers/me/gaps');
    return unwrap<any>(res);
  },

  async updateNodeState(role: string, node: string, state: NodeState) {
    const res = await apiService.put<{ nodeId: string; state: NodeState; progressPercentage: number }>(
      `/careers/learning/progress/${role}/${node}`, { state });
    return unwrap<any>(res);
  },

  async getPlan(slug: string, hoursPerWeek?: number) {
    const res = await apiService.get<WeeklyPlan>(`/careers/${slug}/plan`, hoursPerWeek ? { hoursPerWeek } : undefined);
    return unwrap<any>(res);
  },

  async getMarket(slug: string) {
    const res = await apiService.get<{ snapshot: MarketSnapshot; latestImport: { sourceName: string; region: string; totalRows: number; acceptedRows: number; createdAt: string } | null } | null>(`/careers/${slug}/market`);
    return unwrap<any>(res);
  },

  async explainSkill(skillName: string, roleName?: string) {
    const res = await apiService.post<{
      explanation: string; analogy: string; example: string;
      interviewConcepts: string[]; commonMistakes: string[]; nextSteps: string[]; cached: boolean;
    }>('/careers/ai/explain-skill', { skillName, roleName });
    return unwrap<any>(res);
  },

  async askAdvisor(question: string) {
    const res = await apiService.post<{ answer: string; cached: boolean }>('/careers/ai/advisor', { question });
    return unwrap<any>(res);
  },

  async declareSkills(skills: string[]) {
    const res = await apiService.post('/careers/me/declare-skills', { skills });
    return unwrap<any>(res);
  },

  // Admin
  async adminListRoles() {
    const res = await apiService.get<any[]>('/admin/careers');
    return unwrap<any>(res);
  },
  async adminImportMarket(payload: { format: 'csv' | 'json'; sourceName: string; region?: string; payload: string }) {
    const res = await apiService.post<{
      batchId: string; totalRows: number; acceptedRows: number; rejectedRows: number;
      unmappedRoles: number; rolesMapped: Record<string, number>;
      errors: Array<{ row: number; reason: string }>;
    }>('/admin/careers/market/import', payload);
    return unwrap<any>(res);
  },
  async adminProcessSnapshot(role: string, region?: string) {
    const res = await apiService.post<{ snapshotId: string; totalPostings: number }>('/admin/careers/market/process', { role, region });
    return unwrap<any>(res);
  },
  async adminSnapshots() {
    const res = await apiService.get<{ snapshots: any[]; imports: any[] }>('/admin/careers/market/snapshots');
    return unwrap<any>(res);
  },
};

export default api;
