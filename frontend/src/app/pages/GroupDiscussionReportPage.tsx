import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { groupDiscussionApi, type GdSession } from '../services/groupDiscussion';

type Tab = 'overview' | 'transcript' | 'participation' | 'quality' | 'recording' | 'recommendations';

const SCORE_LABELS = [
  { key: 'topicRelevance', label: 'Topic Relevance', max: 25 },
  { key: 'reasoningStructure', label: 'Reasoning / Structure', max: 20 },
  { key: 'responseToOthers', label: 'Response to Others', max: 15 },
  { key: 'participationBalance', label: 'Participation Balance', max: 15 },
  { key: 'communicationClarity', label: 'Communication Clarity', max: 15 },
  { key: 'evidenceExamples', label: 'Evidence / Examples', max: 10 },
];

function barPercent(value: number, max: number) {
  return Math.min(100, Math.round((value / max) * 100));
}

export default function GroupDiscussionReportPage() {
  const { sessionId = '' } = useParams();
  const [session, setSession] = useState<GdSession | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    groupDiscussionApi.get(sessionId).then(setSession);
  }, [sessionId]);

  if (session === undefined) return <div className="p-8">Loading report…</div>;
  if (!session) return <div className="p-8">Discussion not found.</div>;

  const metrics = session.candidateMetrics ?? {};
  const breakdown = session.scoreBreakdown ?? {};
  const overall = session.overallScore;
  const topic =
    session.topicSnapshot?.title || session.topicSnapshot?.title || 'Group Discussion';
  const durationMinutes = session.durationMinutes;
  const candidateTurns = metrics.candidateTurns ?? 0;
  const speakingSeconds = metrics.candidateSpeakingSeconds ?? 0;
  const directReferences = metrics.directReferences ?? 0;
  const passes = metrics.passCount ?? 0;
  const keywordHits = metrics.keywordHits ?? 0;
  const keywordTotal = metrics.keywordTotal ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link to="/group-discussion" className="text-sm text-primary">
        ← Group Discussion
      </Link>

      <header className="rounded-xl border bg-card p-5">
        <h1 className="text-3xl font-bold">Discussion report</h1>
        <p className="mt-1 text-sm text-muted-foreground">{topic}</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Overall score</p>
            <p className="text-5xl font-bold">
              {overall != null ? overall : '—'}
              <span className="text-lg">/100</span>
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {durationMinutes} minutes · {candidateTurns} candidate turns ·
            {speakingSeconds}s speaking time
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(
          [
            ['overview', 'Overview'],
            ['transcript', 'Transcript'],
            ['participation', 'Participation'],
            ['quality', 'Discussion Quality'],
            ['recording', 'Recording'],
            ['recommendations', 'Recommendations'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={`px-3 py-2 text-sm border-b-2 transition-colors ${
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          {overall != null && (
            <div className="flex flex-wrap gap-2">
              {SCORE_LABELS.map(({ key, label, max }) => {
                const value = typeof breakdown[key] === 'number' ? breakdown[key] : 0;
                const pct = barPercent(value, max);
                return (
                  <div key={key} className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{label}</span>
                      <span className="font-mono">{value}/{max}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-width"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Candidate turns</p>
              <p className="text-2xl font-bold">{candidateTurns}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Speaking time</p>
              <p className="text-2xl font-bold">{speakingSeconds}s</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Direct build-ons</p>
              <p className="text-2xl font-bold">{directReferences}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Passes</p>
              <p className="text-2xl font-bold">{passes}</p>
            </div>
          </div>

          {keywordTotal > 0 && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Topic keyword coverage</p>
              <p className="text-lg font-bold">
                {keywordHits} of {keywordTotal} topic keywords mentioned
              </p>
            </div>
          )}

          {session.topicSnapshot?.category && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="font-medium">Category: </span>
              {session.topicSnapshot.category}
              {session.topicSnapshot.difficulty && (
                <>
                  {' '}
                  · <span className="font-medium">Difficulty: </span>
                  {session.topicSnapshot.difficulty}
                </>
              )}
            </div>
          )}

          {session.topicSnapshot?.roleSlugs && session.topicSnapshot.roleSlugs.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="font-medium">Relevant roles: </span>
              {session.topicSnapshot.roleSlugs.join(', ')}
            </div>
          )}
        </section>
      )}

      {/* Transcript */}
      {tab === 'transcript' && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-bold">Transcript</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Chronological record of the discussion.
          </p>
          <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-lg bg-muted/30 p-3 space-y-2">
            {session.turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No turns recorded.</p>
            ) : (
              session.turns.map((t) => (
                <article
                  key={t.sequence}
                  className={
                    t.speakerType === 'CANDIDATE'
                      ? 'rounded bg-primary/10 p-3'
                      : 'rounded bg-muted p-3'
                  }
                >
                  <div className="flex items-center justify-between">
                    <b>{t.speakerName}</b>
                    <span className="text-xs text-muted-foreground">
                      Turn {t.sequence} · {t.source === 'VOICE' ? 'voice' : 'text'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{t.text}</p>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {/* Participation */}
      {tab === 'participation' && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-bold">Participation</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Your contributions</p>
              <ul className="text-sm space-y-1">
                <li>
                  Candidate turns: {candidateTurns}
                </li>
                <li>
                  Speaking time: {speakingSeconds}s
                </li>
                <li>
                  Average response length:{' '}
                  {metrics.averageResponseWords != null
                    ? `${metrics.averageResponseWords} words`
                    : '—'}
                </li>
                <li>
                  Direct build-ons: {directReferences}
                </li>
                <li>
                  Passes: {passes}
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Discussion balance</p>
              <p className="text-sm text-muted-foreground">
                Participation balance is estimated from the number of candidate
                turns relative to the discussion length. It is not a judgment of
                confidence or personality.
              </p>
              {session.participants.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  AI participants: {session.participants.length}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Discussion Quality */}
      {tab === 'quality' && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-bold">Discussion quality</h2>
          <p className="text-sm text-muted-foreground">
            Scores are computed from observable discussion evidence only.
          </p>
          {overall != null ? (
            <div className="space-y-3">
              {SCORE_LABELS.map(({ key, label, max }) => {
                const value = typeof breakdown[key] === 'number' ? breakdown[key] : 0;
                const pct = barPercent(value, max);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{label}</span>
                      <span className="font-mono">{value}/{max}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-width"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Discussion quality scores are available after the discussion is
              completed.
            </p>
          )}

          {session.feedback?.summary && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <span className="font-medium">Summary: </span>
              {session.feedback.summary}
            </div>
          )}
        </section>
      )}

      {/* Recording */}
      {tab === 'recording' && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-bold">Recording</h2>
          {session.recording ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                A recording was attached to this session.
              </p>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Content type</dt>
                  <dd className="font-medium">{session.recording.contentType || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="font-medium">
                    {session.recording.durationSeconds ?? 0}s
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Attached at</dt>
                  <dd className="font-medium">
                    {session.recording.uploadedAt
                      ? new Date(session.recording.uploadedAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Consent</dt>
                  <dd className="font-medium">
                    {session.recordingConsent ? 'Given' : 'Not given'}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Recordings are stored server-side and are accessible only to the
                session owner.
              </p>
            </div>
          ) : session.recordingConsent ? (
            <p className="text-sm text-muted-foreground">
              Recording was consented to, but no recording was attached to this
              session.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Recording was not consented to for this session.
            </p>
          )}
        </section>
      )}

      {/* Recommendations */}
      {tab === 'recommendations' && (
        <section className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-bold">Recommendations</h2>
          {(session.feedback?.strengths?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Key strengths</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {session.feedback.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {(session.feedback?.improvements?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Improvement areas</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {session.feedback.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {(session.feedback?.recommendations?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Recommendations</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {session.feedback.recommendations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {(!session.feedback || session.feedback.strengths.length === 0 &&
            session.feedback.improvements.length === 0 &&
            session.feedback.recommendations.length === 0) && (
            <p className="text-sm text-muted-foreground">
              No qualitative feedback was generated. The score still reflects the
              stored discussion evidence.
            </p>
          )}
        </section>
      )}

      <div className="flex gap-2 justify-end">
        <Link to="/group-discussion">
          <Button variant="outline">New discussion</Button>
        </Link>
      </div>
    </div>
  );
}
