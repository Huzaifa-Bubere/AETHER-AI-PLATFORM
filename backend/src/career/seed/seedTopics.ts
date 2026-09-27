import mongoose from 'mongoose';
import 'dotenv/config';
import { LearningTopic } from '../models/LearningTopic';
import { ensureDnsFallback, forcePublicDns } from '../../utils/dnsFallback';
import { TOPICS_PART1 } from './topics/part1';
import { TOPICS_PART2 } from './topics/part2';
import { TOPICS_PART3 } from './topics/part3';
import { TOPICS_PART4 } from './topics/part4';
import { TOPICS_PART5 } from './topics/part5';
import type { SeedTopic } from './topics/types';

/**
 * AETHER Career Learning — topic content seeder (spec §37, §40, §71).
 *
 *   npm run seed:topics
 *
 * Every topic becomes real database content: overview, objectives, structured
 * content blocks, multiple worked examples, common mistakes, interview tips,
 * tiered practice, a graded quiz, resources, prerequisites and next/related
 * topics. Nothing on the lesson page is hardcoded JSX and nothing is generated
 * at request time — Gemini is only the supplementary "Ask AETHER" layer
 * (spec §55–§56).
 *
 * Idempotent: upserts by slug. Re-running restores seeded content for the
 * seeded slugs only; topics an admin adds through the CMS are untouched.
 */

export const SEED_TOPICS: SeedTopic[] = [
  ...TOPICS_PART5,   // programming-basics first — it is the foundation prerequisite
  ...TOPICS_PART1,
  ...TOPICS_PART2,
  ...TOPICS_PART3,
  ...TOPICS_PART4,
];

/** Same gate the admin publish endpoint enforces, so seeds can never ship thin content. */
export const PUBLISH_GATE = { minSections: 3, minExamples: 1, minObjectives: 2, minQuiz: 3 };

export interface ValidationIssue {
  slug: string;
  issue: string;
}

export function validateTopic(topic: SeedTopic): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (issue: string) => issues.push({ slug: topic.slug, issue });

  if (topic.sections.length < PUBLISH_GATE.minSections) push(`only ${topic.sections.length} sections (min ${PUBLISH_GATE.minSections})`);
  if (topic.examples.length < PUBLISH_GATE.minExamples) push(`no worked examples`);
  if (topic.learningObjectives.length < PUBLISH_GATE.minObjectives) push(`only ${topic.learningObjectives.length} objectives`);
  if (topic.quiz.length < PUBLISH_GATE.minQuiz) push(`only ${topic.quiz.length} quiz questions`);
  if (!topic.description.trim()) push('missing description');
  if (!topic.whyItMatters.trim()) push('missing whyItMatters');
  if (!topic.resources.length) push('no resources');

  topic.quiz.forEach((q, i) => {
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) push(`quiz #${i + 1} correctIndex out of range`);
    if (q.options.length < 2) push(`quiz #${i + 1} has fewer than 2 options`);
  });

  return issues;
}

export function duplicateQuizIds(topic: SeedTopic): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const q of topic.quiz) {
    if (seen.has(q.id)) issues.push({ slug: topic.slug, issue: `duplicate quiz id "${q.id}"` });
    seen.add(q.id);
  }
  return issues;
}

export function seedTopicsIssues(): ValidationIssue[] {
  return [
    ...SEED_TOPICS.flatMap(validateTopic),
    ...SEED_TOPICS.flatMap(duplicateQuizIds),
  ];
}

/**
 * Map a seed topic onto the LearningTopic schema. The seeder and the content
 * integrity tests both use this, so a test failure always means a real schema
 * or content problem (never a mismatch between test and seeder mapping).
 */
