import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../lib/aptitudeApi';

interface TestSummary {
  _id: string; title: string; roundType: string; categories: string[];
  durationMinutes: number; totalMarks: number;
  difficultyPlan: Record<string, { count: number }>;
  availability: { ready: boolean };
  ragTopic?: string;
}
interface AttemptSummary {
  attemptId: string; testId: string; title: string; status: string;
  startedAt: string; score: number; totalMarks: number;
}
export default function TestSelection() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [reload, setReload] = useState(0);
  const starting = useRef(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const round = searchParams.get('round') === 'technical' ? 'technical' : 'aptitude';
  const visibleTests = tests.filter(test => test.roundType === round);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    Promise.all([api.get('/api/aptitude/tests'), api.get('/api/aptitude/attempts', { params: { page } })])
      .then(([tests, history]) => { if (active) { setTests(tests.data.tests); setAttempts(history.data.attempts); setPages(history.data.pages); } })
      .catch(error => { if (active) setError(error?.response?.data?.message || error?.response?.data?.error || 'Could not load aptitude tests. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, reload]);

  const handleStart = async (testId: string) => {
    if (starting.current) return;
    starting.current = true; setStartingId(testId); setError(null);
    try {
      const { data } = await api.post(`/api/aptitude/tests/${testId}/start`, {}, { timeout: 300000 });
      navigate(`/aptitude/attempts/${data.attemptId}`);
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.response?.data?.error || 'Could not start this test. Please try again.');
    } finally { starting.current = false; setStartingId(null); }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-20 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <div><h1 className="text-2xl font-bold">{round === 'technical' ? 'Technical Assessment' : 'Aptitude'}</h1>
          <p className="mt-1 text-muted-foreground">Timed tests with saved answers and question reviews.</p></div>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">Before starting: the timer continues if you leave. Switching tabs or minimizing the exam submits your attempt automatically.</p>
        {error && <div role="alert" className="text-destructive">{error} <button onClick={() => setReload(v => v + 1)} className="underline">Retry</button></div>}
        {loading ? <p>Loading tests...</p> : visibleTests.length === 0 ? <p>No {round} tests are published yet.</p> :
          <div className="grid gap-4">{visibleTests.map(test => {
            const active = attempts.find(a => a.testId === test._id && a.status === 'in-progress');
            return <div key={test._id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5">
              <div><h2 className="font-semibold">{test.title}</h2>
                {test.ragTopic && <p className="text-sm text-primary">Source-grounded questions · {test.ragTopic}</p>}
                <p className="mt-1 text-sm text-muted-foreground">{Object.values(test.difficultyPlan).reduce((sum, level) => sum + level.count, 0)} questions | {test.durationMinutes} min | {test.totalMarks} marks</p>
                <p className="text-sm text-muted-foreground">{test.categories.map(c => c.replace(/-/g, ' ')).join(', ')}</p>
                {!test.availability.ready && !active && <p className="mt-2 text-sm text-amber-700">Temporarily unavailable while the question bank is updated.</p>}
              </div>
              <button onClick={() => handleStart(test._id)} disabled={!!startingId || (!active && !test.availability.ready)} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {startingId === test._id ? (test.ragTopic ? 'Preparing questions…' : 'Starting...') : active ? 'Resume Test' : 'Start Test'}
              </button>
            </div>;
          })}</div>}
        <section className="space-y-3"><h2 className="text-xl font-semibold">Your Attempts</h2>
          {!loading && !attempts.length && <p className="text-muted-foreground">Your saved tests and results will appear here.</p>}
          {attempts.map(attempt => <div key={attempt.attemptId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
            <div><p className="font-medium">{attempt.title}</p><p className="text-sm text-muted-foreground">{new Date(attempt.startedAt).toLocaleString()} | {attempt.status === 'completed' ? `${attempt.score}/${attempt.totalMarks} marks` : 'In progress'}</p></div>
            <Link to={`/aptitude/attempts/${attempt.attemptId}${attempt.status === 'completed' ? '/result' : ''}`} className="text-primary underline">{attempt.status === 'completed' ? 'View Result' : 'Resume Test'}</Link>
          </div>)}
          {pages > 1 && <div className="flex gap-4"><button disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button></div>}
        </section>
      </div>
    </div>
  );
}
