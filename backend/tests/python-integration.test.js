const axios = require('axios');
const http = require('http');
const request = require('supertest');
const mongoose = require('mongoose');
const pythonAI = require('../dist/services/pythonAI').default;
const User = require('../dist/models/User').default;
const Interview = require('../dist/models/Interview').default;
const { generateTokens } = require('../dist/utils/auth');
const { parsedResumeSkills, validateResumeEvaluation, serializeResume } = require('../dist/services/resumeProcessing');
const app = require('../dist/app').createApp();
const env = { ...process.env };
afterEach(() => { jest.restoreAllMocks(); process.env = { ...env }; });

test('Python connection refusal fails only the optional analysis route', async () => {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  process.env.PYTHON_AI_SERVER_URL = `http://127.0.0.1:${port}`;
  process.env.PYTHON_AI_SERVER_API_KEY = 'test-key';
  process.env.JWT_ACCESS_SECRET = 'test-access';
  process.env.JWT_REFRESH_SECRET = 'test-refresh';
  jest.replaceProperty(mongoose.connection, '_readyState', 1);
  const id = '507f1f77bcf86cd799439011';
  jest.spyOn(User, 'findById').mockResolvedValue({ _id: id, auth: { role: 'user', tokenVersion: 0 }, subscription: { plan: 'free' }, isAccountLocked: () => false });
  const save = jest.fn();
  jest.spyOn(Interview, 'findOne').mockResolvedValue({ save });
  const token = generateTokens(id).accessToken;
  const result = await request(app).post(`/api/interview/${id}/analyze/video`).set('Authorization', `Bearer ${token}`).send({ frameData: 'invalid', timestamp: 0 });
  expect(result.status).toBe(503);
  expect(JSON.stringify(result.body)).not.toContain('test-key');
  expect(save).not.toHaveBeenCalled();
  await request(app).get('/health').expect(200);
});

test.each([{ success: false }, { success: true, data: { error: 'Unavailable' } }])('Python invalid envelope is rejected', async body => {
  process.env.PYTHON_AI_SERVER_API_KEY = 'test-key';
  jest.spyOn(axios, 'post').mockResolvedValue({ data: body });
  await expect(pythonAI.post('/api/resume/parse', {})).rejects.toMatchObject({ statusCode: 503 });
});

test('resume serialization never restores legacy fabricated scores or skills after a parse failure', () => {
  const result = serializeResume({ _id: 'resume', filename: 'test.pdf', analysis: { score: 85, skills: ['invented'] }, metadata: { processingStatus: 'completed', analysisVersion: '1.0.0', parsedData: { error: 'failed' } } });
  expect(result).toMatchObject({ score: null, extractedSkills: [], processingStatus: 'failed', analysisStatus: 'unavailable' });
  expect(parsedResumeSkills({ raw_text: 'Real content', skills: [{ skills: ['Python', 'SQL'] }, 'SQL'] })).toEqual(['Python', 'SQL']);
});

test('resume evaluation preserves zero and rejects invented out-of-range scores', () => {
  const review = { score: 0, contentQuality: 0, keywords: 0, impact: 0, suggestions: [] };
  expect(validateResumeEvaluation(review).score).toBe(0);
  expect(() => validateResumeEvaluation({ ...review, score: 101 })).toThrow();
});

(process.env.PYTHON_INTEGRATION === '1' ? test : test.skip)('Node multipart adapter communicates with the real Python parser', async () => {
  require('../dist/config/environment').loadEnvironment();
  const path = require('path');
  const { execFileSync } = require('child_process');
  const python = process.env.PYTHON_TEST_EXECUTABLE || path.resolve('../ai-server/.venv/Scripts/python.exe');
  const docx = execFileSync(python, ['-c', "import io,sys; from docx import Document; d=Document(); d.add_paragraph('Integration Candidate: Built JavaScript applications using Python and SQL.'); b=io.BytesIO(); d.save(b); sys.stdout.buffer.write(b.getvalue())"], { windowsHide: true });
  const FormData = require('form-data');
  const form = new FormData();
  form.append('resume_file', docx, { filename: 'integration.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const parsed = await pythonAI.post('/api/resume/parse', form, { headers: form.getHeaders() });
  expect(parsed.raw_text).toContain('Built JavaScript applications');
  expect(parsedResumeSkills(parsed)).toEqual(expect.arrayContaining(['javascript', 'python', 'sql']));
  expect(parsedResumeSkills(parsed)).not.toContain('java');
}, 30000);
