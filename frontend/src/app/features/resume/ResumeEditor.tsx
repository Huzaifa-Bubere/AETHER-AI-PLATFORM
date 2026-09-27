import { useState, type ReactNode } from 'react';
import {
  ChevronDown, ChevronUp, Plus, Trash2, Copy, ArrowUp, ArrowDown, GripVertical,
} from 'lucide-react';
import { Card } from '../../components/ui/card';
import type {
  ResumeDocument, ResumeExperience, ResumeProject, ResumeEducation, SectionKey,
} from './types';
import { SECTION_LABELS, DEFAULT_SECTION_ORDER } from './types';

/**
 * AETHER Resume Builder — section editor (spec §14–§17).
 *
 * Collapsible sections, repeatable entries (add / duplicate / move / delete),
 * controlled inputs, no decorative chrome. Every change flows into the live PDF
 * preview and the autosave payload.
 */

export const inputCls = 'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
const labelCls = 'block text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1';

/** Lines ⇄ array helpers keep textareas forgiving (blank lines are dropped). */
export function toLines(value: string): string[] {
  return value.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim().length > 0);
}
export function fromLines(items: string[] | undefined): string {
  return (items || []).join('\n');
}

export function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input type={type} className={inputCls} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

export function SectionCard({
  title, subtitle, defaultOpen = false, badge, children, actions,
}: {
  title: string; subtitle?: string; defaultOpen?: boolean; badge?: ReactNode;
  children: ReactNode; actions?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2 text-left">
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge}
          {subtitle && <span className="text-[11px] text-muted-foreground truncate">{subtitle}</span>}
        </button>
        {actions}
      </div>
      {open && <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">{children}</div>}
    </Card>
  );
}

/** Reorder/duplicate/delete controls shared by every repeatable entry. */
function EntryControls({ index, total, onMove, onDuplicate, onDelete }: {
  index: number; total: number; onMove: (dir: -1 | 1) => void;
  onDuplicate?: () => void; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50" />
      <button type="button" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}
        className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
      <button type="button" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}
        className="p-1 rounded hover:bg-secondary disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
      {onDuplicate && (
        <button type="button" title="Duplicate" onClick={onDuplicate} className="p-1 rounded hover:bg-secondary">
          <Copy className="w-3.5 h-3.5" />
        </button>
      )}
      <button type="button" title="Delete" onClick={onDelete} className="p-1 rounded hover:bg-rose-50 text-rose-600">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full rounded-xl border border-dashed border-border py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors inline-flex items-center justify-center gap-1.5">
      <Plus className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

