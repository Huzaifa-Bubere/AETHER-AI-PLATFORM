/**
 * AETHER Interview — FollowUpDecision engine.
 *
 * After every answer, classifies the candidate response into an explicit
 * cross-questioning decision (ANSWER_COMPLETE, NEEDS_CLARIFICATION,
 * NEEDS_DEPTH, TECHNICAL_GAP, INTERESTING_CLAIM, MOVE_NEXT_TOPIC) with stored
 * evidence (parentQuestionId, triggerText, reason). Deterministic heuristics
 * run first; Gemini refines the classification when available.
 *
 * Follow-up depth is bounded (maxFollowUpsPerTopic) so one topic can never
 * consume the whole interview.
 */

export type FollowUpDecisionType =
  | 'ANSWER_COMPLETE'
  | 'NEEDS_CLARIFICATION'
  | 'NEEDS_DEPTH'
  | 'TECHNICAL_GAP'
  | 'INTERESTING_CLAIM'
  | 'MOVE_NEXT_TOPIC';

export interface IFollowUpEvidence {
  parentQuestionId: string;
  triggerText: string;
  reason: string;
  topic: string;
  difficulty: string;
  decidedBy: 'heuristic' | 'ai';
}

export interface IFollowUpDecision {
  decision: FollowUpDecisionType;
  /** true → interview should generate a follow-up question on this topic */
  shouldFollowUp: boolean;
  followUpIntent?: string;
  evidence: IFollowUpEvidence;
  /** depth guard — how many follow-ups already used on this question */
  followUpsUsed: number;
  maxFollowUpsPerTopic: number;
}

/** Extract a short trigger quote from the answer for explainability. */
function findTrigger(answer: string, terms: Array<string | RegExp>): string {
  for (const term of terms) {
    if (term instanceof RegExp) {
      const m = answer.match(term);
      if (m) return m[0].slice(0, 80);
    } else {
      const idx = answer.toLowerCase().indexOf(term.toLowerCase());
      if (idx >= 0) return answer.slice(idx, idx + 80).trim();
    }
  }
  return answer.slice(0, 80).trim();
}

/** Technology/skill mentions worth cross-questioning (deterministic list). */
const CLAIM_PATTERNS: Array<{ re: RegExp; intent: string }> = [
  { re: /\bredis\b/i, intent: 'Probe the Redis claim: what exactly was cached and how was invalidation handled?' },
  { re: /\b(kafka|rabbitmq|sqs|pub\s?sub)\b/i, intent: 'Probe the messaging claim: delivery guarantees and ordering.' },
  { re: /\b(docker|kubernetes|k8s)\b/i, intent: 'Probe the containerization claim: images, orchestration, production gaps.' },
  { re: /\b(micro ?services?)\b/i, intent: 'Probe the microservices claim: service boundaries and data ownership.' },
  { re: /\b(load balanc\w+|nginx|haproxy)\b/i, intent: 'Probe the scaling claim: balancing strategy and failure handling.' },
  { re: /\b(index|indexing|sharding|replication)\b/i, intent: 'Probe the database claim: which fields, why, measured effect.' },
  { re: /\b(graph\s?ql)\b/i, intent: 'Probe the GraphQL claim: resolver design and N+1 handling.' },
  { re: /\b(rag|retrieval augmented|vector (db|database|search)|embedding)\b/i, intent: 'Probe the RAG claim: chunking, retrieval quality, hallucination control.' },
  { re: /\b(machine learning|neural|transformer|llm|gemini|gpt)\b/i, intent: 'Probe the AI claim: data, evaluation, failure modes.' },
  { re: /\b(ci\/?cd|jenkins|github actions|gitlab ci)\b/i, intent: 'Probe the CI/CD claim: pipeline stages and rollback strategy.' },
  { re: /\b(aws|gcp|azure|lambda|s3)\b/i, intent: 'Probe the cloud claim: which services, cost/limit awareness.' },
  { re: /\b(socket\.?io|websocket|webrtc)\b/i, intent: 'Probe the realtime claim: connection lifecycle and fallbacks.' },
  { re: /\b(stripe|payment|razorpay)\b/i, intent: 'Probe the payments claim: idempotency and failure recovery.' },
];

/** Vagueness markers suggesting clarification is needed. */
const VAGUE_RE = /\b(i think|maybe|sort of|kind of|something like|not sure|i guess|probably|somehow)\b/i;
/** Gap markers suggesting a missing piece. */
const GAP_RE = /\b(i didn'?t|never used|no experience|not familiar|don'?t know|not aware)\b/i;
/** Structure/completeness markers. */
const COMPLETE_RE = /\b(in summary|to summarize|as a result|finally|that worked because|the outcome was|we measured)\b/i;

export interface FollowUpInput {
  questionId: string;
  questionText: string;
  topic: string;
  difficulty: string;
  answer: string;
  /** evaluation scores 0–100 */
  scores: { correctness: number; depth: number; communication: number };
  overallScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  /** follow-ups already asked against this question */
  followUpsUsed: number;
  maxFollowUpsPerTopic?: number;
  /** planned question quota bookkeeping */
  answered: number;
  plannedQuestions: number;
  /** remaining topics still having unplanned questions */
  remainingPlannedTopics: number;
}

