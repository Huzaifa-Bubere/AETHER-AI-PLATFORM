/**
 * Renders the AETHER Resume Builder PDF documents to disk so the resume parser
 * roundtrip can be verified without a browser (spec §24, §69, §74).
 *
 *   cd frontend
 *   npx esbuild scripts/render-sample-resume.tsx --bundle --platform=node \
 *     --format=cjs --outfile=tmp/render-sample-resume.cjs \
 *     --external:@react-pdf/renderer
 *   node tmp/render-sample-resume.cjs
 *
 * Output: frontend/tmp/*.pdf — real text PDFs, the same code path the
 * "Download PDF" button uses.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import ResumePdf from '../src/app/features/resume/pdf/ResumePdf';
import { TEMPLATES, type ResumeDocument } from '../src/app/features/resume/types';

const SAMPLE: ResumeDocument = {
  name: 'Huzaifa Bubere',
  title: 'Software Engineer',
  email: 'huzaifa.bubere@example.com',
  phone: '+91 98200 41122',
  location: 'Mumbai, India',
  links: ['linkedin.com/in/huzaifabubere', 'github.com/huzaifabubere'],
  summary:
    'Software engineer with 2 years of experience building REST APIs and React interfaces. Cut p95 API latency by 42% with composite indexes and caching, and shipped a payments service handling 10,000 requests per day.',
  experience: [
    {
      title: 'Software Engineer',
      company: 'Acme Technologies',
      location: 'Mumbai',
      duration: 'Jul 2025 – Present',
      bullets: [
        'Built a payments REST API in Node.js and PostgreSQL serving 10,000 requests per day',
        'Reduced p95 latency 42% by adding composite indexes and a Redis cache layer',
        'Automated release checks with Jest and GitHub Actions, cutting failed deploys by 30%',
      ],
    },
    {
      title: 'Software Engineering Intern',
      company: 'Nimbus Labs',
      location: 'Pune',
      duration: 'Jan 2025 – Jun 2025',
      bullets: [
        'Implemented 18 REST endpoints for a task management product used by 400 students',
        'Wrote integration tests that raised coverage from 46% to 81%',
      ],
    },
  ],
  projects: [
    {
      name: 'AETHER Career Platform',
      link: 'github.com/huzaifabubere/aether',
      technologies: ['React', 'TypeScript', 'Node.js', 'MongoDB'],
      bullets: [
        'Built a database-backed learning platform with 16 authored topics and server-graded quizzes',
        'Added deterministic complexity feedback for coding submissions with 35 unit tests',
      ],
    },
    {
      name: 'ATS Resume Builder',
      link: 'github.com/huzaifabubere/ats-builder',
      technologies: ['React', '@react-pdf/renderer', 'Express'],
      bullets: [
        'Generated selectable-text PDF resumes from structured data with 5 ATS-safe templates',
      ],
    },
  ],
  education: [
    {
      degree: 'B.E. Computer Engineering',
      institution: 'University of Mumbai',
      location: 'Mumbai',
      year: '2025',
      score: '8.4 CGPA',
    },
  ],
  skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'PostgreSQL', 'MongoDB', 'Docker', 'REST APIs', 'Jest', 'Git'],
  certifications: ['AWS Certified Cloud Practitioner (2025)', 'MongoDB Associate Developer (2024)'],
  achievements: ['Winner — Smart India Hackathon 2025', 'Top 500 — LeetCode Weekly Contest 402'],
  languages: [
    { name: 'English', level: 'Fluent' },
    { name: 'Hindi', level: 'Native' },
    { name: 'Marathi', level: 'Native' },
  ],
  customSections: [
    { title: 'Open Source Contributions', items: ['Fixed documentation gaps in a widely used React form library'] },
  ],
  sectionOrder: ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'achievements', 'languages', 'custom'],
  pageSize: 'A4',
  typography: { fontFamily: 'Helvetica', fontSize: 9.5, lineHeight: 1.35, margin: 40 },
  targetJobDescription: '',
};

/** Deliberately long content: verifies 2–3 page flow, no clipped entries, no blank pages. */
const LONG: ResumeDocument = {
  ...SAMPLE,
  experience: Array.from({ length: 10 }).map((_, i) => ({
    title: `Software Engineer ${i + 1}`,
    company: `Company ${i + 1} Pvt Ltd`,
    location: 'Mumbai',
    duration: `202${i} – 202${i + 1}`,
    bullets: Array.from({ length: 6 }).map((__, j) =>
      `Delivered initiative ${i + 1}.${j + 1} that improved throughput by ${(j + 1) * 7}% across ${(i + 1) * 3} services`),
  })),
  projects: Array.from({ length: 8 }).map((_, i) => ({
    name: `Portfolio Project ${i + 1}`,
    link: `github.com/huzaifabubere/project-${i + 1}`,
    technologies: ['React', 'Node.js', 'PostgreSQL'],
    bullets: Array.from({ length: 3 }).map((__, j) => `Implemented feature ${j + 1} of project ${i + 1} used by ${(i + 1) * 50} users`),
  })),
};

async function main() {
  const outDir = join(__dirname, '..', 'tmp');
  mkdirSync(outDir, { recursive: true });

  const jobs: Array<{ name: string; doc: ResumeDocument; template: string }> = [
    ...TEMPLATES.map(t => ({ name: t.id, doc: SAMPLE, template: t.id })),
    { name: 'long-three-page', doc: LONG, template: 'ats-classic' },
    { name: 'ats-classic-letter', doc: { ...SAMPLE, pageSize: 'LETTER' as const }, template: 'ats-classic' },
    { name: 'times-serif', doc: { ...SAMPLE, typography: { ...SAMPLE.typography, fontFamily: 'Times-Roman' as const } }, template: 'ats-classic' },
  ];

  for (const job of jobs) {
    const buffer = await renderToBuffer(<ResumePdf doc={job.doc} template={job.template} />);
    const file = join(outDir, `sample-${job.name}.pdf`);
    writeFileSync(file, buffer);
    const signature = buffer.slice(0, 5).toString('latin1');
    if (signature !== '%PDF-') throw new Error(`${file} is not a PDF (got "${signature}")`);
    // eslint-disable-next-line no-console
    console.log(`✓ ${job.name.padEnd(22)} ${(buffer.length / 1024).toFixed(1)} KB  → ${file}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nRendered ${jobs.length} PDFs into ${dirname(join(outDir, 'x'))}/`);

  // The canonical artifact the roundtrip test consumes.
  const canonical = join(outDir, 'sample-ats-classic.pdf');
  // eslint-disable-next-line no-console
  console.log(`Canonical verification artifact: ${canonical}`);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('✗ PDF render failed:', err);
  process.exit(1);
});
