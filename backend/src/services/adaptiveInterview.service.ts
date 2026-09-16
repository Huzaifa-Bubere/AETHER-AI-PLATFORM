import { GoogleGenerativeAI } from '@google/generative-ai';
import { generationModel } from './ai/provider';
import AdaptiveInterviewModel from '../models/AdaptiveInterview';
import {
  IAdaptiveInterview, IAdaptiveQuestion, IPlanItem, IProctorEvent,
  computeIntegrityScore,
} from '../models/AdaptiveInterview';

// ── Public types ─────────────────────────────────────────────────────────────

export interface Evaluation {
  scores: { correctness: number; depth: number; communication: number; confidence: number };
  overallScore: number;
  verdict: 'poor' | 'below-average' | 'average' | 'good' | 'excellent';
  strengths: string[];
  improvements: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  aiSummary: string;
  nextFocus: string | null;
  source: 'ai' | 'heuristic';
}

export interface AdaptiveDecision {
  action: 'continue' | 'end';
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  depth: 'starter' | 'follow-up' | 'deep-dive' | 'scenario';
  reason: string;
}

// ── Small helpers ────────────────────────────────────────────────────────────

const clamp = (n: unknown, min = 0, max = 100): number => Math.max(min, Math.min(max, Math.round(Number(n) || 0)));

export function verdictFor(score: number): Evaluation['verdict'] {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'average';
  if (score >= 35) return 'below-average';
  return 'poor';
}

function extractJson<T>(text: string): T | null {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch { /* fall through */ } }
    return null;
  }
}

function callModel(prompt: string, timeoutMs = 30000): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Promise.resolve(null);
  try {
    const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: generationModel() });
    return model.generateContent(prompt, { timeout: timeoutMs })
      .then(r => r.response.text())
      .catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function pickTopics(plan: IPlanItem[]): string[] {
  return plan.map(p => p.topic).filter(Boolean);
}

// ── 1. Domain plan generation ────────────────────────────────────────────────

/** Ask Gemini for the key interview topics of a domain; deterministic fallback keeps the flow usable offline. */
export async function generateDomainPlan(domain: string, difficulty: string, questionCount: number): Promise<IPlanItem[]> {
  const fallback: Record<string, string[]> = {
    'Data Structures & Algorithms': ['Arrays & Strings', 'Linked Lists', 'Trees & BST', 'Graphs & BFS/DFS', 'Dynamic Programming'],
    'Web Development': ['HTML/CSS Fundamentals', 'JavaScript Core', 'React Framework', 'Node.js & APIs', 'Databases'],
    'DBMS': ['SQL Basics', 'Joins & Aggregations', 'Normalization', 'Indexes & Performance', 'Transactions & ACID'],
    'Operating Systems': ['Processes & Threads', 'CPU Scheduling', 'Memory Management', 'Deadlocks', 'File Systems'],
    'Computer Networks': ['OSI & TCP/IP Layers', 'HTTP/HTTPS', 'TCP vs UDP', 'Routing & Switching', 'Network Security'],
    'Java': ['OOP Concepts', 'Collections Framework', 'Exception Handling', 'Multithreading', 'JVM Internals'],
    Python: ['Data Types & Structures', 'Functions & Generators', 'OOP in Python', 'Decorators & Iterators', 'Standard Library'],
    'Machine Learning': ['Supervised Learning', 'Model Evaluation', 'Feature Engineering', 'Overfitting & Regularization', 'Neural Networks'],
    'OOP': ['Classes & Objects', 'Encapsulation & Abstraction', 'Inheritance', 'Polymorphism', 'Design Principles'],
    'System Design': ['Scalability Basics', 'Load Balancing & Caching', 'Database Design', 'API Design', 'Estimation & Trade-offs'],
  };
  const generic = ['Core Concepts', 'Fundamentals', 'Intermediate Topics', 'Advanced Topics', 'Practical Scenarios'];

  const prompt = `You are designing an interview syllabus. For the domain "${domain}" (target difficulty: ${difficulty}), list the ${Math.min(6, Math.max(4, Math.ceil(questionCount / 2)))} most important topic areas interviewers actually probe.
Return ONLY a JSON array of short topic strings (2-4 words each), no numbering, no markdown:
["topic 1","topic 2"]`;

  const text = await callModel(prompt, 15000);
  const parsed = text ? extractJson<string[]>(text) : null;
  const topics = (Array.isArray(parsed) ? parsed : [])
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 1)
    .map(t => t.trim().slice(0, 60))
    .slice(0, 6);

  const chosen = topics.length >= 3 ? topics : (fallback[domain] || generic).slice(0, 5);
  // Distribute planned questions across topics: earlier topics get the remainder.
  const base = Math.floor(questionCount / chosen.length);
  let remainder = questionCount - base * chosen.length;
  return chosen.map(topic => {
    const planned = base + (remainder-- > 0 ? 1 : 0);
    return { topic, planned: Math.max(1, planned), asked: 0 };
  });
}

