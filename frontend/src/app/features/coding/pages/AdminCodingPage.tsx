import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Archive, Loader2, Save, X, Eye, EyeOff } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { apiService } from '../../../services/api';
import type { CodingProblem, ITestCase, IKnownApproach } from '../types';

/**
 * AETHER Coding — admin problem management.
 * Full CRUD including hidden tests and evaluator metadata.
 */

interface AdminProblem extends CodingProblem {
  hiddenTests?: ITestCase[];
  solutionOutline?: string;
  isPublished: boolean;
  archived?: boolean;
}

const EMPTY_FORM = {
  title: '', slug: '', description: '', difficulty: 'Easy', category: 'Arrays',
  tags: '', companies: '', examplesJson: '', constraints: '',
  sampleTestsJson: '', hiddenTestsJson: '', functionNamesJson: '',
  starterCodeJson: '', knownApproachesJson: '',
  expectedTimeComplexity: 'O(n)', expectedSpaceComplexity: 'O(1)',
  points: 10, hints: '', solutionOutline: '', isPublished: false,
};

export function AdminCodingPage() {
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminProblem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    const res = apiServiceToShape(await apiService.get('/admin/coding/problems'));
    if (res.success && Array.isArray(res.data)) setProblems(res.data);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchProblems(); }, [fetchProblems]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  };

  const openEdit = async (p: AdminProblem) => {
    // Fetch full record (admin route returns hidden tests)
    const res = apiServiceToShape<any>(await apiService.get(`/admin/coding/problems/${p._id}`));
    if (!res.success || !res.data) return;
    const full = res.data;
    setEditing(full);
    setForm({
      ...EMPTY_FORM,
      title: full.title,
      slug: full.slug,
      description: full.description,
      difficulty: full.difficulty,
      category: full.category,
      tags: (full.tags || []).join(', '),
      companies: (full.companies || []).join(', '),
      examplesJson: JSON.stringify(full.examples || [], null, 2),
      constraints: (full.constraints || []).join('\n'),
      sampleTestsJson: JSON.stringify(full.sampleTests || [], null, 2),
      hiddenTestsJson: JSON.stringify(full.hiddenTests || [], null, 2),
      functionNamesJson: JSON.stringify(full.functionNames || {}, null, 2),
      starterCodeJson: JSON.stringify(full.starterCode || {}, null, 2),
      knownApproachesJson: JSON.stringify(full.knownApproaches || [], null, 2),
      expectedTimeComplexity: full.expectedTimeComplexity || 'O(n)',
      expectedSpaceComplexity: full.expectedSpaceComplexity || 'O(1)',
      points: full.points ?? 10,
      hints: (full.hints || []).join('\n'),
      solutionOutline: full.solutionOutline || '',
      isPublished: !!full.isPublished,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || undefined,
        description: form.description,
        difficulty: form.difficulty,
        category: form.category,
        tags: splitList(form.tags),
        companies: splitList(form.companies),
        examples: parseJson(form.examplesJson, []),
        constraints: form.constraints.split('\n').map((s: string) => s.trim()).filter(Boolean),
        sampleTests: parseJson(form.sampleTestsJson, []),
        hiddenTests: parseJson(form.hiddenTestsJson, []),
        functionNames: parseJson(form.functionNamesJson, {}),
        starterCode: parseJson(form.starterCodeJson, {}),
        knownApproaches: parseJson(form.knownApproachesJson, []),
        expectedTimeComplexity: form.expectedTimeComplexity,
        expectedSpaceComplexity: form.expectedSpaceComplexity,
        points: Number(form.points) || 10,
        hints: form.hints.split('\n').map((s: string) => s.trim()).filter(Boolean),
        solutionOutline: form.solutionOutline || undefined,
        isPublished: !!form.isPublished,
      };
      const res = editing
        ? apiServiceToShape(await apiService.put(`/admin/coding/problems/${editing._id}`, payload))
        : apiServiceToShape(await apiService.post('/admin/coding/problems', payload));
      if (!res.success) {
        setError(res.message || 'Save failed');
        return;
      }
      setShowForm(false);
      await fetchProblems();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (p: AdminProblem) => {
    if (!window.confirm(`Archive "${p.title}"? Candidates will no longer see it.`)) return;
    apiServiceToShape(await apiService.delete(`/admin/coding/problems/${p._id}`));
    await fetchProblems();
  };

  const togglePublish = async (p: AdminProblem) => {
    apiServiceToShape(await apiService.put(`/admin/coding/problems/${p._id}`, { isPublished: !p.isPublished }));
    await fetchProblems();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Coding Problems</h1>
            <p className="text-sm text-slate-500">Manage the DSA problem library, hidden tests and evaluator metadata</p>
          </div>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Problem
          </Button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {problems.length === 0 && <p className="p-8 text-center text-sm text-slate-400">No problems yet. Add your first one.</p>}
            {problems.map(p => (
              <div key={p._id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {p.title}
                    {!p.isPublished && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">DRAFT</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {p.category} · {p.difficulty} · {p.points} pts · {p.sampleTests?.length || 0} sample / {p.hiddenTests?.length ?? '?'} hidden tests
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => togglePublish(p)}
                  aria-label={p.isPublished ? 'Unpublish' : 'Publish'}>
                  {p.isPublished ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label="Edit">
                  <Pencil className="w-4 h-4 text-slate-500" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleArchive(p)} aria-label="Archive">
                  <Archive className="w-4 h-4 text-rose-400" />
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Editor modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl my-8 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{editing ? `Edit: ${editing.title}` : 'New Problem'}</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} aria-label="Close"><X className="w-4 h-4" /></Button>
            </div>

            {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Title"><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label="Slug (auto if empty)"><input className={inputCls} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} /></Field>
              <Field label="Difficulty">
                <select className={inputCls} value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </Field>
              <Field label="Category"><input className={inputCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Tags (comma-separated)"><input className={inputCls} value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} /></Field>
              <Field label="Companies (comma-separated)"><input className={inputCls} value={form.companies} onChange={e => setForm({ ...form, companies: e.target.value })} /></Field>
              <Field label="Expected Time Complexity"><input className={inputCls} value={form.expectedTimeComplexity} onChange={e => setForm({ ...form, expectedTimeComplexity: e.target.value })} /></Field>
              <Field label="Expected Space Complexity"><input className={inputCls} value={form.expectedSpaceComplexity} onChange={e => setForm({ ...form, expectedSpaceComplexity: e.target.value })} /></Field>
              <Field label="Points"><input type="number" className={inputCls} value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} /></Field>
              <Field label="Published">
                <input type="checkbox" checked={form.isPublished} onChange={e => setForm({ ...form, isPublished: e.target.checked })} className="w-5 h-5" />
              </Field>
            </div>

            <Field label="Description"><textarea className={`${inputCls} h-24`} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Constraints (one per line)"><textarea className={`${inputCls} h-16`} value={form.constraints} onChange={e => setForm({ ...form, constraints: e.target.value })} /></Field>
            <Field label="Examples (JSON array)"><textarea className={`${inputCls} h-24 font-mono text-xs`} value={form.examplesJson} onChange={e => setForm({ ...form, examplesJson: e.target.value })} /></Field>
            <Field label="Sample Tests (JSON: [{input, expectedOutput}])"><textarea className={`${inputCls} h-24 font-mono text-xs`} value={form.sampleTestsJson} onChange={e => setForm({ ...form, sampleTestsJson: e.target.value })} /></Field>
            <Field label="Hidden Tests (JSON — never shown to candidates)"><textarea className={`${inputCls} h-24 font-mono text-xs`} value={form.hiddenTestsJson} onChange={e => setForm({ ...form, hiddenTestsJson: e.target.value })} /></Field>
            <Field label="Function Names per Language (JSON)"><textarea className={`${inputCls} h-20 font-mono text-xs`} value={form.functionNamesJson} onChange={e => setForm({ ...form, functionNamesJson: e.target.value })} /></Field>
            <Field label="Starter Code per Language (JSON)"><textarea className={`${inputCls} h-32 font-mono text-xs`} value={form.starterCodeJson} onChange={e => setForm({ ...form, starterCodeJson: e.target.value })} /></Field>
            <Field label="Known Approaches (JSON: [{name, approachId, timeComplexity, spaceComplexity, outline, optimal}])"><textarea className={`${inputCls} h-32 font-mono text-xs`} value={form.knownApproachesJson} onChange={e => setForm({ ...form, knownApproachesJson: e.target.value })} /></Field>
            <Field label="Hints (one per line)"><textarea className={`${inputCls} h-16`} value={form.hints} onChange={e => setForm({ ...form, hints: e.target.value })} /></Field>
            <Field label="Solution Outline (private editorial)"><textarea className={`${inputCls} h-20`} value={form.solutionOutline} onChange={e => setForm({ ...form, solutionOutline: e.target.value })} /></Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Problem
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function splitList(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean);
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    const v = JSON.parse(text);
    return (v === undefined || v === null) ? fallback : v;
  } catch {
    return fallback;
  }
}

/** apiService returns APIResponse<T>; normalize for convenience. */
function apiServiceToShape<T>(res: any): { success: boolean; data?: T; message?: string } {
  return { success: !!res?.success, data: res?.data, message: res?.message || res?.error };
}

export type { IKnownApproach };
