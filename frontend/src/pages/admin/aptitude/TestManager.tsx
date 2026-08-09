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

interface TestRow {
  _id: string;
  title: string;
  roundType: string;
  categories: string[];
  durationMinutes: number;
  totalMarks: number;
  isPublished: boolean;
}

export default function TestManager() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  const fetchTests = async () => {
    const { data } = await api.get('/api/admin/aptitude/tests');
    setTests(data.tests);
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const categories = form.getAll('categories') as string[];

    const payload = {
      title: form.get('title'),
      roundType: form.get('roundType'),
      categories,
      durationMinutes: Number(form.get('durationMinutes')),
      difficultyPlan: {
        easy: { count: Number(form.get('easyCount')), marksPerQuestion: Number(form.get('easyMarks')) },
        medium: { count: Number(form.get('mediumCount')), marksPerQuestion: Number(form.get('mediumMarks')) },
        hard: { count: Number(form.get('hardCount')), marksPerQuestion: Number(form.get('hardMarks')) },
      },
    };

    await api.post('/api/admin/aptitude/tests', payload);
    setShowForm(false);
    fetchTests();
  };

  const togglePublish = async (id: string, isPublished: boolean) => {
    await api.patch(`/api/admin/aptitude/tests/${id}/publish`, { isPublished: !isPublished });
    fetchTests();
  };

  return (
    <div className="min-h-screen bg-background px-6 py-20 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Test Management</h1>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          + Create Test
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid gap-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Title</span>
              <input name="title" required className="w-full rounded-md bg-secondary px-3 py-2" placeholder="Round 1: Aptitude" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Round Type</span>
              <select name="roundType" className="w-full rounded-md bg-secondary px-3 py-2">
                <option value="aptitude">Aptitude</option>
                <option value="technical">Technical Quiz</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Duration (minutes)</span>
              <input name="durationMinutes" type="number" defaultValue={45} className="w-full rounded-md bg-secondary px-3 py-2" />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-sm text-muted-foreground">Categories</span>
            <div className="flex flex-wrap gap-3">
              {CATEGORIES.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="categories" value={c} />
                  {c.replace(/-/g, ' ')}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <DifficultyBlock level="easy" defaultCount={15} defaultMarks={1} />
            <DifficultyBlock level="medium" defaultCount={15} defaultMarks={2} />
            <DifficultyBlock level="hard" defaultCount={15} defaultMarks={3} />
          </div>

          <button type="submit" className="w-fit rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
            Create Test
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border">
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
                <td className="p-3 font-medium">{t.title}</td>
                <td className="p-3">{t.roundType}</td>
                <td className="p-3">{t.durationMinutes} min</td>
                <td className="p-3">{t.totalMarks}</td>
                <td className="p-3">
                  <span className={t.isPublished ? 'text-emerald-700' : 'text-muted-foreground'}>
                    {t.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => togglePublish(t._id, t.isPublished)} className="text-primary hover:underline">
                    {t.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </td>
              </tr>
            ))}
            {tests.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  No tests created yet.
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
        <input name={`${level}Count`} type="number" defaultValue={defaultCount} className="mt-1 w-full rounded-md bg-secondary px-2 py-1.5 text-sm" />
      </label>
      <label className="block text-xs">
        Marks per question
        <input name={`${level}Marks`} type="number" defaultValue={defaultMarks} className="mt-1 w-full rounded-md bg-secondary px-2 py-1.5 text-sm" />
      </label>
    </div>
  );
}