// ── 2. First question ────────────────────────────────────────────────────────

export async function generateFirstQuestion(
  domain: string, role: string, difficulty: string, topic: string,
): Promise<IAdaptiveQuestion> {
  const prompt = `You are a senior technical interviewer. Ask ONE interview question.
Domain: ${domain}
${role ? `Role: ${role}` : ''}
Topic: ${topic}
Difficulty: ${difficulty} (${difficulty === 'easy' ? 'fundamental, warm-up level' : difficulty === 'medium' ? 'industry-interview level' : 'senior, expert level'})

Rules:
- Ask about the topic only, no greetings, no commentary.
- It must be answerable verbally in 1-3 minutes.
- Include 4-6 expectedKeywords that a strong answer would contain (single technical terms).

Return ONLY JSON:
{"text":"the question","expectedKeywords":["k1","k2","k3","k4"]}`;

  const text = await callModel(prompt, 20000);
  const parsed = text ? extractJson<{ text?: string; expectedKeywords?: string[] }>(text) : null;
  const qText = typeof parsed?.text === 'string' && parsed.text.trim().length > 5 ? parsed.text.trim() : `Explain the core concepts of ${topic} and where you would apply them in practice.`;
  const keywords = (Array.isArray(parsed?.expectedKeywords) ? parsed!.expectedKeywords : [])
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .map(k => k.trim().toLowerCase().slice(0, 40))
    .slice(0, 6);

  return {
    id: `aq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: qText,
    topic,
    difficulty: difficulty as IAdaptiveQuestion['difficulty'],
    depth: 'starter',
    expectedKeywords: keywords,
    askedAt: new Date(),
  };
}

// ── 3. Answer evaluation ─────────────────────────────────────────────────────

function heuristicEvaluation(question: IAdaptiveQuestion, answer: string): Evaluation {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = answer.toLowerCase();
  const matched = question.expectedKeywords.filter(k => lower.includes(k.toLowerCase()));
  const missing = question.expectedKeywords.filter(k => !matched.includes(k));

  const keywordRatio = question.expectedKeywords.length ? matched.length / question.expectedKeywords.length : 0.5;
  const lengthScore = Math.min(100, (wordCount / 80) * 100); // ~80 words ≈ full marks for length
  const hasStructure = /(first|second|then|finally|because|therefore|for example|e\.g\.)/i.test(answer);
  const hasExample = /(example|project|implemented|used it when|in my)/i.test(answer);
  const fillerCount = (lower.match(/\b(um|uh|like|basically|actually|you know)\b/g) || []).length;
  const fillerPenalty = Math.min(15, fillerCount * 3);

  const correctness = clamp(keywordRatio * 70 + Math.min(30, wordCount / 3));
  const depth = clamp(lengthScore * 0.6 + (hasExample ? 25 : 8) + (hasStructure ? 15 : 5));
  const communication = clamp(60 + (hasStructure ? 20 : 0) + (hasExample ? 10 : 0) + Math.min(20, wordCount / 5) - fillerPenalty);
  const confidence = clamp(55 + Math.min(30, wordCount / 4) - fillerPenalty);

  const overallScore = clamp(correctness * 0.45 + depth * 0.25 + communication * 0.2 + confidence * 0.1);

  return {
    scores: { correctness, depth, communication, confidence },
    overallScore,
    verdict: verdictFor(overallScore),
    strengths: matched.length ? [`Mentioned key concepts: ${matched.slice(0, 3).join(', ')}`] : ['Attempted the answer'],
    improvements: missing.length ? [`Did not mention: ${missing.slice(0, 3).join(', ')}`] : ['Add a concrete example next time'],
    matchedKeywords: matched,
    missingKeywords: missing,
    aiSummary: `Answer of ${wordCount} words touched ${matched.length}/${question.expectedKeywords.length || 'several'} expected concepts. Length-based estimate — connect to Gemini for precise scoring.`,
    nextFocus: missing[0] || null,
    source: 'heuristic',
  };
}

export async function evaluateAnswer(
  interview: IAdaptiveInterview, question: IAdaptiveQuestion, answer: string, durationSeconds: number,
): Promise<Evaluation> {
  if (!answer.trim()) {
    return {
      scores: { correctness: 0, depth: 0, communication: 0, confidence: 0 },
      overallScore: 0, verdict: 'poor', strengths: [], improvements: ['No answer was provided'],
      matchedKeywords: [], missingKeywords: question.expectedKeywords,
      aiSummary: 'The candidate did not answer this question.', nextFocus: question.topic, source: 'heuristic',
    };
  }

  const prompt = `You are a strict senior interviewer evaluating a candidate's spoken answer (transcribed).
Domain: ${interview.domain}
Question: "${question.text}"
Expected keywords: ${JSON.stringify(question.expectedKeywords)}
Answer (may contain speech-to-text noise): "${answer.slice(0, 4000)}"
Time taken: ${durationSeconds}s

Score 0-100 each: correctness (technical accuracy), depth (detail & insight), communication (clarity & structure), confidence (assertiveness & specificity).
Be fair to speech-to-text noise; do not penalize typos. overallScore = weighted (correctness 45%, depth 25%, communication 20%, confidence 10%).
nextFocus: the single most important concept the candidate should be probed on next (or null if mastery shown).

Return ONLY JSON:
{"scores":{"correctness":0,"depth":0,"communication":0,"confidence":0},"overallScore":0,"verdict":"poor|below-average|average|good|excellent","strengths":["s1"],"improvements":["i1"],"matchedKeywords":["k"],"missingKeywords":["k"],"aiSummary":"2 sentences","nextFocus":"concept or null"}`;

  const text = await callModel(prompt, 25000);
  const parsed = text ? extractJson<Partial<Evaluation> & { scores?: Partial<Evaluation['scores']> }>(text) : null;

  if (!parsed || !parsed.scores) return heuristicEvaluation(question, answer);

  const scores = {
    correctness: clamp(parsed.scores.correctness),
    depth: clamp(parsed.scores.depth),
    communication: clamp(parsed.scores.communication),
    confidence: clamp(parsed.scores.confidence),
  };
  const overallScore = clamp(
    parsed.overallScore ??
    scores.correctness * 0.45 + scores.depth * 0.25 + scores.communication * 0.2 + scores.confidence * 0.1,
  );
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, 6) : []);

  return {
    scores,
    overallScore,
    verdict: verdictFor(overallScore),
    strengths: strArr(parsed.strengths),
    improvements: strArr(parsed.improvements),
    matchedKeywords: strArr(parsed.matchedKeywords).map(k => k.toLowerCase().slice(0, 40)),
    missingKeywords: strArr(parsed.missingKeywords).map(k => k.toLowerCase().slice(0, 40)),
    aiSummary: typeof parsed.aiSummary === 'string' ? parsed.aiSummary.slice(0, 800) : '',
    nextFocus: typeof parsed.nextFocus === 'string' && parsed.nextFocus.trim() ? parsed.nextFocus.trim().slice(0, 80) : null,
    source: 'ai',
  };
}

// ── 4. Adaptive decision ─────────────────────────────────────────────────────

export function decideNextAction(interview: IAdaptiveInterview, lastEvaluation: Evaluation): AdaptiveDecision {
  const answered = interview.responses.length;
  if (answered >= interview.plannedQuestions) {
    return { action: 'end', topic: null, difficulty: interview.difficulty, depth: 'starter', reason: 'question quota reached' };
  }

  const remainingPlan = interview.plan.filter(p => p.asked < p.planned);
  const lastResponse = interview.responses[interview.responses.length - 1];
  const lastTopic = lastResponse?.topic || interview.plan[0]?.topic || interview.domain;
  const planTopic = lastResponse
    ? (interview.plan.find(p => p.topic === lastTopic && p.asked < p.planned)?.topic
      || remainingPlan[0]?.topic
      || lastTopic)
    : (interview.plan[0]?.topic || interview.domain);

  const score = lastEvaluation.overallScore;
  const followUpsUsed = interview.questions.filter(q => q.basedOn === lastResponse?.questionId).length;

  // Weak answer → probe deeper on the SAME topic with a follow-up (max 2 follow-ups per question).
  if (score < 55 && lastResponse && followUpsUsed < 2) {
    return {
      action: 'continue', topic: lastTopic,
      difficulty: score < 35 ? 'easy' : 'medium',
      depth: followUpsUsed === 0 ? 'follow-up' : 'deep-dive',
      reason: `weak answer (${score}/100) — probing "${lastEvaluation.nextFocus || lastTopic}" deeper`,
    };
  }
  // Strong answer → escalate difficulty, move to next planned topic.
  if (score >= 75) {
    const nextTopic = remainingPlan.find(p => p.topic !== lastTopic)?.topic || planTopic;
    return {
      action: 'continue', topic: nextTopic,
      difficulty: interview.difficulty === 'easy' ? 'medium' : 'hard',
      depth: 'scenario',
      reason: `strong answer (${score}/100) — escalating to ${nextTopic}`,
    };
  }
  // Average → same difficulty, next topic.
  return {
    action: 'continue', topic: planTopic,
    difficulty: interview.difficulty, depth: 'starter',
    reason: `average answer (${score}/100) — moving to ${planTopic}`,
  };
}

export async function generateAdaptiveQuestion(
  interview: IAdaptiveInterview, decision: AdaptiveDecision,
): Promise<IAdaptiveQuestion> {
  const recentQa = interview.responses.slice(-3).map((r, i) => `Q${i + 1}: ${r.questionText}\nA${i + 1}: ${r.answer.slice(0, 300)}`).join('\n');
  const prompt = `You are a senior technical interviewer conducting a LIVE adaptive interview.
Domain: ${interview.domain}
${interview.role ? `Role: ${interview.role}` : ''}
Next topic: ${decision.topic}
Difficulty: ${decision.difficulty}
Question style: ${decision.depth} — ${decision.depth === 'follow-up' ? 'a follow-up probing the gap in the candidate\'s previous answer' : decision.depth === 'deep-dive' ? 'an even deeper probe of the same concept' : decision.depth === 'scenario' ? 'a practical scenario/problem question' : 'a fresh starter question on the topic'}
${decision.depth === 'follow-up' || decision.depth === 'deep-dive' ? `Candidate's previous answer: "${(interview.responses[interview.responses.length - 1]?.answer || '').slice(0, 800)}"` : ''}
${recentQa ? `DO NOT repeat or closely paraphrase these recent questions:\n${recentQa}` : ''}

Rules:
- One question only, verbally answerable in 1-3 minutes.
- Include 4-6 expectedKeywords a strong answer would contain.

Return ONLY JSON:
{"text":"the question","expectedKeywords":["k1","k2","k3","k4"]}`;

  const text = await callModel(prompt, 20000);
  const parsed = text ? extractJson<{ text?: string; expectedKeywords?: string[] }>(text) : null;
  const fallbackText = decision.depth === 'follow-up' || decision.depth === 'deep-dive'
    ? `You mentioned "${decision.reason.replace(/^weak answer \(\d+\/100\) — probing /, '').replace(/" deeper$/, '')}" earlier — can you elaborate on how exactly that works in ${interview.domain}?`
    : `Walk me through a practical scenario in ${decision.topic || interview.domain} where you would apply its core concepts.`;
  const qText = typeof parsed?.text === 'string' && parsed.text.trim().length > 5 ? parsed.text.trim() : fallbackText;
  const keywords = (Array.isArray(parsed?.expectedKeywords) ? parsed!.expectedKeywords : [])
    .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    .map(k => k.trim().toLowerCase().slice(0, 40))
    .slice(0, 6);

  const lastResponse = interview.responses[interview.responses.length - 1];
  return {
    id: `aq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: qText,
    topic: decision.topic || interview.domain,
    difficulty: decision.difficulty,
    depth: decision.depth,
    expectedKeywords: keywords,
    basedOn: decision.depth === 'follow-up' || decision.depth === 'deep-dive' ? lastResponse?.questionId : undefined,
    askedAt: new Date(),
  };
}

// ── 5. Final report ──────────────────────────────────────────────────────────

export function computeTopicPerformance(interview: IAdaptiveInterview) {
  const byTopic = new Map<string, { total: number; count: number }>();
  for (const r of interview.responses) {
    const t = byTopic.get(r.topic) || { total: 0, count: 0 };
    t.total += r.overallScore;
    t.count += 1;
    byTopic.set(r.topic, t);
  }
  return [...byTopic.entries()].map(([topic, v]) => {
    const avg = Math.round(v.total / v.count);
    return { topic, questionsAsked: v.count, avgScore: avg, verdict: verdictFor(avg) };
  }).sort((a, b) => b.avgScore - a.avgScore);
}

function computedReport(interview: IAdaptiveInterview, integrityScore: number, eventCounts: Record<string, number>) {
  const topics = computeTopicPerformance(interview);
  const overall = interview.responses.length
    ? Math.round(interview.responses.reduce((s, r) => s + r.overallScore, 0) / interview.responses.length)
    : 0;
  const strong = topics.filter(t => t.avgScore >= 70).map(t => `${t.topic} (${t.avgScore}/100)`);
  const weak = topics.filter(t => t.avgScore < 55).map(t => `${t.topic} (${t.avgScore}/100)`);
  type Readiness = 'placement-ready' | 'strong' | 'competent' | 'developing' | 'needs-work';
  const readiness: Readiness = overall >= 85 ? 'placement-ready' : overall >= 70 ? 'strong' : overall >= 55 ? 'competent' : overall >= 35 ? 'developing' : 'needs-work';

  return {
    overallScore: overall,
    domainReadiness: readiness,
    topicPerformance: topics,
    strengths: strong.length ? strong : ['No topic scored 70+ — focus on fundamentals first'],
    weaknesses: weak.length ? weak : ['No significant weak topics'],
    recommendations: weak.length
      ? weak.map(w => `Revise ${w.split(' (')[0]} — practice explaining it out loud`)
      : ['Practice scenario questions to convert strong fundamentals into interview answers'],
    suggestedLearningPath: (interview.plan.map(p => p.topic)).slice(0, 5)
      .map(t => `Re-study ${t} then attempt 3 scenario questions on it`),
    summary: `Answered ${interview.responses.length} questions across ${topics.length} topics. Average ${overall}/100 — ${readiness.replace('-', ' ')}. Integrity score ${integrityScore}/100.`,
    integrity: { score: integrityScore, eventCounts, note: 'Auto-computed summary — connect Gemini for richer coaching.' },
    generatedAt: new Date(),
    source: 'computed' as const,
  };
}

export async function generateFinalReport(
  interview: IAdaptiveInterview, proctorEvents: IProctorEvent[],
): Promise<IAdaptiveInterview['report']> {
  const integrityScore = computeIntegrityScore(proctorEvents);
  const eventCounts: Record<string, number> = {};
  for (const e of proctorEvents) eventCounts[e.type] = (eventCounts[e.type] || 0) + 1;

  const topics = computeTopicPerformance(interview);
  const overall = interview.responses.length
    ? Math.round(interview.responses.reduce((s, r) => s + r.overallScore, 0) / interview.responses.length)
    : 0;

  const qa = interview.responses.map((r, i) =>
    `Q${i + 1} (${r.topic}, ${r.overallScore}/100): ${r.questionText}\nA: ${r.answer.slice(0, 400)}`).join('\n');

  const prompt = `You are a senior interview coach writing a final performance report for a candidate.
Domain: ${interview.domain} | Role: ${interview.role || 'entry-level'} | Questions answered: ${interview.responses.length}
Average score: ${overall}/100 | Integrity score: ${integrityScore}/100 (proctor events: ${JSON.stringify(eventCounts)})
Topic performance: ${JSON.stringify(topics)}

TRANSCRIPT:
${qa || '(no answers)'}

Return ONLY JSON:
{"overallScore":0,"domainReadiness":"needs-work|developing|competent|strong|placement-ready","strengths":["s"],"weaknesses":["w"],"recommendations":["r"],"suggestedLearningPath":["step"],"summary":"3-4 sentence personalised summary referencing actual answers"}`;

  const text = await callModel(prompt, 30000);
  const parsed = text ? extractJson<Record<string, unknown>>(text) : null;

  const base = computedReport(interview, integrityScore, eventCounts);
  if (!parsed) return base;

  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, 8) : []);
  const readiness = ['needs-work', 'developing', 'competent', 'strong', 'placement-ready'].includes(String(parsed.domainReadiness))
    ? String(parsed.domainReadiness) as NonNullable<IAdaptiveInterview['report']>['domainReadiness']
    : base.domainReadiness;

  return {
    ...base,
    // Scores/perf always computed from real answers; AI only enriches commentary.
    overallScore: base.overallScore,
    topicPerformance: base.topicPerformance,
    domainReadiness: readiness,
    strengths: strArr(parsed.strengths).length ? strArr(parsed.strengths) : base.strengths,
    weaknesses: strArr(parsed.weaknesses).length ? strArr(parsed.weaknesses) : base.weaknesses,
    recommendations: strArr(parsed.recommendations).length ? strArr(parsed.recommendations) : base.recommendations,
    suggestedLearningPath: strArr(parsed.suggestedLearningPath).length ? strArr(parsed.suggestedLearningPath) : base.suggestedLearningPath,
    summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.slice(0, 2000) : base.summary,
    integrity: {
      score: integrityScore,
      eventCounts,
      note: integrityScore >= 85 ? 'No significant integrity concerns detected.'
        : integrityScore >= 60 ? 'Some suspicious activity was detected. Review the event log.'
        : 'Multiple integrity violations detected — results should be interpreted with caution.',
    },
    generatedAt: new Date(),
    source: 'ai',
  };
}

// ── 6. Session lifecycle helpers ─────────────────────────────────────────────

export async function startAdaptiveSession(params: {
  userId: string; domain: string; role: string; difficulty: string; plannedQuestions: number;
}): Promise<IAdaptiveInterview> {
  const plan = await generateDomainPlan(params.domain, params.difficulty, params.plannedQuestions);
  const session = await AdaptiveInterviewModel.create({
    userId: params.userId,
    domain: params.domain,
    role: params.role,
    difficulty: params.difficulty,
    plannedQuestions: params.plannedQuestions,
    plan,
    status: 'in-progress',
  });
  return session;
}

export function toClientQuestion(q: IAdaptiveQuestion) {
  return {
    id: q.id, text: q.text, topic: q.topic, difficulty: q.difficulty, depth: q.depth,
    expectedDuration: q.depth === 'scenario' || q.depth === 'deep-dive' ? 4 : 3,
  };
  // expectedKeywords intentionally NOT sent to the client (anti-cheat: no answer hints).
}
