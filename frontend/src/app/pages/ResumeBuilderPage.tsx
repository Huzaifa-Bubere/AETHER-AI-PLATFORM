import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Plus, Trash2, Copy, Save, Download, Gauge, Loader2,
  CheckCircle2, XCircle, ArrowLeft, Eye, Wand2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { builderService, type IResumeData, type IAtsResult, type IJdMatch, type IVersionSummary } from '../services/resumeBuilderService';
import toast from 'react-hot-toast';

/**
 * AETHER Resume Builder (spec §59–64).
 * LEFT: structured editor. RIGHT: live preview + deterministic ATS panel.
 * ATS scores are never AI-generated; the honesty rule is enforced in copy.
 */

const TEMPLATES = [
  { id: 'ats-classic', label: 'ATS Classic', atsOptimized: true, desc: 'Single column, standard headings — safest for parsers.' },
  { id: 'modern-professional', label: 'Modern Professional', atsOptimized: true, desc: 'Clean two-section layout, still text-first.' },
  { id: 'minimal', label: 'Minimal', atsOptimized: true, desc: 'Whitespace-heavy, simple lines.' },
  { id: 'graduate-fresher', label: 'Graduate / Fresher', atsOptimized: true, desc: 'Education-first ordering for students.' },
] as const;

const emptyData: IResumeData = {
  name: '', email: '', phone: '', location: '', links: [],
  summary: '', education: [], experience: [], projects: [], skills: [],
  certifications: [], achievements: [],
};

