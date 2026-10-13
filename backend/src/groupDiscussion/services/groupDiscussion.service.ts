import { generateJson, AIUnavailableError } from '../../services/ai/provider';

/**
 * Discussion-style AI participants. These are styles, not personality
 * evaluations. The names are generic and interchangeable.
 */
export const AI_PARTICIPANTS = [
  { id: 'aarav', name: 'Aarav', style: 'analytical' },
  { id: 'priya', name: 'Priya', style: 'practical and evidence-focused' },
  { id: 'rohan', name: 'Rohan', style: 'constructive challenger' },
];

/**
 * Choose the next AI speaker so the same participant does not speak twice in a
 * row and participants take turns in a fixed rotation that still leaves the
 * candidate regular openings.
 */
export function nextAiSpeaker(
  participants: Array<{ id: string; name: string; style: string }>,
  turns: Array<{ speakerType: string; speakerId?: string }>,
): { id: string; name: string; style: string } | null {
  if (!participants.length) return null;
  const lastAiId = [...turns]
    .reverse()
    .find((t) => t.speakerType === 'AI')?.speakerId;
  const pool = lastAiId ? participants.filter((p) => p.id !== lastAiId) : participants;
  // Rotate in a stable round-robin so the discussion does not collapse into one
  // vocal participant.
  const candidateAiTurns = turns.filter((t) => t.speakerType === 'AI');
  const idx = candidateAiTurns.length % pool.length;
  return pool[idx % pool.length] ?? pool[0] ?? null;
}

/**
 * Build the most recent transcript window used for context. Keep it bounded so
 * the prompt stays focused on the current discussion.
 */
export function recentTranscript(
  turns: Array<{ speakerName?: string; text?: string }>,
  window = 10,
): string {
  return turns.slice(-window).map((t) => `${t.speakerName ?? ''}: ${t.text ?? ''}`).join('\n');
}

/**
 * Deterministic discussion metrics computed from stored turns only.
 *
 * Gemini does NOT invent these — they are observable counts from the
 * transcript.
 */
export function metrics(
  turns: Array<{ speakerType?: string; text?: string; durationSeconds?: number | null }>,
  keywords: Array<string>,
) {
  const candidate = turns.filter((t) => t.speakerType === 'CANDIDATE');
  const words = candidate.map((t) =>
    String(t.text ?? '').trim().split(/\s+/).filter(Boolean).length,
  );
  const text = candidate.map((t) => String(t.text ?? '')).join(' ').toLowerCase();
  const totalSeconds = candidate.reduce((n, t) => n + (Number(t.durationSeconds) || 0), 0);

  const keywordHits =
    keywords.length ? keywords.filter((k) => k && text.includes(k.toLowerCase())).length : 0;
  const coverage = keywords.length ? Math.min(1, keywordHits / keywords.length) : 0;

  // "Build-ons": turns that directly reference a previous point.
  const builds = candidate.filter(
    (t) =>
      /\b(agree|disagree|building on|as .* said|however|but|to add|following that|that point)\b/i.test(
        String(t.text ?? ''),
      ),
  ).length;

  // Repetition: crude overlap of consecutive candidate turns as a signal only.
  const consecutiveOverlaps: number[] = [];
  for (let i = 1; i < candidate.length; i++) {
    const prev = new Set(
      String(candidate[i - 1].text ?? '').split(/\s+/).filter(Boolean),
    );
    const cur = String(candidate[i].text ?? '').split(/\s+/).filter(Boolean);
    let overlap = 0;
    for (const w of cur) {
      if (prev.has(w)) overlap += 1;
    }
    consecutiveOverlaps.push(overlap);
  }
  const avgOverlap =
    consecutiveOverlaps.length
      ? consecutiveOverlaps.reduce((a, b) => a + b, 0) / consecutiveOverlaps.length
      : 0;

  const passCount = turns.filter(
    (t) =>
      t.speakerType === 'CANDIDATE' &&
      /\b(pass|skip|nothing to add|no comment|move on)\b/i.test(String(t.text ?? '')),
  ).length;

  return {
    candidateTurns: candidate.length,
    candidateSpeakingSeconds: totalSeconds,
    averageResponseWords:
      candidate.length ? Math.round(words.reduce((a, b) => a + b, 0) / candidate.length) : 0,
    keywordCoverage: coverage,
    keywordHits,
    keywordTotal: keywords.length,
    directReferences: builds,
    repetitionOverlap: Math.round(avgOverlap * 10) / 10,
    passCount,
  };
}

/**
 * Score breakdown (observable evidence only).
 *
 * Weights match the spec: Relevance 25, Reasoning/Structure 20, Response to
 * Others 15, Participation Balance 15, Communication Clarity 15,
 * Evidence/Examples 10.
 */
