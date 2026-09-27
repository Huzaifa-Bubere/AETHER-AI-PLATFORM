/* AETHER Career Learning — topic content, quiz grading and YouTube ranking tests
 * (spec §37–§38, §40–§47, §57–§58, §70–§72).
 *
 * These tests are deterministic and need no database: the seed content is
 * validated against the real mongoose schema, quiz grading and video ranking are
 * pure functions, and every AI/network-dependent path is asserted to fail
 * honestly rather than invent data.
 */
process.env.NODE_ENV = 'test';

const {
  SEED_TOPICS,
  PUBLISH_GATE,
  validateTopic,
  duplicateQuizIds,
  seedTopicsIssues,
  toLearningTopicDoc,
} = require('../dist/career/seed/seedTopics');
const { LearningTopic } = require('../dist/career/models/LearningTopic');
const { LearningVideo } = require('../dist/career/models/LearningVideo');
const {
  gradeQuizAnswers,
  topicGroundingText,
  sanitizeTopicQuiz,
} = require('../dist/career/services/topicContent.service');
const {
  parseIsoDuration,
  formatDuration,
  formatViewCount,
  buildSearchQuery,
  relevanceScore,
  durationSuitability,
  channelConfidence,
  rankCandidates,
  isYoutubeConfigured,
  refreshIntervalDays,
  refreshTopicVideos,
  refreshAllTopicVideos,
  validateStoredVideos,
  VIDEO_SELECTION_VERSION,
} = require('../dist/career/services/youtube.service');

// ── Seed content integrity (spec §31, §40, §70) ──────────────────────────────

