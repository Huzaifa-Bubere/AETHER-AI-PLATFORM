import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GroupDiscussionTopic } from '../models/GroupDiscussionTopic';

dotenv.config();

interface TopicRow {
  title: string;
  description: string;
  category: 'TECHNOLOGY' | 'BUSINESS' | 'WORKPLACE' | 'SOCIAL' | 'ABSTRACT' | 'ROLE_SPECIFIC';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  roleSlugs: string[];
  keywords: string[];
  openingContext: string;
  keyPoints: string[];
  brandingNote: string;
}

const topics: TopicRow[] = [
  {
    title: 'Will AI replace entry-level software jobs?',
    description: 'Discuss whether AI-assisted coding tools will reduce demand for junior software engineers, and what candidates should do in response.',
    category: 'TECHNOLOGY',
    difficulty: 'INTERMEDIATE',
    roleSlugs: ['backend-developer', 'frontend-developer', 'full-stack-developer', 'data-engineer', 'ai-ml-engineer'],
    keywords: ['automation', 'productivity', 'entry-level', 'learning', 'tooling', 'demand'],
    openingContext: 'An AI coding assistant can now generate working functions from a short prompt. Some managers say this lowers the need for junior engineers; others say it raises the bar for what a junior must deliver.',
    keyPoints: [
      'AI can accelerate routine implementation tasks but still needs human review.',
      'Entry-level roles often exist to build foundational engineering habits.',
      'The market may shift from writing boilerplate to reviewing and integrating AI output.',
    ],
    brandingNote: '',
  },
  {
    title: 'Remote work versus office work for fresh graduates',
    description: 'Weigh the advantages and disadvantages of remote versus office-based work for someone in their first job.',
    category: 'WORKPLACE',
    difficulty: 'BEGINNER',
    roleSlugs: ['backend-developer', 'data-analyst', 'devops-engineer', 'product-manager'],
    keywords: ['mentoring', 'collaboration', 'focus', 'work-life balance', 'onboarding', 'communication'],
    openingContext: 'A fresh graduate is choosing between a fully remote offer and an office-based offer. Both are for similar roles at comparable companies.',
    keyPoints: [
      'Office environments can accelerate learning through informal mentoring.',
      'Remote work can improve focus and remove commute stress.',
      'The best choice depends on the individual’s learning style and home environment.',
    ],
    brandingNote: '',
  },
  {
    title: 'Open-source contribution versus internships for building experience',
    description: 'Compare contributing to open-source projects with doing a formal internship as a way to build employable experience.',
    category: 'ROLE_SPECIFIC',
    difficulty: 'INTERMEDIATE',
    roleSlugs: ['backend-developer', 'frontend-developer', 'full-stack-developer', 'devops-engineer', 'data-engineer'],
    keywords: ['contribution', 'feedback', 'visibility', 'structure', 'ownership', 'code review'],
    openingContext: 'A student has time during the summer and must decide between an internship and a serious open-source contribution.',
    keyPoints: [
      'Internships usually provide structure, mentorship, and a real product context.',
      'Open-source can show initiative, collaboration, and public code review experience.',
      'The strongest profile often combines both rather than choosing only one.',
    ],
    brandingNote: '',
  },
  {
    title: 'Is cloud computing better than on-premise infrastructure?',
    description: 'Discuss the trade-offs between cloud-hosted infrastructure and on-premise infrastructure for a growing software team.',
    category: 'TECHNOLOGY',
    difficulty: 'INTERMEDIATE',
    roleSlugs: ['backend-developer', 'devops-engineer', 'data-engineer', 'cloud-engineer'],
    keywords: ['cost', 'scalability', 'control', 'maintenance', 'security', 'ops'],
    openingContext: 'A startup is deciding whether to run its services in the cloud or on its own servers as it scales.',
    keyPoints: [
      'Cloud reduces upfront cost and speeds up provisioning.',
      'On-premise can offer more control over data and hardware.',
      'The right answer depends on scale, compliance needs, and in-house ops maturity.',
    ],
    brandingNote: '',
  },
  {
    title: 'Should college education focus more on practical skills?',
    description: 'Discuss whether university curricula should place more emphasis on practical, job-ready skills than they currently do.',
    category: 'SOCIAL',
    difficulty: 'BEGINNER',
    roleSlugs: ['backend-developer', 'data-analyst', 'ai-ml-engineer', 'product-manager'],
    keywords: ['curriculum', 'theory', 'practice', 'employability', 'projects', 'foundations'],
    openingContext: 'Employers often say graduates know theory but struggle with real tooling and teamwork. Students and faculty disagree on how much curricula should change.',
    keyPoints: [
      'Foundational theory helps candidates adapt when tools change.',
      'Practical projects prepare students for theDay-to-day reality of work.',
      'A balanced curriculum usually serves students best.',
    ],
    brandingNote: '',
  },
  {
    title: 'Data privacy versus personalized digital services',
    description: 'Discuss the tension between protecting user data and offering highly personalized digital experiences.',
    category: 'SOCIAL',
    difficulty: 'ADVANCED',
    roleSlugs: ['data-analyst', 'data-engineer', 'ai-ml-engineer', 'product-manager', 'backend-developer'],
    keywords: ['consent', 'personalization', 'trust', 'compliance', 'data minimization', 'user experience'],
    openingContext: 'A product team wants to personalize recommendations using detailed user data, but privacy advocates warn that users may not understand what they are consenting to.',
    keyPoints: [
      'Personalization can improve usefulness when users knowingly opt in.',
      'Data minimization reduces risk even when personalization is the goal.',
      'Trust is a competitive advantage, not only a compliance issue.',
    ],
    brandingNote: '',
  },
  {
    title: 'Should companies use AI during recruitment?',
    description: 'Discuss whether it is appropriate for companies to use AI tools in screening, shortlisting, or evaluating candidates.',
    category: 'BUSINESS',
    difficulty: 'INTERMEDIATE',
    roleSlugs: ['product-manager', 'backend-developer', 'data-analyst', 'human-resources'],
    keywords: ['fairness', 'transparency', 'efficiency', 'bias', 'accountability', 'candidate experience'],
    openingContext: 'A company is considering an AI-assisted resume screening tool to handle large applicant volumes. Some team members support it; others worry about opaque decisions.',
    keyPoints: [
      'AI can reduce manual screening load for large applicant pools.',
      'Opaque models can hide bias or inconsistent criteria.',
      'Any AI-assisted process should remain reviewable by humans.',
    ],
    brandingNote: '',
  },
  {
    title: 'Startup versus established company for fresh graduates',
    description: 'Compare starting a career at a startup with starting at a large established company.',
    category: 'WORKPLACE',
    difficulty: 'BEGINNER',
    roleSlugs: ['backend-developer', 'frontend-developer', 'data-analyst', 'product-manager', 'ai-ml-engineer'],
    keywords: ['learning curve', 'ownership', 'stability', 'mentorship', 'exposure', 'career path'],
    openingContext: 'A fresher has two offers: one from an early-stage startup and one from a large established company.',
    keyPoints: [
      'Startups can offer broad exposure and fast ownership.',
      'Established companies often provide structure, mentorship, and clearer career ladders.',
      'The better choice depends on the candidate’s risk tolerance and learning priorities.',
    ],
    brandingNote: '',
  },
  {
    title: 'Practice topic inspired by common placement GD formats: should colleges mandate industry internships before graduation?',
    description: 'A practice topic inspired by common placement GD formats. Discuss whether completing an industry internship should be mandatory before graduation.',
    category: 'ROLE_SPECIFIC',
    difficulty: 'BEGINNER',
    roleSlugs: ['backend-developer', 'frontend-developer', 'data-analyst', 'data-engineer', 'product-manager'],
    keywords: ['mandatory', 'exposure', 'equity', 'availability', 'readiness', 'curriculum'],
    openingContext: 'In this practice discussion, consider whether every undergraduate should be required to complete at least one industry internship before graduating.',
    keyPoints: [
      'Mandatory internships can widen exposure beyond campus.',
      'Not every student has equal access to internship opportunities.',
      'A mandatory rule works best when colleges help arrange accessible options.',
    ],
    brandingNote: 'Practice topic inspired by common placement GD formats.',
  },
  {
    title: 'Practice topic inspired by common placement GD formats: is a strong GitHub profile more useful than a high GPA for hiring?',
    description: 'A practice topic inspired by common placement GD formats. Discuss whether a strong open-source or project portfolio matters more than academic grades for entry-level hiring.',
    category: 'TECHNOLOGY',
    difficulty: 'INTERMEDIATE',
    roleSlugs: ['backend-developer', 'frontend-developer', 'full-stack-developer', 'data-engineer', 'ai-ml-engineer'],
    keywords: ['portfolio', 'grades', 'evidence', 'practical skill', 'screening', 'signals'],
    openingContext: 'In this practice discussion, compare a publicly visible project portfolio with academic performance as hiring signals for freshers.',
    keyPoints: [
      'A portfolio can demonstrate applied skill more directly than grades alone.',
      'Grades still signal consistency, fundamentals, and follow-through.',
      'Different roles and companies weigh the two signals differently.',
    ],
    brandingNote: 'Practice topic inspired by common placement GD formats.',
  },
];

export async function ensureGroupDiscussionTopics(): Promise<number> {
  let seeded = 0;
  for (const t of topics) {
    await GroupDiscussionTopic.updateOne(
      { title: t.title },
      {
        $setOnInsert: {
          title: t.title,
          description: t.description,
          category: t.category,
          difficulty: t.difficulty,
          roleSlugs: t.roleSlugs,
          keywords: t.keywords,
          openingContext: t.openingContext,
          keyPoints: t.keyPoints,
          isPublished: true,
          brandingNote: t.brandingNote,
        },
      },
      { upsert: true },
    );
    seeded += 1;
  }
  return seeded;
}

async function run() {
  const uri =
    process.env.SEED_MONGODB_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URI;
  if (!uri) throw new Error('Set MONGODB_URI or SEED_MONGODB_URI.');
  await mongoose.connect(uri);
  const count = await ensureGroupDiscussionTopics();
  console.log(`Seeded ${count} group-discussion topics.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
