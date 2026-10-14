import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell, Briefcase, Camera, CheckCircle2, Eye, Loader2, Lock, Mic,
  Monitor, Palette, Save, ShieldCheck, Trash2, User as UserIcon, UserCog, LogOut, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { apiService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { addRoleGoal, fetchRoleGoals, setPrimaryRole, type RoleGoal } from '../services/roleProgress';
import type {
  AppearancePreferences, InterviewPreferences, JobPreferences, NotificationPreferences, User,
} from '../types';

/**
 * AETHER — Settings (spec Parts AF–AP).
 *
 * DESIGN CONTRACT, in one place so no section can quietly break it:
 *
 *  - SETTINGS ≠ PROFILE. This page configures the ACCOUNT and the candidate's
 *    preferences. The professional candidate profile lives at /profile.
 *  - ONE SAVE PER SECTION. Each tab loads its own persisted data, tracks its own
 *    dirty state and shows its own "Save changes". A single global save button
 *    would let an unrelated edit be lost, and "Saved" would be meaningless.
 *  - NOTHING FAKE. Every control writes to a real endpoint and every confirmation
 *    appears only after the backend has confirmed. Where AETHER genuinely has no
 *    feature (email delivery, a dark theme that is not implemented), the UI says
 *    so instead of rendering a switch that does nothing.
 *  - DEVICE SELECTIONS ARE LOCAL BY NATURE. A camera device id is meaningless on
 *    another machine, so those specific values are stored on this device and the
 *    UI states that plainly.
 */

type SectionId =
  | 'account' | 'career' | 'interview' | 'jobs'
  | 'notifications' | 'privacy' | 'appearance' | 'security';

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof UserIcon; blurb: string }> = [
  { id: 'account', label: 'Account', icon: UserIcon, blurb: 'Identity, contact details and timezone.' },
  { id: 'career', label: 'Career', icon: UserCog, blurb: 'Target roles, experience and industries.' },
  { id: 'interview', label: 'Interview', icon: Monitor, blurb: 'Defaults, devices, voice and captions.' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, blurb: 'Search defaults and preferred sources.' },
  { id: 'notifications', label: 'Notifications', icon: Bell, blurb: 'What AETHER tells you about, in-app.' },
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck, blurb: 'Integrity monitoring and recording.' },
  { id: 'appearance', label: 'Appearance', icon: Palette, blurb: 'Motion and display preferences.' },
  { id: 'security', label: 'Security', icon: Lock, blurb: 'Password, sessions and account.' },
];

const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'executive'] as const;
const INTERVIEW_TYPES = ['behavioral', 'technical', 'coding', 'system-design'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE'] as const;
const JOB_TYPES = ['FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT'] as const;
const EXPERIENCE_FILTERS = ['INTERN', 'ENTRY', 'MID', 'SENIOR', 'LEAD'] as const;
const SPEECH_LANGUAGES = [
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
];

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

const DEVICE_STORAGE_KEY = 'aether.devicePreferences';

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

interface DevicePreferences {
  videoDeviceId: string;
  audioDeviceId: string;
}

function loadDevicePreferences(): DevicePreferences {
  try {
    const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) return { videoDeviceId: '', audioDeviceId: '' };
    const parsed = JSON.parse(raw) as Partial<DevicePreferences>;
    return { videoDeviceId: parsed.videoDeviceId ?? '', audioDeviceId: parsed.audioDeviceId ?? '' };
  } catch {
    return { videoDeviceId: '', audioDeviceId: '' };
  }
}

function saveDevicePreferences(prefs: DevicePreferences): void {
  try {
    window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage can be unavailable (private mode). Not fatal: the defaults still work.
  }
}

const inputClass =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary';