/** Deterministic FollowUpDecision — always runs, even without AI. */
export function decideFollowUp(input: FollowUpInput): IFollowUpDecision {
  const maxFollowUps = input.maxFollowUpsPerTopic ?? 2;
  const baseEvidence: IFollowUpEvidence = {
    parentQuestionId: input.questionId,
    triggerText: '',
    reason: '',
    topic: input.topic,
    difficulty: input.difficulty,
    decidedBy: 'heuristic',
  };

  // Quota exhausted → move on regardless.
  if (input.answered >= input.plannedQuestions) {
    return { decision: 'MOVE_NEXT_TOPIC', shouldFollowUp: false, evidence: { ...baseEvidence, reason: 'Question quota reached.' }, followUpsUsed: input.followUpsUsed, maxFollowUpsPerTopic: maxFollowUps };
  }

  const canFollowUp = input.followUpsUsed < maxFollowUps && input.remainingPlannedTopics > 0;

  // 1. Technical gap — candidate admitted missing knowledge.
  if (GAP_RE.test(input.answer)) {
    const trigger = findTrigger(input.answer, [GAP_RE]);
    if (canFollowUp) {
      return {
        decision: 'TECHNICAL_GAP',
        shouldFollowUp: true,
        followUpIntent: `Candidate flagged a knowledge gap ("${trigger}"). Ask a simpler adjacent question on ${input.topic} to find the boundary of their understanding.`,
        evidence: { ...baseEvidence, triggerText: trigger, reason: 'CANDIDATE_FLAGGED_GAP', decidedBy: 'heuristic' },
        followUpsUsed: input.followUpsUsed,
        maxFollowUpsPerTopic: maxFollowUps,
      };
    }
    return { decision: 'TECHNICAL_GAP', shouldFollowUp: false, evidence: { ...baseEvidence, triggerText: trigger, reason: 'CANDIDATE_FLAGGED_GAP (depth limit reached)' }, followUpsUsed: input.followUpsUsed, maxFollowUpsPerTopic: maxFollowUps };
  }

  // 2. Vague answer — ask for clarification.
  if (VAGUE_RE.test(input.answer) && input.scores.depth < 60) {
    const trigger = findTrigger(input.answer, [VAGUE_RE]);
    if (canFollowUp) {
      return {
        decision: 'NEEDS_CLARIFICATION',
        shouldFollowUp: true,
        followUpIntent: `Answer was vague around "${trigger}". Ask the candidate to make their ${input.topic} explanation concrete with a specific example.`,
        evidence: { ...baseEvidence, triggerText: trigger, reason: 'VAGUE_ANSWER', decidedBy: 'heuristic' },
        followUpsUsed: input.followUpsUsed,
        maxFollowUpsPerTopic: maxFollowUps,
      };
    }
    return { decision: 'NEEDS_CLARIFICATION', shouldFollowUp: false, evidence: { ...baseEvidence, triggerText: trigger, reason: 'VAGUE_ANSWER (depth limit reached)' }, followUpsUsed: input.followUpsUsed, maxFollowUpsPerTopic: maxFollowUps };
  }

  // 3. Interesting claim — candidate mentioned a specific technology/approach.
  for (const { re, intent } of CLAIM_PATTERNS) {
    if (re.test(input.answer)) {
      const trigger = findTrigger(input.answer, [re]);
      if (canFollowUp) {
        return {
          decision: 'INTERESTING_CLAIM',
          shouldFollowUp: true,
          followUpIntent: intent,
          evidence: { ...baseEvidence, triggerText: trigger, reason: `CANDIDATE_MENTIONED_${trigger.split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '')}`, decidedBy: 'heuristic' },
          followUpsUsed: input.followUpsUsed,
          maxFollowUpsPerTopic: maxFollowUps,
        };
      }
      return { decision: 'INTERESTING_CLAIM', shouldFollowUp: false, evidence: { ...baseEvidence, triggerText: trigger, reason: 'CLAIM_NOTED (depth limit reached)' }, followUpsUsed: input.followUpsUsed, maxFollowUpsPerTopic: maxFollowUps };
    }
  }

  // 4. Low score — probe the missing concepts.
  if (input.overallScore < 55 && input.missingKeywords.length > 0) {
    const trigger = input.missingKeywords.slice(0, 2).join(', ');
    if (canFollowUp) {
      return {
        decision: 'NEEDS_DEPTH',
        shouldFollowUp: true,
        followUpIntent: `Answer missed key concepts (${trigger}). Ask a follow-up on ${input.topic} specifically covering "${input.missingKeywords[0]}".`,
        evidence: { ...baseEvidence, triggerText: trigger, reason: 'MISSING_CONCEPTS', decidedBy: 'heuristic' },
        followUpsUsed: input.followUpsUsed,
        maxFollowUpsPerTopic: maxFollowUps,
      };
    }
    return { decision: 'NEEDS_DEPTH', shouldFollowUp: false, evidence: { ...baseEvidence, triggerText: trigger, reason: 'MISSING_CONCEPTS (depth limit reached)' }, followUpsUsed: input.followUpsUsed, maxFollowUpsPerTopic: maxFollowUps };
  }

  // 5. Structured complete answer → move on.
  if (COMPLETE_RE.test(input.answer) && input.overallScore >= 55) {
    return { decision: 'ANSWER_COMPLETE', shouldFollowUp: false, evidence: { ...baseEvidence, triggerText: findTrigger(input.answer, [COMPLETE_RE]), reason: 'STRUCTURED_COMPLETE_ANSWER' }, followUpsUsed: input.followUpsUsed, maxFollowUpsPerTopic: maxFollowUps };
  }

  // 6. Default: strong scores move on, middling scores get one depth probe.
  if (input.overallScore < 65 && canFollowUp) {
    return {
      decision: 'NEEDS_DEPTH',
      shouldFollowUp: true,
      followUpIntent: `Score ${input.overallScore}/100 — ask a deeper follow-up on ${input.topic} to test real understanding.`,
      evidence: { ...baseEvidence, triggerText: input.answer.slice(0, 80), reason: 'LOW_SCORE_DEPTH_PROBE', decidedBy: 'heuristic' },
      followUpsUsed: input.followUpsUsed,
      maxFollowUpsPerTopic: maxFollowUps,
    };
  }
  return {
    decision: input.overallScore >= 65 ? 'MOVE_NEXT_TOPIC' : 'ANSWER_COMPLETE',
    shouldFollowUp: false,
    evidence: { ...baseEvidence, triggerText: input.answer.slice(0, 80), reason: `SCORE_${input.overallScore}_DECISION` },
    followUpsUsed: input.followUpsUsed,
    maxFollowUpsPerTopic: maxFollowUps,
  };
}

