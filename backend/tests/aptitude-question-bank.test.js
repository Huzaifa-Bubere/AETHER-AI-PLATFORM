// Question bank depth (spec §2A–§2F).
// Every published test requests 5 easy / 5 medium / 5 hard and the selector
// excludes questions this candidate saw in the last 30 days, so the bank must
// hold several attempts' worth of DISTINCT questions per level.
const { SEED_QUESTIONS } = require('../dist/scripts/seedQuestionData');

const count = (roundType, difficulty) =>
  SEED_QUESTIONS.filter(q => q.roundType === roundType && q.difficulty === difficulty).length;

describe('seeded aptitude/technical question bank', () => {
  test('every level has enough distinct questions for repeated attempts', () => {
    for (const roundType of ['aptitude', 'technical']) {
      for (const difficulty of ['easy', 'medium', 'hard']) {
        expect(count(roundType, difficulty)).toBeGreaterThanOrEqual(12);
      }
    }
  });

  test('the medium bucket (the level that ran short) is deep enough', () => {
    // MEDIUM was the failing level: a test needs 5 and the cooldown excludes
    // recent items, so the bank must hold several attempts' worth.
    expect(count('aptitude', 'medium')).toBeGreaterThanOrEqual(20);
    expect(count('technical', 'medium')).toBeGreaterThanOrEqual(20);
  });

  test('every question is a valid single-answer MCQ with an explanation', () => {
    for (const q of SEED_QUESTIONS) {
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(4);
      expect(typeof q.explanation).toBe('string');
      expect(q.explanation.trim().length).toBeGreaterThan(0);
      expect(['easy', 'medium', 'hard']).toContain(q.difficulty);
      expect(['aptitude', 'technical']).toContain(q.roundType);
    }
  });

  test('question ids are unique', () => {
    expect(new Set(SEED_QUESTIONS.map(q => q.id)).size).toBe(SEED_QUESTIONS.length);
  });
});
