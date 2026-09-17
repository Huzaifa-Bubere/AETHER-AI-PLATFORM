import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import AptitudeQuestion, { OptionKey } from '../models/AptitudeQuestion';
import AptitudeTest from '../models/AptitudeTest';
import User from '../models/User';
import { SEED_QUESTIONS } from './seedQuestionData';
import { renderQuestionImage } from '../utils/questionImageRenderer';
import { uploadQuestionImage } from '../utils/aptitudeImageUpload';

/**
 * AETHER — default question bank + published test seeder (admin-run, idempotent).
 *
 * Questions are stored IMAGE-ONLY: statement and options are baked into a rendered
 * image, so candidates cannot select or copy the question text. Answers never leave
 * the server (correctOption is stripped from exam delivery).
 *
 * Also creates (idempotently):
 *  - a default admin account (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD, defaults printed)
 *  - "AETHER Aptitude Assessment" (5 easy / 5 medium / 5 hard) and
 *    "AETHER Technical Assessment" (5 easy / 5 medium / 5 hard), published
 *    from the seeded image-only questions so they appear on /aptitude.
 *
 * Run:  npx ts-node src/scripts/seedDefaultQuestions.ts [--dry-run]
 */

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@aether.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

interface PlanEntry { questionIds: mongoose.Types.ObjectId[]; required: number }

function parseArgs(): { dryRun: boolean } {
  return { dryRun: process.argv.includes('--dry-run') };
}

/** Deterministic per-seed option shuffle: stable across runs, varies across seeds. */
function shuffledOptions(seedId: string, options: [string, string, string, string], answer: string): { options: Record<OptionKey, string>; correctOption: OptionKey } {
  let hash = 2166136261;
  for (const character of seedId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const indexed = options.map((text, index) => ({ text, index }));
  for (let i = indexed.length - 1; i > 0; i--) {
    hash = (Math.imul(hash, 48271) + 11) >>> 0;
    const j = hash % (i + 1);
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  const keys: OptionKey[] = ['A', 'B', 'C', 'D'];
  const mapped = Object.fromEntries(indexed.map((entry, position) => [keys[position], entry.text])) as Record<OptionKey, string>;
  const correctKey = keys[indexed.findIndex(entry => entry.text === answer)];
  return { options: mapped, correctOption: correctKey };
}

async function ensureAdmin(): Promise<mongoose.Types.ObjectId> {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) return existing._id as mongoose.Types.ObjectId;
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await User.create({
    email: ADMIN_EMAIL,
    password: hashed,
    profile: { firstName: 'AETHER', lastName: 'Administrator' },
    experienceLevel: 'mid',
    subscription: { plan: 'enterprise', status: 'active' },
    auth: { role: 'admin', isVerified: true },
  });
  console.log(`Created admin ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD}) — change it after first login.`);
  return admin._id as mongoose.Types.ObjectId;
}

async function pickPlan(
  roundType: 'aptitude' | 'technical',
  perLevel: number,
): Promise<PlanEntry[]> {
  const levels: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
  return Promise.all(levels.map(async difficulty => {
    const docs = await AptitudeQuestion.find({ roundType, difficulty, status: 'active' })
      .sort({ seedId: 1 })
      .limit(perLevel)
      .select('_id');
    return { questionIds: docs.map(document => document._id as mongoose.Types.ObjectId), required: perLevel };
  }));
}

async function ensureTest(
  title: string,
  roundType: 'aptitude' | 'technical',
  createdBy: mongoose.Types.ObjectId,
): Promise<void> {
  const plan = await pickPlan(roundType, 5);
  const shortfall = plan.filter(level => level.questionIds.length < level.required);
  if (shortfall.length) {
    console.warn(`Skip "${title}": not enough active seeded questions (${shortfall.map(l => `${l.required - l.questionIds.length} missing`).join(', ')}).`);
    return;
  }
  const existing = await AptitudeTest.findOne({ title });
  if (existing) {
    console.log(`Test "${title}" already exists — leaving it unchanged.`);
    return;
  }
  await AptitudeTest.create({
    title,
    roundType,
    categories: roundType === 'aptitude'
      ? ['quantitative-aptitude', 'logical-reasoning', 'verbal-ability', 'puzzle-solving']
      : ['technical-quiz'],
    difficultyPlan: {
      easy: { count: 5, marksPerQuestion: 1 },
      medium: { count: 5, marksPerQuestion: 2 },
      hard: { count: 5, marksPerQuestion: 3 },
    },
    durationMinutes: 45,
    isPublished: true,
    createdBy,
  });
  console.log(`Published test "${title}" (5 easy / 5 medium / 5 hard).`);
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs();
  // SEED_MONGODB_URI overrides MONGODB_URI — useful when the Atlas SRV record
  // cannot be resolved on the current network (use a non-SRV mongodb:// string).
  const uri = process.env.SEED_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required. Run from backend/ with the server .env present.');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
  } catch (error: any) {
    if (/querySrv|_mongodb\._tcp/i.test(String(error?.message))) {
      console.error('Your network could not resolve the Atlas SRV record (DNS restriction).');
      console.error('Fix 1: switch DNS to 8.8.8.8 / 1.1.1.1, then run `ipconfig /flushdns`.');
      console.error('Fix 2: set SEED_MONGODB_URI to a non-SRV mongodb:// string (Atlas -> Connect -> Drivers -> older Node version shows it).');
      console.error('Fix 3: try a mobile hotspot (campus/firewall networks often block SRV lookups).');
    }
    throw error;
  }
  console.log(`Connected. Seeding ${SEED_QUESTIONS.length} default image-based questions${dryRun ? ' (dry run)' : ''}.`);

  const existingIds = new Set(
    (await AptitudeQuestion.find({ seedId: { $in: SEED_QUESTIONS.map(q => q.id) } }).select('seedId').lean())
      .map(document => document.seedId)
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const seed of SEED_QUESTIONS) {
    if (existingIds.has(seed.id)) {
      skipped++;
      continue;
    }
    try {
      const { options, correctOption } = shuffledOptions(seed.id, seed.options, seed.answer);
      const image = await renderQuestionImage({ statement: seed.statement, options });
      if (dryRun) {
        created++;
        console.log(`[dry-run] would create ${seed.id} (${seed.roundType}/${seed.difficulty})`);
        continue;
      }
      const uploaded = await uploadQuestionImage(image);
      await AptitudeQuestion.create({
        roundType: seed.roundType,
        category: seed.category,
        difficulty: seed.difficulty,
        questionText: '',               // image-only: no copyable text
        options: { A: '', B: '', C: '', D: '' },
        imageUrl: uploaded.url,
        imagePublicId: uploaded.publicId,
        correctOption,
        marks: seed.difficulty === 'hard' ? 3 : seed.difficulty === 'medium' ? 2 : 1,
        explanation: seed.explanation,
        seedId: seed.id,
      });
      created++;
      console.log(`created ${seed.id} -> ${uploaded.url}`);
    } catch (error: any) {
      failed++;
      console.error(`failed ${seed.id}: ${error?.message || error}`);
    }
  }

  console.log(`Questions done. created=${created} skipped=${skipped} failed=${failed}.`);

  if (!dryRun && failed === 0) {
    const adminId = await ensureAdmin();
    await ensureTest('AETHER Aptitude Assessment', 'aptitude', adminId);
    await ensureTest('AETHER Technical Assessment', 'technical', adminId);
  }

  await mongoose.disconnect();
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
