/**
 * Provider adapter tests (spec §70, §71).
 *
 * These run entirely against FIXTURES and mocked HTTP — no live provider is
 * contacted, so the normal unit-test suite stays deterministic and offline.
 * Live provider behaviour is checked separately by `npm run jobs:smoke`.
 */

const {
  isSafeSourceUrl,
  cleanSourceUrl,
  isStorableJob,
  cleanText,
  normalizeIndianLocation,
  normalizeName,
  detectExperienceLevel,
  detectJobType,
  detectWorkMode,
  extractRequirements,
  htmlToText,
  resolveAdzunaCountry,
  adzunaSearchPath,
  ADZUNA_COUNTRIES,
  withResilience,
  providerTimeoutMs,
  describeProviders,
  EXPERIENCE_FILTER_OPTIONS,
} = require('../dist/jobs/providers');

const {
  normalizeJobspyRecord,
  enabledJobspySources,
  jobspyAdapterEnabled,
  jobspyServiceUrl,
  JobSpyProviderAdapter,
} = require('../dist/jobs/providers/jobspy');

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

describe('URL safety (spec §20)', () => {
  test('only http and https are accepted', () => {
    expect(isSafeSourceUrl('https://example.com/job/1')).toBe(true);
    expect(isSafeSourceUrl('http://example.com/job/1')).toBe(true);
  });

  test('unsafe schemes are rejected', () => {
    expect(isSafeSourceUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeSourceUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeSourceUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeSourceUrl('')).toBe(false);
    expect(isSafeSourceUrl(null)).toBe(false);
    expect(isSafeSourceUrl(12345)).toBe(false);
  });

  test('tracking parameters are stripped, the path is not', () => {
    const cleaned = cleanSourceUrl('https://example.com/jobs/42?utm_source=x&fbclid=y&ref=twitter');
    expect(cleaned).toContain('/jobs/42');
    expect(cleaned).not.toContain('utm_source');
    expect(cleaned).not.toContain('fbclid');
  });
});

describe('record validation (spec §19)', () => {
  const valid = {
    provider: 'test', externalId: '1', sourceUrl: 'https://example.com/1',
    title: 'Backend Engineer', company: 'Acme', description: '',
    workMode: 'UNSPECIFIED', jobType: 'UNSPECIFIED', experienceLevel: 'UNSPECIFIED',
  };

  test('a complete record is storable', () => {
    expect(isStorableJob(valid)).toBe(true);
  });

  test('a record missing a title, company, id or safe URL is rejected', () => {
    expect(isStorableJob({ ...valid, title: '   ' })).toBe(false);
    expect(isStorableJob({ ...valid, company: '' })).toBe(false);
    expect(isStorableJob({ ...valid, externalId: '' })).toBe(false);
    expect(isStorableJob({ ...valid, sourceUrl: 'javascript:alert(1)' })).toBe(false);
  });
});

describe('Indian location normalisation (spec §29)', () => {
  test('common Indian spellings map to one canonical city', () => {
    expect(normalizeIndianLocation('Bangalore')).toBe('bengaluru');
    expect(normalizeIndianLocation('Gurgaon')).toBe('gurugram');
    expect(normalizeIndianLocation('New Delhi')).toBe('delhi');
  });

  test('distinct cities are never merged', () => {
    expect(normalizeIndianLocation('Mumbai')).toBe('mumbai');
    expect(normalizeIndianLocation('Navi Mumbai')).toBe('navi mumbai');
    expect(normalizeIndianLocation('Thane')).toBe('thane');
    expect(normalizeIndianLocation('Pune')).toBe('pune');
    expect(normalizeIndianLocation('Navi Mumbai')).not.toBe(normalizeIndianLocation('Mumbai'));
  });

  test('an unknown location is preserved rather than discarded', () => {
    expect(normalizeIndianLocation('Somewhere Else, NZ')).toBe('Somewhere Else, NZ');
    expect(normalizeIndianLocation(null)).toBeNull();
    expect(normalizeIndianLocation('  ')).toBeNull();
  });

  test('the suggestion list is advisory, not a whitelist', () => {
    // A city outside the list still normalizes fine.
    expect(normalizeIndianLocation('Coimbatore')).toBe('coimbatore');
  });
});

describe('Adzuna country support (spec §5)', () => {
  test('the country is configurable and India is reachable', () => {
    expect(resolveAdzunaCountry('in')).toBe('in');
    expect(resolveAdzunaCountry('gb')).toBe('gb');
    expect(resolveAdzunaCountry('us')).toBe('us');
  });

  test('an unsupported or unknown country falls back to India, never to a frozen path', () => {
    expect(resolveAdzunaCountry('zz')).toBe('in');
    expect(resolveAdzunaCountry(undefined)).toBe('in');
    // A value read from config is honoured.
    process.env.ADZUNA_COUNTRY = 'au';
    expect(resolveAdzunaCountry(process.env.ADZUNA_COUNTRY)).toBe('au');
  });

  test('the search path is built per country instead of hardcoded to insearch/1', () => {
    expect(adzunaSearchPath('in')).toBe('https://api.adzuna.com/v1/api/jobs/in/search');
    expect(adzunaSearchPath('gb')).toBe('https://api.adzuna.com/v1/api/jobs/gb/search');
    expect(adzunaSearchPath('in')).not.toContain('insearch');
  });

  test('every accepted country code is validated against the known set', () => {
    for (const code of Object.keys(ADZUNA_COUNTRIES)) {
      expect(resolveAdzunaCountry(code)).toBe(code);
    }
  });
});