export function toLearningTopicDoc(topic: SeedTopic) {
  return {
    slug: topic.slug,
    title: topic.title,
    shortDescription: topic.shortDescription,
    description: topic.description,
    whyItMatters: topic.whyItMatters,
    interviewRelevance: topic.interviewRelevance,
    skillSlugs: topic.skillSlugs,
    roleSlugs: topic.roleSlugs,
    roadmapNodeIds: topic.roadmapNodeIds ?? [],
    courseSlugs: topic.courseSlugs ?? [],
    moduleId: undefined,
    stageId: undefined,
    group: topic.group,
    order: topic.order,
    level: topic.level,
    estimatedMinutes: topic.estimatedMinutes,
    prerequisites: topic.prerequisites,
    optionalPrerequisites: topic.optionalPrerequisites ?? [],
    learningObjectives: topic.learningObjectives,
    sections: topic.sections,
    examples: topic.examples,
    commonMistakes: topic.commonMistakes,
    interviewTips: topic.interviewTips,
    practice: topic.practice,
    quiz: topic.quiz,
    resources: topic.resources,
    nextTopicSlugs: topic.nextTopicSlugs,
    relatedTopicSlugs: topic.relatedTopicSlugs,
    status: 'published' as const,
    source: topic.source ?? ('ORIGINAL' as const),
    reviewedBy: topic.reviewedBy,
  };
}

export async function seed(): Promise<void> {
  const knownSlugs = new Set(SEED_TOPICS.map(t => t.slug));

  // Validate before touching the database — bad seed content is a build error,
  // not a silent production gap.
  const issues = seedTopicsIssues();
  if (issues.length) {
    for (const { slug, issue } of issues) console.error(`✗ ${slug}: ${issue}`);
    console.error(`\n✗ Seed aborted — ${issues.length} content problem(s) must be fixed in backend/src/career/seed/topics/.`);
    process.exit(1);
  }

  await ensureDnsFallback();
  const uri = process.env.SEED_MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('✗ No MongoDB URI found. Set MONGO_URI (or SEED_MONGODB_URI).');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  } catch {
    console.warn('Connection failed — retrying with public DNS resolvers...');
    forcePublicDns();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  }

  let created = 0;
  let updated = 0;

  for (const topic of SEED_TOPICS) {
    const doc = toLearningTopicDoc(topic);

    const existing = await LearningTopic.findOne({ slug: topic.slug }).select('_id publishedAt contentVersion');
    if (existing) {
      await LearningTopic.updateOne(
        { _id: existing._id },
        // bump contentVersion so cached lesson pages can detect new content
        { $set: { ...doc, contentVersion: (existing.contentVersion || 1) + 1 } },
      );
      updated++;
    } else {
      await LearningTopic.create({ ...doc, contentVersion: 1, publishedAt: new Date() });
      created++;
    }
  }

  // Referential integrity: next/related/prerequisite slugs must resolve so the
  // lesson footer never links to a dead page.
  const dangling: string[] = [];
  for (const topic of SEED_TOPICS) {
    const refs = [...topic.prerequisites, ...topic.optionalPrerequisites ?? [], ...topic.nextTopicSlugs, ...topic.relatedTopicSlugs];
    for (const ref of refs) {
      if (!ref || knownSlugs.has(ref)) continue;
      const exists = await LearningTopic.exists({ slug: ref });
      if (!exists) dangling.push(`${topic.slug} → ${ref}`);
    }
  }
  if (dangling.length) {
    console.warn(`⚠ ${dangling.length} topic reference(s) do not resolve yet (still safe to browse):`);
    dangling.forEach(d => console.warn(`   ${d}`));
  }

  console.log(`\n✓ Career Learning topics seeded: ${created} created, ${updated} updated (${SEED_TOPICS.length} total)`);
  console.log(`  groups: ${[...new Set(SEED_TOPICS.map(t => t.group))].join(', ')}`);
  console.log(`  slugs:  ${[...knownSlugs].join(', ')}`);
  console.log('  All topics are status=published and rendered from MongoDB by the lesson page.');
  if (dangling.length) console.log('  Note: run "npm run seed:topics" again after adding the missing topics.');

  await mongoose.disconnect();
  console.log('✓ Done');
}

// Only seed when executed directly (`npm run seed:topics`); importing this
// module from tests must not open a database connection.
if (require.main === module) {
  seed().catch(err => {
    console.error('✗ Topic seeding failed:', err);
    process.exit(1);
  });
}
