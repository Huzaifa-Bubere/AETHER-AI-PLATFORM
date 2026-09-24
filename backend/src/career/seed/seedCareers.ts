/**
 * Career seed script — idempotent (safe to run repeatedly).
 *
 *   npm run seed:careers
 *   (or) npx ts-node src/career/seed/seedCareers.ts
 *
 * Creates:
 *  - Skill taxonomy from the canonical dictionary
 *  - 20 career roles with roadmaps, quizzes, projects, resources
 *  - A clearly-labeled DEFAULT market snapshot (static sample data, NOT live)
 *    so Career Intelligence is fully usable before any real import.
 *
 * Re-running never duplicates: all writes are upserts on natural keys.
 */
import mongoose from 'mongoose';
import { Skill } from '../models/Skill';
import { CareerRole } from '../models/CareerRole';
import { RoleTrendSnapshot } from '../models/market';
import { SKILL_TAXONOMY, ROLES, buildRoleDoc } from './careerData';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';

dotenv.config({
  path: path.resolve(process.cwd(), '../.env'),
});
dns.setServers([
  '8.8.8.8',
  '1.1.1.1',
]);

const MONGO_URI =
  process.env.SEED_MONGODB_URI ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  '';

if (!MONGO_URI) {
  console.error(
    '✗ No MongoDB URI found. Set MONGODB_URI (or SEED_MONGODB_URI).'
  );
  process.exit(1);
}

async function seedCareers() {
  try {
    console.log('Connecting to MongoDB...');

    await mongoose.connect(MONGO_URI);

    console.log('✓ MongoDB connected');

    // existing seed logic...
  } catch (error) {
    console.error('✗ Career seed failed:', error);
    process.exit(1);
  }
}

/**
 * Static sample snapshot for default roles. Percentages are illustrative seed data
 * for demo/review purposes and are ALWAYS labeled "Sample snapshot — seed data"
 * in the UI. Real numbers come from admin imports of real job datasets.
 */
