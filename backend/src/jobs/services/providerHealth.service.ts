import { configuredProviders, describeProviders, jobProviders } from '../providers';
import { JobSpyProviderAdapter } from '../providers/jobspy';
import type { ProviderStatus } from '../providers/jobspy';

/**
 * Provider health tracking (spec §14, §49).
 *
 * Records, per provider, whether it is configured/enabled and how its last run
 * went. This is process-local state on purpose: it describes the health of the
 * running server, not a durable record of a job.
 *
 * SECRETS (spec §74): configuration hints are reported, but API keys, tokens and
 * connection strings are never stored, returned or logged here. A hint says
 * "ADZUNA_APP_ID and ADZUNA_APP_KEY are not set", never their values.
 */

export interface ProviderHealth {
  name: string;
  /** ACTIVE | DEGRADED | DISABLED | NOT_CONFIGURED */
  status: ProviderStatus;
  configured: boolean;
  enabled: boolean;
  /** Safe, credential-free explanation shown in the UI. */
  hint: string;

  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  /** Message only — never a request payload or a header. */
  lastError: string | null;

  lastFetched: number;
  lastCreated: number;
  lastUpdated: number;
  lastSkipped: number;
  lastDurationMs: number | null;
  lastRunAt: string | null;
  /** How many consecutive refreshes have failed. */
  consecutiveFailures: number;
}

const health = new Map<string, ProviderHealth>();

function blank(name: string): ProviderHealth {
  return {
    name,
    status: 'NOT_CONFIGURED',
    configured: false,
    enabled: false,
    hint: '',
    lastSuccessAt: null,
    lastFailureAt: null,
    lastError: null,
    lastFetched: 0,
    lastCreated: 0,
    lastUpdated: 0,
    lastSkipped: 0,
    lastDurationMs: null,
    lastRunAt: null,
    consecutiveFailures: 0,
  };
}

function entryFor(name: string): ProviderHealth {
  const existing = health.get(name);
  if (existing) return existing;
  const created = blank(name);
  health.set(name, created);
  return created;
}

/** Record the outcome of one ingestion cycle for one provider. */
export function recordProviderRun(input: {
  name: string;
  configured: boolean;
  enabled: boolean;
  hint: string;
  ok: boolean;
  error?: string | null;
  fetched?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  durationMs?: number;
}): ProviderHealth {
  const entry = entryFor(input.name);
  entry.configured = input.configured;
  entry.enabled = input.enabled;
  entry.hint = input.hint;
  entry.lastFetched = input.fetched ?? 0;
  entry.lastCreated = input.created ?? 0;
  entry.lastUpdated = input.updated ?? 0;
  entry.lastSkipped = input.skipped ?? 0;
  entry.lastDurationMs = input.durationMs ?? entry.lastDurationMs;
  entry.lastRunAt = new Date().toISOString();

  const now = new Date().toISOString();
  if (input.ok) {
    entry.status = 'ACTIVE';
    entry.lastSuccessAt = now;
    entry.lastError = null;
    entry.consecutiveFailures = 0;
  } else {
    entry.status = 'DEGRADED';
    entry.lastFailureAt = now;
    entry.lastError = input.error ?? 'Unknown error';
    entry.consecutiveFailures += 1;
  }
  return entry;
}

/** Full health table for the admin UI and `GET /api/jobs/providers`. */
export function providerHealthTable(): ProviderHealth[] {
  return jobProviders.map(provider => {
    const entry = entryFor(provider.name);
    const configured = provider.isConfigured();
    return {
      ...entry,
      configured,
      enabled: configured,
      status: !configured ? (entry.hint.startsWith('DISABLED') ? 'DISABLED' : 'NOT_CONFIGURED') : entry.status === 'NOT_CONFIGURED' ? 'ACTIVE' : entry.status,
      hint: provider.configurationHint(),
    };
  });
}

/**
 * Probe adapters that expose their own health endpoint. JobSpy's Python service
 * is the only one; the official-API adapters derive health from their runs.
 */
export async function probeExternalServices(): Promise<void> {
  const jobspy = jobProviders.find(p => p.name === 'jobspy');
  if (!jobspy) return;
  const adapter = jobspy as JobSpyProviderAdapter;
  if (typeof adapter.health !== 'function') return;

  const result = await adapter.health();
  const entry = entryFor('jobspy');
  entry.status = result.status;
  entry.hint = result.detail;
  entry.configured = adapter.isConfigured();
  entry.enabled = adapter.isConfigured();
}

/** Coarse roll-up used by the backend health endpoint (spec §68). */
export function overallProviderStatus(): { status: ProviderStatus; summary: string; counts: Record<string, number> } {
  const table = providerHealthTable();
  const counts: Record<string, number> = { ACTIVE: 0, DEGRADED: 0, DISABLED: 0, NOT_CONFIGURED: 0 };
  for (const row of table) counts[row.status] = (counts[row.status] ?? 0) + 1;

  const active = counts.ACTIVE ?? 0;
  const degraded = counts.DEGRADED ?? 0;
  if (active > 0) {
    return {
      status: degraded > 0 ? 'DEGRADED' : 'ACTIVE',
      summary: degraded > 0
        ? `${active} provider(s) serving jobs, ${degraded} degraded.`
        : `${active} provider(s) serving jobs.`,
      counts,
    };
  }
  const disabledOrUnconfigured = (counts.DISABLED ?? 0) + (counts.NOT_CONFIGURED ?? 0);
  return {
    status: 'NOT_CONFIGURED',
    summary: `No provider is currently serving jobs (${disabledOrUnconfigured} disabled or unconfigured).`,
    counts,
  };
}

export { configuredProviders, describeProviders };