import { Link } from 'react-router-dom';
import { useEffect, useState, FormEvent } from 'react';
import api from '../../../lib/aptitudeApi';


const CATEGORIES = [
  'quantitative-aptitude',
  'logical-reasoning',
  'verbal-ability',
  'data-interpretation',
  'puzzle-solving',
  'technical-quiz',
];

function extractErrorMessage(err: any): string {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.';
}

interface TestRow {
  _id: string;
  title: string;
  roundType: string;
  categories: string[];
  durationMinutes: number;
  totalMarks: number;
  isPublished: boolean;
  ragTopic?: string;
  difficultyPlan: Record<string, { count: number; marksPerQuestion: number }>;
  availability: { ready: boolean; issues: string[] };
}

export default function TestManager() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<TestRow | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTests = async () => {
    try {
      const { data } = await api.get('/api/admin/aptitude/tests');
      setTests(data.tests);
      setError(null);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const categories = form.getAll('categories') as string[];

    if (categories.length === 0) {
      setError('Select at least one category — a test with no categories has no questions to pull from.');
      return;
    }

    const payload = {
      title: form.get('title'),
      roundType: form.get('roundType'),
      ragTopic: String(form.get('ragTopic') || '').trim(),
      categories,
      durationMinutes: Number(form.get('durationMinutes')),
      difficultyPlan: {
        easy: { count: Number(form.get('easyCount')), marksPerQuestion: Number(form.get('easyMarks')) },
        medium: { count: Number(form.get('mediumCount')), marksPerQuestion: Number(form.get('mediumMarks')) },
        hard: { count: Number(form.get('hardCount')), marksPerQuestion: Number(form.get('hardMarks')) },
      },
    };

    setSaving(true);
    try {
      if (editing) await api.put(`/api/admin/aptitude/tests/${editing._id}`, payload);
      else await api.post('/api/admin/aptitude/tests', payload);
      setShowForm(false);
      setEditing(null);
      await fetchTests();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (id: string, isPublished: boolean) => {
    if (publishing) return;
    setPublishing(id);
    setError(null);
    try {
      await api.patch(`/api/admin/aptitude/tests/${id}/publish`, { isPublished: !isPublished });
      await fetchTests();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally { setPublishing(null); }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-20 text-foreground">
      <Link to="/admin/aptitude" className="mb-4 inline-block text-sm text-primary">Back to Aptitude Admin</Link>
      <div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-xl font-bold">Test Management</h1>
        <button onClick={() => { setEditing(null); setShowForm(v => !v); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          + Create Test
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-red-50 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <p className="mb-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
        Tests draw active questions from the selected categories, with a separate count and mark weight for each difficulty.
        New tests are drafts. Publishing checks that enough questions are available. Existing attempts keep their original questions, duration and marks.
      </p>

      {showForm && (
        <form key={editing?._id || 'new'} onSubmit={handleCreate} className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5">
          <label className="text-sm">Knowledge topic (optional)
            <input name="ragTopic" defaultValue={editing?.ragTopic || ''} maxLength={80} className="mt-1 w-full rounded-md bg-secondary px-3 py-2" placeholder="Exact topic from Knowledge Sources" />
            <span className="mt-1 block text-muted-foreground">Set a topic for source-grounded generation, or leave blank to use the curated bank. Source-grounded tests need one category and at most 10 questions.</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Title</span>
              <input name="title" defaultValue={editing?.title} required className="w-full rounded-md bg-secondary px-3 py-2" placeholder="Round 1: Aptitude" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Round Type</span>
              <select name="roundType" defaultValue={editing?.roundType} className="w-full rounded-md bg-secondary px-3 py-2">
                <option value="aptitude">Aptitude</option>
                <option value="technical">Technical Quiz</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Duration (minutes)</span>
              <input name="durationMinutes" type="number" defaultValue={editing?.durationMinutes ?? 45} min={1} max={1440} step={1} required className="w-full rounded-md bg-secondary px-3 py-2" />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-sm text-muted-foreground">Categories</span>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="categories" value={c} defaultChecked={editing?.categories.includes(c)} />
                  {c.replace(/-/g, ' ')}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DifficultyBlock level="easy" defaultCount={editing?.difficultyPlan.easy.count ?? 15} defaultMarks={editing?.difficultyPlan.easy.marksPerQuestion ?? 1} />
            <DifficultyBlock level="medium" defaultCount={editing?.difficultyPlan.medium.count ?? 15} defaultMarks={editing?.difficultyPlan.medium.marksPerQuestion ?? 2} />
            <DifficultyBlock level="hard" defaultCount={editing?.difficultyPlan.hard.count ?? 15} defaultMarks={editing?.difficultyPlan.hard.marksPerQuestion ?? 3} />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-fit rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Draft'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Round</th>
              <th className="p-3 text-left">Duration</th>
              <th className="p-3 text-left">Total Marks</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t._id} className="border-t border-border">
                <td className="p-3 font-medium">{t.title}{!t.availability.ready && <p className="mt-1 text-xs text-amber-700">Question shortage: {t.availability.issues.join('; ')}</p>}</td>
                <td className="p-3">{t.roundType}</td>
                <td className="p-3">{t.durationMinutes} min</td>
                <td className="p-3">{t.totalMarks}</td>
                <td className="p-3">
                  <span className={t.isPublished ? 'text-emerald-700' : 'text-muted-foreground'}>
                    {t.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => { setEditing(t); setShowForm(true); window.scrollTo(0, 0); }} className="mr-3 text-primary">Edit</button>
                  <button disabled={!!publishing || (!t.isPublished && !t.availability.ready)} onClick={() => togglePublish(t._id, t.isPublished)} className="text-primary hover:underline">
                    {t.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </td>
              </tr>
            ))}
            {tests.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  {loading ? 'Loading tests...' : 'No tests created yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DifficultyBlock({ level, defaultCount, defaultMarks }: { level: string; defaultCount: number; defaultMarks: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-sm font-medium uppercase text-muted-foreground">{level}</p>
      <label className="mb-2 block text-xs">
        Question count
        <input name={`${level}Count`} type="number" defaultValue={defaultCount} min={0} max={100} step={1} required className="mt-1 w-full rounded-md bg-secondary px-2 py-1.5 text-sm" />
      </label>
      <label className="block text-xs">
        Marks per question
        <input name={`${level}Marks`} type="number" defaultValue={defaultMarks} min={0.01} max={1000} step="any" required className="mt-1 w-full rounded-md bg-secondary px-2 py-1.5 text-sm" />
      </label>
    </div>
  );
}
