import { useEffect, useMemo, useState } from 'react';
import { Clock, Globe, Save, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'executive'] as const;
const INTERVIEW_TYPES = ['behavioral', 'technical', 'coding', 'system-design'] as const;

interface SettingsForm {
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  experienceLevel: string;
  industries: string;
  interviewTypes: string[];
  timezone: string;
}

const EMPTY: SettingsForm = {
  firstName: '', lastName: '', phone: '', location: '',
  experienceLevel: 'entry', industries: '', interviewTypes: [], timezone: 'UTC',
};

/**
 * A short, dependency-free list of IANA zones. The full list is ~400 entries;
 * these are the common ones plus every zone the app is realistically used from.
 * The backend still validates whatever is submitted, so a wrong pick is rejected
 * rather than silently corrupting day-bucketing.
 */
const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Jakarta', 'Asia/Singapore',
  'Asia/Dubai', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Hong_Kong',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Europe/London', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Paris', 'Europe/Berlin',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm', 'Europe/Warsaw',
  'Europe/Moscow', 'Europe/Istanbul',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver', 'America/Mexico_City', 'America/Bogota',
  'America/Sao_Paulo', 'America/Argentina/Buenos_Aires',
  'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const p = user.profile ?? ({} as User['profile']);
    const prefs = user.preferences ?? ({} as User['preferences']);
    setForm({
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      phone: p.phone ?? '',
      location: p.location ?? '',
      experienceLevel: prefs.experienceLevel ?? 'entry',
      industries: (prefs.industries ?? []).join(', '),
      interviewTypes: prefs.interviewTypes ?? [],
      timezone: (prefs as { timezone?: string }).timezone || detectTimezone(),
    });
  }, [user]);

  const detected = useMemo(detectTimezone, []);

  const toggleInterviewType = (value: string) => {
    setForm(f => ({
      ...f,
      interviewTypes: f.interviewTypes.includes(value)
        ? f.interviewTypes.filter(t => t !== value)
        : [...f.interviewTypes, value],
    }));
  };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await apiService.put<User>('/user/profile', {
        profile: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          location: form.location.trim(),
        },
        preferences: {
          experienceLevel: form.experienceLevel,
          industries: form.industries.split(',').map(s => s.trim()).filter(Boolean),
          interviewTypes: form.interviewTypes,
          timezone: form.timezone,
        },
      });
      if (response.success && response.data) {
        setUser(response.data);
        toast.success('Settings saved');
      } else {
        setError(response.message || 'Could not save settings.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account details and preparation preferences. Your timezone decides which calendar day your
          AETHER streak counts.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Personal information</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">First name</span>
            <input className={inputClass} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Last name</span>
            <input className={inputClass} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Phone</span>
            <input className={inputClass} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91 98765 43210" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Location</span>
            <input className={inputClass} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Pune, India" />
          </label>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-5 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Preparation preferences</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Experience level</span>
            <select className={inputClass} value={form.experienceLevel} onChange={e => setForm(f => ({ ...f, experienceLevel: e.target.value }))}>
              {EXPERIENCE_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Industries <span className="font-normal text-muted-foreground">(comma separated)</span></span>
            <input className={inputClass} value={form.industries} onChange={e => setForm(f => ({ ...f, industries: e.target.value }))} placeholder="fintech, healthtech" />
          </label>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-medium">Interview types</legend>
          <div className="flex flex-wrap gap-2">
            {INTERVIEW_TYPES.map(type => {
              const active = form.interviewTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleInterviewType(type)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
        </fieldset>
      </Card>

      <Card className="p-6">
        <div className="mb-2 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Timezone</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Activity is stored in UTC and grouped into calendar days using this zone, so a streak is not
          broken by UTC midnight. Detected on this device: <strong>{detected}</strong>.
        </p>
        <label className="block space-y-1.5 text-sm">
          <span className="sr-only">Timezone</span>
          <select className={inputClass} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
            {[...new Set([form.timezone, ...COMMON_TIMEZONES])].filter(Boolean).map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}
