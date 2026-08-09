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
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const ROUND_TYPES = ['aptitude', 'technical', 'coding'];

interface QuestionRow {
  _id: string;
  imageUrl: string;
  roundType: string;
  category: string;
  difficulty: string;
  correctOption: string;
  marks: number;
  status: 'active' | 'inactive';
  timesUsed: number;
}

export default function QuestionManager() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [filters, setFilters] = useState({ roundType: '', category: '', difficulty: '', status: '' });
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fetchQuestions = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const { data } = await api.get('/api/admin/aptitude/questions', { params });
    setQuestions(data.questions);
  };

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await api.post('/api/admin/aptitude/questions', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setShowUploadForm(false);
    setPreview(null);
    fetchQuestions();
  };

  const toggleStatus = async (id: string, status: 'active' | 'inactive') => {
    await api.patch(`/api/admin/aptitude/questions/${id}/status`, { status: status === 'active' ? 'inactive' : 'active' });
    fetchQuestions();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    await api.delete(`/api/admin/aptitude/questions/${id}`);
    fetchQuestions();
  };

  return (
    <div className="min-h-screen bg-background px-6 py-20 text-foreground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Question Bank</h1>
        <div className="flex gap-2">
          <BulkUploadButton onDone={fetchQuestions} />
          <button
            onClick={() => setShowUploadForm((v) => !v)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            + Add Question
          </button>
        </div>
      </div>

      {showUploadForm && (
        <form onSubmit={handleUpload} className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <Field label="Question Image">
            <input
              type="file"
              name="image"
              accept="image/*"
              required
              onChange={(e) => setPreview(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null)}
              className="w-full text-sm"
            />
          </Field>
          <Field label="Round Type">
            <Select name="roundType" options={ROUND_TYPES} />
          </Field>
          <Field label="Category">
            <Select name="category" options={CATEGORIES} />
          </Field>
          <Field label="Difficulty">
            <Select name="difficulty" options={DIFFICULTIES} />
          </Field>
          <Field label="Correct Option">
            <Select name="correctOption" options={['A', 'B', 'C', 'D']} />
          </Field>
          <Field label="Marks">
            <input name="marks" type="number" defaultValue={1} min={0} className="w-full rounded-md bg-secondary px-3 py-2 text-sm" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Explanation">
              <textarea name="explanation" rows={2} className="w-full rounded-md bg-secondary px-3 py-2 text-sm" />
            </Field>
          </div>
          {preview && <img src={preview} alt="preview" className="max-h-40 rounded-lg sm:col-span-2" />}
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">
              Save Question
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterSelect value={filters.roundType} onChange={(v) => setFilters({ ...filters, roundType: v })} options={ROUND_TYPES} placeholder="All rounds" />
        <FilterSelect value={filters.category} onChange={(v) => setFilters({ ...filters, category: v })} options={CATEGORIES} placeholder="All categories" />
        <FilterSelect value={filters.difficulty} onChange={(v) => setFilters({ ...filters, difficulty: v })} options={DIFFICULTIES} placeholder="All difficulties" />
        <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={['active', 'inactive']} placeholder="All statuses" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Image</th>
              <th className="p-3 text-left">Round</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-left">Difficulty</th>
              <th className="p-3 text-left">Answer</th>
              <th className="p-3 text-left">Marks</th>
              <th className="p-3 text-left">Used</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q._id} className="border-t border-border">
                <td className="p-3">
                  <img src={q.imageUrl} alt="" className="h-12 w-16 rounded object-cover" />
                </td>
                <td className="p-3">{q.roundType}</td>
                <td className="p-3">{q.category.replace(/-/g, ' ')}</td>
                <td className="p-3 uppercase">{q.difficulty}</td>
                <td className="p-3">{q.correctOption}</td>
                <td className="p-3">{q.marks}</td>
                <td className="p-3">{q.timesUsed}</td>
                <td className="p-3">
                  <span className={q.status === 'active' ? 'text-emerald-700' : 'text-muted-foreground'}>{q.status}</span>
                </td>
                <td className="p-3">
                  <button onClick={() => toggleStatus(q._id, q.status)} className="mr-3 text-primary hover:underline">
                    {q.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => remove(q._id)} className="text-destructive hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  No questions match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkUploadButton({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [metaJson, setMetaJson] = useState(
    '[\n  { "roundType": "aptitude", "category": "quantitative-aptitude", "difficulty": "easy", "correctOption": "A", "marks": 1, "explanation": "" }\n]'
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    form.set('meta', metaJson);
    await api.post('/api/admin/aptitude/questions/bulk', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    setOpen(false);
    onDone();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold hover:bg-muted">
        Bulk Upload
      </button>
      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-background/70 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl border border-border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Bulk Upload Questions</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Select images in the exact order you list them in the meta JSON below (image #1 ↔ meta entry #1, etc).
            </p>
            <input type="file" name="images" accept="image/*" multiple required className="mb-3 w-full text-sm" />
            <textarea
              value={metaJson}
              onChange={(e) => setMetaJson(e.target.value)}
              rows={8}
              className="w-full rounded-md bg-secondary p-3 font-mono text-xs"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold">
                Upload All
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Select({ name, options }: { name: string; options: string[] }) {
  return (
    <select name={name} className="w-full rounded-md bg-secondary px-3 py-2 text-sm" required>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/-/g, ' ')}
        </option>
      ))}
    </select>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md bg-secondary px-3 py-2 text-sm">
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace(/-/g, ' ')}
        </option>
      ))}
    </select>
  );
}