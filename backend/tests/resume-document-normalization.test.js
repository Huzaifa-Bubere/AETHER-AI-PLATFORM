// Spec §5D — old/incomplete resume documents must not crash the builder.
//
// The reported crash was "Cannot read properties of undefined (reading
// 'length')" from `doc.experience.length` / `doc.projects.length` / … on a
// document that predates those fields. The fix is at the DATA BOUNDARY: the
// Mongoose schema provides structural defaults for every collection and the
// document is normalized on read, so a fixture as small as { name: "Huzaifa" }
// yields empty arrays instead of undefined.
const { Types } = require('mongoose');
const { ResumeVersion } = require('../dist/models/ResumeVersion');

const ARRAY_FIELDS = ['links', 'education', 'experience', 'projects', 'skills', 'certifications', 'achievements', 'languages', 'customSections', 'sectionOrder'];
const STRING_FIELDS = ['name', 'title', 'email', 'phone', 'location', 'summary', 'targetJobDescription'];

test('a fixture with only a name loads with empty arrays and no undefined.length crash', () => {
  const doc = new ResumeVersion({ userId: new Types.ObjectId(), name: 'Huzaifa' });
  const data = doc.data.toObject();

  for (const field of ARRAY_FIELDS) {
    expect(Array.isArray(data[field])).toBe(true);
    expect(data[field]).toHaveLength(0); // `.length` is always safe to read
  }
  for (const field of STRING_FIELDS) {
    expect(typeof data[field]).toBe('string');
  }
  expect(Array.isArray(doc.data.sectionOrder)).toBe(true);
  expect(typeof doc.data.name).toBe('string');
});

test('a partially populated document keeps its text and fills the missing collections', () => {
  const doc = new ResumeVersion({
    userId: new Types.ObjectId(),
    name: 'Legacy resume',
    data: { name: 'Huzaifa', summary: 'Backend developer', experience: [{ title: 'Engineer' }] },
  });
  const data = doc.data.toObject();

  expect(data.name).toBe('Huzaifa');          // user text is never overwritten
  expect(data.summary).toBe('Backend developer');
  expect(data.experience).toHaveLength(1);
  expect(data.projects).toHaveLength(0);      // filled structurally
  expect(data.skills).toHaveLength(0);
  expect(data.certifications).toHaveLength(0);
});
