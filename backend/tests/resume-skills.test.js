// Canonical resume skill normalization (spec §1D/§1E). Pure — no database, no AI.
const { normalizeSkillEntries, groupSkills, skillLabels } = require('../dist/services/resumeSkills');

describe('resume skill normalization', () => {
  test('canonicalises case and aliases to one display label each', () => {
    const entries = normalizeSkillEntries([
      { category: 'programming', skills: ['python', 'PYTHON', 'Node JS', 'nodejs', 'Powerbi', 'power bi', 'express js'] },
    ]);
    expect(entries.map(e => e.label)).toEqual(['Python', 'Node.js', 'Power BI', 'Express.js']);
  });

  test('splits a run-together skills blob into individual skills', () => {
    const entries = normalizeSkillEntries(['pythonjavajavascripttypescriptc++sqlhtmlcssreact']);
    const labels = entries.map(e => e.label);
    for (const expected of ['Python', 'Java', 'JavaScript', 'TypeScript', 'C++', 'SQL', 'HTML', 'CSS', 'React']) {
      expect(labels).toContain(expected);
    }
  });

  test('does not turn a category heading into a skill', () => {
    expect(normalizeSkillEntries([{ category: 'Programming & Querying' }])).toHaveLength(0);
    expect(normalizeSkillEntries([{ category: 'Data Visualization Tools' }])).toHaveLength(0);
  });

  test('deduplicates case-insensitively and keeps each skill in one category', () => {
    const entries = normalizeSkillEntries([
      { category: 'Databases', skills: ['mongo', 'MongoDB', 'mongodb'] },
      { category: 'Data & Analytics', skills: ['Power BI'] },
    ]);
    expect(entries.filter(e => e.slug === 'mongodb')).toHaveLength(1);
    expect(entries.find(e => e.label === 'Power BI').category).toBe('Data & Analytics');
  });

  test('groups skills by canonical category order', () => {
    const groups = groupSkills(normalizeSkillEntries(['python', 'react', 'mongodb', 'power bi']));
    expect(groups.map(g => g.category)).toEqual(['Programming', 'Frontend', 'Databases', 'Data & Analytics']);
  });

  test('flat labels stay backwards compatible with the old string[] contract', () => {
    expect(skillLabels(normalizeSkillEntries([{ category: 'x', skills: ['cpp', 'c++'] }]))).toEqual(['C++']);
  });
});