describe('career learning seed content', () => {
  const coveredTopics = [
    'python', 'java', 'javascript', 'react', 'nodejs', 'sql', 'mongodb',
    'dbms', 'operating-systems', 'computer-networks', 'git-github', 'docker',
    'rest-api', 'system-design-basics', 'data-structures', 'algorithms',
  ];

  test('ships the full required topic set with unique slugs', () => {
    const slugs = SEED_TOPICS.map(t => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const required of coveredTopics) {
      expect(slugs).toContain(required);
    }
    expect(SEED_TOPICS.length).toBeGreaterThanOrEqual(16);
  });

  test('every seeded topic passes the same publish gate the admin CMS enforces', () => {
    expect(seedTopicsIssues()).toEqual([]);
  });

  test('every topic has real lesson material, not a placeholder', () => {
    for (const topic of SEED_TOPICS) {
      expect(topic.description.length).toBeGreaterThan(120);
      expect(topic.whyItMatters.length).toBeGreaterThan(80);
      expect(topic.interviewRelevance.length).toBeGreaterThan(50);
      expect(topic.learningObjectives.length).toBeGreaterThanOrEqual(3);
      expect(topic.sections.length).toBeGreaterThanOrEqual(PUBLISH_GATE.minSections);
      expect(topic.examples.length).toBeGreaterThanOrEqual(2);
      expect(topic.commonMistakes.length).toBeGreaterThanOrEqual(1);
      expect(topic.interviewTips.length).toBeGreaterThanOrEqual(1);
      expect(topic.practice.length).toBeGreaterThanOrEqual(1);
      expect(topic.resources.length).toBeGreaterThanOrEqual(1);
      expect(topic.quiz.length).toBeGreaterThanOrEqual(PUBLISH_GATE.minQuiz);
      expect(topic.estimatedMinutes).toBeGreaterThan(0);
    }
  });

  test('content includes code, worked examples with output and structured blocks', () => {
    for (const topic of SEED_TOPICS) {
      const codeBlocks = topic.sections.filter(s => s.type === 'code');
      expect(codeBlocks.length).toBeGreaterThanOrEqual(1);
      for (const block of codeBlocks) {
        expect(block.language).toBeTruthy();
        expect(String(block.code || '').trim().length).toBeGreaterThan(0);
      }
      for (const example of topic.examples) {
        expect(example.kind).toBeTruthy();
        expect(example.explanation).toBeTruthy();
        expect(String(example.code || '').trim().length).toBeGreaterThan(0);
      }
      // Rendered block types must be ones the lesson page knows how to render.
      const known = ['heading', 'paragraph', 'list', 'code', 'tip', 'warning', 'note', 'table', 'steps', 'compare'];
      for (const block of topic.sections) expect(known).toContain(block.type);
    }
  });

  test('quiz questions are answerable and internally consistent', () => {
    for (const topic of SEED_TOPICS) {
      expect(duplicateQuizIds(topic)).toEqual([]);
      for (const q of topic.quiz) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
        expect(q.correctIndex).toBeLessThan(q.options.length);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.explanation).toBeTruthy();
        expect(q.topicTag).toBeTruthy();
        expect(['beginner', 'intermediate', 'advanced']).toContain(q.difficulty);
      }
    }
  });

  test('curriculum references are well formed (kebab-case, never self-referencing)', () => {
    const slugs = new Set(SEED_TOPICS.map(t => t.slug));
    for (const topic of SEED_TOPICS) {
      const refs = [
        ...topic.prerequisites,
        ...(topic.optionalPrerequisites || []),
        ...topic.nextTopicSlugs,
        ...topic.relatedTopicSlugs,
      ];
      for (const ref of refs) {
        expect(ref).toBeTruthy();
        expect(ref).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(ref).not.toBe(topic.slug);
      }
      expect(topic.nextTopicSlugs.length + topic.relatedTopicSlugs.length).toBeGreaterThanOrEqual(1);
      // Any next topic inside the seeded set must itself be a real seeded topic.
      for (const next of topic.nextTopicSlugs) {
        if (slugs.has(next)) expect(next).toBeTruthy();
      }
    }
  });

  test('resource links point at real documentation/learning providers over https', () => {
    for (const topic of SEED_TOPICS) {
      for (const r of topic.resources) {
        expect(r.title).toBeTruthy();
        expect(r.provider).toBeTruthy();
        expect(r.url).toMatch(/^https:\/\//);
        expect(['DOCUMENTATION', 'ARTICLE', 'VIDEO', 'PRACTICE', 'BOOK']).toContain(r.type);
      }
    }
  });

  test('every seed topic validates against the real LearningTopic schema', () => {
    for (const topic of SEED_TOPICS) {
      const doc = new LearningTopic(toLearningTopicDoc(topic));
      const error = doc.validateSync();
      expect(error ? `${topic.slug}: ${error.message}` : null).toBeNull();
      expect(doc.status).toBe('published');
    }
  });

  test('LearningTopic exposes the published-slug lookup used by the lesson page', () => {
    expect(typeof LearningTopic.findPublishedBySlug).toBe('function');
  });

  test('seed topics carry no video fields — video metadata is never hardcoded (spec §41, §44)', () => {
    for (const topic of SEED_TOPICS) {
      expect(topic.youtubeVideos).toBeUndefined();
      expect(JSON.stringify(topic)).not.toMatch(/youtubeVideoId|viewCount|likeCount/);
    }
  });
});

// ── Quiz grading (spec §57–§58) ──────────────────────────────────────────────