export function score(m: Record<string, number | null | undefined>) {
  const relevance = Math.round((Number(m.keywordCoverage) || 0) * 25);
  const structure = Math.min(20, Math.round((Number(m.averageResponseWords) || 0) / 7));
  const response = Math.min(15, (Number(m.directReferences) || 0) * 5);
  const participation = Math.min(15, (Number(m.candidateTurns) || 0) * 4);
  const clarity = Math.min(15, Math.round((Number(m.averageResponseWords) || 0) / 9));
  const evidence = Math.min(10, (Number(m.directReferences) || 0) * 3);

  const total = relevance + structure + response + participation + clarity + evidence;

  return {
    topicRelevance: relevance,
    reasoningStructure: structure,
    responseToOthers: response,
    participationBalance: participation,
    communicationClarity: clarity,
    evidenceExamples: evidence,
    total: Math.min(100, Math.max(0, total)),
  };
}

/**
 * Ask the AI participant for the next contribution.
 *
 * Returns null when the AI service is unavailable so the discussion can
 * continue in text-only mode rather than failing.
 */
export async function nextAiTurn(input: {
  participant: { id: string; name: string; style: string };
  topic: {
    title?: string;
    description?: string;
    openingContext?: string;
    keywords?: string[];
  };
  turns: Array<{ speakerName?: string; text?: string }>;
  roleSlug?: string;
}): Promise<string | null> {
  const transcript = recentTranscript(input.turns);
  const roleContext =
    input.roleSlug
      ? `You may reference what a ${input.roleSlug.replace(/-/g, ' ')} would care about where relevant, but do not pretend to represent any real company.`
      : '';

  const prompt = [
    `You are ${input.participant.name}, a ${input.participant.style} participant in a professional group discussion.`,
    `Topic: ${input.topic.title || 'Discussion topic'}.`,
    `Context: ${input.topic.openingContext || input.topic.description || 'Present a clear position and respond to other viewpoints.'}`,
    roleContext,
    'Recent transcript:',
    transcript,
    'Return JSON only: {"text":"2-4 spoken sentences responding naturally, adding a concrete point, without personality judgement"}.',
    'Invite the candidate occasionally. Do not claim facts you cannot support. Do not evaluate anyone’s personality, confidence, intelligence, emotion, or employability.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    // A turn is generated inside the POST /turns request, so the AI budget has to
    // fit within the client's timeout: 25s first attempt + the provider's 20s retry
    // budget = 45s worst case, inside the 60s the browser will wait. Measured
    // turn latency is ~3s typical, so 25s leaves room for a slow-but-working call.
    const raw: any = await generateJson(prompt, 25000);
    const text = typeof raw?.text === 'string' ? raw.text.trim() : '';
    return text.slice(0, 1200) || null;
  } catch (e) {
    if (e instanceof AIUnavailableError) return null;
    throw e;
  }
}

/**
 * Qualitative AI feedback derived only from the stored transcript.
 *
 * Gemini may explain transcript QUALITY; it must NOT invent the numeric
 * metrics, which are computed deterministically above.
 */
export async function qualitativeFeedback(session: {
  turns: Array<{ speakerName?: string; text?: string }>;
  topicSnapshot?: { title?: string; description?: string };
  candidateMetrics?: Record<string, unknown>;
}): Promise<{
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  summary: string;
}> {
  const transcript = session.turns
    .map((t) => `${t.speakerName ?? ''}: ${t.text ?? ''}`)
    .join('\n');

  const prompt = [
    'Review this group-discussion transcript using only observable language evidence.',
    'Do not infer personality, emotion, intelligence, confidence, or employability.',
    'Do not invent numbers: the discussion metrics are already computed from the transcript.',
    `Topic: ${session.topicSnapshot?.title || 'Discussion'}`,
    transcript,
    'Return JSON: {"strengths":[string],"improvements":[string],"recommendations":[string],"summary":string}',
  ].join('\n');

  try {
    // Also awaited inside an HTTP request (POST /sessions/:id/end): 25s + the
    // provider's 20s retry budget stays under the browser's 60s timeout.
    const raw: any = await generateJson(prompt, 25000);
    return {
      strengths: Array.isArray(raw?.strengths) ? raw.strengths.map(String) : [],
      improvements: Array.isArray(raw?.improvements) ? raw.improvements.map(String) : [],
      recommendations: Array.isArray(raw?.recommendations) ? raw.recommendations.map(String) : [],
      summary: typeof raw?.summary === 'string' ? raw.summary : '',
    };
  } catch {
    return {
      strengths: [],
      improvements: ['Add more topic-specific evidence and build directly on other participants’ points.'],
      recommendations: ['Practice concise, structured responses.'],
      summary: 'Qualitative AI feedback is unavailable; the score uses stored discussion evidence.',
    };
  }
}

/**
 * Evidence labels that GD may contribute to a candidate’s skill profile.
 *
 * These are communication signals only. They do NOT raise technical skill
 * levels just because a candidate mentioned a technology.
 */
export const GD_EVIDENCE_TYPES = [
  'communication.clarity',
  'communication.discussionReasoning',
  'communication.collaboration',
  'communication.argumentStructure',
] as const;
