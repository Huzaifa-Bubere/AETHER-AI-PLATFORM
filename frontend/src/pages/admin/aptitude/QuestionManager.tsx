import { Link } from 'react-router-dom';
import { useEffect, useState, useRef, FormEvent } from 'react';
import api, { aptitudeImageUrl } from '../../../lib/aptitudeApi';


const CATEGORIES = [
  'quantitative-aptitude',
  'logical-reasoning',
  'verbal-ability',
  'data-interpretation',
  'puzzle-solving',
  'technical-quiz',
];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const ROUND_TYPES = ['aptitude', 'technical'];

function extractErrorMessage(err: any): string {
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.';
}

interface QuestionRow {
  _id: string;
  imageUrl: string;
  questionText?: string;
  options?: Record<string, string>;
  explanation?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const fetchQuestions = async () => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await api.get('/api/admin/aptitude/questions', { params: { ...params, page, limit: 20 } });
      if (current !== requestId.current) return;
      setError(null);
      setQuestions(data.questions);
      setPages(Math.max(1, data.pages));
      if (page > Math.max(1, data.pages)) setPage(Math.max(1, data.pages));
    } catch (err) {
      if (current === requestId.current) setError(extractErrorMessage(err));
    } finally { if (current === requestId.current) setLoading(false); }
  };

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);
  useEffect(() => { setPage(1); }, [filters]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const file = form.get('image') as File;
      if (!file?.size) form.delete('image');
      if (editing) await api.put(`/api/admin/aptitude/questions/${editing._id}`, form);
      else await api.post('/api/admin/aptitude/questions', form);
      setShowUploadForm(false);
      setEditing(null);
      setPreview(null);
      await fetchQuestions();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, status: 'active' | 'inactive') => {
    try {
      await api.patch(`/api/admin/aptitude/questions/${id}/status`, { status: status === 'active' ? 'inactive' : 'active' });
      await fetchQuestions();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    try {
      await api.delete(`/api/admin/aptitude/questions/${id}`);
      await fetchQuestions();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-20 text-foreground">
      <Link to="/admin/aptitude" className="mb-4 inline-block text-sm text-primary">Back to Aptitude Admin</Link>
      <div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-xl font-bold">Question Bank</h1>
        <div className="flex items-center gap-3 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
        <div className="flex gap-2">
          <BulkUploadButton onDone={fetchQuestions} onError={setError} />
          <button
            onClick={() => { setEditing(null); setPreview(null); setShowUploadForm(v => !v); }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            + Add Question
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-red-50 p-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {showUploadForm && (
        <form key={editing?._id || 'new'} onSubmit={handleUpload} className="mb-6 grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
          <p className="text-sm text-muted-foreground sm:col-span-2">Use a complete question image, or enter a statement and all four options. Test difficulty weights determine the exam marks.</p>
          <Field label="Question Image (optional)">
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => setPreview(e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : null)}
              className="w-full text-sm"
            />
          </Field>
          <Field label="Round Type">
            <Select name="roundType" options={ROUND_TYPES} defaultValue={editing?.roundType} />
          </Field>
          <Field label="Category">
            <Select name="category" options={CATEGORIES} defaultValue={editing?.category} />
          </Field>
          <Field label="Difficulty">
            <Select name="difficulty" options={DIFFICULTIES} defaultValue={editing?.difficulty} />
          </Field>
          <Field label="Correct Option">
            <Select name="correctOption" options={['A', 'B', 'C', 'D']} defaultValue={editing?.correctOption} />
          </Field>
          <Field label="Marks">
            <input name="marks" type="number" defaultValue={editing?.marks ?? 1} min={0.01} max={1000} step="any" required className="w-full rounded-md bg-secondary px-3 py-2 text-sm" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Question statement"><textarea name="questionText" defaultValue={editing?.questionText} rows={3} className="w-full rounded-md bg-secondary px-3 py-2" /></Field>
          </div>
          {['A', 'B', 'C', 'D'].map(option => <Field key={option} label={`Option ${option}`}>
            <input name={`option${option}`} defaultValue={editing?.options?.[option]} className="w-full rounded-md bg-secondary px-3 py-2" />
          </Field>)}
          {editing?.imageUrl && !preview && <img src={aptitudeImageUrl(editing.imageUrl)} alt="Current question" className="max-h-40 sm:col-span-2" />}
          <div className="sm:col-span-2">
            <Field label="Explanation">
              <textarea name="explanation" defaultValue={editing?.explanation} rows={2} className="w-full rounded-md bg-secondary px-3 py-2 text-sm" />
            </Field>
          </div>
          {preview && <img src={preview} alt="preview" className="max-h-40 rounded-lg sm:col-span-2" />}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Question'}
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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Question</th>
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
                  {q.imageUrl && <img src={aptitudeImageUrl(q.imageUrl)} alt="Question" className="h-12 w-16 rounded object-cover" />}
                  <p className="max-w-xs line-clamp-3 whitespace-pre-wrap">{q.questionText}</p>
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
                  <button disabled={q.timesUsed > 0} title={q.timesUsed > 0 ? 'Used questions are preserved for results.' : 'Edit question'} onClick={() => { setEditing(q); setPreview(null); setShowUploadForm(true); window.scrollTo(0, 0); }} className="mr-3 text-primary disabled:opacity-40">Edit</button>
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
                  {loading ? 'Loading questions...' : 'No questions match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkUploadButton({ onDone, onError }: { onDone: () => void; onError: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [metaJson, setMetaJson] = useState(
    '[\n  { "roundType": "aptitude", "category": "quantitative-aptitude", "difficulty": "easy", "correctOption": "A", "marks": 1, "explanation": "" }\n]'
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    setSaving(true);
    try {
      const metadata = JSON.parse(metaJson);
      if (!Array.isArray(metadata)) throw new Error('Metadata must be a JSON array.');
      const form = new FormData();
      form.set('meta', metaJson);
      selectedFiles.forEach(file => form.append('images', file));
      const { data } = await api.post('/api/admin/aptitude/questions/bulk', form);
      if (data.failedCount > 0) {
        const failedIndices = new Set<number>(data.failed.map((failure: { index: number }) => failure.index));
        setMetaJson(JSON.stringify(metadata.filter((_, index) => failedIndices.has(index)), null, 2));
        setSelectedFiles(selectedFiles.filter((_, index) => failedIndices.has(index)));
        setLocalError(`${data.createdCount} saved. Only the ${data.failedCount} failed entries remain below; correct them and retry. ${data.failed.map((failure: { error: string }) => failure.error).join(' ')}`);
      } else {
        setSelectedFiles([]);
        setOpen(false);
      }
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Bulk upload failed.';
      setLocalError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
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
              The array length must match the image count. Images are optional when every entry has questionText and all four options (A, B, C, D).
            </p>
            {localError && (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-red-50 p-2 text-xs text-destructive">{localError}</div>
            )}
            <input type="file" name="images" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={e => setSelectedFiles(Array.from(e.target.files || []))} className="mb-3 w-full text-sm" />
            <p className="mb-3 text-xs text-muted-foreground">Queued images: {selectedFiles.length ? selectedFiles.map(file => file.name).join(', ') : 'None (text questions)'}</p>
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
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Uploading…' : 'Upload All'}
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

function Select({ name, options, defaultValue }: { name: string; options: string[]; defaultValue?: string }) {
  return (
    <select name={name} defaultValue={defaultValue} className="w-full rounded-md bg-secondary px-3 py-2 text-sm" required>
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