const SAMPLE_SNAPSHOTS: Array<{
  role: string; skills: Array<[string, number]>; pairs?: Array<[string, string, number]>;
}> = [
  { role: 'software-engineer', skills: [['problem-solving', 78], ['dsa', 74], ['git', 70], ['sql', 62], ['javascript', 58], ['python', 54], ['system-design', 46], ['docker', 42], ['rest-apis', 48], ['testing', 40], ['aws', 36], ['ci-cd', 34]], pairs: [['docker', 'ci-cd', 34], ['sql', 'dbms', 40], ['git', 'github', 66]] },
  { role: 'frontend-developer', skills: [['javascript', 82], ['html-css', 80], ['react', 74], ['git', 66], ['typescript', 58], ['redux', 44], ['next.js', 42], ['testing', 38], ['accessibility', 30], ['tailwind', 40]], pairs: [['react', 'redux', 44], ['typescript', 'react', 52]] },
  { role: 'backend-developer', skills: [['sql', 72], ['rest-apis', 70], ['git', 68], ['node.js', 52], ['python', 50], ['java', 48], ['docker', 46], ['postgresql', 44], ['mongodb', 42], ['redis', 36], ['aws', 40], ['system-design', 38], ['authentication-security', 44]], pairs: [['node.js', 'express', 40], ['docker', 'aws', 38], ['postgresql', 'redis', 30]] },
  { role: 'fullstack-developer', skills: [['javascript', 78], ['react', 68], ['node.js', 62], ['sql', 58], ['mongodb', 54], ['git', 64], ['rest-apis', 60], ['docker', 38], ['typescript', 46], ['aws', 34]], pairs: [['react', 'node.js', 52], ['mongodb', 'express', 40]] },
  { role: 'java-developer', skills: [['java', 80], ['spring-boot', 66], ['sql', 62], ['hibernate', 54], ['git', 60], ['rest-apis', 56], ['docker', 40], ['kafka', 34], ['microservices', 36], ['aws', 38]], pairs: [['java', 'spring-boot', 62], ['kafka', 'microservices', 30]] },
  { role: 'python-developer', skills: [['python', 82], ['sql', 60], ['django', 52], ['rest-apis', 54], ['git', 62], ['docker', 42], ['fastapi', 44], ['postgresql', 46], ['aws', 36]], pairs: [['django', 'postgresql', 38], ['fastapi', 'docker', 30]] },
  { role: 'mobile-developer', skills: [['kotlin', 54], ['flutter', 52], ['react-native', 46], ['javascript', 50], ['rest-apis', 54], ['git', 60], ['firebase', 38], ['android-sdk', 48]], pairs: [['flutter', 'dart', 40], ['android-sdk', 'kotlin', 42]] },
  { role: 'android-developer', skills: [['kotlin', 72], ['android-sdk', 70], ['git', 58], ['rest-apis', 50], ['sqlite', 40], ['ci-cd', 34], ['firebase', 36]], pairs: [['kotlin', 'android-sdk', 62]] },
  { role: 'devops-engineer', skills: [['linux', 74], ['docker', 72], ['kubernetes', 62], ['ci-cd', 66], ['aws', 58], ['terraform', 50], ['git', 62], ['prometheus', 44], ['ansible', 40], ['python', 46]], pairs: [['kubernetes', 'helm', 38], ['terraform', 'aws', 44], ['docker', 'kubernetes', 58]] },
  { role: 'cloud-engineer', skills: [['aws', 74], ['linux', 62], ['terraform', 56], ['docker', 54], ['python', 46], ['ci-cd', 50], ['kubernetes', 46], ['azure', 40], ['gcp', 36]], pairs: [['aws', 'terraform', 48], ['azure', 'gcp', 26]] },
  { role: 'sre', skills: [['kubernetes', 66], ['linux', 70], ['prometheus', 56], ['docker', 60], ['aws', 52], ['python', 48], ['ci-cd', 50], ['observability', 48], ['terraform', 40]], pairs: [['prometheus', 'grafana', 44], ['kubernetes', 'prometheus', 46]] },
  { role: 'data-analyst', skills: [['sql', 82], ['excel', 70], ['statistics', 58], ['python', 54], ['power-bi', 48], ['tableau', 42], ['data-visualization', 52], ['pandas', 44]], pairs: [['sql', 'power-bi', 44], ['python', 'pandas', 42]] },
  { role: 'data-scientist', skills: [['python', 78], ['machine-learning', 66], ['statistics', 64], ['sql', 62], ['pandas', 60], ['scikit-learn', 54], ['deep-learning', 40], ['pytorch', 36], ['tensorflow', 34], ['mlops', 30]], pairs: [['python', 'pandas', 60], ['pytorch', 'tensorflow', 30]] },
  { role: 'data-engineer', skills: [['sql', 76], ['python', 70], ['etl', 58], ['spark', 48], ['airflow', 44], ['aws', 46], ['kafka', 40], ['snowflake', 36], ['bigquery', 32], ['dbt', 34]], pairs: [['airflow', 'python', 40], ['spark', 'kafka', 32]] },
  { role: 'ai-engineer', skills: [['python', 76], ['llm', 62], ['langchain', 44], ['rest-apis', 54], ['docker', 44], ['deep-learning', 40], ['hugging-face', 42], ['elasticsearch', 34], ['fastapi', 40]], pairs: [['llm', 'langchain', 40], ['python', 'fastapi', 44]] },
  { role: 'machine-learning-engineer', skills: [['python', 78], ['machine-learning', 68], ['pytorch', 52], ['sql', 56], ['docker', 50], ['mlops', 44], ['deep-learning', 48], ['aws', 44], ['kubernetes', 38]], pairs: [['pytorch', 'docker', 38], ['mlops', 'aws', 34]] },
  { role: 'cybersecurity-analyst', skills: [['network-security', 64], ['siem', 56], ['appsec', 52], ['linux', 58], ['wireshark', 42], ['burp-suite', 40], ['cryptography', 38], ['nmap', 44], ['cloud-security', 36]], pairs: [['siem', 'splunk', 34], ['nmap', 'wireshark', 36]] },
  { role: 'qa-engineer', skills: [['testing', 74], ['selenium', 54], ['rest-apis', 50], ['python', 48], ['java', 46], ['cypress', 38], ['playwright', 36], ['ci-cd', 44], ['sql', 42]], pairs: [['selenium', 'java', 36], ['playwright', 'cypress', 24]] },
  { role: 'uiux-engineer', skills: [['ui-design', 70], ['figma', 66], ['ux-research', 52], ['html-css', 56], ['accessibility', 42], ['react', 38], ['communication', 48]], pairs: [['figma', 'ui-design', 56]] },
  { role: 'database-engineer', skills: [['sql', 82], ['dbms', 74], ['postgresql', 60], ['linux', 54], ['mongodb', 46], ['redis', 40], ['operating-systems', 48], ['system-design', 42]], pairs: [['postgresql', 'linux', 42]] },
];