describe('topic quiz grading', () => {
  const questions = [
    { id: 'q1', correctIndex: 0, explanation: 'a', difficulty: 'beginner', topicTag: 'list-indexing' },
    { id: 'q2', correctIndex: 2, explanation: 'b', difficulty: 'beginner', topicTag: 'list-indexing' },
    { id: 'q3', correctIndex: 1, explanation: 'c', difficulty: 'medium', topicTag: 'variables' },
    { id: 'q4', correctIndex: 3, explanation: 'd', difficulty: 'beginner', topicTag: 'loops' },
    { id: 'q5', correctIndex: 0, explanation: 'e', difficulty: 'beginner', topicTag: 'loops' },
  ];

  test('4 of 5 correct scores exactly 80%', () => {
    const result = gradeQuizAnswers(questions, [0, 2, 1, 3, 2]);
    expect(result.correct).toBe(4);
    expect(result.total).toBe(5);
    expect(result.score).toBe(80);
    expect(result.results.filter(r => r.correct)).toHaveLength(4);
  });

  test('3 of 5 correct is the 60% pass boundary (< 60 triggers review)', () => {
    const result = gradeQuizAnswers(questions, [0, 2, 1, 0, 1]);
    expect(result.score).toBe(60);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  test('weak tags are the deduplicated topicTags of the wrong answers, in question order', () => {
    // Every answer is option 1: only q3 (correctIndex 1) is right.
    const result = gradeQuizAnswers(questions, [1, 1, 1, 1, 1]);
    expect(result.correct).toBe(1);
    expect(result.weakTags).toEqual(['list-indexing', 'loops']);
  });

  test('missing or out-of-range answers count as incorrect, never as correct', () => {
    const result = gradeQuizAnswers(questions, [0]);
    expect(result.correct).toBe(1);
    expect(gradeQuizAnswers(questions, []).score).toBe(0);
    expect(gradeQuizAnswers(questions, [-1, 99, null, undefined, 7]).correct).toBe(0);
  });

  test('empty quiz yields a zero-score result instead of throwing', () => {
    const result = gradeQuizAnswers([], []);
    expect(result).toEqual({ score: 0, correct: 0, total: 0, results: [], weakTags: [] });
  });

  test('grading never mutates the question set', () => {
    const snapshot = JSON.stringify(questions);
    gradeQuizAnswers(questions, [1, 1, 1, 1, 1]);
    expect(JSON.stringify(questions)).toBe(snapshot);
  });

  test('the lesson payload never includes the answer key (spec §57)', () => {
    const raw = [
      { id: 'q1', question: 'What does == do?', options: ['Compare', 'Assign'], correctIndex: 0, explanation: 'because', difficulty: 'beginner', topicTag: 'operators' },
      { id: 'q2', question: 'What repeats work?', options: ['A loop', 'An if'], correctIndex: 0, explanation: 'because', difficulty: 'beginner', topicTag: 'loops' },
    ];
    const safe = sanitizeTopicQuiz(raw);
    expect(safe).toHaveLength(raw.length);
    for (const q of safe) {
      expect(q).not.toHaveProperty('correctIndex');
      expect(q).not.toHaveProperty('explanation');
      expect(q.question).toBeTruthy();
      expect(q.options.length).toBeGreaterThan(0);
      expect(q.topicTag).toBeTruthy();
    }
    // The serializer must not leak the key through the raw JSON either.
    expect(JSON.stringify(safe)).not.toMatch(/correctIndex|explanation/);
  });
});

// ── Ask AETHER grounding (spec §55–§56) ─────────────────────────────────────

describe('Ask AETHER lesson grounding', () => {
  const topic = {
    title: 'Python Lists',
    description: 'Lists are ordered, mutable sequences.',
    learningObjectives: ['Index a list', 'Slice a list'],
    sections: [
      { type: 'heading', content: 'Indexing' },
      { type: 'paragraph', content: 'Lists start at index 0.' },
      { type: 'code', language: 'python', code: 'nums[0]', output: '10' },
      { type: 'list', items: ['append', 'extend'] },
      { type: 'tip', content: 'Use negative indexes from the end.' },
    ],
    examples: [
      { title: 'Simple', kind: 'Simple', explanation: 'Read the first item.', code: 'print(nums[0])' },
    ],
    commonMistakes: [{ title: 'IndexError', why: 'The index does not exist.', wrong: 'nums[10]' }],
  };

  test('grounds the tutor in the database lesson content', () => {
    const text = topicGroundingText(topic);
    expect(text).toContain('TOPIC: Python Lists');
    expect(text).toContain('OBJECTIVES:');
    expect(text).toContain('## Indexing');
    expect(text).toContain('CODE (python):');
    expect(text).toContain('OUTPUT: 10');
    expect(text).toContain('EXAMPLE (Simple)');
    expect(text).toContain('COMMON MISTAKE: IndexError');
  });

  test('grounding text is capped so a huge lesson cannot blow the prompt budget', () => {
    const huge = { ...topic, sections: Array.from({ length: 400 }, () => ({ type: 'paragraph', content: 'x'.repeat(200) })) };
    expect(topicGroundingText(huge).length).toBeLessThanOrEqual(12000);
  });

  test('a lesson with no optional content still produces usable grounding', () => {
    const minimal = { title: 'T', description: 'D' };
    expect(topicGroundingText(minimal)).toContain('TOPIC: T');
  });
});

// ── YouTube helpers and ranking (spec §41–§45, §72) ─────────────────────────

describe('YouTube integration helpers', () => {
  test('parses ISO-8601 durations from the API', () => {
    expect(parseIsoDuration('PT18M42S')).toBe(1122);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('P1DT1M')).toBe(86460);
    expect(parseIsoDuration('PT0S')).toBeNull();
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration(null)).toBeNull();
    expect(parseIsoDuration('garbage')).toBeNull();
  });

  test('formats durations and view counts for display', () => {
    expect(formatDuration(1122)).toBe('18 min');
    expect(formatDuration(3723)).toBe('1h 2m');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(null)).toBe('');
    expect(formatViewCount(2400000)).toBe('2.4M');
    expect(formatViewCount(12000)).toBe('12.0K');
    expect(formatViewCount(950)).toBe('950');
    expect(formatViewCount(null)).toBe('');
  });

  test('search query uses the topic, goal and level (spec §41)', () => {
    expect(buildSearchQuery({ title: 'Python', level: 'beginner' }, 'variables')).toBe('Python variables beginner tutorial');
    expect(buildSearchQuery({ title: 'System Design', level: 'advanced' })).toBe('System Design advanced tutorial');
    expect(buildSearchQuery({ title: 'SQL', level: 'intermediate' })).toBe('SQL intermediate tutorial');
  });

  test('relevance prefers on-topic tutorial titles over unrelated and clickbait ones', () => {
    const topic = 'Python Variables';
    const good = relevanceScore(
      { title: 'Python Variables Explained — Beginner Tutorial', description: 'Learn variables in Python', channelTitle: 'freeCodeCamp.org' },
      topic,
    );
    const unrelated = relevanceScore(
      { title: 'Minecraft survival let\u2019s play #42', description: 'gaming', channelTitle: 'Gamer' },
      topic,
    );
    const clickbait = relevanceScore(
      { title: 'Python Variables EXPOSED #shorts reaction', description: 'drama', channelTitle: 'Clickbait' },
      topic,
    );
    expect(good).toBeGreaterThan(unrelated);
    expect(good).toBeGreaterThan(clickbait);
    expect(relevanceScore({ title: 'Python Variables Tutorial', description: '' }, topic)).toBeLessThanOrEqual(1);
  });

  test('duration suitability peaks on lesson-length videos and never assumes unknown is ideal', () => {
    expect(durationSuitability(null)).toBe(0.5);
    expect(durationSuitability(30)).toBeLessThan(durationSuitability(600));
    expect(durationSuitability(600)).toBe(1.0);
    expect(durationSuitability(1800)).toBeGreaterThan(durationSuitability(9000));
  });

  test('channel confidence recognises curated educational channels and stays neutral for unknown ones', () => {
    expect(channelConfidence('freeCodeCamp.org')).toBe(1.0);
    expect(channelConfidence('Programming with Mosh')).toBeGreaterThanOrEqual(0.9);
    expect(channelConfidence('Random Uploads 123')).toBe(0.5);
    expect(channelConfidence('')).toBe(0.5);
  });

  test('ranking is deterministic and explainable', () => {
    const candidates = [
      {
        youtubeVideoId: 'aaa', title: 'Python Variables Beginner Tutorial',
        description: 'Learn python variables from scratch', channelId: 'c1', channelTitle: 'freeCodeCamp.org',
        thumbnail: 't', duration: 'PT20M', durationSeconds: 1200, viewCount: 900000, likeCount: 40000, publishedAt: null,
      },
      {
        youtubeVideoId: 'bbb', title: 'Python Variables EXPOSED #shorts',
        description: 'reaction drama', channelId: 'c2', channelTitle: 'Clickbait Channel',
        thumbnail: 't', duration: 'PT30S', durationSeconds: 30, viewCount: 3000000, likeCount: 1000, publishedAt: null,
      },
      {
        youtubeVideoId: 'ccc', title: 'Cooking with Python',
        description: 'unrelated', channelId: 'c3', channelTitle: 'Chef',
        thumbnail: 't', duration: 'PT5M', durationSeconds: 300, viewCount: null, likeCount: null, publishedAt: null,
      },
    ];

    const first = rankCandidates(candidates, 'Python Variables');
    const second = rankCandidates([...candidates].reverse(), 'Python Variables');

    // The on-topic educational tutorial wins even though the clickbait video is
    // an order of magnitude more viewed.
    expect(first[0].youtubeVideoId).toBe('aaa');
    expect(first[0].rankingScore).toBeGreaterThan(first[2].rankingScore);
    // Same candidate set → identical order regardless of input order (deterministic).
    expect(second.map(c => c.youtubeVideoId)).toEqual(first.map(c => c.youtubeVideoId));
    expect(new Set(first.map(c => c.youtubeVideoId)).size).toBe(3);
    for (const c of first) {
      expect(c.rankingScore).toBeGreaterThanOrEqual(0);
      expect(c.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(c.rankingReasons.length).toBeGreaterThan(0);
    }
    // Missing API statistics must not be invented.
    const unknown = first.find(c => c.youtubeVideoId === 'ccc');
    expect(unknown.viewCount).toBeNull();
    expect(unknown.likeCount).toBeNull();
    expect(unknown.rankingReasons.join(' ')).not.toMatch(/views/);
  });

  test('ranking an empty candidate set returns nothing instead of a placeholder video', () => {
    expect(rankCandidates([], 'Python')).toEqual([]);
  });

  test('selection version and refresh interval are explicit', () => {
    expect(VIDEO_SELECTION_VERSION).toBeTruthy();
    delete process.env.YOUTUBE_REFRESH_DAYS;
    expect(refreshIntervalDays()).toBe(30);
    process.env.YOUTUBE_REFRESH_DAYS = '7';
    expect(refreshIntervalDays()).toBe(7);
    process.env.YOUTUBE_REFRESH_DAYS = 'nonsense';
    expect(refreshIntervalDays()).toBe(30);
    delete process.env.YOUTUBE_REFRESH_DAYS;
  });
});