export default function ResumeBuilderPage() {
  const [versions, setVersions] = useState<IVersionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [data, setData] = useState<IResumeData>(emptyData);
  const [name, setName] = useState('My Resume');
  const [template, setTemplate] = useState<string>('ats-classic');
  const [jd, setJd] = useState('');
  const [ats, setAts] = useState<IAtsResult | null>(null);
  const [jdMatch, setJdMatch] = useState<IJdMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load versions on mount.
  useEffect(() => {
    builderService.listVersions()
      .then(v => { setVersions(v); })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounced live ATS preview (deterministic, runs on the server).
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const text = JSON.stringify(data);
      if (text === JSON.stringify(emptyData)) { setAts(null); return; }
      setAnalyzing(true);
      try {
        const r = await builderService.analyze(data, jd || undefined);
        setAts(r.ats);
        setJdMatch(r.jdMatch);
      } catch { /* silent — panel simply stays stale */ }
      finally { setAnalyzing(false); }
    }, 1200);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [data, jd]);

  const update = <K extends keyof IResumeData>(key: K, value: IResumeData[K]) =>
    setData(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      if (activeId) {
        const v = await builderService.updateVersion(activeId, { name, data, template });
        setAts((v as any).ats || ats);
        toast.success('Saved — ATS score updated');
      } else {
        const v = await builderService.createVersion({ name, data, template });
        setActiveId(v._id);
        if ((v as any).atsScore != null) setAts(prev => prev); // ATS panel refreshes via debounced analyze
        toast.success('Resume version created');
      }
      const list = await builderService.listVersions();
      setVersions(list);
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const loadVersion = (v: IVersionSummary) => {
    setActiveId(v._id);
    setName(v.name);
    setTemplate(v.template);
    setData({ ...emptyData, ...v.data });
    toast.success(`Loaded "${v.name}"`);
  };

  const newVersion = () => {
    setActiveId(null); setName('My Resume'); setData({ ...emptyData }); setAts(null); setJdMatch(null);
  };

  const createFromUpload = async () => {
    try {
      const v = await builderService.createFromUpload({});
      toast.success('Version created from your latest upload');
      const list = await builderService.listVersions();
      setVersions(list);
      loadVersion(v);
    } catch (e: any) {
      toast.error(e?.message || 'No uploaded resume found');
    }
  };

  const exportPdf = () => {
    // Print-based export: the preview area is print-optimized (spec §60).
    window.print();
  };

  const sortedSections = useMemo(() => orderForTemplate(template, data), [template, data]);

  return (
    <div className="min-h-screen bg-background px-4 sm:px-6 lg:px-8 pt-20 pb-14">
      <style>{`@media print {
        .no-print { display: none !important; }
        .print-area { position: absolute; inset: 0; margin: 0; padding: 0; box-shadow: none !important; border: none !important; }
        body { background: white !important; }
      }`}</style>
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-1">
              <FileText className="w-3.5 h-3.5" /> Resume Builder
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Build an ATS-friendly resume</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={newVersion}><Plus className="w-4 h-4 mr-1" /> New</Button>
            <Button variant="outline" size="sm" onClick={createFromUpload}><Wand2 className="w-4 h-4 mr-1" /> From uploaded resume</Button>
            <Button variant="outline" size="sm" onClick={exportPdf}><Download className="w-4 h-4 mr-1" /> Export PDF</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />} Save
            </Button>
          </div>
        </div>

        {/* Versions bar */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-print">
          {versions.map(v => (
            <button key={v._id} onClick={() => loadVersion(v)}
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs transition-colors ${activeId === v._id ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-border bg-card text-slate-600 hover:border-blue-300'}`}>
              {v.name} · {v.atsScore != null ? `ATS ${v.atsScore}` : 'unscored'}
            </button>
          ))}
          {versions.length === 0 && !loading && <p className="text-xs text-slate-400">No versions yet — start below or create one from your uploaded resume.</p>}
        </div>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
          {/* LEFT: editor */}
          <div className="space-y-4 no-print">
            <Card className="p-5 rounded-2xl space-y-3">
              <Input label="Version name" value={name} onChange={v => setName(v)} />
              <Input label="Full name" value={data.name} onChange={v => update('name', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Email" value={data.email} onChange={v => update('email', v)} />
                <Input label="Phone" value={data.phone} onChange={v => update('phone', v)} />
              </div>
              <Input label="Location" value={data.location} onChange={v => update('location', v)} />
              <Input label="Links (comma separated: LinkedIn, GitHub)" value={data.links.join(', ')}
                onChange={v => update('links', v.split(',').map(s => s.trim()).filter(Boolean))} />
            </Card>

            <Card className="p-5 rounded-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Professional Summary</p>
              <textarea value={data.summary} onChange={e => update('summary', e.target.value)}
                className="w-full h-20 rounded-lg border p-3 text-sm" />
            </Card>

            <Card className="p-5 rounded-2xl space-y-3">
              <SectionHeader title="Experience" onAdd={() => update('experience', [...data.experience, { title: '', company: '', duration: '', bullets: [''] }])} />
              {data.experience.map((exp, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input label="Title" value={exp.title || ''} onChange={v => update('experience', data.experience.map((e, j) => j === i ? { ...e, title: v } : e))} />
                    <Input label="Company" value={exp.company || ''} onChange={v => update('experience', data.experience.map((e, j) => j === i ? { ...e, company: v } : e))} />
                    <Input label="Duration" value={exp.duration || ''} onChange={v => update('experience', data.experience.map((e, j) => j === i ? { ...e, duration: v } : e))} />
                  </div>
                  <textarea value={(exp.bullets || []).join('\n')} placeholder="One achievement per line (start with an action verb)"
                    onChange={e => update('experience', data.experience.map((x, j) => j === i ? { ...x, bullets: e.target.value.split('\n') } : x))}
                    className="w-full h-20 rounded-lg border p-2 text-xs" />
                  <button className="text-xs text-rose-500 hover:underline" onClick={() => update('experience', data.experience.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3 h-3 inline mr-1" />Remove
                  </button>
                </div>
              ))}
            </Card>

            <Card className="p-5 rounded-2xl space-y-3">
              <SectionHeader title="Projects" onAdd={() => update('projects', [...data.projects, { name: '', description: '', technologies: [], bullets: [''] }])} />
              {data.projects.map((p, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-2">
                  <Input label="Project name" value={p.name || ''} onChange={v => update('projects', data.projects.map((x, j) => j === i ? { ...x, name: v } : x))} />
                  <textarea value={(p.bullets || []).join('\n')} placeholder="What did you build? One achievement per line"
                    onChange={e => update('projects', data.projects.map((x, j) => j === i ? { ...x, bullets: e.target.value.split('\n') } : x))}
                    className="w-full h-16 rounded-lg border p-2 text-xs" />
                  <Input label="Technologies (comma separated)" value={(p.technologies || []).join(', ')}
                    onChange={v => update('projects', data.projects.map((x, j) => j === i ? { ...x, technologies: v.split(',').map(s => s.trim()).filter(Boolean) } : x))} />
                  <button className="text-xs text-rose-500 hover:underline" onClick={() => update('projects', data.projects.filter((_, j) => j !== i))}>
                    <Trash2 className="w-3 h-3 inline mr-1" />Remove
                  </button>
                </div>
              ))}
            </Card>

            <Card className="p-5 rounded-2xl space-y-3">
              <SectionHeader title="Education" onAdd={() => update('education', [...data.education, { degree: '', institution: '', year: '' }])} />
              {data.education.map((ed, i) => (
                <div key={i} className="rounded-xl border p-3 grid grid-cols-3 gap-2">
                  <Input label="Degree" value={ed.degree || ''} onChange={v => update('education', data.education.map((x, j) => j === i ? { ...x, degree: v } : x))} />
                  <Input label="Institution" value={ed.institution || ''} onChange={v => update('education', data.education.map((x, j) => j === i ? { ...x, institution: v } : x))} />
                  <Input label="Year" value={String(ed.year || '')} onChange={v => update('education', data.education.map((x, j) => j === i ? { ...x, year: v } : x))} />
                </div>
              ))}
              <SectionHeader title="Skills" onAdd={() => update('skills', [...data.skills, ''])} />
              <div className="flex flex-wrap gap-1.5">
                {data.skills.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700">
                    {s}
                    <button onClick={() => update('skills', data.skills.filter((_, j) => j !== i))} className="text-blue-400 hover:text-rose-500"><XCircle className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <Input label="Add skill + Enter" value="" onChange={() => { /* handled via skills add row */ }} hidden />
              <input className="w-full rounded-lg border p-2 text-sm" placeholder="Type a skill and press Enter"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v) { update('skills', [...data.skills, v]); (e.target as HTMLInputElement).value = ''; }
                  }
                }} />
            </Card>

            <Card className="p-5 rounded-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Template</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setTemplate(t.id)}
                    className={`text-left rounded-xl border p-3 transition-colors ${template === t.id ? 'border-blue-500 bg-blue-50' : 'border-border bg-card hover:border-blue-300'}`}>
                    <p className="text-sm font-semibold text-slate-800">{t.label} <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">ATS ✓</span></p>
                    <p className="text-[11px] text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5 rounded-2xl space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Job Description match (optional)</p>
              <textarea value={jd} onChange={e => setJd(e.target.value)} placeholder="Paste the job description here…"
                className="w-full h-24 rounded-lg border p-3 text-sm" />
            </Card>
          </div>

          {/* RIGHT: live preview + ATS panel */}
          <div className="space-y-4">
            <Card className="p-6 rounded-2xl print-area" id="resume-preview">
              <ResumePreview data={sortedSections} template={template} />
            </Card>

            {ats && (
              <Card className="p-5 rounded-2xl no-print">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Gauge className="w-4 h-4 text-blue-600" /> Deterministic ATS score</p>
                  <span className={`text-lg font-extrabold ${ats.totalScore >= 70 ? 'text-emerald-600' : ats.totalScore >= 55 ? 'text-amber-600' : 'text-rose-600'}`}>{ats.totalScore}/100</span>
                </div>
                {analyzing && <p className="text-[11px] text-slate-400 mb-2"><Loader2 className="w-3 h-3 inline animate-spin" /> Analyzing…</p>}
                <div className="space-y-2">
                  {ats.categories.map(c => (
                    <div key={c.key}>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">{c.label} <span className="text-slate-400">({c.weight}%)</span></span>
                        <span className="font-semibold text-slate-700">{c.score}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${c.score >= 70 ? 'bg-emerald-500' : c.score >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${c.score}%` }} />
                      </div>
                      {c.findings.slice(0, 1).map((f, i) => <p key={i} className="text-[11px] text-slate-400 mt-0.5">{f}</p>)}
                    </div>
                  ))}
                </div>
                {ats.bulletFindings.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-700 mb-1">Bullet suggestions</p>
                    {ats.bulletFindings.slice(0, 3).map((b, i) => (
                      <p key={i} className="text-[11px] text-slate-600">"{b.bullet.slice(0, 60)}…" — {b.issues[0]}</p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-3">
                  Computed from structured evidence with documented weights — never AI-generated. Only add a missing skill if you genuinely have it.
                </p>
              </Card>
            )}

            {jdMatch && (
              <Card className="p-5 rounded-2xl no-print">
                <p className="text-sm font-bold text-slate-800 mb-2">JD match: {jdMatch.matchScore}%</p>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-emerald-600 mb-1">Matched keywords</p>
                    <div className="flex flex-wrap gap-1">{jdMatch.matchedKeywords.map(k => <span key={k} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{k}</span>)}</div>
                  </div>
                  <div>
                    <p className="font-semibold text-rose-500 mb-1">Missing keywords</p>
                    <div className="flex flex-wrap gap-1">{jdMatch.missingKeywords.map(k => <span key={k} className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">{k}</span>)}</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">{jdMatch.honestyNote}</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function orderForTemplate(template: string, data: IResumeData): IResumeData {
  if (template === 'graduate-fresher') {
    return { ...data, education: data.education }; // preview orders education first
  }
  return data;
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <button onClick={onAdd} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"><Plus className="w-3 h-3" /> Add</button>
    </div>
  );
}

function Input({ label, value, onChange, hidden }: { label: string; value: string; onChange: (v: string) => void; hidden?: boolean }) {
  if (hidden) return <input type="hidden" />;
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border p-2 text-sm" />
    </label>
  );
}

/** Print-optimized single-column preview (ATS-parsable layout). */
function ResumePreview({ data, template }: { data: IResumeData; template: string }) {
  const edFirst = template === 'graduate-fresher';
  const contactLine = [data.email, data.phone, data.location].filter(Boolean).join('  •  ');
  return (
    <div className="text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>
      <div className="text-center border-b pb-3 mb-4">
        <h1 className="text-2xl font-bold tracking-wide">{data.name || 'Your Name'}</h1>
        {contactLine && <p className="text-xs mt-1 text-slate-600">{contactLine}</p>}
        {data.links?.length > 0 && <p className="text-xs text-slate-600">{data.links.join('  •  ')}</p>}
      </div>
      {data.summary && (
        <Section title="Professional Summary">
          <p className="text-[13px] leading-relaxed">{data.summary}</p>
        </Section>
      )}
      {(edFirst ? data.education.length > 0 : false) && (
        <Section title="Education">
          {data.education.map((e, i) => (
            <p key={i} className="text-[13px]">{e.degree} — {e.institution} {e.year ? `(${e.year})` : ''}</p>
          ))}
        </Section>
      )}
      {data.experience.length > 0 && (
        <Section title="Experience">
          {data.experience.map((e, i) => (
            <div key={i} className="mb-2">
              <p className="text-[13px] font-bold">{e.title} {e.company ? `· ${e.company}` : ''} {e.duration ? <span className="font-normal text-slate-500">({e.duration})</span> : ''}</p>
              {(e.bullets || []).filter(Boolean).map((b, j) => <p key={j} className="text-[12.5px] ml-3">• {b}</p>)}
            </div>
          ))}
        </Section>
      )}
      {data.projects.length > 0 && (
        <Section title="Projects">
          {data.projects.map((p, i) => (
            <div key={i} className="mb-2">
              <p className="text-[13px] font-bold">{p.name}{p.technologies?.length ? <span className="font-normal text-slate-500"> — {p.technologies.join(', ')}</span> : ''}</p>
              {(p.bullets || []).filter(Boolean).map((b, j) => <p key={j} className="text-[12.5px] ml-3">• {b}</p>)}
            </div>
          ))}
        </Section>
      )}
      {!edFirst && data.education.length > 0 && (
        <Section title="Education">
          {data.education.map((e, i) => (
            <p key={i} className="text-[13px]">{e.degree} — {e.institution} {e.year ? `(${e.year})` : ''}</p>
          ))}
        </Section>
      )}
      {data.skills.length > 0 && (
        <Section title="Skills">
          <p className="text-[13px]">{data.skills.join('  •  ')}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold uppercase tracking-widest border-b mb-2">{title}</h2>
      {children}
    </div>
  );
}