/** Immutably move an item inside an array. */
function move<T>(arr: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export interface EditorProps {
  doc: ResumeDocument;
  patch: (fields: Partial<ResumeDocument>) => void;
}

// ── Personal information + links ────────────────────────────────────────────

export function PersonalSection({ doc, patch }: EditorProps) {
  return (
    <SectionCard title="Personal Information" defaultOpen subtitle={doc.name ? `${doc.name}${doc.title ? ` · ${doc.title}` : ''}` : 'name, contact, links'}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name" value={doc.name} onChange={v => patch({ name: v })} placeholder="Huzaifa Bubere" />
        <Field label="Professional title" value={doc.title} onChange={v => patch({ title: v })} placeholder="Software Engineer" />
        <Field label="Email" value={doc.email} onChange={v => patch({ email: v })} placeholder="you@example.com" />
        <Field label="Phone" value={doc.phone} onChange={v => patch({ phone: v })} placeholder="+91 90000 00000" />
        <Field label="Location" value={doc.location} onChange={v => patch({ location: v })} placeholder="Mumbai, India" />
      </div>
      <div>
        <span className={labelCls}>Links (one per line — LinkedIn, GitHub, portfolio)</span>
        <textarea rows={3} className={inputCls} value={fromLines(doc.links)}
          placeholder={'linkedin.com/in/your-handle\ngithub.com/your-handle'}
          onChange={e => patch({ links: toLines(e.target.value) })} />
      </div>
    </SectionCard>
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────

export function SummarySection({ doc, patch }: EditorProps) {
  const words = doc.summary.trim() ? doc.summary.trim().split(/\s+/).length : 0;
  return (
    <SectionCard
      title="Professional Summary"
      subtitle={doc.summary ? `${words} words` : '2–4 lines'}
      badge={doc.summary.trim().length >= 80 ? undefined : (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">short</span>
      )}
    >
      <textarea rows={4} className={inputCls} value={doc.summary}
        placeholder="Backend developer with 2 years of experience building REST APIs in Node.js and PostgreSQL. Cut p95 latency 40% by adding composite indexes."
        onChange={e => patch({ summary: e.target.value })} />
      <p className="text-[11px] text-muted-foreground">ATS benefits from 80+ characters with your role title and strongest measurable result.</p>
    </SectionCard>
  );
}

// ── Experience ──────────────────────────────────────────────────────────────

export function ExperienceSection({ doc, patch }: EditorProps) {
  const items = doc.experience;
  const set = (next: ResumeExperience[]) => patch({ experience: next });

  return (
    <SectionCard title="Experience" subtitle={items.length ? `${items.length} entr${items.length === 1 ? 'y' : 'ies'}` : 'add your roles'}>
      {items.map((exp, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Experience {i + 1}</p>
            <EntryControls index={i} total={items.length}
              onMove={dir => set(move(items, i, dir))}
              onDuplicate={() => set([...items.slice(0, i + 1), { ...exp, bullets: [...exp.bullets] }, ...items.slice(i + 1)])}
              onDelete={() => set(items.filter((_, j) => j !== i))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Field label="Job title" value={exp.title} onChange={v => set(items.map((e, j) => j === i ? { ...e, title: v } : e))} placeholder="Software Engineer" />
            <Field label="Company" value={exp.company} onChange={v => set(items.map((e, j) => j === i ? { ...e, company: v } : e))} placeholder="Acme Technologies" />
            <Field label="Dates" value={exp.duration || ''} onChange={v => set(items.map((e, j) => j === i ? { ...e, duration: v } : e))} placeholder="Jul 2024 – Present" />
            <Field label="Location (optional)" value={exp.location || ''} onChange={v => set(items.map((e, j) => j === i ? { ...e, location: v } : e))} placeholder="Mumbai" />
          </div>
          <div>
            <span className={labelCls}>Achievement bullets (one per line)</span>
            <textarea rows={4} className={inputCls} value={fromLines(exp.bullets)}
              placeholder={'Built a payments API serving 10k requests per day\nReduced p95 latency 40% with composite indexes'}
              onChange={e => set(items.map((x, j) => j === i ? { ...x, bullets: toLines(e.target.value) } : x))} />
            <p className="text-[11px] text-muted-foreground mt-1">Start with an action verb and include a number where you can.</p>
          </div>
        </div>
      ))}
      <AddButton label="Add experience" onClick={() => set([...items, { title: '', company: '', location: '', duration: '', bullets: [] }])} />
    </SectionCard>
  );
}

// ── Projects ────────────────────────────────────────────────────────────────

export function ProjectsSection({ doc, patch }: EditorProps) {
  const items = doc.projects;
  const set = (next: ResumeProject[]) => patch({ projects: next });

  return (
    <SectionCard title="Projects" subtitle={items.length ? `${items.length} project${items.length === 1 ? '' : 's'}` : 'portfolio work'}>
      {items.map((p, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Project {i + 1}</p>
            <EntryControls index={i} total={items.length}
              onMove={dir => set(move(items, i, dir))}
              onDuplicate={() => set([...items.slice(0, i + 1), { ...p, technologies: [...(p.technologies || [])], bullets: [...p.bullets] }, ...items.slice(i + 1)])}
              onDelete={() => set(items.filter((_, j) => j !== i))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Field label="Project name" value={p.name} onChange={v => set(items.map((x, j) => j === i ? { ...x, name: v } : x))} placeholder="AETHER Career Platform" />
            <Field label="Link (optional)" value={p.link || ''} onChange={v => set(items.map((x, j) => j === i ? { ...x, link: v } : x))} placeholder="github.com/you/project" />
          </div>
          <Field label="Technologies (comma separated)" value={(p.technologies || []).join(', ')}
            onChange={v => set(items.map((x, j) => j === i ? { ...x, technologies: v.split(',').map(s => s.trim()).filter(Boolean) } : x))}
            placeholder="React, Node.js, MongoDB" />
          <div>
            <span className={labelCls}>What it does / what you achieved (one per line)</span>
            <textarea rows={3} className={inputCls} value={fromLines(p.bullets)}
              onChange={e => set(items.map((x, j) => j === i ? { ...x, bullets: toLines(e.target.value) } : x))} />
          </div>
        </div>
      ))}
      <AddButton label="Add project" onClick={() => set([...items, { name: '', link: '', technologies: [], bullets: [] }])} />
    </SectionCard>
  );
}

// ── Education ───────────────────────────────────────────────────────────────

export function EducationSection({ doc, patch }: EditorProps) {
  const items = doc.education;
  const set = (next: ResumeEducation[]) => patch({ education: next });

  return (
    <SectionCard title="Education" subtitle={items.length ? `${items.length} entr${items.length === 1 ? 'y' : 'ies'}` : 'degrees and coursework'}>
      {items.map((ed, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Education {i + 1}</p>
            <EntryControls index={i} total={items.length}
              onMove={dir => set(move(items, i, dir))}
              onDuplicate={() => set([...items.slice(0, i + 1), { ...ed }, ...items.slice(i + 1)])}
              onDelete={() => set(items.filter((_, j) => j !== i))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Field label="Degree" value={ed.degree} onChange={v => set(items.map((x, j) => j === i ? { ...x, degree: v } : x))} placeholder="B.E. Computer Engineering" />
            <Field label="Institution" value={ed.institution} onChange={v => set(items.map((x, j) => j === i ? { ...x, institution: v } : x))} placeholder="University of Mumbai" />
            <Field label="Year" value={String(ed.year || '')} onChange={v => set(items.map((x, j) => j === i ? { ...x, year: v } : x))} placeholder="2025" />
            <Field label="Score / CGPA (optional)" value={ed.score || ''} onChange={v => set(items.map((x, j) => j === i ? { ...x, score: v } : x))} placeholder="8.4 CGPA" />
          </div>
        </div>
      ))}
      <AddButton label="Add education" onClick={() => set([...items, { degree: '', institution: '', year: '', score: '' }])} />
    </SectionCard>
  );
}

// ── Skills, certifications, achievements, languages ─────────────────────────

function ListEditor({ label, items, onChange, placeholder }: {
  label: string; items: string[]; onChange: (next: string[]) => void; placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <span className={labelCls}>{label}</span>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {items.map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-secondary border border-border px-2.5 py-1 text-[12px] text-foreground">
              {item}
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-600">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className={inputCls} value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button type="button" onClick={add} className="shrink-0 rounded-lg border border-border px-3 text-[12.5px] font-semibold hover:border-primary/40">
          Add
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">Or paste many at once, comma separated.</p>
      <input className={inputCls + ' mt-1'} placeholder="Paste comma-separated values and press Enter"
        onKeyDown={e => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const values = (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean);
          if (values.length) onChange([...items, ...values]);
          (e.target as HTMLInputElement).value = '';
        }} />
    </div>
  );
}

export function SkillsCertificationsSection({ doc, patch }: EditorProps) {
  return (
    <SectionCard title="Skills, Certifications & Achievements" subtitle={`${doc.skills.length} skills · ${doc.certifications.length} certs`}>
      <ListEditor label="Skills" items={doc.skills} onChange={next => patch({ skills: next })} placeholder="Node.js" />
      <ListEditor label="Certifications (with year/issuer)" items={doc.certifications} onChange={next => patch({ certifications: next })} placeholder="AWS Certified Cloud Practitioner (2025)" />
      <ListEditor label="Achievements / Awards" items={doc.achievements} onChange={next => patch({ achievements: next })} placeholder="Winner — Smart India Hackathon 2025" />
    </SectionCard>
  );
}

export function LanguagesSection({ doc, patch }: EditorProps) {
  const items = doc.languages;
  const set = (next: typeof items) => patch({ languages: next });
  const LEVELS = ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'];
  return (
    <SectionCard title="Languages" subtitle={items.length ? `${items.length}` : 'optional'}>
      {items.map((l, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1"><Field label="Language" value={l.name} onChange={v => set(items.map((x, j) => j === i ? { ...x, name: v } : x))} placeholder="English" /></div>
          <div className="w-40">
            <span className={labelCls}>Level</span>
            <select className={inputCls} value={l.level} onChange={e => set(items.map((x, j) => j === i ? { ...x, level: e.target.value } : x))}>
              {LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => set(items.filter((_, j) => j !== i))} className="p-2 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <AddButton label="Add language" onClick={() => set([...items, { name: '', level: 'Fluent' }])} />
    </SectionCard>
  );
}

export function CustomSectionsEditor({ doc, patch }: EditorProps) {
  const items = doc.customSections;
  const set = (next: typeof items) => patch({ customSections: next });
  return (
    <SectionCard title="Custom Sections" subtitle={items.length ? `${items.length}` : 'volunteering, publications…'}>
      {items.map((cs, i) => (
        <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <Field label="Section title" value={cs.title} onChange={v => set(items.map((x, j) => j === i ? { ...x, title: v } : x))} placeholder="Open Source Contributions" />
            </div>
            <EntryControls index={i} total={items.length}
              onMove={dir => set(move(items, i, dir))}
              onDuplicate={() => set([...items.slice(0, i + 1), { ...cs, items: [...cs.items] }, ...items.slice(i + 1)])}
              onDelete={() => set(items.filter((_, j) => j !== i))} />
          </div>
          <div>
            <span className={labelCls}>Entries (one per line)</span>
            <textarea rows={3} className={inputCls} value={fromLines(cs.items)}
              onChange={e => set(items.map((x, j) => j === i ? { ...x, items: toLines(e.target.value) } : x))} />
          </div>
        </div>
      ))}
      <AddButton label="Add custom section" onClick={() => set([...items, { title: '', items: [] }])} />
    </SectionCard>
  );
}

// ── Section order + typography ──────────────────────────────────────────────

export function LayoutSection({ doc, patch }: EditorProps) {
  const order = doc.sectionOrder;
  const set = (next: SectionKey[]) => patch({ sectionOrder: next });
  return (
    <SectionCard title="Layout & Typography" subtitle={`${doc.pageSize} · ${doc.typography.fontFamily} ${doc.typography.fontSize}pt`}>
      <div>
        <span className={labelCls}>Section order (move sections up/down)</span>
        <div className="space-y-1.5">
          {order.map((key, i) => (
            <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <span className="text-[13px] text-foreground">{SECTION_LABELS[key]}</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={i === 0} onClick={() => set(move(order, i, -1))} className="p-1 rounded hover:bg-secondary disabled:opacity-30">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" disabled={i === order.length - 1} onClick={() => set(move(order, i, 1))} className="p-1 rounded hover:bg-secondary disabled:opacity-30">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => patch({ sectionOrder: [...DEFAULT_SECTION_ORDER] })}
          className="mt-2 text-[11.5px] text-primary hover:underline">Reset to default order</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Page size</span>
          <select className={inputCls} value={doc.pageSize} onChange={e => patch({ pageSize: e.target.value as 'A4' | 'LETTER' })}>
            <option value="A4">A4</option>
            <option value="LETTER">US Letter</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Font family</span>
          <select className={inputCls} value={doc.typography.fontFamily}
            onChange={e => patch({ typography: { ...doc.typography, fontFamily: e.target.value as 'Helvetica' | 'Times-Roman' } })}>
            <option value="Helvetica">Helvetica (sans)</option>
            <option value="Times-Roman">Times (serif)</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Font size: {doc.typography.fontSize}pt</span>
          <input type="range" min={8} max={12} step={0.5} value={doc.typography.fontSize}
            onChange={e => patch({ typography: { ...doc.typography, fontSize: Number(e.target.value) } })} className="w-full" />
        </label>
        <label className="block">
          <span className={labelCls}>Line height: {doc.typography.lineHeight}</span>
          <input type="range" min={1.1} max={1.8} step={0.05} value={doc.typography.lineHeight}
            onChange={e => patch({ typography: { ...doc.typography, lineHeight: Number(e.target.value) } })} className="w-full" />
        </label>
        <label className="block">
          <span className={labelCls}>Margin: {doc.typography.margin}pt</span>
          <input type="range" min={24} max={64} step={2} value={doc.typography.margin}
            onChange={e => patch({ typography: { ...doc.typography, margin: Number(e.target.value) } })} className="w-full" />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Smaller font and margins fit more onto one page. If content overflows, the PDF flows to a clean second page — entries are never cut in half.
      </p>
    </SectionCard>
  );
}