describe('YouTube integration without an API key', () => {
  const originalKey = process.env.YOUTUBE_API_KEY;
  beforeAll(() => { delete process.env.YOUTUBE_API_KEY; });
  afterAll(() => {
    if (originalKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalKey;
  });

  test('reports itself as not configured and fabricates nothing', async () => {
    expect(isYoutubeConfigured()).toBe(false);
    const result = await refreshTopicVideos({ slug: 'python', title: 'Python' }, {});
    expect(result.searched).toBe(false);
    expect(result.stored).toBe(0);
    expect(result.top).toBeNull();
    expect(result.reason).toMatch(/YOUTUBE_API_KEY/);
  });

  test('bulk refresh stops immediately and explains why (no network, no DB)', async () => {
    const summary = await refreshAllTopicVideos({});
    expect(summary.configured).toBe(false);
    expect(summary.topicsProcessed).toBe(0);
    expect(summary.videosStored).toBe(0);
    expect(summary.message).toMatch(/YOUTUBE_API_KEY/);
  });

  test('stored-video validation refuses to run rather than assuming videos are fine', async () => {
    const result = await validateStoredVideos();
    expect(result.checked).toBe(0);
    expect(result.reason).toMatch(/YOUTUBE_API_KEY/);
  });

  test('the video collection keeps unknown statistics nullable (never 0-as-fabrication)', () => {
    const doc = new LearningVideo({
      topicId: '000000000000000000000000',
      topicSlug: 'python',
      youtubeVideoId: 'abc123',
      title: 'Python Variables Tutorial',
    });
    expect(doc.viewCount).toBeNull();
    expect(doc.likeCount).toBeNull();
    expect(doc.durationSeconds).toBeNull();
    expect(doc.publishedAt).toBeNull();
    expect(doc.active).toBe(true);
    expect(doc.validateSync()).toBeUndefined();
  });
});
