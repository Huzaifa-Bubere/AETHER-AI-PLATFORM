import mongoose from 'mongoose';
import 'dotenv/config';
import CodingProblem from '../models/CodingProblem';
import { PROBLEMS_PART1, SeedProblem } from './problems.part1';
import { PROBLEMS_PART2 } from './problems.part2';

/**
 * AETHER Coding — problem seeder.
 * Usage: npx ts-node src/coding/seed/seedProblems.ts
 * Idempotent: upserts by slug, safe to re-run.
 */

const LANGS = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c'] as const;

function jsLikeStarter(fn: string, params: string[], ts: boolean): string {
  const plist = params.join(', ');
  if (ts) {
    const typed = params.map(p => `${p}: number[] | string | number`).join(', ');
    return `function ${fn}(${typed}) {
  // Write your solution here
}
`;
  }
  return `function ${fn}(${plist}) {
  // Write your solution here
}
`;
}

function pythonStarter(fn: string, params: string[]): string {
  return `def ${fn}(${params.join(', ')}):
    # Write your solution here
    pass
`;
}

function javaStarter(fn: string, sig: { returnType: string; paramTypes: string[] }, params: string[]): string {
  const paramsStr = sig.paramTypes.map((t, i) => `${t} ${params[i]}`).join(', ');
  return `class Solution {
    public ${sig.returnType} ${fn}(${paramsStr}) {
        // Write your solution here
        ${sig.returnType === 'void' ? '' : `return ${defaultValue(sig.returnType)};`}
    }
}
`;
}

function cppStarter(fn: string, sig: { returnType: string; paramTypes: string[] }, params: string[], isC = false): string {
  const paramsStr = sig.paramTypes.map((t, i) => `${t} ${params[i]}`).join(', ');
  if (isC) {
    return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Write your solution here */
`;
  }
  return `class Solution {
public:
    ${sig.returnType} ${fn}(${paramsStr}) {
        // Write your solution here
    }
};
`;
}

function defaultValue(t: string): string {
  if (t === 'int') return '0';
  if (t === 'boolean') return 'false';
  if (t === 'bool') return 'false';
  return 'null';
}

function buildStarterCode(p: SeedProblem): Record<string, string> {
  return {
    python: pythonStarter(p.functionName, p.params),
    javascript: jsLikeStarter(p.functionName, p.params, false),
    typescript: jsLikeStarter(p.functionName, p.params, true),
    java: javaStarter(p.functionName, p.javaSignature, p.params),
    cpp: cppStarter(p.functionName, p.cppSignature, p.params),
    c: cppStarter(p.functionName, p.cppSignature, p.params, true),
  };
}

async function seed(): Promise<void> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI not set — cannot seed coding problems');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const all = [...PROBLEMS_PART1, ...PROBLEMS_PART2];
  let created = 0;
  let updated = 0;

  for (const p of all) {
    const doc = {
      title: p.title,
      slug: p.slug,
      description: p.description,
      difficulty: p.difficulty,
      category: p.category,
      tags: p.tags,
      companies: p.companies || [],
      examples: p.examples,
      constraints: p.constraints,
      starterCode: buildStarterCode(p),
      sampleTests: p.sampleTests,
      hiddenTests: p.hiddenTests,
      functionNames: Object.fromEntries(LANGS.map(l => [l, p.functionName])),
      knownApproaches: p.knownApproaches,
      expectedTimeComplexity: p.expectedTimeComplexity,
      expectedSpaceComplexity: p.expectedSpaceComplexity,
      points: p.points,
      hints: p.hints,
      solutionOutline: p.solutionOutline,
      isPublished: true,
      archived: false,
    };

    const result = await CodingProblem.updateOne(
      { slug: p.slug },
      { $set: doc },
      { upsert: true }
    );
    if (result.upsertedCount > 0) created++;
    else updated++;
  }

  console.log(`Seed complete: ${created} created, ${updated} updated (total ${all.length} problems)`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
