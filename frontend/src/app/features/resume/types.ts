/**
 * AETHER Resume Builder — document model (spec §16, §17, §22).
 *
 * This is the shape stored in the database (`ResumeVersion.data`) and rendered
 * to a real text-based PDF. Everything here is plain text so the exported PDF
 * stays parsable by ATS software — no images, no icons, no charts.
 */

export interface ResumeLanguage { name: string; level: string }
export interface ResumeCustomSection { title: string; items: string[] }

export interface ResumeExperience {
  title: string;
  company: string;
  location?: string;
  duration?: string;
  startDate?: string;
  endDate?: string;
  /** optional one-line role description (kept for ATS engine compatibility) */
  description?: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  description?: string;
  technologies?: string[];
  link?: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  location?: string;
  year?: string;
  score?: string;
}

export interface ResumeDocument {
  name: string;
  /** professional title / headline */
  title: string;
  email: string;
  phone: string;
  location: string;
  links: string[];
  summary: string;
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  skills: string[];
  certifications: string[];
  achievements: string[];
  languages: ResumeLanguage[];
  customSections: ResumeCustomSection[];
  /** order of standard section keys; anything omitted falls back to the template default */
  sectionOrder: SectionKey[];
  pageSize: 'A4' | 'LETTER';
  typography: { fontFamily: 'Helvetica' | 'Times-Roman'; fontSize: number; lineHeight: number; margin: number };
  targetJobDescription: string;
}

export type SectionKey =
  | 'summary' | 'experience' | 'projects' | 'education'
  | 'skills' | 'certifications' | 'achievements' | 'languages' | 'custom';

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: 'Professional Summary',
  experience: 'Experience',
  projects: 'Projects',
  education: 'Education',
  skills: 'Skills',
  certifications: 'Certifications',
  achievements: 'Achievements',
  languages: 'Languages',
  custom: 'Additional Sections',
};

export const DEFAULT_SECTION_ORDER: SectionKey[] = [
  'summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'languages', 'custom',
];

export type TemplateId =
  | 'ats-classic' | 'graduate-fresher' | 'minimal-professional'
  | 'technical-professional' | 'modern-professional';

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  desc: string;
  /** default section order for this template (spec §19) */
  defaultOrder: SectionKey[];
  /** shown as "recommended" in the picker */
  recommended?: boolean;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'ats-classic',
    label: 'AETHER ATS Classic',
    desc: 'Single column, standard headings, real selectable text — the safest layout for parsers.',
    defaultOrder: DEFAULT_SECTION_ORDER,
    recommended: true,
  },
  {
    id: 'graduate-fresher',
    label: 'Graduate / Fresher',
    desc: 'Education and projects first — for candidates without work experience.',
    defaultOrder: ['summary', 'education', 'projects', 'skills', 'experience', 'certifications', 'achievements', 'languages', 'custom'],
  },
  {
    id: 'minimal-professional',
    label: 'Minimal Professional',
    desc: 'Whitespace-heavy, quiet headings, no rules. Still single column text.',
    defaultOrder: ['summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'achievements', 'languages', 'custom'],
  },
  {
    id: 'technical-professional',
    label: 'Technical Professional',
    desc: 'Skills-forward layout with compact technology lines for engineering roles.',
    defaultOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'languages', 'custom'],
  },
  {
    id: 'modern-professional',
    label: 'Modern Professional',
    desc: 'Left-aligned name with an accent rule under section headings. Text-only, ATS-safe.',
    defaultOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'languages', 'custom'],
  },
];

export function templateMeta(id: string): TemplateMeta {
  return TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
}

export function emptyResume(): ResumeDocument {
  return {
    name: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    summary: '',
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certifications: [],
    achievements: [],
    languages: [],
    customSections: [],
    sectionOrder: DEFAULT_SECTION_ORDER,
    pageSize: 'A4',
    typography: { fontFamily: 'Helvetica', fontSize: 9.5, lineHeight: 1.35, margin: 40 },
    targetJobDescription: '',
  };
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const strArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];