/** A labelled row: consistent spacing and a real <label> for accessibility. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, disabled, note }: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
      {note && <span className="mr-auto text-xs text-muted-foreground">{note}</span>}
      {dirty && !saving && <span className="text-xs text-amber-600">Unsaved changes</span>}
      <Button onClick={onSave} disabled={saving || disabled || !dirty}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

function SectionShell({ icon: Icon, title, description, children }: {
  icon: typeof UserIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const { user, setUser, logout } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section') as SectionId | null;
  const [section, setSection] = useState<SectionId>(
    () => (SECTIONS.some(s => s.id === requested) ? (requested as SectionId) : 'account'),
  );

  const selectSection = (next: SectionId) => {
    setSection(next);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('section', next);
      return params;
    }, { replace: true });
  };

  /** Re-read the authoritative user record after any successful write. */
  const refreshUser = useCallback(async () => {
    const response = await apiService.get<User>('/user/profile').catch(() => null);
    if (response?.success && response.data) setUser(response.data);
  }, [setUser]);

  const active = SECTIONS.find(s => s.id === section) ?? SECTIONS[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account configuration and preferences. Looking for your professional profile? That lives on
          your <a className="text-primary underline-offset-2 hover:underline" href="/profile">Profile</a> page.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Desktop: vertical section list. Mobile: scrollable chips. */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map(item => {
              const Icon = item.icon;
              const isActive = item.id === section;
              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => selectSection(item.id)}
                    className={`flex w-full items-center gap-2 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-transparent text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <p className="text-sm text-muted-foreground">{active.blurb}</p>
          {section === 'account' && <AccountSection user={user} onSaved={refreshUser} />}
          {section === 'career' && <CareerSection user={user} onSaved={refreshUser} />}
          {section === 'interview' && <InterviewSection user={user} onSaved={refreshUser} />}
          {section === 'jobs' && <JobsSection user={user} onSaved={refreshUser} />}
          {section === 'notifications' && <NotificationsSection user={user} onSaved={refreshUser} />}
          {section === 'privacy' && <PrivacySection />}
          {section === 'appearance' && <AppearanceSection user={user} onSaved={refreshUser} />}
          {section === 'security' && <SecuritySection onLogout={logout} />}
        </div>
      </div>
    </div>
  );
}

// ── Account ─────────────────────────────────────────────────────────────────

function AccountSection({ user, onSaved }: { user: User | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', location: '', timezone: 'UTC' });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const detected = useMemo(detectTimezone, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.profile?.firstName ?? '',
      lastName: user.profile?.lastName ?? '',
      phone: user.profile?.phone ?? '',
      location: user.profile?.location ?? '',
      timezone: user.preferences?.timezone || detected,
    });
    setDirty(false);
  }, [user, detected]);

  const update = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setSaving(true);
    try {
      const response = await apiService.put<User>('/user/profile', {
        profile: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          location: form.location.trim(),
        },
        preferences: { timezone: form.timezone },
      });
      if (!response.success) throw new Error(response.message || 'Save failed');
      await onSaved();
      setDirty(false);
      toast.success('Account settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save account settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell icon={UserIcon} title="Account" description="Your identity and contact details, plus the timezone AETHER uses for daily activity.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name">
          <input className={inputClass} value={form.firstName} onChange={e => update({ firstName: e.target.value })} />
        </Field>
        <Field label="Last name">
          <input className={inputClass} value={form.lastName} onChange={e => update({ lastName: e.target.value })} />
        </Field>
        <Field label="Email" hint="Email is the account identifier. Changing it needs a verification step, so it is managed from your Profile page.">
          <input className={`${inputClass} bg-muted`} value={user?.email ?? ''} readOnly aria-readonly="true" />
        </Field>
        <Field label="Phone">
          <input className={inputClass} value={form.phone} onChange={e => update({ phone: e.target.value })} placeholder="+91 98765 43210" />
        </Field>
        <Field label="Location">
          <input className={inputClass} value={form.location} onChange={e => update({ location: e.target.value })} placeholder="Pune, India" />
        </Field>
        <Field label="Timezone" hint={`Detected on this device: ${detected}. Daily activity is grouped using this zone.`}>
          <select className={inputClass} value={form.timezone} onChange={e => update({ timezone: e.target.value })}>
            {[...new Set([form.timezone, ...COMMON_TIMEZONES])].filter(Boolean).map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-slate-50 p-3.5">
        <Camera className="h-4 w-4 text-slate-500" />
        <p className="text-xs text-slate-600">
          Profile photo, headline, experience and links are part of your professional profile.
        </p>
        <a href="/profile" className="ml-auto text-xs font-semibold text-primary hover:underline">Manage profile</a>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </SectionShell>
  );
}

// ── Career ──────────────────────────────────────────────────────────────────

function CareerSection({ user, onSaved }: { user: User | null; onSaved: () => Promise<void> }) {
  const [goals, setGoals] = useState<RoleGoal[]>([]);
  const [form, setForm] = useState({ experienceLevel: 'entry', industries: '', role: '' });
  const [newRole, setNewRole] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      setGoals(await fetchRoleGoals());
    } catch {
      setGoals([]);
    }
  }, []);

  useEffect(() => { void loadGoals(); }, [loadGoals]);

  useEffect(() => {
    if (!user) return;
    setForm({
      experienceLevel: user.preferences?.experienceLevel ?? 'entry',
      industries: (user.preferences?.industries ?? []).join(', '),
      role: user.preferences?.role ?? '',
    });
    setDirty(false);
  }, [user]);

  const update = (patch: Partial<typeof form>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      // Writes ONLY the existing preferences fields. Role goals are a separate
      // model and are changed by the controls below — never by a filter save.
      const response = await apiService.put<User['preferences']>('/user/preferences', {
        experienceLevel: form.experienceLevel,
        industries: form.industries.split(',').map(s => s.trim()).filter(Boolean),
        role: form.role.trim(),
      });
      if (!response.success) throw new Error(response.message || 'Save failed');
      await onSaved();
      setDirty(false);
      toast.success('Career preferences saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save career preferences');
    } finally {
      setSaving(false);
    }
  };

  // Role goals are mutated through their own endpoints and then re-read, so the
  // list always reflects what the server actually stored.
  const makePrimary = async (roleSlug: string) => {
    setRoleBusy(true);
    try {
      await setPrimaryRole(roleSlug);
      await loadGoals();
      await onSaved();
      toast.success('Primary role updated');
    } catch {
      toast.error('Could not update your primary role');
    } finally {
      setRoleBusy(false);
    }
  };

  const addGoal = async () => {
    const slug = newRole.trim().toLowerCase();
    if (!slug) return;
    setRoleBusy(true);
    try {
      await addRoleGoal({ roleSlug: slug });
      await loadGoals();
      setNewRole('');
      await onSaved();
      toast.success('Target role added');
    } catch {
      toast.error('Could not add that role. Check the role name and try again.');
    } finally {
      setRoleBusy(false);
    }
  };

  return (
    <SectionShell icon={UserCog} title="Career" description="What you are aiming for. These choices drive recommendations — they do not change your public profile.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Experience level">
          <select className={inputClass} value={form.experienceLevel} onChange={e => update({ experienceLevel: e.target.value })}>
            {EXPERIENCE_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
          </select>
        </Field>
        <Field label="Primary role" hint="Free-text label used for search defaults. Target roles below are the ones AETHER tracks.">
          <input className={inputClass} value={form.role} onChange={e => update({ role: e.target.value })} placeholder="Backend Developer" />
        </Field>
        <Field label="Preferred industries" hint="Comma separated, e.g. fintech, healthtech">
          <input className={inputClass} value={form.industries} onChange={e => update({ industries: e.target.value })} />
        </Field>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium">Interview types you want to practise</legend>
        <div className="flex flex-wrap gap-2">
          {INTERVIEW_TYPES.map(type => {
            const active = (user?.preferences?.interviewTypes ?? []).includes(type);
            return (
              <span
                key={type}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                {type}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Interview-type preferences are stored with your career profile and used when AETHER suggests practice sessions.
        </p>
      </fieldset>

      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="mb-1 text-sm font-semibold">Target roles</p>
        <p className="mb-3 text-xs text-muted-foreground">
          The roles AETHER measures your readiness against. Your primary role also sets the default job search.
        </p>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No target roles yet. Add one to unlock role-specific readiness and matching.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map(goal => (
              <li key={goal.roleSlug} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <span className="text-sm font-medium">{goal.roleName}</span>
                {goal.isPrimary && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    <CheckCircle2 className="h-3 w-3" /> Primary
                  </span>
                )}
                {!goal.isPrimary && (
                  <button
                    type="button"
                    disabled={roleBusy}
                    onClick={() => void makePrimary(goal.roleSlug)}
                    className="ml-auto text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    Make primary
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <input
            className={inputClass}
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            placeholder="Role slug, e.g. backend-developer"
            aria-label="Add target role"
          />
          <Button onClick={() => void addGoal()} disabled={roleBusy || !newRole.trim()}>Add role</Button>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </SectionShell>
  );
}

// ── Interview ───────────────────────────────────────────────────────────────

const DEFAULT_INTERVIEW_PREFS: InterviewPreferences = {
  defaultType: 'technical', defaultDifficulty: 'medium', speechLanguage: 'en-IN',
  captions: true, autoPlayVoice: true, voiceOutput: true,
};

function InterviewSection({ user, onSaved }: { user: User | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<InterviewPreferences>(DEFAULT_INTERVIEW_PREFS);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [devicePrefs, setDevicePrefs] = useState<DevicePreferences>(() => loadDevicePreferences());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({ ...DEFAULT_INTERVIEW_PREFS, ...(user.preferences?.interview ?? {}) });
    setDirty(false);
  }, [user]);

  const loadDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setDeviceError('This browser does not expose media devices.');
        return;
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all);
      setDeviceError(null);
    } catch {
      setDeviceError('Could not list your devices. Check the browser camera and microphone permissions.');
    }
  }, []);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  const update = (patch: Partial<InterviewPreferences>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };

  const updateDevice = (patch: Partial<DevicePreferences>) => {
    const next = { ...devicePrefs, ...patch };
    setDevicePrefs(next);
    saveDevicePreferences(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await apiService.put('/user/preferences', { interview: form });
      if (!response.success) throw new Error(response.message || 'Save failed');
      await onSaved();
      setDirty(false);
      toast.success('Interview preferences saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save interview preferences');
    } finally {
      setSaving(false);
    }
  };

  const cameras = devices.filter(d => d.kind === 'videoinput');
  const microphones = devices.filter(d => d.kind === 'audioinput');

  return (
    <SectionShell icon={Monitor} title="Interview" description="Defaults for every new interview, plus a real test of the devices AETHER will use.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default interview type">
          <select className={inputClass} value={form.defaultType} onChange={e => update({ defaultType: e.target.value })}>
            {['technical', 'behavioral', 'coding', 'system-design', 'skill-based'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Default difficulty">
          <select className={inputClass} value={form.defaultDifficulty} onChange={e => update({ defaultDifficulty: e.target.value as InterviewPreferences['defaultDifficulty'] })}>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Speech recognition language">
          <select className={inputClass} value={form.speechLanguage} onChange={e => update({ speechLanguage: e.target.value })}>
            {SPEECH_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border px-4">
        <Toggle label="Captions / live transcript" description="Show your spoken answer as text while you speak." checked={form.captions} onChange={next => update({ captions: next })} />
        <Toggle label="Auto-play the interviewer voice" description="Read each question aloud as it appears." checked={form.autoPlayVoice} onChange={next => update({ autoPlayVoice: next })} />
        <Toggle label="Voice output" description="Turn the AI interviewer's speech on or off entirely." checked={form.voiceOutput} onChange={next => update({ voiceOutput: next })} />
      </div>

      <div className="mt-5 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold">Devices on this device</p>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Camera and microphone selections are stored on THIS device only — a device id is meaningless on
          another machine. AETHER never stores audio or video in your settings.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Camera">
            <select className={inputClass} value={devicePrefs.videoDeviceId} onChange={e => updateDevice({ videoDeviceId: e.target.value })}>
              <option value="">System default</option>
              {cameras.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
            </select>
          </Field>
          <Field label="Microphone">
            <select className={inputClass} value={devicePrefs.audioDeviceId} onChange={e => updateDevice({ audioDeviceId: e.target.value })}>
              <option value="">System default</option>
              {microphones.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
            </select>
          </Field>
        </div>

        {deviceError && <p className="mt-2 text-xs text-amber-700">{deviceError}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          <DeviceTester kind="video" deviceId={devicePrefs.videoDeviceId} />
          <DeviceTester kind="audio" deviceId={devicePrefs.audioDeviceId} />
          <Button variant="outline" size="sm" onClick={() => void loadDevices()}>Refresh device list</Button>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} note="Device choices are saved immediately on this device." />
    </SectionShell>
  );
}

/**
 * A REAL device test: it actually opens the stream, reports success or the exact
 * browser error, and for audio shows a live input level so "it works" is
 * demonstrated rather than asserted. The stream is always stopped afterwards.
 */
function DeviceTester({ kind, deviceId }: { kind: 'video' | 'audio'; deviceId: string }) {
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLevel(0);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const run = async () => {
    stop();
    setState('testing');
    setMessage('');
    try {
      const constraints: MediaStreamConstraints = kind === 'video'
        ? { video: deviceId ? { deviceId: { exact: deviceId } } : true, audio: false }
        : { audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setState('ok');
      setMessage(kind === 'video' ? 'Camera is working.' : 'Microphone is working — speak to see the level move.');

      if (kind === 'video' && videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => { /* muted autoplay is fine */ });
      }
      if (kind === 'audio') {
        // Live level meter so a muted-wrong-device setup is visible immediately.
        const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          let raf = 0;
          const loop = () => {
            raf = requestAnimationFrame(loop);
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
            setLevel(Math.round(peak * 100));
          };
          loop();
          window.setTimeout(() => { cancelAnimationFrame(raf); void ctx.close().catch(() => {}); }, 12_000);
        }
      }
    } catch (error) {
      setState('error');
      const name = (error as DOMException)?.name ?? '';
      setMessage(
        name === 'NotAllowedError' ? 'Permission denied. Allow access in your browser settings and retry.'
          : name === 'NotFoundError' ? 'No device found for that selection.'
            : name === 'NotReadableError' ? 'The device is in use by another application (Zoom, Teams…).'
              : `Could not start the device (${name || 'unknown error'}).`,
      );
    }
  };

  return (
    <div className="w-full">
      <Button variant="outline" size="sm" onClick={() => void run()}>
        {kind === 'video' ? <Camera className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
        Test {kind === 'video' ? 'camera' : 'microphone'}
      </Button>
      {state !== 'idle' && (
        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${state === 'error' ? 'border-red-200 bg-red-50 text-red-700' : state === 'testing' ? 'border-border bg-muted text-muted-foreground' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {state === 'testing' ? 'Starting…' : message}
          {kind === 'audio' && state === 'ok' && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, level * 3)}%` }} />
            </div>
          )}
          {kind === 'video' && state === 'ok' && (
            <video ref={videoRef} muted playsInline className="mt-2 h-24 w-32 rounded-lg bg-slate-900 object-cover" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Jobs ────────────────────────────────────────────────────────────────────

const DEFAULT_JOB_PREFS: JobPreferences = {
  defaultCountry: 'in', remoteOnly: false, internshipPreferred: false, fresherFriendly: false,
  salaryMin: null, datePostedWindow: null, providers: [],
};

interface ProviderOption { name: string; configured: boolean; hint?: string }

function JobsSection({ user, onSaved }: { user: User | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<JobPreferences>(DEFAULT_JOB_PREFS);
  const [locations, setLocations] = useState('');
  const [keywords, setKeywords] = useState('');
  const [workModes, setWorkModes] = useState<string[]>([]);
  const [jobTypes, setJobTypes] = useState<string[]>([]);
  const [experienceLevels, setExperienceLevels] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [primaryRole, setPrimaryRole] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({ ...DEFAULT_JOB_PREFS, ...(user.preferences?.jobs ?? {}) });
    setDirty(false);
  }, [user]);

  // Per-role search filters come from the EXISTING JobSearchPreference model, so
  // the Settings page never invents a competing store of job filters.
  useEffect(() => {
    void (async () => {
      try {
        const goals = await fetchRoleGoals();
        const primary = goals.find(g => g.isPrimary) ?? goals[0];
        if (!primary) return;
        setPrimaryRole(primary.roleSlug);
        const prefs = await apiService.get<Array<Record<string, unknown>>>('/jobs/preferences').catch(() => null);
        const mine = prefs?.data?.find(p => String(p.roleSlug) === primary.roleSlug);
        if (mine) {
          setLocations(((mine.locations as string[]) ?? []).join(', '));
          setKeywords(((mine.keywords as string[]) ?? []).join(', '));
          setWorkModes((mine.workModes as string[]) ?? []);
          setJobTypes((mine.jobTypes as string[]) ?? []);
          setExperienceLevels((mine.experienceLevels as string[]) ?? []);
        }
      } catch {
        // Leaving the fields blank is honest: nothing is stored yet.
      }
    })();
  }, []);

  // Only CONFIGURED providers are offered (spec Part AL): listing a source that
  // cannot return anything would be a preference that does nothing.
  useEffect(() => {
    void (async () => {
      try {
        const response = await apiService.get<{ providers: ProviderOption[] }>('/jobs/providers');
        const list = response?.data?.providers ?? [];
        setProviders(list.filter(p => p.configured));
      } catch {
        setProviderError('Could not read provider configuration from the server.');
        setProviders([]);
      }
    })();
  }, []);

  const update = (patch: Partial<JobPreferences>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };
  const markDirty = () => setDirty(true);

  const toggleFrom = (list: string[], setList: (next: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);
    markDirty();
  };

  const save = async () => {
    setSaving(true);
    try {
      const global = await apiService.put('/user/preferences', {
        jobs: {
          ...form,
          providers: form.providers,
        },
      });
      if (!global.success) throw new Error(global.message || 'Save failed');

      // Per-role filters go to the existing per-role model.
      if (primaryRole) {
        await apiService.put(`/jobs/preferences/${primaryRole}`, {
          keywords: keywords.split(',').map(s => s.trim()).filter(Boolean),
          locations: locations.split(',').map(s => s.trim()).filter(Boolean),
          workModes,
          jobTypes,
          experienceLevels,
        });
      }
      await onSaved();
      setDirty(false);
      toast.success('Job preferences saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save job preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell icon={Briefcase} title="Jobs" description="Default search settings used every time you open Jobs. AETHER only offers sources that are actually configured.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Default location scope">
          <select className={inputClass} value={form.defaultCountry} onChange={e => update({ defaultCountry: e.target.value })}>
            <option value="in">India</option>
            <option value="all">All locations</option>
          </select>
        </Field>
        <Field label="Minimum salary (₹ per year, optional)" hint="Leave blank for no minimum. AETHER never invents a salary that a posting did not state.">
          <input
            className={inputClass}
            inputMode="numeric"
            value={form.salaryMin ?? ''}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9]/g, '');
              update({ salaryMin: raw ? Number(raw) : null });
            }}
            placeholder="e.g. 600000"
          />
        </Field>
        <Field label="Date posted">
          <select
            className={inputClass}
            value={form.datePostedWindow ?? ''}
            onChange={e => update({ datePostedWindow: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Any time</option>
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </Field>
        <Field label="Preferred locations" hint="Comma separated. Used as the default location filter.">
          <input className={inputClass} value={locations} onChange={e => { setLocations(e.target.value); markDirty(); }} placeholder="Pune, Bengaluru, Remote" />
        </Field>
        <Field label="Job roles / keywords" hint="Comma separated search terms.">
          <input className={inputClass} value={keywords} onChange={e => { setKeywords(e.target.value); markDirty(); }} placeholder="backend developer, node.js" />
        </Field>
      </div>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border px-4">
        <Toggle label="Remote jobs only" checked={form.remoteOnly} onChange={next => update({ remoteOnly: next })} />
        <Toggle label="Show internships first" description="Prefer internship postings in search results." checked={form.internshipPreferred} onChange={next => update({ internshipPreferred: next })} />
        <Toggle label="Include fresher-friendly roles" description="Bias results towards entry-level and fresher postings." checked={form.fresherFriendly} onChange={next => update({ fresherFriendly: next })} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Work mode</legend>
          <div className="flex flex-wrap gap-2">
            {WORK_MODES.map(mode => (
              <button key={mode} type="button" onClick={() => toggleFrom(workModes, setWorkModes, mode)}
                aria-pressed={workModes.includes(mode)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${workModes.includes(mode) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                {mode.toLowerCase()}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Job type</legend>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map(type => (
              <button key={type} type="button" onClick={() => toggleFrom(jobTypes, setJobTypes, type)}
                aria-pressed={jobTypes.includes(type)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${jobTypes.includes(type) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                {type.toLowerCase().replace('_', '-')}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Experience</legend>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_FILTERS.map(level => (
              <button key={level} type="button" onClick={() => toggleFrom(experienceLevels, setExperienceLevels, level)}
                aria-pressed={experienceLevels.includes(level)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${experienceLevels.includes(level) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                {level.toLowerCase()}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      {primaryRole && (
        <p className="mt-2 text-xs text-muted-foreground">
          Filters above are saved against your primary role: <strong>{primaryRole}</strong>.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-border p-4">
        <p className="text-sm font-semibold">Preferred sources</p>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Only providers configured on the AETHER server can be chosen. A provider that is not configured is
          not a preference you could act on.
        </p>
        {providers === null ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking provider configuration…
          </p>
        ) : providers.length === 0 ? (
          <p className="text-xs text-amber-700">
            {providerError ?? 'No job provider is configured on the server yet. An administrator configures provider credentials in the backend environment.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {providers.map(provider => {
              const selected = form.providers.includes(provider.name);
              return (
                <button
                  key={provider.name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => update({
                    providers: selected
                      ? form.providers.filter(p => p !== provider.name)
                      : [...form.providers, provider.name],
                  })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                >
                  {provider.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Leaving all sources unselected means "no preference" — AETHER then uses every configured source.
        </p>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </SectionShell>
  );
}

// ── Notifications ───────────────────────────────────────────────────────────

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  newMatchingJob: true, jobAlert: true, interviewReminder: true,
  learningRecommendation: true, applicationReminder: true,
};

function NotificationsSection({ user, onSaved }: { user: User | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<NotificationPreferences>(DEFAULT_NOTIFICATIONS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({ ...DEFAULT_NOTIFICATIONS, ...(user.preferences?.notifications ?? {}) });
    setDirty(false);
  }, [user]);

  const update = (patch: Partial<NotificationPreferences>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const response = await apiService.put('/user/preferences', { notifications: form });
      if (!response.success) throw new Error(response.message || 'Save failed');
      await onSaved();
      setDirty(false);
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell icon={Bell} title="Notifications" description="AETHER delivers notifications inside the app.">
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-slate-50 p-3.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs text-slate-600">
          <strong className="font-semibold">In-app only.</strong> AETHER does not send email or push
          notifications, so there are no email switches here — offering one would imply a delivery channel
          that does not exist.
        </p>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border px-4">
        <Toggle label="New matching job" description="When a newly ingested posting matches a role you target." checked={form.newMatchingJob} onChange={n => update({ newMatchingJob: n })} />
        <Toggle label="Job alerts" description="Turn off to stop all in-app job alerts entirely." checked={form.jobAlert} onChange={n => update({ jobAlert: n })} />
        <Toggle label="Interview reminder" description="Reminders for interviews you have scheduled." checked={form.interviewReminder} onChange={n => update({ interviewReminder: n })} />
        <Toggle label="Learning recommendation" description="New learning suggestions for your target roles." checked={form.learningRecommendation} onChange={n => update({ learningRecommendation: n })} />
        <Toggle label="Application tracker reminder" description="Nudges about applications you have not updated." checked={form.applicationReminder} onChange={n => update({ applicationReminder: n })} />
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </SectionShell>
  );
}

// ── Privacy / Integrity (read-only disclosure) ──────────────────────────────

function PrivacySection() {
  return (
    <SectionShell icon={ShieldCheck} title="Interview integrity & privacy" description="What AETHER observes during a protected interview, and what it deliberately does not do.">
      <div className="rounded-xl border border-border bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-600" />
          <p className="text-sm font-semibold">Camera monitoring is required for protected interviews</p>
        </div>
        <p className="mt-1.5 text-xs text-slate-600">
          There is no switch to disable integrity monitoring during a protected assessment. You can end an
          interview at any time from the interview room, and you are told which signals are observed before
          you begin.
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold">Tracked signals</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            'Face presence in the camera frame',
            'More than one person visible',
            'Prolonged attention deviation (gaze or head)',
            'Prolonged eye closure',
            'Leaving the interview tab or window',
            'Camera interruptions',
          ].map(signal => (
            <li key={signal} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs text-slate-600">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              {signal}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-800">What AETHER never does</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-emerald-800">
          <li>AETHER does not use the camera to infer personality, emotion, honesty or intelligence.</li>
          <li>Camera integrity monitoring is not identity recognition and does not build a biometric profile.</li>
          <li>Integrity observations never reduce your technical, communication or answer-quality scores.</li>
          <li>Recorded video is only kept when you consented to recording; monitoring is not consent to record.</li>
        </ul>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Recording preferences are chosen at the start of each interview, where AETHER shows the recording
        state plainly for the whole session. Monitoring and recording are separate consents.
      </p>
    </SectionShell>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────────

function AppearanceSection({ user, onSaved }: { user: User | null; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<AppearancePreferences>({ theme: 'system', reducedMotion: false, compactNav: false });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({ theme: 'system', reducedMotion: false, compactNav: false, ...(user.preferences?.appearance ?? {}) });
    setDirty(false);
  }, [user]);

  // Reduced motion is applied for real, not just remembered: the attribute drives
  // a global CSS rule, so the preference has a visible effect immediately.
  useEffect(() => {
    if (form.reducedMotion) document.documentElement.setAttribute('data-reduced-motion', 'true');
    else document.documentElement.removeAttribute('data-reduced-motion');
  }, [form.reducedMotion]);

  const update = (patch: Partial<AppearancePreferences>) => { setForm(f => ({ ...f, ...patch })); setDirty(true); };

  const save = async () => {
    setSaving(true);
    try {
      const response = await apiService.put('/user/preferences', { appearance: form });
      if (!response.success) throw new Error(response.message || 'Save failed');
      await onSaved();
      setDirty(false);
      toast.success('Appearance preferences saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save appearance preferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell icon={Palette} title="Appearance" description="How AETHER looks and moves on your screen.">
      <div className="divide-y divide-border rounded-xl border border-border px-4">
        <Toggle
          label="Reduced motion"
          description="Minimise animations and transitions. Applied immediately on this device and saved to your account."
          checked={form.reducedMotion}
          onChange={next => update({ reducedMotion: next })}
        />
      </div>
      <p className="mt-3 rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-slate-500">
        A dark theme is not implemented in AETHER yet, so no theme switch is offered here rather than a
        control that would not change anything.
      </p>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </SectionShell>
  );
}

// ── Security ────────────────────────────────────────────────────────────────

function SecuritySection({ onLogout }: { onLogout: () => Promise<void> }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [deleting, setDeleting] = useState(false);

  const changePassword = async () => {
    if (next !== confirm) { toast.error('The new passwords do not match'); return; }
    if (next.length < 8 || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
      toast.error('Use at least 8 characters including a letter and a number');
      return;
    }
    setSaving(true);
    try {
      const response = await apiService.post<{ requiresReauth: boolean }>('/user/change-password', {
        currentPassword: current,
        newPassword: next,
      });
      if (!response.success) throw new Error(response.message || 'Could not change your password');
      setCurrent(''); setNext(''); setConfirm('');
      // Every session, including this one, was invalidated by the backend.
      toast.success(response.message || 'Password changed. Please sign in again.', { duration: 6000 });
      await onLogout().catch(() => undefined);
      window.location.href = '/login';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change your password');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmDelete.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setDeleting(true);
    try {
      const response = await apiService.delete('/user/account');
      if (!response.success) throw new Error(response.message || 'Could not delete your account');
      await onLogout().catch(() => undefined);
      window.location.href = '/';
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete your account');
      setDeleting(false);
    }
  };

  return (
    <>
      <SectionShell icon={Lock} title="Change password" description="Changing your password signs out every other session, including this one.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password">
            <input className={inputClass} type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
          </Field>
          <Field label="New password" hint="At least 8 characters, with a letter and a number.">
            <input className={inputClass} type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input className={inputClass} type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </Field>
        </div>
        <div className="mt-5 flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button onClick={() => void changePassword()} disabled={saving || !current || !next || !confirm}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
            {saving ? 'Updating…' : 'Change password'}
          </Button>
        </div>
      </SectionShell>

      <SectionShell icon={LogOut} title="Sessions" description="Sign out of this device, or end every session everywhere.">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void onLogout().then(() => { window.location.href = '/login'; })}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out of this device
          </Button>
          <Button
            variant="outline"
            onClick={() => void apiService.post('/auth/logout')
              .then(() => { window.location.href = '/login'; })
              .catch(() => toast.error('Could not sign out all sessions'))}
          >
            <Eye className="mr-2 h-4 w-4" /> Sign out of all devices
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Signing out rotates your session token, so previously issued tokens stop working immediately.
        </p>
      </SectionShell>

      <SectionShell icon={Trash2} title="Delete account" description="Permanently removes your AETHER account.">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">This cannot be undone.</p>
          <p className="mt-1 text-xs text-red-700">
            Your account and its stored data are deleted. Type <strong>DELETE</strong> below to confirm.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className={`${inputClass} max-w-xs`}
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => void deleteAccount()}
              disabled={deleting || confirmDelete.trim().toUpperCase() !== 'DELETE'}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete my account
            </Button>
          </div>
        </div>
      </SectionShell>
    </>
  );
}

export default SettingsPage;