describe('experience and internship detection (spec §31)', () => {
  test('fresher and entry-level Indian phrasing is detected', () => {
    expect(detectExperienceLevel('Software Engineer', 'Freshers are welcome to apply.')).toBe('ENTRY');
    expect(detectExperienceLevel('Graduate Engineer Trainee', 'Apply now')).toBe('ENTRY');
    expect(detectExperienceLevel('Backend Intern', 'Six month internship.')).toBe('INTERN');
  });

  test('an internship described only in the body is still detected', () => {
    expect(detectExperienceLevel('Software Engineer', 'This is a pre-final year internship.')).toBe('INTERN');
  });

  test('no signal yields UNSPECIFIED rather than a guess', () => {
    expect(detectExperienceLevel('Engineer', 'Great team, great product.')).toBe('UNSPECIFIED');
  });

  test('internship beats contract in a description that mentions both', () => {
    expect(detectJobType('Intern', 'This is an internship, not a contract.')).toBe('INTERNSHIP');
  });
});

describe('resilience (spec §25)', () => {
  test('a transient failure is retried and then succeeds', async () => {
    let attempts = 0;
    const result = await withResilience('test', async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error('ETIMEDOUT'), { code: 'ECONNABORTED' });
      return 'ok';
    }, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  test('a permanent 401 is NOT retried', async () => {
    let attempts = 0;
    await expect(withResilience('test', async () => {
      attempts += 1;
      throw Object.assign(new Error('unauthorized'), { response: { status: 401 } });
    }, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  test('a 429 IS retried', async () => {
    let attempts = 0;
    await expect(withResilience('test', async () => {
      attempts += 1;
      throw Object.assign(new Error('rate limited'), { response: { status: 429 } });
    }, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow();
    expect(attempts).toBe(2);
  });

  test('provider timeout is configurable', () => {
    delete process.env.JOB_PROVIDER_TIMEOUT_MS;
    expect(providerTimeoutMs('remoteok')).toBe(20000);
    process.env.JOB_PROVIDER_TIMEOUT_MS = '9000';
    expect(providerTimeoutMs('remoteok')).toBe(9000);
    process.env.REMOTEOK_TIMEOUT_MS = '5000';
    expect(providerTimeoutMs('remoteok')).toBe(5000);
  });
});

describe('JobSpy adapter (spec §6, §10, §11, §70)', () => {
  test('it is disabled by default and fetches nothing', async () => {
    process.env.JOBSPY_ENABLED = 'false';
    expect(jobspyAdapterEnabled()).toBe(false);
    const adapter = new JobSpyProviderAdapter();
    expect(adapter.isConfigured()).toBe(false);
    expect(await adapter.fetchJobs({})).toEqual([]);
    expect(adapter.configurationHint()).toMatch(/DISABLED/);
  });

  test('enabling it without naming sources still fetches nothing', async () => {
    process.env.JOBSPY_ENABLED = 'true';
    process.env.JOBSPY_SOURCES = '';
    const adapter = new JobSpyProviderAdapter();
    expect(adapter.isConfigured()).toBe(false);
    expect(enabledJobspySources()).toEqual([]);
    expect(await adapter.fetchJobs({})).toEqual([]);
  });

  test('only listed sources are ever enabled', () => {
    process.env.JOBSPY_SOURCES = 'naukri';
    expect(enabledJobspySources()).toEqual(['naukri']);
    process.env.JOBSPY_SOURCES = 'naukri, indeed , ';
    expect(enabledJobspySources()).toEqual(['naukri', 'indeed']);
  });

  test('the service URL is overridable so Docker does not use localhost', () => {
    process.env.JOBSPY_SERVICE_URL = 'http://job-provider-service:8010/';
    expect(jobspyServiceUrl()).toBe('http://job-provider-service:8010');
  });

  describe('normalization from raw records', () => {
    const naukriRow = {
      _source: 'naukri',
      title: 'Backend Developer',
      company: 'Example Company',
      job_url: 'https://www.example.com/jobs/backend?utm_source=naukri',
      description: '<p>Requires Node.js and MongoDB experience.</p>',
      city: 'Bangalore',
      date_posted: '2026-09-30',
      min_amount: 500000,
      max_amount: 900000,
      interval: 'annually',
      job_type: 'fulltime',
    };

    test('a normal record becomes a storable NormalizedJob', () => {
      const job = normalizeJobspyRecord(naukriRow, 'naukri');
      expect(job).not.toBeNull();
      expect(job.title).toBe('Backend Developer');
      expect(job.company).toBe('Example Company');
      expect(job.provider).toBe('jobspy');
      expect(job.externalId.startsWith('naukri:')).toBe(true);
      expect(job.city).toBe('bengaluru');
      expect(job.jobType).toBe('FULL_TIME');
      expect(job.salary.min).toBe(500000);
      expect(job.description).toContain('Node.js');
      expect(job.description).not.toContain('<p>');
    });

    test('the tracking parameter is stripped from the source URL', () => {
      const job = normalizeJobspyRecord(naukriRow, 'naukri');
      expect(job.sourceUrl).toBe('https://www.example.com/jobs/backend');
    });

    test('a record with no URL is rejected rather than stored unusable', () => {
      expect(normalizeJobspyRecord({ ...naukriRow, job_url: undefined }, 'naukri')).toBeNull();
    });

    test('an unsafe URL scheme is rejected', () => {
      expect(normalizeJobspyRecord({ ...naukriRow, job_url: 'javascript:alert(1)' }, 'naukri')).toBeNull();
    });

    test('a missing salary stays null — never ₹0 (spec §59)', () => {
      const job = normalizeJobspyRecord(
        { ...naukriRow, min_amount: null, max_amount: null, interval: null },
        'naukri',
      );
      expect(job.salary.min).toBeNull();
      expect(job.salary.max).toBeNull();
    });

    test('alternative field spellings are accepted', () => {
      const job = normalizeJobspyRecord(
        {
          _source: 'indeed', job_title: 'Data Analyst', company_name: 'Example Co',
          job_url_direct: 'https://example.com/da', job_description: 'SQL and Python.',
          job_city: 'Pune',
        },
        'indeed',
      );
      expect(job.title).toBe('Data Analyst');
      expect(job.company).toBe('Example Co');
      expect(job.city).toBe('pune');
    });

    test('a missing date yields null, not an invented date', () => {
      const job = normalizeJobspyRecord({ ...naukriRow, date_posted: undefined }, 'naukri');
      expect(job.datePosted).toBeNull();
    });
  });
});

describe('provider registry (spec §13, §15)', () => {
  test('all adapters implement the same contract', () => {
    const { jobProviders } = require('../dist/jobs/providers');
    for (const provider of jobProviders) {
      expect(typeof provider.name).toBe('string');
      expect(typeof provider.isConfigured).toBe('function');
      expect(typeof provider.configurationHint).toBe('function');
      expect(typeof provider.fetchJobs).toBe('function');
    }
  });

  test('RemoteOK, Adzuna and JobSpy are all registered', () => {
    const names = describeProviders().map(p => p.name);
    expect(names).toEqual(expect.arrayContaining(['remoteok', 'adzuna', 'jobspy']));
  });

  test('a provider hint never leaks a credential value', () => {
    process.env.ADZUNA_APP_ID = 'SECRET-ID-VALUE';
    process.env.ADZUNA_APP_KEY = 'SECRET-KEY-VALUE';
    const { describeProviders: describe } = require('../dist/jobs/providers');
    const serialised = JSON.stringify(describe());
    expect(serialised).not.toContain('SECRET-ID-VALUE');
    expect(serialised).not.toContain('SECRET-KEY-VALUE');
  });

  test('RemoteOK can be switched off without affecting the others', () => {
    process.env.REMOTEOK_ENABLED = 'false';
    const { describeProviders: describe } = require('../dist/jobs/providers');
    const remoteok = describe().find(p => p.name === 'remoteok');
    expect(remoteok.configured).toBe(false);
    expect(remoteok.hint).toMatch(/DISABLED/);
  });
});

describe('text cleaning (spec §21)', () => {
  test('HTML is reduced to text and entities decoded', () => {
    expect(htmlToText('<p>Hello &amp; welcome</p>')).toBe('Hello & welcome');
  });

  test('whitespace and zero-width characters collapse', () => {
    expect(cleanText('  a   b  ')).toBe('a b');
    expect(cleanText('a\u200Bb')).toBe('ab');
  });

  test('duplicate requirement bullets collapse', () => {
    const reqs = extractRequirements('- Strong Python required\n- Strong Python required\n- Node.js experience');
    expect(reqs.filter(r => r.includes('Python'))).toHaveLength(1);
  });

  test('titles normalize to a stable comparison form', () => {
    expect(normalizeName('Senior Backend Engineer (Remote)')).toBe('senior backend engineer remote');
  });

  test('work mode detection prefers the most specific signal', () => {
    expect(detectWorkMode('Hybrid - 3 days in office')).toBe('HYBRID');
    expect(detectWorkMode('Anywhere in the world')).toBe('REMOTE');
    expect(detectWorkMode(null)).toBe('UNSPECIFIED');
  });
});

describe('experience filter options (spec §32)', () => {
  test('friendly labels map onto the stable enum values', () => {
    const byValue = Object.fromEntries(EXPERIENCE_FILTER_OPTIONS.map(o => [o.value, o.label]));
    expect(byValue.INTERN).toBe('Internship');
    expect(byValue.ENTRY).toBe('Fresher / Entry level');
    expect(byValue['']).toBe('Any experience');
  });
});