/**
 * Merge a stored (possibly older/partial) document onto the current shape.
 *
 * This is the single data boundary for the Resume Builder (spec §5A): every
 * loaded document passes through here BEFORE React renders it, so components
 * never have to guard `doc.x.length` against legacy records that predate a
 * field. Strings are coerced too — a key present-but-undefined must not crash
 * `.trim()` either.
 */
export function normalizeResume(raw: Partial<ResumeDocument> | null | undefined): ResumeDocument {
  const base = emptyResume();
  if (!raw || typeof raw !== 'object') return base;

  const experience = Array.isArray(raw.experience)
    ? raw.experience.filter(Boolean).map(e => ({
        title: str((e as ResumeExperience)?.title),
        company: str((e as ResumeExperience)?.company),
        location: str((e as ResumeExperience)?.location),
        duration: str((e as ResumeExperience)?.duration),
        startDate: str((e as ResumeExperience)?.startDate),
        endDate: str((e as ResumeExperience)?.endDate),
        description: str((e as ResumeExperience)?.description),
        bullets: strArray((e as ResumeExperience)?.bullets),
      }))
    : [];

  const projects = Array.isArray(raw.projects)
    ? raw.projects.filter(Boolean).map(p => ({
        name: str((p as ResumeProject)?.name),
        description: str((p as ResumeProject)?.description),
        technologies: strArray((p as ResumeProject)?.technologies),
        link: str((p as ResumeProject)?.link),
        bullets: strArray((p as ResumeProject)?.bullets),
      }))
    : [];

  const education = Array.isArray(raw.education)
    ? raw.education.filter(Boolean).map(e => ({
        degree: str((e as ResumeEducation)?.degree),
        institution: str((e as ResumeEducation)?.institution),
        location: str((e as ResumeEducation)?.location),
        year: str((e as ResumeEducation)?.year),
        score: str((e as ResumeEducation)?.score),
      }))
    : [];

  const languages = Array.isArray(raw.languages)
    ? raw.languages.filter(Boolean).map(l => ({ name: str(l?.name), level: str(l?.level, 'Fluent') }))
    : [];

  const customSections = Array.isArray(raw.customSections)
    ? raw.customSections.filter(Boolean).map(s => ({ title: str(s?.title), items: strArray(s?.items) }))
    : [];

  return {
    ...base,
    name: str(raw.name),
    title: str(raw.title ?? (raw as any).headline),
    email: str(raw.email),
    phone: str(raw.phone),
    location: str(raw.location),
    summary: str(raw.summary),
    targetJobDescription: str(raw.targetJobDescription),
    links: strArray(raw.links),
    skills: strArray(raw.skills),
    certifications: strArray(raw.certifications),
    achievements: strArray(raw.achievements),
    languages,
    customSections,
    experience,
    projects,
    education,
    sectionOrder: orderFromKeys(raw.sectionOrder),
    pageSize: raw.pageSize === 'LETTER' ? 'LETTER' : 'A4',
    typography: { ...base.typography, ...(raw.typography || {}) },
  };
}

/** Canonical name used by callers that want the boundary to be explicit. */
export const normalizeResumeDocument = normalizeResume;

function orderFromKeys(keys: unknown): SectionKey[] {
  const valid = (Array.isArray(keys) ? keys : []).filter(
    (k): k is SectionKey => DEFAULT_SECTION_ORDER.includes(k as SectionKey),
  );
  // keep every known key, keeping the stored order first and appending the rest
  return [...valid, ...DEFAULT_SECTION_ORDER.filter(k => !valid.includes(k))];
}

/**
 * Dynamic PDF filename (spec §22): "Huzaifa_Bubere_Software_Engineer_Resume.pdf".
 * Falls back gracefully when the name or title is missing.
 */
export function buildResumeFilename(name: string, title: string): string {
  const part = (value: string) => String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '_');
  const segments = [part(name), part(title), 'Resume'].filter(Boolean);
  if (segments.length === 1) segments.unshift('AETHER');
  return `${segments.join('_')}.pdf`;
}

/** Human label used in the preview + PDF header. */
export function resumeHeadline(doc: ResumeDocument): string {
  return doc.title?.trim() || '';
}
