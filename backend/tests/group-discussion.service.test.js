const {
  metrics,
  score,
  nextAiSpeaker,
  recentTranscript,
} = require('../dist/groupDiscussion/services/groupDiscussion.service');

describe('GD service helpers', () => {
  describe('metrics', () => {
    const turns = (candidate, ai = 0) => [
      ...candidate.map((text, i) => ({
        speakerType: 'CANDIDATE',
        text,
        durationSeconds: 5 + i * 2,
      })),
      ...Array.from({ length: ai }, (_, i) => ({
        speakerType: 'AI',
        text: `AI point ${i}`,
        durationSeconds: 0,
      })),
    ];

    test('counts candidate turns, speaking seconds and average words', () => {
      const m = metrics(
        turns(['I agree, and I would add telemetry.', 'However, the cost could be high.']),
        2,
      );
      expect(m.candidateTurns).toBe(2);
      expect(m.candidateSpeakingSeconds).toBe(5 + 7);
      expect(m.averageResponseWords).toBeGreaterThan(0);
    });

    test('keyword coverage is a fraction of keywords present', () => {
      const m = metrics(
        turns(['We should optimize the database']),
        ['optimize', 'database', 'security'],
      );
      expect(m.keywordCoverage).toBe(2 / 3);
      expect(m.keywordHits).toBe(2);
      expect(m.keywordTotal).toBe(3);
    });

    test('empty keyword list yields zero coverage without dividing by zero', () => {
      const m = metrics(turns([]), []);
      expect(m.keywordCoverage).toBe(0);
      expect(m.keywordHits).toBe(0);
      expect(m.keywordTotal).toBe(0);
    });

    test('direct references count build-on language', () => {
      const m = metrics(
        turns([
          'I think we should use caching.',
          'Building on that, the cache should be short-lived.',
        ]),
        0,
      );
      expect(m.directReferences).toBeGreaterThanOrEqual(1);
    });

    test('pass count detects explicit pass language', () => {
      const m = metrics(turns(['I pass.']), 0);
      expect(m.passCount).toBeGreaterThanOrEqual(1);
    });

    test('repetition overlap is a crude similarity signal only', () => {
      const m = metrics(
        turns(['foo bar baz', 'foo bar qux']),
        0,
      );
      expect(typeof m.repetitionOverlap).toBe('number');
    });
  });

  describe('score', () => {
    test('total is capped between 0 and 100', () => {
      const low = score({
        keywordCoverage: 0,
        averageResponseWords: 0,
        directReferences: 0,
        candidateTurns: 0,
      });
      const high = score({
        keywordCoverage: 1,
        averageResponseWords: 200,
        directReferences: 10,
        candidateTurns: 10,
      });
      expect(low.total).toBeGreaterThanOrEqual(0);
      expect(high.total).toBeLessThanOrEqual(100);
    });

    test('component weights match the documented breakdown', () => {
      const s = score({
        keywordCoverage: 0.5,
        averageResponseWords: 30,
        directReferences: 3,
        candidateTurns: 4,
      });
      expect(s.topicRelevance).toBe(13); // 0.5 * 25
      expect(s.reasoningStructure).toBeLessThanOrEqual(20);
      expect(s.responseToOthers).toBeLessThanOrEqual(15);
      expect(s.participationBalance).toBeLessThanOrEqual(15);
      expect(s.communicationClarity).toBeLessThanOrEqual(15);
      expect(s.evidenceExamples).toBeLessThanOrEqual(10);
    });
  });

  describe('nextAiSpeaker', () => {
    const participants = [
      { id: 'aarav', name: 'Aarav', style: 'analytical' },
      { id: 'priya', name: 'Priya', style: 'practical' },
      { id: 'rohan', name: 'Rohan', style: 'challenger' },
    ];

    test('returns a participant when the pool is non-empty', () => {
      const speaker = nextAiSpeaker(participants, []);
      expect(participants).toContainEqual(speaker);
    });

    test('does not repeat the last AI speaker', () => {
      const turns = [
        { speakerType: 'AI', speakerId: 'aarav' },
      ];
      const speaker = nextAiSpeaker(participants, turns);
      expect(speaker && speaker.id).not.toBe('aarav');
    });

    test('returns null for an empty pool', () => {
      expect(nextAiSpeaker([], [])).toBeNull();
    });

    test('returns null when the only participant just spoke', () => {
      expect(
        nextAiSpeaker([{ id: 'aarav', name: 'Aarav', style: 'analytical' }], [
          { speakerType: 'AI', speakerId: 'aarav' },
        ]),
      ).toBeNull();
    });
  });

  describe('recentTranscript', () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({
      speakerName: `P${i}`,
      text: `Line ${i}`,
    }));

    test('returns only the most recent window', () => {
      expect(recentTranscript(turns, 5).split('\n').length).toBe(5);
    });

    test('escapes empty turns gracefully', () => {
      expect(recentTranscript([{ speakerName: undefined, text: undefined }])).toBe(': ');
    });
  });
});
