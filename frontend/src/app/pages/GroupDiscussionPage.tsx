import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { groupDiscussionApi, type GdTopic } from '../services/groupDiscussion';

const DISCUSSION_TYPES = [
  { value: 'ai', label: 'AI Group Discussion' },
] as const;

const ROLE_OPTIONS = [
  { value: 'backend-developer', label: 'Backend Developer' },
  { value: 'frontend-developer', label: 'Frontend Developer' },
  { value: 'full-stack-developer', label: 'Full-Stack Developer' },
  { value: 'data-analyst', label: 'Data Analyst' },
  { value: 'data-engineer', label: 'Data Engineer' },
  { value: 'devops-engineer', label: 'DevOps Engineer' },
  { value: 'ai-ml-engineer', label: 'AI/ML Engineer' },
  { value: 'product-manager', label: 'Product Manager' },
  { value: 'cloud-engineer', label: 'Cloud Engineer' },
];

const CATEGORY_OPTIONS = [
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'WORKPLACE', label: 'Workplace' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'ABSTRACT', label: 'Abstract' },
  { value: 'ROLE_SPECIFIC', label: 'Role Specific' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

const DURATION_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
];

const AI_PARTICIPANT_OPTIONS = [
  { value: 2, label: '2 AI participants' },
  { value: 3, label: '3 AI participants' },
];

export default function GroupDiscussionPage() {
  const [topics, setTopics] = useState<GdTopic[]>([]);
  const [topicId, setTopicId] = useState('');
  const [discussionType, setDiscussionType] = useState<string>('ai');
  const [roleSlug, setRoleSlug] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [aiParticipants, setAiParticipants] = useState(3);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const nav = useNavigate();

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (category) params.category = category;
      if (difficulty) params.difficulty = difficulty;
      if (roleSlug) params.roleSlug = roleSlug;
      const res = await groupDiscussionApi.topics(params);
      setTopics(Array.isArray(res) ? res : []);
      if (!topicId && res.length) {
        setTopicId(res[0]._id);
      }
    } catch (e: any) {
      setError(e.message || 'Unable to load discussion topics.');
    } finally {
      setTopicsLoading(false);
    }
  }, [category, difficulty, roleSlug, topicId]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const start = async () => {
    try {
      setError('');
      const s = await groupDiscussionApi.create({
        topicId,
        durationMinutes,
        aiParticipants,
        roleSlug: roleSlug || undefined,
        difficulty: difficulty || undefined,
      });
      // Consent has to reach the server: the room only allows recording once the
      // session records consent, so ticking the box here previously had no effect.
      if (recordingConsent) {
        try {
          await groupDiscussionApi.consentRecording(s._id, true);
        } catch {
          // Not fatal — consent can still be granted inside the discussion room.
        }
      }
      nav(`/group-discussion/${s._id}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const selectedTopic = topics.find((t) => t._id === topicId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-3xl font-bold">AI Group Discussion Practice</h1>
        <p className="mt-2 text-muted-foreground">
          Practice structured, role-relevant arguments with adaptive AI participants.
          Feedback is based on your discussion evidence.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Discussion type
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={discussionType}
              onChange={(e) => setDiscussionType(e.target.value)}
            >
              {DISCUSSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium">
            Target role
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={roleSlug}
              onChange={(e) => setRoleSlug(e.target.value)}
            >
              <option value="">Any role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Topic category
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setTopicId('');
              }}
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium">
            Difficulty
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value);
                setTopicId('');
              }}
            >
              <option value="">Any difficulty</option>
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Discussion topic</label>
          {topicsLoading ? (
            <p className="text-sm text-muted-foreground">Loading topics…</p>
          ) : topics.length === 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No published topics are currently available from the API.
              An administrator can publish topics, or restart the backend to
              initialize the database-backed practice library.
              <button className="ml-1 underline" onClick={() => void loadTopics()}>
                Retry
              </button>
            </div>
          ) : (
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!topicId}
            >
              <option value="">{topicId ? 'Select a topic' : 'Select a topic'}</option>
              {topics.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title}
                  <span className="ml-2 text-muted-foreground">
                    · {t.difficulty} · {t.category}
                  </span>
                </option>
              ))}
            </select>
          )}
          {selectedTopic && (
            <div className="mt-2 text-sm text-muted-foreground">
              <p>{selectedTopic.description}</p>
              {selectedTopic.openingContext && (
                <p className="mt-1 rounded bg-muted p-2">
                  <span className="font-medium">Opening context: </span>
                  {selectedTopic.openingContext}
                </p>
              )}
              {selectedTopic.brandingNote && (
                <p className="mt-1 text-xs italic">{selectedTopic.brandingNote}</p>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Duration
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium">
            Number of AI participants
            <select
              className="mt-1 w-full rounded border bg-background p-2"
              value={aiParticipants}
              onChange={(e) => setAiParticipants(Number(e.target.value))}
            >
              {AI_PARTICIPANT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="space-y-2 rounded border bg-muted/50 p-4">
          <legend className="text-sm font-medium">Recording consent</legend>
          <p className="text-xs text-muted-foreground">
            Speaking is the primary way to take part. Recording your own audio is
            optional — no recording is captured unless you consent here or in the
            discussion room. Video is never recorded.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border"
              checked={recordingConsent}
              onChange={(e) => setRecordingConsent(e.target.checked)}
            />
            <span className="text-sm">
              I consent to microphone recording of my speaking turns for this
              practice session.
            </span>
          </label>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button disabled={!topicId || topicsLoading} onClick={start}>
          Start discussion
        </Button>
      </section>

      <section className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How this works</p>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          <li>You and two or three AI discussion partners take controlled turns.</li>
          <li>AI participants are discussion styles, not personality evaluations.</li>
          <li>Text is always supported. Microphone is available when your browser allows it.</li>
          <li>The discussion is scored from observable evidence only — no personality, emotion, or confidence inference.</li>
        </ul>
      </section>
    </div>
  );
}
