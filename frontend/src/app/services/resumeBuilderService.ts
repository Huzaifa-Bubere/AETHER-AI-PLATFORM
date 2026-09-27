import { apiService } from './api';
import type { ResumeDocument as IResumeData } from '../features/resume/types';

/**
 * AETHER Resume Builder client (spec §54–64).
 *
 * `IResumeData` is the builder document model — see features/resume/types.ts.
 */
export type { IResumeData };


export interface IAtsCategory {
  key: string; label: string; weight: number; score: number; weightedPoints: number; findings: string[];
}
export interface IAtsResult {
  totalScore: number;
  grade: string;
  categories: IAtsCategory[];
  bulletFindings: Array<{ bullet: string; issues: string[]; suggestion?: string }>;
  wordCount: number;
  readabilityScore: number;
}
export interface IJdMatch {
  matchedKeywords: string[]; missingKeywords: string[];
  matchedSkills: string[]; missingSkills: string[];
  matchScore: number; honestyNote: string;
}
export interface IVersionSummary {
  _id: string; name: string; template: string; targetRoleSlug?: string;
  isDefault?: boolean;
  data: IResumeData; atsScore?: number | null;
  atsSnapshot?: { score: number; grade: string; computedAt: string } | null;
  updatedAt: string;
}

function unwrap<T>(res: any): T {
  if (res?.success === false) throw new Error(res.error || res.message || 'Request failed');
  return (res?.data ?? res) as T;
}

class ResumeBuilderService {
  async analyze(data: IResumeData, jobDescription?: string, targetRole?: string): Promise<{ ats: IAtsResult; jdMatch: IJdMatch | null }> {
    const res = await apiService.post('/resume/ats/analyze', { data, jobDescription, targetRole }, { timeout: 30000 });
    return unwrap(res);
  }

  async listVersions(): Promise<IVersionSummary[]> {
    const res = await apiService.get('/resume/versions');
    return unwrap<{ versions: IVersionSummary[] }>(res).versions || [];
  }

  async getVersion(id: string): Promise<IVersionSummary> {
    const res = await apiService.get(`/resume/versions/${id}`);
    return unwrap<{ version: IVersionSummary }>(res).version;
  }

  async createVersion(payload: { name: string; data: IResumeData; template: string; targetRoleSlug?: string; isDefault?: boolean }): Promise<IVersionSummary> {
    const res = await apiService.post('/resume/versions', payload);
    return unwrap<{ version: IVersionSummary }>(res).version;
  }

  async updateVersion(id: string, payload: { name?: string; data: IResumeData; template?: string; targetRoleSlug?: string; isDefault?: boolean }): Promise<IVersionSummary & { ats?: IAtsResult }> {
    const res = await apiService.put(`/resume/versions/${id}`, payload);
    return unwrap<{ version: IVersionSummary; ats: IAtsResult }>(res) as any;
  }

  async setDefaultVersion(id: string): Promise<void> {
    await apiService.post(`/resume/versions/${id}/default`, {});
  }

  async deleteVersion(id: string): Promise<void> {
    await apiService.delete(`/resume/versions/${id}`);
  }

  async createFromUpload(payload: { name?: string; targetRoleSlug?: string }): Promise<IVersionSummary> {
    const res = await apiService.post('/resume/versions/from-uploaded', payload, { timeout: 60000 });
    return unwrap<{ version: IVersionSummary }>(res).version;
  }
}

export const builderService = new ResumeBuilderService();