/**
 * Gemini refinement of the deterministic decision (never overrides a *worse*
 * outcome blindly — it may only upgrade MOVE_NEXT_TOPIC → a follow-up when it
 * finds a genuinely interesting claim, or confirm the heuristic).
 */
export async function refineFollowUpWithAI(
  input: FollowUpInput,
  heuristic: IFollowUpDecision,
): Promise<IFollowUpDecision> {
  try {
    const { callModel, extractJson } = await import('./aiRefine');
    const prompt = `You are the cross-questioning module of an AI interviewer.
Previous question: "${input.questionText}"
Candidate answer: "${input.answer.slice(0, 1500)}"
Scores: correctness=${input.scores.correctness}, depth=${input.scores.depth}, communication=${input.scores.communication}

Decide the NEXT action. Possible decisions:
- ANSWER_COMPLETE (solid answer, move to next topic)
- NEEDS_CLARIFICATION (vague — ask them to make it concrete)
- NEEDS_DEPTH (correct but shallow — probe deeper on the same topic)
- TECHNICAL_GAP (wrong/missing knowledge — probe the gap)
- INTERESTING_CLAIM (mentioned a specific technology/approach worth cross-questioning)

If a follow-up is warranted, write followUpIntent: the SPECIFIC cross-question angle (evidence-based, referencing what the candidate actually said). Max 1 sentence. triggerText: a short quote from the answer that triggered this.

Return ONLY JSON:
{"decision":"...","followUpIntent":"... or null","triggerText":"short quote"}`;

    const text = await callModel(prompt, 15000);
    const parsed = text ? extractJson<{ decision?: string; followUpIntent?: string; triggerText?: string }>(text) : null;
    if (!parsed?.decision) return heuristic;

    const valid = ['ANSWER_COMPLETE', 'NEEDS_CLARIFICATION', 'NEEDS_DEPTH', 'TECHNICAL_GAP', 'INTERESTING_CLAIM', 'MOVE_NEXT_TOPIC'];
    if (!valid.includes(parsed.decision)) return heuristic;

    const aiWantsFollowUp = ['NEEDS_CLARIFICATION', 'NEEDS_DEPTH', 'TECHNICAL_GAP', 'INTERESTING_CLAIM'].includes(parsed.decision);
    const canFollowUp = input.followUpsUsed < (input.maxFollowUpsPerTopic ?? 2) && input.remainingPlannedTopics > 0;
    const shouldFollowUp = aiWantsFollowUp && canFollowUp;

    return {
      decision: parsed.decision as FollowUpDecisionType,
      shouldFollowUp,
      followUpIntent: shouldFollowUp ? String(parsed.followUpIntent || heuristic.followUpIntent || '').slice(0, 300) : undefined,
      evidence: {
        ...heuristic.evidence,
        triggerText: String(parsed.triggerText || heuristic.evidence.triggerText).slice(0, 80),
        reason: `AI_${parsed.decision}`,
        decidedBy: 'ai',
      },
      followUpsUsed: input.followUpsUsed,
      maxFollowUpsPerTopic: input.maxFollowUpsPerTopic ?? 2,
    };
  } catch {
    return heuristic;
  }
}