async function seedSkills(): Promise<number> {
  let count = 0;
  for (const entry of SKILL_TAXONOMY) {
    await Skill.updateOne(
      { slug: entry.canonical },
      { $set: { name: entry.name, skillType: entry.skillType, aliases: entry.aliases, category: entry.skillType.toLowerCase() } },
      { upsert: true },
    );
    count++;
  }
  return count;
}

async function seedRoles(): Promise<number> {
  let count = 0;
  for (const spec of ROLES) {
    const doc = buildRoleDoc(spec);
    await CareerRole.updateOne({ slug: spec.slug }, { $set: doc }, { upsert: true });
    count++;
  }
  return count;
}

async function seedMarketSnapshots(): Promise<number> {
  let count = 0;
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 3600 * 1000);
  for (const snap of SAMPLE_SNAPSHOTS) {
    const exists = await RoleTrendSnapshot.findOne({ role: snap.role, region: 'India' }).sort({ periodEnd: -1 });
    if (exists) continue; // never overwrite real imported data with sample data
    // Sample size below MIN_SAMPLE(30) → trend is 'INSUFFICIENT_DATA'; that is honest:
    // the seed provides POPULARITY, not trends. Real trends require a real import.
    await RoleTrendSnapshot.create({
      role: snap.role,
      region: 'India',
      periodStart,
      periodEnd,
      totalPostings: 24,
      topSkills: snap.skills.map(([skill, percentage]) => ({
        skill, count: Math.round(percentage * 24 / 100), percentage,
        trend: 'INSUFFICIENT_DATA',
      })),
      topTools: [], topFrameworks: [], topDatabases: [], topCloud: [],
      skillPairs: (snap.pairs || []).map(([a, b, pct]) => ({ skills: [a, b], count: Math.round(pct * 24 / 100), percentage: pct })),
      experienceDistribution: { entry: 8, mid: 10, senior: 6 },
      sourceMetadata: { sourceName: 'Sample snapshot — seed data (not live market data)', sourceType: 'seed' },
      generatedAt: new Date(),
    });
    count++;
  }
  return count;
}

async function main() {
  if (!MONGO_URI) {
    console.error('✗ No MongoDB URI found. Set MONGODB_URI (or SEED_MONGODB_URI).');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected');

  const skills = await seedSkills();
  const roles = await seedRoles();
  const snapshots = await seedMarketSnapshots();

  console.log(`\nAETHER Career seed complete (idempotent):`);
  console.log(`  skills:            ${skills}`);
  console.log(`  roles:             ${roles}`);
  console.log(`  sample snapshots:  ${snapshots} (labeled "Sample snapshot — seed data")`);
  console.log(`\nRoles: ${ROLES.map(r => r.slug).join(', ')}`);
  await mongoose.disconnect();
  console.log('✓ Done');
}

main().catch(err => { console.error('✗ Seed failed:', err); process.exit(1); });
