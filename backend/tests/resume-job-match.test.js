// Resume ⇄ Job Description match direction (spec §1F/§1G).
// The JD states requirements; the resume is checked for evidence of them.
// The old client logic did the reverse and reported unrelated resume skills as
// "missing". These tests lock the correct direction in.
const { matchResumeToJobDescription } = require('../dist/services/resumeJobMatch.service');

describe('resume ⇄ job description match', () => {
  test('missing = JD requirements not evidenced on the resume (never the reverse)', async () => {
    const result = await matchResumeToJobDescription({
      jobDescription: [
        'Requirements:',
        '- Node.js and MongoDB experience',
        '- Docker and AWS required',
        'You should have strong communication skills.',
      ].join('\n'),
      resumeText: 'Backend developer. Skills: Node.js, MongoDB. Built REST APIs with Express.',
      // Python is on the resume but the JD never asks for it.
      resumeSkills: [
        { slug: 'node', label: 'Node.js' },
        { slug: 'mongodb', label: 'MongoDB' },
        { slug: 'python', label: 'Python' },
      ],
    });

    const missing = result.missingSkills.map(s => s.slug);
    const matched = result.matchedSkills.map(s => s.slug);

    // Requirements the resume does not evidence are reported missing.
    expect(missing).toEqual(expect.arrayContaining(['docker', 'aws']));
    // A resume-only skill must NEVER be reported as a missing requirement.
    expect(missing).not.toContain('python');
    // Requirements the resume does evidence are matched.
    expect(matched).toEqual(expect.arrayContaining(['node.js', 'mongodb']));
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // Every component carries a traceable basis string.
    for (const component of result.components) {
      expect(typeof component.basis).toBe('string');
      expect(component.basis.length).toBeGreaterThan(0);
    }
  });

  test('scores 100/100 when the resume evidences every detected requirement', async () => {
    const result = await matchResumeToJobDescription({
      jobDescription: 'Requirements:\n- Docker\n- AWS',
      resumeText: 'Experienced with Docker containers and AWS deployments.',
      resumeSkills: [],
    });
    expect(result.missingSkills).toHaveLength(0);
    expect(result.matchedSkills.length).toBeGreaterThan(0);
    expect(result.score).toBe(100);
  });

  test('returns no invented score when the description has no recognisable skills', async () => {
    const result = await matchResumeToJobDescription({
      jobDescription: 'We are a friendly team that values curiosity and a positive attitude every single day.',
      resumeText: 'Python developer.',
      resumeSkills: [{ slug: 'python', label: 'Python' }],
    });
    expect(result.requiredSkills).toHaveLength(0);
    expect(result.preferredSkills).toHaveLength(0);
    expect(result.score).toBe(0);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });
});
