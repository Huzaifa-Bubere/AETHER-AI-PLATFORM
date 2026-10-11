import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, Calendar, Clock, Award, Eye, Video, Loader2, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import adaptiveInterviewApi from '../../lib/adaptiveInterviewApi';

/**
 * AETHER History (read-only).
 *
 * This page shows work that has ALREADY been completed. Interview creation lives
 * at /interview and is deliberately NOT offered here — there is no "Start
 * Interview" action on this page (spec §9A/§9B).
 *
 * Interview history has exactly ONE source: the canonical adaptive interview
 * system. Legacy /interview-setup + /interview-room flows are not surfaced.
 */

const READINESS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  'placement-ready': { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Placement Ready' },
  strong: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Strong' },
  competent: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Competent' },
  developing: { bg: 'bg-orange-50', text: 'text-orange-700', label: 'Developing' },
  'needs-work': { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Needs Work' },
};

interface HistoryItem {
  _id: string;
  domain: string;
  role?: string;
  roleSlug?: string;
  difficulty?: string;
  interviewType?: string;
  status: string;
  plannedQuestions?: number;
  answeredCount?: number;
  overallScore?: number | null;
  domainReadiness?: string | null;
  createdAt: string;
  hasRecording?: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'in-progress': 'bg-blue-50 text-blue-700 border border-blue-200',
};

export function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adaptiveInterviewApi.getHistory(page, 10)
      .then(res => {
        if (cancelled) return;
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotalPages(res.pagination?.totalPages || 1);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Could not load your history.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page]);

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen pb-20 px-4 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading your interview history…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 px-4 bg-background text-foreground">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">AI Mock Interview History</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Completed and in-progress AI mock interviews. This page is a read-only record — start a new interview from
              the Interview page.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/interview')} className="w-fit text-sm">
            <Brain className="w-4 h-4 mr-2" /> Go to Interviews
          </Button>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {items.length === 0 ? (
          <Card className="p-12 text-center rounded-2xl">
            <AlertCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-1">No interviews yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              You haven't completed an AI mock interview yet. Interview creation lives on the Interview page — this page
              only records completed work.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {items.map(item => {
              const id = item._id;
              const readiness = item.domainReadiness ? READINESS_STYLES[item.domainReadiness] : null;
              const statusClass = STATUS_STYLES[item.status] || 'bg-secondary text-muted-foreground border border-border';
              return (
                <Card key={id} className="p-5 rounded-2xl">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Brain className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold truncate">
                            {item.role || 'AI Mock Interview'} · {item.domain}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {item.interviewType || 'technical'} · {item.difficulty || 'medium'} difficulty
                          </p>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${statusClass}`}>
                          {item.status}
                        </span>
                        {readiness && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${readiness.bg} ${readiness.text}`}>
                            {readiness.label}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(item.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {item.answeredCount ?? 0} of {item.plannedQuestions ?? 0} questions answered
                        </span>
                        {item.overallScore != null && (
                          <span className="flex items-center gap-1.5 font-bold text-primary">
                            <Award className="w-3.5 h-3.5" /> Score: {item.overallScore}/100
                          </span>
                        )}
                        {item.hasRecording && (
                          <span className="flex items-center gap-1.5 font-semibold text-violet-600">
                            <Video className="w-3.5 h-3.5" /> Recording available
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 items-center shrink-0 flex-wrap">
                      <Button size="sm" onClick={() => navigate(`/interview/${id}/report`)} className="text-xs font-semibold">
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> View Report
                      </Button>
                      {item.hasRecording && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/interview/${id}/report?tab=recording`)}
                          className="text-xs font-semibold"
                        >
                          <Video className="w-3.5 h-3.5 mr-1.5" /> View Recording
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
