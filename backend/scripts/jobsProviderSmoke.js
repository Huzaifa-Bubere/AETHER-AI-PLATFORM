/**
 * jobs:smoke — live provider health check (spec §72).
 *
 * SAFETY (spec §73): this script NEVER connects to MongoDB and NEVER writes a
 * job. It fetches from the configured providers, normalizes through the real
 * adapters, and prints what came back, so a provider can be validated without
 * ingesting anything or risking stored data.
 *
 * Usage:
 *   npm run jobs:smoke
 *   npm run jobs:smoke -- --provider remoteok --limit 10 --query "backend"
 *
 * Exit code is non-zero if any CONFIGURED provider fails, so it can gate CI.
 */
const path = require('path');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const providerName = arg('provider', null);
const limit = Number.parseInt(arg('limit', '10'), 10);
const query = arg('query', '');

(async () => {
  const providers = require(path.join(__dirname, '..', 'dist', 'jobs', 'providers'));
  const all = providerName
    ? providers.jobProviders.filter(p => p.name === providerName)
    : providers.jobProviders;

  if (all.length === 0) {
    console.error(`No provider named "${providerName}". Known: ${providers.jobProviders.map(p => p.name).join(', ')}`);
    process.exit(2);
  }

  let failures = 0;
  for (const provider of all) {
    const configured = provider.isConfigured();
    if (!configured) {
      console.log(`\n${provider.name}: NOT CONFIGURED`);
      console.log(`  reason: ${provider.configurationHint()}`);
      continue;
    }

    const startedAt = Date.now();
    try {
      const jobs = await provider.fetchJobs({ query, limit });
      const durationMs = Date.now() - startedAt;

      console.log(`\n${provider.name}: OK (${durationMs} ms)`);
      console.log(`  fetched: ${jobs.length}`);

      // Every returned record must already satisfy the storage contract.
      const invalid = jobs.filter(j => !providers.isStorableJob(j));
      console.log(`  storable: ${jobs.length - invalid.length}/${jobs.length}`);
      if (invalid.length) console.log(`  ! ${invalid.length} record(s) failed validation and would be skipped`);

      if (jobs.length) {
        const sample = jobs.slice(0, 3);
        for (const job of sample) {
          console.log(`  - ${job.title} @ ${job.company}`);
          console.log(`      url=${job.sourceUrl}`);
          console.log(`      location=${job.location ?? 'not supplied'} | workMode=${job.workMode} | type=${job.jobType} | exp=${job.experienceLevel}`);
          console.log(`      salary=${job.salary?.raw ?? 'not supplied'} | posted=${job.datePosted ? job.datePosted.toISOString() : 'not supplied'}`);
          console.log(`      requirements=${job.requirements.length} | descLen=${job.description.length}`);
        }

        const withSalary = jobs.filter(j => j.salary && (j.salary.min != null || j.salary.raw)).length;
        const withDate = jobs.filter(j => j.datePosted).length;
        const uniqueUrls = new Set(jobs.map(j => j.sourceUrl)).size;
        console.log(`  with salary: ${withSalary}/${jobs.length} | with date: ${withDate}/${jobs.length} | unique urls: ${uniqueUrls}/${jobs.length}`);
      }
    } catch (error) {
      failures += 1;
      console.log(`\n${provider.name}: FAILED after ${Date.now() - startedAt} ms`);
      console.log(`  error: ${error.message}`);
    }
  }

  console.log(`\n${failures === 0 ? 'SMOKE OK' : `SMOKE FAILED (${failures} provider error(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
})();