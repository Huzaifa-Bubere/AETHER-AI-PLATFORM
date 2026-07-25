import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

interface TestSummary {
  _id: string;
  title: string;
  roundType: string;
  categories: string[];
  durationMinutes: number;
  totalMarks: number;
}

export default function TestSelection() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/api/aptitude/tests')
      .then(({ data }) => setTests(data.tests))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async (testId: string) => {
    setStartingId(testId);
    try {
      const { data } = await api.post(`/api/aptitude/tests/${testId}/start`);
      navigate(`/aptitude/attempts/${data.attemptId}`);
    } finally {
      setStartingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold">Aptitude & Technical Tests</h1>
        <p className="mt-1 text-neutral-400">Timed, randomized tests — every attempt gets a fresh question set.</p>

        {loading ? (
          <p className="mt-8 text-neutral-500">Loading tests…</p>
        ) : tests.length === 0 ? (
          <p className="mt-8 text-neutral-500">No tests are published yet. Check back soon.</p>
        ) : (
          <div className="mt-8 grid gap-4">
            {tests.map((t) => (
              <div key={t._id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                <div>
                  <h2 className="font-semibold">{t.title}</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {t.categories.map((c) => c.replace(/-/g, ' ')).join(', ')} · {t.durationMinutes} min · {t.totalMarks} marks
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs uppercase text-neutral-400">
                    {t.roundType}
                  </span>
                </div>
                <button
                  onClick={() => handleStart(t._id)}
                  disabled={startingId === t._id}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                >
                  {startingId === t._id ? 'Starting…' : 'Start Test'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
