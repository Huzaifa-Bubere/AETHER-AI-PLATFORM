import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { codingService } from '../services/coding.service';
import type { ISubmissionSummary, ISubmissionDetail } from '../types';
import { ScorePanel, AstMetricsPanel } from '../components/AnalysisPanels';
import { AstTreeView } from '../components/AstTreeView';

/** AETHER Coding — submission history. */
export function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<ISubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await codingService.getMySubmissions(page, 20);
      if (res.success && res.data) {
        setSubmissions(res.data.submissions);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
      setLoading(false);
    })();
  }, [page]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Submission History</h1>
          <p className="text-sm text-slate-500">Every official submission with full evaluation evidence</p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : submissions.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-slate-400 mb-3">No submissions yet.</p>
            <Link to="/coding/problems"><Button size="sm">Browse Problems</Button></Link>
          </Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {submissions.map(s => (
              <Link key={s._id} to={`/coding/submissions/${s._id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                {s.status === 'Accepted'
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  : <XCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{(s.problem as any)?.title || 'Problem'}</p>
                  <p className="text-xs text-slate-400">
                    {s.language} · {s.passedTests}/{s.totalTests} tests · {new Date(s.submittedAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right shrink-0 text-xs">
                  <p className={s.status === 'Accepted' ? 'text-emerald-600 font-medium' : 'text-rose-500'}>{s.status}</p>
                  <p className="text-slate-400">{s.runtimeMs} ms{s.memoryKb != null ? ` · ${s.memoryKb} KB` : ''}</p>
                  {s.overallScore != null && <p className="text-slate-500">score {s.overallScore}</p>}
                </div>
              </Link>
            ))}
          </Card>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <span className="text-sm text-slate-500 self-center">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** AETHER Coding — submission detail with code, tests, AST, score, explanation. */
export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<ISubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!id) return;
      const res = await codingService.getSubmissionDetail(id);
      if (res.success && res.data) setSubmission(res.data);
      else setNotFound(true);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
  }

  if (notFound || !submission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-slate-600">Submission not found.</p>
        <Link to="/coding/submissions"><Button variant="outline" size="sm">Back to history</Button></Link>
      </div>
    );
  }

  const problem = submission.problem as any;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center gap-3">
          <Link to="/coding/submissions" aria-label="Back to submissions">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{problem?.title || 'Submission'}</h1>
            <p className="text-xs text-slate-400">
              {submission.language} · {new Date(submission.submittedAt).toLocaleString()} · executor: judge0/piston
            </p>
          </div>
          <span className={`ml-auto text-sm px-3 py-1 rounded-full font-medium ${
            submission.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {submission.status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center"><p className="text-lg font-bold">{submission.passedTests}/{submission.totalTests}</p><p className="text-xs text-slate-400">Tests Passed</p></Card>
          <Card className="p-3 text-center"><p className="text-lg font-bold">{submission.runtimeMs} ms</p><p className="text-xs text-slate-400">Runtime</p></Card>
          <Card className="p-3 text-center"><p className="text-lg font-bold">{submission.memoryKb != null ? `${submission.memoryKb} KB` : '—'}</p><p className="text-xs text-slate-400">Memory</p></Card>
        </div>

        {submission.astAnalysis && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-4">
            {submission.astAnalysis.ast ? (
              <AstTreeView tree={submission.astAnalysis.ast} height="360px" />
            ) : (
              <Card className="p-4 text-sm text-slate-400">AST tree unavailable — {submission.astAnalysis.reason}</Card>
            )}
            <AstMetricsPanel analysis={submission.astAnalysis} />
          </div>
        )}

        <ScorePanel score={submission.scoreBreakdown} explanation={submission.explanation} />

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Submitted Code</p>
          <pre className="rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{submission.sourceCode}</pre>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Test Results</p>
          <div className="space-y-1.5">
            {submission.tests?.map(t => (
              <div key={t.index} className="flex items-center gap-2 text-xs">
                {t.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                <span className="text-slate-600">Test {t.index + 1}{t.hidden ? ' (hidden)' : ''}</span>
                <span className="text-slate-400 ml-auto">{t.passed ? 'Passed' : 'Failed'}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
